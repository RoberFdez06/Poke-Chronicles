// Arte de los Pokémon oscuros: aura morada y negra a los pies, humo oscuro que sube y destellos morados alrededor;
// el estallido al aparecer y el humo de su intro. Píxel gordo y redibujado a saltos, como formsFx y megaFx.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { DARK_COLORS } from '../../data/darkMon';
import { PX, animate, mixColor, pixRing } from './pixelFx';

const snap = (v: number, s = PX) => Math.round(v / s) * s;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x, s) - s / 2, snap(y, s) - s / 2, s, s);

/** Óvalo de píxeles relleno (sombra oscura a los pies). */
function oval(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number, c: number, a: number) {
  for (let yy = -ry; yy <= ry; yy += PX) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry)));
    const w = Math.max(PX, snap(half * 2));
    g.fillStyle(c, a).fillRect(snap(x) - w / 2, snap(y + yy) - PX / 2, w, PX);
  }
}

/**
 * Aura oscura permanente: sombra morada que late a los pies, humo negro y morado que sube por los lados y chispas
 * moradas. Sigue al sprite y se borra sola cuando el sprite deja de estar activo. Devuelve la función para quitarla.
 * Con pocos efectos solo queda la sombra (sin humo).
 */
export function darkAura(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, feet: () => number): () => void {
  const g = scene.add.graphics();
  let at = 0;
  let alive = true;
  const stop = () => {
    if (!alive) return;
    alive = false;
    scene.events.off('update', tick);
    g.destroy();
  };
  const tick = (time: number) => {
    if (!s.active) return stop();
    g.setDepth(s.depth - 0.05);
    if (time - at < 80) return;
    at = time;
    g.clear();
    const fy = feet();
    const half = Math.max(22, s.displayWidth / 2);
    const hgt = Math.max(36, s.displayHeight);
    const pulse = 1 + 0.08 * Math.sin(time / 180);
    oval(g, s.x, fy, half * 1.15 * pulse, half * 0.36 * pulse, DARK_COLORS.deep, 0.55);
    oval(g, s.x, fy, half * 0.85 * pulse, half * 0.24 * pulse, DARK_COLORS.aura, 0.4);
    if (lowFx()) return;
    // humo que sube por los lados y se deshace
    for (let i = 0; i < 9; i++) {
      const ph = (time * 0.0005 + i * 0.113) % 1;
      const side = i % 2 ? 1 : -1;
      const sx = s.x + side * half * (0.45 + 0.35 * Math.sin(i * 1.7)) + Math.sin(time / 350 + i) * 5;
      const sz = PX * (1 + Math.round(ph * 2));
      px(g, sx, fy - 6 - ph * hgt, mixColor(DARK_COLORS.deep, DARK_COLORS.aura, ph), 0.8 * (1 - ph), sz);
    }
    // chispas moradas que orbitan
    for (let i = 0; i < 4; i++) {
      const ang = time * 0.003 + (i / 4) * 6.283;
      px(g, s.x + Math.cos(ang) * half * 0.9, fy - hgt * 0.5 + Math.sin(ang) * hgt * 0.35, i % 2 ? DARK_COLORS.glow : 0xffffff, 0.85, PX - 2);
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', stop);
  return stop;
}

/** Estallido al aparecer uno oscuro: anillo morado, humo que se expande y un destello negro. */
export function darkBurst(scene: Phaser.Scene, x: number, y: number, depth = 12): void {
  pixRing(scene, x, y + 10, 90, DARK_COLORS.aura, 520, depth);
  if (lowFx()) return;
  animate(scene, depth, 700, (g, k) => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283;
      const r = 20 + k * 70;
      px(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, i % 3 ? DARK_COLORS.deep : DARK_COLORS.glow, 1 - k, PX * (2 - k));
    }
  }, 60);
}

/** Humo oscuro de la intro de un jefe oscuro: bloques morados y negros que giran y suben alrededor de (x, y). */
export function darkIntroSmoke(scene: Phaser.Scene, x: number, y: number, r: number, ms: number): void {
  if (lowFx()) return;
  animate(scene, 2.5, ms, (g, k, t) => {
    const fade = k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
    for (let i = 0; i < 22; i++) {
      const ph = (t * 0.0004 + i * 0.07) % 1;
      const a = (i / 22) * 6.283 + t * 0.0012;
      const rr = r * (0.7 + 0.3 * Math.sin(i * 2.3));
      px(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6 - ph * 60, i % 3 ? DARK_COLORS.deep : DARK_COLORS.aura, 0.75 * fade * (1 - ph * 0.6), PX * 2);
    }
    for (let i = 0; i < 6; i++) {
      const a = t * 0.004 + (i / 6) * 6.283;
      px(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.4, DARK_COLORS.glow, fade, PX);
    }
  }, 70);
}

/** Marca de «oscuro» para fichas y Pokédex: llama morada con contorno negro y un brillo, en píxel de `s` px. */
export function drawDarkMark(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 3) {
  const rows = ['...k...', '..kPk..', '..kPPk.', '.kPLPk.', 'kPPLPPk', 'kPDDDPk', 'kDDDDDk', '.kDDDk.', '..kkk..'];
  const col: Record<string, number> = { k: 0x120820, P: DARK_COLORS.aura, L: DARK_COLORS.glow, D: DARK_COLORS.deep };
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const c = col[r[i]];
      if (c === undefined) continue;
      g.fillStyle(c, 1).fillRect(Math.round(x + (i - r.length / 2) * s), Math.round(y + (j - rows.length / 2) * s), s, s);
    }
  });
}
