// Animación de subir de piso en la Torre (supervisor): una columna de luz de píxel gordo te eleva y el suelo se aleja;
// al llegar, un destello te deja en la sala nueva. Cada 10 pisos la columna es el doble de ancha y dura más.
// Solo dibujo: el que la llama (GameScene) decide cuándo cargar el piso nuevo (`onDone` salta cuando termina la subida).
import Phaser from 'phaser';
import { starBurst } from './combatFx';
import { animate, lightOf, PX, pixRing } from './pixelFx';

const LIGHT = 0xfff2a8;
const snap = (v: number) => Math.round(v / PX) * PX;

export interface AscendOptions {
  /** Sprite del jugador: sube con la luz y se desvanece. */
  lift?: Phaser.GameObjects.Sprite;
  /** Piso redondo (10, 20, 30…): columna más ancha y más larga. Por defecto, si `floor` es múltiplo de 10. */
  milestone?: boolean;
  /** Modo de efectos bajos: una columna lisa y corta, sin anillos ni estrellas. */
  low?: boolean;
  depth?: number;
  onDone?: () => void;
}

/** Duración de la subida (ms); el que llama puede esperar este tiempo para cargar el piso nuevo. */
export const ascendMs = (milestone: boolean, low: boolean): number => (low ? 600 : milestone ? 1800 : 1200);

/** Sube de piso: la columna de luz crece desde los pies, el jugador se eleva y todo se apaga arriba. */
export function towerAscend(scene: Phaser.Scene, x: number, y: number, floor: number, o: AscendOptions = {}) {
  const milestone = o.milestone ?? floor % 10 === 0;
  const low = !!o.low;
  const depth = o.depth ?? 13;
  const ms = ascendMs(milestone, low);
  const half = PX * (milestone ? 5 : 3); // media anchura de la columna
  const base = y + 24; // los pies
  const top = y - 900; // se pierde por arriba de la pantalla
  if (!low) {
    pixRing(scene, x, base, half * 3, LIGHT, 500, depth - 1);
    if (milestone) pixRing(scene, x, base, half * 5, 0xffffff, 700, depth - 1);
  }
  if (o.lift) scene.tweens.add({ targets: o.lift, y: y - 240, alpha: 0, duration: ms * 0.7, delay: ms * 0.2, ease: 'Cubic.easeIn' });
  animate(
    scene,
    depth,
    ms,
    (g, k, t) => {
      const grow = Phaser.Math.Easing.Cubic.Out(Math.min(1, k / 0.25));
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const h = (base - top) * grow;
      for (let yy = base; yy > base - h; yy -= PX) {
        // Las franjas brillantes suben con el tiempo (efecto de ascensor); con efectos bajos, una columna lisa
        const row = Math.floor((yy - t * 0.35) / PX);
        for (let xx = -half; xx < half; xx += PX) {
          const edge = Math.abs(xx + PX / 2) > half - PX;
          const c = edge ? LIGHT : low ? lightOf(LIGHT) : (row + Math.floor(xx / PX)) % 3 === 0 ? 0xffffff : lightOf(LIGHT);
          g.fillStyle(c, (edge ? 0.55 : 0.8) * fade).fillRect(snap(x + xx), snap(yy), PX, PX);
        }
      }
    },
    60,
  );
  if (!low) {
    // Chispas que se escapan hacia arriba por los lados
    scene.time.delayedCall(ms * 0.3, () => starBurst(scene, x, y - 60, 0xffffff, milestone ? 10 : 5, milestone ? 1.4 : 1, depth + 1));
  }
  scene.time.delayedCall(ms, () => o.onDone?.());
}

/** Llegar al piso nuevo: un destello baja sobre el jugador y aparece con estrellas (el sprite entra desde transparente). */
export function towerArrive(scene: Phaser.Scene, x: number, y: number, o: { lift?: Phaser.GameObjects.Sprite; low?: boolean; depth?: number } = {}) {
  const depth = o.depth ?? 13;
  if (o.lift) {
    o.lift.setAlpha(0);
    scene.tweens.add({ targets: o.lift, alpha: 1, duration: 500, ease: 'Quad.Out' });
  }
  if (o.low) return;
  pixRing(scene, x, y + 24, PX * 9, LIGHT, 420, depth - 1);
  starBurst(scene, x, y, 0xffffff, 7, 1.1, depth + 1);
}
