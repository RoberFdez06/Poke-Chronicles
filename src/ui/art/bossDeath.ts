// Muertes de jefe (pedido por Roberto, 27/10). Jefe normal: columna de luz, ondas y escombros de su color encima del
// faintBoss de siempre (corta). Reto final: cámara lenta, la cámara se acerca, destellos crecientes, rayos de luz que
// salen del cuerpo, una gran explosión de luz y el jefe se desintegra en píxeles que suben; después, el cartel de
// victoria con la recompensa. Con pocos efectos, versiones cortas y sin cámara.
import Phaser from 'phaser';
import { FONT } from '../theme';
import { GAME_VIEW } from '../layout';
import { animate, lightOf, pixBlast, pixDebris, pixFlash, pixRing, pixSpokes } from './pixelFx';
import { starBurst } from './combatFx';

/** Remate extra de un jefe normal (va con faintBoss, que ya hace la copia que tiembla y explota). */
export function bossDeathFlourish(sc: Phaser.Scene, x: number, y: number, size: number, color: number, low: boolean) {
  if (low) {
    pixFlash(sc, x, y, size * 0.6, 0xffffff, 200, 9);
    return;
  }
  sc.time.delayedCall(950, () => {
    pixRing(sc, x, y + size * 0.3, size * 1.4, color, 600, 9);
    pixRing(sc, x, y + size * 0.3, size * 0.9, 0xffffff, 420, 9);
    pixDebris(sc, x, y, color, 16, 1.6, 9);
    // Columna de luz que sube y se apaga
    animate(sc, 9.5, 700, (g, k) => {
      const a = 1 - k;
      const cw = size * 0.5 * (1 - k * 0.6);
      g.fillStyle(lightOf(color), 0.55 * a).fillRect(x - cw / 2, y - 900, cw, 900 + size * 0.3);
      g.fillStyle(0xffffff, 0.8 * a).fillRect(x - cw / 6, y - 900, cw / 3, 900 + size * 0.3);
    });
  });
}

export interface FinalDeathOpts {
  color: number;
  zoom: number;
  follow: Phaser.GameObjects.GameObject;
  low: boolean;
  onDone: () => void;
}

/** Duración de la muerte del reto final sin cartel (ms). */
export const finalDeathMs = (low: boolean) => (low ? 900 : 3000);

/** Muerte épica del reto final. `s` es el jefe real: se dibuja una copia y el real se puede destruir ya. */
export function finalBossDeath(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, o: FinalDeathOpts) {
  const gold = 0xffd34d;
  const c = o.color;
  const x = s.x;
  const y = s.y;
  const w = s.displayWidth;
  const h = s.displayHeight;
  const g = sc.add.sprite(x, y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setDepth(12);
  const cam = sc.cameras.main;
  if (o.low) {
    cam.flash(300, 255, 255, 255);
    pixBlast(sc, x, y, w * 0.8, gold, 10);
    sc.tweens.add({ targets: g, alpha: 0, duration: 700, onComplete: () => g.destroy() });
    sc.time.delayedCall(finalDeathMs(true), o.onDone);
    return;
  }
  // Cámara lenta (la física va a un tercio) y la cámara se acerca al jefe
  const world = (sc as unknown as { physics?: { world?: { timeScale: number } } }).physics?.world;
  if (world) world.timeScale = 3;
  sc.tweens.timeScale = 1;
  cam.stopFollow();
  cam.pan(x, y, 700, 'Sine.easeInOut', true);
  cam.zoomTo(o.zoom * 1.4, 900, 'Sine.easeInOut', true);
  // 1) Tiembla, parpadea y le salen rayos de luz cada vez más largos
  sc.tweens.add({ targets: g, x: x + 5, duration: 45, yoyo: true, repeat: 26 });
  for (let i = 0; i < 9; i++) {
    sc.time.delayedCall(120 + i * 160, () => {
      g.setTintFill(i % 2 ? 0xffffff : c);
      sc.time.delayedCall(70, () => g.active && g.clearTint());
      const px = x + Phaser.Math.Between(-w * 0.35, w * 0.35);
      const py = y + Phaser.Math.Between(-h * 0.35, h * 0.3);
      pixFlash(sc, px, py, 30 + i * 6, i % 2 ? gold : lightOf(c), 240, 13);
      starBurst(sc, px, py, i % 2 ? gold : c, 4, 1.1, 13);
      pixSpokes(sc, x, y, w * 0.3, w * (0.7 + i * 0.12), 8 + i, i % 2 ? 0xffffff : gold, 300, 11, i * 0.3);
      cam.shake(140, 0.004 + i * 0.0015);
      if (i % 3 === 2) cam.flash(120, 255, 240, 200);
    });
  }
  // Halo creciente detrás
  animate(sc, 11.5, 1600, (gg, k) => {
    const r = w * (0.4 + k * 0.9);
    gg.fillStyle(gold, 0.12 + 0.2 * k).fillCircle(x, y, r);
    gg.fillStyle(0xffffff, 0.1 + 0.3 * k).fillCircle(x, y, r * 0.5);
  });
  // 2) Explosión de luz y desintegración en píxeles que suben
  sc.time.delayedCall(1600, () => {
    cam.flash(500, 255, 255, 255);
    cam.shake(700, 0.02);
    pixBlast(sc, x, y, w * 1.4, gold, 13);
    pixRing(sc, x, y, w * 2.6, 0xffffff, 800, 13);
    pixRing(sc, x, y, w * 1.8, gold, 700, 13);
    pixDebris(sc, x, y, gold, 24, 2.2, 13);
    pixDebris(sc, x, y, c, 18, 1.8, 13);
    g.setTintFill(0xffffff);
    const bits = Array.from({ length: 70 }, (_, i) => ({
      x: x + (((i * 7919) % 101) / 101 - 0.5) * w * 0.8,
      y: y + (((i * 104729) % 97) / 97 - 0.5) * h * 0.8,
      vx: (((i * 31) % 13) - 6) * 6,
      vy: -40 - ((i * 17) % 11) * 14,
      col: i % 4 === 0 ? 0xffffff : i % 3 === 0 ? gold : i % 2 ? lightOf(c) : c,
      at: ((i * 13) % 9) * 60,
    }));
    sc.tweens.add({ targets: g, alpha: 0, scaleX: g.scaleX * 1.15, scaleY: g.scaleY * 1.15, duration: 900, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    animate(sc, 13.5, 1300, (gg, k, t) => {
      for (const b of bits) {
        const u = Math.max(0, t - b.at) / 1000;
        if (u <= 0) continue;
        const a = Math.max(0, 1 - u / 1.1);
        gg.fillStyle(b.col, a).fillRect(Math.round((b.x + b.vx * u) / 6) * 6, Math.round((b.y + b.vy * u - 60 * u * u) / 6) * 6, 6, 6);
      }
      void k;
    });
  });
  // 3) Se acaba la cámara lenta y la cámara vuelve
  sc.time.delayedCall(2500, () => {
    if (world) world.timeScale = 1;
    const f = o.follow as unknown as { x: number; y: number };
    cam.pan(f.x, f.y, 400, 'Sine.easeInOut', true);
    cam.zoomTo(o.zoom, 400, 'Sine.easeInOut', true);
    sc.time.delayedCall(420, () => cam.startFollow(o.follow, true, 0.12, 0.12));
  });
  sc.time.delayedCall(finalDeathMs(false), o.onDone);
  sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => world && (world.timeScale = 1));
}

/**
 * Cartel de victoria del reto final, en la capa del HUD: rótulo dorado enorme, a quién has vencido y los tickets
 * ganados, con lluvia de monedas y rayos girando detrás. Llama a `onDone` tras `ms`.
 */
export function finaleVictoryBanner(sc: Phaser.Scene, hud: <T extends Phaser.GameObjects.GameObject>(o: T) => T, o: { name: string; bonus: number; low: boolean; ms?: number; onDone: () => void }) {
  const V = GAME_VIEW;
  const cx = V.x + V.w / 2;
  const cy = V.y + V.h / 2 - 40;
  const gold = 0xffd34d;
  const ms = o.ms ?? (o.low ? 1600 : 3200);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(g: T): T => (objs.push(g), hud(g));
  const dim = keep(sc.add.rectangle(cx, V.y + V.h / 2, V.w, V.h, 0x000000, 0).setDepth(85));
  sc.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 400 });
  const rays = keep(sc.add.graphics().setDepth(86));
  const t0 = sc.time.now;
  const coins = Array.from({ length: 40 }, (_, i) => ({ x: V.x + ((i * 7919) % 1000) / 1000 * V.w, sp: 160 + ((i * 37) % 11) * 30, ph: ((i * 131) % 97) / 97 }));
  const paint = () => {
    const t = sc.time.now - t0;
    rays.clear();
    if (!o.low) {
      const rot = t / 2400;
      for (let k = 0; k < 16; k++) {
        const a1 = rot + (k / 16) * Math.PI * 2;
        const a2 = a1 + 0.12;
        const R = 900;
        rays.fillStyle(k % 2 ? gold : 0xfff0a0, 0.12).fillTriangle(cx, cy, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
      }
      // Lluvia de monedas pixel
      for (const c of coins) {
        const yy = V.y + ((t / 1000) * c.sp + c.ph * V.h) % V.h;
        const flip = Math.abs(Math.sin(t / 120 + c.ph * 9));
        const cw = Math.max(2, Math.round(12 * flip / 2) * 2);
        rays.fillStyle(0x8a6a10, 1).fillRect(c.x - cw / 2 - 2, yy - 2, cw + 4, 16);
        rays.fillStyle(gold, 1).fillRect(c.x - cw / 2, yy, cw, 12);
        rays.fillStyle(0xffffff, 0.8).fillRect(c.x - cw / 2, yy, Math.max(2, cw / 3), 4);
      }
    }
  };
  paint();
  const ev = sc.time.addEvent({ delay: 50, loop: true, callback: paint });
  const big = keep(sc.add.text(cx, cy - 40, '¡VICTORIA LEGENDARIA!', { fontFamily: FONT, fontSize: '96px', fontStyle: 'bold', color: '#ffe680' })
    .setOrigin(0.5).setStroke('#5a3a00', 14).setShadow(0, 8, '#000000', 0, true, true).setDepth(87));
  const sub = keep(sc.add.text(cx, cy + 50, `Has derrotado a ${o.name}`, { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setStroke('#101828', 8).setDepth(87));
  const prize = keep(sc.add.text(cx, cy + 120, `Recompensa del reto final: +${o.bonus} tickets`, { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#3a2400', 10).setDepth(87));
  if (!o.low) {
    big.setScale(0.2).setAlpha(0);
    sc.tweens.add({ targets: big, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: big, scale: 1.05, duration: 520, delay: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const [t, d] of [[sub, 300], [prize, 600]] as const) {
      t.setAlpha(0).setY(t.y + 30);
      sc.tweens.add({ targets: t, alpha: 1, y: t.y - 30, duration: 360, delay: d, ease: 'Cubic.easeOut' });
    }
    sc.time.delayedCall(600, () => sc.tweens.add({ targets: prize, scale: 1.12, duration: 140, yoyo: true, repeat: 2 }));
  }
  sc.time.delayedCall(ms, () => {
    ev.remove();
    objs.forEach((g) => g.destroy());
    o.onDone();
  });
}
