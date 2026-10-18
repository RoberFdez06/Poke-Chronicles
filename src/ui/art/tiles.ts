// Baldosas y obstáculos pixel art para cada bioma (suelo, pared, roca, hierba alta, agujero, charco, columna).
// Se generan por código con los colores del bioma, así cualquier bioma nuevo tiene arte sin dibujarlo a mano.
// Cada textura es pequeña (32x32 o 32x48) y se escala sin suavizar; el suelo y la pared se usan con TileSprite.
import Phaser from 'phaser';

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

/** Detalles del suelo según el bioma (hierba, grietas, arena, brasas, baldosas, nieve…). */
function drawFloor(g: G, b: BiomeLook) {
  const r = rngFor(b.id + 'floor');
  const base = b.colors.floor;
  px(g, base, 0, 0, TILE, TILE);
  const dark = shade(base, -0.08);
  const darker = shade(base, -0.16);
  const light = shade(base, 0.35);
  switch (b.id) {
    case 'ciudad':
    case 'torre': {
      // Baldosas de 16 con junta y brillo
      for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
        px(g, dark, x, y + 15, 16, 1);
        px(g, dark, x + 15, y, 1, 16);
        px(g, light, x, y, 15, 1);
        px(g, light, x, y, 1, 15);
      }
      if (b.id === 'torre') for (let i = 0; i < 6; i++) px(g, darker, Math.floor(r() * 30), Math.floor(r() * 30), 2, 1);
      break;
    }
    case 'cueva':
    case 'volcan': {
      // Grietas y piedrecitas; en el volcán, brasas
      for (let i = 0; i < 3; i++) {
        let x = Math.floor(r() * 28);
        let y = Math.floor(r() * 28);
        for (let s = 0; s < 5; s++) {
          px(g, darker, x, y);
          x += r() < 0.5 ? 1 : 0;
          y += 1;
        }
      }
      for (let i = 0; i < 8; i++) px(g, dark, Math.floor(r() * 31), Math.floor(r() * 31), 2, 1);
      if (b.id === 'volcan') for (let i = 0; i < 3; i++) px(g, 0xff8a3a, Math.floor(r() * 31), Math.floor(r() * 31));
      break;
    }
    case 'mar': {
      // Arena con puntitos y ondas
      for (let i = 0; i < 18; i++) px(g, r() < 0.5 ? dark : light, Math.floor(r() * 32), Math.floor(r() * 32));
      for (let i = 0; i < 2; i++) {
        const y = 6 + Math.floor(r() * 22);
        const x = Math.floor(r() * 20);
        px(g, dark, x, y, 4, 1);
        px(g, dark, x + 4, y - 1, 3, 1);
        px(g, dark, x + 7, y, 4, 1);
      }
      break;
    }
    case 'nieve': {
      for (let i = 0; i < 10; i++) px(g, dark, Math.floor(r() * 32), Math.floor(r() * 32));
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(r() * 30);
        const y = Math.floor(r() * 30);
        px(g, 0xffffff, x + 1, y);
        px(g, 0xffffff, x, y + 1, 3, 1);
        px(g, 0xffffff, x + 1, y + 2);
      }
      break;
    }
    default: {
      // Bosque, pantano y el resto: hierba corta en matas
      const blade = shade(base, -0.22);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * 29);
        const y = 2 + Math.floor(r() * 28);
        px(g, blade, x, y, 1, 2);
        px(g, blade, x + 2, y - 1, 1, 3);
        px(g, light, x + 1, y + 1);
      }
      for (let i = 0; i < 6; i++) px(g, dark, Math.floor(r() * 31), Math.floor(r() * 31), 2, 1);
    }
  }
}

/** Muro de bloques con luz arriba y sombra abajo. */
function drawWall(g: G, b: BiomeLook) {
  const r = rngFor(b.id + 'wall');
  const c = b.colors.wall;
  px(g, shade(c, -0.25), 0, 0, TILE, TILE);
  const rows = [0, 8, 16, 24];
  rows.forEach((y, i) => {
    const off = i % 2 ? 8 : 0;
    for (let x = -off; x < TILE; x += 16) {
      const tone = shade(c, (r() - 0.5) * 0.12);
      px(g, tone, x + 1, y + 1, 14, 6);
      px(g, shade(tone, 0.22), x + 1, y + 1, 14, 1);
      px(g, shade(tone, -0.2), x + 1, y + 6, 14, 1);
    }
  });
}

/** Roca con contorno, cara superior clara y sombra. */
function drawRock(g: G, b: BiomeLook) {
  const { rock, rockTop } = b.colors;
  const shape = [
    '..........kkkkk.........',
    '.......kkkTTTTTkkk......',
    '.....kkTTTTTWTTTTTkk....',
    '....kTTTTTTTTTTTTTTTk...',
    '...kTTTTTTTTTTTTTTTTTk..',
    '..kRTTTTTTTTTTTTTTTTRk..',
    '..kRRRTTTTTTTTTTTRRRRk..',
    '.kRRRRRRRRRRRRRRRRRRRRk.',
    '.kRRRRRRRRRRRRRRRRRRRDk.',
    '.kRRRRRRRRRRRRRRRRRRDDk.',
    '.kRRRDRRRRRRRRRRRRRDDDk.',
    '.kRRRRDDRRRRRRRRRRDDDDk.',
    '..kRRRRRRRRRRRRRRDDDDk..',
    '..kDDRRRRRRRRRRRDDDDDk..',
    '...kkDDDDDDDDDDDDDDkk...',
    '.....kkkkkkkkkkkkkk.....',
  ];
  const pal: Record<string, number> = { k: OUTLINE, T: rockTop, W: shade(rockTop, 0.5), R: rock, D: shade(rock, -0.3) };
  // Sombra en el suelo
  g.fillStyle(0x000000, 0.25).fillEllipse(16, 27, 26, 6);
  shape.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') px(g, pal[row[i]], 4 + i, 10 + j);
  });
}

/** Hierba alta (se puede romper disparando). Blanca = color del bioma sin teñir. */
function drawBush(g: G, b: BiomeLook) {
  const tint = b.colors.bush;
  // Blanco = hierba verde normal; si no, la hierba toma el color del bioma (seca, de coral, nevada…)
  const green = tint === 0xffffff;
  const dark = green ? 0x2f7a32 : shade(tint, -0.5);
  const mid = green ? 0x48a848 : shade(tint, -0.22);
  const light = green ? 0x88d870 : shade(tint, 0.25);
  g.fillStyle(0x000000, 0.2).fillEllipse(16, 29, 28, 5);
  const blades = [3, 7, 11, 15, 19, 23, 27];
  blades.forEach((x, i) => {
    const h = 14 + ((i * 7) % 9);
    const top = 30 - h;
    px(g, OUTLINE, x - 1, top, 4, h + 1);
    px(g, dark, x, top + 1, 2, h - 1);
    px(g, mid, x, top + 1, 1, h - 3);
    px(g, light, x, top + 1, 1, 2);
  });
  px(g, OUTLINE, 2, 29, 28, 1);
}

/** Agujero que no se puede cruzar andando. */
function drawHole(g: G, b: BiomeLook) {
  const h = b.colors.hole;
  const rim = shade(b.colors.floor, -0.35);
  g.fillStyle(rim, 1).fillRect(1, 1, 30, 30);
  g.fillStyle(h, 1).fillRect(3, 4, 26, 26);
  g.fillStyle(shade(h, 0.12), 1).fillRect(3, 4, 26, 3);
  px(g, shade(rim, 0.25), 1, 1, 30, 1);
}

/** Charco (agua, lava, hielo o niebla según el bioma): ralentiza o daña. */
function drawPuddle(g: G, b: BiomeLook) {
  const c = b.colors.puddle;
  g.fillStyle(shade(c, -0.3), 1).fillEllipse(16, 17, 30, 22);
  g.fillStyle(c, 1).fillEllipse(16, 16, 28, 19);
  g.fillStyle(shade(c, 0.35), 1).fillRect(8, 10, 6, 2).fillRect(20, 18, 4, 1);
  px(g, 0xffffff, 9, 10, 2, 1);
}

/** Columna (32x48): bloquea y tapa disparos. */
function drawPillar(g: G, b: BiomeLook) {
  const c = shade(b.colors.wall, 0.25);
  g.fillStyle(0x000000, 0.25).fillEllipse(16, 44, 28, 6);
  px(g, OUTLINE, 5, 6, 22, 40);
  px(g, c, 6, 7, 20, 38);
  px(g, shade(c, 0.3), 6, 7, 4, 38);
  px(g, shade(c, -0.25), 22, 7, 4, 38);
  // Capitel y base
  px(g, OUTLINE, 3, 3, 26, 6);
  px(g, shade(c, 0.15), 4, 4, 24, 4);
  px(g, OUTLINE, 3, 41, 26, 6);
  px(g, shade(c, -0.1), 4, 42, 24, 4);
}

const PARTS: Record<TilePart, { w: number; h: number; draw: (g: G, b: BiomeLook) => void }> = {
  floor: { w: TILE, h: TILE, draw: drawFloor },
  wall: { w: TILE, h: TILE, draw: drawWall },
  rock: { w: TILE, h: TILE, draw: drawRock },
  bush: { w: TILE, h: TILE, draw: drawBush },
  hole: { w: TILE, h: TILE, draw: drawHole },
  puddle: { w: TILE, h: TILE, draw: drawPuddle },
  pillar: { w: TILE, h: 48, draw: drawPillar },
};

/** Crea (una vez) todas las texturas del bioma con filtro NEAREST. Devuelve sus claves. */
export function bakeBiomeTiles(scene: Phaser.Scene, biome: BiomeLook): Record<TilePart, string> {
  const keys = {} as Record<TilePart, string>;
  for (const part of Object.keys(PARTS) as TilePart[]) {
    const key = tileKey(biome.id, part);
    keys[part] = key;
    if (scene.textures.exists(key)) continue;
    const { w, h, draw } = PARTS[part];
    const g = scene.make.graphics({}, false);
    draw(g, biome);
    g.generateTexture(key, w, h);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return keys;
}
