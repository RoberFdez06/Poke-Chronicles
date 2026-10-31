// Arte de los Pokémon oscuros: aura morada y negra a los pies, humo oscuro que sube y destellos morados alrededor;
// el estallido al aparecer y el humo de su intro. Píxel gordo y redibujado a saltos, como formsFx y megaFx.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { DARK_COLORS, eyeFacing, eyeSpots } from '../../data/darkMon';
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
  const stopEyes = darkEyes(scene, s);
  const stop = () => {
    if (!alive) return;
    alive = false;
    stopEyes();
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

/** Caja de píxeles opacos de cada cuadro (en fracciones 0..1), con la anchura de la cabeza (parte de arriba). */
const boxCache = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
const FALLBACK_BOX = { x0: 0.25, y0: 0.2, x1: 0.75, y1: 0.9 };

function opaqueBox(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite) {
  const key = s.texture.key;
  const fr = s.frame;
  const id = `${key}|${fr.name}`;
  const hit = boxCache.get(id);
  if (hit) return hit;
  const N = 24;
  const w = fr.width;
  const h = fr.height;
  const op: boolean[][] = [];
  let y0 = N, y1 = -1;
  for (let j = 0; j < N; j++) {
    op[j] = [];
    for (let i = 0; i < N; i++) {
      const a = scene.textures.getPixelAlpha(Math.floor(((i + 0.5) / N) * w), Math.floor(((j + 0.5) / N) * h), key, fr.name);
      const on = (a ?? 0) > 60;
      op[j][i] = on;
      if (on) { y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
    }
  }
  let box = FALLBACK_BOX;
  if (y1 >= y0) {
    // anchura de la cabeza: columnas opacas en el 35 % de arriba de la figura
    const top = y0 + Math.max(1, Math.round((y1 - y0 + 1) * 0.35));
    let x0 = N, x1 = -1;
    for (let j = y0; j < top; j++) for (let i = 0; i < N; i++) if (op[j][i]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); }
    if (x1 >= x0) box = { x0: x0 / N, y0: y0 / N, x1: (x1 + 1) / N, y1: (y1 + 1) / N };
  }
  boxCache.set(id, box);
  return box;
}

/**
 * Ojos rojos brillantes de un Pokémon oscuro: dos puntos de píxel rojo con un halo que late, dibujados justo antes de
 * pintar (tras la animación y la pose de locoAnim), con la transformación real del sprite (giro, escala, volteo,
 * elevación), así que no se desfasan. De espaldas no se ven. Devuelve la función para quitarlos.
 */
export function darkEyes(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite): () => void {
  const g = scene.add.graphics();
  let alive = true;
  const stop = () => {
    if (!alive) return;
    alive = false;
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, draw);
    g.destroy();
  };
  const draw = () => {
    if (!s.active) return stop();
    g.clear();
    if (!s.visible || s.alpha < 0.05) return;
    const row = s.getData('pmd') ? (s.getData('row') as number | undefined) ?? 0 : undefined;
    const f = eyeFacing({ pmdRow: row, facing: s.getData('facing') as string | undefined, backTexture: s.texture.key.endsWith('-back'), flipX: s.flipX });
    const spots = eyeSpots(opaqueBox(scene, s), f.face, f.back);
    if (!spots) return;
    g.setDepth(s.depth + 0.02);
    const fw = s.frame.width;
    const fh = s.frame.height;
    const m = s.getWorldTransformMatrix();
    const t = scene.time.now;
    const pulse = 0.55 + 0.45 * Math.sin(t / 160);
    const size = Math.max(2, Math.round(s.displayHeight / 26));
    for (const u0 of spots.xs) {
      const u = s.flipX ? 1 - u0 : u0;
      const p = m.transformPoint(u * fw - s.displayOriginX, spots.y * fh - s.displayOriginY);
      const x = Math.round(p.x), y = Math.round(p.y);
      const halo = size * 2 + 2;
      g.fillStyle(0xff1a2e, 0.18 + 0.22 * pulse).fillRect(x - halo / 2, y - halo / 2, halo, halo);
      g.fillStyle(0xd0101e, 1).fillRect(x - size / 2 - 1, y - size / 2, size + 2, size);
      g.fillStyle(0xff3a48, 1).fillRect(x - size / 2, y - size / 2, size, size);
      g.fillStyle(0xffc0c0, 0.6 + 0.4 * pulse).fillRect(x - size / 2, y - size / 2, Math.max(1, size / 2), Math.max(1, size / 2));
    }
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, draw);
  scene.events.once('shutdown', stop);
  s.once(Phaser.GameObjects.Events.DESTROY, stop);
  return stop;
}
