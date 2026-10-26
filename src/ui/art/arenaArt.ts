// Arte de las arenas de jefe (supervisor): casillas de aviso, grietas con brillo, charcos que ondulan, escombros que caen,
// lava que burbujea, placas de hielo con destello, suelo que se hunde y el fondo de cada arena. Todo en píxel gordo sobre
// casillas de TILE (40 px) y sin lógica: GameScene decide qué casilla es qué. Con pocos efectos no hay animación suelta.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf, mixColor } from './pixelFx';

const OUT = 0x18202c;
const P = 5; // píxel de las casillas (40 px = 8×8 píxeles)

export type ArenaTheme = 'lava' | 'inundada' | 'hielo' | 'raices' | 'ruinas';

const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, w = P, h = P) => g.fillStyle(c, a).fillRect(x, y, w, h);

/** Redibuja `paint` cada `ms` mientras el Graphics exista (sin pocos efectos); una sola vez si no. */
function live(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, ms: number, paint: (t: number) => void) {
  paint(0);
  if (lowFx()) return g;
  const t0 = scene.time.now;
  const ev = scene.time.addEvent({
    delay: ms,
    loop: true,
    callback: () => {
      if (!g.active) return;
      g.clear();
      paint(scene.time.now - t0);
    },
  });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

// Grieta: camino quebrado de píxeles (determinista por casilla) con el centro brillando
function crackPath(seed: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  let x = size / 2;
  let y = P;
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  while (y < size - P) {
    pts.push([Math.round(x / P) * P, Math.round(y / P) * P]);
    y += P;
    x += (Math.floor(rnd() * 3) - 1) * P;
    x = Math.max(P, Math.min(size - 2 * P, x));
  }
  return pts;
}

/** Aviso de una casilla que va a cambiar: parpadea con un símbolo (grieta, escombro o agua) en el color del peligro. */
export function arenaWarnTile(scene: Phaser.Scene, x: number, y: number, size: number, kind: 'grieta' | 'charco' | 'escombro', depth = 0.55) {
  const g = scene.add.graphics().setDepth(depth);
  const col = kind === 'grieta' ? 0xff5a1f : kind === 'charco' ? 0x3a8ee6 : 0xcdb88c;
  return live(scene, g, 120, (t) => {
    const on = Math.floor(t / 250) % 2 === 0 || lowFx();
    const a = on ? 0.55 : 0.22;
    // marco de esquinas
    for (const [cx, cy] of [[0, 0], [size - 2 * P, 0], [0, size - 2 * P], [size - 2 * P, size - 2 * P]]) px(g, x + cx, y + cy, col, a + 0.2, 2 * P, P).fillRect(x + cx + (cx ? P : 0), y + cy, P, 2 * P);
    px(g, x + P, y + P, col, a * 0.35, size - 2 * P, size - 2 * P);
    if (kind === 'grieta') for (const [cx, cy] of crackPath(x * 7 + y, size)) px(g, x + cx, y + cy, 0xffe0a0, a + 0.2);
    else if (kind === 'charco') for (let k = 0; k < 3; k++) px(g, x + 2 * P + k * P, y + 3 * P + (k % 2) * P, 0xcfeaff, a + 0.2);
    else for (let k = 0; k < 3; k++) px(g, x + 2 * P + k * P, y + 2 * P + ((t / 200 + k) % 3) * P, col, a + 0.3);
  });
}

/** Grieta abierta: el suelo se parte y por dentro sale un brillo naranja que respira. */
export function arenaCrack(scene: Phaser.Scene, x: number, y: number, size: number, depth = 0.5) {
  const g = scene.add.graphics().setDepth(depth);
  const path = crackPath(x * 7 + y, size);
  return live(scene, g, 160, (t) => {
    const glow = 0.5 + 0.5 * Math.sin(t / 380);
    px(g, x + P, y + P, 0x120c08, 0.35, size - 2 * P, size - 2 * P);
    for (const [cx, cy] of path) {
      px(g, x + cx - P, y + cy, OUT, 0.85, 3 * P, P);
      px(g, x + cx, y + cy, mixColor(0xff5a1f, 0xffd54f, glow), 1);
    }
    px(g, x + path[0][0], y + path[0][1] - P, 0xff5a1f, 0.7);
  });
}

/** Charco: agua pixelada con destellos y ondas que se mueven. */
export function arenaPuddle(scene: Phaser.Scene, x: number, y: number, size: number, depth = 0.6) {
  const g = scene.add.graphics().setDepth(depth);
  return live(scene, g, 160, (t) => {
    px(g, x + P, y + P, 0x2c6fc2, 0.6, size - 2 * P, size - 2 * P);
    px(g, x + 2 * P, y + 2 * P, 0x3a8ee6, 0.7, size - 4 * P, size - 4 * P);
    for (let k = 0; k < 3; k++) {
      const ph = ((t / 900 + k / 3) % 1);
      const rx = x + 2 * P + k * P * 1.5;
      const ry = y + 2 * P + Math.round(ph * 4) * P;
      px(g, rx, ry, 0xcfeaff, 1 - ph, 2 * P, P / 2);
    }
    px(g, x + 2 * P, y + 2 * P, 0xffffff, 0.8);
  });
}

/** Montón de escombros que cae desde arriba y rebota; devuelve el Graphics (para guardarlo como roca y destruirlo con ella). */
export function arenaRubble(scene: Phaser.Scene, x: number, y: number, size: number, depth = 1) {
  const g = scene.add.graphics().setDepth(depth);
  const base = 0x8a7b68;
  const rocks: [number, number, number, number][] = [[2, 3, 3, 3], [5, 2, 2, 2], [1, 5, 2, 2], [4, 4, 3, 3], [3, 1, 2, 2]];
  px(g, x + P, y + 6 * P, OUT, 0.35, 6 * P, P);
  for (const [rx, ry, rw, rh] of rocks) {
    px(g, x + rx * P - 1, y + ry * P - 1, OUT, 1, rw * P + 2, rh * P + 2);
    px(g, x + rx * P, y + ry * P, base, 1, rw * P, rh * P);
    px(g, x + rx * P, y + ry * P, lightOf(base), 1, rw * P, P);
    px(g, x + rx * P + (rw - 1) * P, y + ry * P + P, darkOf(base), 1, P, (rh - 1) * P);
  }
  g.setAlpha(0);
  g.y = -44;
  scene.tweens.add({ targets: g, y: 0, alpha: 1, duration: 220, ease: 'Quad.easeIn' });
  if (!lowFx()) {
    scene.time.delayedCall(220, () => {
      if (!g.active) return;
      for (let k = 0; k < 6; k++) {
        const d = scene.add.graphics().setDepth(depth + 0.1);
        px(d, x + size / 2, y + size - P, 0xb8a98f, 0.9, P, P);
        scene.tweens.add({ targets: d, x: (k - 2.5) * 12, y: -14 - (k % 3) * 8, alpha: 0, duration: 380, onComplete: () => d.destroy() });
      }
    });
  }
  return g;
}

/** Lava: burbujas que suben y brillo que ondula. */
export function arenaLava(scene: Phaser.Scene, x: number, y: number, size: number, depth = 0.5) {
  const g = scene.add.graphics().setDepth(depth);
  return live(scene, g, 150, (t) => {
    px(g, x, y, 0xb02a08, 0.9, size, size);
    px(g, x + P, y + P, 0xff4a10, 1, size - 2 * P, size - 2 * P);
    for (let k = 0; k < 4; k++) {
      const wob = Math.sin(t / 420 + k * 2 + x * 0.3) * 0.5 + 0.5;
      px(g, x + P + ((k * 13) % (size - 3 * P)), y + P + Math.round(wob * (size - 4 * P) / P) * P, 0xffb347, 0.9, 2 * P, P);
    }
    const b = ((t / 1100 + (x + y) / 97) % 1);
    px(g, x + 3 * P + ((x / 3) % P), y + size - P - b * (size - 2 * P), 0xffe9a0, 1 - b, P, P);
    px(g, x, y + size - P, 0x6a1604, 0.7, size, P);
  });
}

/** Placa de hielo: brillo que cruza en diagonal y bordes claros. */
export function arenaIce(scene: Phaser.Scene, x: number, y: number, size: number, depth = 0.5) {
  const g = scene.add.graphics().setDepth(depth);
  return live(scene, g, 180, (t) => {
    px(g, x, y, 0xcfeeff, 0.75, size, size);
    px(g, x, y, 0xffffff, 0.8, size, P / 2);
    px(g, x, y, 0xffffff, 0.8, P / 2, size);
    px(g, x, y + size - P / 2, 0x7fb6d8, 0.8, size, P / 2);
    px(g, x + size - P / 2, y, 0x7fb6d8, 0.8, P / 2, size);
    const s = ((t / 1400 + (x + y) / 200) % 1) * 2 * size;
    for (let k = 0; k < size; k += P) {
      const gx = s - k;
      if (gx >= 0 && gx < size) px(g, x + gx, y + k, 0xffffff, 0.85, P, P);
    }
  });
}

/** Placas oscuras que se agrietan y se hunden al empezar la caída: crecen y se oscurecen durante `ms`. */
export function arenaCollapse(scene: Phaser.Scene, x: number, y: number, ms: number, depth = 0.58) {
  const g = scene.add.graphics().setDepth(depth).setAlpha(0);
  const path = crackPath(Math.round(x * 3 + y), 80);
  g.fillStyle(0x120c08, 1).fillRect(x - 40, y - 12, 80, 24);
  for (const [cx, cy] of path.slice(0, 8)) px(g, x - 40 + cx, y - 12 + (cy % 24), 0xff9a4a, 0.9, P, P / 2);
  scene.tweens.add({ targets: g, alpha: 0.9, duration: ms });
  return g;
}

/** Fondo de la arena nueva: tinte + trama de píxeles propia del tema (lava con brasas, agua con ondas, hielo con grietas…). */
export function arenaBackdrop(scene: Phaser.Scene, x: number, y: number, w: number, h: number, theme: ArenaTheme, tint: number, depth = 0.33) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(tint, theme === 'hielo' ? 0.45 : 0.6).fillRect(x, y, w, h);
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const dots = 90;
  for (let k = 0; k < dots; k++) {
    const dx = x + Math.floor((rnd() * w) / P) * P;
    const dy = y + Math.floor((rnd() * h) / P) * P;
    if (theme === 'lava') px(g, dx, dy, k % 3 ? 0x2a0a04 : 0xff6a2a, k % 3 ? 0.5 : 0.35);
    else if (theme === 'inundada') px(g, dx, dy, 0x9fd4ff, 0.22, 3 * P, P / 2);
    else if (theme === 'hielo') px(g, dx, dy, 0xffffff, 0.35, P, P);
    else if (theme === 'raices') px(g, dx, dy, k % 2 ? 0x1b300f : 0x4f7a2e, 0.4, 2 * P, P);
    else px(g, dx, dy, k % 2 ? 0x3a322c : 0x8a7e72, 0.35, 2 * P, P);
  }
  if (theme === 'lava' && !lowFx()) {
    // brasas que suben por toda la sala
    const embers = scene.add.graphics().setDepth(depth + 0.01);
    const t0 = scene.time.now;
    const ev = scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!embers.active) return;
        embers.clear();
        const t = scene.time.now - t0;
        for (let k = 0; k < 18; k++) {
          const ph = ((t / 3200 + k / 18) % 1);
          px(embers, x + ((k * 53) % w), y + h - ph * h, k % 2 ? 0xffb347 : 0xff6a2a, 1 - ph, P / 2 + 1, P / 2 + 1);
        }
      },
    });
    embers.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
    g.once(Phaser.GameObjects.Events.DESTROY, () => embers.destroy());
  }
  return g;
}
