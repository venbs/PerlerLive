import './style.css';
import { registerSW } from 'virtual:pwa-register';
import {
  setupP5,
  AppState,
  PALETTES,
  PALETTE_KEYS,
  switchPalette,
} from './p5setup.js';
import { createGestureController } from './src/gesture/gestureController.js';

let gestureController = null;
let gestureToggleInput = null;
let gestureSettingsGroup = null;
const paletteButtons = new Map();

// Setup PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('新版本已可用。是否重新加载？')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('应用已可以离线使用');
  },
});

const isMobile = () => window.innerWidth <= 768;

window.addEventListener('load', () => {
  setupP5();
  setupUI();
  setupGestureController();
  if (isMobile()) {
    setupMobile();
  }
  // Start preloading the gesture model in the background
  preloadGestureModel();
});

window.addEventListener('beforeunload', () => {
  if (gestureController) {
    gestureController.destroy();
  }
});

// --- Keyboard Shortcuts (registered at top level to avoid focus conflicts and HMR bugs) ---
// By placing this outside the 'load' event, we guarantee it attaches even during Vite hot-reloads.
window.addEventListener(
  'keydown',
  (e) => {
    if (e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
      const panel = document.getElementById('ui-panel');
      if (panel) {
        e.preventDefault(); // prevent 'a' from moving a focused range slider
        panel.classList.toggle('hide-panel');
      }
    }
  },
  { capture: true }
);

// =============================================
// Desktop UI Setup (also used by mobile)
// =============================================
function setupUI() {
  const resInput = document.getElementById('resolution');
  const resVal = document.getElementById('resolution-val');

  const borderInput = document.getElementById('border-radius');
  const borderVal = document.getElementById('border-radius-val');

  const bevelInput = document.getElementById('bevel-size');
  const bevelVal = document.getElementById('bevel-size-val');
  const gapInput = document.getElementById('gap-size');
  const gapVal = document.getElementById('gap-size-val');

  const holeInput = document.getElementById('hole-size');
  const holeVal = document.getElementById('hole-size-val');

  const pngBtn = document.getElementById('export-png-btn');
  const svgBtn = document.getElementById('export-svg-btn');

  gestureToggleInput = document.getElementById('gesture-toggle');
  gestureSettingsGroup = document.getElementById('gesture-settings-group');
  const gestureFpsInput = document.getElementById('gesture-fps');
  const gestureFpsVal = document.getElementById('gesture-fps-val');
  const gestureTravelInput = document.getElementById('gesture-travel');
  const gestureTravelVal = document.getElementById('gesture-travel-val');
  const gestureVerticalInput = document.getElementById('gesture-vertical');
  const gestureVerticalVal = document.getElementById('gesture-vertical-val');
  const gestureDominanceInput = document.getElementById('gesture-dominance');
  const gestureDominanceVal = document.getElementById('gesture-dominance-val');
  const gestureCooldownInput = document.getElementById('gesture-cooldown');
  const gestureCooldownVal = document.getElementById('gesture-cooldown-val');

  // On mobile, use 'change' (fire on release) instead of 'input' (fire on drag)
  const sliderEvent = isMobile() ? 'change' : 'input';

  let resTimeout;
  resInput.addEventListener('input', (e) => {
    clearTimeout(resTimeout);
    resTimeout = setTimeout(() => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 64; // fallback to default
      if (val < 16) val = 16;
      if (val > 128) val = 128;

      e.target.value = val; // visually reflect clamped value
      if (resVal) resVal.textContent = `${val}px`;

      if (AppState.resolution !== val) {
        AppState.resolution = val;
        requestUpdate();
      }
    }, 500);
  });

  borderInput.addEventListener(sliderEvent, (e) => {
    AppState.perlerRadius = parseInt(e.target.value, 10);
    borderVal.textContent = `${AppState.perlerRadius}%`;
    requestRedraw();
  });

  bevelInput.addEventListener(sliderEvent, (e) => {
    AppState.bevelSize = parseInt(e.target.value, 10);
    bevelVal.textContent = `${AppState.bevelSize}%`;
    requestRedraw();
  });

  gapInput.addEventListener(sliderEvent, (e) => {
    AppState.perlerGap = parseFloat(e.target.value);
    gapVal.textContent = `${AppState.perlerGap}px`;
    requestRedraw();
  });

  holeInput.addEventListener(sliderEvent, (e) => {
    AppState.holeSize = parseInt(e.target.value, 10);
    holeVal.textContent = `${AppState.holeSize}%`;
    requestRedraw();
  });

  pngBtn.addEventListener('click', () => {
    if (AppState.exportPNG) AppState.exportPNG();
  });

  svgBtn.addEventListener('click', () => {
    if (AppState.exportSVG) AppState.exportSVG(showToast);
  });

  gestureFpsInput.value = String(AppState.gestureSampleFps);
  gestureFpsVal.textContent = `${AppState.gestureSampleFps}Hz`;
  gestureTravelInput.value = String(Math.round(AppState.gestureMinHorizontalTravel * 100));
  gestureTravelVal.textContent = `${Math.round(AppState.gestureMinHorizontalTravel * 100)}%`;
  gestureVerticalInput.value = String(Math.round(AppState.gestureMaxVerticalRatio * 100));
  gestureVerticalVal.textContent = `${Math.round(AppState.gestureMaxVerticalRatio * 100)}%`;
  gestureDominanceInput.value = String(Math.round(AppState.gestureDirectionDominance * 100));
  gestureDominanceVal.textContent = `${Math.round(AppState.gestureDirectionDominance * 100)}%`;
  gestureCooldownInput.value = String(AppState.gestureCooldownMs);
  gestureCooldownVal.textContent = `${AppState.gestureCooldownMs}ms`;

  gestureFpsInput.addEventListener(sliderEvent, (e) => {
    AppState.gestureSampleFps = parseInt(e.target.value, 10);
    gestureFpsVal.textContent = `${AppState.gestureSampleFps}Hz`;
  });

  gestureTravelInput.addEventListener(sliderEvent, (e) => {
    const nextValue = parseInt(e.target.value, 10);
    AppState.gestureMinHorizontalTravel = nextValue / 100;
    gestureTravelVal.textContent = `${nextValue}%`;
  });

  gestureVerticalInput.addEventListener(sliderEvent, (e) => {
    const nextValue = parseInt(e.target.value, 10);
    AppState.gestureMaxVerticalRatio = nextValue / 100;
    gestureVerticalVal.textContent = `${nextValue}%`;
  });

  gestureDominanceInput.addEventListener(sliderEvent, (e) => {
    const nextValue = parseInt(e.target.value, 10);
    AppState.gestureDirectionDominance = nextValue / 100;
    gestureDominanceVal.textContent = `${nextValue}%`;
  });

  gestureCooldownInput.addEventListener(sliderEvent, (e) => {
    AppState.gestureCooldownMs = parseInt(e.target.value, 10);
    gestureCooldownVal.textContent = `${AppState.gestureCooldownMs}ms`;
  });

  syncGestureSettingsVisibility(AppState.gestureEnabled);
  setupPalettePresets();
}

function setupPalettePresets() {
  const grid = document.getElementById('palette-preset-grid');
  if (!grid) return;

  grid.innerHTML = '';
  paletteButtons.clear();

  PALETTE_KEYS.forEach((key) => {
    const preset = PALETTES[key];
    const btn = document.createElement('button');
    btn.className =
      'palette-preset-btn' +
      (key === AppState.currentPaletteKey ? ' active' : '');
    btn.dataset.key = key;
    btn.title = preset.name;

    const swatchRow = document.createElement('div');
    swatchRow.className = 'palette-preset-swatches';
    preset.colors.forEach(([r, g, b]) => {
      const dot = document.createElement('span');
      dot.className = 'palette-preset-dot';
      dot.style.background = `rgb(${r},${g},${b})`;
      swatchRow.appendChild(dot);
    });

    const nameLabel = document.createElement('span');
    nameLabel.className = 'palette-preset-name';
    nameLabel.textContent = preset.name;

    btn.appendChild(swatchRow);
    btn.appendChild(nameLabel);
    grid.appendChild(btn);
    paletteButtons.set(key, btn);

    btn.addEventListener('click', () => {
      selectPaletteByKey(key, 'ui');
    });
  });

  AppState.onPaletteChange = ({ key }) => {
    applyPaletteButtonState(key);
  };
}

function applyPaletteButtonState(activeKey) {
  paletteButtons.forEach((btn, key) => {
    btn.classList.toggle('active', key === activeKey);
  });
}

function selectPaletteByKey(key, source = 'ui') {
  if (!PALETTES[key]) return false;
  const didSwitch = switchPalette(key, source);
  if (!didSwitch) return false;
  showToast(`已切换：${PALETTES[key].name}`);
  return true;
}

function selectPaletteByIndex(index, source = 'ui') {
  const paletteCount = PALETTE_KEYS.length;
  const normalizedIndex = ((index % paletteCount) + paletteCount) % paletteCount;
  const nextKey = PALETTE_KEYS[normalizedIndex];
  return selectPaletteByKey(nextKey, source);
}

function stepPalette(delta, source = 'gesture') {
  return selectPaletteByIndex(AppState.currentPaletteIndex + delta, source);
}

function setupGestureController() {
  gestureToggleInput = document.getElementById('gesture-toggle');
  if (!gestureToggleInput) return;

  const modelAssetPath = new URL(
    `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
    window.location.origin
  ).toString();
  const wasmRoot = new URL(
    `${import.meta.env.BASE_URL}mediapipe`,
    window.location.origin
  ).toString();

  gestureController = createGestureController({
    modelAssetPath,
    wasmRoot,
    getVideoElement: () => AppState.videoCapture?.elt ?? null,
    getConfig: () => ({
      sampleFps: AppState.gestureSampleFps,
      minHorizontalTravel: AppState.gestureMinHorizontalTravel,
      maxVerticalRatio: AppState.gestureMaxVerticalRatio,
      directionDominance: AppState.gestureDirectionDominance,
      cooldownMs: AppState.gestureCooldownMs,
    }),
    onWave: (direction) => {
      stepPalette(direction === 'right' ? 1 : -1, 'gesture');
    },
    onError: (message) => {
      AppState.gestureEnabled = false;
      if (gestureToggleInput) {
        gestureToggleInput.checked = false;
        gestureToggleInput.disabled = false;
      }
      syncGestureSettingsVisibility(false);
      showToast(message);
    },
  });

  gestureToggleInput.checked = AppState.gestureEnabled;
  gestureToggleInput.addEventListener('change', async (event) => {
    const enabled = event.target.checked;
    gestureToggleInput.disabled = true;
    syncGestureSettingsVisibility(enabled);

    try {
      if (enabled) {
        await gestureController.enable();
        AppState.gestureEnabled = true;
      } else {
        gestureController.disable();
        AppState.gestureEnabled = false;
      }
    } catch (error) {
      console.error('[gesture]', error);
      AppState.gestureEnabled = false;
      gestureToggleInput.checked = false;
      syncGestureSettingsVisibility(false);
    } finally {
      gestureToggleInput.disabled = false;
    }
  });
}

/**
 * Preload gesture model in background on page load.
 * Shows spinner → toggle swap when ready, or error on failure.
 */
async function preloadGestureModel() {
  if (!gestureController) return;

  const loadingEl = document.getElementById('gesture-loading');
  const toggleWrapper = document.getElementById('gesture-toggle-wrapper');

  try {
    await gestureController.preload();
    // Preload succeeded — swap spinner for toggle
    if (loadingEl) loadingEl.style.display = 'none';
    if (toggleWrapper) toggleWrapper.classList.remove('gesture-toggle-hidden');
  } catch (error) {
    console.error('[gesture] preload failed:', error);
    // Show error text in place of spinner
    if (loadingEl) {
      loadingEl.innerHTML = '<span class="gesture-loading-failed">加载失败</span>';
    }
  }
}

function syncGestureSettingsVisibility(visible) {
  if (!gestureSettingsGroup) return;
  gestureSettingsGroup.classList.toggle('is-collapsed', !visible);
}

// =============================================
// Mobile Setup: Tab Bar, Bottom Sheet, DOM move
// =============================================
function setupMobile() {
  const uiPanel = document.getElementById('ui-panel');
  const sheet = document.getElementById('mobile-sheet');
  const tabBar = document.getElementById('mobile-tab-bar');
  const tabBtns = tabBar.querySelectorAll('.tab-btn');

  const panels = {
    import: sheet.querySelector('[data-panel="import"]'),
    style: sheet.querySelector('[data-panel="style"]'),
    export: sheet.querySelector('[data-panel="export"]'),
  };

  moveChildren(uiPanel, panels.import, [
    '[data-mobile-group="import-resolution"]',
    '[data-mobile-group="palette-preset"]',
    '[data-mobile-group="gesture-control"]',
    '[data-mobile-group="gesture-settings"]',
  ]);

  moveChildren(uiPanel, panels.style, ['[data-mobile-group="style-controls"]']);

  moveChildren(uiPanel, panels.export, ['[data-mobile-group="export-buttons"]']);

  let activeTab = null;

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      if (activeTab === tab) {
        closeSheet();
        return;
      }

      activeTab = tab;

      tabBtns.forEach((button) => button.classList.remove('active'));
      btn.classList.add('active');

      Object.values(panels).forEach((panel) => panel.classList.remove('active'));
      panels[tab].classList.add('active');

      sheet.classList.add('open');
    });
  });

  function closeSheet() {
    sheet.classList.remove('open');
    tabBtns.forEach((button) => button.classList.remove('active'));
    activeTab = null;
  }

  const handle = sheet.querySelector('.sheet-handle');
  let sheetTouchStartY = 0;
  let sheetTranslateY = 0;

  handle.addEventListener(
    'touchstart',
    (e) => {
      sheetTouchStartY = e.touches[0].clientY;
      sheetTranslateY = 0;
      sheet.style.transition = 'none';
    },
    { passive: true }
  );

  handle.addEventListener(
    'touchmove',
    (e) => {
      const dy = e.touches[0].clientY - sheetTouchStartY;
      if (dy > 0) {
        sheetTranslateY = dy;
        sheet.style.transform = `translateY(${dy}px)`;
      }
    },
    { passive: true }
  );

  handle.addEventListener('touchend', () => {
    sheet.style.transition = '';
    if (sheetTranslateY > 60) {
      closeSheet();
    }
    sheet.style.transform = '';
    sheetTranslateY = 0;
  });

  const handleCanvasInteraction = () => {
    if (activeTab) {
      closeSheet();
    }
  };

  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('mousedown', handleCanvasInteraction);
  canvasContainer.addEventListener('touchstart', handleCanvasInteraction, {
    passive: true,
  });
}

function moveChildren(source, dest, selectors) {
  selectors.forEach((selector) => {
    const element = source.querySelector(selector);
    if (element) {
      dest.appendChild(element);
    }
  });
}

// =============================================
// Loading overlay
// =============================================
function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('show');
}

export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('show');
}

// =============================================
// Shared utilities
// =============================================
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function requestUpdate() {
  if (AppState.triggerUpdate) {
    clearTimeout(AppState.updateTimeout);
    const delay = isMobile() ? 300 : 150;
    AppState.updateTimeout = setTimeout(() => {
      if (isMobile()) showLoading();
      AppState.triggerUpdate();
    }, delay);
  }
}

function requestRedraw() {
  if (AppState.triggerRedraw) {
    AppState.triggerRedraw();
  }
}
