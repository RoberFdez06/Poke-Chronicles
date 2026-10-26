// Sala del Centro Pokémon (supervisor): un mostrador de madera con la máquina de curación encima (tres huecos que brillan),
// una sanadora original detrás, el cartel con el corazón, una alfombra rosa, bancos y plantas. Todo en píxel gordo como el
// resto del juego. Solo dibujo: la curación y el «una vez por piso» siguen en GameScene (`useCenter`).
// Con efectos bajos no hay animaciones sueltas: los huecos se quedan quietos y la curación solo cambia el color.
import Phaser from 'phaser';
import { FONT, lowFx } from '../theme';
import { starBurst } from './combatFx';
import { pixRing } from './pixelFx';

const OUT = 0x18202c;
const PINK = 0xff6fae;
const PINK_D = 0xc2185b;
const PINK_L = 0xffd1e6;
const WHITE = 0xf4f7ff;
const WOOD = 0xc9a27a;
const WOOD_D = 0x8f6a46;
const METAL = 0xaeb9cf;
const GREEN = 0x7be08f;
const RED = 0xe53935;
const GREY = 0x9aa5b1;
const px = 4;

/** Rectángulo del interior de la sala (el que da GameScene.interior). */
export interface CenterRoom {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PAL: Record<string, number> = {
  k: OUT, S: 0xf6d2b0, s: 0xe3b48d, H: 0x3fb8a0, h: 0x2a8a78, C: WHITE, c: 0xd3dbec, R: RED, W: WHITE, w: 0xd3dbec, P: PINK, G: 0x4caf50, g: 0x2e7d32, B: WOOD, b: WOOD_D,
};

/** Dibuja una plantilla de caracteres (`.` y espacio = vacío) con píxeles de `size`. */
function stamp(g: Phaser.GameObjects.Graphics, x: number, y: number, rows: readonly string[], size = px, alpha = 1) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = PAL[row[c]];
      if (col !== undefined) g.fillStyle(col, alpha).fillRect(x + c * size, y + r * size, size, size);
    }
  });
}

// Sanadora original (verde menta, gorro blanco con corazón); solo se ve de la cintura para arriba
const HEALER = [
  '....kkkkkk....',
  '...kCCCCCCk...',
  '..kCCCRRCCCk..',
  '..kCCCCRCCCk..',
  '.kHHHHHHHHHHk.',
  '.kHSSSSSSSSHk.',
  '.kHSkSSSSkSHk.',
  '.kHSSSSSSSSHk.',
  '..kHSSRRSSHk..',
  '...kkSSSSkk...',
  '..kWWWWWWWWk..',
  '.kWWWwWWwWWWk.',
  '.kWWRWWWWRWWk.',
];
const HEART = ['.kk.kk.', 'kRRkRRk', 'kRRRRRk', '.kRRRk.', '..kRk..', '...k...'];
const PLANT = [
  '...gg.gg...', '..gGGgGGg..', '.gGGGGGGGg.', '..gGGGGGg..', '...kbbbk...', '...kBBBk...', '...kBBBk...', '....kkk....',
];
const BENCH = ['kkkkkkkkkkkkkkkkkk', 'kBBBBBBBBBBBBBBBBk', 'kbbbbbbbbbbbbbbbbk', '.kk..........kk..', '.kk..........kk..'];

export interface CenterArt {
  /** Pasa a gris (ya usado en este piso) o vuelve a rosa. */
  setUsed(used: boolean): void;
  /** Animación de curar: los huecos se encienden uno a uno y salen corazones. */
  heal(): void;
  destroy(): void;
}

/** Sitio de cada hueco de la máquina respecto al centro del mostrador. */
const BAYS = [-70, -34, 2];

export function buildCenterArt(scene: Phaser.Scene, room: CenterRoom, x: number, y: number): CenterArt {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => (objs.push(o), o);
  const low = lowFx();

  // Alfombra rosa delante del mostrador, con borde claro y un corazón
  const rug = keep(scene.add.graphics().setDepth(0.5));
  rug.fillStyle(OUT, 0.35).fillRoundedRect(x - 150, y + 56, 300, 78, 14);
  rug.fillStyle(PINK, 1).fillRoundedRect(x - 146, y + 52, 292, 74, 12);
  rug.lineStyle(4, PINK_L, 1).strokeRoundedRect(x - 138, y + 60, 276, 58, 8);
  for (let k = -5; k <= 5; k++) rug.fillStyle(PINK_L, 0.55).fillRect(x + k * 24 - 2, y + 66, 4, 4).fillRect(x + k * 24 - 2, y + 106, 4, 4);

  // Bancos junto a la pared de arriba y plantas en las esquinas de abajo
  const deco = keep(scene.add.graphics().setDepth(1));
  stamp(deco, room.x0 + 70, room.y0 + 54, BENCH, 5);
  stamp(deco, room.x1 - 70 - 18 * 5, room.y0 + 54, BENCH, 5);
  stamp(deco, room.x0 + 34, room.y1 - 80, PLANT, 5);
  stamp(deco, room.x1 - 34 - 11 * 5, room.y1 - 80, PLANT, 5);

  // Mostrador (de madera, con tapa blanca y ribete rosa) y la sanadora detrás
  const base = keep(scene.add.graphics().setDepth(1));
  stamp(base, x + 50, y - 42, HEALER, px);
  base.fillStyle(OUT, 0.35).fillRoundedRect(x - 118, y + 4, 240, 52, 10);
  base.fillStyle(WOOD_D, 1).fillRoundedRect(x - 120, y - 8, 240, 56, 10);
  base.fillStyle(WOOD, 1).fillRoundedRect(x - 116, y - 4, 232, 46, 8);
  base.fillStyle(WOOD_D, 0.55);
  for (let k = -3; k <= 3; k++) base.fillRect(x + k * 32 - 1, y + 4, 2, 32);
  base.fillStyle(WHITE, 1).fillRoundedRect(x - 124, y - 16, 248, 18, 7);
  base.lineStyle(3, OUT, 1).strokeRoundedRect(x - 124, y - 16, 248, 18, 7);
  base.fillStyle(PINK, 1).fillRect(x - 118, y - 6, 236, 4);
  // Máquina de curación sobre el mostrador
  base.fillStyle(OUT, 1).fillRoundedRect(x - 100, y - 58, 134, 46, 8);
  base.fillStyle(METAL, 1).fillRoundedRect(x - 97, y - 55, 128, 40, 6);
  base.fillStyle(WHITE, 1).fillRoundedRect(x - 94, y - 52, 122, 12, 4);
  base.fillStyle(PINK, 1).fillRect(x - 94, y - 41, 122, 3);
  // Cartel con el corazón y el nombre
  stamp(base, x - 70 + 22, y - 82, HEART, 4);
  keep(scene.add.text(x - 36, y - 98, 'Centro Pokémon', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#c2185b' }).setOrigin(0.5).setStroke('#ffffff', 5).setDepth(3));

  // Los tres huecos: se redibujan cuando cambia el estado
  const bays = keep(scene.add.graphics().setDepth(1.2));
  let used = false;
  let phase = 0;
  let lit = -1; // al curar: cuántos huecos llevan encendidos (-1 = no se está curando)
  const paintBays = () => {
    bays.clear();
    BAYS.forEach((bx, k) => {
      const cx = x + bx;
      const cy = y - 26;
      const glow = lit >= 0 ? (k < lit ? 0xffffff : GREEN) : used ? GREY : (phase + k) % 3 === 0 ? PINK_L : PINK;
      bays.fillStyle(OUT, 1).fillCircle(cx, cy, 13);
      bays.fillStyle(0x2a3350, 1).fillCircle(cx, cy, 10);
      bays.fillStyle(glow, 1).fillCircle(cx, cy, 7);
      bays.fillStyle(0xffffff, used ? 0.2 : 0.7).fillRect(cx - 4, cy - 5, 3, 3);
    });
  };
  paintBays();
  // Los huecos brillan por turnos mientras esperas (sin efectos bajos)
  const pulse = low
    ? undefined
    : scene.time.addEvent({ delay: 520, loop: true, callback: () => { if (!used && lit < 0) { phase = (phase + 1) % 3; paintBays(); } } });

  // De vez en cuando sube un corazón del mostrador
  const hearts = low
    ? undefined
    : scene.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => {
          if (used) return;
          const h = scene.add.graphics().setDepth(3);
          stamp(h, 0, 0, HEART, 3);
          h.setPosition(x - 60 + Math.random() * 90, y - 92);
          scene.tweens.add({ targets: h, y: h.y - 34, alpha: 0, duration: 1500, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
        },
      });

  return {
    setUsed(u) {
      used = u;
      lit = -1;
      paintBays();
    },
    heal() {
      if (low) {
        lit = 3;
        paintBays();
        return;
      }
      lit = 0;
      paintBays();
      // Cada 350 ms se enciende un hueco; al llegar al tercero, destello, aro y corazones
      for (let k = 1; k <= 3; k++) {
        scene.time.delayedCall(k * 350, () => {
          lit = k;
          paintBays();
          starBurst(scene, x + BAYS[k - 1], y - 26, 0xffffff, 3, 0.7, 4);
        });
      }
      scene.time.delayedCall(1100, () => {
        pixRing(scene, x - 34, y - 26, 80, PINK, 520, 4);
        for (let n = 0; n < 5; n++) {
          const h = scene.add.graphics().setDepth(5);
          stamp(h, 0, 0, HEART, 4);
          h.setPosition(x - 70 + n * 24, y - 50);
          scene.tweens.add({ targets: h, y: h.y - 70 - n * 6, alpha: 0, duration: 1100, delay: n * 90, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
        }
      });
    },
    destroy() {
      pulse?.remove();
      hearts?.remove();
      objs.forEach((o) => o.destroy());
    },
  };
}
