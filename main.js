import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { setupP5, AppState } from './p5setup.js';
import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/monolith.min.css';

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

// =============================================
// Desktop UI Setup (also used by mobile)
// =============================================
function setupUI() {
  const uploadInput = document.getElementById('image-upload');
  const resInput = document.getElementById('resolution');
  const resVal = document.getElementById('resolution-val');
  const colorRadios = document.getElementsByName('colors');
  const ditherCb = document.getElementById('dithering');
  const cartoonCb = document.getElementById('cartoon-filter');
  const cartoonOptions = document.getElementById('cartoon-options');
  const cartoonStroke = document.getElementById('cartoon-stroke');
  const cartoonStrokeVal = document.getElementById('cartoon-stroke-val');
  
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

  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (isMobile()) showLoading();
      AppState.loadImage(url);
    }
  });

  // On mobile, use 'change' (fire on release) instead of 'input' (fire on drag)
  const sliderEvent = isMobile() ? 'change' : 'input';

  resInput.addEventListener(sliderEvent, (e) => {
    const val = parseInt(e.target.value);
    resVal.textContent = val + 'px';
    AppState.resolution = val;
    requestUpdate();
  });

  colorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (e.target.value === 'custom') {
          AppState.isCustomColors = true;
        } else {
          AppState.isCustomColors = false;
          AppState.colorCount = parseInt(e.target.value);
        }
        requestUpdate();
      }
    });
  });

  ditherCb.addEventListener('change', (e) => {
    AppState.dithering = e.target.checked;
    requestUpdate();
  });

  cartoonCb.addEventListener('change', (e) => {
    AppState.cartoonFilter = e.target.checked;
    cartoonOptions.style.display = e.target.checked ? 'block' : 'none';
    requestUpdate();
  });

  borderInput.addEventListener(sliderEvent, (e) => {
    AppState.perlerRadius = parseInt(e.target.value);
    borderVal.textContent = AppState.perlerRadius + '%';
    requestRedraw();
  });

  cartoonStroke.addEventListener(sliderEvent, (e) => {
    AppState.cartoonStroke = parseFloat(e.target.value);
    cartoonStrokeVal.textContent = AppState.cartoonStroke;
    requestUpdate();
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

  // Clipboard paste: support pasting image directly into canvas
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          AppState.loadImage(url);
          showToast('图片已从剪贴板导入');
        }
        break;
      }
    }
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
    color: sheet.querySelector('[data-panel="color"]'),
    style: sheet.querySelector('[data-panel="style"]'),
    export: sheet.querySelector('[data-panel="export"]'),
  };

  // Import panel: upload + resolution + cartoon filter
  moveChildren(uiPanel, panels.import, [
    '[data-mobile-group="import-upload"]',
    '[data-mobile-group="import-resolution"]',
    '[data-mobile-group="import-cartoon"]',
    '#cartoon-options',
  ]);

  // Color panel: color count + palette + dithering
  moveChildren(uiPanel, panels.color, [
    '[data-mobile-group="color-count"]',
    '[data-mobile-group="color-dither"]',
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
  document.getElementById('canvas-container').addEventListener('click', (e) => {
    if (activeTab && e.target.classList.contains('p5Canvas')) {
      closeSheet();
    }
  });
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

let pickrInstances = [];

// Manually position a pcr-app element relative to an anchor element
function positionPickrNearSwatch(swatch, appEl) {
  if (isMobile()) {
    // On mobile, CSS handles centering via fixed position + transform
    return;
  }
  const rect = swatch.getBoundingClientRect();
  const appW = appEl.offsetWidth || 250;
  const appH = appEl.offsetHeight || 300;
  const gap = 10;

  // Prefer left of the swatch (towards the canvas)
  let left = rect.left - appW - gap;
  let top = rect.top;

  // Fallback: right if no space on left
  if (left < 8) {
    left = rect.right + gap;
  }

  // Clamp vertically
  if (top + appH > window.innerHeight - 8) {
    top = window.innerHeight - appH - 8;
  }
  if (top < 8) top = 8;

  appEl.style.left = left + 'px';
  appEl.style.top = top + 'px';
}

export function updatePaletteUI(colors) {
  const container = document.getElementById('palette-container');
  container.innerHTML = '';
  if (colors.length === 0) {
    container.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem;">尚未提取</span>';
  }
  
  // Destroy all existing instances and clean up anchors
  pickrInstances.forEach(({ pickr, anchor }) => {
    pickr.destroyAndRemove();
    if (anchor && anchor.parentNode) anchor.parentNode.removeChild(anchor);
  });
  pickrInstances = [];

  colors.forEach((col, index) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3] / 255})`;
    container.appendChild(swatch);

    // Use a 1px invisible anchor in body — this gives nanopop a real DOM reference
    // but we override its calculated position ourselves on show
    const anchor = document.createElement('div');
    anchor.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none;opacity:0;';
    document.body.appendChild(anchor);

    const pickr = Pickr.create({
      el: anchor,
      theme: 'monolith',
      default: `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3] / 255})`,
      defaultRepresentation: 'HEXA',
      swatches: null,
      components: {
        preview: true,
        opacity: true,
        hue: true,
        interaction: {
          hex: true,
          rgba: true,
          hsla: false,
          hsva: false,
          cmyk: false,
          input: true,
          clear: false,
          save: true
        }
      }
    });

    // Click the swatch → show pickr and manually position it
    swatch.addEventListener('click', () => {
      pickr.show();
      const appEl = pickr.getRoot().app;
      // First frame: browser has rendered, offsetWidth/Height are valid
      requestAnimationFrame(() => {
        positionPickrNearSwatch(swatch, appEl);
      });
    });

    pickr.on('save', (color, instance) => {
      const rgba = color.toRGBA();
      if (AppState.updateCustomColor) {
        AppState.updateCustomColor(index, [rgba[0], rgba[1], rgba[2], rgba[3] * 255]);
      }
      instance.hide();
    });

    pickrInstances.push({ pickr, anchor });
  });
}
