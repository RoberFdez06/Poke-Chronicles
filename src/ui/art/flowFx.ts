// Arte de tres ataques especiales (tercera pasada de calidad): chorro ('stream'), minas ('mine') y ola ('wall').
// Mismo lenguaje que el rayo y el remolino: píxel gordo en rejilla, capas contorno/oscuro/color/claro/blanco, núcleo
// brillante, estela o espuma, aviso legible del peligro, estallido con partículas y animación continua.
// Solo dibujo: hitboxes, daño y tiempos los pone attacks.ts. Con lowFx() todo queda en una versión simple y quieta.
import Phaser from 'phaser';
import { PX, animate, darkOf, drawPixJet, lightOf, mixColor, pixBlast, pixDebris, pixFlash, pixRing } from './pixelFx';
import { lowFx } from '../theme';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
/** Pseudoazar estable (0-1) para que el tramado no tiemble al azar entre fotogramas. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, size = PX, outline = false) {
  const sx = snap(x);
  const sy = snap(y);
  if (outline) g.fillStyle(OUT, a).fillRect(sx - size / 2 - 2, sy - size / 2 - 2, size + 4, size + 4);
  g.fillStyle(c, a).fillRect(sx - size / 2, sy - size / 2, size, size);
}

/* ───────────────────────────── Chorro ───────────────────────────── */

/**
 * Chorro completo (se redibuja cada 40 ms en un Graphics que ya existe): halo ancho, cuerpo pixel (drawPixJet), pulsos
 * blancos que viajan de la boca a la punta, gotas/brasas que salen despedidas, corona de salpicadura en la punta y
 * anillos en la boca. `grow` < 1 al arrancar: se pinta además el cono de aviso a lo largo total (telegrafía).
 */
export function drawJetFx(g: Phaser.GameObjects.Graphics, x: number, y: number, ang: number, len: number, fullLen: number, w0: number, w1: number, color: number, t: number, a = 1, grow = 1) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const nx = -uy;
  const ny = ux;
  const fr = Math.floor(t / 40);
  // Aviso: bordes del cono a trazos que avanzan, a todo el largo, mientras el chorro aún crece
  if (grow < 1) {
    const wa = (1 - grow) * 0.85 + 0.15;
    for (let d = PX * 2; d < fullLen; d += PX) {
      if ((Math.round(d / PX) + fr) % 4 === 0) continue;
      const w = (w0 + (w1 - w0) * Math.sqrt(d / fullLen)) / 2 + PX;
      for (const sg of [-1, 1]) dot(g, x + ux * d + nx * w * sg, y + uy * d + ny * w * sg, (Math.round(d / PX) + fr) % 4 === 1 ? 0xffffff : color, wa * 0.7);
    }
  }
  // Halo ancho y translúcido bajo el cuerpo
  for (let d = PX * 2; d < len * 0.95; d += PX) {
    const f = d / len;
    const w = (w0 + (w1 - w0) * Math.sqrt(f)) * 0.5 + PX * 2;
    for (let o = -w; o <= w; o += PX) dot(g, x + ux * d + nx * o, y + uy * d + ny * o, color, a * 0.16 * (1 - f * 0.6));
  }
  drawPixJet(g, x, y, ang, len, w0, w1, color, t, a);
  // Pulsos de presión: franjas blancas/claras que corren hacia la punta
  for (let i = 0; i < 3; i++) {
    const d = ((t * 0.55 + (i * len) / 3) % (len * 0.8)) + PX * 3;
    const f = d / len;
    const w = (w0 + (w1 - w0) * Math.sqrt(f)) * 0.42;
    for (let o = -w; o <= w; o += PX) {
      const c = Math.abs(o) < w * 0.5 ? 0xffffff : light;
      dot(g, x + ux * d + nx * o, y + uy * d + ny * o, c, a * (1 - f * 0.7));
      dot(g, x + ux * (d - PX) + nx * o, y + uy * (d - PX) + ny * o, light, a * 0.55 * (1 - f));
    }
  }
  // Gotas / brasas despedidas a los lados y más allá de la punta (cada una vive unos fotogramas)
  for (let i = 0; i < 14; i++) {
    const life = 6;
    const age = (fr + i * 3) % life;
    const seed = Math.floor((fr + i * 3) / life) * 31 + i;
    const d0 = len * (0.35 + hash(seed) * 0.6);
    const side = hash(seed + 7) < 0.5 ? -1 : 1;
    const wHere = (w0 + (w1 - w0) * Math.sqrt(Math.min(1, d0 / Math.max(1, len)))) / 2;
    const o = side * (wHere + age * PX * (0.6 + hash(seed + 3)));
    const d = d0 + age * PX * 1.6;
    const c = age < 2 ? 0xffffff : i % 3 === 0 ? color : light;
    dot(g, x + ux * d + nx * o, y + uy * d + ny * o, c, a * (1 - age / life), age < 2 && i % 4 === 0 ? PX * 1.5 : PX, i % 2 === 0);
  }
  // Corona de salpicadura en la punta
  if (len > PX * 6) {
    const tx = x + ux * len;
    const ty = y + uy * len;
    for (let i = -3; i <= 3; i++) {
      const sa = ang + i * 0.38 + Math.sin(fr * 1.7 + i) * 0.12;
      const rl = PX * (2 + ((fr + i * 5) % 3));
      dot(g, tx + Math.cos(sa) * rl, ty + Math.sin(sa) * rl, i === 0 ? 0xffffff : i % 2 ? light : color, a * 0.85, PX, true);
      if (Math.abs(i) <= 1) dot(g, tx + Math.cos(sa) * (rl + PX * 1.5), ty + Math.sin(sa) * (rl + PX * 1.5), light, a * 0.6);
    }
  }
  // Anillo de la boca que se abre y vuelve (latido de presión)
  const mr = PX * (2.2 + (fr % 3) * 0.6);
  for (let k = 0; k < 12; k++) {
    const ra = (k / 12) * Math.PI * 2;
    const ox = Math.cos(ra) * mr * 0.45;
    const oy = Math.sin(ra) * mr;
    dot(g, x + ux * (PX * 2 + ox) + nx * oy, y + uy * (PX * 2 + ox) + ny * oy, k % 3 === 0 ? 0xffffff : dark, a * 0.8);
  }
}

/* ───────────────────────────── Minas ───────────────────────────── */

/**
 * Mina en el suelo: cae (gota que aterriza con anillo), se arma y late. Muestra el radio de estallido con un círculo a
 * trazos que gira (aviso) y el de disparo más tenue; núcleo en capas con cuatro púas que giran, luz que parpadea más
 * deprisa cuando se le acaba la vida, chispas que suben. Devuelve el gráfico (destruir al estallar o caducar).
 */
export function trapFx(sc: Phaser.Scene, x: number, y: number, radius: number, color: number, life = 6000, depth = 1.6) {
  const light = lightOf(color);
  const dark = darkOf(color);
  const g = sc.add.graphics().setDepth(depth);
  if (lowFx()) {
    g.fillStyle(0x000000, 0.22).fillEllipse(x, y + 3, radius * 1.4, radius * 0.7);
    g.lineStyle(2, color, 0.5).strokeEllipse(x, y, radius * 2, radius * 1.2);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      dot(g, x + Math.cos(a) * radius * 0.4, y + Math.sin(a) * radius * 0.28, i % 2 ? color : light, 1, PX, true);
    }
    dot(g, x, y, 0xffffff, 1, PX * 2, true);
    return g;
  }
  const t0 = sc.time.now;
  let t = 0;
  const sparks: { x: number; y: number; age: number; c: number }[] = [];
  const draw = () => {
    if (!g.active) return ev.remove();
    t += 1;
    const el = sc.time.now - t0;
    g.clear();
    // Caída: gota que baja con estela y aterriza
    const land = Math.min(1, t / 4);
    if (land < 1) {
      const hy = y - 60 * (1 - land * land);
      for (let i = 0; i < 4; i++) dot(g, x, hy - i * PX, i === 0 ? 0xffffff : i === 1 ? light : color, 1 - i * 0.22, PX * (i === 0 ? 2 : 1), i === 0);
      g.fillStyle(0x000000, 0.2 * land).fillEllipse(x, y + 3, radius * land, radius * 0.5 * land);
      return;
    }
    const left = Math.max(0, 1 - el / Math.max(1, life));
    const fast = left < 0.25;
    const beat = Math.sin(t * (fast ? 1.6 : 0.8));
    // Sombra y charco de luz
    g.fillStyle(0x000000, 0.24).fillEllipse(x, y + 4, radius * 1.3, radius * 0.6);
    g.fillStyle(color, 0.1 + 0.08 * Math.max(0, beat)).fillEllipse(x, y, radius * 2, radius * 1.2);
    // Aviso: radio de estallido a trazos que gira (el peligro, legible)
    const R = radius;
    const n = Math.max(20, Math.round((R * 2 * Math.PI) / (PX * 1.6)));
    for (let i = 0; i < n; i++) {
      if (((i + t) >> 1) % 3 === 2) continue;
      const a = (i / n) * Math.PI * 2;
      dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.6, (i + t) % 6 === 0 ? 0xffffff : color, 0.45 + 0.25 * Math.max(0, beat));
    }
    // Radio de disparo (tenue, por dentro)
    const Ri = radius * 0.7;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 - t * 0.05;
      if (i % 3 === 0) continue;
      dot(g, x + Math.cos(a) * Ri, y + Math.sin(a) * Ri * 0.6, dark, 0.45);
    }
    // Cuatro púas que giran
    const rr = Math.max(PX * 2.5, radius * 0.36) * (1 + 0.1 * beat);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + t * 0.12;
      for (let s = 0; s < 3; s++) {
        const d = rr + s * PX;
        dot(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.65, s === 2 ? 0xffffff : s === 1 ? light : dark, 1, PX, s === 0);
      }
    }
    // Núcleo en capas (contorno, oscuro, color, claro, blanco)
    const layers: [number, number, number][] = [[1, OUT, 0], [1, dark, PX * 0.5], [0.8, color, PX * 0.5], [0.55, light, PX], [0.28, 0xffffff, PX]];
    for (const [f, c, lift] of layers) {
      const r = rr * f;
      for (let yy = -r * 0.8; yy <= r * 0.8; yy += PX) {
        const half = Math.sqrt(Math.max(0, r * r - (yy / 0.8) * (yy / 0.8))) - (c === OUT ? 0 : 2);
        g.fillStyle(c, 1).fillRect(snap(x - half), snap(y + yy - lift), snap(half * 2) || PX, PX);
      }
    }
    // Luz que parpadea (más deprisa al final de su vida)
    const on = fast ? t % 2 === 0 : t % 4 < 2;
    dot(g, x, y - PX, on ? 0xffffff : light, 1, PX * 2);
    if (on) for (const [ox, oy] of [[PX * 2, 0], [-PX * 2, 0], [0, -PX * 2.5], [0, PX * 0.5]]) dot(g, x + ox, y - PX + oy, light, 0.7);
    // Chispas que suben
    if (t % 3 === 0) sparks.push({ x: x + (Math.random() - 0.5) * radius * 0.8, y: y + (Math.random() - 0.5) * radius * 0.3, age: 0, c: Math.random() < 0.5 ? light : color });
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.age += 1;
      if (sp.age > 9) {
        sparks.splice(i, 1);
        continue;
      }
      dot(g, sp.x + Math.sin(sp.age) * 2, sp.y - sp.age * 5, sp.age < 3 ? 0xffffff : sp.c, 1 - sp.age / 10);
    }
  };
  const ev = sc.time.addEvent({ delay: 90, loop: true, callback: draw });
  draw();
  return g;
}

/** Estallido de mina: fogonazo, columna de luz, bola en capas, doble anillo, trozos y quemadura que se apaga. */
export function mineBlastFx(sc: Phaser.Scene, x: number, y: number, radius: number, color: number) {
  pixBlast(sc, x, y, radius, color);
  if (lowFx()) return;
  const light = lightOf(color);
  pixFlash(sc, x, y, radius * 0.9, color, 180, 8.5);
  pixRing(sc, x, y + 4, radius * 1.5, color, 460, 7, 0.55);
  pixDebris(sc, x, y, color, 10, 1.1, 9);
  // Columna de luz
  animate(sc, 8.6, 260, (g, k) => {
    const h = 90 * Phaser.Math.Easing.Cubic.Out(Math.min(1, k * 2));
    const w = PX * 3 * (1 - k);
    for (let yy = 0; yy < h; yy += PX) {
      const f = yy / Math.max(1, h);
      for (let o = -w; o <= w; o += PX) dot(g, x + o, y - yy, Math.abs(o) < w * 0.4 ? 0xffffff : light, (1 - k) * (1 - f * 0.7));
    }
  }, 40);
  // Quemadura en el suelo con grietas
  const cracks = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.random() * 0.5);
  animate(sc, 1.4, 900, (g, k) => {
    const al = k < 0.5 ? 0.5 : 0.5 * (1 - (k - 0.5) / 0.5);
    g.fillStyle(0x000000, al * 0.7).fillEllipse(x, y + 2, radius * 1.1, radius * 0.55);
    g.fillStyle(mixColor(color, 0x000000, 0.6), al).fillEllipse(x, y + 2, radius * 0.7, radius * 0.35);
    for (const a of cracks) for (let d = radius * 0.3; d < radius * 0.75; d += PX) dot(g, x + Math.cos(a) * d, y + 2 + Math.sin(a) * d * 0.5, k < 0.3 ? light : 0x1a120c, al * 1.4);
  }, 60);
  sc.cameras.main.shake(60, 0.0025);
}

/* ───────────────────────────── Ola ───────────────────────────── */

export interface WavePoint { x: number; y: number; active: boolean }

/**
 * Ola que une la fila de proyectiles (se redibuja cada 40 ms): estela de agua detrás, cuerpo en capas con burbujas,
 * cresta que se riza (labio de espuma que cae por delante), espuma que salta y rebordes en los extremos.
 * `dir` = hacia dónde avanza; `perp` = a lo largo de la fila.
 */
export function drawWaveFx(g: Phaser.GameObjects.Graphics, row: WavePoint[], dir: { x: number; y: number }, perp: { x: number; y: number }, tt: number, color: number, al: number) {
  const wl = lightOf(color);
  const wd = darkOf(color);
  const cols = [OUT, wd, wd, wd, color, color, color, wl, wl, 0xffffff, 0xffffff];
  const fr = Math.floor(tt / 40);
  const strip = (x: number, y: number, k: number, edge: number) => {
    const rip = Math.sin(k * 0.5 + tt * 0.015) * PX * 0.8;
    const hgt = cols.length - Math.round(edge * 4);
    const at = (back: number, side = 0) => [x + dir.x * (rip - back) + perp.x * side, y + dir.y * (rip - back) + perp.y * side] as const;
    // Estela: rayas de agua detrás que se deshacen
    for (let w = 1; w <= 5; w++) {
      if ((k + w * 2 + fr) % 5 < 2) continue;
      const [bx, by] = at((cols.length + w * 1.3) * PX);
      dot(g, bx, by, w < 3 ? color : wd, al * (0.5 - w * 0.08));
    }
    for (let r = cols.length - hgt; r < cols.length; r++) {
      const [bx, by] = at((cols.length - 1 - r) * PX);
      let c = cols[r];
      // Burbujas en el cuerpo que parpadean
      if (r >= 3 && r <= 6 && hash(k * 13 + r + Math.floor(fr / 3)) < 0.1) c = wl;
      dot(g, bx, by, c, r === 0 ? al * 0.5 : al);
    }
    // Labio que se riza: espuma que cae por delante de la cresta (en ondas a lo largo de la fila)
    const curl = Math.sin(k * 0.45 - tt * 0.012);
    if (curl > 0.1 && edge === 0) {
      const [cx, cy] = at(-PX);
      dot(g, cx, cy, 0xffffff, al);
      if (curl > 0.6) {
        const [dx, dy] = at(-PX * 2);
        dot(g, dx, dy, wl, al * 0.8);
      }
    }
    // Espuma que salta hacia delante y vuelve a caer
    if ((k * 7 + Math.floor(tt / 80)) % 9 === 0) {
      const ph = (tt / 40 + k) % 6;
      const [sx, sy] = at(-PX * (2 + ph * 0.7), PX * Math.sin(k));
      dot(g, sx, sy, 0xffffff, al * (1 - ph / 7), PX, true);
    }
  };
  let k = 0;
  for (let i = 0; i < row.length; i++) {
    const a = row[i];
    if (!a.active) continue;
    const b = row[i + 1];
    const first = i === 0 || !row[i - 1].active;
    const span = b?.active ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    const n = Math.max(1, Math.round(span / PX));
    for (let j = first ? -3 : 0; j < (b?.active ? n : 4); j++) {
      const f = span ? j / n : 0;
      const out = j < 0 || !span;
      const x = out ? a.x + perp.x * j * PX : Phaser.Math.Linear(a.x, b.x, f);
      const y = out ? a.y + perp.y * j * PX : Phaser.Math.Linear(a.y, b.y, f);
      const edge = j < 0 ? -j / 3 : !span && j > 0 ? j / 3 : 0;
      strip(x, y, k++, Math.min(1, edge));
    }
  }
}

/** Arranque de la ola: anillo y salpicón a lo largo de la fila. */
export function waveLaunchFx(sc: Phaser.Scene, x: number, y: number, perp: { x: number; y: number }, span: number, color: number) {
  if (lowFx()) return;
  pixRing(sc, x, y + 8, Math.max(40, span * 0.6), color, 320, 3.8, 0.45);
  for (const s of [-0.5, 0, 0.5]) pixDebris(sc, x + perp.x * span * s, y + perp.y * span * s, color, 4, 0.6, 4);
}

/** Final de la ola: rompe en espuma donde estaba. */
export function waveBreakFx(sc: Phaser.Scene, pts: { x: number; y: number }[], color: number) {
  if (lowFx()) return;
  for (let i = 0; i < pts.length; i += 2) pixDebris(sc, pts[i].x, pts[i].y, mixColor(color, 0xffffff, 0.3), 4, 0.5, 4);
}
