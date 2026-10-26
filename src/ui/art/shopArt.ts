// Sala de la tienda (supervisor): puesto de mercado con toldo de rayas que se mece, rótulo, estantes con frascos, cajas,
// farolillos que parpadean, alfombra verde, un mercader original con capucha que parpadea y un pedestal por artículo con
// destellos. Todo en píxel gordo. Solo dibujo: precios y compra siguen en GameScene (`buildShop` / `buy`).
// Con efectos bajos no hay animaciones sueltas: todo queda quieto.
import Phaser from 'phaser';
import { FONT, lowFx } from '../theme';

const OUT = 0x18202c;
const GREEN = 0x2ecc71;
const GREEN_D = 0x1e8449;
const GREEN_L = 0xb8f0c8;
const CREAM = 0xfff3d6;
const RED = 0xe53935;
const RED_D = 0xa5231f;
const WOOD = 0xc9a27a;
const WOOD_D = 0x8f6a46;
const GOLD = 0xffd34d;
const PX = 4;

export interface ShopRoom {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ShopArt {
  /** Sitio (centro del pedestal) de cada artículo, para colocar destellos al comprar. */
  pedestals: { x: number; y: number }[];
  /** Destello dorado al comprar en el pedestal `k`. */
  sold(k: number): void;
  destroy(): void;
}

const PAL: Record<string, number> = {
  k: OUT, C: 0x6b4f8a, c: 0x4a3566, S: 0xf6d2b0, s: 0xe3b48d, E: 0xffe066, W: 0xffffff, G: GOLD, g: 0xb8860b, B: WOOD, b: WOOD_D, R: 0x9a6bd0,
};
function stamp(g: Phaser.GameObjects.Graphics, x: number, y: number, rows: readonly string[], size = PX) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = PAL[row[c]];
      if (col !== undefined) g.fillStyle(col, 1).fillRect(x + c * size, y + r * size, size, size);
    }
  });
}

// Mercader original: capucha violeta, cara con ojos amarillos y bufanda; de la cintura para arriba
const KEEPER = [
  '....kkkkkk....',
  '..kkCCCCCCkk..',
  '.kCCCRRRRCCCk.',
  '.kCCkkkkkkCCk.',
  '.kCkSSSSSSkCk.',
  '.kCkSEkkESkCk.',
  '.kCkSSSSSSkCk.',
  '.kCCkSssSkCCk.',
  '..kCCkkkkCCk..',
  '.kGGGGGGGGGGk.',
  '.kCCCCCCCCCCk.',
  'kCCCCgGGgCCCCk',
];
const KEEPER_BLINK = KEEPER.map((r, i) => (i === 5 ? '.kCkSkkkkSkCk.' : r));
// Frasco, caja y bolsa de los estantes
const JAR = ['..kk..', '.kWWk.', 'kRRRRk', 'kRWRRk', 'kRRRRk', '.kkkk.'];
const BOX = ['kkkkkkkk', 'kBBBBBBk', 'kBbbbbBk', 'kBBBBBBk', 'kkkkkkkk'];
const BAG = ['..kk..', '.kGGk.', '.kkkk.', 'kCCCCk', 'kCGGCk', 'kCCCCk', '.kkkk.'];

export function buildShopArt(scene: Phaser.Scene, room: ShopRoom, cx: number, cy: number, offsets: readonly number[]): ShopArt {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => (objs.push(o), o);
  const low = lowFx();
  const top = room.y0;

  // Alfombra verde bajo los artículos, con borde claro y flecos
  const rug = keep(scene.add.graphics().setDepth(0.5));
  rug.fillStyle(OUT, 0.3).fillRoundedRect(cx - 290, cy - 36, 580, 120, 16);
  rug.fillStyle(GREEN_D, 1).fillRoundedRect(cx - 286, cy - 40, 572, 116, 14);
  rug.fillStyle(GREEN, 1).fillRoundedRect(cx - 278, cy - 32, 556, 100, 10);
  rug.lineStyle(4, GREEN_L, 1).strokeRoundedRect(cx - 266, cy - 22, 532, 80, 8);
  for (let k = -6; k <= 6; k++) rug.fillStyle(GREEN_L, 0.7).fillRect(cx + k * 40 - 2, cy - 10, 4, 4).fillRect(cx + k * 40 - 2, cy + 46, 4, 4);

  // Pared del fondo: estantes con frascos, cajas y bolsas a los lados
  const shelves = keep(scene.add.graphics().setDepth(0.8));
  for (const side of [-1, 1]) {
    const sx = cx + side * 250 - 70;
    shelves.fillStyle(OUT, 0.35).fillRect(sx + 4, top + 100, 150, 8);
    shelves.fillStyle(WOOD_D, 1).fillRect(sx, top + 92, 140, 10).fillRect(sx, top + 138, 140, 10);
    shelves.fillStyle(WOOD, 1).fillRect(sx, top + 92, 140, 5).fillRect(sx, top + 138, 140, 5);
    stamp(shelves, sx + 6, top + 68, JAR, PX);
    stamp(shelves, sx + 36, top + 70, BOX, PX);
    stamp(shelves, sx + 76, top + 64, BAG, PX);
    stamp(shelves, sx + 110, top + 68, JAR, PX);
    stamp(shelves, sx + 10, top + 118, BOX, PX);
    stamp(shelves, sx + 52, top + 112, BAG, PX);
    stamp(shelves, sx + 90, top + 114, BOX, PX);
  }

  // Mostrador trasero con el mercader detrás
  const keeper = keep(scene.add.graphics().setDepth(0.9));
  let blink = false;
  const paintKeeper = () => {
    keeper.clear();
    const bob = low ? 0 : Math.round(Math.sin(scene.time.now / 500)) * 2;
    stamp(keeper, cx - 7 * PX, top + 64 + bob, blink ? KEEPER_BLINK : KEEPER, PX);
    keeper.fillStyle(OUT, 0.35).fillRoundedRect(cx - 100, top + 136, 204, 40, 8);
    keeper.fillStyle(WOOD_D, 1).fillRoundedRect(cx - 104, top + 128, 208, 44, 8);
    keeper.fillStyle(WOOD, 1).fillRoundedRect(cx - 100, top + 132, 200, 36, 6);
    keeper.fillStyle(WOOD_D, 0.55);
    for (let k = -3; k <= 3; k++) keeper.fillRect(cx + k * 28 - 1, top + 140, 2, 24);
    keeper.fillStyle(CREAM, 1).fillRoundedRect(cx - 108, top + 122, 216, 14, 6);
    keeper.lineStyle(3, OUT, 1).strokeRoundedRect(cx - 108, top + 122, 216, 14, 6);
    // Montoncito de monedas y balanza
    for (let c = 0; c < 4; c++) keeper.fillStyle(GOLD, 1).fillRect(cx + 56 + (c % 2) * 4, top + 114 - c * 4, 14, 4).lineStyle(1, OUT, 1).strokeRect(cx + 56 + (c % 2) * 4, top + 114 - c * 4, 14, 4);
  };
  paintKeeper();

  // Toldo de rayas rojas y crema que se mece, con rótulo
  const awning = keep(scene.add.graphics().setDepth(2.5));
  const paintAwning = (t: number) => {
    awning.clear();
    const w = 580;
    const n = 14;
    const sw = w / n;
    for (let k = 0; k < n; k++) {
      const sway = low ? 0 : Math.round(Math.sin(t / 700 + k * 0.5) * 2);
      const x = cx - w / 2 + k * sw;
      const col = k % 2 ? CREAM : RED;
      awning.fillStyle(OUT, 1).fillRect(x - 1, top + 6, sw + 2, 40 + sway);
      awning.fillStyle(col, 1).fillRect(x, top + 8, sw, 36 + sway);
      awning.fillStyle(k % 2 ? 0xe9d3a6 : RED_D, 1).fillRect(x, top + 8 + 26, sw, 10 + sway);
      // festón semicircular
      awning.fillStyle(OUT, 1).fillCircle(x + sw / 2, top + 44 + sway, sw / 2 + 1);
      awning.fillStyle(col, 1).fillCircle(x + sw / 2, top + 44 + sway, sw / 2 - 1);
    }
    awning.fillStyle(WOOD_D, 1).fillRect(cx - w / 2 - 8, top, w + 16, 8);
  };
  paintAwning(0);
  keep(scene.add.text(cx, top + 28, 'Tienda', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#1e8449' }).setOrigin(0.5).setStroke('#ffffff', 6).setDepth(3.2));

  // Farolillos que cuelgan del toldo y parpadean
  const lamps = keep(scene.add.graphics().setDepth(2.6));
  const paintLamps = (t: number) => {
    lamps.clear();
    for (const lx of [cx - 150, cx + 150]) {
      const flick = low ? 1 : 0.75 + 0.25 * Math.sin(t / 130 + lx);
      lamps.lineStyle(2, OUT, 1).lineBetween(lx, top + 46, lx, top + 62);
      lamps.fillStyle(GOLD, 0.18 * flick).fillCircle(lx, top + 74, 26);
      lamps.fillStyle(OUT, 1).fillRoundedRect(lx - 8, top + 62, 16, 22, 5);
      lamps.fillStyle(0xffe9a0, flick).fillRoundedRect(lx - 6, top + 64, 12, 18, 4);
      lamps.fillStyle(0xffffff, 0.8 * flick).fillRect(lx - 3, top + 67, 3, 5);
    }
  };
  paintLamps(0);

  // Pedestales de madera con cojín verde bajo cada artículo
  const pedestals = offsets.map((o) => ({ x: cx + o, y: cy + 24 }));
  const peds = keep(scene.add.graphics().setDepth(1));
  const sparkle = keep(scene.add.graphics().setDepth(2.2));
  for (const p of pedestals) {
    peds.fillStyle(OUT, 0.35).fillEllipse(p.x, p.y + 12, 92, 26);
    peds.fillStyle(OUT, 1).fillRoundedRect(p.x - 42, p.y - 6, 84, 24, 6);
    peds.fillStyle(WOOD_D, 1).fillRoundedRect(p.x - 40, p.y - 4, 80, 20, 5);
    peds.fillStyle(WOOD, 1).fillRoundedRect(p.x - 40, p.y - 4, 80, 8, 4);
    peds.fillStyle(GREEN, 1).fillRoundedRect(p.x - 34, p.y - 10, 68, 10, 5);
    peds.lineStyle(2, GREEN_D, 1).strokeRoundedRect(p.x - 34, p.y - 10, 68, 10, 5);
    peds.fillStyle(GOLD, 1).fillRect(p.x - 3, p.y - 8, 6, 6);
  }
  const paintSparkle = (t: number) => {
    sparkle.clear();
    pedestals.forEach((p, k) => {
      const ph = ((t / 900 + k / 3) % 1);
      const a = Math.sin(ph * Math.PI);
      const sx = p.x - 26 + ((k * 37) % 52);
      sparkle.fillStyle(0xffffff, a).fillRect(Math.round(sx / 2) * 2 - 2, p.y - 46 - ph * 8, 4, 4);
      sparkle.fillStyle(GOLD, a * 0.8).fillRect(Math.round(sx / 2) * 2 - 6, p.y - 44 - ph * 8, 12, 2).fillRect(Math.round(sx / 2) * 2 - 1, p.y - 49 - ph * 8, 2, 12);
    });
  };
  if (!low) paintSparkle(0);

  // Bucle de animación (sin efectos bajos)
  const loop = low
    ? undefined
    : scene.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          const t = scene.time.now;
          paintAwning(t);
          paintLamps(t);
          paintSparkle(t);
          blink = t % 3800 < 140;
          paintKeeper();
        },
      });

  return {
    pedestals,
    sold(k: number) {
      const p = pedestals[k];
      if (!p || low) return;
      const g = scene.add.graphics().setDepth(5);
      const t0 = scene.time.now;
      const ev = scene.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          const kk = Math.min(1, (scene.time.now - t0) / 500);
          g.clear();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const d = 10 + kk * 46;
            g.fillStyle(i % 2 ? GOLD : 0xffffff, 1 - kk).fillRect(Math.round((p.x + Math.cos(a) * d) / 4) * 4, Math.round((p.y - 20 + Math.sin(a) * d * 0.7 - kk * 10) / 4) * 4, 6, 6);
          }
          if (kk >= 1) {
            ev.remove();
            g.destroy();
          }
        },
      });
    },
    destroy() {
      loop?.remove();
      objs.forEach((o) => o.destroy());
    },
  };
}
