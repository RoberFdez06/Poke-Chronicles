// Baldosas y obstáculos pixel art para cada bioma (suelo, pared, roca, hierba alta, agujero, charco, columna).
// Se generan por código con los colores del bioma, así cualquier bioma nuevo tiene arte sin dibujarlo a mano.
// Cada textura es pequeña (32x32 o 32x48) y se escala sin suavizar; el suelo y la pared se usan con TileSprite.
import Phaser from 'phaser';
import { lowFx } from '../theme';

/** Lo mínimo que hace falta de un bioma (coincide con `Biome` de src/level/biomes.ts). */
export interface BiomeLook {
  id: string;
  colors: { floor: number; wall: number; rock: number; rockTop: number; bush: number; puddle: number; hole: number };
}

export type TilePart = 'floor' | 'wall' | 'rock' | 'bush' | 'hole' | 'puddle' | 'pillar';
export const TILE = 32;
export const tileKey = (biomeId: string, part: TilePart) => `tile-${biomeId}-${part}`;

const OUTLINE = 0x18202c;

/** Aclara (f > 0) u oscurece (f < 0) un color. */
export function shade(c: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

function rngFor(seed: string) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type G = Phaser.GameObjects.Graphics;
const px = (g: G, c: number, x: number, y: number, w = 1, h = 1) => g.fillStyle(c, 1).fillRect(x, y, w, h);

/** Lado de la textura del suelo (se repite cada 160 px en pantalla: casa con las salas de 800x480 y la vista de 960x640). */
export const FLOOR_TEX = 128;
/** Lado de la textura de la pared. */
export const WALL_TEX = 64;

/** Rectángulo que da la vuelta por los bordes de la textura (para que se repita sin cortes). */
function wrapRect(g: G, c: number, x: number, y: number, w: number, h: number, S: number, a = 1) {
  for (const dx of [0, -S]) for (const dy of [0, -S]) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx + w <= 0 || yy + h <= 0 || xx >= S || yy >= S) continue;
    g.fillStyle(c, a).fillRect(xx, yy, w, h);
  }
}

/**
 * Losas o adoquines irregulares en filas (cueva, volcán, cumbre, ciudad): cada piedra con luz arriba, sombra abajo,
 * esquinas comidas y junta oscura. Devuelve las juntas por si el bioma quiere rellenarlas (lava, musgo…).
 */
function drawStones(g: G, r: () => number, S: number, rowH: number, minW: number, maxW: number, base: number, gap: number, opt: { bevel?: number; jitter?: number; offset?: boolean; split?: boolean } = {}) {
  const joints: [number, number, number, number][] = [];
  const bevel = opt.bevel ?? 2;
  g.fillStyle(gap, 1).fillRect(0, 0, S, S);
  for (let y = 0, row = 0; y < S; y += rowH, row++) {
    let x = opt.offset ? (row % 2) * Math.floor(maxW / 2) : Math.floor(r() * maxW);
    const end = x + S;
    while (x < end) {
      let w = minW + Math.floor((r() * (maxW - minW)) / 2) * 2;
      if (end - x - w < minW) w = end - x;
      const one = (sx: number, sy: number, sw: number, sh: number) => {
        // Losas sueltas: a veces una piedra grande se parte en dos (arriba y abajo, o lado a lado)
        if (opt.split && sh >= 24 && r() < 0.45) {
          one(sx, sy, sw, sh / 2);
          one(sx, sy + sh / 2, sw, sh / 2);
          return;
        }
        if (opt.split && sw >= 28 && r() < 0.3) {
          const cut = 10 + Math.floor((r() * (sw - 20)) / 2) * 2;
          one(sx, sy, cut, sh);
          one(sx + cut, sy, sw - cut, sh);
          return;
        }
        const tone = shade(base, (r() - 0.5) * (opt.jitter ?? 0.1));
        wrapRect(g, tone, sx + 1, sy + 1, sw - 2, sh - 2, S);
        wrapRect(g, shade(tone, 0.2), sx + 2, sy + 1, sw - 4, bevel, S);
        wrapRect(g, shade(tone, -0.18), sx + 2, sy + sh - 1 - bevel, sw - 4, bevel, S);
        wrapRect(g, shade(tone, 0.1), sx + 1, sy + 2, bevel, sh - 4, S);
        // Esquinas comidas: la piedra se ve redondeada
        for (const [cx, cy] of [[sx + 1, sy + 1], [sx + sw - 2, sy + 1], [sx + 1, sy + sh - 2], [sx + sw - 2, sy + sh - 2]]) wrapRect(g, gap, cx, cy, 1, 1, S);
        // Motas y algún desconchón
        for (let k = 0; k < 2 + Math.floor((sw * sh) / 400); k++) wrapRect(g, shade(tone, r() < 0.5 ? -0.12 : 0.12), sx + 3 + Math.floor(r() * (sw - 6)), sy + 3 + Math.floor(r() * (sh - 6)), 2, 2, S);
        joints.push([sx, sy, sw, sh]);
      };
      one(x % S, y, w, rowH);
      x += w;
    }
  }
  return joints;
}

/** Ruido en bloques de 2 px: que el color base nunca sea una mancha plana. */
function dither(g: G, r: () => number, S: number, cols: number[], n: number, size = 2) {
  for (let i = 0; i < n; i++) g.fillStyle(cols[Math.floor(r() * cols.length)], 1).fillRect(Math.floor((r() * S) / size) * size, Math.floor((r() * S) / size) * size, size, size);
}

/** Mancha redondeada en escalones de 2 px que da la vuelta por los bordes. */
function blotch(g: G, c: number, cx: number, cy: number, rx: number, ry: number, S: number, a = 1) {
  for (let yy = -ry; yy < ry; yy += 2) {
    const half = Math.round((rx * Math.sqrt(Math.max(0, 1 - ((yy + 1) / ry) ** 2))) / 2) * 2;
    if (half > 0) wrapRect(g, c, cx - half, cy + yy, half * 2, 2, S, a);
  }
}

/** Suelo del bioma (128x128): base con ruido, manchas de tono y el detalle propio de cada bioma. */
function drawFloor(g: G, b: BiomeLook) {
  const S = FLOOR_TEX;
  const r = rngFor(b.id + 'floor2');
  const base = b.colors.floor;
  const dark = shade(base, -0.08);
  const darker = shade(base, -0.17);
  const light = shade(base, 0.12);
  const lighter = shade(base, 0.3);
  px(g, base, 0, 0, S, S);
  switch (b.id) {
    case 'cueva':
    case 'volcan':
    case 'cumbre': {
      // Losas de piedra irregulares; en el volcán la junta es roca negra con vetas de lava
      const gap = b.id === 'volcan' ? 0x3a1a14 : shade(base, -0.3);
      const joints = drawStones(g, r, S, 32, 24, 56, base, gap, { jitter: 0.12, split: true });
      if (b.id === 'volcan') {
        for (const [x, y, w, jh] of joints) if (r() < 0.35) {
          wrapRect(g, 0xd8401a, x, y + jh - 1, w, 1, S);
          if (r() < 0.5) wrapRect(g, 0xffa030, x + Math.floor(w / 2), y + jh - 1, 3, 1, S);
        }
        dither(g, r, S, [shade(base, -0.25), 0x5a2a20], 30);
      }
      if (b.id === 'cueva') dither(g, r, S, [darker, shade(base, -0.3)], 40);
      if (b.id === 'cumbre') {
        // Vetas de cristal en algunas losas
        for (const [x, y, w] of joints) if (r() < 0.22) {
          const cx = x + 3 + Math.floor(r() * (w - 8));
          wrapRect(g, 0xffffff, cx, y + 5, 2, 2, S);
          wrapRect(g, 0xc8b0ff, cx + 2, y + 7, 2, 2, S);
          wrapRect(g, 0xc8b0ff, cx - 2, y + 9, 2, 2, S);
        }
      }
      break;
    }
    case 'ciudad': {
      // Adoquines rectangulares a matajunta y alguna tapa o mancha de aceite
      drawStones(g, r, S, 16, 30, 34, base, shade(base, -0.32), { offset: true, jitter: 0.06 });
      for (let i = 0; i < 3; i++) blotch(g, shade(base, -0.2), Math.floor(r() * S), Math.floor(r() * S), 6 + Math.floor(r() * 6), 4, S, 0.35);
      dither(g, r, S, [darker, lighter], 40);
      break;
    }
    case 'torre': {
      // Baldosas grandes de dos tonos con bisel, grietas y polvo
      for (let ty = 0; ty < S; ty += 32) for (let tx = 0; tx < S; tx += 32) {
        const tone = ((tx + ty) / 32) % 2 ? shade(base, -0.06) : shade(base, 0.04);
        px(g, shade(base, -0.35), tx, ty, 32, 32);
        px(g, tone, tx + 1, ty + 1, 30, 30);
        px(g, shade(tone, 0.22), tx + 1, ty + 1, 30, 2);
        px(g, shade(tone, 0.12), tx + 1, ty + 1, 2, 30);
        px(g, shade(tone, -0.15), tx + 1, ty + 29, 30, 2);
        // Estrella de cuatro puntas grabada en el centro
        px(g, shade(tone, -0.14), tx + 15, ty + 9, 2, 14);
        px(g, shade(tone, -0.14), tx + 9, ty + 15, 14, 2);
        px(g, shade(tone, -0.14), tx + 13, ty + 13, 6, 6);
        px(g, shade(tone, 0.14), tx + 15, ty + 15, 2, 2);
      }
      for (let i = 0; i < 4; i++) {
        let x = Math.floor(r() * S);
        let y = Math.floor(r() * S);
        for (let s = 0; s < 7; s++) {
          wrapRect(g, shade(base, -0.4), x, y, 2, 2, S);
          x += r() < 0.5 ? 2 : -2;
          y += 2;
        }
      }
      dither(g, r, S, [darker], 30);
      break;
    }
    case 'mar': {
      // Arena: ondas que dejó el agua, conchitas rotas y granos claros y oscuros
      dither(g, r, S, [dark, light, darker, lighter], 260);
      for (let y = 6; y < S; y += 12) {
        let x = Math.floor(r() * S);
        const len = 30 + Math.floor(r() * 50);
        for (let k = 0; k < len; k += 2) {
          const yy = y + Math.round(Math.sin((k + x) / 6) * 2) * 1;
          wrapRect(g, darker, x + k, yy, 2, 1, S);
          wrapRect(g, lighter, x + k, yy - 1, 2, 1, S);
        }
      }
      for (let i = 0; i < 6; i++) wrapRect(g, 0xf8e8e0, Math.floor(r() * S), Math.floor(r() * S), 2, 2, S);
      break;
    }
    case 'nieve': {
      // Nieve: sombras azuladas en lomas suaves, crestas de viento y escarcha que brilla
      for (let i = 0; i < 6; i++) blotch(g, 0xdce8f2, Math.floor(r() * S), Math.floor(r() * S), 14 + Math.floor(r() * 14), 6 + Math.floor(r() * 6), S);
      for (let i = 0; i < 6; i++) blotch(g, 0xffffff, Math.floor(r() * S), Math.floor(r() * S), 10 + Math.floor(r() * 10), 4, S);
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(r() * S);
        const y = Math.floor(r() * S);
        wrapRect(g, 0xc4d6e6, x, y, 10 + Math.floor(r() * 8), 1, S);
        wrapRect(g, 0xffffff, x + 2, y - 1, 8, 1, S);
      }
      dither(g, r, S, [0xd2e2ee, 0xffffff], 120);
      for (let i = 0; i < 10; i++) wrapRect(g, 0xbfe6ff, Math.floor(r() * S), Math.floor(r() * S), 1, 1, S);
      break;
    }
    default: {
      // Bosque, pantano: hierba con manchas de tono, matas de briznas y tréboles
      const blade = shade(base, -0.24);
      for (let i = 0; i < 8; i++) blotch(g, r() < 0.5 ? dark : light, Math.floor(r() * S), Math.floor(r() * S), 10 + Math.floor(r() * 16), 5 + Math.floor(r() * 8), S);
      dither(g, r, S, [dark, light, darker], 160);
      for (let i = 0; i < 46; i++) {
        const x = Math.floor(r() * S);
        const y = Math.floor(r() * S);
        wrapRect(g, blade, x, y, 1, 3, S);
        wrapRect(g, blade, x + 2, y - 1, 1, 4, S);
        wrapRect(g, blade, x + 4, y + 1, 1, 2, S);
        wrapRect(g, lighter, x + 2, y - 1, 1, 1, S);
      }
      if (b.id === 'pantano') {
        // Barro y musgo oscuro
        for (let i = 0; i < 5; i++) blotch(g, 0x6e6a40, Math.floor(r() * S), Math.floor(r() * S), 6 + Math.floor(r() * 8), 3 + Math.floor(r() * 3), S, 0.7);
        dither(g, r, S, [0x5e7040, 0x7a6a44], 40);
      } else {
        for (let i = 0; i < 4; i++) {
          const x = Math.floor(r() * S);
          const y = Math.floor(r() * S);
          wrapRect(g, 0xf4f4e0, x, y, 1, 1, S);
          wrapRect(g, 0xf4f4e0, x + 2, y, 1, 1, S);
          wrapRect(g, 0xf4f4e0, x + 1, y - 1, 1, 1, S);
          wrapRect(g, 0xf4f4e0, x + 1, y + 1, 1, 1, S);
        }
      }
    }
  }
}

/** Pared (64x64): sillares de distinto tamaño con bisel, juntas hundidas y el remate de cada bioma (musgo, hielo…). */
function drawWall(g: G, b: BiomeLook) {
  const S = WALL_TEX;
  const r = rngFor(b.id + 'wall2');
  const c = b.colors.wall;
  const joints = drawStones(g, r, S, 16, 16, 32, c, shade(c, -0.5), { offset: true, jitter: 0.16, bevel: 2 });
  const deco = (col: number, n: number, w = 2) => {
    for (let i = 0; i < n; i++) {
      const [x, y, jw] = joints[Math.floor(r() * joints.length)];
      wrapRect(g, col, x + Math.floor(r() * jw), y + 14, w + Math.floor(r() * 4), 2, S);
    }
  };
  switch (b.id) {
    case 'bosque':
    case 'pantano':
      deco(b.id === 'pantano' ? 0x4a5a2a : 0x3f8a36, 14, 3);
      deco(b.id === 'pantano' ? 0x6a7a3a : 0x6cbf4a, 8);
      break;
    case 'volcan':
      for (const [x, y, w] of joints) if (r() < 0.25) {
        wrapRect(g, 0xd8401a, x, y + 15, w, 1, S);
        wrapRect(g, 0xffa030, x + 2, y + 15, 2, 1, S);
      }
      break;
    case 'nieve':
    case 'cumbre':
      deco(0xe8f4ff, 12, 4);
      break;
    case 'mar':
      deco(0x2f8a7a, 10, 3);
      deco(0xf0e0c0, 4, 1);
      break;
    case 'torre':
      for (let i = 0; i < 3; i++) {
        const [x, y] = joints[Math.floor(r() * joints.length)];
        wrapRect(g, 0x8a64e0, x + 6, y + 6, 2, 2, S);
      }
      break;
    default:
      break;
  }
}

/** Dibuja una plantilla de caracteres (un carácter = un píxel) con una paleta; '.' es transparente. */
function stamp(g: G, shape: readonly string[], pal: Record<string, number>, ox: number, oy: number) {
  shape.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.' && pal[row[i]] !== undefined) px(g, pal[row[i]], ox + i, oy + j);
  });
}

/** Roca con contorno, cara superior clara, sombra y un detalle propio de cada bioma. */
function drawRock(g: G, b: BiomeLook) {
  const { rock, rockTop } = b.colors;
  const shape = [
    '..........kkkkk.........',
    '.......kkkTTTTTkkk......',
    '.....kkTTTTTWWTTTTkk....',
    '....kTTTTTWWTTTTTTTTk...',
    '...kTTTTTTTTTTTTTTTTTk..',
    '..kRTTTTTTTTTTTTTTTTRk..',
    '..kRRRTTTTTTTTTTTRRRRk..',
    '.kRRRRRRRRRRRRRRRRRRRRk.',
    '.kRLRRRRRRRRRRRRRRRRRDk.',
    '.kRLRRRRRRRRRRRRRRRRDDk.',
    '.kRRRDRRRRRRRRRRRRRDDDk.',
    '.kRRRRDDRRRRRRRRRRDDDDk.',
    '..kRRRRRRRRRRRRRRDDDDk..',
    '..kDDRRRRRRRRRRRDDDDDk..',
    '...kkDDDDDDDDDDDDDDkk...',
    '.....kkkkkkkkkkkkkk.....',
  ];
  const pal: Record<string, number> = {
    k: OUTLINE, T: rockTop, W: shade(rockTop, 0.5), R: rock, L: shade(rock, 0.2), D: shade(rock, -0.3),
  };
  g.fillStyle(0x000000, 0.28).fillEllipse(16, 27, 28, 6);
  stamp(g, shape, pal, 4, 10);
  // Grieta y muescas para que no parezca un bloque liso
  px(g, shade(rock, -0.45), 14, 20, 1, 2);
  px(g, shade(rock, -0.45), 15, 22, 1, 2);
  px(g, shade(rock, -0.45), 13, 24, 1, 1);
  switch (b.id) {
    case 'bosque':
    case 'pantano': {
      // Musgo
      const m = b.id === 'pantano' ? [0x3d6a3a, 0x5b8f4c] : [0x4f9a3c, 0x7bc45a];
      for (const [x, y, w] of [[8, 14, 6], [18, 13, 5], [9, 17, 3], [20, 17, 4], [13, 12, 3]]) {
        px(g, m[0], x, y, w, 2);
        px(g, m[1], x, y, w, 1);
      }
      px(g, m[1], 12, 11, 1, 1);
      break;
    }
    case 'cueva': {
      // Cristales azules que asoman
      stamp(g, ['..c.', '.cCc', '.cCc', 'cCCc'], { c: 0x6f8fe8, C: 0xc4d8ff }, 20, 12);
      stamp(g, ['.c.', 'cCc', 'cCc'], { c: 0x9b6fe8, C: 0xe0ccff }, 8, 16);
      break;
    }
    case 'mar': {
      // Coral y una estrella de mar
      stamp(g, ['.p.p.', '.ppp.', '..p..', '..p..'], { p: 0xf0709a }, 19, 13);
      for (const [x, y] of [[9, 15], [11, 18], [14, 14]]) px(g, 0xf4ecd8, x, y);
      stamp(g, ['..o..', 'ooooo', '.ooo.', '.o.o.'], { o: 0xff9a4a }, 9, 19);
      break;
    }
    case 'volcan': {
      // Grietas de lava que brillan
      for (const [x, y, w, h] of [[10, 14, 1, 4], [11, 17, 3, 1], [13, 18, 1, 3], [20, 15, 1, 3], [19, 18, 2, 1]]) {
        px(g, 0xff6a1a, x, y, w, h);
        px(g, 0xffd060, x, y, 1, 1);
      }
      break;
    }
    case 'torre': {
      // Símbolo tallado y brillos violeta
      px(g, 0xb08cff, 15, 13, 2, 6);
      px(g, 0xb08cff, 13, 15, 6, 2);
      px(g, 0xe6d8ff, 15, 15, 2, 2);
      for (const [x, y] of [[9, 19], [22, 14], [20, 21]]) px(g, 0x8a64e0, x, y);
      break;
    }
    case 'ciudad': {
      // Bloque de obra: franja amarilla y remaches
      for (let x = 7; x < 25; x += 4) px(g, x % 8 === 3 ? 0xf2c230 : 0x2a2a30, x, 21, 3, 2);
      for (const [x, y] of [[8, 13], [23, 13], [8, 18], [23, 18]]) {
        px(g, 0x3a3a44, x, y, 2, 2);
        px(g, 0xd0d0e0, x, y);
      }
      break;
    }
    case 'nieve':
    case 'cumbre': {
      // Capa de nieve encima
      stamp(g, [
        '.....wwwwwwwwww.....',
        '...wwwWWWWWWWwwww...',
        '..wwWWWWWWWWWWWWww..',
        '..wwWWWw.wWWWWw.ww..',
        '...w..w...ww..w.....',
      ], { w: 0xdde8f4, W: 0xffffff }, 6, 11);
      break;
    }
    default:
      break;
  }
}

/** Hierba alta (se puede romper disparando), con un detalle propio de cada bioma. */
function drawBush(g: G, b: BiomeLook, f = 0) {
  const sway = [0, 1, 0, -1][f % 4];
  const tint = b.colors.bush;
  // Blanco = hierba verde normal; si no, la hierba toma el color del bioma (seca, de coral, nevada…)
  const green = tint === 0xffffff;
  const dark = green ? 0x2f7a32 : shade(tint, -0.5);
  const mid = green ? 0x48a848 : shade(tint, -0.22);
  const light = green ? 0x88d870 : shade(tint, 0.25);
  const line = shade(dark, -0.45);
  g.fillStyle(0x000000, 0.22).fillEllipse(16, 29, 30, 5);
  const blades = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29];
  blades.forEach((x, i) => {
    const h = 12 + ((i * 7) % 10);
    const top = 30 - h;
    // Cada hoja acaba en punta y se inclina un poco a un lado
    const lean = i % 2 === 0 ? 1 : 0;
    // La punta (5 px) se mece con el viento; la base no se mueve
    const tipX = x + lean + (i % 3 === 1 ? -sway : sway);
    px(g, line, x - 1 + lean, top + 5, 4, h - 4);
    px(g, dark, x + lean, top + 6, 2, h - 6);
    px(g, mid, x + lean, top + 6, 1, h - 8);
    px(g, line, tipX - 1, top, 4, 6);
    px(g, dark, tipX, top + 1, 2, 5);
    px(g, mid, tipX, top + 2, 1, 4);
    px(g, light, tipX, top + 1, 1, 2);
    px(g, line, tipX, top - 1, 2, 1);
  });
  px(g, line, 1, 29, 30, 1);
  // Flores, bayas o escarcha en las puntas
  const tips: Record<string, number> = {
    bosque: 0xff7aa8, pantano: 0x8a5a3a, nieve: 0xffffff, cumbre: 0xffffff, mar: 0xff9a7a, volcan: 0xff5a2a, cueva: 0xa8e8ff,
  };
  const tip = tips[b.id];
  if (tip !== undefined) for (const [x, y] of [[5, 10], [14, 7], [23, 9], [29, 14], [11, 14]]) px(g, tip, x + sway, y, 2, 2);
  if (b.id === 'pantano') {
    // Espadañas
    for (const x of [8, 20]) {
      px(g, OUTLINE, x, 4, 3, 8);
      px(g, 0x7a4a2a, x + 1, 5, 1, 6);
    }
  }
}

/** Agujero que no se puede cruzar andando: bordes de piedra y fondo que se oscurece. */
function drawHole(g: G, b: BiomeLook) {
  const h = b.colors.hole;
  const rim = shade(b.colors.floor, -0.38);
  g.fillStyle(OUTLINE, 1).fillRect(0, 0, TILE, TILE);
  g.fillStyle(rim, 1).fillRect(1, 1, 30, 30);
  px(g, shade(rim, 0.3), 1, 1, 30, 2);
  // Fondo en capas: cuanto más adentro, más oscuro
  g.fillStyle(shade(h, 0.18), 1).fillRect(3, 4, 26, 25);
  g.fillStyle(h, 1).fillRect(5, 7, 22, 20);
  g.fillStyle(shade(h, -0.45), 1).fillRect(8, 11, 16, 13);
  // Piedras sueltas en el borde
  for (const [x, y] of [[2, 3], [27, 5], [4, 26], [26, 27], [14, 2]]) {
    px(g, shade(rim, 0.15), x, y, 3, 2);
    px(g, shade(rim, -0.25), x, y + 2, 3, 1);
  }
  switch (b.id) {
    case 'volcan':
      // Resplandor de lava al fondo
      g.fillStyle(0xff5a1a, 0.55).fillRect(9, 20, 14, 4);
      g.fillStyle(0xffc060, 0.7).fillRect(12, 21, 8, 1);
      break;
    case 'mar':
      // Remolino
      for (const [x, y, w] of [[10, 14, 12], [12, 17, 8], [14, 20, 4]]) px(g, 0x6ab0f0, x, y, w, 1);
      break;
    case 'nieve':
    case 'cumbre':
      // Grietas de hielo
      for (const [x, y, w, hh] of [[8, 10, 1, 6], [9, 15, 5, 1], [20, 12, 1, 7], [15, 18, 5, 1]]) px(g, 0xbfe8ff, x, y, w, hh);
      break;
    case 'pantano':
      for (const [x, y] of [[11, 14], [17, 18], [21, 12]]) px(g, 0x7ac08a, x, y, 2, 2);
      break;
    case 'torre':
      for (const [x, y] of [[12, 15], [18, 19]]) px(g, 0xb08cff, x, y, 2, 2);
      break;
    default:
      break;
  }
}

/** Charco (agua, lava, hielo o niebla según el bioma): ralentiza o daña. */
function drawPuddle(g: G, b: BiomeLook, f = 0) {
  const c = b.colors.puddle;
  g.fillStyle(0x000000, 0.18).fillEllipse(16, 20, 31, 20);
  g.fillStyle(shade(c, -0.4), 1).fillEllipse(16, 17, 30, 22);
  g.fillStyle(shade(c, -0.12), 1).fillEllipse(16, 16, 27, 19);
  g.fillStyle(c, 1).fillEllipse(16, 15, 23, 15);
  g.fillStyle(shade(c, 0.22), 1).fillEllipse(15, 13, 14, 7);
  // Ondas y reflejos
  // Borde mojado alrededor y ondas que crecen y se apagan (4 fotogramas); el brillo corre por la superficie
  g.lineStyle(1, shade(c, -0.55), 0.5).strokeEllipse(16, 17, 31, 23);
  const k = f % 4;
  g.lineStyle(1, shade(c, 0.45), 1 - k * 0.22).strokeEllipse(21, 18, 5 + k * 3, 2 + k);
  g.lineStyle(1, shade(c, 0.35), 0.4 + ((k + 2) % 4) * 0.18).strokeEllipse(11, 14, 3 + ((k + 2) % 4) * 2, 1 + ((k + 2) % 4));
  px(g, 0xffffff, 7 + k, 9, 3, 1);
  px(g, shade(c, 0.6), 8 + k, 10, 1, 1);
  if (k !== 2) px(g, 0xffffff, 22 - (k % 2), 12, 2, 1);
  switch (b.id) {
    case 'volcan':
      // Burbujas de lava
      for (const [x, y, ph] of [[10, 14, 0], [20, 17, 1], [15, 11, 2]]) {
        // Cada burbuja crece, revienta y vuelve a salir
        const st = (k + ph) % 4;
        if (st === 3) continue;
        px(g, 0xffe08a, x, y - st, 1 + st, 1 + st);
        px(g, 0xffffff, x, y - st);
      }
      break;
    case 'nieve':
    case 'cumbre':
      // Hielo con grietas
      for (const [x, y, w, h] of [[8, 12, 8, 1], [15, 12, 1, 6], [15, 17, 6, 1], [11, 15, 1, 4]]) px(g, 0xffffff, x, y, w, h);
      break;
    case 'pantano':
      // Nenúfar
      g.fillStyle(0x3d8a48, 1).fillEllipse(20, 16, 9, 5);
      px(g, 0xff9ac0, 20, 14, 2, 2);
      break;
    case 'torre':
      for (const [x, y] of [[10, 13], [19, 18], [23, 12]]) px(g, 0xd9c8ff, x, y, 1, 3);
      break;
    default:
      break;
  }
}

/** Columna (32x48): bloquea y tapa disparos. Con antorcha o hiedra según el bioma. */
function drawPillar(g: G, b: BiomeLook, f = 0) {
  const c = shade(b.colors.wall, 0.25);
  g.fillStyle(0x000000, 0.28).fillEllipse(16, 44, 28, 6);
  px(g, OUTLINE, 5, 6, 22, 40);
  px(g, c, 6, 7, 20, 38);
  px(g, shade(c, 0.3), 6, 7, 4, 38);
  px(g, shade(c, 0.12), 10, 7, 2, 38);
  px(g, shade(c, -0.25), 22, 7, 4, 38);
  // Estrías y grietas
  for (const x of [13, 17]) px(g, shade(c, -0.18), x, 10, 1, 31);
  px(g, shade(c, -0.4), 19, 20, 1, 4);
  px(g, shade(c, -0.4), 20, 24, 1, 3);
  // Capitel y base
  px(g, OUTLINE, 3, 3, 26, 6);
  px(g, shade(c, 0.15), 4, 4, 24, 4);
  px(g, shade(c, 0.4), 4, 4, 24, 1);
  px(g, OUTLINE, 3, 41, 26, 6);
  px(g, shade(c, -0.1), 4, 42, 24, 4);
  px(g, shade(c, 0.2), 4, 42, 24, 1);
  switch (b.id) {
    case 'volcan':
    case 'torre':
    case 'ciudad': {
      // Llama encima del capitel (violeta en la torre, naranja en el resto)
      const fl = b.id === 'torre' ? [0x6a3ad0, 0xb08cff, 0xf0e4ff] : [0xff5a1a, 0xffa030, 0xfff0a0];
      const flames = [
        ['..f..', '.fFf.', '.fFf.', 'fFYFf', 'fFYFf', '.fFf.'],
        ['...f.', '..fF.', '.fFf.', 'fFYFf', 'fFYFf', '.fFf.'],
        ['.....', '.f...', '.fFf.', 'fFYFf', 'fYYFf', '.fFf.'],
        ['.f...', '.Ff..', '.fFf.', 'fFYFf', 'fFYFf', '.fFf.'],
      ];
      stamp(g, flames[f % 4], { f: fl[0], F: fl[1], Y: fl[2] }, 13, 0);
      break;
    }
    case 'bosque':
    case 'pantano': {
      // Hiedra enroscada
      const v = b.id === 'pantano' ? 0x3d6a3a : 0x3f9a40;
      for (const [x, y] of [[7, 12], [8, 15], [9, 18], [8, 21], [7, 24], [24, 20], [23, 24], [24, 28], [8, 31]]) px(g, v, x, y, 3, 2);
      for (const [x, y] of [[9, 14], [8, 26], [23, 26]]) px(g, shade(v, 0.4), x, y, 2, 2);
      break;
    }
    case 'nieve':
    case 'cumbre':
      // Nieve en el capitel y carámbanos
      px(g, 0xffffff, 4, 2, 24, 3);
      for (const x of [6, 12, 20, 25]) px(g, 0xdbefff, x, 9, 2, 4);
      break;
    case 'mar':
      for (const [x, y] of [[8, 14], [22, 20], [10, 30], [21, 34]]) {
        px(g, 0xf0709a, x, y, 3, 3);
        px(g, 0xffd0e0, x, y);
      }
      break;
    case 'cueva':
      for (const [x, y] of [[8, 30], [22, 16]]) stamp(g, ['.c.', 'cCc', 'cCc'], { c: 0x6f8fe8, C: 0xc4d8ff }, x, y);
      break;
    default:
      break;
  }
}

const PARTS: Record<TilePart, { w: number; h: number; draw: (g: G, b: BiomeLook, f?: number) => void; frames?: number }> = {
  floor: { w: FLOOR_TEX, h: FLOOR_TEX, draw: drawFloor },
  wall: { w: WALL_TEX, h: WALL_TEX, draw: drawWall },
  rock: { w: TILE, h: TILE, draw: drawRock },
  bush: { w: TILE, h: TILE, draw: drawBush, frames: 4 },
  hole: { w: TILE, h: TILE, draw: drawHole },
  puddle: { w: TILE, h: TILE, draw: drawPuddle, frames: 4 },
  pillar: { w: TILE, h: 48, draw: drawPillar, frames: 4 },
};

/** Fotogramas (tira horizontal) de las piezas animadas: se copian por turnos a su textura de lienzo. */
const stripKey = (key: string) => `${key}-strip`;
/** Último bioma animado por escena (un solo temporizador vivo por escena). */
const animOwner = new WeakMap<Phaser.Scene, string>();

/**
 * Anima a la vez todos los charcos, hierbas altas y llamas de columna del bioma copiando el fotograma siguiente a
 * su textura (un temporizador por escena, sin objetos nuevos: cada sala ya usa esas texturas). Con efectos bajos, quieto.
 */
function animateTiles(scene: Phaser.Scene, biomeId: string) {
  if (lowFx() || animOwner.get(scene) === biomeId) return;
  animOwner.set(scene, biomeId);
  const parts = (Object.keys(PARTS) as TilePart[]).filter((p) => PARTS[p].frames);
  let tick = 0;
  const ev = scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: () => {
      if (animOwner.get(scene) !== biomeId) return ev.remove();
      tick++;
      for (const part of parts) {
        const { w, h, frames = 1 } = PARTS[part];
        // Charco y llama cambian a cada paso; la hierba, más despacio (se mece)
        const every = part === 'bush' ? 3 : part === 'pillar' ? 1 : 2;
        if (tick % every) continue;
        const key = tileKey(biomeId, part);
        const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
        const strip = scene.textures.exists(stripKey(key)) ? scene.textures.get(stripKey(key)).getSourceImage() : undefined;
        if (!tex?.context || !strip) continue;
        const f = Math.floor(tick / every) % frames;
        tex.context.clearRect(0, 0, w, h);
        tex.context.drawImage(strip as CanvasImageSource, f * w, 0, w, h, 0, 0, w, h);
        tex.refresh();
      }
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    ev.remove();
    animOwner.delete(scene);
  });
}

/** Crea (una vez) todas las texturas del bioma con filtro NEAREST y pone en marcha sus animaciones. Devuelve sus claves. */
export function bakeBiomeTiles(scene: Phaser.Scene, biome: BiomeLook): Record<TilePart, string> {
  const keys = {} as Record<TilePart, string>;
  for (const part of Object.keys(PARTS) as TilePart[]) {
    const key = tileKey(biome.id, part);
    keys[part] = key;
    if (scene.textures.exists(key)) continue;
    const { w, h, draw, frames = 1 } = PARTS[part];
    const g = scene.make.graphics({}, false);
    if (frames === 1) {
      draw(g, biome);
      g.generateTexture(key, w, h);
    } else {
      // Tira con todos los fotogramas y una textura de lienzo del tamaño de uno (empieza en el primero)
      for (let f = 0; f < frames; f++) {
        g.save();
        g.translateCanvas(f * w, 0);
        draw(g, biome, f);
        g.restore();
      }
      g.generateTexture(stripKey(key), w * frames, h);
      const tex = scene.textures.createCanvas(key, w, h);
      const src = scene.textures.get(stripKey(key)).getSourceImage() as CanvasImageSource;
      if (tex) {
        tex.context.drawImage(src, 0, 0, w, h, 0, 0, w, h);
        tex.refresh();
      }
    }
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  animateTiles(scene, biome.id);
  return keys;
}
