// Dibujo de los ataques frenéticos (bossFrenzy.ts): avisos que se encienden y rayos en capas de color pixel (contorno
// oscuro, color del tipo, versión clara y núcleo blanco). Todo en UN Graphics por ataque que se repinta cada fotograma
// (sin crear objetos por línea). Grosor mínimo y contorno oscuro para que se lean en pantallas pequeñas. Con pocos
// efectos (low) se quitan capas y destellos, pero el aviso conserva grosor y contraste.
import Phaser from 'phaser';
import { darkOf, lightOf, PX } from './pixelFx';
import { ringRadius, type Lane, type Pt } from '../../data/bossFrenzy';
import type { Bounds } from '../../level/bounds';

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
const inGap = (gapAng: number, gapW: number) => (ang: number) => Math.abs(Math.atan2(Math.sin(ang - gapAng), Math.cos(ang - gapAng))) <= gapW / 2;

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

/** Aviso de onda: anillo discontinuo en su radio final con el hueco marcado (huecos en blanco). */
export function drawWaveWarn(g: G, cx: number, cy: number, R: number, gapAng: number, gapW: number, k: number, t: number, held: boolean, low: boolean) {
  const al = 0.35 + 0.55 * Math.min(1, k);
  const col = held && Math.floor(t / 160) % 2 === 0 ? 0xffffff : WARN;
  const skip = inGap(gapAng, gapW);
  pixArc(g, cx, cy, R, OUT, al * 0.7, PX + 4, 0, TAU, skip);
  pixArc(g, cx, cy, R, col, al, PX, 0, TAU, skip);
  if (!low) pixArc(g, cx, cy, R * Math.min(1, k), col, al * 0.4, PX, 0, TAU, skip);
  // Bordes del hueco, bien claros: dos postes blancos
  for (const s of [-1, 1]) {
    const ang = gapAng + (s * gapW) / 2;
    for (let r = R - 24; r <= R + 24; r += PX) sq(g, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 0xffffff, al);
  }
}

/** Onda en marcha de radio r. */
export function drawWave(g: G, cx: number, cy: number, r: number, thick: number, gapAng: number, gapW: number, color: number, low: boolean) {
  const skip = inGap(gapAng, gapW);
  pixArc(g, cx, cy, r, OUT, 1, thick + 6, 0, TAU, skip);
  pixArc(g, cx, cy, r, color, 1, thick, 0, TAU, skip);
  if (!low) pixArc(g, cx, cy, r, 0xffffff, 1, Math.max(PX, thick * 0.3), 0, TAU, skip);
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

// --- Anillos de las cascadas mezcladas ---

/** Traza el anillo como polilínea (segmentos de ~16 px, máx. 360) saltando el arco libre y lo que cae fuera de la sala. */
function ringPath(g: G, l: Lane, r: number, b: Bounds) {
  const R = l.ring!;
  if (r <= 1) return;
  const span = Math.PI * 2 - R.gapW;
  const n = Math.min(360, Math.max(16, Math.ceil((span * r) / 16)));
  const a0 = R.gapAng + R.gapW / 2;
  let open = false;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (span * i) / n;
    const x = R.cx + Math.cos(a) * r;
    const y = R.cy + Math.sin(a) * r;
    const inside = x >= b.x0 - 8 && x <= b.x1 + 8 && y >= b.y0 - 8 && y <= b.y1 + 8;
    if (!inside) {
      if (open) g.strokePath();
      open = false;
      continue;
    }
    if (!open) {
      g.beginPath();
      g.moveTo(x, y);
      open = true;
    } else g.lineTo(x, y);
  }
  if (open) g.strokePath();
}

/** Bordes del arco libre: dos postes blancos que marcan por dónde pasar. */
function ringGapPosts(g: G, l: Lane, r: number, a: number) {
  const R = l.ring!;
  for (const s of [-1, 1]) {
    const ang = R.gapAng + (s * R.gapW) / 2;
    for (let d = -l.width / 2; d <= l.width / 2; d += PX) sq(g, R.cx + Math.cos(ang) * (r + d), R.cy + Math.sin(ang) * (r + d), 0xffffff, a, PX + 2);
  }
}

/** Aviso del anillo: círculo tenue en su radio de salida y otro en el de llegada que se enciende y parpadea (k de 0 a 1). */
export function drawRingWarn(g: G, l: Lane, k: number, t: number, b: Bounds, low: boolean) {
  const R = l.ring!;
  const a = 0.3 + 0.6 * k;
  const blink = k > 0.7 && Math.floor(t / 70) % 2 === 0;
  // Círculo de salida (donde nace): bien visible, con contorno oscuro
  const r = Math.max(R.r0, l.width);
  const w = Math.max(PX * 2, Math.round(l.width * (0.3 + 0.2 * k)));
  g.lineStyle(w + 4, OUT, 0.7 * a);
  ringPath(g, l, r, b);
  g.lineStyle(w, blink ? 0xffffff : WARN, a);
  ringPath(g, l, r, b);
  if (!low) {
    // Barrido tenue del recorrido (anticipa hacia dónde va)
    g.lineStyle(PX, WARN, 0.35 * a);
    ringPath(g, l, R.r0 + (R.r1 - R.r0) * k * 0.5, b);
    ringGapPosts(g, l, r, a);
  }
  sq(g, R.cx, R.cy, blink ? 0xffffff : WARN, a, PX * 3);
}

/** Anillo activo en su radio actual. */
export function drawRingBeam(g: G, l: Lane, t: number, color: number, b: Bounds, low: boolean) {
  const r = ringRadius(l, t);
  const w = l.width;
  g.lineStyle(w + 8, OUT, 1);
  ringPath(g, l, r, b);
  g.lineStyle(w, color, 1);
  ringPath(g, l, r, b);
  if (!low) {
    g.lineStyle(Math.max(PX, w * 0.5), lightOf(color), 1);
    ringPath(g, l, r, b);
    ringGapPosts(g, l, r, 0.9);
  }
  g.lineStyle(Math.max(PX / 2, w * 0.2), 0xffffff, 1);
  ringPath(g, l, r, b);
}

/** Anillo apagándose donde acabó (k de 0 a 1). */
export function drawRingFade(g: G, l: Lane, k: number, color: number, b: Bounds) {
  g.lineStyle(Math.max(PX, l.width * (1 - k)), darkOf(color), 0.8 * (1 - k));
  ringPath(g, l, l.ring!.r1, b);
}
