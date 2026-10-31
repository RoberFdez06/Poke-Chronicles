// Decorado de las salas por bioma (supervisor), al estilo de las rutas de Pokémon GBA:
//  - fuera de la sala, el paisaje del bioma (copas de árboles, rocas, agua, tejados…) en vez de vacío;
//  - en el suelo, manchas de color y detalles sueltos (flores, matojos, piedrecitas, conchas, cristales…);
//  - sombra de la pared sobre el suelo para dar profundidad.
// Todo es dibujo: no choca con nada. Se repite igual en cada visita a la sala (semilla por sala).
import Phaser from 'phaser';
import { shade, TILE, type BiomeLook } from './tiles';
import { lowFx } from '../theme';

type G = Phaser.GameObjects.Graphics;

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

/** Luminosidad (0-1) de un color. */
const mixC = (a: number, c: number, t: number) => {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((c >> sh) & 255) * t) << sh;
  return ch(16) | ch(8) | ch(0);
};
const lum = (c: number) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;

/** Detalles 8x8: '.' vacío; letras = colores de su paleta. */
interface Decal { rows: string[]; pal: Record<string, number> }
const K = 0x18202c;
const FLOWER_R: Decal = { rows: ['........', '...rr...', '..rWWr..', '..rWWr..', '...rr...', '...g....', '..gg....', '........'], pal: { r: 0xe8483a, W: 0xffe066, g: 0x2f8a3a } };
const FLOWER_Y: Decal = { rows: ['........', '..y..y..', '...yy...', '..yOOy..', '...yy...', '..y.gy..', '....g...', '........'], pal: { y: 0xffe066, O: 0xe08a20, g: 0x2f8a3a } };
const TUFT: Decal = { rows: ['........', '........', '.g...g..', '.gg.gg..', '..gGg.g.', '.gGgGgg.', '........', '........'], pal: { g: 0x2f7a2a, G: 0x58b848 } };
const PEBBLE_ROWS = ['........', '........', '...ddd..', '..dWRRd.', '..dRRrd.', '..drrrd.', '...ddd..', '........'];
const PEBBLE: Decal = { rows: PEBBLE_ROWS, pal: { d: 0x5e544a, R: 0x9a8a7a, r: 0x7a6c5e, W: 0xd8ccb8 } };
// Piedrecitas del color de cada sitio: gris azulado en la nieve, basalto en el volcán, lila en la cumbre
const PEBBLE_ICE: Decal = { rows: PEBBLE_ROWS, pal: { d: 0x5a6a7c, R: 0x9aa8b8, r: 0x7a8898, W: 0xe8f0f8 } };
const PEBBLE_BASALT: Decal = { rows: PEBBLE_ROWS, pal: { d: 0x1e1414, R: 0x4a3a38, r: 0x34282a, W: 0x7a6662 } };
const PEBBLE_LILAC: Decal = { rows: PEBBLE_ROWS, pal: { d: 0x4a3a6a, R: 0x8a7aae, r: 0x6a5a8e, W: 0xd8ccf0 } };
const CRYSTAL: Decal = { rows: ['....k...', '...kCk..', '..kCWk..', '..kCCk.k', '.k.kCkkC', 'kCk.kkCC', 'kCCkkCCk', '.kkkkkk.'], pal: { k: K, C: 0x8fd8ff, W: 0xffffff } };
const SHELL: Decal = { rows: ['........', '...kkk..', '..kPWPk.', '.kPpPpPk', '.kPpPpPk', '..kPPPk.', '...kkk..', '........'], pal: { k: K, P: 0xf4b8c8, p: 0xd88aa0, W: 0xffffff } };
const STAR: Decal = { rows: ['...k....', '..kOk...', 'kkkOOkkk', 'kOOOOOOk', '.kOOOOk.', '.kOkkOk.', 'kOk..kOk', 'kk....kk'], pal: { k: K, O: 0xf08a3a } };
const EMBER: Decal = { rows: ['........', '..k..k..', '.kRk.kk.', '..kOk...', '.kOYOk..', '..kOk.k.', '...k.kRk', '......k.'], pal: { k: 0x3a1a14, R: 0xe0402a, O: 0xffa030, Y: 0xffe066 } };
const CRACK: Decal = { rows: ['........', '..k.....', '...k....', '...kk...', '.....k..', '....k.k.', '...k...k', '........'], pal: { k: 0x00000 } };
const SNOWPILE: Decal = { rows: ['........', '........', '...WW...', '..WWWW..', '.WWWWBW.', 'WWWWBBWW', 'BBBBBBBB', '........'], pal: { W: 0xffffff, B: 0xb8d0e4 } };
const MUSHROOM: Decal = { rows: ['........', '..kkkk..', '.kRWRRk.', 'kRRRRWRk', 'kkkkkkkk', '...kWk..', '...kWk..', '...kkk..'], pal: { k: K, R: 0xc8402a, W: 0xffffff } };
const LILY: Decal = { rows: ['........', '..kkkk..', '.kGGgGk.', 'kGGGG.Gk', 'kGgGG..k', '.kGGGGk.', '..kkkk..', '........'], pal: { k: 0x1d3a1a, G: 0x58b848, g: 0x2f7a2a } };
// Hojas secas de arce (con puntas, nervio y rabito; antes era un palito naranja que parecía una zanahoria)
const LEAF_ROWS = ['...k....', '.k.Ok.k.', 'kOkOOkOk', '.kOOvOk.', 'kOOOvOOk', '.kkkvkk.', '....v...', '....v...'];
const LEAF: Decal = { rows: LEAF_ROWS, pal: { k: 0x6a2e12, O: 0xe08a3a, v: 0xb05a20 } };
const LEAF_Y: Decal = { rows: LEAF_ROWS, pal: { k: 0x6a4a12, O: 0xe0b848, v: 0xb08a28 } };
const RUNE: Decal = { rows: ['..PPPP..', '.P....P.', 'P..PP..P', 'P.P..P.P', 'P.P..P.P', 'P..PP..P', '.P....P.', '..PPPP..'], pal: { P: 0x8a6fc8 } };

/** Detalles que a tamaño entero parecen un obstáculo (y no lo son): ver decorateRoom. */
const SOLID_LOOKING: ReadonlySet<Decal> = new Set([PEBBLE, PEBBLE_ICE, PEBBLE_BASALT, PEBBLE_LILAC, CRYSTAL, SNOWPILE]);

const DECALS: Record<string, Decal[]> = {
  bosque: [FLOWER_R, FLOWER_Y, TUFT, TUFT, TUFT, PEBBLE],
  pantano: [MUSHROOM, LILY, TUFT, TUFT, PEBBLE],
  cueva: [PEBBLE, PEBBLE, CRYSTAL, CRACK],
  volcan: [EMBER, EMBER, PEBBLE_BASALT, CRACK],
  mar: [SHELL, STAR, SHELL],
  torre: [RUNE, CRACK, CRACK],
  ciudad: [LEAF, LEAF_Y, CRACK, TUFT],
  nieve: [SNOWPILE, SNOWPILE, PEBBLE_ICE, CRACK],
  cumbre: [PEBBLE_LILAC, TUFT, FLOWER_Y, CRYSTAL],
};

/** Qué hay fuera de la sala en cada bioma. */
type Outside = 'trees' | 'pines' | 'swamp' | 'rocks' | 'lava' | 'water' | 'roofs' | 'stars';
const OUTSIDE: Record<string, Outside> = {
  bosque: 'trees', pantano: 'swamp', nieve: 'pines', cueva: 'rocks', cumbre: 'rocks', volcan: 'lava', mar: 'water', ciudad: 'roofs', torre: 'stars',
};

/** Lado de la textura del paisaje de fuera (se repite cada 192 px en pantalla). */
const OUT_TEX = 64;

/** Paisaje de fuera (64x64, se repite): copas, pinos nevados, rocas, lava, olas, tejados o cielo. */
function drawOutside(g: G, b: BiomeLook, kind: Outside) {
  const S = OUT_TEX;
  const w = b.colors.wall;
  const r = rng(kind.length * 977 + b.id.charCodeAt(0));
  const fill = (c: number) => g.fillStyle(c, 1).fillRect(0, 0, S, S);
  // Cada forma se dibuja también desplazada S para que la textura se repita sin cortes
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
  };
  const blob = (x: number, y: number, rad: number, base: number, top: number, hi?: number) =>
    wrap((ox, oy) => {
      g.fillStyle(K, 1).fillCircle(x + ox, y + oy + 1, rad + 1);
      g.fillStyle(shade(base, -0.25), 1).fillCircle(x + ox, y + oy, rad);
      g.fillStyle(base, 1).fillCircle(x + ox - 1, y + oy - 1, rad - 1);
      g.fillStyle(top, 1).fillCircle(x + ox - rad * 0.3, y + oy - rad * 0.35, rad * 0.45);
      if (hi !== undefined) g.fillStyle(hi, 1).fillRect(x + ox - rad * 0.45, y + oy - rad * 0.55, 2, 2);
    });
  // Un píxel que da la vuelta por los bordes de la textura (para dibujar a mano píxel a píxel sin cortes)
  const dotW = (x: number, y: number, c: number, a = 1) =>
    g.fillStyle(c, a).fillRect((((Math.floor(x) % S) + S) % S), (((Math.floor(y) % S) + S) % S), 1, 1);
  // Trama 4x4 para pasar de un tono a otro sin escalón (como el sombreado a mano de las rocas de GBA)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /**
   * Peñasco natural: silueta abultada (radio con ruido de varias ondas, base aplastada contra el suelo), luz píxel a
   * píxel como una piedra redondeada (arriba a la izquierda), tonos tramados, grietas y motas. Nada de aristas rectas.
   */
  const boulder = (x: number, y: number, rw: number, rh: number, base: number, top: number, seed: number, moss?: number) => {
    const rr = rng(seed);
    const ph = [rr() * 6.28, rr() * 6.28, rr() * 6.28];
    const am = [0.07 + rr() * 0.05, 0.05 + rr() * 0.04, 0.03 + rr() * 0.02];
    const rad = (a: number) => 1 + am[0] * Math.sin(2 * a + ph[0]) + am[1] * Math.sin(3 * a + ph[1]) + am[2] * Math.sin(5 * a + ph[2]);
    const tones = [shade(base, -0.5), shade(base, -0.3), shade(base, -0.1), base, top, shade(top, 0.25)];
    const inside = (dx: number, dy: number) => dy < 0.62 && Math.hypot(dx, dy) < rad(Math.atan2(dy, dx));
    // Bultos sueltos en la superficie: la luz se tuerce un poco en cada uno
    const lumps = Array.from({ length: 3 }, () => [(rr() - 0.5) * 1.1, (rr() - 0.7) * 0.9, 0.25 + rr() * 0.2]);
    // Sombra en el suelo
    for (let yy = -2; yy <= 2; yy++) {
      const half = Math.round(rw * 1.05 * Math.sqrt(1 - (yy / 2.6) ** 2));
      for (let xx = -half; xx <= half; xx++) dotW(x + xx + 2, y + rh * 0.62 + yy + 1, 0x000000, 0.28);
    }
    const x0 = Math.floor(x - rw * 1.3);
    const y0 = Math.floor(y - rh * 1.3);
    for (let py = y0; py < y + rh * 1.3; py++) for (let px2 = x0; px2 < x + rw * 1.3; px2++) {
      const dx = (px2 + 0.5 - x) / rw;
      const dy = (py + 0.5 - y) / rh;
      if (!inside(dx, dy)) continue;
      const edge = !inside(dx + 1 / rw, dy) || !inside(dx - 1 / rw, dy) || !inside(dx, dy + 1 / rh) || !inside(dx, dy - 1 / rh);
      if (edge) {
        dotW(px2, py, K);
        continue;
      }
      // Normal de una piedra redondeada con bultos
      let nx = dx;
      let ny = dy;
      for (const [lx, ly, lr] of lumps) {
        const d = Math.hypot(dx - lx, dy - ly);
        if (d < lr) {
          nx += ((dx - lx) / lr) * 0.3;
          ny += ((dy - ly) / lr) * 0.3;
        }
      }
      const nz = Math.sqrt(Math.max(0.05, 1 - Math.min(1, nx * nx + ny * ny)));
      const l = (-0.55 * nx - 0.7 * ny + 0.5 * nz) / Math.hypot(nx, ny, nz);
      // La cara de abajo (la que toca el suelo) más oscura
      const v = (l + 0.3) * 3.6 - (dy > 0.35 ? (dy - 0.35) * 4 : 0);
      const i0 = Math.floor(v);
      const frac = v - i0;
      const idx = Math.max(0, Math.min(tones.length - 1, frac * 16 > BAYER[(py & 3) * 4 + (px2 & 3)] ? i0 + 1 : i0));
      let c = tones[idx];
      if (moss !== undefined && ny < -0.35 && rr() < 0.55) c = moss;
      dotW(px2, py, c);
    }
    // Grietas: una o dos líneas quebradas oscuras con su labio claro
    for (let n = 0; n < 2; n++) {
      let cx = x + (rr() - 0.5) * rw * 0.9;
      let cy = y - rh * 0.4 + rr() * rh * 0.3;
      for (let s = 0; s < 3 + Math.floor(rr() * 3); s++) {
        if (!inside((cx - x) / rw, (cy - y) / rh) || !inside((cx + 1 - x) / rw, (cy + 1 - y) / rh)) break;
        dotW(cx, cy, tones[0]);
        dotW(cx - 1, cy, tones[4]);
        cx += rr() < 0.5 ? 1 : 0;
        cy += 1;
      }
    }
    // Motas claras y oscuras
    for (let n = 0; n < (rw * rh) / 30; n++) {
      const mx = x + (rr() - 0.5) * rw * 1.4;
      const my = y + (rr() - 0.5) * rh * 1.2;
      if (inside((mx - x) / rw, (my - y) / rh) && inside((mx + 1 - x) / rw, (my + 1 - y) / rh)) dotW(mx, my, rr() < 0.5 ? tones[1] : tones[5]);
    }
  };
  /**
   * Racimo de cristales que salen de entre las rocas: prismas inclinados que se estrechan hacia una punta torcida, con
   * una cara clara, otra oscura y una veta de brillo. [inclinación (rad), alto, ancho, color, desplazamiento de la base]
   */
  const shards = (bx: number, y: number, list: [number, number, number, number, number][]) => {
    for (const [ang, sh, sw, c, off] of list) {
      const x = bx + off;
      const ux = Math.sin(ang);
      const uy = -Math.cos(ang);
      // Contorno: base ancha, hombros a 3/4 y punta descentrada
      const tipOff = ang > 0 ? 0.25 : -0.25;
      const prof = (t: number) => (t < 0.72 ? sw / 2 - t * sw * 0.08 : (sw / 2) * (1 - (t - 0.72) / 0.28) * 0.95);
      const local = (px2: number, py: number) => {
        const rx = px2 + 0.5 - x;
        const ry = py + 0.5 - y;
        const t = (rx * ux + ry * uy) / sh;
        const s = rx * -uy + ry * ux - (t > 0.72 ? tipOff * sw * ((t - 0.72) / 0.28) : 0);
        return { t, s, inside: t >= 0 && t <= 1 && Math.abs(s) <= prof(t) };
      };
      const lo = Math.floor(Math.min(x, x + ux * sh) - sw - 1);
      const hi = Math.ceil(Math.max(x, x + ux * sh) + sw + 1);
      for (let py = Math.floor(y - sh - 2); py <= y + 1; py++) for (let px2 = lo; px2 <= hi; px2++) {
        const p = local(px2, py);
        if (!p.inside) continue;
        const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b2]) => !local(px2 + a, py + b2).inside);
        if (out) {
          dotW(px2, py, K);
          continue;
        }
        // Cara izquierda clara, derecha oscura, veta blanca junto a la arista central
        const f = p.s / prof(p.t);
        let col = f < -0.15 ? shade(c, 0.35) : f > 0.25 ? shade(c, -0.3) : c;
        if (f > -0.15 && f < 0.05 && p.t > 0.15 && p.t < 0.8) col = shade(c, 0.6);
        if (p.t > 0.86 && f < 0.2) col = 0xffffff;
        dotW(px2, py, col);
      }
    }
    // Brillo en la punta del más alto
    const [ang0, sh0, , , off0] = list.reduce((m, s) => (s[1] > m[1] ? s : m), list[0]);
    dotW(bx + off0 + Math.sin(ang0) * (sh0 + 2), y - Math.cos(ang0) * (sh0 + 2), 0xffffff, 0.8);
  };
  switch (kind) {
    case 'trees':
    case 'swamp': {
      // Copas apretadas de varios tamaños y tonos, con sombra entre ellas
      const base = kind === 'swamp' ? 0x4a6a3a : 0x3a8a3a;
      const top = kind === 'swamp' ? 0x7a9a5a : 0x6ccf5a;
      fill(shade(base, -0.55));
      const spots: [number, number, number][] = [[10, 10, 11], [34, 6, 9], [54, 14, 10], [22, 30, 12], [46, 36, 11], [6, 46, 10], [30, 54, 10], [58, 56, 9], [0, 28, 7]];
      for (const [x, y, rad] of spots) {
        const t = r() < 0.3 ? 0.12 : r() < 0.5 ? -0.08 : 0;
        blob(x, y, rad, shade(base, t), shade(top, t), shade(top, 0.4));
      }
      if (kind === 'swamp') wrap((ox, oy) => g.fillStyle(0x6a5a8a, 0.8).fillRect(40 + ox, 22 + oy, 6, 2));
      else for (const [x, y] of [[14, 6], [50, 32]] as const) g.fillStyle(0xff7aa8, 1).fillRect(x, y, 2, 2);
      break;
    }
    case 'pines': {
      // Pinos nevados en hileras (triángulos con nieve en las ramas) sobre nieve
      fill(0xd8e6f0);
      for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 1).fillRect(Math.floor(r() * S), Math.floor(r() * S), 2, 2);
      const pine = (x: number, y: number, s: number) =>
        wrap((ox, oy) => {
          const cx = x + ox;
          const cy = y + oy;
          g.fillStyle(0x000000, 0.18).fillEllipse(cx + 2, cy + s * 2 + 1, s * 2.4, 5);
          g.fillStyle(0x4a3020, 1).fillRect(cx - 1, cy + s * 2 - 3, 3, 4);
          for (let k = 0; k < 3; k++) {
            const ty = cy + k * s * 0.6;
            const half = s * 0.45 + k * s * 0.28;
            g.fillStyle(K, 1).fillTriangle(cx, ty - 2, cx - half - 1, ty + s * 0.8 + 1, cx + half + 1, ty + s * 0.8 + 1);
            g.fillStyle(0x2e5a4a, 1).fillTriangle(cx, ty - 1, cx - half, ty + s * 0.8, cx + half, ty + s * 0.8);
            g.fillStyle(0x3f7a60, 1).fillTriangle(cx, ty - 1, cx - half * 0.5, ty + s * 0.8, cx, ty + s * 0.8);
            g.fillStyle(0xffffff, 1).fillRect(cx - half + 1, ty + s * 0.8 - 2, half * 0.9, 2);
            g.fillStyle(0xffffff, 1).fillRect(cx - 1, ty - 1, 3, 2);
          }
        });
      for (const [x, y, s] of [[10, 2, 10], [42, 0, 12], [26, 30, 11], [56, 34, 9], [4, 40, 9], [38, 52, 8]] as const) pine(x, y, s);
      break;
    }
    case 'rocks':
    case 'lava': {
      fill(kind === 'lava' ? 0x2a0e0a : shade(w, -0.35));
      for (let i = 0; i < 30; i++) g.fillStyle(kind === 'lava' ? 0x4a1a12 : shade(w, -0.15), 1).fillRect(Math.floor(r() * S), Math.floor(r() * S), 2, 2);
      if (kind === 'lava') {
        // Río de lava serpenteante entre las rocas, con orilla oscura
        for (let x = -4; x < S + 4; x += 2) {
          const y = 32 + Math.round(Math.sin((x / S) * Math.PI * 2) * 8);
          g.fillStyle(0x7a1a0a, 1).fillRect(x, y - 7, 2, 14);
          g.fillStyle(0xe0402a, 1).fillRect(x, y - 5, 2, 10);
          g.fillStyle(0xffa030, 1).fillRect(x, y - 2, 2, 4);
          if (x % 12 === 0) g.fillStyle(0xffe08a, 1).fillRect(x, y - 1, 2, 2);
        }
        for (const [x, y, rad] of [[8, 8, 3], [52, 58, 3]] as const) {
          g.fillStyle(0xe0402a, 1).fillCircle(x, y, rad);
          g.fillStyle(0xffa030, 1).fillCircle(x - 1, y - 1, rad - 1);
        }
      }
      // Peñascos redondeados con luz arriba a la izquierda (sin aristas rectas: que no parezcan tejados); en la
      // cumbre, además, racimos de cristal inclinados
      const rock = kind === 'lava' ? 0x3a2a28 : b.colors.rock;
      const top = kind === 'lava' ? 0x5e4a46 : b.colors.rockTop;
      const crags: [number, number, number, number][] =
        kind === 'lava'
          ? [[20, 12, 18, 14], [50, 14, 15, 12], [8, 56, 16, 13], [38, 60, 20, 15]]
          : b.id === 'cumbre'
            ? [[14, 16, 22, 18], [52, 38, 20, 17], [24, 52, 18, 15], [2, 62, 14, 11]]
            : [[14, 16, 22, 18], [44, 12, 18, 15], [54, 40, 20, 17], [22, 46, 24, 20], [42, 62, 16, 12], [2, 60, 14, 11]];
      crags.sort((a, c) => a[1] - c[1]);
      crags.forEach(([x, y, cw, chh], n) => boulder(x, y, cw / 2, chh / 2, rock, top, n * 131 + b.id.length * 17));
      if (b.id === 'cumbre') {
        shards(42, 32, [[-0.55, 13, 7, 0xc8a8ff, -6], [0.65, 11, 7, 0xc8a8ff, 6], [0.08, 19, 9, 0x9fd8ff, 0], [-0.2, 8, 5, 0xe0c8ff, -2]]);
        shards(10, 46, [[-0.45, 10, 6, 0x9fd8ff, -4], [0.3, 14, 8, 0xc8a8ff, 2]]);
      }
      break;
    }
    case 'water': {
      // Mar con bandas de profundidad y crestas de ola escalonadas
      fill(0x2a6cb8);
      for (let y = 0; y < S; y += 16) {
        g.fillStyle(0x2e78c8, 1).fillRect(0, y + 8, S, 8);
        const off = (y / 16) % 2 ? 16 : 0;
        for (let x = off; x < S; x += 32) {
          g.fillStyle(0x5aa0e8, 1).fillRect(x + 2, y + 5, 12, 2).fillRect(x + 6, y + 3, 6, 2);
          g.fillStyle(0xd8f0ff, 1).fillRect(x + 6, y + 3, 4, 1).fillRect(x + 2, y + 5, 3, 1);
        }
      }
      for (let i = 0; i < 12; i++) g.fillStyle(0x1f5aa0, 1).fillRect(Math.floor(r() * S), Math.floor(r() * S), 4, 1);
      break;
    }
    case 'roofs': {
      // Tejados de dos colores con caballete, chimenea y calle entre manzanas
      fill(0x4a4e5a);
      const roof = (x0: number, y0: number, ww: number, hh: number, c: number) => {
        g.fillStyle(K, 1).fillRect(x0, y0, ww, hh);
        for (let y = y0 + 1; y < y0 + hh - 1; y += 6) {
          g.fillStyle(c, 1).fillRect(x0 + 1, y, ww - 2, 4);
          g.fillStyle(shade(c, -0.35), 1).fillRect(x0 + 1, y + 4, ww - 2, 2);
          for (let x = x0 + ((y / 6) % 2 ? 4 : 1); x < x0 + ww - 2; x += 7) g.fillStyle(shade(c, -0.35), 1).fillRect(x, y, 1, 4);
        }
        g.fillStyle(shade(c, 0.3), 1).fillRect(x0 + 1, y0 + 1, ww - 2, 2);
      };
      roof(1, 1, 30, 28, 0xb85050);
      roof(33, 1, 30, 28, 0x4a7ab0);
      roof(1, 33, 30, 28, 0x4a7ab0);
      roof(33, 33, 30, 28, 0xb85050);
      for (const [x, y] of [[22, 4], [40, 38]] as const) {
        g.fillStyle(K, 1).fillRect(x, y, 6, 8);
        g.fillStyle(0x8a8a90, 1).fillRect(x + 1, y + 1, 4, 6);
      }
      g.fillStyle(0xf2c230, 1).fillRect(8, 31, 6, 1).fillRect(40, 31, 6, 1).fillRect(31, 8, 1, 6).fillRect(31, 40, 1, 6);
      break;
    }
    case 'stars': {
      // Cielo nocturno con nubes de niebla y estrellas de varios tamaños
      fill(0x140e28);
      for (const [x, y, rx] of [[16, 20, 14], [48, 50, 16]] as const) wrap((ox, oy) => {
        g.fillStyle(0x221a40, 1).fillEllipse(x + ox, y + oy, rx * 2, 8);
        g.fillStyle(0x2c2250, 1).fillEllipse(x + ox - 2, y + oy - 1, rx * 1.3, 4);
      });
      for (let i = 0; i < 14; i++) g.fillStyle(r() < 0.3 ? 0xb9a6d8 : 0xffffff, r() < 0.5 ? 0.6 : 1).fillRect(Math.floor(r() * S), Math.floor(r() * S), 1, 1);
      g.fillStyle(0xb9a6d8, 1).fillRect(36, 12, 2, 2);
      g.fillStyle(0xffffff, 1).fillRect(10, 44, 2, 2);
      break;
    }
  }
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Pt = [number, number];

/** Mancha en escalones de píxel gordo `q` (no un óvalo liso). */
function stepBlob(g: G, c: number, a: number, cx: number, cy: number, rx: number, ry: number, q: number) {
  for (let yy = -ry; yy < ry; yy += q) {
    const half = Math.round((rx * Math.sqrt(Math.max(0, 1 - ((yy + q / 2) / ry) ** 2))) / q) * q;
    if (half > 0) g.fillStyle(c, a).fillRect(Math.round((cx - half) / q) * q, Math.round((cy + yy) / q) * q, half * 2, q);
  }
}

/** Camino serpenteante de puerta a puerta (horizontal o vertical), con borde más oscuro. */
function drawPath(g: G, room: Rect, r: () => number, q: number, fillC: number, edgeC: number, width: number, alpha = 1) {
  const horiz = r() < 0.5;
  const len = horiz ? room.x1 - room.x0 : room.y1 - room.y0;
  const ph = r() * Math.PI * 2;
  const amp = 30 + r() * 30;
  const pts: Pt[] = [];
  for (let t = 0; t <= len; t += q * 3) {
    const off = Math.sin(t / 110 + ph) * amp * Math.sin((Math.PI * Math.max(0, Math.min(len, t))) / len);
    pts.push(horiz ? [room.x0 + t, (room.y0 + room.y1) / 2 + off] : [(room.x0 + room.x1) / 2 + off, room.y0 + t]);
  }
  for (const [x, y] of pts) stepBlob(g, edgeC, alpha, x, y, width / 2 + q * 2, width / 2.6 + q, q);
  for (const [x, y] of pts) stepBlob(g, fillC, alpha, x, y, width / 2, width / 2.6, q);
  return pts;
}

/** Grieta quebrada (en zigzag) de píxeles gordos; devuelve sus puntos. */
function drawCrack(g: G, x: number, y: number, n: number, q: number, r: () => number, c: number, hi?: number): Pt[] {
  const pts: Pt[] = [];
  let dx = r() < 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    g.fillStyle(c, 1).fillRect(Math.round(x / q) * q, Math.round(y / q) * q, q, q);
    if (hi !== undefined && i % 3 === 1) g.fillStyle(hi, 1).fillRect(Math.round(x / q) * q, Math.round(y / q) * q, q, q);
    pts.push([x, y]);
    if (r() < 0.35) dx = -dx;
    x += dx * q;
    y += r() < 0.6 ? q : 0;
    // Rama
    if (r() < 0.12) drawCrack(g, x, y, 3, q, r, c);
  }
  return pts;
}

/** Cristal de varias puntas (cueva, cumbre). */
function crystal(g: G, x: number, y: number, q: number, c: number, hi: number) {
  const spikes: [number, number, number][] = [[0, 5, 2], [-2, 3, 1], [2, 4, 1]];
  for (const [dx, h, wq] of spikes) {
    g.fillStyle(K, 1).fillRect(x + (dx - 1) * q, y - (h + 1) * q, (wq + 2) * q, (h + 1) * q);
  }
  for (const [dx, h, wq] of spikes) {
    g.fillStyle(c, 1).fillRect(x + dx * q, y - h * q, wq * q, h * q);
    g.fillStyle(hi, 1).fillRect(x + dx * q, y - h * q, q, Math.max(1, h - 2) * q);
  }
  g.fillStyle(0x000000, 0.25).fillRect(x - 2 * q, y, 6 * q, q);
}

/**
 * Lo grande del suelo de cada bioma (caminos, grietas de lava, alfombra, ventisqueros, barro…). Devuelve puntos que
 * brillan (para los destellos) y puntos de lava o lodo (para que la sala burbujee o palpite).
 */
function drawFloorFeatures(g: G, b: BiomeLook, room: Rect, r: () => number, q: number, open: { up?: boolean; down?: boolean; left?: boolean; right?: boolean }) {
  const shiny: Pt[] = [];
  const hot: Pt[] = [];
  const f = b.colors.floor;
  const w = room.x1 - room.x0;
  const h = room.y1 - room.y0;
  const rx = () => room.x0 + 30 + r() * (w - 60);
  const ry = () => room.y0 + 30 + r() * (h - 60);
  switch (b.id) {
    case 'bosque': {
      drawPath(g, room, r, q, 0xc8b07a, 0x9a8a5a, 54);
      // Tierra pisada con piedrecitas en el camino y matas de flores en grupo
      for (let i = 0; i < 4; i++) {
        const cx = rx();
        const cy = ry();
        stepBlob(g, shade(f, -0.12), 0.6, cx, cy, 30 + r() * 20, 16 + r() * 8, q);
        for (let k = 0; k < 5; k++) g.fillStyle([0xff7aa8, 0xffe066, 0xffffff][k % 3], 1).fillRect(Math.round((cx - 24 + r() * 48) / q) * q, Math.round((cy - 10 + r() * 20) / q) * q, q, q);
      }
      break;
    }
    case 'pantano': {
      drawPath(g, room, r, q, 0x8a7a50, 0x6a5a3a, 48, 0.8);
      // Charcas de lodo con orilla húmeda: burbujean
      for (let i = 0; i < 3; i++) {
        const cx = rx();
        const cy = ry();
        const rr = 26 + r() * 18;
        stepBlob(g, 0x5a5a34, 1, cx, cy, rr + q * 2, rr * 0.5 + q, q);
        stepBlob(g, 0x4a3e28, 1, cx, cy, rr, rr * 0.5, q);
        stepBlob(g, 0x5e4a30, 1, cx - q * 2, cy - q, rr * 0.6, rr * 0.25, q);
        hot.push([cx, cy]);
        for (let k = 0; k < 3; k++) {
          const x = cx - rr + r() * rr * 2;
          g.fillStyle(K, 1).fillRect(x, cy - rr * 0.5 - q * 4, q, q * 5);
          g.fillStyle(0x7a4a2a, 1).fillRect(x, cy - rr * 0.5 - q * 4, q, q * 2);
        }
      }
      break;
    }
    case 'cueva': {
      for (let i = 0; i < 5; i++) drawCrack(g, rx(), ry(), 8 + Math.floor(r() * 8), q, r, shade(f, -0.45));
      // Montones de grava y racimos de cristal
      for (let i = 0; i < 4; i++) {
        const cx = rx();
        const cy = ry();
        for (let k = 0; k < 7; k++) {
          const x = cx + (r() - 0.5) * 40;
          const y = cy + (r() - 0.5) * 20;
          g.fillStyle(shade(f, -0.35), 1).fillRect(Math.round(x / q) * q, Math.round(y / q) * q + q, q * 2, q);
          g.fillStyle(shade(f, -0.1), 1).fillRect(Math.round(x / q) * q, Math.round(y / q) * q, q * 2, q);
        }
      }
      for (let i = 0; i < 3; i++) {
        const x = Math.round(rx() / q) * q;
        const y = Math.round(ry() / q) * q;
        crystal(g, x, y, q, i % 2 ? 0x6f8fe8 : 0x9b6fe8, i % 2 ? 0xc4d8ff : 0xe0ccff);
        shiny.push([x + q, y - q * 3]);
      }
      break;
    }
    case 'volcan': {
      // Grietas de lava que brillan (palpitan) y manchas de ceniza
      for (let i = 0; i < 5; i++) stepBlob(g, 0x6a4a44, 0.35, rx(), ry(), 30 + r() * 30, 12 + r() * 10, q);
      for (let i = 0; i < 4; i++) {
        const pts = drawCrack(g, rx(), ry(), 10 + Math.floor(r() * 10), q, r, 0x3a1410, 0xff6a1a);
        for (let k = 1; k < pts.length; k += 4) hot.push(pts[k]);
      }
      break;
    }
    case 'mar': {
      // Arena mojada (más oscura) junto a un borde, línea de espuma, algas varadas
      const y = room.y0 + h * (0.55 + r() * 0.25);
      for (let x = room.x0; x < room.x1; x += q * 2) {
        const yy = y + Math.round((Math.sin(x / 50) * 10) / q) * q;
        g.fillStyle(shade(f, -0.16), 0.75).fillRect(x, yy, q * 2, room.y1 - yy);
        g.fillStyle(0xffffff, 0.85).fillRect(x, yy - q, q * 2, q);
        if ((x / q) % 6 < 2) g.fillStyle(0xffffff, 0.6).fillRect(x, yy - q * 2, q, q);
      }
      for (let i = 0; i < 4; i++) {
        const cx = rx();
        const cy = ry();
        for (let k = 0; k < 4; k++) g.fillStyle(k % 2 ? 0x2f8a6a : 0x4aa080, 1).fillRect(Math.round((cx + k * q * 2) / q) * q, Math.round((cy + Math.sin(k) * q * 2) / q) * q, q * 2, q);
      }
      break;
    }
    case 'torre': {
      // Alfombra raída de puerta a puerta con ribete dorado y telarañas en las esquinas
      const vert = r() < 0.5;
      const cx = (room.x0 + room.x1) / 2;
      const cy = (room.y0 + room.y1) / 2;
      const ww = 96;
      const [ax, ay, aw, ah] = vert ? [cx - ww / 2, room.y0, ww, h] : [room.x0, cy - ww / 2, w, ww];
      g.fillStyle(0x000000, 0.2).fillRect(ax + q, ay + q, aw, ah);
      g.fillStyle(0x4a1a4a, 1).fillRect(ax, ay, aw, ah);
      g.fillStyle(0x6a2a6a, 1).fillRect(ax + q * 3, ay + (vert ? 0 : q * 3), aw - (vert ? q * 6 : 0), ah - (vert ? 0 : q * 6));
      g.fillStyle(0xc8a040, 1);
      if (vert) g.fillRect(ax + q, ay, q, ah).fillRect(ax + aw - q * 2, ay, q, ah);
      else g.fillRect(ax, ay + q, aw, q).fillRect(ax, ay + ah - q * 2, aw, q);
      // Rombos del dibujo
      for (let t = 30; t < (vert ? h : w) - 20; t += 60) {
        const [mx, my] = vert ? [cx, room.y0 + t] : [room.x0 + t, cy];
        g.fillStyle(0x8a4a8a, 1).fillRect(mx - q, my - q * 3, q * 2, q * 6).fillRect(mx - q * 3, my - q, q * 6, q * 2);
        g.fillStyle(0xc8a040, 1).fillRect(mx - q / 2, my - q / 2, q, q);
      }
      // Rotos
      for (let i = 0; i < 4; i++) {
        const x = vert ? ax + r() * aw : room.x0 + r() * w;
        const y = vert ? room.y0 + r() * h : ay + r() * ah;
        stepBlob(g, b.colors.floor, 1, x, y, q * 2, q * 2, q);
      }
      break;
    }
    case 'ciudad': {
      // Línea pintada, tapa de alcantarilla, rejillas y manchas de aceite
      const y = room.y0 + h * 0.5;
      for (let x = room.x0 + 20; x < room.x1 - 20; x += 48) g.fillStyle(0xf2c230, 0.8).fillRect(x, y - q, 24, q * 2);
      const mx = room.x0 + w * (0.2 + r() * 0.6);
      const my = room.y0 + h * (0.2 + r() * 0.2);
      stepBlob(g, K, 1, mx, my, 22, 22, q);
      stepBlob(g, 0x5a6070, 1, mx, my, 19, 19, q);
      for (let k = -12; k <= 12; k += 6) g.fillStyle(0x3a4050, 1).fillRect(mx - 14, my + k, 28, q);
      g.fillStyle(0x8a90a0, 1).fillRect(mx - 15, my - 16, 30, q);
      for (const gx of [room.x0 + 60, room.x1 - 90]) {
        g.fillStyle(K, 1).fillRect(gx, room.y0 + 6, 30, 15);
        for (let k = 0; k < 5; k++) g.fillStyle(0x6a7080, 1).fillRect(gx + 3 + k * 6, room.y0 + 9, q, 9);
      }
      for (let i = 0; i < 3; i++) {
        const cx = rx();
        const cy = ry();
        // Mancha de aceite: borde difuso, centro más negro descentrado, gotas sueltas y un arco tornasolado
        const rr = 18 + r() * 14;
        stepBlob(g, 0x2a2e3a, 0.22, cx, cy, rr + q * 2, rr * 0.45 + q, q);
        stepBlob(g, 0x2a2e3a, 0.3, cx + q, cy, rr * 0.75, rr * 0.33, q);
        stepBlob(g, 0x14161c, 0.35, cx - q * 2, cy - q, rr * 0.4, rr * 0.18, q);
        for (let k = 0; k < 3; k++) g.fillStyle(0x2a2e3a, 0.4).fillRect(Math.round((cx + (r() < 0.5 ? -1 : 1) * (rr + q * 3 + r() * 8)) / q) * q, Math.round((cy + (r() - 0.5) * rr * 0.6) / q) * q, q, q);
        const sx = Math.round((cx - rr * 0.5) / q) * q;
        const sy = Math.round((cy - rr * 0.12) / q) * q;
        g.fillStyle(0x8a6ac8, 0.45).fillRect(sx, sy, q * 2, q);
        g.fillStyle(0x6ac8a8, 0.45).fillRect(sx + q * 2, sy - q, q * 2, q);
        g.fillStyle(0xd8c86a, 0.35).fillRect(sx + q * 4, sy - q, q * 2, q);
        g.fillStyle(0xc86a9a, 0.4).fillRect(sx + q * 6, sy, q * 2, q);
      }
      break;
    }
    case 'nieve': {
      // Ventisqueros junto a las paredes y placas de hielo que brillan
      const drift = (x: number, y: number, rr: number) => {
        stepBlob(g, 0xb8cce0, 1, x, y + q * 2, rr, rr * 0.4, q);
        stepBlob(g, 0xffffff, 1, x, y, rr, rr * 0.38, q);
        stepBlob(g, 0xf4faff, 1, x - q * 2, y - q, rr * 0.5, rr * 0.18, q);
      };
      for (let x = room.x0 + 40; x < room.x1 - 20; x += 90 + r() * 90) {
        if (!open.up && Math.abs(x - (room.x0 + room.x1) / 2) > 80) drift(x, room.y0 + 14, 30 + r() * 20);
        if (!open.down && r() < 0.6 && Math.abs(x - (room.x0 + room.x1) / 2) > 80) drift(x, room.y1 - 14, 26 + r() * 16);
      }
      for (let i = 0; i < 3; i++) {
        const cx = rx();
        const cy = ry();
        const rr = 34 + r() * 20;
        stepBlob(g, 0x8ec4e4, 1, cx, cy, rr + q, rr * 0.45 + q, q);
        stepBlob(g, 0xbfe2f6, 1, cx, cy, rr, rr * 0.45, q);
        g.fillStyle(0xffffff, 1).fillRect(cx - rr * 0.5, cy - q * 2, q * 4, q).fillRect(cx + q * 3, cy + q, q * 2, q);
        g.fillStyle(0x8ec4e4, 1).fillRect(cx - q * 2, cy - q * 3, q, q * 5);
        shiny.push([cx, cy]);
      }
      break;
    }
    case 'cumbre': {
      // Pétalos rosas a montones y cristales de la montaña
      for (let i = 0; i < 5; i++) {
        const cx = rx();
        const cy = ry();
        for (let k = 0; k < 8; k++) g.fillStyle(k % 3 ? 0xf0b8d8 : 0xffe0f0, 1).fillRect(Math.round((cx + (r() - 0.5) * 50) / q) * q, Math.round((cy + (r() - 0.5) * 24) / q) * q, q, q);
      }
      for (let i = 0; i < 3; i++) {
        const x = Math.round(rx() / q) * q;
        const y = Math.round(ry() / q) * q;
        crystal(g, x, y, q, i % 2 ? 0xc8a8ff : 0x9fd8ff, 0xffffff);
        shiny.push([x + q, y - q * 3]);
      }
      break;
    }
    default:
      break;
  }
  return { shiny, hot };
}

/** Luz de pared: dónde va la llama (o lámpara) y de qué color es. */
interface WallLight { x: number; y: number; c: number[]; kind: 'flame' | 'lamp' | 'glow' }

/**
 * Adornos de la pared de cada bioma (antorchas, enredaderas, carámbanos, estalactitas, tuberías, cristales…) y charcos
 * de luz en el suelo bajo las luces. Todo en dos Graphics por sala; las llamas se animan en `addRoomAmbient`.
 */
function addWallDecor(scene: Phaser.Scene, b: BiomeLook, room: Rect, wall: number, q: number, r: () => number, open: { up?: boolean; down?: boolean; left?: boolean; right?: boolean }) {
  const wd = scene.add.graphics().setDepth(0.335);
  const lights: WallLight[] = [];
  const cx = (room.x0 + room.x1) / 2;
  const cy = (room.y0 + room.y1) / 2;
  const w = room.x1 - room.x0;
  const h = room.y1 - room.y0;
  const sn = (v: number) => Math.round(v / q) * q;
  const notDoorX = (x: number) => Math.abs(x - cx) > 75;
  const notDoorY = (y: number) => Math.abs(y - cy) > 75;
  // Puntos a lo largo de la pared de arriba, sin tapar la puerta
  const topXs = (n: number) => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = sn(room.x0 + 20 + r() * (w - 40));
      if (notDoorX(x)) xs.push(x);
    }
    return xs;
  };
  const topY = room.y0 - wall + 12;
  const torch = (x: number, y: number, c: number[], kind: WallLight['kind'] = 'flame') => {
    x = sn(x);
    y = sn(y);
    // Soporte de hierro y mango; la llama va encima (animada) o quieta con pocos efectos
    wd.fillStyle(K, 1).fillRect(x - q * 2, y + q * 2, q * 4, q * 3).fillRect(x - q, y + q * 5, q * 2, q * 3);
    wd.fillStyle(kind === 'lamp' ? 0x8a90a0 : 0x6a4a2a, 1).fillRect(x - q, y + q * 2, q * 2, q * 2);
    wd.fillStyle(0x4a4e5a, 1).fillRect(x - q, y + q * 4, q * 2, q);
    if (kind === 'lamp') {
      wd.fillStyle(K, 1).fillRect(x - q * 2, y - q * 2, q * 4, q * 4);
      wd.fillStyle(c[1], 1).fillRect(x - q, y - q, q * 2, q * 3);
      wd.fillStyle(c[2], 1).fillRect(x - q, y - q, q, q);
    } else if (lowFx()) {
      wd.fillStyle(c[0], 1).fillRect(x - q, y - q * 2, q * 2, q * 4);
      wd.fillStyle(c[1], 1).fillRect(x - q, y, q * 2, q * 2);
      wd.fillStyle(c[2], 1).fillRect(x, y + q, q, q);
    }
    lights.push({ x, y, c, kind });
  };
  const fire = [0xff5a1a, 0xffa030, 0xfff0a0];
  switch (b.id) {
    case 'bosque':
    case 'pantano': {
      // Enredaderas que cuelgan de la pared de arriba y bajan por los lados
      const leaf = b.id === 'pantano' ? [0x3d6a3a, 0x5b8f4c] : [0x3f8a36, 0x6cbf4a];
      const vine = (x: number, y0: number, len: number, vertical = true) => {
        for (let k = 0; k < len; k++) {
          const xx = vertical ? x + (k % 4 === 2 ? q : 0) : x + k * q;
          const yy = vertical ? y0 + k * q : y0 + (k % 4 === 2 ? q : 0);
          wd.fillStyle(K, 1).fillRect(xx - q / 3, yy, q + q / 3, q);
          wd.fillStyle(0x2a5a2a, 1).fillRect(xx, yy, q, q);
          if (k % 3 === 1) {
            wd.fillStyle(leaf[0], 1).fillRect(xx + q, yy, q * 2, q * 2);
            wd.fillStyle(leaf[1], 1).fillRect(xx + q, yy, q, q);
          }
          if (k % 3 === 2) wd.fillStyle(leaf[0], 1).fillRect(xx - q * 2, yy, q * 2, q * 2);
        }
        if (b.id === 'bosque' && r() < 0.6) wd.fillStyle(0xff7aa8, 1).fillRect(x - q, y0 + (len - 2) * q, q * 2, q * 2);
      };
      if (!open.up) for (const x of topXs(7)) vine(x, room.y0 - wall + 10, 6 + Math.floor(r() * 8));
      // Hongos y matas en el canto de abajo
      if (!open.down) for (let i = 0; i < 5; i++) {
        const x = sn(room.x0 + r() * w);
        if (!notDoorX(x)) continue;
        const y = room.y1 + 26;
        wd.fillStyle(K, 1).fillRect(x - q, y - q * 3, q * 4, q * 2).fillRect(x, y - q, q * 2, q * 2);
        wd.fillStyle(b.id === 'pantano' ? 0x8a6ac8 : 0xc8402a, 1).fillRect(x - q + 1, y - q * 3 + 1, q * 4 - 2, q * 2 - 2);
        wd.fillStyle(0xffffff, 1).fillRect(x, y - q * 3 + 1, q, q / 1.5);
        wd.fillStyle(0xe8dcc0, 1).fillRect(x + 1, y - q, q * 2 - 2, q * 2 - 1);
      }
      if (b.id === 'pantano' && !open.up) for (const x of [room.x0 + w * 0.2, room.x0 + w * 0.8]) torch(x, topY + 6, [0x3a8a3a, 0x8ae07a, 0xe0ffd0], 'glow');
      break;
    }
    case 'cueva': {
      // Estalactitas en la cara de arriba y antorchas
      if (!open.up) {
        for (const x of topXs(9)) {
          // Estalactita: ancha arriba, punta abajo, con luz a la izquierda
          const len = 4 + Math.floor(r() * 5);
          for (let k = 0; k < len; k++) {
            const ww = Math.max(1, 4 - Math.floor((k * 4) / len));
            const yy = room.y0 - 24 + k * q;
            wd.fillStyle(K, 1).fillRect(x - Math.ceil(ww / 2) * q - 2, yy, ww * q + 4, q + 2);
            wd.fillStyle(shade(b.colors.rock, 0.1), 1).fillRect(x - Math.ceil(ww / 2) * q, yy, ww * q, q);
            wd.fillStyle(shade(b.colors.rockTop, 0.2), 1).fillRect(x - Math.ceil(ww / 2) * q, yy, q, q);
          }
        }
        torch(room.x0 + w * 0.22, topY, fire);
        torch(room.x0 + w * 0.78, topY, fire);
      }
      break;
    }
    case 'volcan': {
      // Vetas de lava en la cara de la pared y braseros
      if (!open.up) {
        for (const x of topXs(6)) {
          let xx = x;
          for (let k = 0; k < 5; k++) {
            wd.fillStyle(k % 2 ? 0xff6a1a : 0xd8401a, 1).fillRect(xx, room.y0 - 24 + k * q, q, q);
            xx += r() < 0.5 ? q : -q;
          }
        }
        torch(room.x0 + w * 0.25, topY, fire);
        torch(room.x0 + w * 0.75, topY, fire);
      }
      if (!open.left && notDoorY(room.y0 + h * 0.3)) torch(room.x0 - 20, room.y0 + h * 0.3, fire);
      if (!open.right && notDoorY(room.y0 + h * 0.7)) torch(room.x1 + 20, room.y0 + h * 0.7, fire);
      break;
    }
    case 'torre': {
      // Velas de llama violeta, telarañas en las esquinas y estandartes rotos
      const ghost = [0x6a3ad0, 0xb08cff, 0xf0e4ff];
      if (!open.up) {
        torch(room.x0 + w * 0.2, topY, ghost);
        torch(room.x0 + w * 0.8, topY, ghost);
        for (const x of [room.x0 + w * 0.35, room.x0 + w * 0.65]) {
          const bx = sn(x);
          wd.fillStyle(K, 1).fillRect(bx - q * 3, room.y0 - wall + 10, q * 6, q * 8);
          wd.fillStyle(0x4a1a4a, 1).fillRect(bx - q * 2, room.y0 - wall + 10, q * 4, q * 6);
          wd.fillStyle(0xc8a040, 1).fillRect(bx - q / 2, room.y0 - wall + 13, q, q * 3);
          wd.fillStyle(0x4a1a4a, 1).fillRect(bx - q * 2, room.y0 - wall + 10 + q * 6, q, q).fillRect(bx + q, room.y0 - wall + 10 + q * 6, q, q);
        }
      }
      const web = (x: number, y: number, sx: number, sy: number) => {
        for (let k = 0; k < 7; k++) {
          wd.fillStyle(0xe8e0f0, 0.55).fillRect(x + sx * k * q, y, q, q).fillRect(x, y + sy * k * q, q, q).fillRect(x + sx * k * q * 0.7, y + sy * k * q * 0.7, q, q);
          if (k === 3 || k === 5) for (let j = 0; j <= k; j++) wd.fillStyle(0xe8e0f0, 0.4).fillRect(x + sx * j * q, y + sy * (k - j) * q, q, q);
        }
      };
      if (!open.up && !open.left) web(room.x0, room.y0, 1, 1);
      if (!open.up && !open.right) web(room.x1 - q, room.y0, -1, 1);
      break;
    }
    case 'ciudad': {
      // Tubería a lo largo de la pared con abrazaderas y farolillos eléctricos
      if (!open.up) {
        const y = room.y0 - 22;
        wd.fillStyle(K, 1).fillRect(room.x0, y - q, w, q * 4);
        wd.fillStyle(0x7a8090, 1).fillRect(room.x0, y, w, q * 2);
        wd.fillStyle(0xb0b6c4, 1).fillRect(room.x0, y, w, q / 1.5);
        for (let x = room.x0 + 30; x < room.x1; x += 70) wd.fillStyle(0x4a4e5a, 1).fillRect(x, y - q, q * 2, q * 4);
        const lamp = [0xf2c230, 0xfff0a0, 0xffffff];
        torch(room.x0 + w * 0.25, topY + 4, lamp, 'lamp');
        torch(room.x0 + w * 0.75, topY + 4, lamp, 'lamp');
      }
      break;
    }
    case 'nieve': {
      // Nieve sobre el canto y carámbanos que cuelgan
      if (!open.up) {
        for (let x = room.x0 - 20; x < room.x1 + 20; x += q * 2) wd.fillStyle(0xffffff, 1).fillRect(x, room.y0 - wall, q * 2, q + (Math.sin(x / 13) > 0.3 ? q : 0));
        for (const x of topXs(14)) {
          const len = 2 + Math.floor(r() * 4);
          for (let k = 0; k < len; k++) {
            wd.fillStyle(K, 0.6).fillRect(x - q / 3, room.y0 - 12 + k * q, q + (q * 2) / 3, q);
            wd.fillStyle(k === 0 ? 0xffffff : 0xcde8fa, 1).fillRect(x, room.y0 - 12 + k * q, q, q);
          }
          shadeFloorDrip(wd, x, room.y0 - 12 + len * q, q);
        }
        torch(room.x0 + w * 0.25, topY + 4, [0xf2a030, 0xffd070, 0xffffff], 'lamp');
        torch(room.x0 + w * 0.75, topY + 4, [0xf2a030, 0xffd070, 0xffffff], 'lamp');
      }
      if (!open.down) for (let x = room.x0 - 20; x < room.x1 + 20; x += q * 2) wd.fillStyle(0xffffff, 1).fillRect(x, room.y1 + 24, q * 2, q * 2 + (Math.sin(x / 17) > 0 ? q : 0));
      break;
    }
    case 'mar': {
      // Red de pesca colgada, algas en la pared y conchas en el canto
      if (!open.up) {
        for (const x of topXs(8)) {
          const len = 3 + Math.floor(r() * 5);
          for (let k = 0; k < len; k++) wd.fillStyle(k % 2 ? 0x2f8a6a : 0x4aa080, 1).fillRect(x + (k % 3 === 1 ? q : 0), room.y0 - wall + 12 + k * q, q, q);
        }
        const nx = sn(room.x0 + w * 0.18);
        for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) if ((k + j) % 2 === 0) wd.fillStyle(0xd8c8a0, 0.9).fillRect(nx + k * q * 2, room.y0 - wall + 12 + j * q * 2, q, q);
      }
      if (!open.down) for (let i = 0; i < 6; i++) {
        const x = sn(room.x0 + r() * w);
        if (!notDoorX(x)) continue;
        wd.fillStyle(K, 1).fillRect(x - q, room.y1 + 22, q * 4, q * 3);
        wd.fillStyle(i % 2 ? 0xf4b8c8 : 0xf8e8d0, 1).fillRect(x, room.y1 + 22 + 1, q * 2, q * 2);
      }
      break;
    }
    case 'cumbre': {
      // Cristales que brillan incrustados en la pared
      if (!open.up) for (const x of [room.x0 + w * 0.2, room.x0 + w * 0.8]) {
        const xx = sn(x);
        crystal(wd, xx, room.y0 - 6, q, 0xc8a8ff, 0xffffff);
        lights.push({ x: xx + q, y: room.y0 - 20, c: [0x9a6ae0, 0xc8a8ff, 0xffffff], kind: 'glow' });
      }
      if (!open.left && notDoorY(room.y0 + h * 0.75)) {
        crystal(wd, sn(room.x0 - 18), sn(room.y0 + h * 0.75), q, 0x9fd8ff, 0xffffff);
        lights.push({ x: sn(room.x0 - 18) + q, y: sn(room.y0 + h * 0.75) - 12, c: [0x4a8ae0, 0x9fd8ff, 0xffffff], kind: 'glow' });
      }
      break;
    }
    default:
      break;
  }
  // Charcos de luz en el suelo bajo cada luz (suman color, como un resplandor)
  let pool: Phaser.GameObjects.Graphics | undefined;
  if (lights.length) {
    // Sobre un suelo muy claro (nieve) sumar luz no se ve: ahí se tiñe del color de la luz, algo más oscuro
    const bright = lum(b.colors.floor) > 0.8;
    pool = scene.add.graphics().setDepth(0.28).setBlendMode(bright ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
    for (const l of lights) {
      const ly = Math.max(l.y, room.y0) + 18;
      if (bright) {
        // Sobre nieve: la luz aclara la sombra de la pared con un velo blanco cálido que se funde (no una mancha
        // anaranjada) y enciende destellos de escarcha alrededor
        const warm = mixC(l.c[1], 0xffffff, 0.9);
        for (let s = 0; s < 5; s++) stepBlob(pool, warm, 0.09, l.x, ly - 8, 96 - s * 18, 46 - s * 8, q * 2);
        for (let n = 0; n < 8; n++) {
          const gx = Math.round((l.x + (r() - 0.5) * 150) / q) * q;
          const gy = Math.round((ly - 14 + r() * 56) / q) * q;
          pool.fillStyle(n % 2 ? 0xffe9a0 : 0xffffff, 1).fillRect(gx, gy, q, q);
          if (n % 3 === 0) pool.fillStyle(0xfff4c8, 0.8).fillRect(gx - q, gy, q * 3, q / 2 + 1).fillRect(gx + q / 4, gy - q, q / 2 + 1, q * 3);
        }
      } else for (let s = 0; s < 4; s++) stepBlob(pool, l.c[1], 0.05, l.x, ly, 110 - s * 24, 64 - s * 14, q * 2);
      // Halo sobre la pared, junto a la llama
      for (let s = 0; s < 3; s++) stepBlob(pool, l.c[1], 0.07, l.x, l.y, 30 - s * 8, 26 - s * 7, q);
    }
  }
  return { lights, pool };
}

/** Gota en la punta de un carámbano (se pinta una vez; la animación de caer es aparte). */
function shadeFloorDrip(g: G, x: number, y: number, q: number) {
  g.fillStyle(0xe8f6ff, 0.8).fillRect(x, y, q, q / 1.5);
}

/** Crea (una vez por bioma) las texturas del decorado. */
export function bakeRoomDecor(scene: Phaser.Scene, b: BiomeLook) {
  const outKey = `outside-${b.id}`;
  if (!scene.textures.exists(outKey)) {
    const g = scene.make.graphics({}, false);
    drawOutside(g, b, OUTSIDE[b.id] ?? 'trees');
    g.generateTexture(outKey, OUT_TEX, OUT_TEX);
    g.destroy();
    scene.textures.get(outKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  (DECALS[b.id] ?? DECALS.bosque).forEach((d, i) => {
    const key = `decal-${b.id}-${i}`;
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    d.rows.forEach((row, j) => {
      for (let k = 0; k < row.length; k++) if (row[k] !== '.') g.fillStyle(d.pal[row[k]] ?? K, 1).fillRect(k, j, 1, 1);
    });
    g.generateTexture(key, 8, 8);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  });
}

/**
 * Decora una sala: paisaje alrededor (cell = la celda entera de la sala en el mapa), manchas y detalles en el
 * suelo y sombra de la pared. `room` es el interior (suelo). `scale` = tamaño de un píxel del arte.
 */
export function decorateRoom(
  scene: Phaser.Scene,
  b: BiomeLook,
  cell: { x: number; y: number; w: number; h: number },
  room: { x0: number; y0: number; x1: number; y1: number },
  wall: number,
  seed: number,
  scale: number,
  /** Lados abiertos a otra sala de la misma sala grande (sin sombra de pared). */
  open: {
    left?: boolean;
    right?: boolean;
    up?: boolean;
    down?: boolean;
    /** Esquina interior de una sala en L: alargar la pared de arriba/abajo hacia la izquierda, o la de la derecha/izquierda hacia arriba. */
    topLeft?: boolean;
    bottomLeft?: boolean;
    rightUp?: boolean;
    leftUp?: boolean;
  } = {},
) {
  bakeRoomDecor(scene, b);
  const r = rng(seed * 7919 + 13);
  // Paisaje de fuera, detrás de todo
  scene.add.tileSprite(cell.x, cell.y, cell.w, cell.h, `outside-${b.id}`).setOrigin(0).setTileScale(scale).setDepth(-1);

  const w = room.x1 - room.x0;
  const h = room.y1 - room.y0;
  // Manchas grandes y suaves de otro tono (sin ellas el suelo se ve plano)
  const patches = scene.add.graphics().setDepth(0.05);
  // En la torre el suelo son baldosas en rejilla: una mancha redonda que las cruza se ve como un recuadro raro.
  // Ahí se gastan baldosas sueltas enteras (más claras o más oscuras), siguiendo la rejilla de 40 px
  const tileGrid = b.id === 'torre';
  if (tileGrid) for (let i = 0; i < 14; i++) {
    const c = shade(b.colors.floor, r() < 0.5 ? -0.08 : 0.07);
    const tx = room.x0 + Math.floor(r() * (w / 40)) * 40;
    const ty = room.y0 + Math.floor(r() * (h / 40)) * 40;
    patches.fillStyle(c, 0.6).fillRect(tx + 2, ty + 2, 36, 36);
  }
  // Las losas grandes (cueva, volcán, cumbre) ya cambian de tono una a una: una mancha encima corta las losas
  const slabs = b.id === 'cueva' || b.id === 'volcan' || b.id === 'cumbre';
  for (let i = 0; i < (tileGrid || slabs ? 0 : 7); i++) {
    const c = shade(b.colors.floor, r() < 0.5 ? -0.07 : 0.08);
    const px = room.x0 + 40 + r() * (w - 80);
    const py = room.y0 + 40 + r() * (h - 80);
    const pw = 80 + r() * 140;
    const ph = 40 + r() * 70;
    // En escalones de píxel gordo, no un óvalo liso
    for (let yy = -ph / 2; yy < ph / 2; yy += scale * 2) {
      const half = (pw / 2) * Math.sqrt(Math.max(0, 1 - (yy / (ph / 2)) ** 2));
      const q = scale * 2;
      patches.fillStyle(c, 0.55).fillRect(Math.round((px - half) / q) * q, Math.round((py + yy) / q) * q, Math.round((half * 2) / q) * q, q);
    }
  }

  // Lo grande de cada bioma: caminos, grietas de lava, alfombra, ventisqueros, barro… (una sola capa por sala)
  const feat = scene.add.graphics().setDepth(0.06);
  const { shiny, hot } = drawFloorFeatures(feat, b, room, r, scale, open);

  // Detalles sueltos, a veces en grupitos (más naturales que repartidos al azar); los que brillan (cristal, concha,
  // brasa, runa) destellan a ratos
  const set = DECALS[b.id] ?? DECALS.bosque;
  const n = 38 + Math.floor(r() * 14);
  let gx = 0;
  let gy = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * set.length);
    const grouped = i % 4 !== 0;
    if (!grouped) {
      gx = room.x0 + 16 + r() * (w - 32);
      gy = room.y0 + 24 + r() * (h - 40);
    }
    const x = grouped ? Math.max(room.x0 + 12, Math.min(room.x1 - 12, gx + (r() - 0.5) * 70)) : gx;
    const y = grouped ? Math.max(room.y0 + 20, Math.min(room.y1 - 12, gy + (r() - 0.5) * 40)) : gy;
    // Piedrecitas, cristales y montoncitos de nieve a tamaño entero (~30-48 px) parecían rocas de verdad, pero no
    // chocan: se pintan a la mitad y algo apagados, como gravilla del suelo (las rocas sólidas son las de la rejilla)
    const solidLook = SOLID_LOOKING.has(set[k]);
    const img = scene.add.image(x, y, `decal-${b.id}-${k}`).setScale(solidLook ? scale * 0.5 : scale).setDepth(0.1);
    if (solidLook) img.setAlpha(0.8);
    if (set[k] === CRACK) img.setAlpha(0.25);
    if (r() < 0.5) img.setFlipX(true);
    if (set[k] === CRYSTAL || set[k] === SHELL || set[k] === EMBER || set[k] === RUNE) shiny.push([x, y]);
  }

  // En una sala grande, cada casilla pinta también el hueco que la une con la de la derecha o la de abajo
  // (`extR`, `extD`) y no pinta nada en los lados unidos: así sombras, viñeta y paredes siguen sin cortes.
  const extR = open.right ? cell.w - w : 0;
  const extD = open.down ? cell.h - h : 0;
  const W2 = w + extR;
  const H2 = h + extD;
  const gapX = cell.w - w;
  const gapY = cell.h - h;
  // Esquinas interiores de las salas en L: este lado sigue por encima del hueco de la casilla vecina
  const tl = open.topLeft ? gapX : 0;
  const bl = open.bottomLeft ? gapX : 0;
  const ru = open.rightUp ? gapY : 0;
  const lu = open.leftUp ? gapY : 0;

  // Sombra de la pared de arriba y de los lados sobre el suelo
  const sh = scene.add.graphics().setDepth(0.3);
  for (let s = 0; s < 4; s++) {
    if (!open.up) sh.fillStyle(0x000000, 0.16 - s * 0.035).fillRect(room.x0 - tl, room.y0 + s * scale * 2, W2 + tl, scale * 2);
    if (!open.left) sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x0 + s * scale * 2, room.y0 - lu, scale * 2, H2 + lu);
    if (!open.right) sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x1 - (s + 1) * scale * 2, room.y0 - ru, scale * 2, H2 + ru);
  }
  // Borde de la pared con luz arriba (canto)
  if (!open.up) sh.fillStyle(shade(b.colors.wall, 0.35), 1).fillRect(tl ? room.x0 - tl : room.x0 - wall, room.y0 - wall, W2 + wall * 2 + (tl ? tl - wall : 0), scale);
  // Relieve de la pared como en Isaac: arriba se ve su cara (alta), abajo su parte de arriba (canto ancho) y a
  // los lados un poco de cada. El canto es piedra lisa clara; la cara, los bloques del bioma que oscurecen hacia el suelo.
  const relief = scene.add.graphics().setDepth(0.31);
  const capC = shade(b.colors.wall, 0.18);
  const capHi = shade(b.colors.wall, 0.45);
  const capLo = shade(b.colors.wall, -0.35);
  const ox0 = room.x0 - wall;
  const oy0 = room.y0 - wall;
  const ow = W2 + wall * 2;
  const oh = H2 + wall * 2;
  const cap = (x: number, y: number, cw: number, ch: number, horiz: boolean) => {
    relief.fillStyle(capC, 1).fillRect(x, y, cw, ch);
    // Motas para que la piedra no sea plana
    const n = Math.floor((cw * ch) / 90);
    for (let k = 0; k < n; k++) relief.fillStyle(r() < 0.5 ? capLo : capHi, 0.35).fillRect(x + Math.floor(r() * (cw - 3)), y + Math.floor(r() * (ch - 3)), 3, 3);
    // Juntas de las losas del canto
    if (horiz) for (let k = x + 40; k < x + cw; k += 80) relief.fillStyle(capLo, 0.6).fillRect(k, y + 2, 2, ch - 4);
    else for (let k = y + 40; k < y + ch; k += 80) relief.fillStyle(capLo, 0.6).fillRect(x + 2, k, cw - 4, 2);
  };
  // Arriba: canto fino y cara alta
  if (!open.up) {
    // En la esquina en L, desde la cara de la pared de la vecina (no desde fuera)
    const tx0 = tl ? room.x0 - tl : ox0;
    const tw = ox0 + ow - tx0;
    cap(tx0, oy0, tw, 12, true);
    relief.fillStyle(capHi, 1).fillRect(tx0, oy0, tw, 2);
    relief.fillStyle(capLo, 1).fillRect(tx0, oy0 + 12, tw, 2);
    for (let s = 0; s < 4; s++) relief.fillStyle(0x000000, 0.06 + s * 0.06).fillRect(room.x0 - tl, room.y0 - 26 + s * 6.5, W2 + tl, 6.5);
  }
  // Abajo: canto ancho (se ve desde arriba) y una cara corta en sombra
  if (!open.down) {
    const bx0 = bl ? room.x0 - bl : ox0;
    const bw = ox0 + ow - bx0;
    cap(bx0, room.y1 + 24, bw, wall - 24, true);
    relief.fillStyle(capHi, 1).fillRect(bx0, room.y1 + 24, bw, 2);
    relief.fillStyle(0x000000, 0.3).fillRect(room.x0 - bl, room.y1, W2 + bl, 10);
  }
  // Lados: canto por fuera y cara por dentro, más oscura junto al suelo
  // Lados: de arriba (o desde la vecina, en una esquina en L) hasta abajo, sin meterse en la casilla de abajo
  const sideEnd = room.y1 + extD + (open.down ? 0 : wall);
  if (!open.left) {
    const sy = lu ? room.y0 - lu : oy0;
    const len = sideEnd - sy;
    cap(ox0, sy, 16, len, false);
    relief.fillStyle(capHi, 1).fillRect(ox0, sy, 2, len);
    relief.fillStyle(capLo, 1).fillRect(ox0 + 16, sy, 2, len);
  }
  if (!open.right) {
    const sy = ru ? room.y0 - ru : oy0;
    const len = sideEnd - sy;
    cap(room.x1 + wall - 16, sy, 16, len, false);
    relief.fillStyle(capHi, 1).fillRect(room.x1 + wall - 16, sy, 2, len);
    relief.fillStyle(capLo, 1).fillRect(room.x1 + wall - 18, sy, 2, len);
  }
  for (let s = 0; s < 3; s++) {
    if (!open.left) relief.fillStyle(0x000000, 0.06 + s * 0.07).fillRect(room.x0 - 24 + s * 8, room.y0 - lu, 8, H2 + lu);
    if (!open.right) relief.fillStyle(0x000000, 0.06 + s * 0.07).fillRect(room.x1 + 16 - s * 8, room.y0 - ru, 8, H2 + ru);
  }
  // Viñeta: los bordes del suelo más oscuros, el centro más claro (como la luz de las salas de Isaac)
  const vig = scene.add.graphics().setDepth(0.29);
  // Sobre nieve el negro se ve como franjas grises sucias: ahí la sombra es azulada y más suave
  const snowy = lum(b.colors.floor) > 0.8;
  const vigC = snowy ? shade(b.colors.wall, 0.1) : 0x000000;
  for (let s = 0; s < 6; s++) {
    const d = 14 + s * 14;
    const a = snowy ? 0.035 : 0.05;
    if (!open.up) vig.fillStyle(vigC, a).fillRect(room.x0 - tl, room.y0, W2 + tl, d);
    if (!open.down) vig.fillStyle(vigC, a).fillRect(room.x0 - bl, room.y1 - d, W2 + bl, d);
    if (!open.left) vig.fillStyle(vigC, a).fillRect(room.x0, room.y0 - lu, d, H2 + lu);
    if (!open.right) vig.fillStyle(vigC, a).fillRect(room.x1 - d, room.y0 - ru, d, H2 + ru);
  }
  // Cara de la pared de arriba (en sombra), contorno entre pared y suelo y canto claro de las paredes de los lados
  // y de abajo: así la sala tiene relieve en vez de ser una franja plana (las puertas lo tapan con su suelo)
  const edge = scene.add.graphics().setDepth(0.32);
  const lip = shade(b.colors.wall, 0.4);
  if (!open.up) {
    edge.fillStyle(shade(b.colors.wall, -0.5), 0.55).fillRect(room.x0 - tl, room.y0 - 10, W2 + tl, 10);
    edge.fillStyle(K, 1).fillRect(room.x0 - 2 - tl, room.y0 - 2, W2 + 4 + tl, 2);
  }
  if (!open.down) {
    edge.fillStyle(K, 1).fillRect(room.x0 - 2 - bl, room.y1, W2 + 4 + bl, 2);
    edge.fillStyle(lip, 1).fillRect(room.x0 - 2 - bl, room.y1 + 2, W2 + 4 + bl, 3);
  }
  if (!open.left) {
    edge.fillStyle(K, 1).fillRect(room.x0 - 2, room.y0 - 2 - lu, 2, H2 + 4 + lu);
    edge.fillStyle(lip, 0.8).fillRect(room.x0 - 5, room.y0 - 2 - lu, 3, H2 + 4 + lu);
  }
  if (!open.right) {
    edge.fillStyle(K, 1).fillRect(room.x1, room.y0 - 2 - ru, 2, H2 + 4 + ru);
    edge.fillStyle(lip, 0.8).fillRect(room.x1 + 2, room.y0 - 2 - ru, 3, H2 + 4 + ru);
  }
  // Esquinas: un bloque más oscuro, como las piedras angulares (solo donde se juntan dos paredes de verdad)
  const corners: [number, number, boolean][] = [
    [room.x0 - wall, room.y0 - wall, !open.up && !open.left],
    [room.x1 + extR, room.y0 - wall, !open.up && !open.right],
    [room.x0 - wall, room.y1 + extD, !open.down && !open.left],
    [room.x1 + extR, room.y1 + extD, !open.down && !open.right],
  ];
  for (const [cx, cy, on] of corners) {
    if (!on) continue;
    edge.fillStyle(K, 1).fillRect(cx, cy, wall, wall);
    edge.fillStyle(shade(b.colors.wall, -0.1), 1).fillRect(cx + 3, cy + 3, wall - 6, wall - 6);
    edge.fillStyle(shade(b.colors.wall, 0.3), 1).fillRect(cx + 3, cy + 3, wall - 6, 3);
    edge.fillStyle(shade(b.colors.wall, -0.4), 1).fillRect(cx + 3, cy + wall - 6, wall - 6, 3);
  }
  // Adornos y luces de la pared, y la vida de la sala (llamas, partículas del bioma, destellos)
  const { lights, pool } = addWallDecor(scene, b, room, wall, scale, r, open);
  addRoomAmbient(scene, b.id, OUTSIDE[b.id] ?? 'trees', cell, room, wall, scale, shiny, hot, lights, pool);
}

/** Partícula del ambiente (dentro o fuera de la sala). */
interface Mote { x: number; y: number; t: number; life: number; c: number; v: number }

/** Cómo es el ambiente de dentro de cada bioma: cuántas partículas, cuánto viven y de qué colores. */
const WEATHER: Record<string, { max: number; life: number; cols: number[] }> = {
  bosque: { max: 6, life: 46, cols: [0x6cbf4a, 0xc8d84a, 0xe0a040] }, // hojas que caen
  pantano: { max: 7, life: 30, cols: [0xc8f07a] }, // luciérnagas verdes
  cueva: { max: 8, life: 40, cols: [0xe8dcc0] }, // polvo en el aire
  mar: { max: 7, life: 14, cols: [0xffffff] }, // brillos de sal
  volcan: { max: 12, life: 18, cols: [0xffe08a, 0xffa030, 0xe0402a] }, // brasas que suben
  torre: { max: 6, life: 34, cols: [0xb08cff, 0xd8c8ff] }, // fuegos fatuos
  ciudad: { max: 5, life: 40, cols: [0xe0e4ec] }, // polvo
  nieve: { max: 18, life: 70, cols: [0xffffff, 0xe8f4ff] }, // nieve
  cumbre: { max: 8, life: 44, cols: [0xf0b8d8, 0xffe0f0, 0xffffff] }, // pétalos y chispas
};

/**
 * Vida de la sala, con un solo temporizador por sala (se para al destruirla y solo redibuja si está en pantalla):
 *  - fuera: destellos sobre el agua, burbujas de lava y pantano, copos sobre los pinos, estrellas, luciérnagas;
 *  - dentro: hojas, nieve, brasas, polvo, fuegos fatuos o pétalos según el bioma (pocas partículas);
 *  - llamas de las antorchas que bailan y su charco de luz que tiembla; grietas de lava que palpitan y lodo que burbujea;
 *  - brillos de cuatro puntas sobre los detalles que brillan.
 * Con efectos bajos, nada se mueve (las llamas ya están pintadas quietas).
 */
function addRoomAmbient(
  scene: Phaser.Scene,
  biomeId: string,
  kind: Outside,
  cell: { x: number; y: number; w: number; h: number },
  room: { x0: number; y0: number; x1: number; y1: number },
  wall: number,
  u: number,
  shiny: [number, number][],
  hot: [number, number][],
  lights: WallLight[],
  pool?: Phaser.GameObjects.Graphics,
) {
  if (lowFx()) return;
  const g = scene.add.graphics().setDepth(0.12);
  // Encima de rocas y hierba (1-2), debajo de los Pokémon (3+)
  const gw = scene.add.graphics().setDepth(2.5);
  const gl = scene.add.graphics().setDepth(0.34);
  const parts: { x: number; y: number; t: number }[] = [];
  const motes: Mote[] = [];
  const life = kind === 'pines' ? 22 : kind === 'trees' ? 16 : 7;
  const max = kind === 'roofs' || kind === 'rocks' ? 0 : 10;
  const wx = WEATHER[biomeId] ?? WEATHER.bosque;
  const snap = (v: number) => Math.round(v / u) * u;
  // Un punto al azar fuera de la sala (en el paisaje de alrededor), alineado a la rejilla del píxel gordo
  const outside = () => {
    for (let n = 0; n < 6; n++) {
      const x = cell.x + Math.random() * cell.w;
      const y = cell.y + Math.random() * cell.h;
      if (x > room.x0 - wall - u && x < room.x1 + wall + u && y > room.y0 - wall - u && y < room.y1 + wall + u) continue;
      return { x: snap(x), y: snap(y), t: 0 };
    }
    return undefined;
  };
  const spawnMote = (): Mote => {
    const w = room.x1 - room.x0;
    const h = room.y1 - room.y0;
    const c = wx.cols[Math.floor(Math.random() * wx.cols.length)];
    let x = room.x0 + Math.random() * w;
    let y = room.y0 + Math.random() * h;
    if (biomeId === 'volcan' && hot.length && Math.random() < 0.6) [x, y] = hot[Math.floor(Math.random() * hot.length)];
    if (biomeId === 'bosque' || biomeId === 'nieve') y = room.y0 - wall + Math.random() * h * (biomeId === 'nieve' ? 1 : 0.4);
    return { x, y, t: 0, life: Math.round(wx.life * (0.7 + Math.random() * 0.6)), c, v: Math.random() * 6.28 };
  };
  let sparkle = -1;
  let k = 0;
  const ev = scene.time.addEvent({ delay: 140, loop: true, callback: () => {
    if (!g.active) return ev.remove();
    const v = scene.cameras.main.worldView;
    if (v.width > 0 && (v.right < cell.x || v.x > cell.x + cell.w || v.bottom < cell.y || v.y > cell.y + cell.h)) return;
    k++;
    g.clear();
    gw.clear();
    gl.clear();
    // --- Fuera ---
    for (let i = parts.length - 1; i >= 0; i--) if (++parts[i].t > life) parts.splice(i, 1);
    if (parts.length < max && Math.random() < 0.6) {
      const p = outside();
      if (p) parts.push(p);
    }
    for (const p of parts) {
      const t = p.t;
      const fade = 1 - t / life;
      switch (kind) {
        case 'water': {
          const w = t < 3 ? t + 1 : 7 - t;
          if (w > 0) g.fillStyle(0xffffff, 0.8).fillRect(p.x - w * u, p.y, w * 2 * u, u);
          break;
        }
        case 'lava':
        case 'swamp': {
          const c = kind === 'lava' ? (t < 4 ? 0xffa030 : 0xffe08a) : t < 4 ? 0x7a9a5a : 0xb8d890;
          const sz = t < 2 ? 1 : t < 5 ? 2 : 0;
          if (sz) g.fillStyle(c, 0.9).fillRect(p.x, p.y - t * (u / 2), sz * u, sz * u);
          else if (t === 5) g.fillStyle(c, 0.6).fillRect(p.x - u, p.y - 3 * u, u, u).fillRect(p.x + 2 * u, p.y - 3 * u, u, u);
          break;
        }
        case 'pines':
          g.fillStyle(0xffffff, 0.9 * fade + 0.1).fillRect(p.x + Math.round(Math.sin((t + p.x) / 3)) * u, p.y + t * u, u, u);
          break;
        case 'stars':
          g.fillStyle(0xffffff, Math.sin((t / life) * Math.PI)).fillRect(p.x, p.y, u, u);
          if (t === 3 || t === 4) g.fillStyle(0xd8c8ff, 0.7).fillRect(p.x - u, p.y, 3 * u, u).fillRect(p.x, p.y - u, u, 3 * u);
          break;
        case 'trees':
          g.fillStyle(0xfff38a, Math.sin((t / life) * Math.PI)).fillRect(p.x + Math.round(Math.sin(t / 2) * 2) * u, p.y - Math.floor(t / 3) * u, u, u);
          break;
      }
    }
    // --- Dentro: el tiempo del bioma ---
    for (let i = motes.length - 1; i >= 0; i--) if (++motes[i].t > motes[i].life) motes.splice(i, 1);
    if (motes.length < wx.max && Math.random() < 0.5) motes.push(spawnMote());
    for (const m of motes) {
      const t = m.t;
      const a = Math.min(1, Math.sin((t / m.life) * Math.PI) * 1.6);
      const sway = Math.round(Math.sin(t / 4 + m.v) * 2) * u;
      switch (biomeId) {
        case 'bosque':
          // Hoja: baja despacio meciéndose y gira (alterna ancho y alto)
          gw.fillStyle(m.c, a).fillRect(snap(m.x + sway * 2), snap(m.y + t * u * 0.8), (t >> 2) % 2 ? u * 2 : u, (t >> 2) % 2 ? u : u * 2);
          break;
        case 'nieve':
          gw.fillStyle(m.c, a * 0.95).fillRect(snap(m.x + sway), snap(m.y + t * u * 0.9), u, u);
          break;
        case 'volcan':
          gw.fillStyle(t < m.life * 0.4 ? wx.cols[0] : t < m.life * 0.75 ? wx.cols[1] : wx.cols[2], a).fillRect(snap(m.x + sway / 2), snap(m.y - t * u), u, u);
          break;
        case 'torre':
          gw.fillStyle(m.c, a * 0.55).fillRect(snap(m.x + sway * 2), snap(m.y - t * u * 0.5), u * 2, u * 2);
          gw.fillStyle(0xffffff, a * 0.6).fillRect(snap(m.x + sway * 2), snap(m.y - t * u * 0.5), u, u);
          break;
        case 'pantano':
          gw.fillStyle(m.c, a).fillRect(snap(m.x + sway * 2), snap(m.y + Math.cos(t / 5 + m.v) * 3 * u), u, u);
          break;
        case 'cumbre':
          gw.fillStyle(m.c, a).fillRect(snap(m.x + t * u * 0.5 + sway), snap(m.y + t * u * 0.4), u, u);
          break;
        case 'mar': {
          // Brillo de sal que titila en su sitio
          const s = t < m.life / 2 ? 1 : 0;
          gw.fillStyle(0xffffff, a).fillRect(snap(m.x), snap(m.y), u, u);
          if (s && t % 4 === 2) gw.fillStyle(0xffffff, a * 0.6).fillRect(snap(m.x) - u, snap(m.y), u * 3, u).fillRect(snap(m.x), snap(m.y) - u, u, u * 3);
          break;
        }
        default:
          // Polvo: flota muy despacio
          gw.fillStyle(m.c, a * 0.45).fillRect(snap(m.x + sway), snap(m.y - t * u * 0.15), u, u);
      }
    }
    // Gota que cae de una estalactita o un carámbano y salpica
    if ((biomeId === 'cueva' || biomeId === 'nieve') && k % 26 < 8) {
      const dx = snap(room.x0 + ((k * 211) % (room.x1 - room.x0)));
      const s = k % 26;
      if (s < 6) gw.fillStyle(0xbfe6ff, 0.9).fillRect(dx, room.y0 - 6 + s * u * 3, u, u * 2);
      else gw.fillStyle(0xbfe6ff, 0.7).fillRect(dx - u * 2, room.y0 + 6 * u * 3 - 2, u, u).fillRect(dx + u * 2, room.y0 + 6 * u * 3 - 2, u, u);
    }
    // --- Grietas de lava que palpitan / lodo que burbujea ---
    for (let i = 0; i < hot.length; i++) {
      const [hx, hy] = hot[i];
      if (biomeId === 'volcan') {
        const a = 0.25 + 0.25 * Math.sin(k / 4 + i * 1.7);
        g.fillStyle(0xff8a3a, a).fillRect(snap(hx) - u, snap(hy) - u, u * 3, u * 3);
      } else {
        const s = (k + i * 7) % 18;
        if (s < 5) g.fillStyle(0x8a7a50, 0.9).fillRect(snap(hx + ((i * 13) % 20) - 10), snap(hy) - s * (u / 2), (s < 3 ? 1 : 2) * u, (s < 3 ? 1 : 2) * u);
        else if (s === 5) g.fillStyle(0x8a7a50, 0.6).fillRect(snap(hx) - u * 2, snap(hy) - u * 3, u, u).fillRect(snap(hx) + u * 2, snap(hy) - u * 3, u, u);
      }
    }
    // --- Luces de la pared ---
    for (const l of lights) {
      if (l.kind === 'flame') {
        const hgt = 3 + Math.floor(Math.random() * 3);
        const lean = Math.random() < 0.3 ? (Math.random() < 0.5 ? -u : u) : 0;
        gl.fillStyle(l.c[0], 1).fillRect(l.x - u, l.y + 2 * u - hgt * u, u * 2, hgt * u);
        gl.fillStyle(l.c[0], 1).fillRect(l.x - u + lean, l.y + 2 * u - (hgt + 1) * u, u, u);
        gl.fillStyle(l.c[1], 1).fillRect(l.x - u, l.y + 2 * u - (hgt - 1) * u, u * 2, (hgt - 1) * u);
        gl.fillStyle(l.c[2], 1).fillRect(l.x - (k % 2) * u, l.y, u, u * 2);
        // Chispa que se escapa
        if (k % 7 === 0) gl.fillStyle(l.c[1], 0.9).fillRect(l.x + lean, l.y - (hgt + 2) * u, u, u);
      } else if (l.kind === 'glow') {
        const a = 0.35 + 0.3 * Math.sin(k / 5 + l.x);
        gl.fillStyle(l.c[1], a).fillRect(l.x - u * 2, l.y - u * 2, u * 4, u * 4);
        gl.fillStyle(l.c[2], a).fillRect(l.x - u, l.y - u, u * 2, u * 2);
      }
    }
    if (pool) {
      const flick = lights.some((l) => l.kind === 'flame');
      pool.setAlpha(flick ? 0.8 + Math.random() * 0.2 : lights[0]?.kind === 'lamp' ? (Math.random() < 0.03 ? 0.35 : 1) : 0.75 + 0.25 * Math.sin(k / 6));
    }
    // Brillo de cuatro puntas en uno de los detalles que brillan
    if (shiny.length) {
      if (sparkle < 0 && k % 9 === 0) sparkle = Math.floor(Math.random() * shiny.length);
      if (sparkle >= 0) {
        const [sx, sy] = shiny[sparkle];
        const f = k % 9;
        const a = f < 2 ? 0.6 : f < 4 ? 1 : f < 6 ? 0.5 : 0;
        if (a > 0) {
          const x = Math.round((sx - u) / u) * u;
          const y = Math.round((sy - 2 * u) / u) * u;
          g.fillStyle(0xffffff, a).fillRect(x, y - u, u, 3 * u).fillRect(x - u, y, 3 * u, u);
        }
        if (f === 8) sparkle = -1;
      }
    }
  } });
  g.once(Phaser.GameObjects.Events.DESTROY, () => {
    ev.remove();
    gw.destroy();
    gl.destroy();
  });
}

/**
 * Alfombra de las salas especiales (Centro, tienda, objeto) en píxel gordo, como el resto del suelo: trama tejida,
 * doble ribete, medallón en el centro, motivos en las esquinas y flecos. `q` = tamaño de un píxel del arte.
 */
export function drawRoomRug(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, q: number, depth = 0.2) {
  const g = scene.add.graphics().setDepth(depth);
  const sn = (v: number) => Math.round(v / q) * q;
  x = sn(x);
  y = sn(y);
  w = sn(w);
  h = sn(h);
  // Los colores de sala son muy pálidos: la alfombra los oscurece un poco para que se lea sobre cualquier suelo
  const body = shade(color, -0.1);
  const edge = shade(color, -0.55);
  const weave = shade(color, -0.17);
  const hi = shade(color, 0.6);
  const mid = shade(color, -0.36);
  // Sombra y canto
  g.fillStyle(0x000000, 0.22).fillRect(x + q * 2, y + q * 2, w, h);
  g.fillStyle(edge, 1).fillRect(x, y, w, h);
  g.fillStyle(body, 1).fillRect(x + q * 2, y + q * 2, w - q * 4, h - q * 4);
  // Trama: hilos horizontales alternos y algún nudo
  for (let yy = y + q * 3; yy < y + h - q * 3; yy += q * 3) g.fillStyle(weave, 1).fillRect(x + q * 2, yy, w - q * 4, q);
  for (let k = 0; k < (w * h) / (q * q * 90); k++) {
    const kx = x + q * 3 + Math.floor(((k * 7919) % 997) / 997 * (w / q - 6)) * q;
    const ky = y + q * 3 + Math.floor(((k * 104729) % 991) / 991 * (h / q - 6)) * q;
    g.fillStyle(k % 2 ? hi : mid, 0.5).fillRect(kx, ky, q, q);
  }
  // Doble ribete
  const ring = (ins: number, c: number, t = q) => {
    g.fillStyle(c, 1)
      .fillRect(x + ins, y + ins, w - ins * 2, t)
      .fillRect(x + ins, y + h - ins - t, w - ins * 2, t)
      .fillRect(x + ins, y + ins, t, h - ins * 2)
      .fillRect(x + w - ins - t, y + ins, t, h - ins * 2);
  };
  ring(q * 2, mid, q * 2);
  ring(q * 5, hi, q * 2);
  ring(q * 8, mid);
  // Medallón: rombo escalonado en el centro
  const cx = sn(x + w / 2);
  const cy = sn(y + h / 2);
  const dia = (r: number, c: number) => {
    for (let k = -r; k <= r; k++) g.fillStyle(c, 1).fillRect(cx - (r - Math.abs(k)) * q, cy + k * q, (r - Math.abs(k)) * q * 2 + q, q);
  };
  dia(12, edge);
  dia(11, mid);
  dia(8, hi);
  dia(6, body);
  dia(3, mid);
  dia(1, hi);
  // Rombos pequeños hacia los lados y motivos en las esquinas
  for (const dx of [-0.3, 0.3]) {
    const mx = sn(cx + w * dx);
    for (let k = -3; k <= 3; k++) g.fillStyle(mid, 1).fillRect(mx - (3 - Math.abs(k)) * q, cy + k * q, (3 - Math.abs(k)) * q * 2 + q, q);
    g.fillStyle(hi, 1).fillRect(mx, cy, q, q);
  }
  for (const [ex, ey] of [[x + q * 11, y + q * 11], [x + w - q * 14, y + q * 11], [x + q * 11, y + h - q * 14], [x + w - q * 14, y + h - q * 14]]) {
    g.fillStyle(mid, 1).fillRect(ex, ey + q, q * 3, q).fillRect(ex + q, ey, q, q * 3);
    g.fillStyle(hi, 1).fillRect(ex + q, ey + q, q, q);
  }
  // Flecos arriba y abajo
  for (let fx = x + q * 2; fx < x + w - q * 2; fx += q * 3) {
    g.fillStyle(hi, 1).fillRect(fx, y - q * 2, q, q * 2).fillRect(fx, y + h, q, q * 2);
    g.fillStyle(mid, 1).fillRect(fx, y - q * 3, q, q).fillRect(fx, y + h + q * 2, q, q);
  }
  return g;
}
