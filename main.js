import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { setupP5, AppState, PALETTES, switchPalette } from './p5setup.js';

// Setup PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("新版本已可用。是否重新加载？")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("应用已可以离线使用");
  },
});

const isMobile = () => window.innerWidth <= 768;

window.addEventListener('load', () => {
  setupP5();
  setupUI();
  if (isMobile()) {
    setupMobile();
  }
});

// --- Keyboard Shortcuts (registered at top level to avoid focus conflicts and HMR bugs) ---
// By placing this outside the 'load' event, we guarantee it attaches even during Vite hot-reloads.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
    const panel = document.getElementById('ui-panel');
    if (panel) {
      e.preventDefault(); // prevent 'a' from moving a focused range slider
      panel.classList.toggle('hide-panel');
    }
  }
}, { capture: true });

// =============================================
// Desktop UI Setup (also used by mobile)
// =============================================
function setupUI() {
  const resInput = document.getElementById('resolution');
  const resVal = document.getElementById('resolution-val');
  
  const borderInput = document.getElementById('border-radius');
  const borderVal = document.getElementById('border-radius-val');
  
  const bevelInput = document.getElementById('bevel-size');
  const bevelVal   = document.getElementById('bevel-size-val');
  const gapInput = document.getElementById('gap-size'); 
  const gapVal = document.getElementById('gap-size-val');
  
  const holeInput = document.getElementById('hole-size');
  const holeVal = document.getElementById('hole-size-val');
  
  const pngBtn = document.getElementById('export-png-btn');
  const svgBtn = document.getElementById('export-svg-btn');

  // On mobile, use 'change' (fire on release) instead of 'input' (fire on drag)
  const sliderEvent = isMobile() ? 'change' : 'input';

  let resTimeout;
  resInput.addEventListener('input', (e) => {
    clearTimeout(resTimeout);
    resTimeout = setTimeout(() => {
      let val = parseInt(e.target.value);
      if (isNaN(val)) val = 64; // fallback to default
      if (val < 16) val = 16;
      if (val > 128) val = 128;
      
      e.target.value = val; // visually reflect clamped value
      if (resVal) resVal.textContent = val + 'px';
      
      if (AppState.resolution !== val) {
        AppState.resolution = val;
        requestUpdate();
      }
    }, 500);
  });

  borderInput.addEventListener(sliderEvent, (e) => {
    AppState.perlerRadius = parseInt(e.target.value);
    borderVal.textContent = AppState.perlerRadius + '%';
    requestRedraw();
  });

  bevelInput.addEventListener(sliderEvent, (e) => {
    AppState.bevelSize = parseInt(e.target.value);
    bevelVal.textContent = AppState.bevelSize + '%';
    requestRedraw();
  });

  gapInput.addEventListener(sliderEvent, (e) => {
    AppState.perlerGap = parseFloat(e.target.value);
    gapVal.textContent = AppState.perlerGap + 'px';
    requestRedraw();
  });

  holeInput.addEventListener(sliderEvent, (e) => {
    AppState.holeSize = parseInt(e.target.value);
    holeVal.textContent = AppState.holeSize + '%';
    requestRedraw();
  });
  
  pngBtn.addEventListener('click', () => {
    if(AppState.exportPNG) AppState.exportPNG();
  });
  
  svgBtn.addEventListener('click', () => {
    if(AppState.exportSVG) AppState.exportSVG(showToast);
  });

  // --- Palette Preset Switcher ---
  setupPalettePresets();

}

function setupPalettePresets() {
  const grid = document.getElementById('palette-preset-grid');
  if (!grid) return;

  // Clear existing buttons to prevent duplication during Hot Module Replacement (HMR)
  grid.innerHTML = '';

  let activeKey = 'underwater';

  Object.entries(PALETTES).forEach(([key, preset]) => {
    const btn = document.createElement('button');
    btn.className = 'palette-preset-btn' + (key === activeKey ? ' active' : '');
    btn.dataset.key = key;
    btn.title = preset.name;

    // Show all colors as mini swatches
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

    btn.addEventListener('click', () => {
      if (key === activeKey) return;
      activeKey = key;
      // Update active state visually
      grid.querySelectorAll('.palette-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Switch palette and rebuild LUT
      switchPalette(key);
      showToast(`已切换：${preset.name}`);
    });
  });
}

// =============================================
// Mobile Setup: Tab Bar, Bottom Sheet, DOM move
// =============================================
function setupMobile() {
  const uiPanel = document.getElementById('ui-panel');
  const sheet = document.getElementById('mobile-sheet');
  const sheetContent = sheet.querySelector('.sheet-content');
  const tabBar = document.getElementById('mobile-tab-bar');
  const tabBtns = tabBar.querySelectorAll('.tab-btn');

  // --- Move controls from desktop panel into mobile sheet panels ---
  const panels = {
    import: sheet.querySelector('[data-panel="import"]'),

    style: sheet.querySelector('[data-panel="style"]'),
    export: sheet.querySelector('[data-panel="export"]'),
  };

  // Import panel: resolution + palette preset
  moveChildren(uiPanel, panels.import, [
    '[data-mobile-group="import-resolution"]',
    '[data-mobile-group="palette-preset"]',
  ]);

  // Style panel: perler style controls
  moveChildren(uiPanel, panels.style, [
    '[data-mobile-group="style-controls"]',
  ]);

  // Export panel: export buttons
  moveChildren(uiPanel, panels.export, [
    '[data-mobile-group="export-buttons"]',
  ]);

  // --- Tab switching ---
  let activeTab = null;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      if (activeTab === tab) {
        // Toggle off — close sheet
        closeSheet();
        return;
      }

      activeTab = tab;

      // Update tab highlight
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show the corresponding panel
      Object.values(panels).forEach(p => p.classList.remove('active'));
      panels[tab].classList.add('active');

      // Open sheet
      sheet.classList.add('open');
    });
  });

  function closeSheet() {
    sheet.classList.remove('open');
    tabBtns.forEach(b => b.classList.remove('active'));
    activeTab = null;
  }

  // --- Sheet drag-to-dismiss ---
  const handle = sheet.querySelector('.sheet-handle');
  let sheetTouchStartY = 0;
  let sheetTranslateY = 0;

  handle.addEventListener('touchstart', (e) => {
    sheetTouchStartY = e.touches[0].clientY;
    sheetTranslateY = 0;
    sheet.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - sheetTouchStartY;
    if (dy > 0) {
      sheetTranslateY = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    sheet.style.transition = '';
    if (sheetTranslateY > 60) {
      closeSheet();
    }
    sheet.style.transform = '';
    sheetTranslateY = 0;
  });

  // Close sheet when tapping canvas
  const handleCanvasInteraction = () => {
    if (activeTab) {
      closeSheet();
    }
  };
  
  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('mousedown', handleCanvasInteraction);
  canvasContainer.addEventListener('touchstart', handleCanvasInteraction, { passive: true });
}

// Helper: move elements matching selectors from source to dest
function moveChildren(source, dest, selectors) {
  selectors.forEach(sel => {
    const el = source.querySelector(sel);
    if (el) {
      dest.appendChild(el);
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
