// Piezas de dibujo compartidas por las escenas de menú (supervisor): bucle de animación ligado a un Graphics, sellos de
// píxel gordo, destellos, tuercas y emblemas pequeños. Con efectos bajos todo queda quieto (un solo fotograma).
import type Phaser from 'phaser';
import { lowFx } from '../theme';

export const OUT = 0x18202c;

/**
 * Pinta `paint(t)` ahora y, sin efectos bajos, lo repite cada `delay` ms mientras el Graphics exista. Se para solo
 * cuando el Graphics se destruye (al rehacer una capa o cerrar la escena).
 */
export function live(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, paint: (t: number) => void, delay = 80) {
  const t0 = scene.time.now;
  g.clear();
  paint(0);
  if (lowFx()) return g;
  const ev = scene.time.addEvent({
    delay,
    loop: true,
    callback: () => {
      if (!g.scene) return ev.remove();
      g.clear();
      paint(scene.time.now - t0);
    },
  });
  g.once('destroy', () => ev.remove());
  return g;
}

/** Animación de `ms` (0→1) sobre un Graphics; con efectos bajos pinta directamente el final. */
export function once(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, ms: number, paint: (k: number) => void, then?: () => void) {
  if (lowFx()) {
    g.clear();
    paint(1);
    then?.();
    return g;
  }
  const t0 = scene.time.now;
  const ev = scene.time.addEvent({
    delay: 40,
    loop: true,
    callback: () => {
      if (!g.scene) return ev.remove();
      const k = Math.min(1, (scene.time.now - t0) / ms);
      g.clear();
      paint(k);
      if (k >= 1) {
        ev.remove();
        then?.();
      }
    },
  });
  g.once('destroy', () => ev.remove());
  g.clear();
  paint(0);
  return g;
}

/** Sello de píxeles: cada letra de `rows` es un color de `pal` (los que no están, transparentes). */
export function stamp(g: Phaser.GameObjects.Graphics, x: number, y: number, rows: readonly string[], pal: Record<string, number>, size = 4, a = 1) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (col !== undefined) g.fillStyle(col, a).fillRect(x + c * size, y + r * size, size, size);
    }
  });
}

/** Destello en cruz (4 píxeles de brazo), como los de la tienda. */
export function twinkle(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, a = 1, s = 2) {
  x = Math.round(x / 2) * 2;
  y = Math.round(y / 2) * 2;
  g.fillStyle(color, a * 0.85).fillRect(x - 3 * s, y - s / 2, 6 * s, s).fillRect(x - s / 2, y - 3 * s, s, 6 * s);
  g.fillStyle(0xffffff, a).fillRect(x - s, y - s, 2 * s, 2 * s);
}

/** Tuerca pequeña (para placas metálicas). */
export function bolt(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(OUT, 1).fillRect(x - 3, y - 3, 6, 6);
  g.fillStyle(0xc9d2e0, 1).fillRect(x - 2, y - 2, 4, 4);
  g.fillStyle(0xffffff, 1).fillRect(x - 2, y - 2, 2, 2);
}

/** Rombo de píxeles relleno (para emblemas y nodos). */
export function diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number, a = 1, step = 2) {
  g.fillStyle(color, a);
  for (let dy = -r; dy <= r; dy += step) {
    const w = r - Math.abs(dy);
    g.fillRect(cx - w, cy + dy, w * 2 || step, step);
  }
}

/** Rayo pequeño (icono eléctrico), centrado en (x, y), de alto ~6·s. */
export function boltIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, s = 3) {
  const rows = ['....kkkk', '...kYYYk', '..kYYYk.', '.kYYYYYk', '.kkkYYk.', '...kYk..', '..kYk...', '..kk....'];
  stamp(g, x - 4 * s, y - 4 * s, rows, { k: OUT, Y: color }, s);
}
