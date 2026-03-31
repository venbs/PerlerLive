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

window.addEventListener('load', () => {
  setupP5();
  setupUI();
});

function setupUI() {
  const uploadInput = document.getElementById('image-upload');
  const resInput = document.getElementById('resolution');
  const resVal = document.getElementById('resolution-val');
  const colorRadios = document.getElementsByName('colors');
  const ditherCb = document.getElementById('dithering');
  
  const borderInput = document.getElementById('border-radius');
  const borderVal = document.getElementById('border-radius-val');
  
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
      AppState.loadImage(url);
    }
  });

  resInput.addEventListener('input', (e) => {
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

  borderInput.addEventListener('input', (e) => {
    AppState.perlerRadius = parseInt(e.target.value);
    borderVal.textContent = AppState.perlerRadius + '%';
    requestRedraw();
  });

  gapInput.addEventListener('input', (e) => {
    AppState.perlerGap = parseFloat(e.target.value);
    gapVal.textContent = AppState.perlerGap + 'px';
    requestRedraw();
  });

  holeInput.addEventListener('input', (e) => {
    AppState.holeSize = parseInt(e.target.value);
    holeVal.textContent = AppState.holeSize + '%';
    requestRedraw();
  });
  
  pngBtn.addEventListener('click', () => {
    if(AppState.exportPNG) AppState.exportPNG();
  });
  
  svgBtn.addEventListener('click', () => {
    if(AppState.exportSVG) AppState.exportSVG();
  });
}

function requestUpdate() {
  if (AppState.triggerUpdate) {
    clearTimeout(AppState.updateTimeout);
    AppState.updateTimeout = setTimeout(() => {
      AppState.triggerUpdate();
    }, 150);
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
