// Arte suelto del mundo (supervisor): el NPC de los encargos, las pistas de la cacería legendaria (huella, ruido, pluma),
// el icono de la Poké Ball del HUD, la tierra y las plantas del huerto y la insignia de la cadena shiny.
// Píxel gordo; con pocos efectos todo queda quieto. Solo dibujo: la lógica sigue en GameScene y las escenas.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { darkOf, lightOf } from './pixelFx';

const OUT = 0x18202c;
const PX = 4;
const px = (g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, w = PX, h = PX) => g.fillStyle(c, a).fillRect(x, y, w, h);

const PAL: Record<string, number> = {
  k: OUT, H: 0xe6a23c, h: 0xb87a1f, S: 0xf6d2b0, s: 0xe3b48d, E: 0x18202c, B: 0x3f6fb5, b: 0x2c5190, G: 0x8f6a46, g: 0x5e4329, W: 0xffffff, R: 0xc0392b, Y: 0xffd34d,
};
function stamp(g: Phaser.GameObjects.Graphics, x: number, y: number, rows: readonly string[], size = PX) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = PAL[row[c]];
      if (col !== undefined) g.fillStyle(col, 1).fillRect(x + c * size, y + r * size, size, size);
    }
  });
}

// NPC original: viajero con sombrero naranja, mochila y bufanda roja, con un cartel de encargo (signo «!») sobre la cabeza
const NPC = [
  '...kkkkkk...',
  '..kHHHHHHk..',
  '.kHHhhhhHHk.',
  'kkkkkkkkkkkk',
  '.kSSSSSSSSk.',
  '.kSEsSSsESk.',
  '.kSSSssSSSk.',
  '..kSSkkSSk..',
  '.kRRRRRRRRk.',
  'kBBBBBBBBBBk',
  'kBBGGGGGGBBk',
  'kbBGggggGBbk',
  '.kBBBBBBBBk.',
  '.kbbk..kbbk.',
  '.kkk....kkk.',
];
const NPC_BLINK = NPC.map((r, i) => (i === 5 ? '.kSkksSSkksk.'.replace(/s/g, 'S') : r));

/** NPC de los encargos: respira, parpadea y tiene un «!» que salta cuando hay encargo. Devuelve el Graphics. */
export function buildNpc(scene: Phaser.Scene, x: number, y: number, scale = 3, depth = 3, alert = true): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const w = NPC[0].length * scale;
  const h = NPC.length * scale;
  const paint = (t: number) => {
    g.clear();
    const bob = lowFx() ? 0 : Math.round(Math.sin(t / 420)) * scale;
    const blink = !lowFx() && t % 3600 < 130;
    px(g, x - w / 2 + 3 * scale, y + h / 2 - scale, OUT, 0.3, w - 6 * scale, scale * 1.5);
    stamp(g, x - w / 2, y - h / 2 + bob, blink ? NPC_BLINK : NPC, scale);
    if (alert) {
      const jump = lowFx() ? 0 : Math.abs(Math.sin(t / 300)) * 6;
      const ax = x + w / 2 - 2 * scale;
      const ay = y - h / 2 - 14 - jump;
      px(g, ax - 3, ay - 3, OUT, 1, 12, 22);
      px(g, ax, ay, 0xffd34d, 1, 6, 11);
      px(g, ax, ay + 14, 0xffd34d, 1, 6, 4);
    }
  };
  paint(0);
  if (!lowFx()) {
    const t0 = scene.time.now;
    const ev = scene.time.addEvent({ delay: 90, loop: true, callback: () => g.active && paint(scene.time.now - t0) });
    g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  }
  return g;
}

/** Pista de la cacería legendaria: huella con brillo, ondas de ruido o pluma que flota. */
export function buildClue(scene: Phaser.Scene, x: number, y: number, kind: 'huella' | 'ruido' | 'pluma', depth = 3): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const paint = (t: number) => {
    g.clear();
    const pulse = lowFx() ? 1 : 0.6 + 0.4 * Math.sin(t / 260);
    // aura dorada
    for (let r = 3; r >= 1; r--) g.fillStyle(0xffd34d, 0.08 * pulse * (4 - r)).fillCircle(x, y, 14 + r * 7);
    if (kind === 'huella') {
      const c = 0x8a5a2b;
      for (const [dx, dy, w, h] of [[-6, 2, 14, 12], [-14, -8, 6, 8], [-5, -14, 6, 8], [4, -14, 6, 8], [11, -8, 6, 8]] as const) {
        px(g, x + dx - 1, y + dy - 1, OUT, 1, w + 2, h + 2);
        px(g, x + dx, y + dy, c, 1, w, h);
        px(g, x + dx, y + dy, lightOf(c), 1, w, 2);
      }
    } else if (kind === 'ruido') {
      for (let k = 0; k < 3; k++) {
        const ph = ((t / 900 + k / 3) % 1);
        const r = 6 + ph * 20;
        for (let a = -0.9; a <= 0.9; a += 0.3) px(g, x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 2, 0x9ad7ff, 1 - ph, 4, 4);
      }
      px(g, x - 12, y - 6, OUT, 1, 12, 12);
      px(g, x - 10, y - 4, 0x9ad7ff, 1, 8, 8);
    } else {
      const sway = lowFx() ? 0 : Math.sin(t / 500) * 5;
      for (let k = 0; k < 6; k++) {
        const fx = x - 10 + k * 4 + sway * (k / 6);
        const fy = y + 12 - k * 4;
        px(g, fx - 1, fy - 1, OUT, 1, 10, 6);
        px(g, fx, fy, k % 2 ? 0xffd34d : 0xfff2a0, 1, 8, 4);
      }
      px(g, x + 12 + sway, y - 12, 0xfff2a0, 1, 4, 4);
      px(g, x - 12, y + 12, 0x8a5a2b, 1, 4, 6);
    }
  };
  paint(0);
  if (!lowFx()) {
    const t0 = scene.time.now;
    const ev = scene.time.addEvent({ delay: 90, loop: true, callback: () => g.active && paint(scene.time.now - t0) });
    g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  }
  return g;
}

/** Poké Ball del HUD (centro x, y; radio r ≈ 14). `caught` pone una marca dorada: ya capturaste en este piso. */
export function drawBallIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number, caught = false, r = 14) {
  const s = 2;
  for (let dy = -r; dy <= r; dy += s) {
    for (let dx = -r; dx <= r; dx += s) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const top = dy < -1;
      const band = Math.abs(dy) <= 2;
      const rim = d > r - 3;
      let c = top ? 0xe8423c : 0xf4f4f4;
      if (band || rim) c = OUT;
      else if (top && dx < -2 && dy < -3 && d < r - 5) c = lightOf(0xe8423c);
      else if (!top && dx > 2 && dy > 3) c = 0xc8c8c8;
      px(g, x + dx, y + dy, c, alpha, s, s);
    }
  }
  px(g, x - 4, y - 4, OUT, alpha, 8, 8);
  px(g, x - 2, y - 2, caught ? 0xffd34d : 0xffffff, alpha, 4, 4);
  px(g, x - 9, y - 9, 0xffffff, alpha * 0.8, 3, 3);
}

/** Cuadro de tierra de una parcela del huerto: surcos y terrones. (x, y) = esquina superior izquierda. */
export function drawSoil(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  px(g, x, y, OUT, 1, w, h);
  px(g, x + 3, y + 3, 0x7a5230, 1, w - 6, h - 6);
  for (let row = 0; row < Math.floor((h - 12) / 14); row++) {
    px(g, x + 6, y + 8 + row * 14, darkOf(0x7a5230), 1, w - 12, 4);
    px(g, x + 6, y + 12 + row * 14, lightOf(0x7a5230), 0.5, w - 12, 2);
  }
  for (let k = 0; k < 9; k++) px(g, x + 8 + ((k * 37) % (w - 18)), y + 6 + ((k * 23) % (h - 14)), darkOf(0x7a5230), 1, 4, 4);
}

/** Planta del huerto en el punto (cx, baseY); `grow` 0-1; con `ripe` la baya de `color` cuelga madura y brilla. */
export function drawPlant(g: Phaser.GameObjects.Graphics, cx: number, baseY: number, grow: number, ripe: boolean, color: number, t = 0) {
  const stem = 0x3f8f3a;
  const hgt = Math.max(8, Math.round(60 * grow));
  const sway = lowFx() ? 0 : Math.round(Math.sin(t / 600) * 2);
  px(g, cx - 2, baseY - hgt, OUT, 1, 8, hgt + 2);
  px(g, cx, baseY - hgt, stem, 1, 4, hgt);
  const leaves = Math.min(4, 1 + Math.floor(grow * 4));
  for (let k = 0; k < leaves; k++) {
    const ly = baseY - 12 - k * 14;
    const dir = k % 2 ? 1 : -1;
    px(g, cx + dir * 8 + sway - 1, ly - 1, OUT, 1, 14, 10);
    px(g, cx + dir * 8 + sway, ly, k % 2 ? 0x57b04a : stem, 1, 12, 8);
  }
  if (grow < 1 && !ripe) px(g, cx - 1, baseY - hgt - 4, 0xb8e08a, 1, 6, 4);
  if (ripe) {
    const r = 14;
    const by = baseY - hgt - r + 2;
    for (let dy = -r; dy <= r; dy += 4) for (let dx = -r; dx <= r; dx += 4) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      px(g, cx + dx, by + dy, d > r - 4 ? OUT : dx < -2 && dy < -2 ? lightOf(color) : dx > 2 && dy > 2 ? darkOf(color) : color, 1);
    }
    if (!lowFx()) px(g, cx + 6 + Math.round(Math.sin(t / 250) * 3), by - 10, 0xffffff, 0.5 + 0.5 * Math.sin(t / 200), 4, 4);
  }
}

/** Insignia de la cadena shiny: estrella pixelada dorada con el número (dibuja la estrella; el texto lo pone la escena). */
export function drawShinyBadge(g: Phaser.GameObjects.Graphics, x: number, y: number, t = 0) {
  const spin = lowFx() ? 0 : Math.sin(t / 300);
  const col = 0xffd34d;
  for (const [dx, dy, w, h] of [[-2, -10, 4, 20], [-10, -2, 20, 4], [-6, -6, 12, 12]] as const) {
    px(g, x + dx - 1, y + dy - 1, OUT, 1, w + 2, h + 2);
  }
  for (const [dx, dy, w, h] of [[-2, -10, 4, 20], [-10, -2, 20, 4], [-6, -6, 12, 12]] as const) px(g, x + dx, y + dy, col, 1, w, h);
  px(g, x - 2, y - 2, 0xffffff, 0.7 + 0.3 * spin, 4, 4);
}
