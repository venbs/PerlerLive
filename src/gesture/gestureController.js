const DEFAULT_CONFIG = {
  sampleFps: 15,
  trackWindowPoints: 10,
  minWindowPoints: 3,
  minHorizontalTravel: 0.12,
  maxVerticalRatio: 0.45,
  minDirectionStep: 0.003,
  directionDominance: 0.55,
  cooldownMs: 900,
  activeHandSwitchDistance: 0.18,
};

export function createGestureController(options) {
  return new GestureController(options);
}

class GestureController {
  constructor({
    modelAssetPath,
    wasmRoot,
    getVideoElement,
    getConfig,
    onWave,
    onError,
  }) {
    this.modelAssetPath = modelAssetPath;
    this.wasmRoot = wasmRoot;
    this.getVideoElement = getVideoElement;
    this.getConfig = getConfig;
    this.onWave = onWave;
    this.onError = onError;

    this.enabled = false;
    this.worker = null;
    this.workerReady = false;
    this.initPromise = null;
    this.processInFlight = false;
    this.timerId = null;
    this.track = [];
    this.cooldownUntil = 0;
    this.lastFrameHands = [];
    this.activeHandCenter = null;

    this.handleWorkerMessage = this.handleWorkerMessage.bind(this);
    this.handleWorkerCrash = this.handleWorkerCrash.bind(this);
  }

  async enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.resetTrack();
    this.cooldownUntil = 0;
    await this.ensureWorker();
    this.scheduleNextTick(0);
  }

  /**
   * Preload the worker and model without starting detection.
   * Resolves when the worker reports 'ready'.
   */
  async preload() {
    await this.ensureWorker();
  }

  disable() {
    this.enabled = false;
    this.stopLoop();
    this.resetTrack();
    this.cooldownUntil = 0;
    this.processInFlight = false;
    this.lastFrameHands = [];
    this.activeHandCenter = null;

    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.removeEventListener('message', this.handleWorkerMessage);
      this.worker.removeEventListener('error', this.handleWorkerCrash);
      this.worker.terminate();
      this.worker = null;
    }

    this.workerReady = false;
    this.initPromise = null;
  }

  destroy() {
    this.disable();
  }

  async ensureWorker() {
    if (this.worker && this.workerReady) return;
    if (this.initPromise) return this.initPromise;

    console.log('[gesture] creating worker…');
    this.worker = new Worker(new URL('./handGestureWorker.js', import.meta.url), {
      type: 'module',
    });
    this.worker.addEventListener('message', this.handleWorkerMessage);
    this.worker.addEventListener('error', this.handleWorkerCrash);

    this.initPromise = new Promise((resolve, reject) => {
      this.resolveInit = resolve;
      this.rejectInit = reject;
    });

    console.log('[gesture] sending init, wasmRoot =', this.wasmRoot);
    this.worker.postMessage({
      type: 'init',
      modelAssetPath: this.modelAssetPath,
      wasmRoot: this.wasmRoot,
    });

    return this.initPromise;
  }

  handleWorkerMessage(event) {
    const { data } = event;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'ready':
        this.workerReady = true;
        if (this.resolveInit) this.resolveInit();
        this.clearInitHooks();
        break;
      case 'result':
        this.processInFlight = false;
        if (this.enabled) {
          this.consumeDetection(data);
          this.scheduleNextTick();
        }
        break;
      case 'error':
        this.processInFlight = false;
        if (data.fatal) {
          if (this.rejectInit) this.rejectInit(new Error(data.message));
          this.clearInitHooks();
          this.failController(data.message);
        } else {
          console.warn('[gesture]', data.message);
          if (this.enabled) {
            this.scheduleNextTick();
          }
        }
        break;
      default:
        break;
    }
  }

  handleWorkerCrash(error) {
    const message = error?.message || '手势识别 worker 崩溃';
    if (this.rejectInit) this.rejectInit(new Error(message));
    this.clearInitHooks();
    this.failController(message);
  }

  failController(message) {
    this.disable();
    if (typeof this.onError === 'function') {
      this.onError(message);
    }
  }

  clearInitHooks() {
    this.resolveInit = null;
    this.rejectInit = null;
    this.initPromise = null;
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
  }

  stopLoop() {
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  scheduleNextTick(delay) {
    this.stopLoop();
    if (!this.enabled) return;
    const config = this.readConfig();
    const intervalMs = Math.max(1000 / config.sampleFps, 1000 / 24);
    this.timerId = window.setTimeout(() => {
      this.tick();
    }, delay ?? intervalMs);
  }

  async tick() {
    if (!this.enabled || this.processInFlight || !this.workerReady || !this.worker) {
      this.scheduleNextTick();
      return;
    }

    const video = this.getVideoElement?.();
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      this.scheduleNextTick();
      return;
    }

    try {
      this.processInFlight = true;
      const bitmap = await createImageBitmap(video);
      this.worker.postMessage(
        {
          type: 'processFrame',
          bitmap,
          timestampMs: performance.now(),
        },
        [bitmap]
      );
    } catch (error) {
      this.processInFlight = false;
      this.failController(error instanceof Error ? error.message : '无法采集手势帧');
    }
  }

  consumeDetection(result) {
    const config = this.readConfig();
    const selectedHand = this.selectActiveHand(result.hands ?? []);
    this.lastFrameHands = result.hands ?? [];

    if (!selectedHand || !selectedHand.openPalm) {
      this.activeHandCenter = null;
      this.resetTrack();
      return;
    }

    if (result.timestampMs < this.cooldownUntil) {
      this.resetTrack();
      return;
    }

    const point = {
      x: 1 - selectedHand.centerX,
      y: selectedHand.centerY,
      time: result.timestampMs,
    };

    if (
      this.activeHandCenter &&
      distance(point, this.activeHandCenter) > config.activeHandSwitchDistance
    ) {
      this.resetTrack();
    }

    this.activeHandCenter = { x: point.x, y: point.y };

    this.track.push(point);
    if (this.track.length > config.trackWindowPoints) {
      this.track.shift();
    }

    const direction = this.detectWaveDirection(config);
    if (!direction) return;

    this.cooldownUntil = result.timestampMs + config.cooldownMs;
    this.resetTrack();
    this.onWave?.(direction);
  }

  detectWaveDirection(config) {
    if (this.track.length < config.minWindowPoints) return null;

    for (
      let startIndex = this.track.length - config.minWindowPoints;
      startIndex >= 0;
      startIndex -= 1
    ) {
      const direction = this.evaluateWindow(this.track.slice(startIndex), config);
      if (direction) return direction;
    }

    return null;
  }

  evaluateWindow(trackWindow, config) {
    const first = trackWindow[0];
    const last = trackWindow[trackWindow.length - 1];
    const deltaX = last.x - first.x;
    const horizontalTravel = Math.abs(deltaX);

    if (horizontalTravel < config.minHorizontalTravel) return null;

    let minY = Infinity;
    let maxY = -Infinity;
    let positiveSteps = 0;
    let negativeSteps = 0;
    let directionalSteps = 0;

    for (let i = 0; i < trackWindow.length; i++) {
      const { y } = trackWindow[i];
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      if (i === 0) continue;
      const dx = trackWindow[i].x - trackWindow[i - 1].x;
      if (Math.abs(dx) < config.minDirectionStep) continue;
      directionalSteps += 1;
      if (dx > 0) {
        positiveSteps += 1;
      } else {
        negativeSteps += 1;
      }
    }

    if (directionalSteps < Math.max(2, config.minWindowPoints - 1)) return null;

    const verticalRange = maxY - minY;
    if (verticalRange > horizontalTravel * config.maxVerticalRatio) return null;

    const dominantSteps = deltaX > 0 ? positiveSteps : negativeSteps;
    if (dominantSteps / directionalSteps < config.directionDominance) return null;

    return deltaX > 0 ? 'right' : 'left';
  }

  resetTrack() {
    this.track.length = 0;
  }

  readConfig() {
    return {
      ...DEFAULT_CONFIG,
      ...(typeof this.getConfig === 'function' ? this.getConfig() : null),
    };
  }

  selectActiveHand(hands) {
    if (!hands.length) return null;

    const candidateHands = hands.filter((hand) => hand.openPalm);
    const pool = candidateHands.length ? candidateHands : hands;
    if (pool.length === 1) return pool[0];

    let bestHand = pool[0];
    let bestMotion = -1;
    let bestContinuityDistance = Infinity;

    for (const hand of pool) {
      const motion = this.measureHandMotion(hand);
      const continuityDistance = this.activeHandCenter
        ? distance(
            { x: 1 - hand.centerX, y: hand.centerY },
            this.activeHandCenter
          )
        : Infinity;

      if (motion > bestMotion + 0.002) {
        bestHand = hand;
        bestMotion = motion;
        bestContinuityDistance = continuityDistance;
        continue;
      }

      if (Math.abs(motion - bestMotion) <= 0.002) {
        if (continuityDistance < bestContinuityDistance) {
          bestHand = hand;
          bestMotion = motion;
          bestContinuityDistance = continuityDistance;
          continue;
        }

        if (
          continuityDistance === bestContinuityDistance &&
          hand.confidence > bestHand.confidence
        ) {
          bestHand = hand;
          bestMotion = motion;
        }
      }
    }

    return bestHand;
  }

  measureHandMotion(hand) {
    if (!this.lastFrameHands.length) return 0;

    let smallestDistance = Infinity;
    for (const previousHand of this.lastFrameHands) {
      smallestDistance = Math.min(
        smallestDistance,
        distance(
          { x: hand.centerX, y: hand.centerY },
          { x: previousHand.centerX, y: previousHand.centerY }
        )
      );
    }

    return smallestDistance === Infinity ? 0 : smallestDistance;
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
