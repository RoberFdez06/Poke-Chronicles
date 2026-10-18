import Phaser from 'phaser';
import type { Floor } from '../level/floorGen';

const CELL_W = 22;
const CELL_H = 14;
const GAP = 4;
const PAD = 6;

/**
 * Dibuja el minimapa con su esquina superior derecha en (right, top).
 * Muestra las salas visitadas y sus adyacentes; la sala actual va resaltada.
 */
export function drawMinimap(
  g: Phaser.GameObjects.Graphics,
  floor: Floor,
  currentId: number,
  visited: ReadonlySet<number>,
  right: number,
  top: number,
  /** Salas que no se enseñan aunque estén al lado de una visitada (la secreta, hasta que se abre). */
  hidden: ReadonlySet<number> = new Set(),
  /** Tamaño (1 = el de siempre) y ancho máximo: si no cabe, se encoge lo justo. */
  scale = 1,
  maxW = Infinity,
) {
  g.clear();

  const known = new Set(visited);
  for (const id of visited) {
    for (const n of Object.values(floor.rooms[id].doors)) if (n !== undefined && !hidden.has(n)) known.add(n);
  }

  const rooms = [...known].map((id) => floor.rooms[id]);
  const minX = Math.min(...rooms.map((r) => r.gx));
  const maxX = Math.max(...rooms.map((r) => r.gx));
  const minY = Math.min(...rooms.map((r) => r.gy));
  const maxY = Math.max(...rooms.map((r) => r.gy));

  const natural = (maxX - minX + 1) * (CELL_W + GAP) - GAP + PAD * 2;
  const k = Math.min(scale, maxW / natural);
  const CW = CELL_W * k;
  const CH = CELL_H * k;
  const G = GAP * k;
  const P = PAD * k;
  const w = (maxX - minX + 1) * (CW + G) - G + P * 2;
  const h = (maxY - minY + 1) * (CH + G) - G + P * 2;
  const left = right - w;
  g.fillStyle(0x000000, 0.35).fillRoundedRect(left, top, w, h, 6);

  for (const r of rooms) {
    const x = left + P + (r.gx - minX) * (CW + G);
    const y = top + P + (r.gy - minY) * (CH + G);
    const isCurrent = r.id === currentId;
    const color = isCurrent ? 0xffffff : visited.has(r.id) ? 0xb8c4e6 : 0x4a5578;
    g.fillStyle(color, 1).fillRect(x, y, CW, CH);
    if (isCurrent) g.lineStyle(2, 0xffd34d, 1).strokeRect(x - 1, y - 1, CW + 2, CH + 2);

    const icon =
      r.kind === 'boss' ? 0xe53935 : r.kind === 'item' ? 0xffc107 : r.kind === 'center' ? 0xff6fae : r.kind === 'shop' ? 0x2ecc71
      : r.kind === 'challenge' ? 0xbdc3c7 : r.kind === 'secret' ? 0x8e44ad : null;
    if (icon !== null) g.fillStyle(icon, 1).fillCircle(x + CW / 2, y + CH / 2, 4 * k);
  }
}
