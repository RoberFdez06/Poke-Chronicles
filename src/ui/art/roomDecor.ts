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
const PEBBLE: Decal = { rows: ['........', '........', '..kkk...', '.kWRRk..', '.kRRrk..', '..kkk.k.', '.....kRk', '......k.'], pal: { k: K, R: 0x9a8a7a, r: 0x6e6052, W: 0xd8ccb8 } };
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
        g.fillStyle(0xe0402a, 1).fillRect(0, 14, 32, 4).fillRect(14, 0, 4, 32);
        g.fillStyle(0xffa030, 1).fillRect(0, 15, 32, 2).fillRect(15, 0, 2, 32);
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

  // Sombra de la pared de arriba y de los lados sobre el suelo
  const sh = scene.add.graphics().setDepth(0.3);
  for (let s = 0; s < 4; s++) {
    sh.fillStyle(0x000000, 0.16 - s * 0.035).fillRect(room.x0, room.y0 + s * scale * 2, w, scale * 2);
    sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x0 + s * scale * 2, room.y0, scale * 2, h);
    sh.fillStyle(0x000000, 0.1 - s * 0.022).fillRect(room.x1 - (s + 1) * scale * 2, room.y0, scale * 2, h);
  }
  // Borde de la pared con luz arriba (canto)
  sh.fillStyle(shade(b.colors.wall, 0.35), 1).fillRect(room.x0 - wall, room.y0 - wall, w + wall * 2, scale);
}
