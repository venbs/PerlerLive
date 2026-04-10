import p5 from 'p5';
import { utils, buildPaletteSync, applyPaletteSync } from 'image-q';
import { updatePaletteUI, hideLoading } from './main.js';
import defaultImageURL from './src/assets/hello.PNG';
import { fip } from './src/p5.fip.js';

// Global state
export const AppState = {
  originalImage: null,
  resolution: 64,
  colorCount: 16,
  isCustomColors: false,
  customColors: null,
  dithering: false,
  cartoonFilter: false,
  cartoonStroke: 0.005,
  perlerRadius: 50,
  perlerGap: 1, // Absolute gap size 0.5-3px
  bevelSize: 10, // Bevel stroke thickness 0-20%
  zoomScale: 1, // Multiplier for canvas scaling (mouse wheel only)
  holeSize: 20, // Percentage 0-50
  triggerUpdate: null,
  triggerRedraw: null,
  exportPNG: null,
  exportSVG: null,
  loadImage: null
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
        p.saveCanvas('perler_studio', 'png');
      };

      AppState.exportSVG = exportManualSVG;

      // Auto-load default image
      AppState.loadImage(defaultImageURL);

      canvas.mousePressed((e) => {
        // Prevent pan if clicking outside canvas or on UI
        if (!e.target.classList || !e.target.classList.contains('p5Canvas')) return;
      });

      canvas.mouseWheel((e) => {
        if (!e.target.classList || !e.target.classList.contains('p5Canvas')) return;
        const zoomSpeed = 0.15;
        const direction = e.deltaY > 0 ? -1 : 1;
        AppState.zoomScale *= (1 + direction * zoomSpeed);
        AppState.zoomScale = Math.max(0.05, Math.min(30, AppState.zoomScale));
        p.redraw();
        return false;
      });

      // --- Native Touch gesture support (mobile) to guarantee preventDefault & passive: false ---
      const cvs = canvas.elt;
      let initialPinchDist = 0;
      let initialZoomScale = 1;
      let isTouchPanning = false;
      let touchPanStartX = 0;
      let touchPanStartY = 0;

      cvs.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialZoomScale = AppState.zoomScale;
          isTouchPanning = false;
        } else if (e.touches.length === 1) {
          isTouchPanning = true;
          touchPanStartX = e.touches[0].clientX - offsetX;
          touchPanStartY = e.touches[0].clientY - offsetY;
        }
        e.preventDefault();
      }, { passive: false });

      cvs.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist > 0) {
          const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const scale = currentDist / initialPinchDist;
          AppState.zoomScale = Math.max(0.05, Math.min(30, initialZoomScale * scale));
          isTouchPanning = false;
          p.redraw();
        } else if (e.touches.length === 1 && isTouchPanning) {
          offsetX = e.touches[0].clientX - touchPanStartX;
          offsetY = e.touches[0].clientY - touchPanStartY;
          p.redraw();
        }
        e.preventDefault();
      }, { passive: false });

      cvs.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          initialPinchDist = 0;
        }
        if (e.touches.length === 0) {
          isTouchPanning = false;
        } else if (e.touches.length === 1) {
          // Re-init single finger pan on the remaining finger
          isTouchPanning = true;
          touchPanStartX = e.touches[0].clientX - offsetX;
          touchPanStartY = e.touches[0].clientY - offsetY;
        }
      }, { passive: false });
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight);
      p.redraw();
    };

    let isMouseDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    p.mousePressed = (e) => {
      if (!e.target.classList || !e.target.classList.contains('p5Canvas')) return;

      isMouseDragging = true;
      dragStartX = p.mouseX - offsetX;
      dragStartY = p.mouseY - offsetY;
    };

    p.mouseDragged = (e) => {
      if (isMouseDragging) {
        offsetX = p.mouseX - dragStartX;
        offsetY = p.mouseY - dragStartY;
        p.redraw();
      }
    };

    p.mouseReleased = () => {
      isMouseDragging = false;
    };

    // --- Native Touch gesture support (mobile) ---
    // Moved to native event listeners inside setup() to ensure { passive: false }

    AppState.loadImage = (url) => {
      p.loadImage(url, (img) => {
        AppState.originalImage = img;
        offsetX = 0; // Reset pan
        offsetY = 0;
        processImage();
      });
    };

    AppState.triggerUpdate = () => {
      if (AppState.originalImage) {
        processImage();
      }
    };

    AppState.updateCustomColor = (index, newColorArray) => {
      if (!AppState.customColors) return;

      if (!newColorArray || newColorArray.length !== 4) return;

      const newColor = [
        Math.round(newColorArray[0]),
        Math.round(newColorArray[1]),
        Math.round(newColorArray[2]),
        Math.round(newColorArray[3])
      ];

      AppState.isCustomColors = true;
      const customRadio = document.querySelector('input[name="colors"][value="custom"]');
      if (customRadio) {
        customRadio.checked = true;
      }

      const colors = [...AppState.customColors];
      colors[index] = newColor;

      const uniqueColors = [];
      const seen = new Set();
      for (const c of colors) {
        const key = `${c[0]},${c[1]},${c[2]},${c[3]}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueColors.push(c);
        }
      }

      AppState.customColors = uniqueColors;
      processImage();
    };

    AppState.triggerRedraw = () => {
      p.redraw();
    };

    function processImage() {
      if (!AppState.originalImage) return;

      const img = AppState.originalImage;

      // Calculate target resolution
      const maxRes = AppState.resolution;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        h = maxRes * (h / w);
        w = maxRes;
      } else {
        w = maxRes * (w / h);
        h = maxRes;
      }

      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));

      let targetImg = img;

      if (AppState.cartoonFilter) {
        try {
          // Use original resolution for cartoon filter to preserve edges
          const fw = img.width;
          const fh = img.height;
          const wpg = p.createGraphics(fw, fh, p.WEBGL);
          wpg.clear();
          wpg.imageMode(p.CENTER);
          // Scale up image slightly to fill the wpg correctly or just draw it
          // In standard p5 WEBGL, image drawn at 0,0 with width/height works if centered
          wpg.image(img, 0, 0, fw, fh);

          const cartoonShader = wpg.createFilterShader(fip.cartoon);
          cartoonShader.setUniform('edgeThreshold', 0.05);
          cartoonShader.setUniform('edgeStrokeWidth', AppState.cartoonStroke);
          wpg.filter(cartoonShader);

          targetImg = wpg;
        } catch (e) {
          console.error("Cartoon filter failed:", e);
        }
      }

      const pg = p.createGraphics(w, h);
      pg.noSmooth(); // 禁用抗锯齿，使用临近像素插值
      pg.pixelDensity(1);
      pg.image(targetImg, 0, 0, w, h);
      pg.loadPixels();

      // 暗部亮度微调：防止纯黑导致的立体感缺失
      for (let i = 0; i < pg.pixels.length; i += 4) {
        if (pg.pixels[i + 3] > 0) { // 只处理非透明像素
          pg.pixels[i] = Math.max(pg.pixels[i], 35);
          pg.pixels[i + 1] = Math.max(pg.pixels[i + 1], 35);
          pg.pixels[i + 2] = Math.max(pg.pixels[i + 2], 35);
        }
      }

      if (AppState.cartoonFilter && targetImg !== img && targetImg.remove) {
        targetImg.remove();
      }

      if (pg.pixels.length === 0) return;

      const inPointContainer = utils.PointContainer.fromUint8Array(pg.pixels, w, h);

      let palette;
      if (AppState.isCustomColors && AppState.customColors && AppState.customColors.length > 0) {
        palette = new utils.Palette();
        AppState.customColors.forEach(c => {
          palette.add(utils.Point.createByRGBA(c[0], c[1], c[2], c[3] !== undefined ? c[3] : 255));
        });
      } else {
        palette = buildPaletteSync([inPointContainer], {
          colors: AppState.colorCount,
          colorDistanceFormula: 'euclidean'
        });
      }

      const pointArray = palette.getPointContainer().getPointArray();
      const colors = pointArray.map(pt => [pt.r, pt.g, pt.b, pt.a !== undefined ? pt.a : 255]);

      AppState.customColors = colors;
      updatePaletteUI(colors);

      const outPointContainer = applyPaletteSync(inPointContainer, palette, {
        imageQuantization: AppState.dithering ? 'floyd-steinberg' : 'nearest'
      });

      processedData = {
        width: w,
        height: h,
        pixels: outPointContainer.toUint8Array(),
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

      // Base cell size computation to fit the screen
      const fitW = p.width * 0.7;
      const fitH = p.height * 0.8;
      const baseCellSize = Math.min(fitW / cols, fitH / rows, 40);

      // Apply zoom slider
      const cellSize = baseCellSize * AppState.zoomScale;

      const totalW = cols * cellSize;
      const totalH = rows * cellSize;

      // Start centered + pan offsets
      const startX = (p.width - totalW) / 2 + offsetX;
      const startY = (p.height - totalH) / 2 + offsetY;

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

      // --- Rulers System ---
      const rulerSize = 24;
      p.push();
      p.noStroke();
      p.fill(250); // General ruler background
      p.rect(0, 0, p.width, rulerSize);
      p.rect(0, 0, rulerSize, p.height);

      // Ruler highlight matching content bounds
      p.fill(234, 244, 246); // Highlight colour (Figma-like light blue-grey)
      const hlXEdge = Math.max(rulerSize, startX);
      const hlXEnd = Math.min(p.width, startX + totalW);
      if (hlXEnd > hlXEdge) {
        p.rect(hlXEdge, 0, hlXEnd - hlXEdge, rulerSize);
      }
      const hlYEdge = Math.max(rulerSize, startY);
      const hlYEnd = Math.min(p.height, startY + totalH);
      if (hlYEnd > hlYEdge) {
        p.rect(0, hlYEdge, rulerSize, hlYEnd - hlYEdge);
      }

      // Top-Left corner block
      p.fill(250);
      p.rect(0, 0, rulerSize, rulerSize);
      p.stroke(230);
      p.strokeWeight(1);
      p.line(0, rulerSize, p.width, rulerSize);
      p.line(rulerSize, 0, rulerSize, p.height);

      // Ticks and Text
      p.fill(180);
      p.stroke(230);
      p.strokeWeight(1);
      p.textSize(10);
      p.textAlign(p.LEFT, p.TOP);

      // Calculate reasonable number steps
      let stepUnit = Math.max(1, Math.ceil(40 / cellSize));
      const m10 = Math.pow(10, Math.floor(Math.log10(stepUnit)));
      const base = stepUnit / m10;
      if (base > 5) stepUnit = 10 * m10;
      else if (base > 2) stepUnit = 5 * m10;
      else if (base > 1) stepUnit = 2 * m10;
      else stepUnit = 1 * m10;

      // Top Ruler ticks
      const startValX = Math.floor((rulerSize - startX) / cellSize);
      const endValX = Math.ceil((p.width - startX) / cellSize);
      for (let v = startValX; v <= endValX; v++) {
        const px = startX + v * cellSize;
        if (px < rulerSize) continue;
        if (v % stepUnit === 0) {
          p.line(px, rulerSize - 8, px, rulerSize);
          p.push();
          p.noStroke();
          p.text(v, px + 3, 2);
          p.pop();
        } else if (v % (stepUnit / 2) === 0 || stepUnit < 5) {
          p.line(px, rulerSize - 5, px, rulerSize);
        } else if (cellSize > 10) {
          p.line(px, rulerSize - 3, px, rulerSize);
        }
      }

      // Left Ruler ticks
      const startValY = Math.floor((rulerSize - startY) / cellSize);
      const endValY = Math.ceil((p.height - startY) / cellSize);
      for (let v = startValY; v <= endValY; v++) {
        const py = startY + v * cellSize;
        if (py < rulerSize) continue;
        if (v % stepUnit === 0) {
          p.line(rulerSize - 8, py, rulerSize, py);
          p.push();
          p.translate(rulerSize - 12, py + 3);
          p.rotate(-p.HALF_PI);
          p.noStroke();
          p.text(v, 0, 0);
          p.pop();
        } else if (v % (stepUnit / 2) === 0 || stepUnit < 5) {
          p.line(rulerSize - 5, py, rulerSize, py);
        } else if (cellSize > 10) {
          p.line(rulerSize - 3, py, rulerSize, py);
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

      // One gradient def per palette colour
      const palette = AppState.customColors || [];
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
