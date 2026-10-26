// Arte de la Torre (supervisor): puesto de suministros, altar y tienda del descanso, peligros del suelo (pinchos, lava,
// hielo) y la columna de luz en reposo. Mismo estilo que towerFx (píxel gordo, luz 0xfff2a8 con franjas que suben) y
// con el color del bioma de cada piso. Con pocos efectos se dibuja quieto. Solo dibujo: la lógica sigue en GameScene.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { PX, darkOf, lightOf, mixColor } from './pixelFx';

const OUT = 0x18202c;
const LIGHT = 0xfff2a8;
const GOLD = 0xffd34d;
const snap = (v: number) => Math.round(v / PX) * PX;
type G = Phaser.GameObjects.Graphics;
const box = (g: G, x: number, y: number, w: number, h: number, c: number, a = 1) =>
  g.fillStyle(c, a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h)));
const slab = (g: G, x: number, y: number, w: number, h: number, c: number) => {
  box(g, x - PX / 2, y - PX / 2, w + PX, h + PX, OUT);
  box(g, x, y, w, h, c);
  box(g, x, y, w, PX, lightOf(c));
  box(g, x, y + h - PX, w, PX, darkOf(c));
};
function blob(g: G, cx: number, cy: number, rx: number, ry: number, c: number, a = 1) {
  for (let y = snap(cy - ry); y <= cy + ry; y += PX) {
    for (let x = snap(cx - rx); x <= cx + rx; x += PX) {
      if (((x + PX / 2 - cx) / rx) ** 2 + ((y + PX / 2 - cy) / ry) ** 2 <= 1) g.fillStyle(c, a).fillRect(x, y, PX, PX);
    }
  }
}
function live(scene: Phaser.Scene, depth: number, draw: (g: G, t: number) => void, step = 90): G {
  const g = scene.add.graphics().setDepth(depth);
  const tick = () => {
    g.clear();
    draw(g, lowFx() ? 0 : scene.time.now);
  };
  tick();
  if (!lowFx()) {
    const ev = scene.time.addEvent({ delay: step, loop: true, callback: () => g.active && tick() });
    g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  }
  return g;
}
function twinkle(g: G, x: number, y: number, k: number, c = 0xffffff) {
  const s = k < 0.5 ? k * 2 : 2 - k * 2;
  if (s <= 0.15) return;
  const r = Math.round(s * 2);
  box(g, x - PX / 2, y - PX / 2 - r * PX, PX, PX * (r * 2 + 1), c, 0.9);
  box(g, x - PX / 2 - r * PX, y - PX / 2, PX * (r * 2 + 1), PX, c, 0.9);
}
/** Piedra de la Torre teñida con el muro del bioma (para que cada tramo de pisos tenga su tono). */
const stoneOf = (wall: number) => mixColor(0x7d8494, wall, 0.45);

/** Puesto de suministros (centrado en x, y): caja con lona, y encima poción, llave y baya que se turnan para brillar. */
export function buildSupplyStall(scene: Phaser.Scene, x: number, y: number, wall: number): G {
  const wood = mixColor(0xb07a4a, wall, 0.2);
  return live(scene, 0.8, (g, t) => {
    blob(g, x, y + 30, 70, 12, 0x000000, 0.22);
    slab(g, x - 60, y - 6, 120, 34, wood);
    for (let k = 0; k < 4; k++) box(g, x - 54 + k * 30, y + 4, PX, 18, darkOf(wood));
    slab(g, x - 64, y - 14, 128, PX * 2, 0x3f7f5a);
    for (let k = 0; k < 8; k++) box(g, x - 64 + k * 16, y - 8, PX * 2, PX, k % 2 ? 0xd6ffd8 : 0x3f7f5a);
    const hot = Math.floor(t / 700) % 3;
    const bob = (k: number) => (t && k === hot ? PX : 0);
    // Poción
    slab(g, x - 46, y - 40 - bob(0), 18, 22, 0xb06ad0);
    box(g, x - 42, y - 48 - bob(0), 10, PX, 0xffffff);
    box(g, x - 42, y - 34 - bob(0), PX, PX, 0xffffff);
    // Llave
    blob(g, x - 2, y - 38 - bob(1), 8, 8, GOLD);
    box(g, x + 4, y - 40 - bob(1), 18, PX, GOLD);
    box(g, x + 16, y - 34 - bob(1), PX, PX, GOLD);
    // Baya
    blob(g, x + 40, y - 30 - bob(2), 11, 10, 0x4f8fe0);
    box(g, x + 38, y - 44 - bob(2), PX, PX * 2, 0x3f7f35);
    const sx = [x - 38, x + 6, x + 40][hot];
    twinkle(g, sx + 10, y - 54 - (t ? PX : 0), (t / 700) % 1);
  });
}

/** Altar de los tres objetos: losa de piedra del bioma con un cuenco de luz bajo cada sitio y runas que laten. */
export function buildTowerAltar(scene: Phaser.Scene, x: number, y: number, step: number, wall: number): G {
  const stone = stoneOf(wall);
  return live(scene, 0.8, (g, t) => {
    const w = step * 2 + 60;
    blob(g, x, y + 16, w / 2 + 6, 12, 0x000000, 0.22);
    slab(g, x - w / 2, y - 8, w, 18, stone);
    for (let k = 0; k < 3; k++) {
      const px = x + (k - 1) * step;
      const pulse = t ? 0.5 + 0.5 * Math.sin(t / 400 + k * 2) : 0.7;
      slab(g, px - 18, y - 16, 36, 10, lightOf(stone));
      blob(g, px, y - 24, 18, 6, 0xb39ddb, 0.35 * pulse + 0.15);
      box(g, px - 2, y - 30 - pulse * PX * 2, PX, PX, 0xe3d4ff, pulse);
    }
    const lit = Math.floor(t / 300) % 6;
    for (let k = 0; k < 6; k++) box(g, x - w / 2 + 14 + k * ((w - 34) / 5), y, PX, PX, k === lit && t ? 0xffffff : 0x9a7ad8);
  });
}

/** Mostrador de la tienda del descanso: tablero de madera con toldo de rayas que se mece y farolillos. */
export function buildTowerStall(scene: Phaser.Scene, x: number, y: number, w: number): G {
  return live(scene, 0.8, (g, t) => {
    blob(g, x, y + 14, w / 2 + 6, 10, 0x000000, 0.22);
    slab(g, x - w / 2, y - 8, w, 18, 0x8f6a46);
    for (let k = 0; k < Math.floor(w / 24); k++) box(g, x - w / 2 + 6 + k * 24, y - 2, 12, PX, 0x6b4423);
    // Toldo a la altura del rótulo (arriba de los artículos)
    const ay = y - 108;
    for (let c = 0; c < Math.floor(w / PX); c++) {
      const sw = t ? Math.round(Math.sin(t / 300 + c * 0.3) * 0.6) * 2 : 0;
      const col = Math.floor(c / 4) % 2 ? 0xfff3d6 : 0xe53935;
      box(g, x - w / 2 + c * PX, ay, PX, PX * 3 + (c % 4 === 1 || c % 4 === 2 ? PX : 0) + sw, col);
    }
    box(g, x - w / 2, ay - PX, w, PX, OUT);
    box(g, x - w / 2, ay + PX * 3, PX, 100, 0x6b4423);
    box(g, x + w / 2 - PX, ay + PX * 3, PX, 100, 0x6b4423);
    for (const s of [-1, 1]) {
      const on = t ? Math.floor(t / 180 + (s > 0 ? 2 : 0)) % 5 !== 0 : true;
      const lx = x + s * (w / 2 - PX * 2);
      slab(g, lx - PX, ay + 30, PX * 2, PX * 3, on ? GOLD : 0xb8860b);
      if (on && t) box(g, lx - PX * 2, ay + 26, PX * 4, PX * 5, GOLD, 0.18);
    }
  });
}

export interface HazardTile { x: number; y: number }

/**
 * Peligros del suelo de un piso (todas sus casillas en un solo Graphics): pinchos de metal que asoman y brillan, lava
 * con burbujas que revientan, o hielo con reflejo que barre. `size` es el lado de la casilla.
 */
export function buildHazards(scene: Phaser.Scene, kind: string, tiles: readonly HazardTile[], size: number): G {
  const half = size / 2 - 2;
  return live(scene, 0.5, (g, t) => {
    tiles.forEach((p, n) => {
      const x0 = p.x - half;
      const y0 = p.y - half;
      const s = half * 2;
      if (kind === 'lava') {
        box(g, x0, y0, s, s, 0x7a1f0a);
        box(g, x0 + PX, y0 + PX, s - PX * 2, s - PX * 2, 0xff5a1f);
        for (let k = 0; k < 3; k++) {
          const wave = Math.round(Math.sin(t / 400 + k + n) * 1.5) * PX;
          box(g, x0 + PX * 2 + wave + k * 12, y0 + 10 + k * 14, 14, PX, 0xffb02e);
        }
        const ph = ((t / 1300) + n * 0.37) % 1;
        if (t && ph < 0.6) {
          const r = ph < 0.45 ? PX : PX * 2;
          const bx = x0 + s / 2 + ((n * 17) % 20) - 10;
          const by = y0 + s / 2 + ((n * 11) % 16) - 8;
          box(g, bx - r / 2, by - r / 2, r, r, ph < 0.45 ? GOLD : 0xfff2a8);
        } else if (t && ph < 0.75) box(g, x0 + s / 2, y0 + s / 2 - (ph - 0.6) * 120, PX, PX, 0xffb02e, 0.8);
      } else if (kind === 'ice') {
        box(g, x0, y0, s, s, 0x7fb8e0);
        box(g, x0 + PX, y0 + PX, s - PX * 2, s - PX * 2, 0xbfe8ff);
        box(g, x0 + PX * 2, y0 + s - PX * 3, s / 2, PX, 0xe8f7ff);
        box(g, x0 + s - PX * 4, y0 + PX * 2, PX, s / 3, 0x9fd3f0);
        // Reflejo diagonal que barre la casilla
        const k = ((t / 1800) + n * 0.13) % 1;
        const d = -s + k * s * 3;
        for (let j = 0; j < s; j += PX) {
          const xx = d + j;
          if (xx >= 0 && xx < s - PX && t) box(g, x0 + xx, y0 + s - PX - j, PX, PX, 0xffffff, 0.7);
        }
      } else {
        // Pinchos: placa de metal y cuatro púas que asoman y se esconden
        box(g, x0, y0, s, s, 0x4a4f5c);
        box(g, x0 + PX, y0 + PX, s - PX * 2, s - PX * 2, 0x6e7380);
        const up = t ? (Math.sin(t / 500 + n * 0.8) > -0.3 ? 1 : 0) : 1;
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            const sx = x0 + s * (0.3 + a * 0.4);
            const sy = y0 + s * (0.4 + b * 0.4);
            box(g, sx - PX, sy, PX * 2, PX, OUT);
            if (!up) continue;
            box(g, sx - PX, sy - PX, PX * 2, PX, 0xc8ccd6);
            box(g, sx - PX / 2, sy - PX * 2, PX, PX, 0xeef0f5);
            if (Math.floor(t / 150 + n + a + b) % 9 === 0) box(g, sx - PX / 2, sy - PX * 3, PX, PX, 0xffffff);
          }
        }
      }
    });
  }, 110);
}

/**
 * Columna de luz en reposo (como la de subir en towerFx, pero tranquila): base de piedra con runas, haz de franjas que
 * suben con bordes claros y motas que flotan. `cx, cy` es el centro de la base; el haz llega a `height` por encima.
 */
export function buildLightColumn(scene: Phaser.Scene, cx: number, cy: number, wall: number, height = 130): G {
  const stone = stoneOf(wall);
  const half = PX * 3;
  return live(scene, 1, (g, t) => {
    // Base
    blob(g, cx, cy + 4, 46, 14, darkOf(stone));
    blob(g, cx, cy, 40, 11, stone);
    blob(g, cx, cy - 2, 28, 7, lightOf(stone));
    const lit = Math.floor(t / 200) % 8;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      box(g, cx + Math.cos(a) * 34 - PX / 2, cy + Math.sin(a) * 9 - PX / 2, PX, PX, k === lit && t ? 0xffffff : GOLD, 0.9);
    }
    // Haz
    const breathe = t ? 0.75 + 0.25 * Math.sin(t / 500) : 0.8;
    for (let yy = cy - PX; yy > cy - height; yy -= PX) {
      const fade = 1 - (cy - yy) / height;
      const row = Math.floor((yy - t * 0.12) / PX);
      for (let xx = -half; xx < half; xx += PX) {
        const edge = Math.abs(xx + PX / 2) > half - PX;
        const c = edge ? LIGHT : t && (row + Math.floor(xx / PX)) % 4 === 0 ? 0xffffff : lightOf(LIGHT);
        box(g, cx + xx, yy, PX, PX, c, (edge ? 0.45 : 0.65) * fade * breathe + 0.05);
      }
    }
    if (!t) return;
    for (let k = 0; k < 5; k++) {
      const p = ((t / 1600) + k / 5) % 1;
      const sx = cx + Math.sin(k * 2.1 + p * 4) * 30;
      box(g, sx, cy - 8 - p * height, PX, PX, k % 2 ? 0xffffff : LIGHT, 1 - p);
    }
  }, 70);
}
