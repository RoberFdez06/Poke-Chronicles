// Dibujo de los ataques frenéticos (bossFrenzy.ts): avisos que se encienden y rayos en capas de color pixel (contorno
// oscuro, color del tipo, versión clara y núcleo blanco). Todo en UN Graphics por ataque que se repinta cada fotograma
// (sin crear objetos por línea). Grosor mínimo y contorno oscuro para que se lean en pantallas pequeñas. Con pocos
// efectos (low) se quitan capas y destellos, pero el aviso conserva grosor y contraste.
import Phaser from 'phaser';
import { darkOf, lightOf, PX } from './pixelFx';
import type { Lane, Pt, Strike } from '../../data/bossFrenzy';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x18202c;
const WARN = 0xff3d00;
const TAU = Math.PI * 2;
const snap = (v: number) => Math.round(v / PX) * PX;
const sq = (g: G, x: number, y: number, c: number, a: number, s = PX) => g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Aviso de una línea: fina y tenue al aparecer, se enciende y parpadea justo antes de golpear (k de 0 a 1). */
export function drawLaneWarn(g: G, l: Lane, k: number, t: number, low: boolean) {
  const a = 0.35 + 0.55 * k;
  const blink = k > 0.7 && Math.floor(t / 70) % 2 === 0;
  const w = Math.max(PX, Math.round(l.width * (0.25 + 0.2 * k)));
  g.lineStyle(w + 4, OUT, 0.7 * a).lineBetween(l.x1, l.y1, l.x2, l.y2);
  g.lineStyle(w, blink ? 0xffffff : WARN, a).lineBetween(l.x1, l.y1, l.x2, l.y2);
  if (!low) {
    // Bordes de la zona que va a quemar: puntos de píxel a lo largo (el ancho real del golpe)
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) || 1;
    const ux = (l.x2 - l.x1) / len;
    const uy = (l.y2 - l.y1) / len;
    const nx = -uy * (l.width / 2);
    const ny = ux * (l.width / 2);
    const stepD = PX * 4;
    for (let d = (t * 0.12) % stepD; d < len; d += stepD) {
      const x = l.x1 + ux * d;
      const y = l.y1 + uy * d;
      sq(g, x + nx, y + ny, WARN, a * 0.8);
      sq(g, x - nx, y - ny, WARN, a * 0.8);
    }
  }
}

/** Rayo activo (k de 0 a 1 durante su tiempo encendido). */
export function drawLaneBeam(g: G, l: Lane, k: number, color: number, low: boolean) {
  const w = l.width * (k < 0.15 ? 0.7 + 2 * k : 1);
  g.lineStyle(w + 8, OUT, 1).lineBetween(l.x1, l.y1, l.x2, l.y2);
  g.lineStyle(w, color, 1).lineBetween(l.x1, l.y1, l.x2, l.y2);
  if (!low) g.lineStyle(Math.max(PX, w * 0.55), lightOf(color), 1).lineBetween(l.x1, l.y1, l.x2, l.y2);
  g.lineStyle(Math.max(PX / 2, w * 0.22), 0xffffff, 1).lineBetween(l.x1, l.y1, l.x2, l.y2);
  if (!low && k < 0.3) {
    // Fogonazo en los extremos al encenderse
    for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]] as const) g.fillStyle(0xffffff, 1 - k * 3).fillRect(snap(x) - w / 2, snap(y) - w / 2, w, w);
  }
}

/** Rayo apagándose: queda la marca oscura del color (k de 0 a 1). */
export function drawLaneFade(g: G, l: Lane, k: number, color: number) {
  g.lineStyle(Math.max(PX, l.width * (1 - k)), darkOf(color), 0.8 * (1 - k)).lineBetween(l.x1, l.y1, l.x2, l.y2);
}

/** Anillo de cuadrados de píxel (de a0 a a1). */
function pixArc(g: G, cx: number, cy: number, r: number, c: number, a: number, size: number, a0 = 0, a1 = TAU, skip?: (ang: number) => boolean) {
  const n = Math.max(12, Math.ceil(((a1 - a0) * r) / PX));
  for (let i = 0; i <= n; i++) {
    const ang = a0 + ((a1 - a0) * i) / n;
    if (skip?.(ang)) continue;
    sq(g, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, c, a, size);
  }
}

/** Aviso de embestida: carril con chevrones que avanzan. `held` = amago (el aviso aguanta y late más despacio). */
export function drawDashWarn(g: G, a: Pt, c: Pt, width: number, k: number, t: number, held: boolean, low: boolean) {
  const al = 0.3 + 0.5 * Math.min(1, k);
  const col = held && Math.floor(t / 160) % 2 === 0 ? 0xffffff : WARN;
  g.lineStyle(width + 6, OUT, 0.5 * al).lineBetween(a.x, a.y, c.x, c.y);
  g.lineStyle(width, col, 0.22 * al).lineBetween(a.x, a.y, c.x, c.y);
  g.lineStyle(PX, col, al).lineBetween(a.x, a.y, c.x, c.y);
  if (low) return;
  const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  const ux = (c.x - a.x) / len;
  const uy = (c.y - a.y) / len;
  for (let d = (t * 0.25) % 60; d < len; d += 60) {
    const x = a.x + ux * d;
    const y = a.y + uy * d;
    for (const s of [-1, 1]) {
      for (let j = 1; j <= 3; j++) sq(g, x - ux * j * PX + -uy * s * j * PX, y - uy * j * PX + ux * s * j * PX, col, al);
    }
  }
}

/** Aviso de zona amplia: círculo que se llena desde el centro; en un amago el borde late y se queda. */
export function drawZoneWarn(g: G, x: number, y: number, R: number, k: number, t: number, held: boolean, low: boolean) {
  const al = 0.3 + 0.6 * Math.min(1, k);
  const col = held && Math.floor(t / 160) % 2 === 0 ? 0xffffff : WARN;
  g.fillStyle(WARN, 0.1 + 0.18 * Math.min(1, k)).fillCircle(x, y, R * Math.min(1, k));
  pixArc(g, x, y, R, OUT, al * 0.7, PX + 4);
  pixArc(g, x, y, R, col, al, PX);
  if (!low) for (let i = 0; i < 4; i++) {
    const ang = (t * 0.002) + (i * TAU) / 4;
    sq(g, x + Math.cos(ang) * (R - PX * 2), y + Math.sin(ang) * (R - PX * 2), col, al, PX * 2);
  }
}

/** Estallido de la zona (k de 0 a 1). */
export function drawZoneBlast(g: G, x: number, y: number, R: number, k: number, color: number, low: boolean) {
  g.fillStyle(color, 0.75 * (1 - k)).fillCircle(x, y, R);
  if (!low) g.fillStyle(0xffffff, 0.6 * (1 - k)).fillCircle(x, y, R * (0.4 + 0.5 * k));
  pixArc(g, x, y, R * (1 + 0.15 * k), darkOf(color), 1 - k, PX + 2);
}

// --- Rayos: círculo en el suelo donde cae un rayo ---

const BOLT = 0xfff27a;
/** Hash pequeño y estable por rayo (el zigzag no tiembla entre fotogramas). */
const hash = (x: number, y: number, i: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Aviso del rayo: círculo de píxeles en el suelo con contorno oscuro que se va rellenando desde el centro (k de 0 a 1)
 * y parpadea en blanco al final; mira (cruz) en el centro y cuatro marcas que giran. `held`: amago (late despacio).
 */
export function drawStrikeWarn(g: G, s: Pick<Strike, 'x' | 'y' | 'r'>, k: number, t: number, low: boolean, held = false) {
  const kk = Math.min(1, k);
  const al = 0.35 + 0.55 * kk;
  const blink = (kk > 0.7 && Math.floor(t / 70) % 2 === 0) || (held && Math.floor(t / 160) % 2 === 0);
  const col = blink ? 0xffffff : WARN;
  // Relleno que crece (la zona exacta que va a quemar)
  g.fillStyle(WARN, 0.1 + 0.2 * kk).fillCircle(s.x, s.y, s.r * kk);
  if (!low) g.fillStyle(0xffffff, 0.08 + 0.1 * kk).fillCircle(s.x, s.y, s.r * kk * 0.55);
  pixArc(g, s.x, s.y, s.r, OUT, al * 0.8, PX + 4);
  pixArc(g, s.x, s.y, s.r, col, al, PX);
  // Mira en el centro
  for (let d = -3; d <= 3; d++) {
    if (d === 0) continue;
    sq(g, s.x + d * PX, s.y, col, al);
    sq(g, s.x, s.y + d * PX, col, al);
  }
  if (!low) {
    for (let i = 0; i < 4; i++) {
      const ang = t * 0.003 + (i * TAU) / 4;
      sq(g, s.x + Math.cos(ang) * (s.r - PX * 2), s.y + Math.sin(ang) * (s.r - PX * 2), col, al, PX * 2);
    }
    // Chispas que se juntan arriba (la nube que carga)
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ox = (hash(s.x, s.y, i) - 0.5) * s.r * 1.2;
      sq(g, s.x + ox, s.y - s.r - 30 - hash(s.x, s.y, i + 9) * 50 + kk * 20, BOLT, al * kk, PX);
    }
  }
}

/** Zigzag del rayo de (x, top) a (x, y): quiebros de píxel estables. */
function boltPts(x: number, top: number, y: number, seed: number, amp: number): Pt[] {
  const pts: Pt[] = [{ x, y: top }];
  const segs = 7;
  for (let i = 1; i < segs; i++) pts.push({ x: x + (hash(x, seed, i) - 0.5) * 2 * amp, y: top + ((y - top) * i) / segs });
  pts.push({ x, y });
  return pts;
}
function strokePts(g: G, pts: Pt[], w: number, c: number, a: number) {
  g.lineStyle(w, c, a);
  for (let i = 1; i < pts.length; i++) g.lineBetween(snap(pts[i - 1].x), snap(pts[i - 1].y), snap(pts[i].x), snap(pts[i].y));
}

/**
 * Rayo cayendo (k de 0 a 1 mientras quema): destello que llena el círculo, rayo vertical en zigzag desde arriba de la
 * pantalla con capas (contorno, color del tipo, amarillo y núcleo blanco), chispazo de píxeles en el suelo.
 */
export function drawStrikeBolt(g: G, s: Pick<Strike, 'x' | 'y' | 'r'>, k: number, color: number, low: boolean) {
  const fl = 1 - k;
  g.fillStyle(0xffffff, 0.75 * fl).fillCircle(s.x, s.y, s.r);
  g.fillStyle(color, 0.45 * fl).fillCircle(s.x, s.y, s.r * (0.7 + 0.3 * k));
  pixArc(g, s.x, s.y, s.r, darkOf(color), 0.9 * fl + 0.1, PX + 2);
  const top = s.y - 520;
  const flick = Math.floor(k * 6) % 2;
  const pts = boltPts(s.x, top, s.y, s.y + flick * 7, low ? 12 : 22);
  strokePts(g, pts, 22, OUT, fl);
  strokePts(g, pts, 14, color, fl);
  if (!low) strokePts(g, pts, 9, BOLT, fl);
  strokePts(g, pts, 4, 0xffffff, 1 - k * 0.6);
  if (!low) {
    // Rama corta que sale del zigzag
    const m = pts[3];
    strokePts(g, [m, { x: m.x + (hash(s.x, s.y, 3) < 0.5 ? -1 : 1) * 40, y: m.y + 50 }], 5, BOLT, fl);
    // Chispazo: chispas en cruz y en diagonal que salen del centro
    for (let i = 0; i < 8; i++) {
      const ang = (i * TAU) / 8 + 0.2;
      const d = s.r * (0.25 + 0.7 * k);
      sq(g, s.x + Math.cos(ang) * d, s.y + Math.sin(ang) * d, i % 2 ? BOLT : 0xffffff, fl, PX * 2);
    }
  }
  sq(g, s.x, s.y, 0xffffff, fl, PX * 4);
}

/** Marca quemada donde cayó (k de 0 a 1). */
export function drawStrikeFade(g: G, s: Pick<Strike, 'x' | 'y' | 'r'>, k: number, color: number) {
  g.fillStyle(darkOf(color), 0.35 * (1 - k)).fillCircle(s.x, s.y, s.r * 0.5);
  pixArc(g, s.x, s.y, s.r * 0.5, darkOf(color), 0.7 * (1 - k), PX);
}
