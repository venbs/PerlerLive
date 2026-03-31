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

export function updatePaletteUI(colors) {
  const container = document.getElementById('palette-container');
  container.innerHTML = '';
  if (colors.length === 0) {
    container.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem;">尚未提取</span>';
  }
  
  pickrInstances.forEach(p => p.destroyAndRemove());
  pickrInstances = [];

  colors.forEach((col, index) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.position = 'relative';
    swatch.style.overflow = 'hidden';
    swatch.style.backgroundColor = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3] / 255})`;
    
    const pickrEl = document.createElement('div');
    pickrEl.style.width = '100%';
    pickrEl.style.height = '100%';
    pickrEl.style.position = 'absolute';
    pickrEl.style.top = '0';
    pickrEl.style.left = '0';
    swatch.appendChild(pickrEl);
    container.appendChild(swatch);

    const pickr = Pickr.create({
      el: pickrEl,
      theme: 'monolith',
      default: `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3] / 255})`,
      defaultRepresentation: 'HEXA',
      position: 'left-start',
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

    pickr.on('save', (color, instance) => {
      const rgba = color.toRGBA();
      if (AppState.updateCustomColor) {
        AppState.updateCustomColor(index, [rgba[0], rgba[1], rgba[2], rgba[3] * 255]);
      }
      instance.hide();
    });

    pickrInstances.push(pickr);
  });
}
