// Decorado de las salas por bioma (supervisor), al estilo de las rutas de Pokémon GBA:
//  - fuera de la sala, el paisaje del bioma (copas de árboles, rocas, agua, tejados…) en vez de vacío;
//  - en el suelo, manchas de color y detalles sueltos (flores, matojos, piedrecitas, conchas, cristales…);
//  - sombra de la pared sobre el suelo para dar profundidad.
// Todo es dibujo: no choca con nada. Se repite igual en cada visita a la sala (semilla por sala).
import Phaser from 'phaser';
import { shade, TILE, type BiomeLook } from './tiles';

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

/** Detalles 8x8: '.' vacío; letras = colores de su paleta. */
interface Decal { rows: string[]; pal: Record<string, number> }
const K = 0x18202c;
const FLOWER_R: Decal = { rows: ['........', '...rr...', '..rWWr..', '..rWWr..', '...rr...', '...g....', '..gg....', '........'], pal: { r: 0xe8483a, W: 0xffe066, g: 0x2f8a3a } };
const FLOWER_Y: Decal = { rows: ['........', '..y..y..', '...yy...', '..yOOy..', '...yy...', '..y.gy..', '....g...', '........'], pal: { y: 0xffe066, O: 0xe08a20, g: 0x2f8a3a } };
const TUFT: Decal = { rows: ['........', '........', '.g...g..', '.gg.gg..', '..gGg.g.', '.gGgGgg.', '........', '........'], pal: { g: 0x2f7a2a, G: 0x58b848 } };
const PEBBLE: Decal = { rows: ['........', '........', '...ddd..', '..dWRRd.', '..dRRrd.', '..drrrd.', '...ddd..', '........'], pal: { d: 0x5e544a, R: 0x9a8a7a, r: 0x7a6c5e, W: 0xd8ccb8 } };
const CRYSTAL: Decal = { rows: ['....k...', '...kCk..', '..kCWk..', '..kCCk.k', '.k.kCkkC', 'kCk.kkCC', 'kCCkkCCk', '.kkkkkk.'], pal: { k: K, C: 0x8fd8ff, W: 0xffffff } };
const SHELL: Decal = { rows: ['........', '...kkk..', '..kPWPk.', '.kPpPpPk', '.kPpPpPk', '..kPPPk.', '...kkk..', '........'], pal: { k: K, P: 0xf4b8c8, p: 0xd88aa0, W: 0xffffff } };
const STAR: Decal = { rows: ['...k....', '..kOk...', 'kkkOOkkk', 'kOOOOOOk', '.kOOOOk.', '.kOkkOk.', 'kOk..kOk', 'kk....kk'], pal: { k: K, O: 0xf08a3a } };
const EMBER: Decal = { rows: ['........', '..k..k..', '.kRk.kk.', '..kOk...', '.kOYOk..', '..kOk.k.', '...k.kRk', '......k.'], pal: { k: 0x3a1a14, R: 0xe0402a, O: 0xffa030, Y: 0xffe066 } };
const CRACK: Decal = { rows: ['........', '..k.....', '...k....', '...kk...', '.....k..', '....k.k.', '...k...k', '........'], pal: { k: 0x00000 } };
const SNOWPILE: Decal = { rows: ['........', '........', '...WW...', '..WWWW..', '.WWWWBW.', 'WWWWBBWW', 'BBBBBBBB', '........'], pal: { W: 0xffffff, B: 0xb8d0e4 } };
const MUSHROOM: Decal = { rows: ['........', '..kkkk..', '.kRWRRk.', 'kRRRRWRk', 'kkkkkkkk', '...kWk..', '...kWk..', '...kkk..'], pal: { k: K, R: 0xc8402a, W: 0xffffff } };
const LILY: Decal = { rows: ['........', '..kkkk..', '.kGGgGk.', 'kGGGG.Gk', 'kGgGG..k', '.kGGGGk.', '..kkkk..', '........'], pal: { k: 0x1d3a1a, G: 0x58b848, g: 0x2f7a2a } };
const LEAF: Decal = { rows: ['........', '......k.', '....kOk.', '...kOOk.', '..kOOk..', '.kOOk...', '.kk.....', 'k.......'], pal: { k: 0x5a2a14, O: 0xe08a3a } };
const RUNE: Decal = { rows: ['..PPPP..', '.P....P.', 'P..PP..P', 'P.P..P.P', 'P.P..P.P', 'P..PP..P', '.P....P.', '..PPPP..'], pal: { P: 0x8a6fc8 } };

const DECALS: Record<string, Decal[]> = {
  bosque: [FLOWER_R, FLOWER_Y, TUFT, TUFT, TUFT, PEBBLE],
  pantano: [MUSHROOM, LILY, TUFT, TUFT, PEBBLE],
  cueva: [PEBBLE, PEBBLE, CRYSTAL, CRACK],
  volcan: [EMBER, EMBER, PEBBLE, CRACK],
  mar: [SHELL, STAR, PEBBLE, PEBBLE],
  torre: [RUNE, CRACK, PEBBLE],
  ciudad: [LEAF, LEAF, CRACK, TUFT],
  nieve: [SNOWPILE, SNOWPILE, PEBBLE, CRACK],
  cumbre: [PEBBLE, TUFT, FLOWER_Y, CRYSTAL],
};

/** Qué hay fuera de la sala en cada bioma. */
type Outside = 'trees' | 'pines' | 'swamp' | 'rocks' | 'lava' | 'water' | 'roofs' | 'stars';
const OUTSIDE: Record<string, Outside> = {
  bosque: 'trees', pantano: 'swamp', nieve: 'pines', cueva: 'rocks', cumbre: 'rocks', volcan: 'lava', mar: 'water', ciudad: 'roofs', torre: 'stars',
};

/** Paisaje de fuera (32x32, se repite). */
function drawOutside(g: G, b: BiomeLook, kind: Outside) {
  const w = b.colors.wall;
  const fill = (c: number) => g.fillStyle(c, 1).fillRect(0, 0, TILE, TILE);
  const blob = (x: number, y: number, r: number, base: number, top: number) => {
    g.fillStyle(K, 1).fillCircle(x, y + 1, r + 1);
    g.fillStyle(base, 1).fillCircle(x, y, r);
    g.fillStyle(top, 1).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.45);
  };
  switch (kind) {
    case 'trees':
    case 'swamp':
    case 'pines': {
      // Copas de árboles apretadas, como los bordes de las rutas
      const base = kind === 'swamp' ? 0x4a6a3a : kind === 'pines' ? 0x2e5a4a : 0x3a8a3a;
      const top = kind === 'swamp' ? 0x7a9a5a : kind === 'pines' ? 0xffffff : 0x6ccf5a;
      fill(shade(base, -0.45));
      for (const [x, y] of [[8, 8], [24, 8], [0, 24], [16, 24], [32, 24], [-8, 8], [40, 8], [8, 40], [24, 40], [16, -8], [0, -8], [32, -8]]) blob(x, y, 9, base, top);
      break;
    }
    case 'rocks':
    case 'lava': {
      fill(kind === 'lava' ? 0x3a1410 : shade(w, -0.3));
      if (kind === 'lava') {
        // Charcas de lava entre las rocas (no una rejilla de líneas rectas)
        for (const [x, y, r] of [[16, 16, 5], [0, 0, 4], [32, 0, 4], [0, 32, 4], [32, 32, 4], [3, 17, 2], [18, 2, 2]] as const) {
          g.fillStyle(0x7a1a0a, 1).fillCircle(x, y, r + 1);
          g.fillStyle(0xe0402a, 1).fillCircle(x, y, r);
          g.fillStyle(0xffa030, 1).fillCircle(x - 1, y - 1, Math.max(1, r - 2));
          if (r > 3) g.fillStyle(0xffe08a, 1).fillRect(x - 2, y - 2, 2, 2);
        }
      }
      for (const [x, y, r] of [[7, 7, 7], [24, 6, 6], [8, 25, 6], [25, 24, 8]] as const) blob(x, y, r, b.colors.rock, b.colors.rockTop);
      break;
    }
    case 'water': {
      fill(0x2e78c8);
      g.fillStyle(0x5aa0e8, 1).fillRect(2, 6, 10, 2).fillRect(18, 18, 10, 2).fillRect(6, 26, 8, 2);
      g.fillStyle(0xffffff, 0.8).fillRect(4, 5, 4, 1).fillRect(20, 17, 4, 1);
      break;
    }
    case 'roofs': {
      fill(0x8a3a3a);
      for (let y = 0; y < 32; y += 8) {
        g.fillStyle(0xb85050, 1).fillRect(0, y, 32, 6);
        g.fillStyle(0x5a2020, 1).fillRect(0, y + 6, 32, 2);
        for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) g.fillStyle(0x5a2020, 1).fillRect(x, y, 1, 6);
      }
      break;
    }
    case 'stars': {
      fill(0x140e28);
      for (const [x, y] of [[4, 6], [20, 3], [12, 18], [27, 22], [6, 28]]) g.fillStyle(0xffffff, 1).fillRect(x, y, 1, 1);
      g.fillStyle(0xb9a6d8, 1).fillRect(16, 10, 2, 2);
      break;
    }
  }
}

/** Crea (una vez por bioma) las texturas del decorado. */
export function bakeRoomDecor(scene: Phaser.Scene, b: BiomeLook) {
  const outKey = `outside-${b.id}`;
  if (!scene.textures.exists(outKey)) {
    const g = scene.make.graphics({}, false);
    drawOutside(g, b, OUTSIDE[b.id] ?? 'trees');
    g.generateTexture(outKey, TILE, TILE);
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
  open: { left?: boolean; right?: boolean; up?: boolean; down?: boolean } = {},
) {
  bakeRoomDecor(scene, b);
  const r = rng(seed * 7919 + 13);
  // Paisaje de fuera, detrás de todo
  scene.add.tileSprite(cell.x, cell.y, cell.w, cell.h, `outside-${b.id}`).setOrigin(0).setTileScale(scale).setDepth(-1);

  const w = room.x1 - room.x0;
  const h = room.y1 - room.y0;
  // Manchas grandes y suaves de otro tono (sin ellas el suelo se ve plano)
  const patches = scene.add.graphics().setDepth(0.05);
  for (let i = 0; i < 7; i++) {
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

  // Detalles sueltos (más los de vegetación)
  const set = DECALS[b.id] ?? DECALS.bosque;
  const n = 26 + Math.floor(r() * 12);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(r() * set.length);
    const x = room.x0 + 16 + r() * (w - 32);
    const y = room.y0 + 24 + r() * (h - 40);
    const img = scene.add.image(x, y, `decal-${b.id}-${k}`).setScale(scale).setDepth(0.1);
    if (set[k] === CRACK) img.setAlpha(0.25);
    if (r() < 0.5) img.setFlipX(true);
  }

  // En una sala grande, cada casilla pinta también el hueco que la une con la de la derecha o la de abajo
  // (`extR`, `extD`) y no pinta nada en los lados unidos: así sombras, viñeta y paredes siguen sin cortes.
  const extR = open.right ? cell.w - w : 0;
  const extD = open.down ? cell.h - h : 0;
  const W2 = w + extR;
  const H2 = h + extD;

  // Sombra de la pared de arriba y de los lados sobre el suelo
  const sh = scene.add.graphics().setDepth(0.3);
  for (let s = 0; s < 4; s++) {
    if (!open.up) sh.fillStyle(0x000000, 0.16 - s * 0.035).fillRect(room.x0, room.y0 + s * scale * 2, W2, scale * 2);
    if (!open.left) sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x0 + s * scale * 2, room.y0, scale * 2, H2);
    if (!open.right) sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x1 - (s + 1) * scale * 2, room.y0, scale * 2, H2);
  }
  // Borde de la pared con luz arriba (canto)
  if (!open.up) sh.fillStyle(shade(b.colors.wall, 0.35), 1).fillRect(room.x0 - wall, room.y0 - wall, W2 + wall * 2, scale);
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
    cap(ox0, oy0, ow, 12, true);
    relief.fillStyle(capHi, 1).fillRect(ox0, oy0, ow, 2);
    relief.fillStyle(capLo, 1).fillRect(ox0, oy0 + 12, ow, 2);
    for (let s = 0; s < 4; s++) relief.fillStyle(0x000000, 0.06 + s * 0.06).fillRect(room.x0, room.y0 - 26 + s * 6.5, W2, 6.5);
  }
  // Abajo: canto ancho (se ve desde arriba) y una cara corta en sombra
  if (!open.down) {
    cap(ox0, room.y1 + 24, ow, wall - 24, true);
    relief.fillStyle(capHi, 1).fillRect(ox0, room.y1 + 24, ow, 2);
    relief.fillStyle(0x000000, 0.3).fillRect(room.x0, room.y1, W2, 10);
  }
  // Lados: canto por fuera y cara por dentro, más oscura junto al suelo
  if (!open.left) {
    cap(ox0, oy0, 16, oh, false);
    relief.fillStyle(capHi, 1).fillRect(ox0, oy0, 2, oh);
    relief.fillStyle(capLo, 1).fillRect(ox0 + 16, oy0, 2, oh);
  }
  if (!open.right) {
    cap(room.x1 + wall - 16, oy0, 16, oh, false);
    relief.fillStyle(capHi, 1).fillRect(room.x1 + wall - 16, oy0, 2, oh);
    relief.fillStyle(capLo, 1).fillRect(room.x1 + wall - 18, oy0, 2, oh);
  }
  for (let s = 0; s < 3; s++) {
    if (!open.left) relief.fillStyle(0x000000, 0.06 + s * 0.07).fillRect(room.x0 - 24 + s * 8, room.y0, 8, H2);
    if (!open.right) relief.fillStyle(0x000000, 0.06 + s * 0.07).fillRect(room.x1 + 16 - s * 8, room.y0, 8, H2);
  }
  // Viñeta: los bordes del suelo más oscuros, el centro más claro (como la luz de las salas de Isaac)
  const vig = scene.add.graphics().setDepth(0.29);
  for (let s = 0; s < 6; s++) {
    const d = 14 + s * 14;
    const a = 0.05;
    if (!open.up) vig.fillStyle(0x000000, a).fillRect(room.x0, room.y0, W2, d);
    if (!open.down) vig.fillStyle(0x000000, a).fillRect(room.x0, room.y1 - d, W2, d);
    if (!open.left) vig.fillStyle(0x000000, a).fillRect(room.x0, room.y0, d, H2);
    if (!open.right) vig.fillStyle(0x000000, a).fillRect(room.x1 - d, room.y0, d, H2);
  }
  // Cara de la pared de arriba (en sombra), contorno entre pared y suelo y canto claro de las paredes de los lados
  // y de abajo: así la sala tiene relieve en vez de ser una franja plana (las puertas lo tapan con su suelo)
  const edge = scene.add.graphics().setDepth(0.32);
  const lip = shade(b.colors.wall, 0.4);
  if (!open.up) {
    edge.fillStyle(shade(b.colors.wall, -0.5), 0.55).fillRect(room.x0, room.y0 - 10, W2, 10);
    edge.fillStyle(K, 1).fillRect(room.x0 - 2, room.y0 - 2, W2 + 4, 2);
  }
  if (!open.down) {
    edge.fillStyle(K, 1).fillRect(room.x0 - 2, room.y1, W2 + 4, 2);
    edge.fillStyle(lip, 1).fillRect(room.x0 - 2, room.y1 + 2, W2 + 4, 3);
  }
  if (!open.left) {
    edge.fillStyle(K, 1).fillRect(room.x0 - 2, room.y0 - 2, 2, H2 + 4);
    edge.fillStyle(lip, 0.8).fillRect(room.x0 - 5, room.y0 - 2, 3, H2 + 4);
  }
  if (!open.right) {
    edge.fillStyle(K, 1).fillRect(room.x1, room.y0 - 2, 2, H2 + 4);
    edge.fillStyle(lip, 0.8).fillRect(room.x1 + 2, room.y0 - 2, 3, H2 + 4);
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
}
