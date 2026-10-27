// Arte pixel de los asaltos nuevos de los jefes (bossBlitz.ts): avisos y golpes con píxel gordo en rejilla, el color
// del tipo, su versión clara y oscura y contorno, como el resto de bossPatternFx/pixelFx. Solo dibujo: el daño lo pone
// GameScene.bossBlitz. Con pocos efectos (lowFx) GameScene usa formas simples en lugar de esto.
import Phaser from 'phaser';
import { animate, darkOf, drawPixBeam, drawPixOrb, lightOf, pixDebris, pixRing, PX } from './pixelFx';
import type { GridBeam, Pt, WallPlan } from '../../data/bossBlitz';
import type { Bounds } from '../../level/bounds';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
const WARN = 0xff3d00;
const TAU = Math.PI * 2;
const snap = (v: number) => Math.round(v / PX) * PX;
const dot = (g: G, x: number, y: number, c: number, a = 1, size = PX) => g.fillStyle(c, a).fillRect(snap(x) - size / 2, snap(y) - size / 2, size, size);
/** Disco pixel relleno. */
function disc(g: G, x: number, y: number, r: number, c: number, a = 1) {
  for (let yy = -r; yy <= r; yy += PX) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    g.fillStyle(c, a).fillRect(snap(x - half), snap(y + yy), snap(half * 2) || PX, PX);
  }
}
/** Línea discontinua de píxeles (aviso). */
function dashLine(g: G, x1: number, y1: number, x2: number, y2: number, c: number, a: number, phase: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / (len || 1);
  const uy = (y2 - y1) / (len || 1);
  for (let d = 0; d < len; d += PX) if (Math.floor((d + phase) / (PX * 3)) % 2 === 0) dot(g, x1 + ux * d, y1 + uy * d, c, a);
}
/** Chevron «>» de píxeles apuntando en `ang`. */
function chevron(g: G, x: number, y: number, ang: number, c: number, a = 1) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  for (let k = 0; k < 4; k++) {
    dot(g, x - ux * k * PX + -uy * k * PX, y - uy * k * PX + ux * k * PX, c, a);
    dot(g, x - ux * k * PX - -uy * k * PX, y - uy * k * PX - ux * k * PX, c, a);
  }
}

// --- Lluvia de meteoros ---

/** Diana en el suelo que se cierra y la sombra del meteoro que crece; al final se ve caer la roca. */
export function meteorWarn(sc: Phaser.Scene, x: number, y: number, R: number, color: number, ms: number, depth = 3) {
  animate(sc, depth, ms, (g, k, t) => {
    g.fillStyle(0x000000, 0.12 + 0.3 * k).fillEllipse(x, y, R * 2 * (0.3 + 0.7 * k), R * 1.2 * (0.3 + 0.7 * k));
    const blink = k > 0.7 && Math.floor(t / 70) % 2 === 0;
    for (let a = 0; a < TAU; a += PX / R) if (Math.floor((a + t * 0.004) / 0.3) % 2 === 0) dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.6, blink ? 0xffffff : WARN, 0.95);
    // Cruz de la diana que se cierra
    const r2 = R * (1 - 0.6 * k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let s = 0; s < 3; s++) dot(g, x + dx * (r2 - s * PX), y + dy * (r2 - s * PX) * 0.6, WARN, 0.9);
    if (k > 0.55) {
      // La roca cae (en diagonal, con estela)
      const f = (k - 0.55) / 0.45;
      const rx = x + 140 * (1 - f);
      const ry = y - 420 * (1 - f);
      for (let s = 1; s <= 4; s++) disc(g, rx + 22 * s, ry - 66 * s, Math.max(PX, 14 - s * 3), lightOf(color), 0.5 - s * 0.1);
      disc(g, rx, ry, 18, OUT);
      disc(g, rx, ry, 14, darkOf(color));
      disc(g, rx - 3, ry - 3, 8, color);
      dot(g, rx - 6, ry - 6, 0xffffff);
    }
  }, 50);
}
export function meteorImpact(sc: Phaser.Scene, x: number, y: number, R: number, color: number, depth = 12) {
  animate(sc, depth, 320, (g, k) => {
    const r = R * (0.5 + 0.6 * Phaser.Math.Easing.Cubic.Out(k));
    for (const [f, c] of [[1, darkOf(color)], [0.75, color], [0.5, lightOf(color)], [0.25, 0xffffff]] as [number, number][]) disc(g, x, y, r * f, c, 0.9 * (1 - k));
  }, 40);
  pixRing(sc, x, y, R * 1.15, color, 380, depth - 0.5, 0.6);
  pixDebris(sc, x, y, color, 8, 0.8, depth + 1);
}

// --- Muro con hueco ---

/** El muro (bloques de piedra/energía del tipo) con su hueco marcado por flechas. */
export function drawWallBar(g: G, b: Bounds, plan: WallPlan, pos: number, thick: number, color: number, t: number, a = 1) {
  const along = plan.axis;
  const lo = along === 'x' ? b.y0 : b.x0;
  const hi = along === 'x' ? b.y1 : b.x1;
  const at = (u: number, v: number) => (along === 'x' ? [pos + v, u] : [u, pos + v]) as [number, number];
  for (let u = lo; u < hi; u += PX * 2) {
    if (u + PX * 2 > plan.gapStart && u < plan.gapEnd) continue;
    const brick = Math.floor((u - lo) / (PX * 4)) % 2;
    for (let v = -thick / 2; v < thick / 2; v += PX) {
      const edge = Math.abs(v) > thick / 2 - PX * 1.5;
      const c = edge ? OUT : brick ? color : darkOf(color);
      const [x, y] = at(u, v);
      g.fillStyle(c, a).fillRect(snap(x), snap(y), PX * 2, PX);
    }
    if (Math.sin(u * 0.05 + t * 0.02) > 0.92) {
      const [x, y] = at(u, 0);
      dot(g, x, y, 0xffffff, a);
    }
  }
  // Bordes del hueco brillando
  for (const u of [plan.gapStart, plan.gapEnd]) for (let v = -thick; v <= thick; v += PX) {
    const [x, y] = at(u, v);
    dot(g, x, y, lightOf(color), a);
  }
}
/** Aviso: franja del borde de salida parpadeando y el carril del hueco marcado con flechas en la dirección del muro. */
export function wallWarn(sc: Phaser.Scene, b: Bounds, plan: WallPlan, thick: number, color: number, ms: number, depth = 4) {
  animate(sc, depth, ms, (g, k, t) => {
    const start = plan.axis === 'x' ? (plan.dir === 1 ? b.x0 : b.x1) : plan.dir === 1 ? b.y0 : b.y1;
    drawWallBar(g, b, plan, start + plan.dir * thick * 0.5, thick, color, t, 0.35 + 0.4 * k);
    const ang = plan.axis === 'x' ? (plan.dir === 1 ? 0 : Math.PI) : plan.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    const mid = (plan.gapStart + plan.gapEnd) / 2;
    const len = plan.axis === 'x' ? b.x1 - b.x0 : b.y1 - b.y0;
    for (let s = 0; s < 6; s++) {
      const d = ((s / 6 + (t / 900)) % 1) * len;
      const p = (plan.axis === 'x' ? (plan.dir === 1 ? b.x0 : b.x1) : plan.dir === 1 ? b.y0 : b.y1) + plan.dir * d;
      const [x, y] = plan.axis === 'x' ? [p, mid] : [mid, p];
      chevron(g, x, y, ang, 0x7dff9a, 0.8);
    }
  }, 50);
}

// --- Minas en cruz ---

/** La mina (bola con púas que parpadea más deprisa al final) y la cruz de aviso a lo largo de sus brazos. */
export function mineWarn(sc: Phaser.Scene, m: Pt, arms: [number, number][], width: number, color: number, ms: number, depth = 3) {
  animate(sc, depth, ms, (g, k, t) => {
    for (const [a, l] of arms) {
      const x2 = m.x + Math.cos(a) * l;
      const y2 = m.y + Math.sin(a) * l;
      g.fillStyle(WARN, 0.06 + 0.16 * k);
      const nx = -Math.sin(a) * width / 2;
      const ny = Math.cos(a) * width / 2;
      g.fillPoints([new Phaser.Math.Vector2(m.x + nx, m.y + ny), new Phaser.Math.Vector2(x2 + nx, y2 + ny), new Phaser.Math.Vector2(x2 - nx, y2 - ny), new Phaser.Math.Vector2(m.x - nx, m.y - ny)], true);
      dashLine(g, m.x, m.y, x2, y2, WARN, 0.85, -t * 0.12);
    }
    const blink = Math.floor(t / (k > 0.7 ? 60 : 160)) % 2 === 0;
    disc(g, m.x, m.y, 16, OUT);
    disc(g, m.x, m.y, 12, blink ? 0xff5040 : darkOf(color));
    disc(g, m.x - 3, m.y - 3, 5, blink ? 0xffffff : color);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) dot(g, m.x + dx * 18, m.y + dy * 18, OUT);
  }, 50);
}
export function drawCrossBlast(g: G, m: Pt, arms: [number, number][], width: number, color: number, t: number) {
  for (const [a, l] of arms) drawPixBeam(g, m.x, m.y, m.x + Math.cos(a) * l, m.y + Math.sin(a) * l, width, color, t);
}

// --- Rejilla de rayos ---

export function gridWarn(sc: Phaser.Scene, b: Bounds, beams: GridBeam[], width: number, color: number, ms: number, depth = 4) {
  animate(sc, depth, ms, (g, k, t) => {
    for (const bm of beams) {
      const [x1, y1, x2, y2] = bm.axis === 'x' ? [bm.at, b.y0, bm.at, b.y1] : [b.x0, bm.at, b.x1, bm.at];
      g.fillStyle(WARN, 0.05 + 0.15 * k);
      if (bm.axis === 'x') g.fillRect(bm.at - width / 2, b.y0, width, b.y1 - b.y0);
      else g.fillRect(b.x0, bm.at - width / 2, b.x1 - b.x0, width);
      dashLine(g, x1, y1, x2, y2, k > 0.7 && Math.floor(t / 70) % 2 === 0 ? 0xffffff : color, 0.9, t * 0.1);
      // Emisores en las dos paredes
      for (const [ex, ey] of [[x1, y1], [x2, y2]]) {
        disc(g, ex, ey, 12, OUT);
        disc(g, ex, ey, 8, k > 0.5 ? lightOf(color) : color);
      }
    }
  }, 50);
}
export function drawGridBeam(g: G, b: Bounds, bm: GridBeam, width: number, color: number, t: number) {
  if (bm.axis === 'x') drawPixBeam(g, bm.at, b.y0, bm.at, b.y1, width, color, t);
  else drawPixBeam(g, b.x0, bm.at, b.x1, bm.at, width, color, t);
}

// --- Orbes que rebotan ---

export function bounceWarn(sc: Phaser.Scene, at: () => Pt, angles: number[], color: number, ms: number, depth = 4) {
  animate(sc, depth, ms, (g, k, t) => {
    const p = at();
    for (const a of angles) {
      for (let s = 0; s < 4; s++) {
        const d = 50 + ((s * 40 + t * 0.18) % 160);
        chevron(g, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, a, s % 2 ? color : lightOf(color), 0.4 + 0.5 * k);
      }
    }
    drawPixOrb(g, p.x, p.y, 10 + 14 * k, color, t, 0.9);
  }, 50);
}
export const drawBounceOrb = (g: G, x: number, y: number, r: number, color: number, t: number) => drawPixOrb(g, x, y, r, color, t);

// --- Niebla persistente ---

export function miasmaWarn(sc: Phaser.Scene, x: number, y: number, R: number, color: number, ms: number, depth = 3) {
  animate(sc, depth, ms, (g, k, t) => {
    g.fillStyle(color, 0.08 + 0.2 * k).fillCircle(x, y, R * (0.4 + 0.6 * k));
    for (let a = 0; a < TAU; a += PX / R) if (Math.floor((a - t * 0.003) / 0.25) % 2 === 0) dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R, k > 0.7 && Math.floor(t / 70) % 2 === 0 ? 0xffffff : color, 0.9);
    // Burbujas que suben
    for (let s = 0; s < 5; s++) {
      const bx = x + Math.cos(s * 2.3) * R * 0.5;
      const by = y + R * 0.4 - ((t * 0.05 + s * 17) % (R * 0.9));
      dot(g, bx, by, lightOf(color), 0.8);
    }
  }, 50);
}
/** Nube de niebla (manchas de píxel que se mueven despacio); `a` para que aparezca y se vaya. */
export function drawMiasma(g: G, x: number, y: number, R: number, color: number, t: number, a: number) {
  for (let s = 0; s < 9; s++) {
    const ang = s * 0.7 + t * 0.0006 * (s % 2 ? 1 : -1);
    const d = (s % 3) * R * 0.3;
    const r = R * (0.35 + 0.1 * Math.sin(t * 0.003 + s));
    disc(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.8, r, s % 3 === 0 ? darkOf(color) : color, 0.28 * a);
  }
  for (let s = 0; s < 6; s++) dot(g, x + Math.cos(s + t * 0.002) * R * 0.7, y + Math.sin(s * 1.7 + t * 0.002) * R * 0.5, lightOf(color), 0.7 * a);
}

// --- Embestida marcada ---

export function dashWarn(sc: Phaser.Scene, a: Pt, c: Pt, width: number, color: number, ms: number, depth = 3) {
  const ang = Math.atan2(c.y - a.y, c.x - a.x);
  const len = Math.hypot(c.x - a.x, c.y - a.y);
  animate(sc, depth, ms, (g, k, t) => {
    const nx = -Math.sin(ang) * width / 2;
    const ny = Math.cos(ang) * width / 2;
    g.fillStyle(WARN, 0.06 + 0.18 * k);
    g.fillPoints([new Phaser.Math.Vector2(a.x + nx, a.y + ny), new Phaser.Math.Vector2(c.x + nx, c.y + ny), new Phaser.Math.Vector2(c.x - nx, c.y - ny), new Phaser.Math.Vector2(a.x - nx, a.y - ny)], true);
    dashLine(g, a.x + nx, a.y + ny, c.x + nx, c.y + ny, WARN, 0.9, -t * 0.15);
    dashLine(g, a.x - nx, a.y - ny, c.x - nx, c.y - ny, WARN, 0.9, -t * 0.15);
    for (let d = 40; d < len * k; d += 70) chevron(g, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, ang, k > 0.7 && Math.floor(t / 70) % 2 === 0 ? 0xffffff : color, 0.9);
  }, 50);
}
