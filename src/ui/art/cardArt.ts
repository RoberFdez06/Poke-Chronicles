// Tarjeta para compartir (supervisor): fondo con rayas en diagonal y halo escalonado detrás del retrato, marco de
// píxel del color del resultado (dorado si ganas, granate si no), cinta del resultado con colas dobladas, cajitas de
// cifras, tira de huecos para los objetos y billete del código. Es una imagen fija (PNG): sin animación.
import type Phaser from 'phaser';
import { COLORS, drawBox } from '../theme';
import { darkOf, lightOf, mixColor } from './pixelFx';
import { OUT, diamond, twinkle } from './menuArt';

export interface CardLook {
  accent: number;
  accentDark: number;
  halo: number;
  bgA: number;
  bgB: number;
}

export const cardLook = (won: boolean): CardLook =>
  won
    ? { accent: 0xffd34d, accentDark: 0xc99a1e, halo: 0xfff1b8, bgA: 0x1d2a52, bgB: 0x2b3a67 }
    : { accent: 0xd0574a, accentDark: 0x8e2f28, halo: 0xd9def0, bgA: 0x1a1830, bgB: 0x2c2748 };

/** Fondo, marco, halo del retrato, cinta del resultado, cajas de cifras y tira de objetos. */
export function drawCardBase(g: Phaser.GameObjects.Graphics, w: number, h: number, won: boolean, nStats: number, nItems: number) {
  const L = cardLook(won);
  // Fondo a rayas diagonales de píxel
  g.fillStyle(L.bgA, 1).fillRect(0, 0, w, h);
  g.fillStyle(L.bgB, 1);
  for (let k = -h; k < w; k += 48) for (let y = 0; y < h; y += 8) g.fillRect(k + y, y, 24, 8);
  // Marco exterior del color del resultado
  g.fillStyle(OUT, 1).fillRect(16, 16, w - 32, h - 32);
  g.fillStyle(L.accentDark, 1).fillRect(20, 20, w - 40, h - 40);
  g.fillStyle(L.accent, 1).fillRect(24, 24, w - 48, h - 48);
  for (const [cx, cy] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) diamond(g, cx, cy, 14, OUT, 1, 2), diamond(g, cx, cy, 10, 0xffffff, 1, 2);
  drawBox(g, 40, 40, w - 80, h - 80, { radius: 24 });
  // Vitrina del retrato: halo de anillos escalonados
  g.fillStyle(mixColor(COLORS.panel, L.bgB, 0.12), 1).fillRect(64, 60, 372, 252);
  for (let r = 150; r > 20; r -= 22) {
    const c = mixColor(L.halo, COLORS.panel, (r / 150) * 0.85);
    g.fillStyle(c, 1);
    for (let dy = -r; dy <= r; dy += 8) {
      const half = Math.round(Math.sqrt(r * r - dy * dy) / 8) * 8;
      const y = 186 + dy;
      if (y < 60 || y > 304) continue;
      g.fillRect(Math.max(64, 250 - half), y, Math.min(372, half * 2), 8);
    }
  }
  if (won) for (const [sx, sy] of [[96, 90], [404, 110], [120, 250], [392, 230], [330, 76]]) twinkle(g, sx, sy, 0xffd34d, 1, 4);
  // Peana
  g.fillStyle(OUT, 1).fillEllipse(250, 204, 228, 52);
  g.fillStyle(mixColor(0x8fa0c0, L.accent, 0.25), 1).fillEllipse(250, 200, 220, 46);
  g.fillStyle(lightOf(0x8fa0c0), 1).fillEllipse(250, 194, 180, 22);
  // Cinta del resultado con colas dobladas
  const ry = 230;
  g.fillStyle(OUT, 1).fillRect(56, ry + 10, 40, 56).fillRect(404, ry + 10, 40, 56);
  g.fillStyle(L.accentDark, 1).fillRect(60, ry + 14, 34, 48).fillRect(406, ry + 14, 34, 48);
  g.fillStyle(OUT, 1).fillRect(60, ry + 30, 12, 16).fillRect(428, ry + 30, 12, 16);
  g.fillStyle(OUT, 1).fillRect(76, ry - 4, 348, 72);
  g.fillStyle(L.accent, 1).fillRect(80, ry, 340, 64);
  g.fillStyle(lightOf(L.accent), 1).fillRect(80, ry, 340, 6);
  g.fillStyle(darkOf(L.accent), 1).fillRect(80, ry + 58, 340, 6);
  // Línea bajo el nombre
  g.fillStyle(L.accent, 1).fillRect(470, 168, 640, 4);
  g.fillStyle(OUT, 1).fillRect(470, 172, 640, 2);
  // Cajitas de cifras (2 columnas)
  for (let i = 0; i < nStats; i++) {
    const x = 470 + (i % 2) * 330 - 14;
    const y = 240 + Math.floor(i / 2) * 64 - 4;
    g.fillStyle(OUT, 1).fillRect(x, y, 312, 62);
    g.fillStyle(mixColor(COLORS.panel, 0x8fa6d8, 0.18), 1).fillRect(x + 2, y + 2, 308, 58);
    g.fillStyle([0xe0533a, 0x3b82d6, 0x45b36b, 0xe0a923][i % 4], 1).fillRect(x + 2, y + 2, 6, 58);
  }
  // Tira de huecos para los objetos
  g.fillStyle(OUT, 1).fillRect(64, 408, 1072, 80);
  g.fillStyle(0x2b3a67, 1).fillRect(66, 410, 1068, 76);
  for (let i = 0; i < Math.max(nItems, 1) && i < 14; i++) {
    const x = 104 + i * 76;
    g.fillStyle(OUT, 1).fillRect(x - 32, 414, 64, 64);
    g.fillStyle(0x3d4f86, 1).fillRect(x - 30, 416, 60, 60);
    g.fillStyle(0x5a6ea8, 1).fillRect(x - 30, 416, 60, 4);
  }
}

/** Billete del código (estático) con el texto ya medido: (x, y) arriba a la izquierda del texto. */
export function drawCardTicket(g: Phaser.GameObjects.Graphics, x: number, y: number, tw: number, th: number) {
  const l = x - 18;
  const t = y - 8;
  const w = tw + 36;
  const h = th + 16;
  g.fillStyle(0x000000, 0.25).fillRect(l + 4, t + 6, w, h);
  g.fillStyle(OUT, 1).fillRect(l, t, w, h);
  g.fillStyle(0xc99a1e, 1).fillRect(l + 3, t + 3, w - 6, h - 6);
  g.fillStyle(0xfff1b8, 1).fillRect(l + 7, t + 7, w - 14, h - 14);
  for (const sx of [l, l + w]) {
    g.fillStyle(OUT, 1).fillRect(sx - 6, t + h / 2 - 9, 12, 18);
    g.fillStyle(COLORS.panel, 1).fillRect(sx - 3, t + h / 2 - 6, 6, 12);
  }
}
