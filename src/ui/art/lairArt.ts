// Guarida de la cacería legendaria (supervisor): claro de tierra oscura con aura del tipo del legendario, nido-altar
// de piedras con runas que laten, niebla que se arrastra por los bordes, motas que suben y, al entrar, una columna de
// luz que baja y revela al legendario. Píxel gordo; con pocos efectos queda quieta (claro, altar y runas fijos).
// Solo dibujo: la lógica sigue en GameScene.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { animate, darkOf, lightOf, mixColor, pixRing, PX } from './pixelFx';

const OUT = 0x18202c;
const STONE = 0x6f7480;
const snap = (v: number) => Math.round(v / PX) * PX;
const cell = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, w = PX, h = PX) =>
  g.fillStyle(c, a).fillRect(snap(x), snap(y), w, h);

/** Elipse pixelada rellena (perspectiva: más ancha que alta). */
function pixEllipse(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, c: number, a: number) {
  for (let dy = -ry; dy <= ry; dy += PX) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) / PX) * PX;
    if (w > 0) g.fillStyle(c, a).fillRect(snap(cx - w), snap(cy + dy), w * 2, PX);
  }
}

/** Dibujo de un fotograma de la guarida (t en ms; con t fijo sale la versión estática). */
export function drawLair(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, t: number, still: boolean) {
  const RX = 230;
  const RY = 130;
  const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t / 420);
  // Claro: halo exterior del tipo, tierra oscura y un velo de aura que late
  pixEllipse(g, cx, cy, RX + 36, RY + 22, color, 0.18 + 0.08 * pulse);
  pixEllipse(g, cx, cy, RX, RY, mixColor(0x2a2430, color, 0.3), 0.85);
  pixEllipse(g, cx, cy, RX - 40, RY - 24, mixColor(0x1c1820, color, 0.35), 0.8);
  // Anillo de luz del tipo bajo las piedras y velo central que late
  pixEllipse(g, cx, cy, 136, 74, lightOf(color), 0.25 + 0.25 * pulse);
  pixEllipse(g, cx, cy, 118, 60, mixColor(0x1c1820, color, 0.4), 1);
  pixEllipse(g, cx, cy, 80, 40, color, 0.18 + 0.2 * pulse);
  // Grietas fijas en la tierra con un resplandor del tipo
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2 + 0.3;
    for (let s = 0; s < 6; s++) {
      const r = 70 + s * 14;
      const wob = ((k * 7 + s * 3) % 5) - 2;
      cell(g, cx + Math.cos(ang) * r * 1.6 + wob * 2, cy + Math.sin(ang) * r * 0.85, s < 3 ? lightOf(color) : darkOf(color), 0.25 + 0.35 * pulse * (1 - s / 6));
    }
  }
  // Nido-altar: anillo de piedras con contorno, luz arriba y sombra abajo
  const N = 18;
  for (let k = 0; k < N; k++) {
    const ang = (k / N) * Math.PI * 2;
    const x = cx + Math.cos(ang) * 120;
    const y = cy + Math.sin(ang) * 62;
    const big = k % 3 === 0;
    const w = big ? 28 : 20;
    const h = big ? 24 : 16;
    g.fillStyle(OUT, 1).fillRect(snap(x - w / 2) - 4, snap(y - h) - 4, w + 8, h + 8);
    g.fillStyle(STONE, 1).fillRect(snap(x - w / 2), snap(y - h), w, h);
    g.fillStyle(lightOf(STONE), 1).fillRect(snap(x - w / 2), snap(y - h), w, PX);
    g.fillStyle(darkOf(STONE), 1).fillRect(snap(x - w / 2), snap(y - h) + h - PX, w, PX);
    // Runa del tipo en las piedras grandes, que se enciende por turnos
    if (big) {
      const on = still ? 0.8 : 0.35 + 0.65 * Math.max(0, Math.sin(t / 300 - k * 0.7));
      cell(g, x - 2, y - h + 6, lightOf(color), on, PX, PX * 2);
      cell(g, x - 6, y - h + 10, color, on, PX * 3, PX);
    }
  }
  // Ramitas del nido entre las piedras
  for (let k = 0; k < 20; k++) {
    const ang = (k / 20) * Math.PI * 2 + 0.15;
    const x = cx + Math.cos(ang) * 104;
    const y = cy + Math.sin(ang) * 52;
    cell(g, x, y, k % 2 ? 0x7a5230 : 0x5e4329, 1, PX * 3, PX);
  }
  // Sello central: rombo de luz del tipo que respira
  const s = 28 + Math.round(pulse * 2) * PX;
  for (let dy = -s / 2; dy <= s / 2; dy += PX) {
    const w = Math.round((s - Math.abs(dy) * 2) / PX) * PX;
    if (w > 0) g.fillStyle(lightOf(color), 0.35 + 0.3 * pulse).fillRect(snap(cx - w), snap(cy + dy), w * 2, PX);
  }
  cell(g, cx - 4, cy - 4, 0xffffff, 0.5 + 0.4 * pulse, PX * 2, PX * 2);
  if (still) return;
  // Niebla: bancos que se arrastran por el borde del claro
  for (let k = 0; k < 7; k++) {
    const ang = (k / 7) * Math.PI * 2 + t / 9000;
    const x = cx + Math.cos(ang) * (RX + 10);
    const y = cy + Math.sin(ang) * (RY + 8);
    const w = 70 + (k % 3) * 20;
    const a = 0.16 + 0.08 * Math.sin(t / 700 + k);
    g.fillStyle(mixColor(0xdfe6f0, color, 0.25), a).fillRect(snap(x - w / 2), snap(y), w, PX * 2);
    g.fillStyle(mixColor(0xdfe6f0, color, 0.25), a * 0.7).fillRect(snap(x - w / 3), snap(y - PX * 2), (w * 2) / 3, PX * 2);
  }
  // Motas del aura que suben desde el claro y se apagan
  for (let k = 0; k < 14; k++) {
    const life = ((t / 2400 + k * 0.137) % 1);
    const x = cx + Math.sin(k * 2.4) * (40 + (k * 13) % 150);
    const y = cy + Math.cos(k * 1.7) * 50 - life * 110;
    cell(g, x, y, k % 3 ? lightOf(color) : 0xffffff, 0.8 * (1 - life));
  }
}

/** Monta la guarida animada en el centro de la sala (debajo de todo). Devuelve el objeto para borrarlo al salir. */
export function buildLegendLair(scene: Phaser.Scene, cx: number, cy: number, color: number, depth = 1.3): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  if (lowFx()) {
    drawLair(g, cx, cy, color, 0, true);
    return g;
  }
  const t0 = scene.time.now;
  const ev = scene.time.addEvent({ delay: 80, loop: true, callback: () => {
    g.clear();
    drawLair(g, cx, cy, color, scene.time.now - t0, false);
  } });
  drawLair(g, cx, cy, color, 0, false);
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

/** Columna de luz que baja sobre el legendario y lo revela (una vez, al entrar). Con pocos efectos, nada. */
export function legendReveal(scene: Phaser.Scene, x: number, y: number, color: number, depth = 8) {
  if (lowFx()) return;
  animate(scene, depth, 1300, (g, k) => {
    const fall = Math.min(1, k / 0.35);
    const fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const w = Math.round((54 - 30 * Math.max(0, k - 0.35)) / PX) * PX;
    const top = y - 520;
    const bot = top + (y - top) * fall;
    g.fillStyle(lightOf(color), 0.35 * fade).fillRect(snap(x - w), snap(top), w * 2, snap(bot - top));
    g.fillStyle(0xffffff, 0.55 * fade).fillRect(snap(x - w / 3), snap(top), snap((w * 2) / 3), snap(bot - top));
    if (fall >= 1) pixEllipse(g, x, y + 40, 70 + k * 40, 24 + k * 12, lightOf(color), 0.4 * fade);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI * 2 + k * 3;
      const r = 30 + k * 90;
      if (fall >= 1) cell(g, x + Math.cos(a) * r, y + 40 + Math.sin(a) * r * 0.4 - k * 30, s % 2 ? 0xffffff : color, fade);
    }
  });
  scene.time.delayedCall(450, () => pixRing(scene, x, y + 40, 110, lightOf(color), 520, depth - 1));
}
