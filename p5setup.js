import p5 from 'p5';
import { utils, buildPaletteSync, applyPaletteSync } from 'image-q';
import { updatePaletteUI } from './main.js';
import defaultImageURL from './src/assets/hello.PNG';

// Global state
export const AppState = {
  originalImage: null,
  resolution: 64,
  colorCount: 16,
  dithering: false,
  perlerRadius: 50,
  perlerGap: 1, // Absolute gap size 0.5-3px
  zoomScale: 1, // Multiplier for canvas scaling (mouse wheel only)
  holeSize: 20, // Percentage 0-50
  triggerUpdate: null,
  triggerRedraw: null,
  exportPNG: null,
  exportSVG: null,
  loadImage: null
};

export function setupP5() {
  let processedData = null; // { width, height, pixels: Uint8Array, cols, rows }
  let offsetX = 0;
  let offsetY = 0;
  
  const sketch = (p) => {
    p.setup = () => {
      const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent('canvas-container');
      p.noLoop(); // We only redraw on changes
      p.pixelDensity(1); 
      
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
        
        // 增益系数，结合指数级缩放带来更顺滑顺手的滚轮体验
        const zoomSpeed = 0.15;
        const direction = e.deltaY > 0 ? -1 : 1;
        
        AppState.zoomScale *= (1 + direction * zoomSpeed);
        // 限制放大缩小的终极范围
        AppState.zoomScale = Math.max(0.05, Math.min(30, AppState.zoomScale));
        
        p.redraw();
        return false; // prevent page scroll
      });
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

      const pg = p.createGraphics(w, h);
      pg.pixelDensity(1);
      pg.image(img, 0, 0, w, h);
      pg.loadPixels();
      
      if (pg.pixels.length === 0) return;

      const inPointContainer = utils.PointContainer.fromUint8Array(pg.pixels, w, h);

      const palette = buildPaletteSync([inPointContainer], {
        colors: AppState.colorCount,
        colorDistanceFormula: 'euclidean'
      });
      
      const pointArray = palette.getPointContainer().getPointArray();
      const colors = pointArray.map(pt => [pt.r, pt.g, pt.b, pt.a]);
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
    }

    p.draw = () => {
      p.clear();
      
      if (!processedData) {
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(24);
        p.noStroke();
        p.fill(120);
        p.text("加载中...", p.width / 2, p.height / 2);
        return;
      }

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

      p.push();
      p.translate(startX, startY);

      // User set gap in px
      const gap = AppState.perlerGap;
      const beadSize = Math.max(0.5, cellSize - gap);
      const borderRadius = (AppState.perlerRadius / 100) * (beadSize / 2);
      
      p.noStroke();
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = (y * cols + x) * 4;
          const a = pixels[idx+3];
          
          if (a > 128) { 
            p.fill(pixels[idx], pixels[idx+1], pixels[idx+2]);
            // center the bead by splitting the gap: gap/2 on each side
            p.rect(x * cellSize + gap/2, y * cellSize + gap/2, beadSize, beadSize, borderRadius);
            
            // Draw bead hole
            if (AppState.holeSize > 0) {
              const holePx = (AppState.holeSize / 100) * beadSize;
              const cx = x * cellSize + cellSize/2;
              const cy = y * cellSize + cellSize/2;
              p.fill(0, 0, 0, 51); // 20% opacity black
              p.circle(cx, cy, holePx);
            }
          }
        }
      }
      p.pop();
    };

    function exportManualSVG() {
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
      
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = (y * cols + x) * 4;
          const a = pixels[idx+3];
          
          if (a > 128) {
            const rx = x * cellSize + gap/2;
            const ry = y * cellSize + gap/2;
            svg += `  <rect x="${rx}" y="${ry}" width="${beadSize}" height="${beadSize}" rx="${borderRadius}" fill="rgb(${pixels[idx]},${pixels[idx+1]},${pixels[idx+2]})" />\n`;
            if (AppState.holeSize > 0) {
              const holePx = (AppState.holeSize / 100) * beadSize;
              const cx = x * cellSize + cellSize/2;
              const cy = y * cellSize + cellSize/2;
              svg += `  <circle cx="${cx}" cy="${cy}" r="${holePx/2}" fill="rgba(0,0,0,0.2)" />\n`;
            }
          }
        }
      }
      svg += `</svg>`;
      
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'perler_studio.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  new p5(sketch);
}
