// Arte de las formas de poder del jugador que no son la mega: el aura nueva del Dinamax (nubes rojas de píxel gordo
// que asoman por detrás del dibujo, sin taparlo ni teñirlo) y las cinemáticas de Teracristal, Dinamax/Gigamax y
// Movimiento Z (scenes/formCinematic.ts). Mismo lenguaje que drawMegaCine (viñeta de píxeles, partículas del tipo,
// columna de luz y aro que se abre), pero cada una con su motivo: cristal facetado, nube roja y estrella Z.
import Phaser from 'phaser';
import { PX, darkOf, lightOf, mixColor } from './pixelFx';
import type { FormCineFrame } from '../../scenes/formCinematic';

const OUT = 0x18202c;
/** Rojos del Dinamax: sombra, cuerpo, luz y brillo de las nubes. */
export const MAX_RED = { deep: 0x4a0a18, dark: 0x8e1430, main: 0xe0304c, light: 0xff7a8c, glow: 0xffd0d8 } as const;

const snapTo = (v: number, s: number) => Math.round(v / s) * s;
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) {
  g.fillStyle(c, a).fillRect(snapTo(x, s) - s / 2, snapTo(y, s) - s / 2, s, s);
}
/** Disco de píxeles (filas de alto `s`), aplanado con `flat`. */
function disc(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: number, a = 1, s = PX, flat = 1) {
  for (let yy = -r; yy <= r; yy += s) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    const w = Math.max(s, snapTo(half * 2, s));
    g.fillStyle(c, a).fillRect(snapTo(x, s) - w / 2, snapTo(y + yy * flat, s) - s / 2, w, s);
  }
}

/**
 * Bocanada de nube de píxeles con tres tonos: sombra abajo a la derecha, cuerpo y luz arriba a la izquierda (como
 * las nubes del Dinamax de los juegos, pero en píxel). `r` en px del mundo.
 */
function puff(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, a = 1, cols: { dark: number; main: number; light: number } = MAX_RED) {
  if (r < PX) return px(g, x, y, cols.main, a);
  disc(g, x + PX / 2, y + PX / 2, r, cols.dark, a);
  disc(g, x - PX / 3, y - PX / 3, r - PX * 0.6, cols.main, a);
  disc(g, x - r * 0.35, y - r * 0.35, Math.max(PX / 2, r * 0.35), cols.light, a);
}

/** Caja de lo visible del dibujo en el mundo (px). */
export interface WorldBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Aura del Dinamax (y del Gigamax sin sprite propio), cada ~80 ms, en un Graphics que va JUSTO DETRÁS del sprite:
 * charco de nube roja a los pies, bocanadas que asoman por los lados de la silueta (pegadas a lo que mide el dibujo,
 * no a la textura con su aire), jirones que suben y una corona de nubes sobre la cabeza. Todo opaco y en rejilla de
 * píxeles: nada de óvalos translúcidos encima ni tinte sobre el Pokémon.
 */
export function drawMaxAura(g: Phaser.GameObjects.Graphics, b: WorldBox, t: number) {
  const w = Math.max(24, b.right - b.left);
  const h = Math.max(24, b.bottom - b.top);
  const cx = (b.left + b.right) / 2;
  const feet = b.bottom;
  const big = Math.min(PX * 3, Math.max(PX * 1.5, w * 0.14));
  // 1) charco a los pies: anillo de bocanadas que gira despacio (las de delante, abajo, más claras)
  const n = 9;
  const rx = w * 0.62;
  const ry = Math.max(PX * 2, rx * 0.28);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + t * 0.0007;
    const bob = Math.sin(t / 260 + i * 1.7) * 2;
    puff(g, cx + Math.cos(a) * rx, feet - PX + Math.sin(a) * ry + bob, big * (0.8 + 0.25 * Math.sin(t / 330 + i)), 0.95);
  }
  // 2) bocanadas por los lados de la silueta (por detrás: solo se ve lo que sobresale)
  for (const side of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const k = (j + 0.5) / 4;
      const breathe = Math.sin(t / 300 + j * 1.3 + side) * PX * 0.6;
      const ex = side > 0 ? b.right : b.left;
      const inset = w * 0.08 * (1 - k);
      puff(g, ex - side * inset + side * (PX * 0.5 + breathe), feet - h * k * 0.8, big * (1.05 - k * 0.45), 0.9);
    }
  }
  // 3) jirones que suben y se deshacen (detrás y a los lados)
  for (let i = 0; i < 8; i++) {
    const ph = (t * 0.0005 + i * 0.137) % 1;
    const sx = cx + ((i % 4) - 1.5) * w * 0.38 + Math.sin(t / 380 + i) * 4;
    px(g, sx, feet - PX - ph * h * 1.05, mixColor(MAX_RED.deep, MAX_RED.light, ph), 0.85 * (1 - ph), PX * (1 + (ph < 0.5 ? 1 : 0)));
  }
  // 4) corona de nubes sobre la cabeza (sobre la caja, no sobre la textura)
  const cr = Math.min(PX * 2.2, Math.max(PX, w * 0.1));
  const top = b.top - cr * 0.6;
  for (let i = 0; i < 5; i++) {
    const off = i - 2;
    const yy = top - (2 - Math.abs(off)) * cr * 0.55 + Math.sin(t / 280 + i) * 2;
    puff(g, cx + off * cr * 1.5, yy, cr * (Math.abs(off) === 2 ? 0.8 : 1), 0.95);
  }
  // destello de la banda en la corona, de vez en cuando
  const cyc = (t % 1800) / 1800;
  if (cyc < 0.15) {
    const s = 1 - Math.abs(cyc / 0.075 - 1);
    px(g, cx, top - cr * 1.6, MAX_RED.glow, s, PX);
    px(g, cx - PX, top - cr * 1.6, 0xffffff, s * 0.7, PX);
    px(g, cx + PX, top - cr * 1.6, 0xffffff, s * 0.7, PX);
  }
}

/** Viñeta de píxeles que oscurece la sala hacia fuera (dim 0-1), del color `c`. */
function vignette(g: Phaser.GameObjects.Graphics, x: number, y: number, dim: number, c: number) {
  if (dim <= 0) return;
  for (let r = 120; r <= 260; r += PX * 4) {
    const n = Math.round((r * 6.283) / (PX * 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      px(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, c, dim * 0.2 * ((r - 100) / 160), PX * 4);
    }
  }
}

/** Faceta de cristal (rombo) con borde oscuro, cara clara arriba a la izquierda y oscura abajo a la derecha. */
function gem(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, a = 1, s = PX) {
  for (let dy = -r; dy <= r; dy += s) {
    const half = r - Math.abs(dy);
    for (let dx = -half; dx <= half; dx += s) {
      const edge = Math.abs(dx) >= half - s / 2 || Math.abs(dy) >= r - s / 2;
      const c = edge ? OUT : dx <= 0 && dy <= 0 ? lightOf(color) : dx > 0 && dy > 0 ? darkOf(color) : color;
      px(g, x + dx, y + dy, c, a, s);
    }
  }
}

/** Fondo de la cinemática (detrás del sprite): viñeta, charco y nubes o cristal que crece por detrás. */
export interface FormCineArgs {
  x: number;
  y: number;
  /** Caja de lo visible del sprite AHORA (crece con él en el Dinamax). */
  box: WorldBox;
  color: number;
  t: number;
  low: boolean;
}

export function drawFormCineBack(g: Phaser.GameObjects.Graphics, kind: 'tera' | 'max' | 'z', f: FormCineFrame, o: FormCineArgs) {
  if (f.phase === 'done') return;
  const { box, t, low, color } = o;
  const cx = (box.left + box.right) / 2;
  const feet = box.bottom;
  const w = Math.max(24, box.right - box.left);
  const h = Math.max(24, box.bottom - box.top);
  const midY = (box.top + box.bottom) / 2;
  const dim = f.index === 0 ? f.k : f.index >= 4 ? 1 - f.k : 1;
  if (!low) vignette(g, cx, midY, dim, kind === 'max' ? MAX_RED.deep : OUT);
  if (kind === 'max') {
    // la nube roja sube en espiral desde el suelo y crece con el Pokémon
    const n = low ? 8 : 18;
    for (let i = 0; i < n; i++) {
      const life = (t / 900 + i / n) % 1;
      const a = i * 2.39996 + life * 4;
      const r = w * (0.4 + 0.5 * f.build) + (1 - life) * 18;
      const yy = feet - life * h * (0.6 + 0.6 * f.build);
      puff(g, cx + Math.cos(a) * r, yy + Math.sin(a) * r * 0.25, PX * (1.2 + f.build * 1.6) * (1 - life * 0.5), Math.min(1, life * 4) * (0.5 + 0.5 * f.build));
    }
    return;
  }
  if (kind === 'tera') {
    // aro de cristal a los pies que se forma con el cristal
    const n = 14;
    for (let i = 0; i < n; i++) {
      if (i / n > f.build + 0.05) continue;
      const a = (i / n) * 6.283 + t * 0.0012;
      gem(g, cx + Math.cos(a) * w * 0.7, feet + Math.sin(a) * w * 0.22, PX + (i % 2) * 3, i % 2 ? color : lightOf(color), 0.9, 3);
    }
    // destellos que convergen hacia el Pokémon durante la formación
    if (f.index <= 2) {
      const m = low ? 8 : 18;
      for (let i = 0; i < m; i++) {
        const life = (t / 600 + i / m) % 1;
        const r = (1 - life) * 110 + 10;
        const a = i * 2.39996 + life * 2.5;
        px(g, cx + Math.cos(a) * r, midY + Math.sin(a) * r * 0.75, i % 3 ? lightOf(color) : 0xffffff, Math.min(1, life * 3) * 0.9);
      }
    }
    return;
  }
  // Z: estrella Z de cinco puntas a los pies que se dibuja y gira, y energía del tipo que sube por detrás
  const grow = Math.min(1, f.build * 1.6);
  const R = (40 + w * 0.6) * grow;
  const rot = t * 0.003;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i / 10) * 6.283;
    const rr = i % 2 ? R * 0.42 : R;
    pts.push([cx + Math.cos(a) * rr, feet + Math.sin(a) * rr * 0.5]);
  }
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 10];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / PX));
    for (let s = 0; s <= steps; s++) px(g, ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps, i % 2 ? color : lightOf(color), 0.95);
  }
  if (f.index >= 2) {
    // llamas de energía del tipo que suben por detrás de la silueta
    const m = low ? 6 : 14;
    for (let i = 0; i < m; i++) {
      const ph = (t * 0.0012 + i / m) % 1;
      const sx = cx + Math.sin(i * 2.1) * w * 0.55;
      const sz = PX * (ph < 0.4 ? 2 : 1);
      px(g, sx, feet - ph * h * 1.2, ph < 0.3 ? 0xffffff : ph < 0.6 ? lightOf(color) : color, (1 - ph) * f.build, sz);
    }
  }
}

/** Delante del sprite: cristal que lo encierra, corona Tera, Cristal Z con sus rayos, ondas y columnas de luz. */
export function drawFormCineFront(g: Phaser.GameObjects.Graphics, kind: 'tera' | 'max' | 'z', f: FormCineFrame, o: FormCineArgs) {
  if (f.phase === 'done') return;
  const { box, t, low, color } = o;
  const cx = (box.left + box.right) / 2;
  const feet = box.bottom;
  const w = Math.max(24, box.right - box.left);
  const h = Math.max(24, box.bottom - box.top);
  const light = lightOf(color);
  if (kind === 'tera') {
    // cristal: columnas de facetas que suben desde el suelo hasta cubrir la silueta (en «crystal» y «shine»)
    if (f.index >= 1 && f.index <= 2) {
      const reach = feet - (h + PX * 2) * f.build;
      const cols = Math.max(3, Math.round(w / (PX * 2.5)));
      for (let c = 0; c < cols; c++) {
        const xx = box.left - PX + ((w + PX * 2) * (c + 0.5)) / cols;
        const tipH = PX * (2 + ((c * 7) % 3));
        for (let yy = feet; yy > reach + tipH; yy -= PX) {
          const edge = c === 0 || c === cols - 1;
          const shade = (c + Math.floor(yy / (PX * 3))) % 3;
          const col = edge ? OUT : shade === 0 ? light : shade === 1 ? color : darkOf(color);
          px(g, xx, yy, col, edge ? 0.85 : 0.5);
        }
        gem(g, xx, reach + tipH / 2, Math.min(PX * 2, tipH), color, 0.9);
      }
      // brillo diagonal que recorre el cristal al latir
      if (f.index === 2 && !low) {
        const sweep = box.left - 20 + ((t / 4) % (w + 40));
        for (let yy = feet; yy > box.top - PX * 2; yy -= PX) px(g, sweep + (feet - yy) * 0.4, yy, 0xffffff, 0.7);
      }
    }
    // estallido: esquirlas que salen y corona que baja a la cabeza
    if (f.index === 3 || f.index === 4) {
      const sk = f.index === 3 ? f.k : 1;
      const n = low ? 8 : 16;
      for (let i = 0; i < n && f.index === 3; i++) {
        const a = (i / n) * 6.283 + i;
        const d = 10 + sk * (90 + (i % 3) * 25);
        gem(g, cx + Math.cos(a) * d, (box.top + feet) / 2 + Math.sin(a) * d * 0.8, PX * (1 + (i % 2)), i % 3 ? color : 0xffffff, 1 - sk, PX / 2);
      }
      const crownA = f.index === 3 ? Math.min(1, f.k * 2) : 1 - f.k * 0.6;
      const top = box.top - 8 - (f.index === 3 ? (1 - Math.min(1, f.k * 1.5)) * 30 : 0);
      const crown = [[-2, 7], [-1, 10], [0, 14], [1, 10], [2, 7]] as const;
      for (const [k2, r] of crown) gem(g, cx + k2 * 11, top - (r - 7) * 0.8, r, color, crownA, 3);
    }
    if (f.index === 3 && f.k < 0.5) ring(g, cx, feet, 20 + f.k * 2 * (low ? 100 : 180), f.k * 2, color, low);
    if (f.index === 4) ring(g, cx, feet, (low ? 100 : 180) + f.k * 60, 1, color, low, 1 - f.k);
    return;
  }
  if (kind === 'max') {
    // banda Dinamax: rayos de energía roja que caen sobre el Pokémon mientras se forma la nube
    if (f.index === 1 && !low) {
      for (let i = 0; i < 5; i++) {
        const bx = cx + (i - 2) * (w * 0.35 + 10);
        const a = Math.min(1, f.k * 2) * (1 - Math.max(0, f.k - 0.7) / 0.3);
        for (let yy = box.top - 140; yy < box.top + h * 0.4; yy += PX * 2) px(g, bx + Math.round(Math.sin(yy * 0.2 + t / 90 + i) * 2) * 2, yy, i % 2 ? MAX_RED.glow : MAX_RED.main, a * 0.8, PX);
      }
    }
    // cada golpe de crecimiento suelta un aro rojo al ras del suelo
    if (f.index === 2) {
      const sk = (f.k * 3) % 1;
      ring(g, cx, feet, w * 0.5 + sk * 90, 1, MAX_RED.main, low, 1 - sk);
    }
    // rugido: onda roja y blanca enorme y corona de nubes que se asienta
    if (f.index === 3 || f.index === 4) {
      const wk = f.index === 3 ? f.k * 0.5 : 0.5 + f.k * 0.5;
      ring(g, cx, feet, 30 + wk * (low ? 140 : 260), 1, MAX_RED.main, low, 1 - wk);
      if (!low && f.index === 3) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * 6.283;
          const d = w * 0.6 + f.k * 70;
          puff(g, cx + Math.cos(a) * d, (box.top + feet) / 2 + Math.sin(a) * d * 0.7, PX * 1.5 * (1 - f.k * 0.5), 1 - f.k);
        }
      }
    }
    return;
  }
  // Z: el Cristal Z sube sobre la cabeza, gira y lanza rayos en X; al liberarse, columna de luz del tipo
  const zy = box.top - 24 - Math.min(1, f.build * 2) * 18 + Math.sin(t / 120) * 2;
  if (f.index >= 1 && f.index <= 3) {
    const a = f.index === 3 ? 1 - f.k : Math.min(1, f.k * 3 + (f.index > 1 ? 1 : 0));
    const wv = Math.abs(Math.cos(t / 140)) * PX * 2.5 + PX;
    for (let dy = -PX * 3; dy <= PX * 3; dy += PX) {
      const half = Math.max(PX / 2, wv * (1 - Math.abs(dy) / (PX * 4)));
      g.fillStyle(OUT, a).fillRect(snapTo(cx - half, 2) - 2, zy + dy - 2, half * 2 + 4, PX + 4);
      g.fillStyle(dy < 0 ? light : color, a).fillRect(snapTo(cx - half, 2), zy + dy, half * 2, PX);
    }
    // rayos de energía que convergen en el cristal
    if (f.index === 2) {
      for (let i = 0; i < (low ? 4 : 8); i++) {
        const ang = (i / 8) * 6.283 + t * 0.002;
        const r0 = 30 + (1 - f.k) * 70;
        for (let d = r0; d > 10; d -= PX * 2) px(g, cx + Math.cos(ang) * d, zy + Math.sin(ang) * d * 0.8, i % 2 ? 0xffffff : light, 0.8 * f.k + 0.2);
      }
    }
  }
  if (f.index === 3 || (f.index === 4 && f.k < 0.4)) {
    const a = f.index === 3 ? 1 : 1 - f.k / 0.4;
    const cw = PX * (low ? 6 : 10) + Math.abs(Math.sin(t / 50)) * PX * 2;
    for (let yy = feet; yy > feet - 300; yy -= PX) {
      const wob = Math.sin(yy * 0.15 + t * 0.03) * PX;
      g.fillStyle(yy % (PX * 4) === 0 ? 0xffffff : light, a * 0.55 * (1 - (feet - yy) / 320)).fillRect(snapTo(cx + wob, PX) - cw / 2, snapTo(yy, PX) - PX / 2, cw, PX);
    }
    // rayos en X desde el cristal
    const len = (f.index === 3 ? f.k : 1) * 150;
    for (const dir of [-1, 1]) {
      for (let d = 0; d < len; d += PX) {
        px(g, cx + dir * d, zy + d * 0.9, 0xffffff, a * 0.8);
        px(g, cx + dir * d, zy - d * 0.9 + 4, color, a * 0.8);
      }
    }
  }
}

/** Aro de píxeles al ras del suelo (perspectiva) de radio r. */
function ring(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, _k: number, color: number, low: boolean, a = 1) {
  if (a <= 0) return;
  const m = Math.round((r * 6.283) / PX / (low ? 2 : 1));
  for (let i = 0; i < m; i++) {
    const ang = (i / m) * 6.283;
    const c = i % 5 === 0 ? 0xffffff : i % 2 ? lightOf(color) : color;
    px(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.42, c, a);
  }
}
