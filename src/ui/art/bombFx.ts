// Bomba y explosión (supervisor): la bomba en el suelo es una bola de píxeles con mecha viva que chisporrotea, parpadea
// cada vez más rápido y marca en el suelo la zona que va a volar; la explosión es un fogonazo blanco, una bola de fuego en
// capas, onda de choque, columnas de humo, escombros, brasas y una marca de quemado que se apaga despacio.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { PX, animate, darkOf, lightOf, mixColor, pixDebris, pixRing } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Dibuja la bomba (cuerpo, brillo, tapa y mecha) con su centro en (x, y); `flash` 0-1 la pone al rojo vivo. */
function bombBody(g: Phaser.GameObjects.Graphics, x: number, y: number, flash: number, bob: number) {
  const r = PX * 2.5;
  const body = mixColor(0x3b4252, 0xe53935, flash);
  for (let dy = -r; dy <= r; dy += PX) {
    for (let dx = -r; dx <= r; dx += PX) {
      const d = Math.hypot(dx, dy);
      if (d > r + PX / 2) continue;
      let c = body;
      if (d > r - PX) c = OUT;
      else if (dx < 0 && dy < 0 && d > PX) c = lightOf(body);
      else if (dx > 0 && dy > 0) c = darkOf(body);
      px(g, x + dx, y + dy + bob, c);
    }
  }
  px(g, x - PX, y - PX * 1.5 + bob, 0xffffff, 0.9, PX); // brillo
  // tapa y mecha
  px(g, x + PX * 0.5, y - r - PX * 0.5 + bob, 0x6b7280, 1, PX * 1.5);
  px(g, x + PX * 1.5, y - r - PX * 1.5 + bob, 0x8d6e63, 1, PX);
  px(g, x + PX * 2.5, y - r - PX * 2 + bob, 0x8d6e63, 1, PX);
}

/**
 * Bomba encendida que se queda a tus pies hasta que estalla (`fuseMs`). Devuelve el Graphics (se destruye al estallar,
 * llamando a `.destroy()`). Parpadea al rojo cada vez más rápido y marca en el suelo el radio de la explosión.
 */
export function bombFuse(scene: Phaser.Scene, x: number, y: number, fuseMs: number, radius: number, depth = 3): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const t0 = scene.time.now;
  const low = lowFx();
  const tick = () => {
    if (!g.active) return;
    g.clear();
    const t = scene.time.now - t0;
    const k = Math.min(1, t / fuseMs);
    // aviso en el suelo: círculo de puntos que se va llenando
    if (!low) {
      const n = 28;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const on = i / n < k + 0.1 || Math.floor(t / 120) % 2 === 0;
        px(g, x + Math.cos(a) * radius, y + 8 + Math.sin(a) * radius * 0.55, 0xff7043, on ? 0.55 : 0.18);
      }
    }
    // parpadeo cada vez más rápido
    const period = 420 - 330 * k;
    const flash = Math.floor(t / period) % 2 === 0 ? 0 : 0.35 + 0.65 * k;
    const bob = low ? 0 : Math.round(Math.sin(t / 90) * 1) * 2;
    bombBody(g, x, y, flash, bob);
    // chispas de la mecha
    if (!low) {
      const sx = x + PX * 2.5;
      const sy = y - PX * 4.5 + bob;
      px(g, sx, sy, 0xffee58, 1, PX);
      px(g, sx, sy, 0xffffff, 1, PX / 2);
      for (let i = 0; i < 3; i++) {
        const ph = ((t / 240 + i / 3) % 1);
        px(g, sx + Math.sin(i * 7 + t / 90) * PX * 1.3, sy - ph * PX * 4, ph < 0.5 ? 0xffb300 : 0xff7043, 1 - ph, PX / 2 + 1);
      }
    }
  };
  tick();
  const ev = scene.time.addEvent({ delay: low ? 150 : 50, loop: true, callback: tick });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

/**
 * Explosión: fogonazo blanco, bola de fuego en capas, onda de choque, humo, escombros, brasas y marca de quemado.
 * `color` es el del fuego (naranja la bomba normal, otro para la bomba cebo). Con pocos efectos: bola + anillo.
 */
export function bombExplosion(scene: Phaser.Scene, x: number, y: number, radius: number, color = 0xff8a30, depth = 12) {
  const hot = lightOf(color);
  const dark = darkOf(color);
  if (lowFx()) {
    animate(scene, depth, 260, (g, k) => {
      const r = radius * (0.5 + 0.5 * k);
      for (let yy = -r; yy <= r; yy += PX) {
        const half = Math.sqrt(Math.max(0, r * r - yy * yy));
        g.fillStyle(color, 0.8 * (1 - k)).fillRect(snap(x - half), snap(y + yy * 0.8), snap(half * 2) || PX, PX);
      }
    });
    pixRing(scene, x, y, radius * 1.1, color, 300, depth);
    return;
  }
  // marca de quemado en el suelo, bajo todo, que se apaga despacio
  animate(scene, 1.4, 3200, (g, k) => {
    const a = (1 - k) * 0.55;
    for (let i = 0; i < 40; i++) {
      const ang = i * 2.399;
      const rr = (radius * 0.75) * Math.sqrt((i + 1) / 40);
      px(g, x + Math.cos(ang) * rr, y + 8 + Math.sin(ang) * rr * 0.55, 0x101418, a, PX * 2);
    }
    px(g, x, y + 8, 0x000000, a, PX * 4);
  }, 160);
  // 1) fogonazo blanco que cubre y se va
  animate(scene, depth + 1, 140, (g, k) => {
    const r = radius * (0.5 + k * 0.7);
    for (let yy = -r; yy <= r; yy += PX) {
      const half = Math.sqrt(Math.max(0, r * r - yy * yy));
      g.fillStyle(0xffffff, 0.9 * (1 - k)).fillRect(snap(x - half), snap(y + yy * 0.8), snap(half * 2) || PX, PX);
    }
  }, 35);
  // 2) bola de fuego en capas (oscuro, color, claro, blanco) con borde irregular
  animate(scene, depth, 520, (g, k, t) => {
    const grow = Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 1.6));
    const layers: [number, number][] = [[1, dark], [0.82, color], [0.58, hot], [0.32, 0xffffff]];
    for (const [f, c] of layers) {
      const r = radius * 0.95 * grow * f * (1 - k * 0.45 * (1 - f * 0.4));
      for (let yy = -r; yy <= r; yy += PX) {
        const half = Math.sqrt(Math.max(0, r * r - yy * yy));
        const wob = Math.round(Math.sin(yy * 0.35 + t * 0.02 + f * 5) * 1) * PX;
        g.fillStyle(c, Math.max(0, 1 - k * 0.9)).fillRect(snap(x - half + wob), snap(y - 6 + yy * 0.85), snap(half * 2) || PX, PX);
      }
    }
  }, 40);
  // 3) columnas de humo que suben y se ensanchan
  animate(scene, depth - 1, 1100, (g, k) => {
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * (radius * 0.22);
      const ph = Math.min(1, Math.max(0, k * 1.3 - i * 0.04));
      const sz = PX * (1.5 + ph * 3);
      px(g, x + ox + Math.sin(i * 3 + k * 6) * PX, y - 10 - ph * radius * 0.9 - (i % 2) * 8, mixColor(0x37474f, 0x90a4ae, ph), (1 - ph) * 0.7, sz);
    }
  }, 60);
  // 4) onda de choque doble y escombros
  pixRing(scene, x, y, radius * 1.25, 0xffffff, 300, depth + 0.5);
  pixRing(scene, x, y, radius * 1.05, color, 420, depth);
  pixDebris(scene, x, y, 0x8d6e63, 10, 1.3, depth + 1);
  pixDebris(scene, x, y, color, 8, 1.1, depth + 1);
  // 5) brasas que saltan y caen
  animate(scene, depth + 1, 900, (g, k) => {
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + i;
      const sp = 0.6 + (i % 4) * 0.25;
      const d = radius * 1.1 * sp * Phaser.Math.Easing.Cubic.Out(k);
      const fall = k * k * 50;
      px(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.55 - Math.sin(k * Math.PI) * 26 * sp + fall, k < 0.5 ? 0xffd54f : 0xff7043, 1 - k, PX / 2 + 1);
    }
  }, 45);
}
