// Arte de la Defensa de torres: camino de cada mapa con huellas que avanzan hacia la base, baldosas de colocación,
// decoración animada por bioma, portales de entrada que giran, la base (un Centro Pokémon en miniatura con luz que
// late), pedestales de las torres con su rareza y nivel, aura de evolución, anillo de alcance, iconos de las
// habilidades con su enfriamiento y estrellas. Todo en píxel gordo; con efectos bajos (lowFx) queda quieto.
// Solo dibujo: la partida es src/data/towerDefense/engine.ts.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf, mixColor } from './pixelFx';
import type { Cell, TdMap } from '../../data/towerDefense/maps';
import { pathCells } from '../../data/towerDefense/maps';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
/** Píxel del arte de los mapas (una casilla de 48 son 16 píxeles). */
export const P = 3;

export interface BiomeColors {
  floor: number;
  wall: number;
  rock: number;
  rockTop: number;
  bush: number;
  puddle: number;
  hole: number;
}

/** Colores del camino de cada bioma: borde, relleno y motas. */
const PATH_LOOK: Record<string, { edge: number; fill: number; speck: number }> = {
  bosque: { edge: 0x6b4a2a, fill: 0xd8b07a, speck: 0xa47a48 },
  cueva: { edge: 0x4a3524, fill: 0x9c7a56, speck: 0x6e5238 },
  mar: { edge: 0xb8945a, fill: 0xf8e6b0, speck: 0xd8c08a },
  volcan: { edge: 0x2a1410, fill: 0x6a3a2a, speck: 0xff7a2a },
  torre: { edge: 0x2a2040, fill: 0x6a5a8a, speck: 0x9a8abd },
  ciudad: { edge: 0x30343c, fill: 0x707684, speck: 0xf0d050 },
  nieve: { edge: 0x6a88a4, fill: 0xc6d8e8, speck: 0xffffff },
  pantano: { edge: 0x3a3020, fill: 0x7a6a44, speck: 0x5a8a3a },
  cumbre: { edge: 0x4a3a6a, fill: 0xb8a8d8, speck: 0xf0b8d8 },
};
const pathLook = (biome: string) => PATH_LOOK[biome] ?? PATH_LOOK.bosque;

// --- Texturas pequeñas (iconos, estrellas, monedas) ---

const ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  rayo: {
    pal: { k: OUT, Y: 0xffd34d, W: 0xfff6b0, O: 0xe0a800 },
    rows: ['......kkkk', '.....kYYWk', '....kYYWk.', '...kYYWk..', '..kYYYYkkk', '.kYYYYYYWk', 'kkkkYYYWk.', '...kYYWk..', '..kYYWk...', '..kYWk....', '.kYWk.....', '.kkk......'],
  },
  ventisca: {
    pal: { k: OUT, B: 0x8fe0ff, W: 0xffffff, D: 0x3a8ac8 },
    rows: ['....kk....', '.k.kWBk.k.', 'kWkkBBkkWk', '.kBkWBkBk.', 'kkkBWWBkkk', 'kWBWDDWBWk', 'kkkBWWBkkk', '.kBkWBkBk.', 'kWkkBBkkWk', '.k.kWBk.k.', '....kk....'],
  },
  curar: {
    pal: { k: OUT, G: 0x2ecc71, L: 0xb8f0c8, W: 0xffffff },
    rows: ['...kkkk...', '...kGLk...', '...kGLk...', 'kkkkGLkkkk', 'kWLLGGLLLk', 'kGGGGGGGGk', 'kkkkGGkkkk', '...kGGk...', '...kGGk...', '...kkkk...'],
  },
  next: {
    pal: { k: OUT, W: 0xffffff, Y: 0xffd34d },
    rows: ['kk...kk...', 'kWk..kWk..', 'kYWk.kYWk.', 'kYYWkkYYWk', 'kYYYWkYYYW', 'kYYWkkYYWk', 'kYWk.kYWk.', 'kWk..kWk..', 'kk...kk...'],
  },
  heart: {
    pal: { k: OUT, R: 0xe53935, L: 0xff9a9a, D: 0xa5231f },
    rows: ['.kk..kk.', 'kLRkkRRk', 'kLRRRRRk', 'kRRRRRDk', '.kRRRDk.', '..kRDk..', '...kk...'],
  },
  coin: {
    pal: { k: OUT, Y: 0xffd34d, W: 0xfff6b0, O: 0xb8860b },
    rows: ['..kkkk..', '.kYWWYk.', 'kYWYYOYk', 'kYWOOYOk', 'kYYOOYOk', 'kYYYYOOk', '.kOOOOk.', '..kkkk..'],
  },
  star: {
    pal: { k: OUT, Y: 0xffd34d, W: 0xfff6b0, O: 0xe0a800 },
    rows: ['....k....', '...kWk...', '...kYk...', 'kkkWYYkkk', 'kWWYYYYOk', '.kYYYYOk.', '.kYYOYOk.', 'kYOk.kOYk', 'kkk...kkk'],
  },
  starOff: {
    pal: { k: OUT, Y: 0x5a6070, O: 0x3a4050 },
    rows: ['....k....', '...kYk...', '...kYk...', 'kkkYYYkkk', 'kYYYYYYOk', '.kYYYYOk.', '.kYYOYOk.', 'kYOk.kOYk', 'kkk...kkk'],
  },
  lock: {
    pal: { k: OUT, G: 0xc0c8d4, D: 0x7a8494, Y: 0xffd34d },
    rows: ['..kkkk..', '.kGGGGk.', '.kGk.kGk', '.kGk.kGk', 'kkkkkkkkk', 'kYYYYYYk', 'kYYkkYYk', 'kYYkkYYk', 'kYYYYYYk', 'kkkkkkkk'],
  },
  skull: {
    pal: { k: OUT, W: 0xffffff, G: 0xc0c8d4, R: 0xe53935 },
    rows: ['.kkkkkk.', 'kWWWWWWk', 'kWRWWRWk', 'kWRWWRWk', 'kWWWWWWk', '.kWkkWk.', '.kWWWWk.', '..kkkk..'],
  },
  wing: {
    pal: { k: OUT, W: 0xffffff, B: 0x8fd0ff },
    rows: ['k.......', 'kWk.....', 'kWWkk...', 'kBWWWkk.', '.kBWWWWk', '.kkBBWWk', '...kkBBk', '.....kkk'],
  },
  speed: {
    pal: { k: OUT, W: 0xffffff, Y: 0x8fe39a },
    rows: ['...kkkk...', '.kkWWWWkk.', 'kWWk..kYWk', 'kWk..kYk.k', 'kWk.kYk..k', 'kWkkYk...k', 'kWWkkk..Wk', '.kkWWWWkk.', '...kkkk...'],
  },
  pause: {
    pal: { k: OUT, W: 0xffffff },
    rows: ['kkk..kkk', 'kWk..kWk', 'kWk..kWk', 'kWk..kWk', 'kWk..kWk', 'kWk..kWk', 'kkk..kkk'],
  },
};

export const tdIconKey = (name: string) => `td-ic-${name}`;

export function bakeTdArt(scene: Phaser.Scene) {
  for (const [name, ic] of Object.entries(ICONS)) {
    const key = tdIconKey(name);
    if (scene.textures.exists(key)) continue;
    const w = Math.max(...ic.rows.map((r) => r.length));
    const g = scene.make.graphics({}, false);
    ic.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = ic.pal[row[x]];
        if (c !== undefined) g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      }
    });
    g.generateTexture(key, w, ic.rows.length);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** Icono como imagen escalada sin suavizar. */
export const tdIcon = (scene: Phaser.Scene, x: number, y: number, name: string, scale = 3) =>
  scene.add.image(x, y, tdIconKey(name)).setScale(scale);

// --- Mapa ---

const snap = (v: number) => Math.round(v / P) * P;
const px = (g: G, c: number, x: number, y: number, w = P, h = P, a = 1) => g.fillStyle(c, a).fillRect(snap(x), snap(y), w, h);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MapGeom {
  ox: number;
  oy: number;
  cell: number;
}

/** Camino (fijo): borde oscuro, relleno con motas y bordillos en las esquinas. */
export function drawRoad(g: G, map: TdMap, biome: string, geo: MapGeom) {
  const look = pathLook(biome);
  const road = new Set<string>();
  for (const p of map.paths) for (const c of pathCells(p)) road.add(`${c.x},${c.y}`);
  const has = (x: number, y: number) => road.has(`${x},${y}`);
  const r = rng(map.tier * 977 + 13);
  const S = geo.cell;
  // Sombra y borde
  for (const k of road) {
    const [x, y] = k.split(',').map(Number);
    const X = geo.ox + x * S;
    const Y = geo.oy + y * S;
    g.fillStyle(look.edge, 1).fillRect(X, Y, S, S);
  }
  // Relleno (se une con los vecinos para que el camino sea continuo)
  const m = P * 2;
  for (const k of road) {
    const [x, y] = k.split(',').map(Number);
    const X = geo.ox + x * S;
    const Y = geo.oy + y * S;
    const l = has(x - 1, y) ? 0 : m;
    const rr = has(x + 1, y) ? 0 : m;
    const t = has(x, y - 1) ? 0 : m;
    const b = has(x, y + 1) ? 0 : m;
    g.fillStyle(look.fill, 1).fillRect(X + l, Y + t, S - l - rr, S - t - b);
    // Luz arriba y sombra abajo del borde
    if (t) g.fillStyle(lightOf(look.fill), 1).fillRect(X + l, Y + t, S - l - rr, P);
    if (b) g.fillStyle(darkOf(look.fill), 1).fillRect(X + l, Y + S - b - P, S - l - rr, P);
    // Motas y piedrecitas
    for (let i = 0; i < 4; i++) {
      const sx = X + m + r() * (S - m * 2 - P);
      const sy = Y + m + r() * (S - m * 2 - P);
      px(g, i % 2 ? look.speck : darkOf(look.fill), sx, sy);
    }
  }
}

/** Baldosas donde se puede colocar: esquinas marcadas, muy suaves. */
export function drawPads(g: G, cells: readonly Cell[], floor: number, geo: MapGeom) {
  const S = geo.cell;
  const c = darkOf(floor);
  for (const q of cells) {
    const X = geo.ox + q.x * S;
    const Y = geo.oy + q.y * S;
    g.fillStyle(c, 0.35);
    g.fillRect(X + P, Y + P, P * 3, P).fillRect(X + P, Y + P, P, P * 3);
    g.fillRect(X + S - P * 4, Y + P, P * 3, P).fillRect(X + S - P * 2, Y + P, P, P * 3);
    g.fillRect(X + P, Y + S - P * 2, P * 3, P).fillRect(X + P, Y + S - P * 4, P, P * 3);
    g.fillRect(X + S - P * 4, Y + S - P * 2, P * 3, P).fillRect(X + S - P * 2, Y + S - P * 4, P, P * 3);
  }
}

/** Decoración de cada bioma en algunas casillas (no estorba: solo es dibujo). */
export interface Decor {
  x: number;
  y: number;
  kind: number;
  phase: number;
}

export function pickDecor(map: TdMap, cells: readonly Cell[], geo: MapGeom): Decor[] {
  const r = rng(map.tier * 131 + map.layout * 7 + (map.mirrored ? 3 : 0));
  const out: Decor[] = [];
  for (const q of cells) {
    if (r() > 0.16) continue;
    out.push({ x: geo.ox + q.x * geo.cell + 8 + r() * (geo.cell - 16), y: geo.oy + q.y * geo.cell + 12 + r() * (geo.cell - 20), kind: Math.floor(r() * 3), phase: r() * 6 });
  }
  return out;
}

/** Dibuja la decoración en el instante `t` (ms): flores y hierba que se mecen, cristales que brillan, brasas… */
export function drawDecor(g: G, biome: string, d: readonly Decor[], t: number) {
  const still = lowFx();
  for (const q of d) {
    const s = still ? 0 : Math.sin(t / 500 + q.phase);
    const tw = still ? 0.5 : (Math.sin(t / 260 + q.phase * 3) + 1) / 2;
    const { x, y } = q;
    switch (biome) {
      case 'bosque': {
        // Mata de hierba y una flor
        const sw = Math.round(s) * P;
        px(g, 0x3c8a3a, x - P * 2, y, P, P * 2);
        px(g, 0x3c8a3a, x, y - P, P, P * 3);
        px(g, 0x5cb85c, x + P * 2, y, P, P * 2);
        px(g, 0x2e6a2c, x - P * 2 + sw, y - P * 2);
        px(g, 0x5cb85c, x + sw, y - P * 3);
        if (q.kind === 0) {
          px(g, 0xffffff, x + P * 4 + sw, y - P * 2);
          px(g, 0xffd34d, x + P * 4 + sw, y - P * 2, P, P);
          px(g, 0xff8ab0, x + P * 3 + sw, y - P * 2);
          px(g, 0xff8ab0, x + P * 5 + sw, y - P * 2);
        }
        break;
      }
      case 'cueva': {
        // Cristal que brilla
        const c = q.kind === 0 ? 0x8fd0ff : q.kind === 1 ? 0xd08aff : 0xffd38a;
        px(g, OUT, x - P, y - P * 4, P * 3, P * 5);
        px(g, c, x, y - P * 3, P, P * 4);
        px(g, darkOf(c), x + P, y - P * 2, P, P * 3);
        px(g, mixColor(c, 0xffffff, tw), x, y - P * 3);
        if (tw > 0.85) px(g, 0xffffff, x + P * 2, y - P * 5);
        break;
      }
      case 'mar': {
        // Concha y burbuja de espuma
        px(g, 0xffd8c8, x - P, y, P * 3, P);
        px(g, 0xff9a8a, x, y - P, P, P);
        px(g, 0xe0786a, x - P, y + P, P * 3, P);
        if (!still) px(g, 0xffffff, x + P * 3, y - P * 2 - ((t / 40 + q.phase * 30) % 18), P, P, 0.7);
        break;
      }
      case 'nieve': {
        px(g, 0xffffff, x - P * 2, y, P * 5, P * 2);
        px(g, 0xd8e8f4, x - P, y - P, P * 3, P);
        px(g, 0xa8c4dc, x - P * 2, y + P * 2, P * 5, P);
        if (tw > 0.8) px(g, 0xffffff, x + P * 3, y - P * 3);
        break;
      }
      case 'ciudad': {
        // Farola con luz que parpadea
        px(g, 0x30343c, x, y - P * 5, P, P * 6);
        px(g, 0x30343c, x - P, y + P, P * 3, P);
        px(g, mixColor(0x806a20, 0xfff3a0, tw), x - P, y - P * 7, P * 3, P * 2);
        if (tw > 0.5) g.fillStyle(0xfff3a0, 0.15 * tw).fillCircle(x + 1, y - P * 6, 12);
        break;
      }
      case 'pantano': {
        // Juncos que se mecen y burbuja de lodo
        const sw = Math.round(s) * P;
        px(g, 0x4a6a2a, x - P, y - P * 3, P, P * 4);
        px(g, 0x5a7a3a, x + P, y - P * 4, P, P * 5);
        px(g, 0x6a4a2a, x - P + sw, y - P * 5, P, P * 2);
        px(g, 0x6a4a2a, x + P + sw, y - P * 6, P, P * 2);
        if (!still && tw > 0.7) px(g, 0x8a6fa8, x + P * 3, y, P * 2, P * 2, 0.8);
        break;
      }
      case 'volcan': {
        // Grieta de lava y brasa que sube
        px(g, 0x2a1410, x - P * 2, y, P * 5, P);
        px(g, mixColor(0xff4a10, 0xffd34d, tw), x - P, y, P * 3, P);
        if (!still) {
          const k = ((t / 1400 + q.phase) % 1);
          px(g, 0xffa040, x + Math.sin(k * 6) * P, y - P * 2 - k * 30, P, P, 1 - k);
        }
        break;
      }
      case 'torre': {
        // Vela con llama que tiembla
        px(g, 0xe8e0f0, x, y - P * 3, P * 2, P * 4);
        px(g, 0xb8a8d0, x + P, y - P * 3, P, P * 4);
        px(g, tw > 0.5 ? 0xa0e0ff : 0xd8a0ff, x + (tw > 0.5 ? 0 : P), y - P * 5, P, P * 2);
        g.fillStyle(0xa080ff, 0.12 + 0.1 * tw).fillCircle(x + P, y - P * 5, 10);
        break;
      }
      case 'cumbre': {
        // Nubecilla que pasa y piedra con brillo
        px(g, 0x9a8abd, x - P, y, P * 3, P * 2);
        px(g, 0xc8b8e8, x - P, y, P * 2, P);
        if (!still) {
          const dx = Math.sin(t / 900 + q.phase) * 6;
          px(g, 0xffffff, x - P * 3 + dx, y - P * 5, P * 5, P * 2, 0.7);
          px(g, 0xffffff, x - P * 2 + dx, y - P * 6, P * 3, P, 0.7);
        }
        break;
      }
      default:
        px(g, 0x5cb85c, x, y, P, P * 2);
    }
  }
}

/** Huellas que avanzan por el camino hacia la base (de dónde vienen los enemigos). */
export function drawFlow(g: G, map: TdMap, biome: string, geo: MapGeom, t: number) {
  if (lowFx()) return;
  const look = pathLook(biome);
  const S = geo.cell;
  for (const p of map.paths) {
    const cells = pathCells(p);
    const n = cells.length;
    const head = (t / 260) % 4;
    for (let i = 0; i < n - 1; i++) {
      if ((i + 4 - Math.floor(head)) % 4 !== 0) continue;
      const a = cells[i];
      const b = cells[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const cx = geo.ox + a.x * S + S / 2 + dx * (head % 1) * S;
      const cy = geo.oy + a.y * S + S / 2 + dy * (head % 1) * S;
      // Chevrón de 3 píxeles que apunta hacia donde va
      const c = darkOf(look.fill);
      const al = 0.55;
      px(g, c, cx + dx * P - P / 2, cy + dy * P - P / 2, P, P, al);
      px(g, c, cx - dy * P - dx * 0 - P / 2 - dx * P, cy + dx * P - P / 2 - dy * P, P, P, al);
      px(g, c, cx + dy * P - P / 2 - dx * P, cy - dx * P - P / 2 - dy * P, P, P, al);
    }
  }
}

/** Portal de entrada: remolino oscuro con anillo de píxeles que gira. */
export function drawPortal(g: G, x: number, y: number, color: number, t: number) {
  const still = lowFx();
  g.fillStyle(0x0c0818, 0.55).fillEllipse(x, y + 4, 40, 22);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (still ? 0 : t / 400);
    const r = 15 + (still ? 0 : Math.sin(t / 200 + i) * 1.5);
    px(g, i % 3 === 0 ? 0xffffff : i % 2 ? color : darkOf(color), x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - (still ? 0 : t / 250);
    px(g, lightOf(color), x + Math.cos(a) * 7, y + Math.sin(a) * 4);
  }
}

/** La base: un Centro Pokémon en miniatura (tejado rojo, Poké Ball) con luz que late y grietas si está dañada. */
export function drawBase(g: G, x: number, y: number, t: number, hpRatio: number, hitFlash = 0) {
  const still = lowFx();
  const pulse = still ? 0.5 : (Math.sin(t / 300) + 1) / 2;
  const glow = hpRatio > 0.5 ? 0x7cf07a : hpRatio > 0.25 ? 0xffd34d : 0xff5a4a;
  g.fillStyle(glow, 0.12 + 0.12 * pulse).fillEllipse(x, y + 14, 70 + pulse * 8, 26);
  const X = x - 21;
  const Y = y - 24;
  const wall = hitFlash > 0 ? 0xffffff : 0xf4f0e8;
  // Cuerpo
  g.fillStyle(OUT, 1).fillRect(X - P, Y + 12 - P, 42 + P * 2, 30 + P * 2);
  g.fillStyle(wall, 1).fillRect(X, Y + 12, 42, 30);
  g.fillStyle(0xd8d0c4, 1).fillRect(X, Y + 36, 42, 6);
  // Tejado rojo
  g.fillStyle(OUT, 1).fillRect(X - P * 2, Y + 3, 42 + P * 4, 12);
  g.fillStyle(0xe53935, 1).fillRect(X - P, Y + 6, 42 + P * 2, 6);
  g.fillStyle(0xff8a80, 1).fillRect(X - P, Y + 6, 42 + P * 2, P);
  // Puerta de cristal
  g.fillStyle(OUT, 1).fillRect(X + 15, Y + 24, 12, 18);
  g.fillStyle(mixColor(0x8fd0ff, 0xffffff, pulse * 0.5), 1).fillRect(X + 15 + P, Y + 24 + P, 12 - P * 2, 18 - P);
  // Poké Ball del rótulo
  const bx = x;
  const by = Y + 18;
  g.fillStyle(OUT, 1).fillCircle(bx, by, 7);
  g.fillStyle(0xe53935, 1).fillRect(bx - 5, by - 5, 10, 5);
  g.fillStyle(0xffffff, 1).fillRect(bx - 5, by, 10, 5);
  g.fillStyle(OUT, 1).fillRect(bx - 6, by - 1, 12, 2);
  g.fillStyle(mixColor(0xffffff, glow, pulse), 1).fillRect(bx - 1, by - 1, 3, 3);
  // Grietas al perder vida
  if (hpRatio < 0.66) {
    g.fillStyle(OUT, 0.8).fillRect(X + 4, Y + 16, P, P).fillRect(X + 7, Y + 19, P, P).fillRect(X + 4, Y + 22, P, P);
  }
  if (hpRatio < 0.33) {
    g.fillStyle(OUT, 0.8).fillRect(X + 33, Y + 14, P, P).fillRect(X + 36, Y + 18, P, P).fillRect(X + 33, Y + 22, P, P).fillRect(X + 36, Y + 26, P, P);
    if (!still && pulse > 0.6) px(g, 0x8a8a8a, x + 14, Y - 2 - pulse * 6, P * 2, P * 2, 0.6);
  }
}

/** Pedestal de una torre: losa de piedra con el borde del color de la rareza y los niveles en puntitos. */
export function drawPedestal(g: G, x: number, y: number, rarity: number, level: number, branch: 'a' | 'b' | null, selected: boolean, t: number) {
  const w = 38;
  const h = 14;
  g.fillStyle(0x000000, 0.25).fillEllipse(x, y + 3, w + 6, h + 4);
  g.fillStyle(OUT, 1).fillEllipse(x, y, w + 4, h + 4);
  g.fillStyle(selected ? lightOf(rarity) : rarity, 1).fillEllipse(x, y, w, h);
  g.fillStyle(0x8a8f9a, 1).fillEllipse(x, y - 2, w - 8, h - 6);
  g.fillStyle(0xb8bcc6, 1).fillEllipse(x, y - 3, w - 14, h - 9);
  // Niveles
  for (let i = 0; i < level; i++) {
    const lx = x - (level - 1) * 3.5 + i * 7;
    g.fillStyle(OUT, 1).fillRect(lx - 3, y + 5, 6, 6);
    g.fillStyle(i === 4 ? 0xff8ae0 : 0xffd34d, 1).fillRect(lx - 2, y + 6, 4, 4);
  }
  // Emblema de la rama
  if (branch) {
    const c = branch === 'a' ? 0xe53935 : 0x3a8ac8;
    const bx = x + w / 2 - 2;
    const by = y - 4;
    g.fillStyle(OUT, 1).fillRect(bx - 4, by - 4, 9, 9);
    g.fillStyle(c, 1).fillRect(bx - 3, by - 3, 7, 7);
    g.fillStyle(0xffffff, 1).fillRect(bx - 1, by - 1, 3, 3);
  }
  if (selected && !lowFx()) {
    const k = (Math.sin(t / 150) + 1) / 2;
    g.lineStyle(2, 0xffffff, 0.4 + 0.5 * k).strokeEllipse(x, y, w + 10, h + 8);
  }
}

/** Aura del nivel final: anillo de píxeles que gira con el color del tipo (más llamativo si ha evolucionado). */
export function drawAura(g: G, x: number, y: number, color: number, t: number, evolved: boolean) {
  const still = lowFx();
  const n = evolved ? 14 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (still ? 0 : t / 600);
    const up = still ? 0 : ((t / 900 + i / n) % 1);
    px(g, i % 2 ? color : lightOf(color), x + Math.cos(a) * 22, y + Math.sin(a) * 9 - up * (evolved ? 26 : 14), P, P, 1 - up * 0.8);
  }
  if (evolved && !still) {
    const k = (Math.sin(t / 220) + 1) / 2;
    g.fillStyle(color, 0.1 + 0.12 * k).fillEllipse(x, y - 14, 46, 46);
  }
}

/** Anillo de alcance de píxeles, con un brillo que da vueltas. Rojo si no se puede colocar. */
export function drawRange(g: G, x: number, y: number, r: number, ok: boolean, t: number) {
  const c = ok ? 0xffffff : 0xff5a4a;
  g.fillStyle(ok ? 0xffffff : 0xff5a4a, 0.08).fillCircle(x, y, r);
  const n = Math.max(24, Math.round((r * Math.PI * 2) / (P * 3)));
  const head = lowFx() ? -1 : Math.floor((t / 30) % n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const near = head >= 0 && (i - head + n) % n < 4;
    px(g, near ? 0xffd34d : c, x + Math.cos(a) * r, y + Math.sin(a) * r, P, P, near ? 1 : 0.6);
  }
}

/** Cursor de casilla (teclado y mando): esquinas que laten. */
export function drawCursor(g: G, x: number, y: number, s: number, color: number, t: number) {
  const k = lowFx() ? 0 : Math.round((Math.sin(t / 140) + 1) * 1.5);
  const L = P * 4;
  g.fillStyle(OUT, 1);
  const corners: [number, number, number, number][] = [[x - k, y - k, 1, 1], [x + s + k, y - k, -1, 1], [x - k, y + s + k, 1, -1], [x + s + k, y + s + k, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    g.fillStyle(OUT, 1).fillRect(Math.min(cx, cx + sx * L) - 1, Math.min(cy, cy + sy * P) - 1, L + 2, P + 2);
    g.fillRect(Math.min(cx, cx + sx * P) - 1, Math.min(cy, cy + sy * L) - 1, P + 2, L + 2);
    g.fillStyle(color, 1).fillRect(Math.min(cx, cx + sx * L), Math.min(cy, cy + sy * P), L, P);
    g.fillRect(Math.min(cx, cx + sx * P), Math.min(cy, cy + sy * L), P, L);
  }
}

/** Botón cuadrado de habilidad con su enfriamiento: se va llenando de abajo arriba en escalones de píxel. */
export function drawAbilityFrame(g: G, x: number, y: number, s: number, color: number, ready: number, focused: boolean, t: number) {
  g.fillStyle(OUT, 1).fillRect(x - 2, y - 2, s + 4, s + 4);
  g.fillStyle(darkOf(darkOf(color)), 1).fillRect(x, y, s, s);
  const fill = Math.floor((s * Math.min(1, ready)) / P) * P;
  g.fillStyle(darkOf(color), 1).fillRect(x, y + s - fill, s, fill);
  if (ready >= 1) {
    g.fillStyle(color, 1).fillRect(x, y, s, s);
    g.fillStyle(lightOf(color), 1).fillRect(x, y, s, P);
    if (!lowFx()) {
      // Destello que recorre el borde cuando está lista
      const per = s * 4;
      const p = (t / 6) % per;
      const pos = (q: number): [number, number] => (q < s ? [x + q, y] : q < 2 * s ? [x + s - P, y + q - s] : q < 3 * s ? [x + 3 * s - q, y + s - P] : [x, y + 4 * s - q]);
      const [hx, hy] = pos(p);
      g.fillStyle(0xffffff, 1).fillRect(hx, hy, P, P);
    }
  }
  g.fillStyle(darkOf(color), 1).fillRect(x, y + s - P, s, P);
  if (focused) g.lineStyle(3, 0xffffff, 1).strokeRect(x - 4, y - 4, s + 8, s + 8);
}

/** Barra de vida con borde y brillo (los enemigos y la base). */
export function drawBar(g: G, x: number, y: number, w: number, h: number, ratio: number, color: number, back = 0x2a2a3a) {
  g.fillStyle(OUT, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(back, 1).fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, ratio)) * w;
  g.fillStyle(color, 1).fillRect(x, y, f, h);
  if (h >= 4) g.fillStyle(lightOf(color), 1).fillRect(x, y, f, 1);
}

/** Miniatura de un mapa para el menú: suelo, camino y base. */
export function drawMapThumb(g: G, map: TdMap, colors: BiomeColors, x: number, y: number, cell: number, locked: boolean) {
  const look = pathLook(map.biome);
  g.fillStyle(locked ? 0x40444c : colors.floor, 1).fillRect(x, y, cell * 16, cell * 11);
  g.fillStyle(locked ? 0x30343a : darkOf(colors.floor), 0.5);
  for (let i = 0; i < 16; i += 2) g.fillRect(x + i * cell, y, cell, cell * 11);
  for (const p of map.paths) for (const c of pathCells(p)) g.fillStyle(locked ? 0x5a5e66 : look.fill, 1).fillRect(x + c.x * cell, y + c.y * cell, cell, cell);
  for (const b of map.blocked) g.fillStyle(locked ? 0x50545c : colors.rock, 1).fillRect(x + b.x * cell, y + b.y * cell, cell, cell);
  if (!locked) {
    const base = map.paths[0][map.paths[0].length - 1];
    g.fillStyle(0xe53935, 1).fillRect(x + base.x * cell - 1, y + base.y * cell - 1, cell + 2, cell + 2);
    for (const p of map.paths) g.fillStyle(0x2a1a4a, 1).fillRect(x + p[0].x * cell, y + p[0].y * cell, cell, cell);
  }
}

/** Confeti de píxeles (victoria): cae girando un rato. */
export function confetti(scene: Phaser.Scene, x0: number, x1: number, y: number, depth: number) {
  if (lowFx()) return;
  const colors = [0xffd34d, 0xe53935, 0x2e86de, 0x2ecc71, 0xff8ae0, 0xffffff];
  for (let i = 0; i < 46; i++) {
    const c = colors[i % colors.length];
    const r = scene.add.rectangle(Phaser.Math.Between(x0, x1), y - Phaser.Math.Between(0, 120), 6, 6, c).setDepth(depth);
    scene.tweens.add({
      targets: r, y: r.y + Phaser.Math.Between(380, 560), angle: Phaser.Math.Between(-360, 360), x: r.x + Phaser.Math.Between(-60, 60),
      alpha: 0, duration: Phaser.Math.Between(1600, 2600), delay: Phaser.Math.Between(0, 500), ease: 'Sine.easeIn', onComplete: () => r.destroy(),
    });
  }
}
