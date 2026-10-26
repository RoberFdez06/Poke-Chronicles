// Arte de las arenas de los legendarios (fase 2 del jefe): la animación del derrumbe propia de cada concepto (relojes que
// rebobinan, grieta del espacio, sombras que voltean el suelo, viento y rayo verde, marea con torbellino, magma que
// brota, luz de la creación, arcoíris y fuego sagrado, tormenta, ondas psíquicas) y el fondo animado de la arena a la que
// se cae. Píxel gordo encajado en rejilla y redibujado a saltos; con pocos efectos, un solo fotograma estático.
import Phaser from 'phaser';
import type { FallTheme } from '../../level/arenaPhase';
import { lowFx } from '../theme';
import { mixColor } from './pixelFx';

type G = Phaser.GameObjects.Graphics;
const P = 5;
const OUT = 0x18202c;
const q = (v: number) => Math.round(v / P) * P;
const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe94a, 0x6ad84a, 0x4ab0ff, 0x6a5aff, 0xc05aff];
const PLATES = [0xff6a3a, 0x4aa8ff, 0x6ad84a, 0xffe94a, 0xbfe6ff, 0xd04a4a, 0xa05ad0, 0xc8a050, 0x8ad0ff, 0xff70d0, 0x9ade5a, 0x8a8a9a, 0x5a3a8a, 0x3a3a3a, 0xb0b0c8, 0xffb0e0];

/** Tiempo de prueba congelado (solo el banco visual): `globalThis.__fallT = ms`. */
const frozen = () => (globalThis as { __fallT?: number }).__fallT;

/** Redibuja `paint(t)` cada `ms` mientras `g` exista; con pocos efectos, una sola vez. */
function ticker(scene: Phaser.Scene, g: G, ms: number, paint: (t: number) => void): G {
  const t0 = scene.time.now;
  const draw = () => {
    if (!g.active) return;
    g.clear();
    paint(frozen() ?? scene.time.now - t0);
  };
  draw();
  if (lowFx()) return g;
  const ev = scene.time.addEvent({ delay: ms, loop: true, callback: draw });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Pinta píxeles recortados a un rectángulo. */
function painter(g: G, x0: number, y0: number, w: number, h: number) {
  return (x: number, y: number, c: number, a = 1, sw = P, sh = sw) => {
    const sx = q(x);
    const sy = q(y);
    if (sx < x0 || sy < y0 || sx + sw > x0 + w || sy + sh > y0 + h || a <= 0) return;
    g.fillStyle(c, Math.min(1, a)).fillRect(sx, sy, sw, sh);
  };
}
type Dot = ReturnType<typeof painter>;

function ring(dot: Dot, cx: number, cy: number, r: number, c: number, a: number, flat = 0.8, size = P, phase = 0, dash = 0) {
  const n = Math.max(12, Math.floor((r * 6.283) / P));
  for (let i = 0; i < n; i++) {
    if (dash > 0 && Math.floor(i / dash + phase) % 2 === 1) continue;
    const ang = (i / n) * 6.283;
    dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * flat, c, a, size);
  }
}
function disc(dot: Dot, cx: number, cy: number, r: number, c: number, a: number, flat = 1) {
  for (let y = -r * flat; y <= r * flat; y += P) {
    const half = Math.sqrt(Math.max(0, 1 - (y / (r * flat)) ** 2)) * r;
    for (let x = -half; x <= half; x += P) dot(cx + x, cy + y, c, a);
  }
}
function line(dot: Dot, ax: number, ay: number, bx: number, by: number, c: number, a: number, size = P) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / P));
  for (let i = 0; i <= n; i++) dot(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, c, a, size);
}
/** Rayo quebrado de (ax,ay) a (bx,by) con núcleo blanco y halo de color. */
function bolt(dot: Dot, ax: number, ay: number, bx: number, by: number, c: number, a: number, seed: number) {
  const r = seeded(seed);
  const segs = 10;
  let px0 = ax;
  let py0 = ay;
  for (let i = 1; i <= segs; i++) {
    const k = i / segs;
    const nx = ax + (bx - ax) * k + (i < segs ? (r() - 0.5) * 50 : 0);
    const ny = ay + (by - ay) * k + (i < segs ? (r() - 0.5) * 20 : 0);
    line(dot, px0 - P, py0, nx - P, ny, c, a * 0.6);
    line(dot, px0 + P, py0, nx + P, ny, c, a * 0.6);
    line(dot, px0, py0, nx, ny, 0xffffff, a);
    px0 = nx;
    py0 = ny;
  }
}
/** Reloj: esfera, 12 marcas, agujas (ángulos en radianes). */
function clock(dot: Dot, cx: number, cy: number, r: number, rim: number, a: number, hA: number, mA: number) {
  disc(dot, cx, cy, r, 0x0c1626, a * 0.55, 0.8);
  ring(dot, cx, cy, r, OUT, a, 0.8, P + 2);
  ring(dot, cx, cy, r - 1, rim, a, 0.8);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * 6.283;
    dot(cx + Math.cos(ang) * (r - 8), cy + Math.sin(ang) * (r - 8) * 0.8, i % 3 ? 0x8aa4b8 : 0xffffff, a);
  }
  for (let d = 0; d < r * 0.5; d += P) dot(cx + Math.cos(hA) * d, cy + Math.sin(hA) * d * 0.8, rim, a);
  for (let d = 0; d < r * 0.8; d += P) dot(cx + Math.cos(mA) * d, cy + Math.sin(mA) * d * 0.8, 0xffffff, a);
  dot(cx, cy, 0xffffff, a, P + 2);
}
function gear(dot: Dot, cx: number, cy: number, r: number, c: number, a: number, rot: number) {
  ring(dot, cx, cy, r, c, a, 0.8, P);
  for (let i = 0; i < 8; i++) {
    const ang = rot + (i / 8) * 6.283;
    dot(cx + Math.cos(ang) * (r + P), cy + Math.sin(ang) * (r + P) * 0.8, c, a, P + 1);
  }
  dot(cx, cy, c, a, P + 2);
}
function cloud(dot: Dot, cx: number, cy: number, s: number, c: number, a: number) {
  for (const [ox, oy, r] of [[0, 0, 1], [-1.1, 0.25, 0.7], [1.1, 0.25, 0.75], [0.5, -0.4, 0.7]] as const) disc(dot, cx + ox * s, cy + oy * s, r * s, c, a, 0.7);
  for (let x = -1.6 * s; x < 1.6 * s; x += P) dot(cx + x, cy + 0.55 * s, mixColor(c, 0x6a8ab8, 0.4), a);
}

// ---------------------------------------------------------------------------------------------------------------------
// Fondos de las arenas
// ---------------------------------------------------------------------------------------------------------------------

/** Temas de concepto que tienen fondo propio aquí (los de siempre los pinta arenaBackdrop). */
export const CONCEPT_THEMES: readonly FallTheme[] = ['tiempo', 'espacio', 'distorsion', 'cielo', 'mar', 'magma', 'creacion', 'arcoiris', 'tormenta', 'psique'];

/**
 * Fondo animado de una arena de concepto: una capa fija (tinte y trama) y otra que se mueve. Devuelve la fija; la que se
 * mueve se destruye con ella. Las capas son translúcidas para que el suelo del bioma y los obstáculos se sigan leyendo.
 */
export function fallBackdrop(scene: Phaser.Scene, x: number, y: number, w: number, h: number, theme: FallTheme, tint: number, depth = 0.33): G {
  const base = scene.add.graphics().setDepth(depth);
  const dot = painter(base, x, y, w, h);
  const rnd = seeded(0xa11ce + theme.length * 977);
  const cx = x + w / 2;
  const cy = y + h / 2;
  base.fillStyle(tint, theme === 'creacion' || theme === 'cielo' ? 0.5 : 0.68).fillRect(x, y, w, h);
  const anim = scene.add.graphics().setDepth(depth + 0.01);
  base.once(Phaser.GameObjects.Events.DESTROY, () => anim.destroy());
  const ad = painter(anim, x, y, w, h);
  switch (theme) {
    case 'tiempo': {
      // Cámara del tiempo: celosía de rombos dorados, losas de acero y relojes que giran (unos adelante, otros atrás)
      for (let d = -h; d < w; d += 80) {
        line(dot, x + d, y, x + d + h, y + h, 0xd8b45a, 0.1);
        line(dot, x + d + h, y, x + d, y + h, 0xd8b45a, 0.1);
      }
      ring(dot, cx, cy, 150, 0x7fd4ff, 0.14, 0.8, P);
      ring(dot, cx, cy, 160, 0x2a4a6a, 0.3, 0.8, P);
      const clocks: [number, number, number][] = [[0.17, 0.27, 36], [0.83, 0.27, 36], [0.17, 0.76, 32], [0.83, 0.76, 32], [0.5, 0.5, 70]];
      ticker(scene, anim, 90, (t) => {
        clocks.forEach(([fx, fy, r], i) => {
          const dir = i % 2 ? -1 : 1;
          const big = r > 60;
          clock(ad, x + fx * w, y + fy * h, r, 0xd8b45a, big ? 0.22 : 0.7, (dir * t) / 4000 + i, (dir * t) / 330 + i * 2);
        });
        for (let i = 0; i < 36; i++) {
          const ph = (t / 5200 + i / 36) % 1;
          ad(x + ((i * 137) % w) + Math.sin(ph * 6 + i) * 12, y + h - ph * h, i % 3 ? 0xffd870 : 0xffffff, Math.sin(ph * 3.14) * 0.85, i % 4 ? P - 2 : P);
        }
        ring(ad, cx, cy, 150 + Math.sin(t / 700) * 6, 0x7fd4ff, 0.18 + 0.1 * Math.sin(t / 500), 0.8, P, t / 900, 3);
      });
      break;
    }
    case 'espacio': {
      // Vacío estelar: nebulosas a trama, estrellas fijas y planetas pequeños que orbitan
      for (const [nx, ny, nr, nc] of [[0.25, 0.3, 140, 0x8a2a8a], [0.75, 0.7, 160, 0x2a4aa8], [0.6, 0.2, 90, 0xc04a9a]] as const)
        for (let yy = -nr; yy < nr; yy += P) for (let xx = -nr; xx < nr; xx += P) {
          const d = Math.hypot(xx, yy * 1.4) / nr;
          if (d < 1 && ((xx + yy) / P) % 2 === 0 && rnd() < 1 - d) dot(x + nx * w + xx, y + ny * h + yy, nc, 0.22 * (1 - d));
        }
      for (let i = 0; i < 70; i++) dot(x + rnd() * w, y + rnd() * h, i % 5 ? 0xcfd8ff : 0xffffff, 0.3 + rnd() * 0.4, i % 9 ? P - 3 : P - 1);
      const stars = Array.from({ length: 22 }, () => [x + rnd() * w, y + rnd() * h, rnd() * 6] as const);
      ticker(scene, anim, 90, (t) => {
        for (const [sx, sy, ph] of stars) {
          const a = 0.5 + 0.5 * Math.sin(t / 300 + ph);
          ad(sx, sy, 0xffffff, a);
          if (a > 0.8) { ad(sx - P, sy, 0xffd8ff, a * 0.5); ad(sx + P, sy, 0xffd8ff, a * 0.5); ad(sx, sy - P, 0xffd8ff, a * 0.5); ad(sx, sy + P, 0xffd8ff, a * 0.5); }
        }
        const planets: [number, number, number, number, number, number][] = [[0.2, 0.72, 60, 14, 0xd08a4a, 0.00025], [0.78, 0.25, 50, 10, 0x6ab0ff, -0.0004], [0.5, 0.15, 30, 7, 0xb0ffb0, 0.0007]];
        for (const [fx, fy, orb, r, c, sp] of planets) {
          const px0 = x + fx * w + Math.cos(t * sp) * orb;
          const py0 = y + fy * h + Math.sin(t * sp) * orb * 0.5;
          disc(ad, px0, py0, r, c, 0.75);
          disc(ad, px0 - r * 0.3, py0 - r * 0.3, r * 0.4, mixColor(c, 0xffffff, 0.5), 0.6);
          ring(ad, px0, py0, r * 1.7, mixColor(c, 0xffffff, 0.3), 0.5, 0.3);
        }
        // estrella fugaz cada 3 s
        const sh = (t % 3000) / 600;
        if (sh < 1) for (let k = 0; k < 8; k++) ad(x + w * 0.1 + sh * w * 0.6 - k * P * 2, y + h * 0.1 + sh * h * 0.3 - k * P, 0xffffff, (1 - k / 8) * (1 - sh));
        // perlas de Palkia: brillo rosa en las aristas
        ring(ad, cx, cy, 200 + Math.sin(t / 800) * 10, 0xff7ad8, 0.08, 0.6, P, t / 1200, 4);
      });
      break;
    }
    case 'distorsion': {
      // Mundo distorsión: vetas oblicuas verdosas, islas flotantes del revés, jirones morados y tentáculos rojos
      for (let i = 0; i < 26; i++) {
        const sx = x + rnd() * w;
        const sy = y + rnd() * h;
        line(dot, sx, sy, sx + 40 + rnd() * 60, sy - 30 - rnd() * 40, i % 2 ? 0x3a4a3a : 0x4a3a5a, 0.35);
      }
      const isles: [number, number, number][] = [[0.15, 0.3, 46], [0.8, 0.22, 38], [0.3, 0.8, 34], [0.72, 0.75, 50], [0.5, 0.12, 26]];
      ticker(scene, anim, 100, (t) => {
        isles.forEach(([fx, fy, s], i) => {
          const ix = x + fx * w + Math.sin(t / 1700 + i) * 8;
          const iy = y + fy * h + Math.sin(t / 1100 + i * 2) * 6;
          // isla del revés: la hierba abajo, la roca en punta hacia arriba
          for (let r = 0; r < s * 0.8; r += P) {
            const half = s * (1 - r / (s * 0.8));
            for (let xx = -half; xx <= half; xx += P) ad(ix + xx, iy - r, r === 0 ? 0x2a1e2e : 0x4a3e4e, 0.6);
          }
          for (let xx = -s; xx <= s; xx += P) ad(ix + xx, iy + P, 0x3a7a4a, 0.65);
          for (let k = 0; k < 3; k++) ad(ix - s * 0.5 + k * s * 0.5, iy + 2 * P + ((t / 300 + k) % 2) * P, 0x5a9a5a, 0.5);
          ad(ix, iy + 4 * P + Math.sin(t / 400 + i) * 3, 0x1a1a1a, 0.4, P * 3, P);
        });
        for (let i = 0; i < 14; i++) {
          const ph = (t / 6000 + i / 14) % 1;
          const wx = x + ph * (w + 120) - 60;
          const wy = y + ((i * 83) % h) + Math.sin(ph * 12 + i) * 14;
          for (let k = 0; k < 5; k++) ad(wx - k * P * 2, wy + Math.sin(k + t / 300) * 3, k ? 0x6a2aaa : 0xc04aff, 0.45 * (1 - k / 5));
        }
        for (let s = 0; s < 4; s++) {
          const ex = s < 2 ? x : x + w;
          const ey = y + h * (s % 2 ? 0.72 : 0.3);
          for (let k = 0; k < 16; k++) {
            const dx = (s < 2 ? 1 : -1) * k * P * 1.6;
            const wy = Math.sin(k * 0.5 + t / 260 + s) * (4 + k * 0.8);
            ad(ex + dx, ey + wy, k % 4 === 0 ? 0xc02a2a : 0x14081e, 0.7 * (1 - k / 16), P + 2);
          }
        }
      });
      break;
    }
    case 'cielo': {
      // Sobre las nubes: franjas claras, la columna celeste a un lado y nubes y viento que pasan
      for (let b = 0; b < 6; b++) dot(x, y + b * P * 3, 0xffffff, 0.06 * (6 - b), w, P * 3);
      // Columna celeste (ladrillos verdes y piedra) en el borde izquierdo
      const tx = x + 30;
      for (let yy = y; yy < y + h; yy += P * 2) for (let xx = 0; xx < 60; xx += P * 3) {
        const off = ((yy - y) / (P * 2)) % 2 ? P * 1.5 : 0;
        dot(tx + xx + off, yy, (xx / (P * 3)) % 2 ? 0x8aa08a : 0x6a8a7a, 0.45, P * 3 - 1, P * 2 - 1);
      }
      ticker(scene, anim, 80, (t) => {
        for (let i = 0; i < 8; i++) {
          const sp = 0.012 + (i % 3) * 0.006;
          const s = 22 + (i % 4) * 8;
          const ccx = x + ((t * sp + i * 173) % (w + 200)) - 100;
          cloud(ad, ccx, y + 30 + ((i * 97) % (h - 60)), s, 0xffffff, 0.35 + (i % 3) * 0.08);
        }
        for (let i = 0; i < 18; i++) {
          const ph = (t / 900 + i / 18) % 1;
          const sx = x + ph * (w + 80) - 40;
          const sy = y + ((i * 61) % h);
          for (let k = 0; k < 4 + (i % 3); k++) ad(sx - k * P * 2, sy, 0xffffff, 0.35 * (1 - k / 6));
        }
        // destello verde (Rayquaza) que recorre la columna
        const gy = y + ((t / 4) % (h + 80)) - 40;
        for (let k = 0; k < 6; k++) ad(tx + 25 + Math.sin(k + t / 200) * 12, gy - k * P * 2, 0x6aff8a, 0.6 * (1 - k / 6));
      });
      break;
    }
    case 'mar': {
      // Océano: bandas de profundidad, cáusticos, burbujas y un torbellino que gira en el centro (Lugia, Kyogre)
      for (let b = 0; b < 8; b++) dot(x, y + (h / 8) * b, 0x0a2a5a, 0.05 * b, w, h / 8);
      ticker(scene, anim, 80, (t) => {
        for (let row = 0; row < 7; row++) {
          const yy = y + 30 + row * (h / 7);
          for (let xx = x; xx < x + w; xx += P * 2) {
            const wy = Math.sin(xx * 0.03 + t / 400 + row) * 5;
            ad(xx, yy + wy, row % 2 ? 0x8ad8ff : 0x4ab0ff, 0.22);
          }
        }
        // Torbellino: cada brazo lleva una estela oscura detrás (le da hondura) y la cresta clara delante
        for (let arm = 0; arm < 4; arm++) for (let d = 8; d < 220; d += 5) {
          const ang = arm * 1.571 + d * 0.028 - t / 500;
          const fade = 1 - d / 230;
          ad(cx + Math.cos(ang + 0.22) * d, cy + Math.sin(ang + 0.22) * d * 0.6, 0x04142e, 0.45 * fade, d < 80 ? P * 2 : P);
          ad(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, d < 70 ? 0xe8f8ff : 0x8ad8ff, 0.85 * fade, d < 120 ? P * 2 : P);
        }
        disc(ad, cx, cy, 14, 0x04142e, 0.55, 0.6);
        for (let i = 0; i < 20; i++) {
          const ph = (t / 3200 + i / 20) % 1;
          ad(x + ((i * 89) % w) + Math.sin(ph * 10 + i) * 6, y + h - ph * h, 0xe8f8ff, 0.6 * (1 - ph), i % 3 ? P - 2 : P);
        }
        for (let i = 0; i < 10; i++) {
          const a = 0.18 * (0.5 + 0.5 * Math.sin(t / 350 + i * 1.7));
          ad(x + ((i * 157) % w), y + ((i * 113) % h), 0xbfefff, a, P * 4, P);
        }
      });
      break;
    }
    case 'magma': {
      // Tierra partida: red de grietas por las que brilla el magma, placas de roca y brasas
      const paths: [number, number][][] = [];
      for (let c = 0; c < 9; c++) {
        let px0 = x + rnd() * w;
        let py0 = y + rnd() * h;
        let ang = rnd() * 6.283;
        const pts: [number, number][] = [];
        for (let k = 0; k < 30; k++) {
          ang += (rnd() - 0.5) * 0.9;
          px0 += Math.cos(ang) * P * 2;
          py0 += Math.sin(ang) * P * 2;
          pts.push([px0, py0]);
        }
        paths.push(pts);
      }
      for (let i = 0; i < 14; i++) {
        const bx = x + rnd() * w;
        const by = y + rnd() * h;
        dot(bx, by, 0x3a2418, 0.5, P * 6, P * 4);
        dot(bx, by, 0x5a3a28, 0.5, P * 6, P);
      }
      for (const pts of paths) for (const [px0, py0] of pts) dot(px0 - P, py0 - P, OUT, 0.7, P * 3, P * 3);
      ticker(scene, anim, 110, (t) => {
        paths.forEach((pts, c) => pts.forEach(([px0, py0], k) => {
          const glow = 0.5 + 0.5 * Math.sin(t / 300 - k * 0.4 + c);
          ad(px0, py0, mixColor(0xc8300c, 0xff9a3a, glow), 0.55);
        }));
        for (let i = 0; i < 24; i++) {
          const ph = (t / 2600 + i / 24) % 1;
          ad(x + ((i * 53) % w) + Math.sin(ph * 8 + i) * 6, y + h - ph * h, i % 2 ? 0xffb347 : 0xff6a2a, 1 - ph, P - 2);
        }
      });
      break;
    }
    case 'creacion': {
      // Salón del origen: anillos dorados concéntricos, las 16 tablas alrededor y motas de luz que suben
      for (let i = 0; i < 40; i++) dot(x + rnd() * w, y + rnd() * h, 0xfff8e0, 0.4, P * 2, P);
      ticker(scene, anim, 90, (t) => {
        for (let r = 0; r < 12; r++) {
          const ang = (r / 12) * 6.283 + t / 6000;
          line(ad, cx + Math.cos(ang) * 60, cy + Math.sin(ang) * 48, cx + Math.cos(ang) * 260, cy + Math.sin(ang) * 208, 0xffe9a0, 0.07);
        }
        ring(ad, cx, cy, 90, 0xd8b45a, 0.55, 0.8, P, t / 700, 4);
        ring(ad, cx, cy, 130, 0xffe9a0, 0.4, 0.8, P, -t / 900, 6);
        ring(ad, cx, cy, 175, 0xd8b45a, 0.3, 0.8, P, t / 1100, 8);
        PLATES.forEach((c, i) => {
          const ang = (i / 16) * 6.283 - t / 4000;
          const gx = cx + Math.cos(ang) * 215;
          const gy = cy + Math.sin(ang) * 172;
          ad(gx - P, gy - P, OUT, 0.6, P * 3, P * 3);
          ad(gx, gy, c, 0.85 + 0.15 * Math.sin(t / 300 + i));
        });
        for (let i = 0; i < 26; i++) {
          const ph = (t / 4200 + i / 26) % 1;
          ad(x + ((i * 131) % w) + Math.sin(ph * 6 + i) * 10, y + h - ph * h, i % 2 ? 0xffffff : 0xffe070, Math.sin(ph * 3.14) * 0.8, P - 2);
        }
      });
      break;
    }
    case 'arcoiris': {
      // Torre del fuego sagrado: arcoíris enorme por arriba, losas cálidas y plumas que caen
      for (let i = 0; i < 30; i++) dot(x + rnd() * w, y + rnd() * h, 0x5a2a12, 0.35, P * 3, P);
      ticker(scene, anim, 90, (t) => {
        RAINBOW.forEach((c, b) => {
          const r = 420 - b * 14;
          for (let i = 0; i < 120; i++) {
            const ang = Math.PI + (i / 120) * Math.PI;
            const shimmer = 0.36 + 0.14 * Math.sin(t / 250 - i * 0.2 + b);
            ad(cx + Math.cos(ang) * r, y + h + 60 + Math.sin(ang) * r * 0.9, c, shimmer, P * 2, P * 2);
          }
        });
        for (let i = 0; i < 16; i++) {
          const ph = (t / 5000 + i / 16) % 1;
          const fx = x + ((i * 97) % w) + Math.sin(ph * 9 + i) * 18;
          const fy = y + ph * h;
          const c = RAINBOW[i % RAINBOW.length];
          ad(fx, fy, c, 0.8, P * 2, P);
          ad(fx + P * 2, fy + P, mixColor(c, 0xffffff, 0.5), 0.6);
        }
        for (let i = 0; i < 6; i++) {
          const bx = x + w * (0.1 + i * 0.16);
          for (let k = 0; k < 6; k++) ad(bx + Math.sin(t / 120 + k + i) * 3, y + h - P - k * P, k < 2 ? 0xffffff : k < 4 ? 0xffd54f : 0xff6a2a, 0.5 * (1 - k / 6));
        }
      });
      break;
    }
    case 'tormenta': {
      // Meseta bajo la tormenta: sombras de nubes, lluvia en diagonal y relámpagos que iluminan la sala
      for (let i = 0; i < 6; i++) disc(dot, x + rnd() * w, y + rnd() * h, 60 + rnd() * 40, 0x10141a, 0.25, 0.6);
      ticker(scene, anim, 60, (t) => {
        for (let i = 0; i < 70; i++) {
          const ph = (t / 600 + i * 0.137) % 1;
          const rx = x + ((i * 71) % w) - ph * 60;
          const ry = y + ph * h;
          ad(rx, ry, 0xa8c8e8, 0.45, P - 3, P * 2);
          ad(rx - P, ry + P * 2, 0xa8c8e8, 0.3, P - 3, P);
        }
        for (let i = 0; i < 8; i++) {
          const ph = (t / 400 + i / 8) % 1;
          if (ph < 0.3) ad(x + ((i * 191) % w), y + ((i * 137) % h), 0xd8e8ff, 0.5 * (1 - ph / 0.3), P * 2, P - 3);
        }
        const fl = t % 2400;
        if (fl < 180) {
          anim.fillStyle(0xffffff, 0.12 * (1 - fl / 180)).fillRect(x, y, w, h);
          const bx = x + ((Math.floor(t / 2400) * 263) % (w - 100)) + 50;
          bolt(ad, bx, y, bx + 30, y + h * 0.6, 0xffe94a, 0.7 * (1 - fl / 180), Math.floor(t / 2400));
        }
      });
      break;
    }
    case 'psique': {
      // Espacio psíquico: rejilla rosa, figuras geométricas que flotan y giran y ondas desde el centro
      for (let xx = x; xx < x + w; xx += 40) line(dot, xx, y, xx, y + h, 0xff70d0, 0.06);
      for (let yy = y; yy < y + h; yy += 40) line(dot, x, yy, x + w, yy, 0xff70d0, 0.06);
      ticker(scene, anim, 90, (t) => {
        for (let n = 0; n < 3; n++) {
          const r = ((t / 12 + n * 110) % 330) + 10;
          ring(ad, cx, cy, r, 0xff70d0, 0.3 * (1 - r / 340), 0.7, P);
        }
        for (let i = 0; i < 9; i++) {
          const sx = x + ((i * 157 + 60) % (w - 80)) + 40;
          const sy = y + ((i * 97 + 40) % (h - 80)) + 40 + Math.sin(t / 700 + i) * 10;
          const s = 12 + (i % 3) * 6;
          const rot = t / 900 * (i % 2 ? 1 : -1) + i;
          const sides = 3 + (i % 3);
          const c = i % 2 ? 0xc070ff : 0xff9ae0;
          for (let v = 0; v < sides; v++) {
            const a0 = rot + (v / sides) * 6.283;
            const a1 = rot + ((v + 1) / sides) * 6.283;
            line(ad, sx + Math.cos(a0) * s, sy + Math.sin(a0) * s, sx + Math.cos(a1) * s, sy + Math.sin(a1) * s, c, 0.55);
          }
          ad(sx, sy + s + 12, 0x000000, 0.2, P * 3, P);
        }
      });
      break;
    }
    default:
      break;
  }
  return base;
}

/** Variante de lava del fuego sagrado (Ho-Oh, Reshiram): llamas que cambian de rojo a dorado y blanco. */
export function sacredFlame(scene: Phaser.Scene, x: number, y: number, size: number, depth = 0.5): G {
  const g = scene.add.graphics().setDepth(depth);
  const dot = painter(g, x, y, size, size);
  return ticker(scene, g, 110, (t) => {
    g.fillStyle(0x7a1a08, 0.75).fillRect(x, y, size, size);
    g.fillStyle(0xff7a2a, 0.85).fillRect(x + P, y + P, size - 2 * P, size - 2 * P);
    for (let k = 0; k < 4; k++) {
      const fx = x + P + k * P * 1.6;
      const hgt = 3 + Math.round(2 * (0.5 + 0.5 * Math.sin(t / 110 + k * 1.9 + x)));
      for (let j = 0; j < hgt; j++) dot(fx, y + size - P * 2 - j * P, j > hgt - 2 ? 0xffffff : j > 1 ? 0xffd54f : RAINBOW[(k + Math.floor(t / 400)) % 3], 0.95);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Animación del derrumbe (durante FALL_SHAKE_MS)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Derrumbe propio de cada concepto, encima de las grietas: Dialga para y rebobina el tiempo, Palkia rasga el espacio,
 * Giratina voltea el suelo con sus sombras, Rayquaza trae el viento y el rayo verde, Kyogre y Lugia la marea con
 * torbellino, Groudon el magma y las placas, Arceus la luz de la creación, Ho-Oh el arcoíris y el fuego sagrado, Zekrom
 * la tormenta y Mewtwo las ondas psíquicas. Dura `ms` y se anima solo; null si el tema no es de concepto.
 */
export function fallConceptFx(scene: Phaser.Scene, theme: FallTheme, x0: number, y0: number, w: number, h: number, cx: number, cy: number, ms: number): G | null {
  if (!CONCEPT_THEMES.includes(theme)) return null;
  const g = scene.add.graphics().setDepth(0.8);
  const dot = painter(g, x0, y0, w, h);
  return ticker(scene, g, 50, (t) => {
    const k = Math.min(1, t / ms);
    switch (theme) {
      case 'tiempo': {
        // El reloj crece, las agujas corren y a mitad se rebobinan; engranajes y barridos de luz azul acero
        const rewind = k > 0.5;
        const tt = rewind ? ms * 0.5 - (t - ms * 0.5) * 3 : t;
        const R = 50 + Phaser.Math.Easing.Cubic.Out(k) * 120;
        clock(dot, cx, cy, R, 0x7fd4ff, 0.85, tt / 260, tt / 40);
        for (let n = 0; n < 4; n++) {
          const rr = rewind ? R * (1.6 - ((t / 300 + n / 4) % 1) * 0.6) : R * (1 + ((t / 300 + n / 4) % 1) * 0.6);
          ring(dot, cx, cy, rr, 0x7fd4ff, 0.35, 0.8, P, 0, 2);
        }
        for (let n = 0; n < 4; n++) {
          const gx = cx + Math.cos(n * 1.57 + 0.78) * (R + 50);
          const gy = cy + Math.sin(n * 1.57 + 0.78) * (R + 50) * 0.8;
          gear(dot, gx, gy, 16 + (n % 2) * 8, 0x9ab4c8, 0.8, (n % 2 ? -1 : 1) * tt / 200);
        }
        if (Math.floor(t / 110) % 3 === 0) {
          const sy = y0 + ((t * 0.7) % h);
          dot(x0, sy, 0xbfe6ff, 0.35, w, P);
          dot(x0, sy + P * 3, 0x7fd4ff, 0.2, w, P);
        }
        if (rewind) for (let i = 0; i < 10; i++) {
          const ang = -t / 120 + i * 0.628;
          dot(cx + Math.cos(ang) * (R + 20), cy + Math.sin(ang) * (R + 20) * 0.8, 0xffffff, 0.8, P + 1);
        }
        break;
      }
      case 'espacio': {
        // Grieta espacial vertical que se abre, estrellas estiradas hacia ella y anillos rosas
        const hh = Phaser.Math.Easing.Cubic.Out(k) * h * 0.45;
        for (let yy = -hh; yy <= hh; yy += P) {
          const half = (1 - Math.abs(yy) / Math.max(hh, 1)) * (10 + k * 40) + Math.sin(yy * 0.2 + t / 80) * 4;
          for (let xx = -half; xx <= half; xx += P) {
            const edge = Math.abs(xx) > half - P * 2;
            dot(cx + xx, cy + yy, edge ? (Math.abs(xx) > half - P ? 0xffffff : 0xff7ad8) : 0x0a0418, 1);
          }
        }
        for (let i = 0; i < 12; i++) dot(cx + Math.sin(i * 3 + t / 300) * 15 * k, cy + ((i * 37 + t / 10) % (2 * hh + 1)) - hh, 0xffffff, 0.9, P - 2);
        for (let i = 0; i < 46; i++) {
          const sx = x0 + ((i * 97) % w);
          const sy = y0 + ((i * 61) % h);
          const ang = Math.atan2(cy - sy, cx - sx);
          const len = k * 40 * (0.5 + (i % 3) * 0.3);
          line(dot, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, i % 4 ? 0xffd8ff : 0xffffff, 0.5 + 0.4 * k, P - 2);
        }
        for (let n = 0; n < 3; n++) {
          const r = 30 + ((t / 7 + n * 80) % 240);
          ring(dot, cx, cy, r, 0xff7ad8, 0.6 * (1 - r / 270), 0.8, P, t / 200, 3);
        }
        break;
      }
      case 'distorsion': {
        // Sombras que entran por los bordes y lo absorben todo; las losas se dan la vuelta una a una
        const T = 40;
        for (let ty = y0; ty < y0 + h; ty += T) for (let tx = x0; tx < x0 + w; tx += T) {
          const d = Math.hypot(tx + T / 2 - cx, ty + T / 2 - cy) / 420;
          const start = d * 0.6;
          if (k < start) continue;
          const flip = Math.abs(Math.cos(((k - start) / 0.4) * Math.PI));
          const hh = Math.max(P, q(T * flip));
          const top = ty + (T - hh) / 2;
          dot(tx, top, (k - start) > 0.2 ? 0x1a0a2a : 0x3a2a3a, 0.65, T - P, hh);
          dot(tx, top, 0xc04aff, 0.35, T - P, P);
        }
        for (let s = 0; s < 8; s++) {
          const ang0 = (s / 8) * 6.283;
          const sx = cx + Math.cos(ang0) * 420;
          const sy = cy + Math.sin(ang0) * 300;
          for (let j = 0; j < 30; j++) {
            const f = (j / 30) * k;
            const wob = Math.sin(j * 0.6 + t / 120 + s) * 14;
            const px0 = sx + (cx - sx) * f - Math.sin(ang0) * wob;
            const py0 = sy + (cy - sy) * f + Math.cos(ang0) * wob;
            dot(px0, py0, j % 5 === 0 ? 0xc02a2a : 0x0c0414, 0.85, P + 3);
          }
        }
        disc(dot, cx, cy, 20 + k * 40, 0x05020a, 0.7, 0.8);
        ring(dot, cx, cy, 20 + k * 40, 0xc04aff, 0.8, 0.8, P, t / 100, 2);
        break;
      }
      case 'cielo': {
        // Viento que barre la sala, nubes que suben deprisa y el rayo verde de Rayquaza
        for (let i = 0; i < 30; i++) {
          const ph = (t / 350 + i / 30) % 1;
          const sx = x0 + ph * (w + 100) - 50;
          const sy = y0 + ((i * 47) % h) + Math.sin(ph * 6 + i) * 8;
          for (let j = 0; j < 6; j++) dot(sx - j * P * 2, sy, 0xffffff, 0.6 * (1 - j / 6));
        }
        for (let i = 0; i < 6; i++) {
          const ph = (t / 700 + i / 6) % 1;
          cloud(dot, x0 + ((i * 151) % w), y0 + h + 40 - ph * (h + 80), 26 + (i % 3) * 8, 0xffffff, 0.55 * k + 0.2);
        }
        // Anillo de Rayquaza: doble, grueso y con borde oscuro para que se lea sobre el cielo claro
        ring(dot, cx, cy, 60 + k * 30, 0x0e4a2a, 0.55, 0.6, P * 2, t / 60, 2);
        ring(dot, cx, cy, 60 + k * 30, 0x6aff8a, 0.95, 0.6, P, t / 60, 2);
        ring(dot, cx, cy, 84 + k * 40, 0xb8ffc8, 0.7, 0.6, P, -t / 90, 3);
        if (Math.floor(t / 130) % 3 !== 2) bolt(dot, cx + Math.sin(t / 300) * 40, y0, cx, cy, 0x3aff6a, 0.9, Math.floor(t / 130));
        break;
      }
      case 'mar': {
        // La marea sube con olas y en el centro se abre un torbellino
        const lvl = y0 + h - k * h * 0.6;
        for (let xx = x0; xx < x0 + w; xx += P) {
          const wy = lvl + Math.sin(xx * 0.045 + t / 200) * 7 + Math.sin(xx * 0.11 - t / 140) * 3;
          dot(xx, wy, 0xe8f8ff, 0.95);
          dot(xx, wy + P, 0x8ad8ff, 0.8);
          for (let yy = wy + P * 2; yy < y0 + h; yy += P * 2) dot(xx, yy, mixColor(0x1a5aa8, 0x0a2a5a, (yy - wy) / h), 0.55);
        }
        for (let arm = 0; arm < 4; arm++) for (let d = 6; d < 40 + k * 160; d += 5) {
          const ang = arm * 1.571 + d * 0.04 - t / 160;
          dot(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.6, d < 40 ? 0xffffff : 0x8ad8ff, 0.8 * (1 - d / 220));
        }
        for (let i = 0; i < 18; i++) {
          const ph = (t / 800 + i / 18) % 1;
          dot(x0 + ((i * 89) % w), lvl - ph * 60, 0xffffff, 1 - ph, P - 1);
        }
        break;
      }
      case 'magma': {
        // Placas que se levantan con bordes al rojo y géiseres de magma que brotan uno tras otro
        const r = seeded(0x6d61);
        for (let i = 0; i < 12; i++) {
          const px0 = x0 + q(r() * (w - 80));
          const py0 = y0 + q(r() * (h - 50));
          const st = r() * 0.5;
          if (k < st) continue;
          const lift = Math.min(1, (k - st) / 0.3) * 14;
          dot(px0 + P, py0 + 30, 0x000000, 0.4, 60, P * 2);
          dot(px0, py0 - lift, 0x4a2a1a, 0.95, 60, 30);
          dot(px0, py0 - lift, 0x6a4a32, 0.95, 60, P);
          dot(px0, py0 + 30 - lift, 0xff5a1f, 0.9, 60, P);
          dot(px0 - P, py0 - lift, 0xff9a2a, 0.7, P, 30);
        }
        for (let i = 0; i < 8; i++) {
          const gx = x0 + ((i * 113 + 50) % (w - 40));
          const gy = y0 + ((i * 71 + 80) % (h - 40));
          const st = (i / 8) * 0.6;
          const f = Math.max(0, Math.min(1, (k - st) / 0.25));
          if (f <= 0) continue;
          const hgt = f * 90 * (0.8 + 0.2 * Math.sin(t / 60 + i));
          for (let yy = 0; yy < hgt; yy += P) dot(gx + Math.sin(yy * 0.2 + t / 50) * 3, gy - yy, yy > hgt - P * 3 ? 0xffe9a0 : yy > hgt * 0.4 ? 0xff9a2a : 0xff4a10, 0.95, P + 3);
          for (let j = 0; j < 4; j++) dot(gx + (j - 1.5) * 10, gy - hgt - ((t / 4 + j * 20) % 30), 0xffb347, 0.8);
          disc(dot, gx, gy, 14, 0xff5a1f, 0.8, 0.5);
        }
        break;
      }
      case 'creacion': {
        // Rayos de luz que giran desde el jefe, anillos dorados y las 16 tablas orbitando
        for (let rr = 0; rr < 16; rr++) {
          const ang = (rr / 16) * 6.283 + t / 900;
          line(dot, cx, cy, cx + Math.cos(ang) * 500 * k, cy + Math.sin(ang) * 400 * k, rr % 2 ? 0xfff0a0 : 0xffffff, 0.35, rr % 2 ? P : P + 2);
        }
        for (let n = 0; n < 3; n++) {
          const r = 20 + ((t / 6 + n * 90) % 270);
          ring(dot, cx, cy, r, 0xd8b45a, 0.8 * (1 - r / 290), 0.8, P + 1);
        }
        PLATES.forEach((c, i) => {
          const ang = (i / 16) * 6.283 + t / 400;
          const r = 40 + k * 140;
          dot(cx + Math.cos(ang) * r - P, cy + Math.sin(ang) * r * 0.8 - P, OUT, 0.8, P * 3, P * 3);
          dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.8, c, 1);
        });
        disc(dot, cx, cy, 16 + 6 * Math.sin(t / 80), 0xffffff, 0.9, 0.8);
        break;
      }
      case 'arcoiris': {
        // El arcoíris se abre desde el jefe, el fuego sagrado sube en columnas y caen plumas
        RAINBOW.forEach((c, b) => {
          const r = (60 + k * 300) - b * 10;
          if (r < 10) return;
          for (let i = 0; i < 80; i++) {
            const ang = Math.PI + (i / 80) * Math.PI;
            dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.75, c, 0.8, P + 1);
          }
        });
        for (let i = 0; i < 10; i++) {
          const bx = x0 + ((i * 131 + 40) % w);
          const grow = Math.min(1, Math.max(0, k * 1.6 - (i % 5) * 0.1));
          for (let yy = 0; yy < grow * 130; yy += P) {
            const c = yy > 90 ? RAINBOW[(i + Math.floor(t / 120)) % 7] : yy > 40 ? 0xffd54f : 0xffffff;
            dot(bx + Math.sin(yy * 0.1 + t / 70 + i) * 4, y0 + h - yy, c, (1 - yy / 150) * 0.9, P + 2);
          }
        }
        for (let i = 0; i < 14; i++) {
          const ph = (t / 1200 + i / 14) % 1;
          dot(x0 + ((i * 67) % w) + Math.sin(ph * 8 + i) * 16, y0 + ph * h, RAINBOW[i % 7], 0.9, P * 2, P);
        }
        break;
      }
      case 'tormenta': {
        // Nubes negras que cubren la sala, lluvia que arrecia y rayos que caen cerca del jefe
        dot(x0, y0, 0x0a0c12, 0.45 * k, w, h);
        for (let i = 0; i < 6; i++) cloud(dot, x0 + ((i * 151 + t / 20) % (w + 100)) - 50, y0 + 20 + (i % 2) * 20, 40, 0x2a3040, 0.85);
        for (let i = 0; i < 60; i++) {
          const ph = (t / 400 + i * 0.137) % 1;
          dot(x0 + ((i * 71) % w) - ph * 50, y0 + ph * h, 0xa8c8e8, 0.3 + 0.4 * k, P - 3, P * 2);
        }
        if (Math.floor(t / 90) % 2 === 0) for (let n = 0; n < 2; n++) {
          const seed = Math.floor(t / 180) * 7 + n;
          const bx = cx + ((seed * 97) % 300) - 150;
          bolt(dot, bx, y0, bx + 20, cy + 40, 0xffe94a, 0.95, seed);
          ring(dot, bx + 20, cy + 40, 20, 0xffe94a, 0.7, 0.5);
        }
        break;
      }
      case 'psique': {
        // Ondas rosas desde el jefe, losas que se levantan solas y figuras que giran
        for (let n = 0; n < 4; n++) {
          const r = 10 + ((t / 4 + n * 70) % 280);
          ring(dot, cx, cy, r, n % 2 ? 0xff70d0 : 0xc070ff, 0.8 * (1 - r / 290), 0.75, P + 1);
        }
        const r = seeded(0x51c0);
        for (let i = 0; i < 16; i++) {
          const tx = x0 + q(r() * (w - 40));
          const ty = y0 + q(r() * (h - 40));
          const st = r() * 0.5;
          if (k < st) continue;
          const lift = Math.min(1, (k - st) / 0.4) * 30 + Math.sin(t / 200 + i) * 4;
          dot(tx, ty, 0x000000, 0.35, 35, 35);
          dot(tx, ty - lift, 0x5a3a6a, 0.9, 35, 35);
          dot(tx, ty - lift, 0xff70d0, 0.8, 35, P);
          dot(tx, ty - lift + 30, 0x2a1a3a, 0.9, 35, P);
        }
        for (let e = 0; e < 2; e++) {
          const ex = cx + (e ? 22 : -22);
          dot(ex - P, cy - 60, 0xff70d0, (Math.floor(t / 100) % 2) * 0.9, P * 3, P * 2);
        }
        break;
      }
      default:
        break;
    }
  });
}
