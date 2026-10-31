// Arte pixel del parry y de la esquiva: escudo del tipo del jugador mientras la ventana del parry está abierta,
// estallido al acertar (destello, anillo y partículas; más grande si es perfecto), marca de aviso sobre lo que va a
// golpear y estela de la esquiva. Solo dibujo (coordenadas del mundo); con lowFx() todo sale en versión simple.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf, PX } from './pixelFx';

const INK = 0x18202c;
const snap = (v: number) => Math.round(v / 3) * 3;

/** Cuadrado pixel con contorno. */
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, size = PX) {
  const sx = snap(x);
  const sy = snap(y);
  g.fillStyle(INK, a).fillRect(sx - size / 2 - 2, sy - size / 2 - 2, size + 4, size + 4);
  g.fillStyle(c, a).fillRect(sx - size / 2, sy - size / 2, size, size);
}

/**
 * Escudo mientras la ventana del parry está abierta: un hexágono de píxeles del color del tipo alrededor del jugador,
 * con brillo blanco que gira; se apaga al final de la ventana. Sigue al jugador. Devuelve el dibujo (para quitarlo).
 */
export function parryShield(scene: Phaser.Scene, follow: Phaser.GameObjects.Sprite, color: number, ms: number, depth = 9): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const t0 = scene.time.now;
  const light = lightOf(color);
  const simple = lowFx();
  const draw = () => {
    if (!g.active) return ev.remove();
    const k = Math.min(1, (scene.time.now - t0) / ms);
    g.clear();
    if (k >= 1 || !follow.active) {
      ev.remove();
      g.destroy();
      return;
    }
    const x = follow.x;
    const y = follow.y;
    const a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, k - 0.7) / 0.3;
    const r = 44 + (k < 0.15 ? (1 - k / 0.15) * 10 : 0);
    if (simple) {
      g.lineStyle(4, color, 0.8 * a).strokeCircle(x, y, r);
      return;
    }
    // Relleno translúcido y borde de píxeles (hexágono achatado), con un píxel blanco que da la vuelta
    g.fillStyle(color, 0.14 * a).fillCircle(x, y, r);
    const n = 18;
    const spin = Math.floor((scene.time.now - t0) / 40) % n;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const hex = 1 - 0.08 * Math.abs(Math.cos(ang * 3));
      const c = i === spin || i === (spin + n / 2) % n ? 0xffffff : i % 2 ? light : color;
      px(g, x + Math.cos(ang) * r * hex, y + Math.sin(ang) * r * hex * 0.85, c, a, 6);
    }
  };
  const ev = scene.time.addEvent({ delay: 30, loop: true, callback: draw });
  draw();
  return g;
}

/**
 * Parry acertado: destello blanco, anillo de píxeles del color del tipo que se abre y partículas que saltan.
 * Perfecto: anillo doble, más partículas y más grandes, y un destello de estrellas.
 */
export function parryBurst(scene: Phaser.Scene, x: number, y: number, color: number, perfect: boolean, depth = 12) {
  const g = scene.add.graphics().setDepth(depth);
  const t0 = scene.time.now;
  const ms = perfect ? 560 : 420;
  const light = lightOf(color);
  const dark = darkOf(color);
  const simple = lowFx();
  const parts = Array.from({ length: simple ? 0 : perfect ? 20 : 11 }, (_, i) => ({
    a: (i / (perfect ? 20 : 11)) * Math.PI * 2 + (i % 2) * 0.2,
    v: (perfect ? 120 : 80) + (i % 3) * 26,
    s: perfect ? (i % 3 === 0 ? 12 : 8) : 6,
    c: i % 3 === 0 ? 0xffffff : i % 3 === 1 ? light : color,
  }));
  const tick = () => {
    const k = Math.min(1, (scene.time.now - t0) / ms);
    g.clear();
    const e = 1 - (1 - k) * (1 - k);
    // Destello del centro (cuadrado pixel que se encoge)
    const f = (perfect ? 46 : 32) * (1 - k);
    if (f > 2) g.fillStyle(0xffffff, 0.9 * (1 - k)).fillRect(snap(x - f / 2), snap(y - f / 2), snap(f), snap(f));
    const rings = simple ? [1] : perfect ? [1, 0.6] : [1];
    for (const m of rings) {
      const r = (perfect ? 90 : 64) * e * m;
      const step = Math.max(0.12, 8 / Math.max(r, 10));
      for (let t = 0; t < Math.PI * 2; t += step) {
        const rx = x + Math.cos(t) * r;
        const ry = y + Math.sin(t) * r * 0.75;
        if (simple) g.fillStyle(color, 1 - k).fillRect(snap(rx) - 3, snap(ry) - 3, 6, 6);
        else px(g, rx, ry, (t * 5) % 2 < 1 ? 0xffffff : m < 1 ? dark : color, 1 - k, 6);
      }
    }
    for (const p of parts) {
      const d = p.v * e;
      const s = k > 0.6 ? p.s * 0.6 : p.s;
      px(g, x + Math.cos(p.a) * d, y + Math.sin(p.a) * d * 0.8 - 30 * k * k, p.c, 1 - k, s);
    }
    if (k >= 1) {
      ev.remove();
      g.destroy();
    }
  };
  const ev = scene.time.addEvent({ delay: 30, loop: true, callback: tick });
  tick();
}

/**
 * Marca de aviso sobre algo que te va a golpear: rombo pixel con «!». `now`: ya está en la ventana del parry (blanco,
 * más grande y late); si no, amarillo («prepárate»). Se dibuja en un Graphics que se limpia cada fotograma.
 */
export function threatMark(g: Phaser.GameObjects.Graphics, x: number, y: number, now: boolean, t: number) {
  const beat = now && Math.floor(t / 90) % 2 === 0;
  const u = now ? (beat ? 4 : 3) : 3;
  const cx = snap(x);
  const cy = snap(y);
  const fill = now ? 0xffffff : 0xffd34d;
  if (lowFx()) {
    g.fillStyle(INK, 1).fillRect(cx - 2 * u - 2, cy - 2 * u - 2, 4 * u + 4, 4 * u + 4);
    g.fillStyle(fill, 1).fillRect(cx - 2 * u, cy - 2 * u, 4 * u, 4 * u);
    return;
  }
  // Rombo de 5 filas con contorno
  const rows = [1, 3, 5, 3, 1];
  rows.forEach((w, i) => g.fillStyle(INK, 1).fillRect(cx - (w * u) / 2 - 2, cy + (i - 2.5) * u - 2, w * u + 4, u + 4));
  rows.forEach((w, i) => g.fillStyle(fill, 1).fillRect(cx - (w * u) / 2, cy + (i - 2.5) * u, w * u, u));
  // «!»
  g.fillStyle(INK, 1).fillRect(cx - u / 2, cy - 2 * u, u, 2 * u).fillRect(cx - u / 2, cy + u / 2, u, u * 0.8);
}

/** Polvo al empezar la esquiva, hacia atrás (dx, dy). */
export function dashPuff(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, color: number, depth = 6) {
  const g = scene.add.graphics().setDepth(depth);
  const t0 = scene.time.now;
  const n = lowFx() ? 3 : 7;
  const parts = Array.from({ length: n }, (_, i) => ({ a: Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.35, v: 40 + (i % 2) * 22 }));
  const ev = scene.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      const k = Math.min(1, (scene.time.now - t0) / 300);
      g.clear();
      for (const p of parts) px(g, x + Math.cos(p.a) * p.v * k, y + 18 + Math.sin(p.a) * p.v * k * 0.6, k < 0.4 ? 0xffffff : lightOf(color), 1 - k, k < 0.5 ? 6 : 3);
      if (k >= 1) {
        ev.remove();
        g.destroy();
      }
    },
  });
}

/** Imagen del jugador que se queda atrás y se apaga (estela de la esquiva), teñida de su color, y una chispa pixel. */
export function dashTrail(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, color: number, depth = 4) {
  const ghost = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setOrigin(s.originX, s.originY);
  ghost.setDepth(depth).setTintFill(lightOf(color)).setAlpha(0.55);
  scene.tweens.add({ targets: ghost, alpha: 0, duration: lowFx() ? 140 : 220, onComplete: () => ghost.destroy() });
  if (lowFx()) return;
  const sp = scene.add.rectangle(snap(s.x + Phaser.Math.Between(-14, 14)), snap(s.y + Phaser.Math.Between(4, 22)), 6, 6, 0xffffff).setDepth(depth);
  scene.tweens.add({ targets: sp, alpha: 0, scale: 0.4, duration: 200, onComplete: () => sp.destroy() });
}

/**
 * Arranque de la esquiva: rayas de velocidad pixel a los lados del cuerpo, apuntando hacia atrás, y un destello
 * blanco que se estira en la dirección del impulso. Con lowFx, solo dos rayas.
 */
export function dashBurst(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, color: number, depth = 6) {
  const g = scene.add.graphics().setDepth(depth);
  const t0 = scene.time.now;
  const nx = -dy;
  const ny = dx;
  const offs = lowFx() ? [-14, 14] : [-22, -10, 2, 14, 26];
  const light = lightOf(color);
  const ev = scene.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      const k = Math.min(1, (scene.time.now - t0) / 260);
      g.clear();
      offs.forEach((o, i) => {
        const len = 34 + (i % 2) * 18;
        const back = 10 + k * 46;
        for (let s = 0; s < len; s += PX * 2) {
          const d = back + s;
          px(g, x + nx * o - dx * d, y + 8 + ny * o - dy * d, s < 10 ? 0xffffff : light, (1 - k) * (1 - s / (len + 8)), PX);
        }
      });
      if (!lowFx() && k < 0.5) for (let s = 0; s < 4; s++) px(g, x + dx * (12 + s * 7), y + 8 + dy * (12 + s * 7), 0xffffff, 1 - k * 2, PX + 2);
      if (k >= 1) {
        ev.remove();
        g.destroy();
      }
    },
  });
}

/** Chispas pixel que salen hacia atrás mientras dura la esquiva. */
export function dashSparks(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, color: number, depth = 5) {
  const light = lightOf(color);
  for (let i = 0; i < 2; i++) {
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.1;
    const v = 18 + Math.random() * 22;
    const sp = scene.add
      .rectangle(snap(x + Phaser.Math.Between(-10, 10)), snap(y + Phaser.Math.Between(-4, 20)), 4, 4, i ? light : 0xffffff)
      .setDepth(depth);
    scene.tweens.add({ targets: sp, x: sp.x + Math.cos(a) * v, y: sp.y + Math.sin(a) * v, alpha: 0, duration: 240, onComplete: () => sp.destroy() });
  }
}
