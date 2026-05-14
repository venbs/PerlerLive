import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handLandmarker = null;
let initialized = false;

self.onmessage = async (event) => {
  const { data } = event;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'init':
      await initHandLandmarker(data);
      break;
    case 'processFrame':
      processFrame(data);
      break;
    case 'stop':
      stopHandLandmarker();
      break;
    default:
      break;
  }
};

async function initHandLandmarker({ wasmRoot, modelAssetPath }) {
  if (initialized && handLandmarker) {
    self.postMessage({ type: 'ready' });
    return;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(wasmRoot, true);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    initialized = true;
    self.postMessage({ type: 'ready' });
  } catch (error) {
    postError('手势识别初始化失败', true, error);
  }
}

function processFrame({ bitmap, timestampMs }) {
  if (!initialized || !handLandmarker) {
    if (bitmap) bitmap.close();
    return;
  }

  try {
    const result = handLandmarker.detectForVideo(bitmap, timestampMs);
    self.postMessage({
      type: 'result',
      timestampMs,
      ...normalizeResult(result),
    });
  } catch (error) {
    postError('手势识别处理中断', false, error);
  } finally {
    if (bitmap) bitmap.close();
  }
}

function stopHandLandmarker() {
  if (handLandmarker) {
    handLandmarker.close();
    handLandmarker = null;
  }
  initialized = false;
}

function normalizeResult(result) {
  const handCount = result?.landmarks?.length ?? 0;
  if (handCount !== 1) {
    return {
      handCount,
      singleHand: false,
      openPalm: false,
      confidence: 0,
    };
  }

  const landmarks = result.landmarks[0];
  const handedness = result.handedness?.[0]?.[0];
  const center = getPalmCenter(landmarks);

  return {
    handCount,
    singleHand: true,
    openPalm: isOpenPalm(landmarks),
    centerX: center.x,
    centerY: center.y,
    confidence: handedness?.score ?? 0,
    handedness: handedness?.categoryName ?? 'Unknown',
  };
}

function getPalmCenter(landmarks) {
  const palmIndices = [0, 5, 9, 13, 17];
  let sumX = 0;
  let sumY = 0;
  for (const index of palmIndices) {
    sumX += landmarks[index].x;
    sumY += landmarks[index].y;
  }
  return {
    x: sumX / palmIndices.length,
    y: sumY / palmIndices.length,
  };
}

function isOpenPalm(landmarks) {
  const wrist = landmarks[0];
  const fingerPairs = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  let extendedCount = 0;
  for (const [tipIndex, pipIndex] of fingerPairs) {
    const tipDistance = distance(landmarks[tipIndex], wrist);
    const pipDistance = distance(landmarks[pipIndex], wrist);
    if (tipDistance > pipDistance * 1.12) {
      extendedCount += 1;
    }
  }

  const palmWidth = distance(landmarks[5], landmarks[17]);
  const fingertipSpan = distance(landmarks[8], landmarks[20]);
  return extendedCount >= 3 && fingertipSpan > palmWidth * 0.85;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function postError(message, fatal, error) {
  const detail = error instanceof Error ? error.message : String(error || '');
  self.postMessage({
    type: 'error',
    fatal,
    message: detail ? `${message}：${detail}` : message,
  });
}
