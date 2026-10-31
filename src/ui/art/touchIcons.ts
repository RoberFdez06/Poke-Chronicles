// Iconos pixel art de los botones táctiles de la partida (propios y genéricos: escudo, flecha, estrella, bomba,
// mano y frasco). Cada uno es una rejilla de caracteres como los de icons.ts: '.' transparente y cada letra un
// color de su paleta. Sin Phaser, para poder comprobar en las pruebas que las rejillas están bien formadas.
import type { PadButton } from '../../data/touchPad.ts';

export interface TouchIcon {
  palette: Record<string, number>;
  rows: readonly string[];
}

const K = 0x101828; // contorno
const WH = 0xffffff;

/** Rejilla de un círculo relleno (para la bomba y el frasco): `fill` dentro, `edge` en el borde. */
function disc(n: number, cx: number, cy: number, r: number, fill: string, edge: string): string[][] {
  const g = Array.from({ length: n }, () => Array<string>(n).fill('.'));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) g[y][x] = fill;
      else if (d <= r + 1) g[y][x] = edge;
    }
  return g;
}

function bombRows(): string[] {
  const g = disc(13, 6, 7.5, 3.9, 'd', 'k');
  g[5][4] = 'W';
  g[5][5] = 'W';
  g[6][4] = 'W';
  // Mecha y chispa
  g[2][7] = 'k';
  g[2][8] = 'k';
  g[1][9] = 'k';
  g[0][10] = 'Y';
  g[1][10] = 'o';
  g[0][11] = 'o';
  g[0][9] = 'o';
  return g.map((r) => r.join(''));
}

function potionRows(): string[] {
  const g = disc(13, 6, 8, 3.9, 'p', 'k');
  // Mitad de arriba del cuerpo: cristal vacío
  for (let y = 0; y < 8; y++) for (let x = 0; x < 13; x++) if (g[y][x] === 'p') g[y][x] = 'g';
  // Cuello y tapón
  for (let y = 1; y <= 4; y++) {
    g[y][4] = 'k';
    g[y][8] = 'k';
    for (let x = 5; x <= 7; x++) g[y][x] = 'g';
  }
  for (let x = 4; x <= 8; x++) g[0][x] = 'c';
  g[0][4] = 'k';
  g[0][8] = 'k';
  g[9][4] = 'W';
  g[10][4] = 'W';
  g[9][5] = 'W';
  return g.map((r) => r.join(''));
}

export const TOUCH_ICONS: Record<PadButton, TouchIcon> = {
  // Escudo dorado con brillo
  parry: {
    palette: { k: K, y: 0xf2c230, d: 0xb07a12, W: WH },
    rows: [
      '.kkkkkkkkkkkk.',
      'kyyyyyyyyyyydk',
      'kyWWyyyyyyyydk',
      'kyWyyyyyyyyydk',
      'kyyyyyyyyyyydk',
      'kyyyyyyyyyyydk',
      '.kyyyyyyyyydk.',
      '.kyyyyyyyyydk.',
      '..kyyyyyyydk..',
      '..kyyyyyyydk..',
      '...kyyyyydk...',
      '....kyyydk....',
      '.....kydk.....',
      '......kk......',
    ],
  },
  // Flecha con estela de velocidad
  dash: {
    palette: { k: K, W: WH, b: 0x9fd3ff },
    rows: [
      '..............',
      '.......kk.....',
      '.......kWk....',
      '.......kWWk...',
      'bb.kkkkkWWWk..',
      '...kWWWWWWWWk.',
      'bbbkWWWWWWWWWk',
      '...kWWWWWWWWk.',
      'bb.kkkkkWWWk..',
      '.......kWWk...',
      '.......kWk....',
      '.......kk.....',
      '..............',
    ],
  },
  // Estrella (objeto activo)
  active: {
    palette: { k: K, y: 0xffe066, W: WH },
    rows: [
      '......k......',
      '.....kyk.....',
      '.....kyk.....',
      '....kyyyk....',
      'kkkkkyWyykkkk',
      '.kyyyWyyyyyk.',
      '..kyyyyyyyk..',
      '...kyyyyyk...',
      '...kyyyyyk...',
      '..kyyykyyyk..',
      '..kyyk.kyyk..',
      '.kyk.....kyk.',
      '.kk.......kk.',
    ],
  },
  bomb: { palette: { k: K, d: 0x2a2f3c, W: 0x8c98b6, Y: 0xfff4a0, o: 0xff8a30 }, rows: bombRows() },
  // Mano con el índice levantado (tocar / interactuar)
  use: {
    palette: { k: K, W: 0xfff1dc },
    rows: [
      '....kk.......',
      '...kWWk......',
      '...kWWk......',
      '...kWWkkk....',
      '...kWWkWWkk..',
      '.kkkWWkWWkWk.',
      'kWWkWWWWWWWWk',
      'kWWWWWWWWWWWk',
      '.kWWWWWWWWWWk',
      '..kWWWWWWWWk.',
      '...kWWWWWWk..',
      '...kWWWWWWk..',
      '...kkkkkkkk..',
    ],
  },
  potion: { palette: { k: K, g: 0xd8ecff, p: 0xd04ad8, c: 0xa0683a, W: WH }, rows: potionRows() },
};

/** Color de fondo del botón de cada acción. */
export const TOUCH_BTN_COLOR: Record<PadButton, number> = {
  parry: 0xb8860b,
  dash: 0x2f73b8,
  active: 0x7a3fa0,
  bomb: 0x4a5468,
  use: 0x2e8a52,
  potion: 0x8a3fa8,
};

/** Gris con la misma luminosidad (para el estado apagado). */
export function greyOf(c: number): number {
  const l = Math.round(((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11);
  const v = Math.round(60 + l * 0.45);
  return (v << 16) | (v << 8) | v;
}

/** Aclara (k > 0) u oscurece (k < 0) un color. */
export function shade(c: number, k: number): number {
  const ch = (s: number) => {
    const v = (c >> s) & 255;
    return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
