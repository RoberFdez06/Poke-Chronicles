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
function drawBush(g: G, b: BiomeLook) {
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
    px(g, line, x - 1 + lean, top, 4, h + 1);
    px(g, dark, x + lean, top + 1, 2, h - 1);
    px(g, mid, x + lean, top + 1, 1, h - 3);
    px(g, light, x + lean, top + 1, 1, 2);
    px(g, line, x + lean, top - 1, 2, 1);
  });
  px(g, line, 1, 29, 30, 1);
  // Flores, bayas o escarcha en las puntas
  const tips: Record<string, number> = {
    bosque: 0xff7aa8, pantano: 0x8a5a3a, nieve: 0xffffff, cumbre: 0xffffff, mar: 0xff9a7a, volcan: 0xff5a2a, cueva: 0xa8e8ff,
  };
  const tip = tips[b.id];
  if (tip !== undefined) for (const [x, y] of [[5, 10], [14, 7], [23, 9], [29, 14], [11, 14]]) px(g, tip, x, y, 2, 2);
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
function drawPuddle(g: G, b: BiomeLook) {
  const c = b.colors.puddle;
  g.fillStyle(0x000000, 0.18).fillEllipse(16, 20, 31, 20);
  g.fillStyle(shade(c, -0.4), 1).fillEllipse(16, 17, 30, 22);
  g.fillStyle(shade(c, -0.12), 1).fillEllipse(16, 16, 27, 19);
  g.fillStyle(c, 1).fillEllipse(16, 15, 23, 15);
  g.fillStyle(shade(c, 0.22), 1).fillEllipse(15, 13, 14, 7);
  // Ondas y reflejos
  g.lineStyle(1, shade(c, 0.45), 1).strokeEllipse(21, 18, 9, 4);
  g.lineStyle(1, shade(c, 0.35), 1).strokeEllipse(11, 14, 6, 3);
  px(g, 0xffffff, 8, 9, 3, 1);
  px(g, 0xffffff, 22, 12, 2, 1);
  switch (b.id) {
    case 'volcan':
      // Burbujas de lava
      for (const [x, y] of [[10, 14], [20, 17], [15, 11]]) {
        px(g, 0xffe08a, x, y, 2, 2);
        px(g, 0xffffff, x, y);
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
function drawPillar(g: G, b: BiomeLook) {
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
      const f = b.id === 'torre' ? [0x6a3ad0, 0xb08cff, 0xf0e4ff] : [0xff5a1a, 0xffa030, 0xfff0a0];
      stamp(g, ['..f..', '.fFf.', '.fFf.', 'fFYFf', 'fFYFf', '.fFf.'], { f: f[0], F: f[1], Y: f[2] }, 13, 0);
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
