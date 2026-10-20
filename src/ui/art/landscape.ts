// Paisaje pixel art al estilo GBA para el fondo de los menús: se dibuja a 240x160 (la pantalla de la
// Game Boy Advance) y se escala x4 sin suavizar, así 960x640 queda con píxeles gordos y nítidos.
// Capas con parallax: cielo con bandas, sol, nubes, montañas, colinas (o mar) y suelo con camino.
import Phaser from 'phaser';
import { BAND, COVER_H, COVER_W, DCX, DCY } from '../layout';
import { mulberry32 } from '../../level/floorGen';
import { lowFx } from '../theme';

export const PIX = { w: 240, h: 160, scale: 4 } as const;
/** Altura (en píxeles GBA) por la que caminan los Pokémon del menú. */
export const WALK_Y = 146;

type Pair = [number, number];

export interface LandscapeArt {
  id: string;
  name: string;
  /** Bandas del cielo de arriba a abajo. */
  sky: number[];
  sun: { color: number; glow: number; y: number; r: number };
  cloud: Pair;
  far: Pair;
  /** Nieve en las cumbres. */
  cap?: number;
  /** Colinas: color, sombra, brillo del borde. */
  mid?: [number, number, number];
  /** Árboles sobre las colinas: copa, brillo, tronco. */
  trees?: [number, number, number];
  /** Mar en lugar de colinas: agua y destellos. */
  sea?: Pair;
  near: Pair;
  path: Pair;
  flowers: number[];
}

/** Ambientes del menú: de día (azul y verde) y de atardecer. */
export const LANDSCAPES: LandscapeArt[] = [
  {
    id: 'pradera', name: 'Pradera',
    sky: [0x3870e0, 0x5090f0, 0x70a8f8, 0x90c8f8, 0xb8e0f8],
    sun: { color: 0xf8f8c8, glow: 0xd8f0f8, y: 26, r: 9 },
    cloud: [0xffffff, 0xc8d8f0], far: [0x6888c0, 0x88a8d8],
    mid: [0x48a040, 0x307830, 0x78c860],
    near: [0x68b840, 0x489030], path: [0xe0c888, 0xb89860], flowers: [0xf86888, 0xf8e050, 0xffffff],
  },
  {
    id: 'bosque', name: 'Bosque',
    sky: [0x4078d8, 0x5898e8, 0x78b8f0, 0xa0d0f0, 0xc8e8f0],
    sun: { color: 0xf8f8d0, glow: 0xd8f0f0, y: 22, r: 8 },
    cloud: [0xffffff, 0xc0d8e8], far: [0x5878a8, 0x7898c0],
    mid: [0x3a8a3a, 0x266626, 0x5aaa4a], trees: [0x2f7a32, 0x4fa046, 0x6a4a2a],
    near: [0x5aa83a, 0x3a7a2a], path: [0xc8a870, 0xa08050], flowers: [0xf8f8f8, 0xf8a8c8],
  },
  {
    id: 'costa', name: 'Costa al atardecer',
    sky: [0x40306a, 0x7a3a7a, 0xc85a70, 0xf08a58, 0xf8c060],
    sun: { color: 0xf8e078, glow: 0xf8a868, y: 100, r: 16 },
    cloud: [0xf8b8a0, 0xc07898], far: [0x5a3a6a, 0x7a4a7a],
    sea: [0x2a4a8a, 0xf8c878],
    near: [0xe8c890, 0xc8a070], path: [0xd8b078, 0xb08850], flowers: [0xf8f0e0, 0x80c0e0],
  },
  {
    id: 'colinas', name: 'Colinas al atardecer',
    sky: [0x302858, 0x683878, 0xb05068, 0xe87850, 0xf8b058],
    sun: { color: 0xf8d070, glow: 0xf09860, y: 92, r: 14 },
    cloud: [0xf0a090, 0xa86888], far: [0x5a3a70, 0x7a5088],
    mid: [0x3a5a40, 0x284030, 0x5a7a48], trees: [0x2a4a34, 0x3e6444, 0x4a3020],
    near: [0x4a7a38, 0x325828], path: [0xb08860, 0x886040], flowers: [0xf8a040, 0xf8e070],
  },
  {
    id: 'nevado', name: 'Montaña nevada',
    sky: [0x405098, 0x7068a8, 0xc080a8, 0xf0a8a0, 0xf8d0b0],
    sun: { color: 0xf8e8c0, glow: 0xf0b8a8, y: 86, r: 12 },
    cloud: [0xf8e0e0, 0xc8a0c0], far: [0x7880b0, 0x98a0c8], cap: 0xf0f0f8,
    mid: [0xc8d0e8, 0xa0a8c8, 0xf8f8ff],
    near: [0xe8eef8, 0xb8c4dc], path: [0xa8b4cc, 0x8894b0], flowers: [0x98d8f8, 0xffffff],
  },
];

const TAU = Math.PI * 2;
/** Relieve que se repite justo cada 240 píxeles (frecuencias enteras), para que el scroll no tenga costuras. */
const wave = (x: number, base: number, parts: [number, number, number][]) =>
  Math.round(base + parts.reduce((s, [amp, k, ph]) => s + amp * Math.sin((TAU * k * x) / PIX.w + ph), 0));

function circle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number) {
  g.fillStyle(color, 1);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/** Dibuja algo y sus copias a ±240 para que se repita sin cortes al hacer scroll. */
const wrapped = (x: number, draw: (x: number) => void) => [x - PIX.w, x, x + PIX.w].forEach(draw);

function bake(scene: Phaser.Scene, key: string, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, PIX.w, h);
    g.destroy();
  }
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return key;
}

function drawSky(g: Phaser.GameObjects.Graphics, a: LandscapeArt) {
  const bands = a.sky.length;
  const bh = Math.ceil(130 / bands);
  a.sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * bh, PIX.w, i === bands - 1 ? PIX.h : bh));
  // Tramado de dos filas entre bandas, como los degradados de la GBA
  for (let i = 0; i < bands - 1; i++) {
    const y = (i + 1) * bh - 2;
    g.fillStyle(a.sky[i + 1], 1);
    for (let x = 0; x < PIX.w; x += 2) g.fillRect(x, y, 1, 1);
    g.fillStyle(a.sky[i], 1);
    for (let x = 1; x < PIX.w; x += 2) g.fillRect(x, y + 2, 1, 1);
  }
  const s = a.sun;
  circle(g, 214, s.y, s.r + 3, s.glow);
  circle(g, 214, s.y, s.r, s.color);
}

function drawClouds(g: Phaser.GameObjects.Graphics, a: LandscapeArt, rng: () => number) {
  for (let i = 0; i < 4; i++) {
    const cx = Math.floor(i * 60 + rng() * 30);
    const cy = Math.floor(14 + rng() * 34);
    const w = 3 + Math.floor(rng() * 3);
    wrapped(cx, (x) => {
      for (let k = 0; k < w; k++) circle(g, x + k * 7, cy - (k % 2) * 3, 5 + (k % 2) * 2, a.cloud[0]);
      g.fillStyle(a.cloud[1], 1).fillRect(x - 4, cy + 4, w * 7 + 2, 2);
    });
  }
}

function drawFar(g: Phaser.GameObjects.Graphics, a: LandscapeArt) {
  for (let x = 0; x < PIX.w; x++) {
    const top = wave(x, 78, [[14, 2, 0.3], [8, 5, 1.1], [3, 11, 2]]);
    const prev = wave(x - 1, 78, [[14, 2, 0.3], [8, 5, 1.1], [3, 11, 2]]);
    g.fillStyle(a.far[0], 1).fillRect(x, top, 1, PIX.h - top);
    // Ladera iluminada
    if (top < prev) g.fillStyle(a.far[1], 1).fillRect(x, top, 1, 4);
    if (a.cap && top < 72) g.fillStyle(a.cap, 1).fillRect(x, top, 1, Math.min(6, 72 - top + 2));
  }
}

function drawMid(g: Phaser.GameObjects.Graphics, a: LandscapeArt, rng: () => number) {
  if (a.sea) {
    g.fillStyle(a.sea[0], 1).fillRect(0, 104, PIX.w, PIX.h - 104);
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rng() * PIX.w);
      const y = 106 + Math.floor(rng() * 20);
      g.fillStyle(a.sea[1], 1).fillRect(x, y, 2 + Math.floor(rng() * 4), 1);
    }
    return;
  }
  const mid = a.mid!;
  const hill = (x: number) => wave(x, 104, [[8, 3, 2], [5, 7, 0.5]]);
  for (let x = 0; x < PIX.w; x++) {
    const top = hill(x);
    g.fillStyle(mid[0], 1).fillRect(x, top, 1, PIX.h - top);
    g.fillStyle(mid[2], 1).fillRect(x, top, 1, 1);
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rng() * PIX.w);
    g.fillStyle(mid[1], 1).fillRect(x, hill(x) + 3 + Math.floor(rng() * 14), 2, 1);
  }
  if (a.trees) {
    const [leaf, light, trunk] = a.trees;
    for (let x0 = 6; x0 < PIX.w; x0 += 11 + Math.floor(rng() * 8)) {
      const base = hill(x0);
      const r = 4 + Math.floor(rng() * 3);
      wrapped(x0, (x) => {
        g.fillStyle(trunk, 1).fillRect(x - 1, base - 4, 2, 5);
        circle(g, x, base - 4 - r, r, leaf);
        circle(g, x - 1, base - 5 - r, Math.max(1, r - 3), light);
      });
    }
  }
}

function drawNear(g: Phaser.GameObjects.Graphics, a: LandscapeArt, rng: () => number) {
  for (let x = 0; x < PIX.w; x++) {
    const top = wave(x, 126, [[2, 4, 0], [1, 9, 1]]);
    g.fillStyle(a.near[0], 1).fillRect(x, top, 1, PIX.h - top);
    g.fillStyle(a.near[1], 1).fillRect(x, top, 1, 1);
    // Camino con bordes que ondulan un píxel
    const p0 = wave(x, 138, [[1, 6, 0.4]]);
    const p1 = wave(x, 151, [[1, 5, 2]]);
    g.fillStyle(a.path[0], 1).fillRect(x, p0, 1, p1 - p0);
    g.fillStyle(a.path[1], 1).fillRect(x, p0, 1, 1).fillRect(x, p1 - 1, 1, 1);
  }
  // Matas de hierba y flores
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * PIX.w);
    const y = Math.floor(rng() * 2) ? 130 + Math.floor(rng() * 6) : 153 + Math.floor(rng() * 6);
    g.fillStyle(a.near[1], 1).fillRect(x, y, 1, 2).fillRect(x + 2, y, 1, 2).fillRect(x + 1, y + 1, 1, 2);
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng() * PIX.w);
    const y = Math.floor(rng() * 2) ? 129 + Math.floor(rng() * 7) : 153 + Math.floor(rng() * 6);
    g.fillStyle(a.flowers[i % a.flowers.length], 1).fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle(a.path[1], 1).fillRect(Math.floor(rng() * PIX.w), 140 + Math.floor(rng() * 9), 2, 1);
  }
}

export interface Landscape {
  art: LandscapeArt;
  /** Llamar en update(): mueve las capas. `dt` en milisegundos. */
  update(dt: number): void;
  /** Velocidad del suelo en píxeles de pantalla por segundo (para que lo que camina vaya a juego). */
  groundSpeed: number;
}

/** Monta el paisaje a pantalla completa por debajo de todo (profundidad -10). */
export function addLandscape(scene: Phaser.Scene, art: LandscapeArt, seed = 7): Landscape {
  const rng = mulberry32(seed);
  const k = (layer: string) => `land-${art.id}-${layer}`;
  const sky = bake(scene, k('sky'), PIX.h, (g) => drawSky(g, art));
  const clouds = bake(scene, k('clouds'), 64, (g) => drawClouds(g, art, rng));
  const far = bake(scene, k('far'), PIX.h, (g) => drawFar(g, art));
  const mid = bake(scene, k('mid'), PIX.h, (g) => drawMid(g, art, rng));
  const near = bake(scene, k('near'), PIX.h, (g) => drawNear(g, art, rng));

  const S = PIX.scale;
  // T30: en 16:9 se ve más ancho que los 960 del diseño; el cielo se estira y las capas se repiten hasta los bordes
  const x0 = -Math.ceil(BAND / S) * S;
  const tilesW = Math.ceil(COVER_W / S) + 2;
  scene.add.image(x0, 0, sky).setOrigin(0).setDisplaySize(tilesW * S, PIX.h * S).setDepth(-10);
  const layers: [Phaser.GameObjects.TileSprite, number][] = [
    [scene.add.tileSprite(x0, 0, tilesW, 64, clouds), 3],
    [scene.add.tileSprite(x0, 0, tilesW, PIX.h, far), 1.5],
    [scene.add.tileSprite(x0, 0, tilesW, PIX.h, mid), 4],
    [scene.add.tileSprite(x0, 0, tilesW, PIX.h, near), 8],
  ];
  layers.forEach(([t], i) => t.setOrigin(0).setScale(S).setDepth(-9 + i));
  return {
    art,
    groundSpeed: 8 * S,
    update(dt) {
      for (const [t, speed] of layers) t.tilePositionX += (speed * dt) / 1000;
    },
  };
}

/** Ambiente siguiente cada vez que se pide (va rotando entre visitas al menú). */
export function nextLandscape(scene: Phaser.Scene): LandscapeArt {
  const i = ((scene.registry.get('landscapeIdx') as number | undefined) ?? Math.floor(Math.random() * LANDSCAPES.length)) %
    LANDSCAPES.length;
  scene.registry.set('landscapeIdx', i + 1);
  // El resto de pantallas usan el mismo ambiente que el menú (addMenuBackdrop)
  scene.registry.set('landscapeArt', LANDSCAPES[i]);
  return LANDSCAPES[i];
}

/**
 * Fondo para el resto de pantallas de menú: el mismo paisaje animado, oscurecido para que se lean bien
 * los cuadros y los textos blancos. Llamar en create(); se anima sola.
 */
export function addMenuBackdrop(scene: Phaser.Scene, dim = 0.55): Landscape {
  const art = (scene.registry.get('landscapeArt') as LandscapeArt | undefined) ?? LANDSCAPES[0];
  const land = addLandscape(scene, art);
  scene.add.rectangle(DCX, DCY, COVER_W + 4, COVER_H + 4, 0x101828, dim).setDepth(-4);
  // Con efectos bajos (N21) el paisaje se queda quieto
  if (lowFx()) return land;
  const tick = (_t: number, delta: number) => land.update(delta);
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
  return land;
}
