import p5 from 'p5';
import { hideLoading } from './main.js';

// =============================================
// Palette Presets
// =============================================
export const PALETTES = {
  field: {
    name: 'field',
    colors: [
      [242, 242, 242],
      [135, 206, 235],
      [70, 130, 180],
      [118, 162, 112],
      [82, 108, 80],
      [244, 215, 165],
      [214, 173, 109],
      [174, 129, 109],
      [104, 77, 75],
      [55, 55, 55],
    ]
  },
  underwater: {
    name: 'underwater',
    colors: [
      [30, 120, 180],
      [44, 156, 158],
      [65, 193, 173],
      [255, 105, 97],
      [244, 164, 96],
      [210, 94, 149],
      [119, 190, 217],
      [76, 46, 63],
      [236, 240, 241],
      [20, 28, 36],
    ]
  },
  forest: {
    name: 'forest',
    colors: [
      [34, 47, 34],
      [65, 94, 50],
      [121, 142, 73],
      [179, 163, 76],
      [104, 80, 60],
      [146, 112, 82],
      [195, 195, 216],
      [161, 161, 188],
      [222, 226, 228],
      [108, 117, 103],
    ],
  },
  flame: {
    name: 'flame',
    colors: [
      [255, 112, 31],
      [245, 165, 67],
      [255, 215, 0],
      [179, 87, 42],
      [135, 56, 50],
      [59, 47, 60],
      [85, 71, 93],
      [116, 96, 125],
      [25, 25, 35],
      [213, 149, 79],
    ],
  },
  dusk: {
    name: 'dusk',
    colors: [
      [10, 10, 20],
      [30, 40, 70],
      [70, 50, 104],
      [214, 108, 102],
      [244, 147, 114],
      [255, 222, 173],
      [44, 56, 94],
      [120, 89, 142],
      [255, 255, 255],
      [142, 156, 184],
    ]
  },
  grayscale: {
    name: 'grayscale',
    colors: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [255, 255, 255],
    ]
  },
  vampire: {
    name: 'vampire',
    colors: [
      [15, 16, 21],
      [30, 32, 40],
      [50, 53, 65],
      [40, 42, 50],
      [100, 15, 20],
      [200, 30, 40],
      [230, 60, 50],
      [255, 100, 70],
      [255, 160, 110],
      [255, 210, 170],
    ]
  },
  ink: {
    name: 'ink',
    colors: [
      [8, 8, 8],
      [30, 25, 30],
      [70, 40, 50],
      [110, 50, 60],
      [200, 70, 80],
      [100, 70, 50],
      [140, 130, 110],
      [160, 180, 60],
      [210, 210, 210],
      [255, 255, 255],
    ]
  },
  galaxy: {
    name: 'galaxy',
    colors: [
      [5, 6, 20],
      [10, 12, 40],
      [20, 30, 80],
      [40, 60, 160],
      [80, 110, 230],
      [200, 70, 110],
      [250, 100, 140],
      [250, 180, 110],
      [255, 220, 160],
      [255, 255, 255],
    ]
  },
  acid: {
    name: 'acid',
    colors: [
      [8, 7, 9],
      [40, 30, 50],
      [60, 100, 230],
      [110, 80, 200],
      [230, 110, 200],
      [250, 140, 230],
      [50, 200, 80],
      [250, 200, 50],
      [230, 230, 250],
      [255, 255, 255],
    ]
  },
  sand: {
    name: 'sand',
    colors: [
      [59, 36, 23],
      [92, 58, 33],
      [139, 69, 19],
      [160, 82, 45],
      [188, 143, 143],
      [210, 180, 140],
      [222, 184, 135],
      [238, 203, 173],
      [250, 235, 215],
      [255, 255, 240],
    ]
  }
};

export const PALETTE_KEYS = Object.keys(PALETTES);
const DEFAULT_PALETTE_KEY = 'underwater';

// =============================================
// Active Palette & LUT
// =============================================
let activePaletteKey = DEFAULT_PALETTE_KEY;
let activePalette = PALETTES[DEFAULT_PALETTE_KEY].colors;

// LUT: maps every RGB → index into activePalette (16 MB Uint8Array)
const colorLUT = new Uint8Array(16777216); // 256^3
let isLUTBuilt = false;

function buildLUT() {
  if (isLUTBuilt) return;
  const pal = activePalette;

  // Match the reference project's palette behavior: every preset uses the same
  // closest-color lookup in RGB space instead of palette-specific hue buckets.
  for (let r = 0; r < 256; r += 2) {
    for (let g = 0; g < 256; g += 2) {
      for (let b = 0; b < 256; b += 2) {
        let minDist = Infinity;
        let pidx = 0;
        for (let i = 0; i < pal.length; i++) {
          const dr = r - pal[i][0];
          const dg = g - pal[i][1];
          const db = b - pal[i][2];
          const dist = dr * dr + dg * dg + db * db;
          if (dist < minDist) { minDist = dist; pidx = i; }
        }

        for (let dr2 = 0; dr2 < 2; dr2++) {
          for (let dg2 = 0; dg2 < 2; dg2++) {
            for (let db2 = 0; db2 < 2; db2++) {
              colorLUT[(r + dr2) * 65536 + (g + dg2) * 256 + (b + db2)] = pidx;
            }
          }
        }
      }
    }
  }
  isLUTBuilt = true;
}

export function switchPalette(key, source = 'ui') {
  if (!PALETTES[key] || key === activePaletteKey) return false;
  activePaletteKey = key;
  activePalette = PALETTES[key].colors;
  isLUTBuilt = false; // Force LUT rebuild on next frame
  AppState.currentPaletteKey = key;
  AppState.currentPaletteIndex = PALETTE_KEYS.indexOf(key);
  if (typeof AppState.onPaletteChange === 'function') {
    AppState.onPaletteChange({
      key,
      index: AppState.currentPaletteIndex,
      preset: PALETTES[key],
      source,
    });
  }
  return true;
}

export function getCurrentPaletteKey() {
  return activePaletteKey;
}

export function getCurrentPaletteIndex() {
  return PALETTE_KEYS.indexOf(activePaletteKey);
}

// Global state
export const AppState = {
  videoCapture: null,
  resolution: 64,
  perlerRadius: 50,
  perlerGap: 0.5, // Absolute gap size 0-3px
  bevelSize: 10, // Bevel stroke thickness 0-20%
  holeSize: 40, // Percentage 0-60
  triggerUpdate: null,
  triggerRedraw: null,
  exportPNG: null,
  exportSVG: null,
  gestureEnabled: false,
  gestureSampleFps: 15,
  gestureMinHorizontalTravel: 0.12,
  gestureMaxVerticalRatio: 0.45,
  gestureDirectionDominance: 0.55,
  gestureCooldownMs: 900,
  currentPaletteKey: DEFAULT_PALETTE_KEY,
  currentPaletteIndex: PALETTE_KEYS.indexOf(DEFAULT_PALETTE_KEY),
  onPaletteChange: null,
};

const isMobile = () => window.innerWidth <= 768;

export function setupP5() {
  // Fix for Vite HMR (Hot Module Replacement) piling up duplicate canvases
  const container = document.getElementById('canvas-container');
  if (container) {
    container.innerHTML = '';
  }

  let processedData = null; // { width, height, pixels: Uint8Array, cols, rows }
  let offsetX = 0;
  let offsetY = 0;

  const sketch = (p) => {
    p.setup = () => {
      // Reduce pixel density on mobile for better performance
      if (isMobile()) {
        p.pixelDensity(1);
      }
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent('canvas-container');
      p.noLoop(); // We only redraw on changes

      AppState.exportPNG = () => {
        p.saveCanvas('perler_live', 'png');
      };

      AppState.exportSVG = exportManualSVG;

      // Start Video Capture
      AppState.videoCapture = p.createCapture(p.VIDEO);
      AppState.videoCapture.hide();

      function loopProcess() {
        if (AppState.videoCapture && AppState.videoCapture.loadedmetadata) {
          processImage();
        }
        requestAnimationFrame(loopProcess);
      }
      requestAnimationFrame(loopProcess);


    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      p.redraw();
    };

    AppState.triggerUpdate = () => {
      // Only redraw trigger needed now
    };

    AppState.triggerRedraw = () => {
      p.redraw();
    };

    function processImage() {
      if (!AppState.videoCapture || !AppState.videoCapture.loadedmetadata) return;
      const videoElt = AppState.videoCapture.elt;
      if (videoElt.videoWidth === 0 || videoElt.videoHeight === 0) return;

      const img = AppState.videoCapture;

      // Calculate target resolution
      const maxRes = AppState.resolution;
      let w = videoElt.videoWidth;
      let h = videoElt.videoHeight;
      if (w > h) {
        h = maxRes * (h / w);
        w = maxRes;
      } else {
        w = maxRes * (w / h);
        h = maxRes;
      }

      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));

      const pg = p.createGraphics(w, h);
      pg.noSmooth();
      pg.pixelDensity(1);
      // Mirror once at the low-resolution sampling stage so preview and exports
      // all share the same flipped processedData without paying a high-res cost.
      pg.push();
      pg.translate(w, 0);
      pg.scale(-1, 1);
      pg.image(img, 0, 0, w, h);
      pg.pop();
      pg.loadPixels();

      // Brighten purely black pixels
      for (let i = 0; i < pg.pixels.length; i += 4) {
        if (pg.pixels[i + 3] > 0) {
          pg.pixels[i] = Math.max(pg.pixels[i], 35);
          pg.pixels[i + 1] = Math.max(pg.pixels[i + 1], 35);
          pg.pixels[i + 2] = Math.max(pg.pixels[i + 2], 35);
        }
      }


      if (pg.pixels.length === 0) return;

      buildLUT();

      // Faster mapping via LUT using a single closest-color lookup path for
      // every palette, which keeps palette behavior stable and predictable.
      const outPixels = new Uint8Array(w * h * 4);
      for (let i = 0; i < pg.pixels.length; i += 4) {
        if (pg.pixels[i + 3] > 128) {
          let r = pg.pixels[i];
          let g = pg.pixels[i + 1];
          let b = pg.pixels[i + 2];

          // Use multiplication to avoid signed 32-bit overflow when r >= 128
          const pidx = colorLUT[r * 65536 + g * 256 + b];

          outPixels[i] = activePalette[pidx][0];
          outPixels[i + 1] = activePalette[pidx][1];
          outPixels[i + 2] = activePalette[pidx][2];
          outPixels[i + 3] = 255;
        } else {
          outPixels[i + 3] = 0;
        }
      }

      processedData = {
        width: w,
        height: h,
        pixels: outPixels,
        cols: w,
        rows: h
      };

      pg.remove();
      p.redraw();
      hideLoading();
    }

    p.draw = () => {
      p.clear();

      if (!processedData) {
        p.background(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(24);
        p.noStroke();
        p.fill(120);
        p.text("加载中...", p.width / 2, p.height / 2);
        return;
      }

      p.background(255); // Solid white background

      const { cols, rows, pixels } = processedData;

      // Base cell size computation to fit the screen (cover mode)
      const fitW = p.width;
      const fitH = p.height;
      const baseCellSize = Math.max(fitW / cols, fitH / rows);

      // Apply scale
      const cellSize = baseCellSize;

      const totalW = cols * cellSize;
      const totalH = rows * cellSize;

      // Start centered
      const startX = (p.width - totalW) / 2;
      const startY = (p.height - totalH) / 2;

      // Draw infinite grid aligning with cells
      if (cellSize > 4) {
        p.push();
        p.stroke('#f9f9f9ff');
        p.strokeWeight(1);
        const gStartX = startX % cellSize;
        const gStartY = startY % cellSize;
        const shiftX = gStartX < 0 ? gStartX + cellSize : gStartX;
        for (let x = shiftX; x <= p.width; x += cellSize) {
          p.line(x, 0, x, p.height);
        }
        const shiftY = gStartY < 0 ? gStartY + cellSize : gStartY;
        for (let y = shiftY; y <= p.height; y += cellSize) {
          p.line(0, y, p.width, y);
        }
        p.pop();
      }

      p.push();
      p.translate(startX, startY);

      // User set gap in px
      const gap = AppState.perlerGap;
      const beadSize = Math.max(0.5, cellSize - gap);
      const borderRadius = (AppState.perlerRadius / 100) * (beadSize / 2);

      p.noStroke();

      const ctx = p.drawingContext;
      const lighten = (v, f) => Math.min(255, Math.round(v * f));
      const darken = (v, f) => Math.max(0, Math.round(v * f));
      const strokeW = AppState.bevelSize > 0 ? Math.max(0.8, beadSize * (AppState.bevelSize / 100)) : 0;

      // Visibility culling bounds
      const minVisibleX = Math.floor(-startX / cellSize) - 1;
      const maxVisibleX = Math.ceil((p.width - startX) / cellSize) + 1;
      const minVisibleY = Math.floor(-startY / cellSize) - 1;
      const maxVisibleY = Math.ceil((p.height - startY) / cellSize) + 1;

      const startRow = Math.max(0, minVisibleY);
      const endRow = Math.min(rows, maxVisibleY);
      const startCol = Math.max(0, minVisibleX);
      const endCol = Math.min(cols, maxVisibleX);

      for (let y = startRow; y < endRow; y++) {
        for (let x = startCol; x < endCol; x++) {
          const idx = (y * cols + x) * 4;
          const a = pixels[idx + 3];

          if (a > 128) {
            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            const bx = x * cellSize + gap / 2;
            const by = y * cellSize + gap / 2;

            // 1. Base fill
            p.fill(r, g, b);
            p.rect(bx, by, beadSize, beadSize, borderRadius);

            // 2. Bevel stroke: light TL → base → dark BR
            if (strokeW > 0) {
              ctx.save();
              const beadGrad = ctx.createLinearGradient(bx, by, bx + beadSize, by + beadSize);
              beadGrad.addColorStop(0, 'rgb(' + lighten(r, 1.45) + ',' + lighten(g, 1.45) + ',' + lighten(b, 1.45) + ')');
              beadGrad.addColorStop(0.45, 'rgb(' + r + ',' + g + ',' + b + ')');
              beadGrad.addColorStop(1, 'rgb(' + darken(r, 0.7) + ',' + darken(g, 0.7) + ',' + darken(b, 0.7) + ')');
              ctx.strokeStyle = beadGrad;
              ctx.lineWidth = strokeW;
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.roundRect(bx + strokeW / 2, by + strokeW / 2, beadSize - strokeW, beadSize - strokeW, Math.max(0, borderRadius - strokeW / 2));
              ctx.stroke();
              ctx.restore();
            }

            // 3. Hole with reversed bevel (inward / recessed look)
            if (AppState.holeSize > 0) {
              const holePx = (AppState.holeSize / 100) * beadSize;
              const hcx = x * cellSize + cellSize / 2;
              const hcy = y * cellSize + cellSize / 2;
              const hr = holePx / 2;
              const hsw = AppState.bevelSize > 0 ? Math.max(0.4, holePx * (AppState.bevelSize / 100) * 1.5) : 0;

              ctx.save();
              // Hole fill: darkened base colour
              ctx.fillStyle = 'rgb(' + darken(r, 0.7) + ',' + darken(g, 0.7) + ',' + darken(b, 0.7) + ')';
              ctx.beginPath();
              ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
              ctx.fill();

              // Reversed gradient: dark TL (stronger) → light BR (stronger)
              if (hsw > 0) {
                const holeGrad = ctx.createLinearGradient(hcx - hr, hcy - hr, hcx + hr, hcy + hr);
                holeGrad.addColorStop(0, 'rgb(' + darken(r, 0.7) + ',' + darken(g, 0.7) + ',' + darken(b, 0.7) + ')');
                holeGrad.addColorStop(0.45, 'rgb(' + r + ',' + g + ',' + b + ')');
                holeGrad.addColorStop(1, 'rgb(' + lighten(r, 1.45) + ',' + lighten(g, 1.45) + ',' + lighten(b, 1.45) + ')');
                ctx.strokeStyle = holeGrad;
                ctx.lineWidth = hsw;
                ctx.beginPath();
                ctx.arc(hcx, hcy, hr, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.restore();
            }
          }
        }
      }
      p.pop();


    };

    function exportManualSVG(showToast) {
      if (!processedData) return;

      const { cols, rows, pixels } = processedData;

      // Use fixed 20px cell size for standard high-resolution SVG export
      const cellSize = 20;
      const baseGap = AppState.perlerGap;
      // Scale gap proportionally for SVG export, assuming original was roughly 40px cell size?
      // PRD says gap 0.5 - 3px. For a 20px cell size, we use absolute gap. 
      const gap = baseGap;
      const beadSize = Math.max(1, cellSize - gap);
      const borderRadius = (AppState.perlerRadius / 100) * (beadSize / 2);

      const width = cols * cellSize;
      const height = rows * cellSize;

      const lightenSVG = (v, f) => Math.min(255, Math.round(v * f));
      const darkenSVG = (v, f) => Math.max(0, Math.round(v * f));
      const strokeWSVG = AppState.bevelSize > 0 ? Math.max(0.5, beadSize * (AppState.bevelSize / 100)) : 0;

      // Use currently active palette for SVG export
      const palette = activePalette;
      const colorToId = {};
      const defLines = [];
      palette.forEach((col, i) => {
        const [r, g, b] = col;
        const key = r + ',' + g + ',' + b;
        colorToId[key] = i;
        defLines.push('    <linearGradient id="bv' + i + '" x1="0%" y1="0%" x2="100%" y2="100%">');
        defLines.push('      <stop offset="0%"   stop-color="rgb(' + lightenSVG(r, 1.45) + ',' + lightenSVG(g, 1.45) + ',' + lightenSVG(b, 1.45) + ')"/>');
        defLines.push('      <stop offset="45%"  stop-color="rgb(' + r + ',' + g + ',' + b + ')"/>');
        defLines.push('      <stop offset="100%" stop-color="rgb(' + darkenSVG(r, 0.7) + ',' + darkenSVG(g, 0.7) + ',' + darkenSVG(b, 0.7) + ')"/>');
        defLines.push('    </linearGradient>');
        defLines.push('    <linearGradient id="bvh' + i + '" x1="0%" y1="0%" x2="100%" y2="100%">');
        defLines.push('      <stop offset="0%"   stop-color="rgb(' + darkenSVG(r, 0.7) + ',' + darkenSVG(g, 0.7) + ',' + darkenSVG(b, 0.7) + ')"/>');
        defLines.push('      <stop offset="45%"  stop-color="rgb(' + r + ',' + g + ',' + b + ')"/>');
        defLines.push('      <stop offset="100%" stop-color="rgb(' + lightenSVG(r, 1.45) + ',' + lightenSVG(g, 1.45) + ',' + lightenSVG(b, 1.45) + ')"/>');
        defLines.push('    </linearGradient>');
      });

      const parts = [];
      parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">');
      parts.push('  <defs>');
      defLines.forEach(l => parts.push(l));
      parts.push('  </defs>');

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = (y * cols + x) * 4;
          const a = pixels[idx + 3];
          if (a > 128) {
            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            const rx = x * cellSize + gap / 2;
            const ry = y * cellSize + gap / 2;
            const rr = borderRadius.toFixed(2);
            const key = r + ',' + g + ',' + b;
            const cIdx = colorToId[key] !== undefined ? colorToId[key] : 0;
            // Inner stroke: shrink rect by half strokeWidth on each side so stroke stays inside
            const sw2 = strokeWSVG / 2;
            const irx = rx + sw2;
            const iry = ry + sw2;
            const iw = beadSize - strokeWSVG;
            const ih = beadSize - strokeWSVG;
            const irr = Math.max(0, borderRadius - sw2).toFixed(2);
            parts.push('  <rect x="' + irx.toFixed(2) + '" y="' + iry.toFixed(2) + '" width="' + iw.toFixed(2) + '" height="' + ih.toFixed(2) + '" rx="' + irr + '" fill="rgb(' + r + ',' + g + ',' + b + ')" stroke="' + (strokeWSVG > 0 ? 'url(#bv' + cIdx + ')' : 'none') + '" stroke-width="' + strokeWSVG.toFixed(2) + '"/>');
            if (AppState.holeSize > 0) {
              const holePx = (AppState.holeSize / 100) * beadSize;
              const hcx = x * cellSize + cellSize / 2;
              const hcy = y * cellSize + cellSize / 2;
              const hr = holePx / 2;
              const hsw = AppState.bevelSize > 0 ? Math.max(0.4, holePx * (AppState.bevelSize / 100) * 1.5) : 0;
              const holeFill = 'rgb(' + darkenSVG(r, 0.7) + ',' + darkenSVG(g, 0.7) + ',' + darkenSVG(b, 0.7) + ')';
              // Inner stroke on circle: reduce radius by half stroke width
              const hir = hr;
              parts.push('  <circle cx="' + hcx + '" cy="' + hcy + '" r="' + hir.toFixed(2) + '" fill="' + holeFill + '" stroke="' + (hsw > 0 ? 'url(#bvh' + cIdx + ')' : 'none') + '" stroke-width="' + hsw.toFixed(2) + '" paint-order="stroke"/>');
            }
          }
        }
      }
      parts.push('</svg>');

      const svgString = parts.join('\n');
      navigator.clipboard.writeText(svgString).then(() => {
        if (showToast) showToast('SVG 已复制到剪贴板');
      }).catch(err => {
        console.error('\u65e0\u6cd5\u590d\u5236SVG:', err);
        if (showToast) showToast('\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u6743\u9650');
      });
    }
  };

  new p5(sketch);
}
