// Arte de la Defensa de torres: camino de cada mapa con huellas que avanzan hacia la base, baldosas de colocación,
// decoración animada por bioma, portales de entrada que giran, la base (un refugio de curación con el estilo del
// bioma), pedestales de las torres con su rareza y nivel, aura de evolución, anillo de alcance, iconos de las
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
  cumbre: { edge: 0x2e2050, fill: 0x8270b0, speck: 0xf0b8d8 },
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
  ball: {
    pal: { k: OUT, R: 0xe53935, L: 0xff8a80, W: 0xffffff, G: 0xc8ccd4 },
    rows: ['...kkkkkk...', '..kRRRRRRk..', '.kRLRRRRRRk.', 'kRLRRRRRRRRk', 'kRRRRkkRRRRk', 'kkkkkWWkkkkk', 'kWWWkWWkWWWk', 'kWWWWkkWWWGk', 'kGWWWWWWWWGk', '.kGWWWWWWGk.', '..kGGGGGGk..', '...kkkkkk...'],
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

/** Acabado del camino de cada bioma: textura que se pinta encima del relleno. */
type RoadKind = 'tierra' | 'roca' | 'arena' | 'lava' | 'losas' | 'adoquin' | 'nieve' | 'barro' | 'cristal';
const ROAD_KIND: Record<string, RoadKind> = {
  bosque: 'tierra', cueva: 'roca', mar: 'arena', volcan: 'lava', torre: 'losas',
  ciudad: 'adoquin', nieve: 'nieve', pantano: 'barro', cumbre: 'cristal',
};

/** Camino (fijo, se hornea a textura una vez): sombra, bordillo con relieve y esquinas redondeadas, textura del
 *  bioma, marcas de dirección suaves y la boca de cueva por donde salen los enemigos. */
export function drawRoad(g: G, map: TdMap, biome: string, geo: MapGeom) {
  const look = pathLook(biome);
  const kind = ROAD_KIND[biome] ?? 'tierra';
  const road = new Set<string>();
  for (const p of map.paths) for (const c of pathCells(p)) road.add(`${c.x},${c.y}`);
  const has = (x: number, y: number) => road.has(`${x},${y}`);
  const cellsOf = [...road].map((k) => k.split(',').map(Number) as [number, number]);
  const r = rng(map.tier * 977 + 13);
  const S = geo.cell;
  const m = P * 2;
  const XY = (x: number, y: number) => [geo.ox + x * S, geo.oy + y * S] as const;
  // 1) Sombra proyectada abajo a la derecha
  for (const [x, y] of cellsOf) {
    const [X, Y] = XY(x, y);
    g.fillStyle(0x000000, 0.22).fillRect(X + P, Y + P * 2, S, S);
  }
  // 2) Bordillo: celda entera con las esquinas exteriores recortadas (curva de 2 píxeles)
  for (const [x, y] of cellsOf) {
    const [X, Y] = XY(x, y);
    const L = has(x - 1, y), R = has(x + 1, y), U = has(x, y - 1), D = has(x, y + 1);
    g.fillStyle(look.edge, 1).fillRect(X, Y, S, S);
    const corner = (cx: number, cy: number, sx: number, sy: number) => {
      g.fillStyle(darkOf(look.edge), 1).fillRect(cx, cy, P * sx, P * sy);
    };
    if (!L && !U) corner(X, Y, 1, 1);
    if (!R && !U) corner(X + S - P, Y, 1, 1);
    if (!L && !D) corner(X, Y + S - P, 1, 1);
    if (!R && !D) corner(X + S - P, Y + S - P, 1, 1);
  }
  // 3) Relleno unido con los vecinos, con biselado (luz arriba/izquierda, sombra abajo/derecha)
  const fill = look.fill;
  const hi = lightOf(fill);
  const lo = darkOf(fill);
  for (const [x, y] of cellsOf) {
    const [X, Y] = XY(x, y);
    const l = has(x - 1, y) ? 0 : m;
    const rr = has(x + 1, y) ? 0 : m;
    const t = has(x, y - 1) ? 0 : m;
    const b = has(x, y + 1) ? 0 : m;
    g.fillStyle(fill, 1).fillRect(X + l, Y + t, S - l - rr, S - t - b);
    if (t) g.fillStyle(hi, 1).fillRect(X + l, Y + t, S - l - rr, P);
    if (l) g.fillStyle(hi, 0.7).fillRect(X + l, Y + t, P, S - t - b);
    if (b) g.fillStyle(lo, 1).fillRect(X + l, Y + S - b - P, S - l - rr, P);
    if (rr) g.fillStyle(lo, 0.7).fillRect(X + S - rr - P, Y + t, P, S - t - b);
    // Esquinas interiores (giro del camino): muesca de bordillo en diagonal para que la curva sea suave
    const inner = (dx: number, dy: number) => {
      if (!has(x + dx, y) || !has(x, y + dy) || has(x + dx, y + dy)) return;
      const cx = dx < 0 ? X : X + S - m;
      const cy = dy < 0 ? Y : Y + S - m;
      g.fillStyle(look.edge, 1).fillRect(cx, cy, m, m);
      g.fillStyle(dy < 0 ? hi : lo, 1).fillRect(dx < 0 ? cx + m - P : cx, cy, P, m);
    };
    inner(-1, -1); inner(1, -1); inner(-1, 1); inner(1, 1);
    // Esquinas exteriores redondeadas por dentro
    if (l && t) px(g, look.edge, X + l, Y + t);
    if (rr && t) px(g, look.edge, X + S - rr - P, Y + t);
    if (l && b) px(g, look.edge, X + l, Y + S - b - P);
    if (rr && b) px(g, look.edge, X + S - rr - P, Y + S - b - P);
    roadTexture(g, kind, look, X, Y, S, l, t, rr, b, r, x, y);
  }
  // 4) Marcas de dirección: chevrones grabados cada pocas casillas
  for (const p of map.paths) {
    const cells = pathCells(p);
    for (let i = 2; i < cells.length - 2; i += 3) {
      const a = cells[i];
      const n = cells[i + 1];
      const dx = n.x - a.x;
      const dy = n.y - a.y;
      const [X, Y] = XY(a.x, a.y);
      chevron(g, X + S / 2, Y + S / 2, dx, dy, mixColor(lo, look.edge, 0.4), 0.55);
    }
  }
  // 5) Boca de cueva en cada entrada
  for (const p of map.paths) {
    const cells = pathCells(p);
    const a = cells[0];
    const n = cells[1] ?? a;
    const [X, Y] = XY(a.x, a.y);
    drawCaveMouth(g, X + S / 2, Y + S / 2, a.x - n.x, a.y - n.y, biome, look);
  }
}

function chevron(g: G, cx: number, cy: number, dx: number, dy: number, c: number, a: number) {
  for (let k = -2; k <= 2; k++) {
    const back = Math.abs(k) * P;
    const bx = cx + dx * (P * 2 - back) - dy * k * P;
    const by = cy + dy * (P * 2 - back) + dx * k * P;
    px(g, c, bx - P / 2, by - P / 2, P, P, a);
    px(g, c, bx - P / 2 - dx * P, by - P / 2 - dy * P, P, P, a * 0.6);
  }
}

function roadTexture(g: G, kind: RoadKind, look: { edge: number; fill: number; speck: number }, X: number, Y: number, S: number,
  l: number, t: number, rr: number, b: number, r: () => number, cx: number, cy: number) {
  const x0 = X + Math.max(l, P) + P;
  const y0 = Y + Math.max(t, P) + P;
  const w = S - Math.max(l, P) - Math.max(rr, P) - P * 3;
  const h = S - Math.max(t, P) - Math.max(b, P) - P * 3;
  const rx = () => x0 + r() * w;
  const ry = () => y0 + r() * h;
  const lo = darkOf(look.fill);
  const hi = lightOf(look.fill);
  const stone = (sx: number, sy: number, c: number) => {
    px(g, darkOf(c), sx, sy + P, P * 2, P);
    px(g, c, sx, sy, P * 2, P);
    px(g, lightOf(c), sx, sy, P, P);
  };
  switch (kind) {
    case 'tierra':
      for (let i = 0; i < 3; i++) stone(rx(), ry(), look.speck);
      for (let i = 0; i < 3; i++) px(g, lo, rx(), ry());
      // Matojos de hierba que invaden el bordillo
      if (t && r() < 0.5) { px(g, 0x4a9a3a, X + S / 2 + (r() - 0.5) * S * 0.6, Y + t - P); px(g, 0x6ac04a, X + S / 2, Y + t - P * 2); }
      if (b && r() < 0.5) px(g, 0x4a9a3a, X + S / 2 + (r() - 0.5) * S * 0.6, Y + S - b);
      // Huellas de ruedas
      if ((cx + cy) % 2 === 0) { px(g, lo, x0 + P, y0 + h / 2, P * 2, P, 0.5); px(g, lo, x0 + w - P * 3, y0 + h / 2, P * 2, P, 0.5); }
      break;
    case 'roca':
      for (let i = 0; i < 2; i++) stone(rx(), ry(), look.speck);
      { const sx = rx(); const sy = ry(); px(g, darkOf(lo), sx, sy); px(g, darkOf(lo), sx + P, sy + P); px(g, darkOf(lo), sx + P * 2, sy + P); }
      break;
    case 'arena':
      for (let i = 0; i < 2; i++) { const sy = ry(); const sx = rx(); px(g, look.speck, sx - P * 2, sy, P * 3, P); px(g, look.speck, sx + P, sy - P, P * 2, P); }
      if (r() < 0.35) { const sx = rx(); const sy = ry(); px(g, 0xffb0a0, sx, sy, P * 2, P); px(g, 0xffffff, sx, sy - P); }
      px(g, hi, rx(), ry());
      break;
    case 'lava': {
      // Roca negra con grietas de lava (brillo estático; el calor ya lo animan las huellas)
      const sx = rx(); const sy = ry();
      px(g, 0xff5a1a, sx, sy, P * 2, P); px(g, 0xffc040, sx + P, sy); px(g, 0xff5a1a, sx + P * 2, sy + P, P * 2, P); px(g, 0xb02a10, sx + P * 4, sy + P * 2);
      stone(rx(), ry(), lightOf(look.fill));
      break;
    }
    case 'losas': {
      const mid = X + S / 2;
      g.fillStyle(lo, 0.8).fillRect(mid - P / 2, Y + t, P, S - t - b).fillRect(X + l, Y + S / 2 - P / 2, S - l - rr, P);
      px(g, hi, X + l + P, Y + t + P, P * 2, P); px(g, hi, mid + P, Y + S / 2 + P, P * 2, P);
      if (r() < 0.4) px(g, 0x9affd0, rx(), ry(), P, P, 0.7);
      break;
    }
    case 'adoquin':
      for (let row = 0; row < 4; row++) {
        const yy = Y + t + row * (S / 4);
        if (yy + P > Y + S - b) break;
        g.fillStyle(lo, 0.6).fillRect(X + l, yy, S - l - rr, 1);
        for (let col = 0; col < 3; col++) {
          const xx = X + l + ((col + (row % 2) * 0.5) * (S / 3));
          if (xx < X + S - rr) g.fillStyle(lo, 0.6).fillRect(Math.round(xx), yy, 1, S / 4);
        }
      }
      if ((cx + cy) % 2 === 0) px(g, look.speck, X + S / 2 - P, Y + S / 2 - P / 2, P * 3, P, 0.8);
      break;
    case 'nieve':
      // Pisadas en la nieve y brillos de hielo
      px(g, lo, x0 + w * 0.3, y0 + h * 0.3, P, P * 2, 0.6); px(g, lo, x0 + w * 0.6, y0 + h * 0.6, P, P * 2, 0.6);
      px(g, 0xffffff, rx(), ry()); px(g, 0xffffff, rx(), ry());
      if (r() < 0.4) px(g, 0x9ad8ff, rx(), ry(), P * 2, P);
      break;
    case 'barro':
      { const sx = rx(); const sy = ry(); g.fillStyle(darkOf(look.fill), 1).fillRect(snap(sx), snap(sy), P * 4, P * 2); px(g, 0x8ab0a0, sx + P, sy, P * 2, P, 0.8); }
      px(g, look.speck, rx(), ry(), P * 2, P);
      break;
    case 'cristal':
      for (let i = 0; i < 2; i++) { const sx = rx(); const sy = ry(); px(g, look.speck, sx, sy); px(g, 0xffffff, sx, sy - P); px(g, look.speck, sx, sy - P * 2, P, P, 0.5); }
      px(g, hi, rx(), ry(), P * 2, P);
      break;
  }
}

/** Boca de cueva (u otra entrada según el bioma) detrás del portal. dx/dy: hacia fuera del camino. */
function drawCaveMouth(g: G, cx: number, cy: number, dx: number, dy: number, biome: string, look: { edge: number; fill: number }) {
  const rock = biome === 'nieve' ? 0x8aa4c0 : biome === 'volcan' ? 0x3a2420 : biome === 'ciudad' ? 0x50545e : biome === 'mar' ? 0x6a8aa0 : biome === 'torre' ? 0x3a3054 : darkOf(look.edge);
  const ox = cx + dx * 10;
  const oy = cy + dy * 10 - 4;
  // Rocas alrededor
  const ring = [[-18, 0], [-15, -9], [-9, -15], [0, -17], [9, -15], [15, -9], [18, 0], [-18, 8], [18, 8]];
  for (const [rx, ry] of ring) {
    px(g, darkOf(rock), ox + rx - P, oy + ry, P * 3, P * 3);
    px(g, rock, ox + rx - P, oy + ry - P, P * 3, P * 2);
    px(g, lightOf(rock), ox + rx - P, oy + ry - P, P, P);
  }
  if (biome === 'nieve') { px(g, 0xffffff, ox - 12, oy - 18, P * 3, P); px(g, 0xffffff, ox + 3, oy - 20, P * 4, P); }
  // Hueco oscuro con degradado
  g.fillStyle(0x0c0818, 0.9).fillEllipse(ox, oy + 2, 30, 26);
  g.fillStyle(0x000000, 0.9).fillEllipse(ox, oy + 4, 20, 16);
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

/** Aspecto de la base según el bioma (genérico: un refugio con cruz de curación, sin marcas). */
interface BaseLook { roof: number; wall: number; trim: number; flag: number; snow?: boolean; stone?: boolean }
const BASE_LOOK: Record<string, BaseLook> = {
  bosque: { roof: 0xe04a3a, wall: 0xf4f0e8, trim: 0xb07a48, flag: 0x4cd964 },
  cueva: { roof: 0x8a5a34, wall: 0xe8dcc4, trim: 0x6a4428, flag: 0xffb347 },
  mar: { roof: 0x2a8ad8, wall: 0xfaf4e4, trim: 0xe8c890, flag: 0xffffff },
  volcan: { roof: 0x3a2a2a, wall: 0x8a7a70, trim: 0xff7a2a, flag: 0xff5a1a, stone: true },
  torre: { roof: 0x6a4aa8, wall: 0xd8d0e8, trim: 0x4a3a6a, flag: 0x9affd0, stone: true },
  ciudad: { roof: 0x505868, wall: 0xe6e8ee, trim: 0xf0d050, flag: 0xf0d050 },
  nieve: { roof: 0x3a6ab0, wall: 0xf0f4fa, trim: 0x8aa4c0, flag: 0xff5a5a, snow: true },
  pantano: { roof: 0x4a7a3a, wall: 0xe0dcc0, trim: 0x6a5a34, flag: 0xd8f080 },
  cumbre: { roof: 0xd86aa8, wall: 0xf8f0ff, trim: 0x8270b0, flag: 0xffd34d },
};

/** La base: un refugio de curación con tejado del bioma, cartel con cruz, ventanas que parpadean, puerta que late,
 *  bandera ondeando y barra de vida integrada. Al perder vida salen grietas, humo y las luces fallan. */
export function drawBase(g: G, x: number, y: number, t: number, hpRatio: number, hitFlash = 0, biome = 'bosque') {
  const L = BASE_LOOK[biome] ?? BASE_LOOK.bosque;
  const still = lowFx();
  const hp = Math.max(0, Math.min(1, hpRatio));
  const pulse = still ? 0.5 : (Math.sin(t / 300) + 1) / 2;
  const glow = hp > 0.5 ? 0x7cf07a : hp > 0.25 ? 0xffd34d : 0xff5a4a;
  const shake = !still && hitFlash > 0 ? Math.round(Math.sin(t / 20) * 1) : 0;
  const W = 48;
  const X = snap(x - W / 2) + shake;
  const Y = snap(y - 30);
  // Halo y sombra en el suelo
  g.fillStyle(glow, 0.1 + 0.12 * pulse).fillEllipse(x, y + 16, 84 + pulse * 8, 28);
  g.fillStyle(0x000000, 0.3).fillEllipse(x + 3, y + 18, 60, 14);
  // Escalón / cimientos
  g.fillStyle(OUT, 1).fillRect(X - P * 2, Y + 42, W + P * 4, P * 3);
  g.fillStyle(L.stone ? 0x5a5260 : 0xb8b0a4, 1).fillRect(X - P, Y + 42, W + P * 2, P * 2);
  g.fillStyle(0xd8d0c4, 1).fillRect(X - P, Y + 42, W + P * 2, P);
  // Cuerpo
  const wall = hitFlash > 0 ? 0xffffff : L.wall;
  g.fillStyle(OUT, 1).fillRect(X - P, Y + 14, W + P * 2, 30);
  g.fillStyle(wall, 1).fillRect(X, Y + 15, W, 27);
  g.fillStyle(darkOf(wall), 1).fillRect(X, Y + 36, W, 6);
  g.fillStyle(darkOf(wall), 0.5).fillRect(X + W - P, Y + 15, P, 21);
  if (L.stone) for (let i = 0; i < 4; i++) g.fillStyle(darkOf(wall), 0.6).fillRect(X + 3 + i * 12, Y + 24 + (i % 2) * 6, 8, 1);
  g.fillStyle(L.trim, 1).fillRect(X, Y + 33, W, P);
  // Tejado a dos niveles con alero y luz
  g.fillStyle(OUT, 1).fillRect(X - P * 3, Y + 6, W + P * 6, 12);
  g.fillStyle(L.roof, 1).fillRect(X - P * 2, Y + 8, W + P * 4, 7);
  g.fillStyle(lightOf(L.roof), 1).fillRect(X - P * 2, Y + 8, W + P * 4, P);
  g.fillStyle(darkOf(L.roof), 1).fillRect(X - P * 2, Y + 15 - P, W + P * 4, P);
  g.fillStyle(OUT, 1).fillRect(X + 6, Y, W - 12, 9);
  g.fillStyle(L.roof, 1).fillRect(X + 6 + P, Y + P, W - 12 - P * 2, 6);
  g.fillStyle(lightOf(L.roof), 1).fillRect(X + 6 + P, Y + P, W - 12 - P * 2, P);
  if (L.snow) {
    g.fillStyle(0xffffff, 1).fillRect(X - P * 2, Y + 6, W + P * 4, P).fillRect(X + 6, Y - 1, W - 12, P);
    for (let i = 0; i < 6; i++) px(g, 0xffffff, X - P + i * 9, Y + 9);
  }
  // Ventanas (parpadean de forma desigual; con poca vida fallan)
  const flick = (k: number) => {
    if (still) return 0.6;
    if (hp < 0.25 && Math.sin(t / 37 + k * 5) > 0.6) return 0.1;
    return 0.5 + 0.5 * Math.abs(Math.sin(t / (700 + k * 230) + k));
  };
  for (const [k, wx] of [[0, X + 4], [1, X + W - 13]] as const) {
    g.fillStyle(OUT, 1).fillRect(wx, Y + 19, 9, 9);
    g.fillStyle(mixColor(0x3a4a6a, 0xffe08a, flick(k)), 1).fillRect(wx + 1, Y + 20, 7, 7);
    g.fillStyle(OUT, 1).fillRect(wx + 4, Y + 20, 1, 7).fillRect(wx + 1, Y + 23, 7, 1);
    g.fillStyle(L.trim, 1).fillRect(wx - 1, Y + 28, 11, 2);
  }
  // Puerta automática que late
  const dx = X + W / 2 - 7;
  g.fillStyle(OUT, 1).fillRect(dx, Y + 26, 14, 16);
  g.fillStyle(mixColor(0x6ab8f0, 0xffffff, pulse * 0.55), 1).fillRect(dx + 1, Y + 27, 12, 15);
  g.fillStyle(OUT, 0.6).fillRect(dx + 7, Y + 27, 1, 15);
  g.fillStyle(0xffffff, 0.6).fillRect(dx + 2, Y + 28, 2, 6);
  // Cartel con la cruz de curación (luz que late)
  const sx = X + W / 2;
  const sy = Y + 18;
  g.fillStyle(OUT, 1).fillRect(sx - 7, sy - 6, 14, 10);
  g.fillStyle(0xffffff, 1).fillRect(sx - 6, sy - 5, 12, 8);
  const cross = mixColor(0xff4a5a, 0xffb0b8, pulse * 0.6);
  g.fillStyle(cross, 1).fillRect(sx - 1, sy - 4, 3, 6).fillRect(sx - 4, sy - 2, 9, 2);
  // Farolillo del tejado
  const lamp = still ? glow : mixColor(glow, 0xffffff, pulse * 0.6);
  g.fillStyle(OUT, 1).fillRect(sx - 3, Y - 5, 6, 5);
  g.fillStyle(lamp, 1).fillRect(sx - 2, Y - 4, 4, 3);
  if (!still) g.fillStyle(lamp, 0.18 * pulse + 0.06).fillCircle(sx, Y - 3, 7);
  // Bandera ondeando
  const fx = X + W + P;
  g.fillStyle(OUT, 1).fillRect(fx, Y - 14, 2, 30);
  px(g, 0xffd34d, fx - 1, Y - 17, P, P);
  for (let i = 0; i < 5; i++) {
    const wv = still ? 0 : Math.round(Math.sin(t / 160 - i * 0.9) * 1.6);
    const c = i === 4 ? darkOf(L.flag) : L.flag;
    g.fillStyle(c, 1).fillRect(fx + 2 + i * 3, Y - 13 + wv, 3, 8);
    if (i < 3) g.fillStyle(lightOf(L.flag), 1).fillRect(fx + 2 + i * 3, Y - 13 + wv, 3, 1);
  }
  // Daño: grietas progresivas, cristal roto, humo y chispas
  const crack = (cx0: number, cy0: number, steps: number[][]) => {
    let cx = cx0, cy = cy0;
    for (const [ax, ay] of steps) { cx += ax; cy += ay; g.fillStyle(OUT, 0.85).fillRect(cx, cy, 2, 2); }
  };
  if (hp < 0.75) crack(X + 3, Y + 15, [[1, 2], [2, 2], [-1, 2], [1, 2], [2, 1]]);
  if (hp < 0.5) {
    crack(X + W - 6, Y + 15, [[-1, 2], [-2, 2], [1, 3], [-2, 2]]);
    g.fillStyle(OUT, 1).fillRect(X + W - 10, Y + 22, 3, 1);
    px(g, darkOf(L.roof), X + 12, Y + 9, P * 2, P); // teja caída
  }
  if (hp < 0.3) {
    crack(X + 18, Y + 30, [[2, 1], [2, -1], [2, 2], [2, 1]]);
    g.fillStyle(0x3a3a3a, 0.8).fillRect(X - P, Y + 10, P * 2, P);
  }
  if (hp < 0.6 && !still) {
    const n = hp < 0.3 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const k = ((t / 1400 + i / n) % 1);
      const sxx = X + 10 + (i % 2) * 22 + Math.sin(t / 300 + i) * 3 + k * 6;
      const syy = Y + 4 - k * 26;
      const s = P * (1 + Math.floor(k * 2));
      g.fillStyle(hp < 0.3 ? 0x3a3a3e : 0x8a8a90, 0.55 * (1 - k)).fillRect(snap(sxx), snap(syy), s, s);
    }
    if (hp < 0.3 && Math.sin(t / 90) > 0.85) px(g, 0xffc040, X + 20, Y + 10);
  } else if (hp < 0.6) {
    g.fillStyle(0x8a8a90, 0.5).fillRect(X + 12, Y - 4, P * 2, P * 2);
  }
  // Barra de vida integrada (placa bajo los cimientos)
  const bw = 54;
  const bx = snap(x - bw / 2);
  const by = Y + 50;
  g.fillStyle(OUT, 1).fillRect(bx - 2, by - 2, bw + 4, 8);
  g.fillStyle(0x2a2a3a, 1).fillRect(bx, by, bw, 4);
  const fw = Math.round(bw * hp);
  if (fw > 0) {
    g.fillStyle(glow, 1).fillRect(bx, by, fw, 4);
    g.fillStyle(lightOf(glow), 1).fillRect(bx, by, fw, 1);
    g.fillStyle(darkOf(glow), 1).fillRect(bx, by + 3, fw, 1);
  }
  for (let i = 1; i < 4; i++) g.fillStyle(OUT, 0.5).fillRect(bx + (bw * i) / 4, by, 1, 4);
  if (hitFlash > 0) g.fillStyle(0xffffff, Math.min(0.6, hitFlash / 400)).fillRect(bx, by, bw, 4);
}

/** Hornea un Graphics fijo a una textura (una vez por mapa) y lo sustituye por una imagen. */
export function bakeLayer(scene: Phaser.Scene, g: G, x: number, y: number, w: number, h: number, depth: number) {
  const rt = scene.add.renderTexture(x, y, w, h).setOrigin(0).setDepth(depth);
  rt.draw(g, -x, -y);
  g.destroy();
  return rt;
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
