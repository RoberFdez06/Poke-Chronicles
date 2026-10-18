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

  const w = (maxX - minX + 1) * (CELL_W + GAP) - GAP + PAD * 2;
  const h = (maxY - minY + 1) * (CELL_H + GAP) - GAP + PAD * 2;
  const left = right - w;
  g.fillStyle(0x000000, 0.35).fillRoundedRect(left, top, w, h, 6);

  for (const r of rooms) {
    const x = left + PAD + (r.gx - minX) * (CELL_W + GAP);
    const y = top + PAD + (r.gy - minY) * (CELL_H + GAP);
    const isCurrent = r.id === currentId;
    const color = isCurrent ? 0xffffff : visited.has(r.id) ? 0xb8c4e6 : 0x4a5578;
    g.fillStyle(color, 1).fillRect(x, y, CELL_W, CELL_H);
    if (isCurrent) g.lineStyle(2, 0xffd34d, 1).strokeRect(x - 1, y - 1, CELL_W + 2, CELL_H + 2);

    const icon =
      r.kind === 'boss' ? 0xe53935 : r.kind === 'item' ? 0xffc107 : r.kind === 'center' ? 0xff6fae : r.kind === 'shop' ? 0x2ecc71
      : r.kind === 'challenge' ? 0xbdc3c7 : r.kind === 'secret' ? 0x8e44ad : null;
    if (icon !== null) g.fillStyle(icon, 1).fillCircle(x + CELL_W / 2, y + CELL_H / 2, 4);
  }
}
