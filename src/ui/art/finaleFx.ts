// Arte de las fases del reto final (finalePhases.ts): Cruz del juicio (franjas marcadas en el suelo que estallan en
// columnas de luz), Nova desesperada (ondas de píxel gordo con el hueco seguro marcado), el jefe agotado (ventana de
// castigo) y el estallido del cambio de fase. Estilo píxel gordo, como el vórtice y el rayo. Con pocos efectos, versión
// estática y simple. Solo dibujo: el daño lo pone GameScene.
import Phaser from 'phaser';
import { FONT, lowFx } from '../theme';
import { evolveBurst, phaseShock, starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, mixColor, pixDebris, pixRing, pixSpokes } from './pixelFx';
import { JUDGMENT_BAND, type JudgmentPlan } from '../../data/finalePhases';

const OUT = 0x18202c;
const SAFE = 0x7dffb0;
const snap = (v: number) => Math.round(v / PX) * PX;
function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, size = PX) {
  g.fillStyle(c, a).fillRect(snap(x) - size / 2, snap(y) - size / 2, size, size);
}

type Rect = { x: number; y: number; w: number; h: number };
/** Rectángulos de las franjas en coordenadas de mundo. */
export function judgmentRects(x0: number, y0: number, w: number, h: number, plan: JudgmentPlan): Rect[] {
  return [
    ...plan.cols.map((c) => ({ x: x0 + c * JUDGMENT_BAND, y: y0, w: JUDGMENT_BAND, h })),
    ...plan.rows.map((r) => ({ x: x0, y: y0 + r * JUDGMENT_BAND, w, h: JUDGMENT_BAND })),
  ];
}

/** Dibuja el aviso de una franja con avance `k` (0-1): se va llenando desde los bordes hacia la línea central. */
function drawBandWarn(g: Phaser.GameObjects.Graphics, r: Rect, color: number, k: number, t: number) {
  const vertical = r.h > r.w;
  const light = lightOf(color);
  const blink = Math.floor(t / 120) % 2 === 0;
  g.fillStyle(color, 0.1 + 0.18 * k).fillRect(r.x, r.y, r.w, r.h);
  // Relleno que avanza desde los dos bordes: cuando se toca en el centro, estalla
  const fill = (vertical ? r.w : r.h) / 2 * k;
  g.fillStyle(darkOf(color), 0.35);
  if (vertical) {
    g.fillRect(r.x, r.y, fill, r.h).fillRect(r.x + r.w - fill, r.y, fill, r.h);
  } else {
    g.fillRect(r.x, r.y, r.w, fill).fillRect(r.x, r.y + r.h - fill, r.w, fill);
  }
  // Bordes de píxel gordo discontinuos que corren a lo largo de la franja
  const len = vertical ? r.h : r.w;
  for (let d = 0; d < len; d += PX) {
    if (Math.floor((d + t * 0.12) / (PX * 3)) % 2) continue;
    const c = blink && k > 0.7 ? 0xffffff : light;
    if (vertical) {
      dot(g, r.x + PX / 2, r.y + d, OUT, 0.6, PX + 4);
      dot(g, r.x + PX / 2, r.y + d, c, 0.95);
      dot(g, r.x + r.w - PX / 2, r.y + d, OUT, 0.6, PX + 4);
      dot(g, r.x + r.w - PX / 2, r.y + d, c, 0.95);
    } else {
      dot(g, r.x + d, r.y + PX / 2, OUT, 0.6, PX + 4);
      dot(g, r.x + d, r.y + PX / 2, c, 0.95);
      dot(g, r.x + d, r.y + r.h - PX / 2, OUT, 0.6, PX + 4);
      dot(g, r.x + d, r.y + r.h - PX / 2, c, 0.95);
    }
  }
  // Runas (cruces) a lo largo del centro que laten
  const step = JUDGMENT_BAND * 1.5;
  for (let d = step / 2; d < len; d += step) {
    const cx = vertical ? r.x + r.w / 2 : r.x + d;
    const cy = vertical ? r.y + d : r.y + r.h / 2;
    const s = 2 + Math.round(k * 2 + (blink ? 1 : 0));
    for (let i = -s; i <= s; i++) {
      dot(g, cx + i * PX, cy, i === 0 ? 0xffffff : light, 0.9);
      dot(g, cx, cy + i * PX, i === 0 ? 0xffffff : light, 0.9);
    }
  }
}

/**
 * Aviso de la Cruz del juicio: las franjas se marcan y se van llenando durante `ms`. Devuelve el objeto para
 * destruirlo (lo destruye solo al acabar). Con pocos efectos, franjas fijas con borde.
 */
export function judgmentWarn(sc: Phaser.Scene, rects: Rect[], color: number, ms: number, depth = 3) {
  if (lowFx()) {
    const g = sc.add.graphics().setDepth(depth);
    for (const r of rects) g.fillStyle(color, 0.25).fillRect(r.x, r.y, r.w, r.h).lineStyle(4, 0xffffff, 0.8).strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    sc.time.delayedCall(ms, () => g.destroy());
    return g;
  }
  return animate(sc, depth, ms, (g, k, t) => {
    for (const r of rects) drawBandWarn(g, r, color, k, t);
  }, 40);
}

/** Estallido de la Cruz del juicio: columnas de luz de píxel gordo que suben de cada franja, con trozos y destello. */
export function judgmentStrike(sc: Phaser.Scene, rects: Rect[], color: number, depth = 12) {
  if (lowFx()) {
    const g = sc.add.graphics().setDepth(depth);
    for (const r of rects) g.fillStyle(0xffffff, 0.8).fillRect(r.x, r.y, r.w, r.h);
    sc.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    return;
  }
  const light = lightOf(color);
  animate(sc, depth, 420, (g, k, t) => {
    const a = 1 - Phaser.Math.Easing.Cubic.In(k);
    for (const r of rects) {
      const vertical = r.h > r.w;
      const w = (vertical ? r.w : r.h) * (1 - k * 0.5);
      const len = vertical ? r.h : r.w;
      for (let d = 0; d < len; d += PX) {
        const wob = Math.sin(d * 0.08 + t * 0.05) * PX;
        for (let o = -w / 2; o <= w / 2; o += PX) {
          const f = Math.abs(o) / (w / 2);
          const c = f > 0.85 ? darkOf(color) : f > 0.55 ? color : f > 0.25 ? light : 0xffffff;
          const x = vertical ? r.x + r.w / 2 + o + wob * 0.5 : r.x + d;
          const y = vertical ? r.y + d : r.y + r.h / 2 + o + wob * 0.5;
          dot(g, x, y, c, a);
        }
      }
    }
  }, 40);
  for (const r of rects) {
    const vertical = r.h > r.w;
    const n = Math.max(2, Math.round((vertical ? r.h : r.w) / 160));
    for (let i = 0; i < n; i++) {
      const x = vertical ? r.x + r.w / 2 : r.x + ((i + 0.5) / n) * r.w;
      const y = vertical ? r.y + ((i + 0.5) / n) * r.h : r.y + r.h / 2;
      pixDebris(sc, x, y, color, 5, 0.8, depth + 1);
    }
  }
}

/**
 * Onda de la Nova desesperada (un fotograma): anillo de píxel gordo del color del jefe con borde blanco y, en el hueco,
 * los dos extremos marcados en verde (por ahí se pasa).
 */
export function drawNovaWave(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, gapAt: number, gap: number, color: number, t: number) {
  if (lowFx()) {
    g.lineStyle(16, color, 0.85).beginPath().arc(cx, cy, r, gapAt + gap / 2, gapAt - gap / 2 + Math.PI * 2).strokePath();
    g.lineStyle(4, 0xffffff, 0.8).beginPath().arc(cx, cy, r, gapAt + gap / 2, gapAt - gap / 2 + Math.PI * 2).strokePath();
    return;
  }
  const light = lightOf(color);
  const dark = darkOf(color);
  const step = (PX * 0.9) / Math.max(r, 20);
  const from = gapAt + gap / 2;
  const span = Math.PI * 2 - gap;
  for (let s = 0; s <= span; s += step) {
    const a = from + s;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const flick = Math.sin(a * 9 + t * 0.02) > 0.6;
    dot(g, cx + ca * (r + PX), cy + sa * (r + PX), dark, 0.9, PX + 4);
    dot(g, cx + ca * r, cy + sa * r, flick ? 0xffffff : light, 1);
    dot(g, cx + ca * (r - PX), cy + sa * (r - PX), color, 0.95);
    dot(g, cx + ca * (r - PX * 2), cy + sa * (r - PX * 2), color, 0.45);
  }
  // Extremos del hueco: tres píxeles verdes que parpadean
  for (const a of [gapAt - gap / 2, gapAt + gap / 2]) {
    for (let i = -1; i <= 1; i++) dot(g, cx + Math.cos(a) * (r + i * PX), cy + Math.sin(a) * (r + i * PX), Math.floor(t / 100) % 2 ? SAFE : 0xffffff, 1);
  }
}

/**
 * Aviso de la Nova: el jefe concentra energía (anillo que se cierra) y unas flechas verdes en el suelo señalan por dónde
 * pasará el hueco de la primera onda y hacia dónde girará. Devuelve el objeto (se destruye solo).
 */
export function novaWarn(sc: Phaser.Scene, x: number, y: number, gapAt: number, dir: 1 | -1, color: number, ms: number, depth = 4) {
  if (lowFx()) {
    const g = sc.add.graphics().setDepth(depth);
    g.lineStyle(6, SAFE, 0.9).beginPath().arc(x, y, 90, gapAt - 0.4, gapAt + 0.4).strokePath();
    g.lineStyle(4, color, 0.8).strokeCircle(x, y, 60);
    sc.time.delayedCall(ms, () => g.destroy());
    return g;
  }
  const light = lightOf(color);
  return animate(sc, depth, ms, (g, k, t) => {
    // Anillo que se cierra sobre el jefe
    const r = 150 - 110 * Phaser.Math.Easing.Cubic.In(k);
    const step = (PX * 0.9) / r;
    for (let a = 0; a < Math.PI * 2; a += step) {
      if (Math.floor((a + t * 0.004) / 0.3) % 2) continue;
      dot(g, x + Math.cos(a) * r, y + Math.sin(a) * r, k > 0.7 && Math.floor(t / 80) % 2 ? 0xffffff : light, 0.9);
    }
    // Cuña verde en el suelo por donde pasará el hueco (y una flecha curva hacia donde girará)
    for (let rr = 60; rr < 200; rr += PX) {
      const half = 0.6 * (1 - (rr - 60) / 400);
      for (let a = -half; a <= half; a += PX / rr) dot(g, x + Math.cos(gapAt + a) * rr, y + Math.sin(gapAt + a) * rr, SAFE, 0.12 + 0.1 * k);
    }
    for (let s = 0; s < 0.8; s += PX / 190) {
      const a = gapAt + dir * s;
      dot(g, x + Math.cos(a) * 190, y + Math.sin(a) * 190, OUT, 0.7, PX + 4);
      dot(g, x + Math.cos(a) * 190, y + Math.sin(a) * 190, SAFE, 0.95);
    }
    {
      const a = gapAt + dir * 0.8;
      const tx = x + Math.cos(a) * 190;
      const ty = y + Math.sin(a) * 190;
      const fx = -Math.sin(a) * dir;
      const fy = Math.cos(a) * dir;
      for (let j = 0; j < 4; j++) for (let w = -j; w <= j; w++) dot(g, tx + fx * (3 - j) * PX + Math.cos(a) * w * PX, ty + fy * (3 - j) * PX + Math.sin(a) * w * PX, j === 0 ? 0xffffff : SAFE, 1);
    }
    // Chevrones verdes que salen hacia fuera por el hueco
    for (let i = 0; i < 4; i++) {
      const rr = 70 + ((i * 40 + t * 0.12) % 160);
      const ca = Math.cos(gapAt);
      const sa = Math.sin(gapAt);
      const fade = 0.4 + 0.6 * (1 - (rr - 70) / 160);
      for (let j = -3; j <= 3; j++) {
        const back = Math.abs(j) * PX;
        dot(g, x + ca * (rr - back) - sa * j * PX, y + sa * (rr - back) + ca * j * PX, OUT, fade * 0.6, PX + 4);
        dot(g, x + ca * (rr - back) - sa * j * PX, y + sa * (rr - back) + ca * j * PX, j === 0 ? 0xffffff : SAFE, fade);
      }
    }
    // Brillo central que crece
    const core = 6 + k * 18;
    for (let yy = -core; yy <= core; yy += PX) {
      const half = Math.sqrt(Math.max(0, core * core - yy * yy));
      g.fillStyle(mixColor(color, 0xffffff, 0.5 + k * 0.5), 0.5 + k * 0.4).fillRect(snap(x - half), snap(y + yy), snap(half * 2) || PX, PX);
    }
  }, 40);
}

/**
 * Jefe agotado (ventana de castigo): estrellas de píxel girando sobre su cabeza, gotas de sudor y un «¡Agotado!» que
 * late. Sigue al jefe y se quita sola a los `ms` (o si el jefe desaparece).
 */
export function exhaustedFx(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, ms: number, depth = 14) {
  const label = sc.add.text(s.x, s.y - s.displayHeight * 0.75, '¡Agotado!', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#fff6a8' })
    .setOrigin(0.5).setStroke('#18202c', 6).setDepth(depth + 1);
  if (lowFx()) {
    sc.time.delayedCall(ms, () => label.destroy());
    return;
  }
  sc.tweens.add({ targets: label, scale: 1.15, yoyo: true, repeat: -1, duration: 260 });
  animate(sc, depth, ms, (g, _k, t) => {
    if (!s.active) return;
    const hx = s.x;
    const hy = s.y - s.displayHeight * 0.5;
    label.setPosition(hx, hy - 34);
    const rw = s.displayWidth * 0.32;
    for (let i = 0; i < 4; i++) {
      const a = t * 0.006 + (i / 4) * Math.PI * 2;
      const px = hx + Math.cos(a) * rw;
      const py = hy + Math.sin(a) * rw * 0.3;
      const c = i % 2 ? 0xffe066 : 0xffffff;
      dot(g, px, py, OUT, 0.8, PX + 4);
      dot(g, px, py, c, 1);
      dot(g, px - PX, py, c, 0.9);
      dot(g, px + PX, py, c, 0.9);
      dot(g, px, py - PX, c, 0.9);
      dot(g, px, py + PX, c, 0.9);
    }
    // Gotas de sudor que caen a los lados
    for (let i = 0; i < 2; i++) {
      const ph = ((t * 0.0015 + i * 0.5) % 1);
      const sx = hx + (i ? 1 : -1) * s.displayWidth * 0.38;
      const sy = hy + ph * 36;
      dot(g, sx, sy, 0x7ec8ff, 1 - ph);
      dot(g, sx, sy - PX, 0xffffff, 1 - ph);
    }
  }, 50);
  sc.time.delayedCall(ms, () => {
    sc.tweens.killTweensOf(label);
    label.destroy();
  });
}

/**
 * Cambio de fase del jefe final: estallido de evolución, onda de su color, rayos que salen y un número romano grande
 * con la fase que aparece y se va. Con pocos efectos, solo la onda.
 */
export function finaleShiftFx(sc: Phaser.Scene, x: number, y: number, feetY: number, color: number, phase: number, depth = 14) {
  phaseShock(sc, x, feetY, color, 1.4);
  if (lowFx()) return;
  evolveBurst(sc, x, y, feetY);
  pixRing(sc, x, feetY, 320, color, 600, 7);
  pixSpokes(sc, x, y, 40, 260, 12, color, 420, depth, Math.random());
  starBurst(sc, x, y - 30, lightOf(color), 8, 1.3, depth + 1);
  const roman = ['I', 'II', 'III', 'IV'][phase - 1] ?? '';
  const t = sc.add.text(x, y - 10, roman, { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0.5).setStroke('#' + darkOf(color).toString(16).padStart(6, '0'), 10).setDepth(depth + 2).setScale(0.3).setAlpha(0);
  sc.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: t, alpha: 0, y: y - 60, delay: 650, duration: 350, onComplete: () => t.destroy() });
}
