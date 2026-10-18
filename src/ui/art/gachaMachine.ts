// Arte del gacha (supervisor): máquina de bolas pixel, una Poké Ball distinta por rareza y efectos de revelado.
// Todo se genera por código y se escala sin suavizar (NEAREST), como el resto del arte GBA del juego.
import Phaser from 'phaser';
import type { Rarity } from '../../data/gacha';
import { drawPixelGrid, type PixelIcon } from './icons';

/** Poké Ball de cada rareza: Poké Ball, Super Ball, Ultra Ball, Ente Ball y Master Ball. */
export const RARITY_BALLS: Record<Rarity, PixelIcon> = {
  common: { desc: "Poké Ball (común)", palette: { "k": 0x18202c, "T": 0xe03838, "t": 0xc02828, "d": 0x901818, "W": 0xffffff, "w": 0xe4e4ec, "g": 0xb4b8c8 }, rows: [
      '................',
      '.....kkkkkk.....',
      '...kkTTTTttkk...',
      '..kTTWTTTTttdk..',
      '..kTWTTTTTTtdk..',
      '.kTTTTTTTTTTtdk.',
      '.kTTTTkkkkTTtdk.',
      '.kkkkkkWWkkkkkk.',
      '.kwwwwkkkkwwwgk.',
      '.kwwwwwwwwwwwgk.',
      '..kwwwwwwwwwgk..',
      '..kwwwwwwwwggk..',
      '...kkggggggkk...',
      '.....kkkkkk.....',
      '................',
      '................',
    ] },
  rare: { desc: "Super Ball (raro)", palette: { "k": 0x18202c, "T": 0x3a78d8, "t": 0x2a5cb0, "d": 0x1c3e80, "W": 0xffffff, "w": 0xe4e4ec, "g": 0xb4b8c8, "r": 0xe03838 }, rows: [
      '................',
      '.....kkkkkk.....',
      '...kkTTTTttkk...',
      '..kTrrTTTTrrdk..',
      '..kTrTTTTTTrdk..',
      '.kTrTTTTTTTTrdk.',
      '.kTTTTkkkkTTtdk.',
      '.kkkkkkWWkkkkkk.',
      '.kwwwwkkkkwwwgk.',
      '.kwwwwwwwwwwwgk.',
      '..kwwwwwwwwwgk..',
      '..kwwwwwwwwggk..',
      '...kkggggggkk...',
      '.....kkkkkk.....',
      '................',
      '................',
    ] },
  epic: { desc: "Ultra Ball (épico)", palette: { "k": 0x18202c, "T": 0x30303c, "t": 0x24242e, "d": 0x16161c, "W": 0xffffff, "w": 0xe4e4ec, "g": 0xb4b8c8, "y": 0xf2c230 }, rows: [
      '................',
      '.....kkkkkk.....',
      '...kkTTTTttkk...',
      '..kTTyTTTTytdk..',
      '..kTWyyyyyytdk..',
      '.kTTTyTTTTyTtdk.',
      '.kTTTTkkkkTTtdk.',
      '.kkkkkkWWkkkkkk.',
      '.kwwwwkkkkwwwgk.',
      '.kwwwwwwwwwwwgk.',
      '..kwwwwwwwwwgk..',
      '..kwwwwwwwwggk..',
      '...kkggggggkk...',
      '.....kkkkkk.....',
      '................',
      '................',
    ] },
  ultra: { desc: "Ente Ball (ultraente)", palette: { "k": 0x18202c, "T": 0x50b8e8, "t": 0x3090c8, "d": 0x1c6a98, "W": 0xffffff, "w": 0xe4e4ec, "g": 0xb4b8c8, "y": 0xf2e040 }, rows: [
      '................',
      '.....kkkkkk.....',
      '...kkTTyyttkk...',
      '..kTTWTyyTttdk..',
      '..kTWTTyyTTtdk..',
      '.kTTTTTyyTTTtdk.',
      '.kTTyTkkkkTytdk.',
      '.kkkkkkWWkkkkkk.',
      '.kwwwwkkkkwwwgk.',
      '.kwwwwwwwwwwwgk.',
      '..kwwwwwwwwwgk..',
      '..kwwwwwwwwggk..',
      '...kkggggggkk...',
      '.....kkkkkk.....',
      '................',
      '................',
    ] },
  legendary: { desc: "Master Ball (legendario)", palette: { "k": 0x18202c, "T": 0x8a48c8, "t": 0x6a30a8, "d": 0x4a1c80, "W": 0xffffff, "w": 0xe4e4ec, "g": 0xb4b8c8, "p": 0xf070b0, "m": 0xffffff }, rows: [
      '................',
      '.....kkkkkk.....',
      '...kkTTTTttkk...',
      '..kTTWmmTmttdk..',
      '..kpWTmTmmTtpk..',
      '.kTpTTTTTTTTpdk.',
      '.kTTTTkkkkTTtdk.',
      '.kkkkkkWWkkkkkk.',
      '.kwwwwkkkkwwwgk.',
      '.kwwwwwwwwwwwgk.',
      '..kwwwwwwwwwgk..',
      '..kwwwwwwwwggk..',
      '...kkggggggkk...',
      '.....kkkkkk.....',
      '................',
      '................',
    ] },
};

export const ballKey = (r: Rarity) => `gacha-ball-${r}`;
export const MACHINE_KEY = 'gacha-machine';
export const CRANK_KEY = 'gacha-crank';
/** Tamaño de la máquina en píxeles del dibujo (escálala x4 o x5). */
export const MACHINE = { w: 64, h: 96, crankX: 50, crankY: 66, chuteX: 32, chuteY: 84 } as const;

const OUT = 0x18202c;
const GLASS = 0xbfe8ff;
const BODY = 0xe03838;
const BODY_D = 0xa01c1c;
const BODY_L = 0xff7a7a;
const GOLD = 0xf2c230;

type G = Phaser.GameObjects.Graphics;
const px = (g: G, c: number, x: number, y: number, w = 1, h = 1, a = 1) => g.fillStyle(c, a).fillRect(x, y, w, h);

function drawMachine(g: G) {
  // Cúpula de cristal (círculo pixelado de radio 26 centrado en 32,30)
  const cx = 32;
  const cy = 30;
  const R = 26;
  for (let y = -R; y <= R; y++) {
    const half = Math.floor(Math.sqrt(R * R - y * y));
    px(g, OUT, cx - half - 1, cy + y, half * 2 + 3, 1);
  }
  for (let y = -R + 1; y <= R - 1; y++) {
    const half = Math.floor(Math.sqrt((R - 1) * (R - 1) - y * y));
    px(g, GLASS, cx - half, cy + y, half * 2 + 1, 1);
  }
  // Bolas dentro (mitad roja/blanca, de colores)
  const inside: [number, number, number][] = [
    [18, 40, 0xe03838], [27, 44, 0x3a78d8], [37, 42, 0x30303c], [45, 38, 0xe03838], [22, 31, 0x50b8e8],
    [33, 34, 0xe03838], [42, 29, 0x3a78d8], [14, 33, 0xe03838], [28, 24, 0x8a48c8], [37, 22, 0xe03838],
    [48, 30, 0x30303c], [20, 22, 0x3a78d8],
  ];
  const BALL = ['..kkk..', '.kcccc.', 'kcWccck', 'kkkkkkk', 'kwwwwwk', '.kwwwk.', '..kkk..'];
  for (const [x, y, c] of inside) {
    BALL.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        px(g, ch === 'k' ? OUT : ch === 'c' ? c : 0xffffff, x - 1 + i, y - 3 + j);
      }
    });
  }
  // Brillo del cristal
  px(g, 0xffffff, 14, 14, 3, 1, 0.9);
  px(g, 0xffffff, 12, 16, 2, 4, 0.9);
  px(g, 0xffffff, 11, 21, 1, 3, 0.7);
  // Tapa
  px(g, OUT, 26, 1, 13, 4);
  px(g, BODY, 27, 2, 11, 2);
  px(g, OUT, 30, 4, 5, 1);
  // Cuerpo
  px(g, OUT, 8, 54, 49, 40);
  px(g, BODY, 9, 55, 47, 38);
  px(g, BODY_L, 9, 55, 47, 2);
  px(g, BODY_D, 9, 89, 47, 4);
  px(g, GOLD, 9, 58, 47, 2);
  // Ranura de tickets
  px(g, OUT, 14, 64, 12, 8);
  px(g, 0x30303c, 15, 65, 10, 6);
  px(g, GOLD, 18, 67, 4, 2);
  // Salida (donde cae la bola)
  px(g, OUT, 22, 76, 21, 14);
  px(g, 0x1a1a24, 23, 77, 19, 12);
  px(g, BODY_D, 23, 77, 19, 2);
  // Patas
  px(g, OUT, 10, 93, 8, 3);
  px(g, OUT, 47, 93, 8, 3);
}

function drawCrank(g: G) {
  // Rueda de 16x16 con asa (gira alrededor del centro)
  for (let y = -7; y <= 7; y++) {
    const half = Math.floor(Math.sqrt(49 - y * y));
    px(g, OUT, 8 - half, 8 + y, half * 2 + 1, 1);
  }
  for (let y = -6; y <= 6; y++) {
    const half = Math.floor(Math.sqrt(36 - y * y));
    px(g, GOLD, 8 - half, 8 + y, half * 2 + 1, 1);
  }
  px(g, OUT, 7, 0, 3, 8);
  px(g, 0xffffff, 8, 1, 1, 6);
  px(g, OUT, 6, 7, 5, 3);
}

/** Crea (una vez) las texturas de la máquina, la manivela y las cinco Poké Balls. */
export function bakeGachaArt(scene: Phaser.Scene) {
  const bake = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  bake(MACHINE_KEY, MACHINE.w, MACHINE.h, drawMachine);
  bake(CRANK_KEY, 16, 16, drawCrank);
  (Object.keys(RARITY_BALLS) as Rarity[]).forEach((r) => bake(ballKey(r), 16, 16, (g) => drawPixelGrid(g, RARITY_BALLS[r])));
}

/** Rayos de luz que giran detrás de (x, y), del color de la rareza. Devuelve el objeto para destruirlo. */
export function addRays(scene: Phaser.Scene, x: number, y: number, color: number, radius: number, count = 12) {
  const g = scene.add.graphics({ x, y });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = a + Math.PI / count / 1.6;
    g.fillStyle(color, i % 2 ? 0.35 : 0.55);
    g.fillTriangle(0, 0, Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(b) * radius, Math.sin(b) * radius);
  }
  scene.tweens.add({ targets: g, angle: 360, duration: 9000, repeat: -1 });
  g.setScale(0);
  scene.tweens.add({ targets: g, scale: 1, duration: 380, ease: 'Back.easeOut' });
  return g;
}

/** Ráfaga de píxeles de colores que salen desde (x, y). */
export function addBurst(scene: Phaser.Scene, x: number, y: number, colors: number[], count = 28, size = 8, dist = 260) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = dist * (0.5 + Math.random() * 0.5);
    const r = scene.add.rectangle(x, y, size, size, colors[i % colors.length]).setDepth(40);
    scene.tweens.add({
      targets: r, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 40, alpha: 0, angle: 180,
      duration: 700 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => r.destroy(),
    });
  }
}
