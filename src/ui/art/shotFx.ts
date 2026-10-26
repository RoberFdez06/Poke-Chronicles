// Arte del ataque cargado (supervisor): el brillo de carga (orbe del tipo que crece delante del jugador y absorbe
// chispas) y el disparo cargado (halo de energía, cola de cometa y, con fuego, un rastro de llamas que arde un
// momento). Mismo listón que los ataques de vórtice y rayo: píxel gordo, color del tipo, claro, oscuro y blanco.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { PX, animate, drawPixJet, drawPixOrb, lightOf, pixMuzzle, pixRing } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

const glows = new WeakMap<Phaser.Scene, Phaser.GameObjects.Graphics>();

/**
 * Brillo de carga; se llama cada fotograma con el mayor progreso (0-1). El orbe del tipo crece delante del jugador
 * (hacia `ang`), las chispas convergen en él y, completo, late en blanco con una estrella que gira. Con pocos efectos,
 * solo el orbe estático que crece.
 */
export function chargeGlow(scene: Phaser.Scene, x: number, y: number, ang: number, progress: number, color: number, depth = 6) {
  let g = glows.get(scene);
  if (!g || !g.scene) {
    g = scene.add.graphics();
    glows.set(scene, g);
  }
  g.clear().setDepth(depth);
  if (progress <= 0) return;
  const t = scene.time.now;
  const ox = x + Math.cos(ang) * 30;
  const oy = y + Math.sin(ang) * 30 - 4;
  const full = progress >= 1;
  const r = 5 + progress * 11;
  if (lowFx()) {
    drawPixOrb(g, ox, oy, r, full ? 0xffffff : color, 0, 0.9);
    return;
  }
  // chispas que caen hacia el orbe (más cuanto más carga)
  const n = 4 + Math.round(progress * 8);
  for (let i = 0; i < n; i++) {
    const ph = ((t * 0.0022 + i * 0.173) % 1);
    const a0 = i * 2.4 + Math.floor(i / 3);
    const d = (1 - ph) * (60 - progress * 10) + r;
    const sx = ox + Math.cos(a0 + ph * 1.5) * d;
    const sy = oy + Math.sin(a0 + ph * 1.5) * d * 0.8;
    px(g, sx, sy, OUT, 0.5 * ph, PX + 4);
    px(g, sx, sy, i % 3 ? lightOf(color) : 0xffffff, ph);
  }
  // aro de progreso alrededor del orbe
  const m = 16;
  for (let i = 0; i < m; i++) {
    if (i / m > progress) break;
    const aa = -Math.PI / 2 + (i / m) * 6.283;
    px(g, ox + Math.cos(aa) * (r + 12), oy + Math.sin(aa) * (r + 12), i % 2 ? color : lightOf(color), 0.9, PX - 2);
  }
  drawPixOrb(g, ox, oy, r, color, t);
  if (full) {
    // listo: late en blanco y una estrella de cuatro puntas gira
    const blink = Math.floor(t / 90) % 2 === 0;
    if (blink) drawPixOrb(g, ox, oy, r * 0.7, 0xffffff, t, 0.8);
    const sp = t * 0.006;
    for (let k = 0; k < 4; k++) {
      const aa = sp + (k * Math.PI) / 2;
      for (let d = r; d < r + 22; d += PX) px(g, ox + Math.cos(aa) * d, oy + Math.sin(aa) * d, d > r + 12 ? lightOf(color) : 0xffffff, 1 - (d - r) / 26);
    }
  }
}

/** Llama del rastro de fuego: lenguas que parpadean, encogen y sueltan humo (unos 700 ms). */
function flamePatch(scene: Phaser.Scene, x: number, y: number, size: number, depth: number) {
  const seed = Math.floor(Math.random() * 1000);
  animate(scene, depth, 700, (g, k, t) => {
    const fr = Math.floor(t / 70);
    const s = (1 - k * 0.7) * size;
    for (let i = -2; i <= 2; i++) {
      const hgt = s * (1.4 - Math.abs(i) * 0.3) * (0.8 + 0.25 * (((fr + i * 3 + seed) % 4) / 3));
      for (let d = 0; d < hgt; d += PX) {
        const f = d / hgt;
        const c = f < 0.3 ? 0xd8302a : f < 0.65 ? 0xff7f27 : f < 0.9 ? 0xffd34d : 0xfff6c0;
        px(g, x + i * PX + Math.sin(d * 0.2 + fr + i) * 2, y - d, c, 1 - k * 0.6);
      }
    }
    // brasas y humo
    if (k > 0.4) px(g, x + ((seed + fr) % 5 - 2) * PX, y - s * 1.8 - k * 20, 0x5a5a66, (1 - k) * 0.7, PX + 2);
    px(g, x + ((fr * 7 + seed) % 7 - 3) * PX, y - s - k * 30, 0xffe066, 1 - k);
  }, 70);
}

/**
 * Aspecto del disparo cargado: fogonazo y anillo al salir; mientras vuela, halo de energía que late, cola de cometa
 * hacia atrás y dos chispas que lo orbitan. `fireTrail` (el fuego): deja llamas que arden un momento por donde pasa.
 * Con pocos efectos, solo el fogonazo.
 */
export function chargedShotFx(scene: Phaser.Scene, shot: Phaser.Physics.Arcade.Sprite, color: number, fireTrail: boolean, depth = 4) {
  const ang0 = Math.atan2(shot.body?.velocity.y ?? 0, shot.body?.velocity.x ?? 1);
  pixMuzzle(scene, shot.x, shot.y, ang0, color, 1.8, depth + 2);
  if (lowFx()) return;
  pixRing(scene, shot.x, shot.y, 46, color, 280, depth + 1, 1);
  const g = scene.add.graphics().setDepth(depth - 0.1);
  let lastFlame = 0;
  const ev = scene.time.addEvent({
    delay: 50,
    loop: true,
    callback: () => {
      if (!shot.active) {
        ev.remove();
        g.destroy();
        return;
      }
      const t = scene.time.now;
      const v = shot.body?.velocity;
      const ang = v && (v.x || v.y) ? Math.atan2(v.y, v.x) : ang0;
      const r = Math.max(12, shot.displayWidth * 0.55);
      g.clear();
      // cola de cometa hacia atrás (se estrecha y se rompe al final)
      drawPixJet(g, shot.x, shot.y, ang + Math.PI, r * 5, r * 2.2, PX * 2, fireTrail ? 0xff7f27 : color, t, 0.85);
      drawPixOrb(g, shot.x, shot.y, r, color, t, 0.75);
      // dos chispas que orbitan el proyectil
      for (let k = 0; k < 2; k++) {
        const a = t * 0.015 + k * Math.PI;
        px(g, shot.x + Math.cos(a) * (r + 8), shot.y + Math.sin(a) * (r + 8), OUT, 0.6, PX + 4);
        px(g, shot.x + Math.cos(a) * (r + 8), shot.y + Math.sin(a) * (r + 8), k ? 0xffffff : lightOf(color), 1);
      }
      if (fireTrail && t - lastFlame > 90) {
        lastFlame = t;
        flamePatch(scene, shot.x - Math.cos(ang) * r, shot.y - Math.sin(ang) * r + r * 0.5, Math.max(PX * 3, r * 1.5), Math.max(1.7, depth - 1));
      }
    },
  });
}

