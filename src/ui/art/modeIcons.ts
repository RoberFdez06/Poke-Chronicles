// Iconos de pixel art de las tarjetas de modo (sustituyen a los emojis): rejilla de 14×14 celdas de 4 px (~56 px),
// contorno oscuro y 2-3 tonos por pieza. Cada uno tiene una animación idle pequeña; con efectos bajos quedan quietos.
import type Phaser from 'phaser';
import { darkOf, lightOf } from './pixelFx';
import { live, OUT } from './menuArt';

export type ModeIconId = 'normal' | 'waves' | 'endless' | 'bossrush' | 'tower' | 'towerdef' | 'daily' | 'code';

const C = 4;
const N = 14;

const GOLD = 0xf0b830;
const STONE = 0x8a94a8;
const WHITE = 0xffffff;

type Cell = (x: number, y: number, w: number, h: number, col: number) => void;

/** Caja con contorno y sombreado (luz arriba, sombra abajo). */
function boxer(r: Cell) {
  return (x: number, y: number, w: number, h: number, col: number) => {
    r(x, y, w, h, OUT);
    r(x + 1, y + 1, w - 2, h - 2, col);
    r(x + 1, y + 1, w - 2, 1, lightOf(col));
    if (h > 3) r(x + 1, y + h - 2, w - 2, 1, darkOf(col));
  };
}

const PAINT: Record<ModeIconId, (r: Cell, t: number) => void> = {
  // Mapa de mazmorra: pergamino con cuatro salas unidas; la marca roja recorre los pisos.
  normal: (r, t) => {
    const box = boxer(r);
    box(0, 1, 14, 12, 0xe8d09a);
    r(6, 4, 2, 1, 0xa07c50);
    r(9, 6, 2, 2, 0xa07c50);
    r(6, 9, 2, 1, 0xa07c50);
    const rooms = [[2, 3], [8, 3], [8, 8], [2, 8]];
    for (const [x, y] of rooms) box(x, y, 4, 3, STONE);
    const [mx, my] = rooms[Math.floor(t / 500) % rooms.length];
    r(mx + 1, my + 1, 2, 1, 0xe04040);
  },
  // Ola que rompe y se desplaza.
  waves: (r, t) => {
    const ph = t / 160;
    for (let c = 0; c < N; c++) {
      const top = 5 + Math.round(2 * Math.sin(c * 0.7 - ph));
      r(c, top - 1, 1, 1, OUT);
      r(c, top, 1, 1, WHITE);
      r(c, top + 1, 1, 1, 0x8cc8f0);
      r(c, top + 2, 1, 12 - top - 1, 0x3a7ad8);
      r(c, 11, 1, 1, darkOf(0x3a7ad8));
      r(c, 12, 1, 1, OUT);
    }
    r(0, 2, 1, 10, OUT);
    r(13, 2, 1, 10, OUT);
  },
  // Infinito con un destello que lo recorre.
  endless: (r, t) => {
    const cells = new Map<string, [number, number]>();
    const at = (a: number): [number, number] => {
      const d = 1 + Math.sin(a) ** 2;
      return [Math.round(6.5 + (5.5 * Math.cos(a)) / d), Math.round(6.5 + (5 * Math.sin(a) * Math.cos(a)) / d)];
    };
    for (let i = 0; i < 64; i++) {
      const p = at((i / 64) * Math.PI * 2);
      cells.set(p.join(','), p);
    }
    for (const [x, y] of cells.values()) r(x - 1, y - 1, 3, 3, OUT);
    for (const [x, y] of cells.values()) r(x, y, 1, 1, y < 7 ? 0xb088f0 : 0x8a5ad8);
    const [sx, sy] = at((t / 1400) * Math.PI * 2);
    r(sx, sy, 1, 1, WHITE);
    r(sx - 1, sy, 1, 1, 0xfff0a0);
    r(sx + 1, sy, 1, 1, 0xfff0a0);
    r(sx, sy - 1, 1, 1, 0xfff0a0);
    r(sx, sy + 1, 1, 1, 0xfff0a0);
  },
  // Corona con gemas; un brillo salta de punta en punta.
  bossrush: (r, t) => {
    const tips = [1, 6, 11];
    for (const x of tips) {
      r(x, 2, 3, 3, OUT);
      r(x + 1, 3, 1, 2, GOLD);
    }
    r(0, 4, 14, 8, OUT);
    r(1, 5, 12, 6, GOLD);
    r(1, 5, 12, 1, lightOf(GOLD));
    r(1, 9, 12, 1, darkOf(GOLD));
    r(1, 10, 12, 1, 0xc08020);
    r(3, 7, 2, 2, 0xe04060);
    r(6, 6, 2, 3, 0x3a7ad8);
    r(9, 7, 2, 2, 0xe04060);
    r(3, 7, 1, 1, WHITE);
    r(6, 6, 1, 1, 0xa0d0ff);
    r(9, 7, 1, 1, WHITE);
    const k = Math.floor(t / 450) % 4;
    if (k < 3) r(tips[k] + 1, 2, 1, 1, WHITE);
  },
  // Torre alta de pisos; se van encendiendo las ventanas de abajo arriba.
  tower: (r, t) => {
    const box = boxer(r);
    for (const x of [3, 6, 9]) r(x, 0, 2, 2, OUT), r(x + 1 - (x === 9 ? 1 : 0), 1, 1, 1, STONE);
    box(3, 1, 8, 13, STONE);
    r(4, 5, 6, 1, darkOf(STONE));
    r(4, 9, 6, 1, darkOf(STONE));
    const lit = Math.floor(t / 400) % 4;
    const wins = [10, 6, 2];
    wins.forEach((y, i) => {
      r(6, y + 1, 2, 2, OUT);
      r(6, y + 1, 2, 2, i < lit ? 0xffd860 : 0x2b3a67);
    });
  },
  // Torreta sobre un camino; un enemigo lo recorre y la torreta destella.
  towerdef: (r, t) => {
    const box = boxer(r);
    r(0, 11, 14, 3, OUT);
    r(0, 12, 14, 1, 0xd8b070);
    const ex = Math.floor(t / 140) % 16 - 1;
    if (ex >= 0 && ex < N) r(ex, 12, 1, 1, 0xd04040);
    box(4, 6, 6, 6, STONE);
    for (const x of [3, 6, 9]) r(x, 2, 2, 2, OUT), r(x === 9 ? x : x + 1, 3, 1, 1, STONE);
    box(3, 3, 8, 4, 0x6c7890);
    r(10, 4, 4, 2, OUT);
    r(11, 4, 2, 1, 0x4a5578);
    if (Math.floor(t / 300) % 3 === 0) r(13, 4, 1, 1, 0xffd860);
    r(6, 9, 2, 3, OUT);
  },
  // Calendario con estrella que late.
  daily: (r, t) => {
    const box = boxer(r);
    box(1, 2, 12, 12, 0xf6f2e8);
    r(2, 3, 10, 2, 0xd84848);
    r(2, 3, 10, 1, lightOf(0xd84848));
    r(4, 1, 1, 3, OUT);
    r(9, 1, 1, 3, OUT);
    const y = 0xffc830;
    const star = ['..Y..', 'YYYYY', '.YYY.', '.Y.Y.'];
    for (const dx of [-1, 1]) star.forEach((row, j) => [...row].forEach((ch, i) => ch === 'Y' && r(5 + i + dx, 7 + j, 1, 1, OUT)));
    star.forEach((row, j) => [...row].forEach((ch, i) => ch === 'Y' && r(5 + i, 7 + j - 1, 1, 1, OUT)));
    star.forEach((row, j) => [...row].forEach((ch, i) => ch === 'Y' && r(5 + i, 7 + j, 1, 1, y)));
    if (Math.floor(t / 400) % 2 === 0) r(7, 8, 1, 1, WHITE);
  },
  // Llave dorada con un brillo que recorre la caña.
  code: (r, t) => {
    const box = boxer(r);
    r(5, 5, 9, 4, OUT);
    r(6, 6, 7, 2, GOLD);
    r(6, 6, 7, 1, lightOf(GOLD));
    box(8, 8, 2, 3, GOLD);
    box(11, 8, 2, 3, GOLD);
    r(8, 8, 2, 1, GOLD);
    r(11, 8, 2, 1, GOLD);
    box(0, 3, 7, 8, GOLD);
    r(2, 5, 3, 4, OUT);
    const gx = 5 + (Math.floor(t / 120) % 12);
    if (gx < 13) r(gx, 6, 1, 1, WHITE);
  },
};

/** Dibuja el icono del modo centrado en (x, y) en un Graphics nuevo (animado salvo con efectos bajos). */
export function addModeIcon(scene: Phaser.Scene, id: ModeIconId, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x: x - (N * C) / 2, y: y - (N * C) / 2 });
  const r: Cell = (cx, cy, w, h, col) => {
    if (w > 0 && h > 0) g.fillStyle(col, 1).fillRect(cx * C, cy * C, w * C, h * C);
  };
  return live(scene, g, (t) => PAINT[id](r, t), 80);
}
