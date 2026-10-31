// Efectos pixel art de la tanda 9 (supervisor): captura con Poké Ball, megaevolución de jefes, noche y día.
// Mismo estilo que combatFx: píxel gordo (PX), redibujado a saltos. Solo dibujo; la lógica vive en src/data y GameScene.
import { fixedViewRect } from '../camView';
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, pixRing } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) =>
  g.fillStyle(c, a).fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);

/** Poké Ball de píxeles centrada en (x, y); `open` 0-1 separa las mitades (sale el destello). */
function ballShape(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, open = 0) {
  for (let dy = -r; dy <= r; dy += PX) {
    for (let dx = -r; dx <= r; dx += PX) {
      const d = Math.hypot(dx, dy);
      if (d > r + PX / 2) continue;
      const top = dy < -PX / 2;
      const band = Math.abs(dy) <= PX / 2;
      const rim = d > r - PX;
      const lift = open * PX * 2 * (top ? -1 : 1);
      let c = top ? 0xe53935 : 0xf5f5f5;
      if (band) c = OUT;
      else if (rim) c = top ? darkOf(0xe53935) : 0xbdbdbd;
      else if (dx < -r / 3 && dy < 0 && dy > -r + PX) c = lightOf(0xe53935);
      px(g, x + dx, y + dy + lift, c);
    }
  }
  // botón central
  px(g, x, y, OUT, 1, PX * 2);
  px(g, x, y, open > 0 ? 0xfff59d : 0xffffff, 1, PX);
}

/** La bola vuela del jugador al enemigo con arco. Devuelve la duración para encadenar el resto. */
export function ballThrow(scene: Phaser.Scene, from: { x: number; y: number }, to: { x: number; y: number }, depth = 10): number {
  const ms = lowFx() ? 250 : 420;
  animate(scene, depth, ms, (g, k) => {
    const x = Phaser.Math.Linear(from.x, to.x, k);
    const y = Phaser.Math.Linear(from.y, to.y, k) - Math.sin(k * Math.PI) * 54;
    ballShape(g, x, y, PX * 2);
    if (!lowFx()) for (let i = 1; i <= 3; i++) px(g, x - (to.x - from.x) * 0.04 * i, y + 4 * i, 0xffffff, 0.5 - i * 0.12);
  });
  return ms;
}

/** Bola en el suelo que se sacude `shakes` veces (cada sacudida, un destello rojo de un píxel). Devuelve la duración. */
export function ballShake(scene: Phaser.Scene, x: number, y: number, shakes = 3, depth = 10): number {
  const per = lowFx() ? 220 : 480;
  const ms = per * shakes;
  animate(scene, depth, ms, (g, k, t) => {
    const phase = (t % per) / per;
    const tilt = phase < 0.5 ? Math.sin(phase * Math.PI * 4) * PX : 0;
    ballShape(g, x + snap(tilt), y, PX * 2);
    if (phase > 0.55 && phase < 0.75 && !lowFx()) px(g, x, y - PX * 3, 0xff5252, 0.9);
  });
  return ms;
}

/** Captura lograda: destello, estrellas y anillo; la bola queda quieta un instante con un pixel dorado. */
export function ballSuccess(scene: Phaser.Scene, x: number, y: number, depth = 11) {
  animate(scene, depth, lowFx() ? 300 : 700, (g, k) => {
    ballShape(g, x, y, PX * 2);
    if (!lowFx()) px(g, x, y - PX * 3 - k * PX * 2, 0xffe066, 1 - k, PX + 2);
  });
  if (lowFx()) return;
  starBurst(scene, x, y - 8, 0xffe066, 6, 1.1, depth + 1);
  pixRing(scene, x, y, 54, 0xffe066, 420, depth);
}

/** La bola se abre y el enemigo se escapa: mitades separadas, destello blanco y humo. */
export function ballEscape(scene: Phaser.Scene, x: number, y: number, depth = 11) {
  animate(scene, depth, lowFx() ? 250 : 480, (g, k) => {
    ballShape(g, x, y, PX * 2, Math.min(1, k * 2));
    if (!lowFx()) {
      const r = k * 44;
      for (let t = 0; t < Math.PI * 2; t += Math.PI / 4) px(g, x + Math.cos(t) * r, y + Math.sin(t) * r * 0.7, 0xffffff, 1 - k);
    }
  });
}

/**
 * Megaevolución de un jefe: columna de luz, anillo doble, ráfaga de estrellas y aura que sube. `color` es el del jefe.
 * Dura ~1,5 s (lo que el jefe está quieto e invulnerable). Con pocos efectos, solo un anillo y un destello corto.
 */
export function megaEvolveFx(scene: Phaser.Scene, x: number, y: number, feetY: number, color: number, depth = 12): number {
  const ms = lowFx() ? 500 : 1500;
  const light = lightOf(color);
  animate(scene, depth, ms, (g, k, t) => {
    const w = (1 - Math.abs(k * 2 - 1)) * PX * 6 + PX * 2;
    if (!lowFx()) {
      for (let yy = feetY; yy > feetY - 220 * Math.min(1, k * 1.6); yy -= PX) {
        const wob = Math.sin(yy * 0.12 + t * 0.02) * PX;
        px(g, x + wob, yy, yy % 12 === 0 ? 0xffffff : light, 0.55 * (1 - k * 0.6), w);
      }
      // ADN de la mega: dos hélices de píxeles entrelazadas alrededor del jefe
      for (let i = 0; i < 14; i++) {
        const a = i * 0.9 + t * 0.012;
        const h = (i / 14) * 140;
        px(g, x + Math.cos(a) * 46, feetY - h, light, 0.9 * (1 - k * 0.5));
        px(g, x + Math.cos(a + Math.PI) * 46, feetY - h, color, 0.9 * (1 - k * 0.5));
      }
    }
    if (k > 0.8) px(g, x, y, 0xffffff, (k - 0.8) * 4, PX * 14 * (k - 0.7));
  });
  pixRing(scene, x, feetY, 90, color, 520, depth);
  if (!lowFx()) {
    scene.time.delayedCall(ms * 0.55, () => {
      pixRing(scene, x, feetY, 150, 0xffffff, 520, depth);
      starBurst(scene, x, y, light, 10, 1.6, depth + 1);
    });
  }
  return ms;
}

/**
 * Aura permanente de mega / forma furia sobre el sprite del jefe: llamas de píxeles que suben a ambos lados y un contorno
 * del color. Devuelve una función para quitarla. `feet` da la y de los pies cada fotograma.
 */
export function megaAura(scene: Phaser.Scene, boss: Phaser.GameObjects.Sprite, color: number, feet: () => number, depth = 3): () => void {
  if (lowFx()) return () => {};
  const g = scene.add.graphics().setDepth(depth);
  const ev = scene.time.addEvent({
    delay: 70,
    loop: true,
    callback: () => {
      if (!boss.active) return;
      g.clear();
      const t = scene.time.now;
      const half = (boss.displayWidth || 80) / 2;
      const fy = feet();
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1;
        const rise = ((t * 0.08 + i * 23) % 120);
        const xx = boss.x + side * (half * 0.7 + Math.sin(t * 0.006 + i) * PX);
        px(g, xx, fy - rise, i % 3 ? color : lightOf(color), 0.8 * (1 - rise / 120));
      }
    },
  });
  return () => {
    ev.remove();
    g.destroy();
  };
}

/** Tinte de noche/día sobre toda la pantalla (fijo a la cámara). `night` 0-1: 0 = día, 1 = noche cerrada. Con pocos efectos, solo tinte plano. */
export function dayNightLayer(scene: Phaser.Scene, depth = 40) {
  const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  let level = 0;
  let target = 0;
  // Estrellas en posiciones relativas (0-1) a lo que ve la cámara
  const stars = Array.from({ length: 26 }, (_, i) => ({ x: ((i * 211) % 960) / 960, y: (((i * 97) % 512) / 512) * 0.8, p: i * 0.7 }));
  const draw = () => {
    g.clear();
    if (level <= 0.01) return;
    // Fijo a la cámara pero con zoom: se pinta justo lo que ve el visor (camView.ts), con margen para el temblor;
    // antes iba de 0 a scale.width y, con el zoom 1,5 y el visor desplazado, las bandas salían corridas
    const v = fixedViewRect(scene.cameras.main, 48);
    // tinte azul-violeta en bandas gruesas (como un degradado a saltos)
    const bands = 6;
    for (let b = 0; b < bands; b++) {
      g.fillStyle(0x0d1b4a, level * (0.1 + b * 0.04)).fillRect(v.x, v.y + (v.h / bands) * b, v.w, v.h / bands + 1);
    }
    if (!lowFx() && level > 0.5) {
      const t = scene.time.now;
      for (const s of stars) if (Math.sin(t * 0.004 + s.p) > -0.3) px(g, v.x + s.x * v.w, v.y + s.y * v.h, 0xffffff, 0.7 * level, PX / 2 + 1);
    }
  };
  const ev = scene.time.addEvent({
    delay: 80,
    loop: true,
    callback: () => {
      level += Math.sign(target - level) * Math.min(0.06, Math.abs(target - level));
      draw();
    },
  });
  return {
    /** Cambia a noche (true) o día (false); la transición es suave. */
    setNight(night: boolean) {
      target = night ? 1 : 0;
    },
    destroy() {
      ev.remove();
      g.destroy();
    },
  };
}
