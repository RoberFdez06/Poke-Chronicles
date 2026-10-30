// Iconos pixel art de la pantalla de cuenta (DOM): la «G» de Google en sus cuatro colores y un sobre de correo.
// Se dibujan celda a celda en un canvas pequeño y se escalan con `image-rendering: pixelated` (sin imágenes externas).

const BLUE = '#4285f4';
const RED = '#ea4335';
const YELLOW = '#fbbc05';
const GREEN = '#34a853';

/** Rejilla 13×13 de la «G»: un anillo cuyo color depende del ángulo, abierto a la derecha y con la barra azul. */
export function googleGrid(): (string | null)[][] {
  const N = 13;
  const c = 6;
  const grid: (string | null)[][] = Array.from({ length: N }, () => Array<string | null>(N).fill(null));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r < 3.4 || r > 6.4) continue;
      const a = (Math.atan2(dy, dx) * 180) / Math.PI; // 0° = derecha, positivo hacia abajo
      if (a > -42 && a < -2) continue; // la boca de la «G»
      grid[y][x] = a >= -2 && a < 48 ? BLUE : a >= 48 && a < 132 ? GREEN : a >= 132 || a < -158 ? YELLOW : RED;
    }
  }
  // Barra horizontal azul de la «G»
  for (let x = c; x < N; x++) {
    grid[c - 1][x] = BLUE;
    grid[c][x] = BLUE;
  }
  return grid;
}

/** Rejilla 14×10 del sobre: borde azul marino, relleno claro y solapa dorada. */
export function mailGrid(): (string | null)[][] {
  const W = 14;
  const H = 10;
  const NAVY = '#283068';
  const PAPER = '#f8f0d8';
  const GOLD = '#f8d030';
  const grid: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      grid[y][x] = edge ? NAVY : PAPER;
    }
  }
  // Solapa en V
  for (let i = 0; i < 6; i++) {
    grid[1 + i][1 + i] = i === 5 ? GOLD : NAVY;
    grid[1 + i][W - 2 - i] = i === 5 ? GOLD : NAVY;
  }
  grid[6][6] = NAVY;
  grid[6][7] = NAVY;
  grid[7][6] = GOLD;
  grid[7][7] = GOLD;
  return grid;
}

function draw(grid: (string | null)[][], scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = grid[0].length;
  cv.height = grid.length;
  const g = cv.getContext('2d');
  grid.forEach((row, y) => row.forEach((col, x) => {
    if (!col || !g) return;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }));
  cv.style.cssText = `width:${cv.width * scale}px;height:${cv.height * scale}px;image-rendering:pixelated;flex:none;`;
  cv.setAttribute('aria-hidden', 'true');
  return cv;
}

export const googleIcon = (scale = 2): HTMLCanvasElement => draw(googleGrid(), scale);
export const mailIcon = (scale = 2): HTMLCanvasElement => draw(mailGrid(), scale);
