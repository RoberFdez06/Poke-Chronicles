// Efectos de las formas de poder (supervisor): el destello de cristal de la Teracristalización, la tormenta roja del
// Dinamax y la pose del movimiento Z con su gran onda. Son estallidos (no auras permanentes); con pocos efectos solo
// queda un anillo corto. Mismo estilo que combatFx/powerFx: píxel gordo y redibujado a saltos.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, mixColor, pixDebris, pixRing } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Rombo (faceta de cristal) de píxeles centrado en (x, y) con radio r. */
function gem(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, a = 1) {
  for (let dy = -r; dy <= r; dy += PX) {
    const half = r - Math.abs(dy);
    for (let dx = -half; dx <= half; dx += PX) {
      const edge = Math.abs(dx) >= half - PX / 2 || Math.abs(dy) >= r - PX;
      const c = edge ? OUT : dx < 0 && dy < 0 ? lightOf(color) : dx > 0 && dy > 0 ? darkOf(color) : color;
      px(g, x + dx, y + dy, c, a);
    }
  }
}

/** Teracristalización: el cristal se forma alrededor con facetas del color del tipo, brilla y estalla en esquirlas. */
export function teraBurst(scene: Phaser.Scene, x: number, y: number, color: number, depth = 12): number {
  const ms = lowFx() ? 400 : 1000;
  if (lowFx()) {
    pixRing(scene, x, y, 70, color, 400, depth);
    return ms;
  }
  animate(scene, depth, ms, (g, k, t) => {
    // facetas que aparecen alrededor y giran un poco
    const n = 8;
    const form = Math.min(1, k * 2.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.0008;
      const d = 26 + 34 * (1 - form) + (k > 0.7 ? (k - 0.7) * 120 : 0);
      gem(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - 6, PX * 2 + (i % 2) * PX, color, Math.min(1, form * 1.2) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1));
    }
    // corona blanca al cerrarse
    if (k > 0.35 && k < 0.7) {
      const r = (k - 0.35) * 160;
      for (let i = 0; i < 14; i++) px(g, x + Math.cos((i / 14) * 6.283) * r, y - 6 + Math.sin((i / 14) * 6.283) * r * 0.7, 0xffffff, 1 - (k - 0.35) * 2.5, PX);
    }
  }, 50);
  scene.time.delayedCall(ms * 0.7, () => {
    starBurst(scene, x, y - 6, color, 8, 1.2, depth + 1);
    pixDebris(scene, x, y - 6, color, 12, 1.3, depth + 1);
  });
  pixRing(scene, x, y + 10, 64, color, 500, depth - 1);
  return ms;
}

/** Dinamax/Gigamax: nubes rojas que suben desde el suelo, rayos de energía de la banda y un anillo enorme. */
export function dynamaxBurst(scene: Phaser.Scene, x: number, y: number, feetY: number, depth = 12): number {
  const ms = lowFx() ? 400 : 1300;
  const red = 0xe8384f;
  if (lowFx()) {
    pixRing(scene, x, feetY, 110, red, 400, depth);
    return ms;
  }
  animate(scene, depth, ms, (g, k, t) => {
    // nubes: bloques de píxeles que suben y se ensanchan
    for (let i = 0; i < 16; i++) {
      const side = (i % 8) - 3.5;
      const ph = Math.min(1, Math.max(0, k * 1.5 - (i % 5) * 0.06));
      const cx = x + side * 22 + Math.sin(i * 3 + t / 300) * 6;
      const cy = feetY - 8 - ph * 150 - (i % 3) * 10;
      const sz = PX * (2 + ph * 3);
      px(g, cx, cy, mixColor(0x5a0f1c, red, ph), (1 - ph * 0.7) * 0.85, sz);
      px(g, cx - sz * 0.3, cy - sz * 0.3, lightOf(red), (1 - ph) * 0.6, sz * 0.4);
    }
    // rayos de energía que bajan al jugador
    if (k < 0.6) {
      for (let i = 0; i < 6; i++) {
        const bx = x + (i - 2.5) * 26;
        for (let yy = y - 170; yy < y + 10; yy += PX * 2) px(g, bx + Math.round(Math.sin(yy * 0.2 + t / 90 + i) * 2) * 2, yy, i % 2 ? 0xffd0d8 : red, (1 - k / 0.6) * 0.8, PX);
      }
    }
    if (k > 0.55) px(g, x, y, 0xffffff, (k - 0.55) * 1.6, PX * 12 * (k - 0.5));
  }, 60);
  pixRing(scene, x, feetY, 120, red, 600, depth);
  scene.time.delayedCall(ms * 0.5, () => {
    pixRing(scene, x, feetY, 190, 0xffffff, 560, depth);
    starBurst(scene, x, y, red, 10, 1.6, depth + 1);
  });
  return ms;
}

/** Movimiento Z: el cristal se ilumina sobre la cabeza, los brazos se cruzan (rayos en X) y sale una onda enorme del tipo. */
export function zMoveFx(scene: Phaser.Scene, x: number, y: number, color: number, depth = 12): number {
  const ms = lowFx() ? 300 : 1100;
  if (lowFx()) {
    pixRing(scene, x, y, 120, color, 300, depth);
    return ms;
  }
  animate(scene, depth, ms, (g, k, t) => {
    const lift = Math.min(1, k * 3);
    const cx = x;
    const cy = y - 56 - lift * 10;
    // cristal Z sobre la cabeza que gira (se ensancha y estrecha)
    const w = Math.abs(Math.cos(t / 160)) * PX * 3 + PX;
    for (let dy = -PX * 3; dy <= PX * 3; dy += PX) {
      const half = Math.max(PX / 2, w * (1 - Math.abs(dy) / (PX * 4)));
      g.fillStyle(OUT, 1).fillRect(snap(cx - half) - 2, cy + dy - 2, half * 2 + 4, PX + 4);
      g.fillStyle(dy < 0 ? lightOf(color) : color, 1).fillRect(snap(cx - half), cy + dy, half * 2, PX);
    }
    // rayos en X que parten del cristal y se alargan
    const len = Math.min(1, k * 1.8) * 140;
    for (const dir of [-1, 1]) {
      for (let d = 0; d < len; d += PX) {
        px(g, cx + dir * d, cy + d * 0.9, 0xffffff, 0.8 * (1 - k * 0.5), PX);
        px(g, cx + dir * d, cy - d * 0.9 + 4, color, 0.8 * (1 - k * 0.5), PX);
      }
    }
    if (k > 0.5) {
      const r = (k - 0.5) * 2 * 260;
      for (let i = 0; i < 28; i++) px(g, x + Math.cos((i / 28) * 6.283) * r, y + Math.sin((i / 28) * 6.283) * r * 0.62, color, 1 - (k - 0.5) * 2, PX * 2);
    }
  }, 50);
  scene.time.delayedCall(ms * 0.5, () => {
    pixRing(scene, x, y, 240, color, 520, depth);
    pixRing(scene, x, y, 150, 0xffffff, 420, depth);
    starBurst(scene, x, y - 20, color, 12, 1.8, depth + 1);
  });
  return ms;
}
