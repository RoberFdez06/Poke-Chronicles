// Arte de las formas de poder del jugador (supervisor): la megaevolución con su Mega Piedra, la crisálida de luz y el
// símbolo mega; las auras (mega ligera y roja del Dinamax para las formas sin sprite propio); el icono de la Mega
// Piedra del HUD y la barra de poder con las marcas de cada forma. Píxel gordo y redibujado a saltos, como formsFx.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, mixColor, pixDebris, pixRing } from './pixelFx';
import { POWER_FORMS, Z_MOVE_COST } from '../../data/powerForm';
import { POWER_METER_MAX } from '../../data/powerMeter';

const OUT = 0x18202c;
/** Los tres colores de la hélice del símbolo mega. */
const MEGA_COLS = [0xff9a3c, 0xff5ab4, 0x4ad0ff] as const;

const snapTo = (v: number, s: number) => Math.round(v / s) * s;
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, a = 1, s = PX) {
  g.fillStyle(c, a).fillRect(snapTo(x, s) - s / 2, snapTo(y, s) - s / 2, s, s);
}
/** Disco de píxeles de lado `s`. */
function disc(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: number, a = 1, s = PX, flat = 1) {
  for (let yy = -r; yy <= r; yy += s) {
    const half = Math.sqrt(Math.max(0, r * r - yy * yy));
    const w = Math.max(s, snapTo(half * 2, s));
    g.fillStyle(c, a).fillRect(snapTo(x, s) - w / 2, snapTo(y + yy * flat, s) - s / 2, w, s);
  }
}

/** Símbolo mega: aro de tres colores con la hélice de dos hebras cruzándolo en diagonal. */
export function drawMegaSymbol(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, t: number, a = 1, s = PX) {
  const n = Math.max(12, Math.round((r * 6.283) / s));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283;
    px(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, OUT, a, s + 4);
  }
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283;
    px(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, MEGA_COLS[Math.floor((i / n) * 3)], a, s);
  }
  // hélice: dos hebras que se cruzan girando (la de delante blanca)
  const L = r * 0.78;
  for (let d = -L; d <= L; d += s * 0.75) {
    const ph = (d / L) * Math.PI * 1.2 + t * 0.006;
    const off = Math.sin(ph) * r * 0.32;
    const ax = x + d * 0.7071;
    const ay = y - d * 0.7071;
    const front = Math.cos(ph) > 0;
    px(g, ax + off * 0.7071, ay + off * 0.7071, front ? 0xffffff : MEGA_COLS[0], a, s);
    px(g, ax - off * 0.7071, ay - off * 0.7071, front ? MEGA_COLS[2] : 0xffffff, a, s);
  }
}

/** Mega Piedra: esfera de cristal con la hélice dentro y un brillo (la usan el efecto y el HUD). */
export function drawMegaStone(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, base: number, t: number, a = 1, s = PX) {
  disc(g, x, y, r + s * 0.7, OUT, a, s);
  disc(g, x, y, r, darkOf(base), a, s);
  disc(g, x - s * 0.5, y - s * 0.5, r * 0.78, base, a, s);
  disc(g, x - r * 0.3, y - r * 0.3, r * 0.4, lightOf(base), a, s);
  // hélice interior (dos hebras de colores que giran)
  for (let d = -r * 0.6; d <= r * 0.6; d += s) {
    const ph = (d / r) * 4 + t * 0.005;
    const off = Math.sin(ph) * r * 0.28;
    px(g, x + d * 0.7 + off * 0.7, y - d * 0.7 + off * 0.7, Math.cos(ph) > 0 ? MEGA_COLS[0] : MEGA_COLS[1], a, s);
    px(g, x + d * 0.7 - off * 0.7, y - d * 0.7 - off * 0.7, Math.cos(ph) > 0 ? MEGA_COLS[2] : 0xffffff, a, s);
  }
  px(g, x - r * 0.45, y - r * 0.5, 0xffffff, a, s);
}

/**
 * Megaevolución del jugador: la Mega Piedra aparece sobre la cabeza y lanza dos rayos de luz; una crisálida de luz
 * envuelve al Pokémon de los pies a la cabeza, se agrieta y estalla con el símbolo mega. Devuelve la duración.
 */
export function playerMegaFx(scene: Phaser.Scene, x: number, y: number, feetY: number, color: number, depth = 12): number {
  if (lowFx()) {
    pixRing(scene, x, feetY, 90, color, 450, depth);
    return 450;
  }
  const ms = 1700;
  const light = lightOf(color);
  const top = Math.min(y - 46, feetY - 90);
  const stoneY = top - 34;
  animate(scene, depth, ms, (g, k, t) => {
    // 1) la piedra baja brillando y gira su hélice (hasta 0,75)
    if (k < 0.75) {
      const sa = Math.min(1, k * 5) * (k > 0.62 ? 1 - (k - 0.62) / 0.13 : 1);
      const sy = stoneY - (1 - Math.min(1, k * 4)) * 30 + Math.sin(t / 120) * 3;
      // halo que late
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * 6.283 + t * 0.004;
        const rr = 24 + Math.sin(t / 90 + i) * 4;
        px(g, x + Math.cos(ang) * rr, sy + Math.sin(ang) * rr, i % 2 ? 0xffffff : MEGA_COLS[i % 3], sa * 0.85);
      }
      drawMegaStone(g, x, sy, 14, 0x9ad8ff, t, sa);
      // 2) rayos de luz de la piedra al Pokémon
      if (k > 0.12 && k < 0.5) {
        const ba = Math.min(1, (k - 0.12) * 6) * (k > 0.4 ? 1 - (k - 0.4) * 10 : 1);
        for (const side of [-1, 1]) {
          for (let d = 0; d < 1; d += 0.06) {
            const bx = Phaser.Math.Linear(x, x + side * 34, d) + Math.sin(d * 9 + t / 60) * 3;
            const by = Phaser.Math.Linear(sy + 14, y, d);
            px(g, bx, by, d * 17 % 2 < 1 ? 0xffffff : light, ba, PX);
          }
        }
      }
    }
    // 3) la crisálida sube de los pies a la cabeza (0,2-0,72) y se agrieta
    if (k > 0.2 && k < 0.78) {
      const grow = Math.min(1, (k - 0.2) / 0.3);
      const ca = k > 0.72 ? 1 - (k - 0.72) / 0.06 : 1;
      const h = (feetY - top + 24) * grow;
      const cy = feetY - h / 2;
      const rx = 34;
      const ry = Math.max(PX, h / 2);
      for (let yy = -ry; yy <= ry; yy += PX) {
        const half = rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2));
        const yi = Math.round((cy + yy) / PX);
        for (let xx = -half; xx <= half; xx += PX) {
          const edge = Math.abs(xx) > half - PX;
          // franjas que suben (luz que se mueve por la crisálida)
          const band = (yi + Math.floor(t / 70)) % 4 === 0;
          const c = edge ? OUT : band ? 0xffffff : Math.abs(xx) > half * 0.6 ? color : light;
          px(g, x + xx, cy + yy, c, ca * (edge ? 0.9 : 0.8));
        }
      }
      // grietas blancas al final
      if (k > 0.58) {
        const crack = (k - 0.58) / 0.14;
        for (let i = 0; i < 5; i++) {
          const ang = i * 1.3 + 0.4;
          for (let d = 0; d < crack * rx; d += PX) px(g, x + Math.cos(ang) * d + (d % 12 ? 0 : PX), cy + Math.sin(ang) * d * 1.4, 0xffffff, ca);
        }
      }
    }
    // 4) símbolo mega grande que aparece al romperse y se desvanece subiendo
    if (k > 0.72) {
      const kk = (k - 0.72) / 0.28;
      drawMegaSymbol(g, x, y - 10 - kk * 24, 26 + kk * 14, t, 1 - kk * kk);
    }
  }, 50);
  scene.time.delayedCall(ms * 0.73, () => {
    pixDebris(scene, x, y, light, 16, 1.5, depth + 1);
    starBurst(scene, x, y - 10, color, 10, 1.5, depth + 1);
    pixRing(scene, x, feetY, 130, color, 560, depth - 1);
    pixRing(scene, x, feetY, 80, 0xffffff, 420, depth - 1);
  });
  return ms;
}

type AuraState = { g: Phaser.GameObjects.Graphics; at: number };
const auras = new WeakMap<Phaser.GameObjects.Sprite, AuraState>();

/**
 * Aura del jugador con forma de poder; se llama cada fotograma. `kind`: 'mega' (aura ligera: aro mega a los pies y
 * chispas que suben), 'max' (aura roja del Dinamax: nubes rojas y corona de nubes sobre la cabeza) o null para
 * quitarla. `big`: la forma no tiene sprite propio y el aura dibuja además una silueta de luz más grande detrás.
 * Con pocos efectos no hay aura. Se redibuja ~12 veces por segundo y con pocos píxeles (la mega dura 30 s).
 */
export function playerFormAura(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, kind: 'mega' | 'max' | null, color: number, feetY: number, big: boolean) {
  let st = auras.get(s);
  if (!kind || lowFx() || !s.active) {
    if (st) {
      st.g.destroy();
      auras.delete(s);
    }
    return;
  }
  const now = scene.time.now;
  if (!st) {
    st = { g: scene.add.graphics(), at: 0 };
    auras.set(s, st);
  }
  st.g.setDepth(s.depth - 0.05);
  if (now - st.at < 80) return;
  st.at = now;
  const g = st.g.clear();
  const t = now;
  const half = Math.max(24, (s.displayWidth || 80) / 2);
  const hgt = Math.max(40, s.displayHeight || 80);
  const cy = feetY - hgt / 2;
  const main = kind === 'max' ? 0xe8384f : color;
  // silueta de luz más grande (formas sin sprite): capas de óvalo que laten
  if (big) {
    const pulse = 1 + 0.05 * Math.sin(t / 220);
    disc(g, s.x, cy, half * 1.3 * pulse, darkOf(main), 0.35, PX, (hgt / (half * 2)) * 0.95);
    disc(g, s.x, cy, half * 1.12 * pulse, lightOf(main), 0.3, PX, (hgt / (half * 2)) * 0.95);
  }
  // aro a los pies (perspectiva): en la mega de tres colores que giran, en el Dinamax rojo y blanco
  const n = 18;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + t * 0.0016;
    const col = kind === 'mega' ? MEGA_COLS[i % 3] : i % 3 ? main : 0xffd0d8;
    if ((i + Math.floor(t / 160)) % 6 === 0) continue;
    px(g, s.x + Math.cos(ang) * half * 1.15, feetY + Math.sin(ang) * half * 0.38, col, 0.75);
  }
  if (kind === 'mega') {
    // chispas del tipo que suben por los lados haciendo hélice
    for (let i = 0; i < 8; i++) {
      const rise = (t * 0.07 + i * 31) % (hgt * 1.1);
      const sx = s.x + Math.sin(rise * 0.06 + i * 3.1) * half * 0.95;
      px(g, sx, feetY - rise, i % 2 ? lightOf(color) : 0xffffff, 0.85 * (1 - rise / (hgt * 1.1)));
    }
    // símbolo mega pequeño que asoma sobre la cabeza de vez en cuando
    const cyc = (t % 3000) / 3000;
    if (cyc < 0.3) drawMegaSymbol(g, s.x, feetY - hgt - 14 - cyc * 20, 10, t, Math.sin((cyc / 0.3) * Math.PI) * 0.9, 4);
  } else {
    // nubes rojas que suben del suelo y se deshacen
    for (let i = 0; i < 10; i++) {
      const ph = ((t * 0.0006 + i * 0.137) % 1);
      const sx = s.x + ((i % 5) - 2) * half * 0.5 + Math.sin(t / 400 + i) * 5;
      const sz = PX * (1 + Math.round(ph * 2));
      px(g, sx, feetY - 6 - ph * hgt * 0.9, mixColor(0x5a0f1c, main, ph), 0.75 * (1 - ph), sz);
    }
    // corona de nubes rojas sobre la cabeza
    for (let i = 0; i < 7; i++) {
      const ox = (i - 3) * PX * 2.4;
      const oy = -Math.abs(i - 3) * -PX * 0.6 + Math.sin(t / 300 + i) * 3;
      px(g, s.x + ox, feetY - hgt - PX * 2 + oy, darkOf(main), 0.85, PX * 3);
      px(g, s.x + ox - 2, feetY - hgt - PX * 2.5 + oy, main, 0.9, PX * 2);
      if (i % 2) px(g, s.x + ox - 4, feetY - hgt - PX * 3 + oy, lightOf(main), 0.9, PX);
    }
  }
}

/**
 * Icono de la Mega Piedra / botón de poder en el HUD. `state`: 'used' (gastada este piso), 'idle', 'ready' (brilla y
 * le orbitan chispas) u 'on' (forma activa: aro dorado que se vacía según `fill`). Píxel pequeño (3 px) para el HUD.
 */
export function drawMegaStoneHud(g: Phaser.GameObjects.Graphics, x: number, y: number, state: 'used' | 'idle' | 'ready' | 'on', fill: number, t: number) {
  const anim = !lowFx();
  const base = state === 'used' ? 0x4a5468 : state === 'ready' ? 0x8fd3ff : state === 'on' ? 0xb8a0ff : 0x5a7a98;
  const tt = anim && state !== 'used' ? t : 0;
  g.fillStyle(0x101828, 1).fillCircle(x, y, 18);
  drawMegaStone(g, x, y, 12, base, tt, state === 'used' ? 0.7 : 1, 3);
  if (state === 'on') {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const lit = i / n < fill;
      const ang = -Math.PI / 2 + (i / n) * 6.283;
      px(g, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, lit ? (i % 2 ? 0xffe066 : 0xffffff) : 0x2a3450, 1, 3);
    }
  } else if (state === 'ready') {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.283;
      px(g, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, MEGA_COLS[Math.floor((i / n) * 3)], 0.9, 3);
    }
    if (anim) {
      for (let i = 0; i < 2; i++) {
        const ang = t * 0.004 + i * Math.PI;
        px(g, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, 0xffffff, 1, 5);
      }
    }
  }
}

/** Marcas de gasto de la barra de poder: Tera (60 %) y Dinamax/Z (100 %). */
const METER_MARKS: { at: number; color: number }[] = [
  { at: POWER_FORMS.tera.meterCost / POWER_METER_MAX, color: 0x7fe8ff },
  { at: Math.min(1, Math.max(POWER_FORMS.dynamax.meterCost, Z_MOVE_COST) / POWER_METER_MAX), color: 0xffe066 },
];

/**
 * Relleno de la barra de poder (el marco lo pone drawBox): franjas que corren, borde claro, marcas de lo que cuesta
 * cada forma (se encienden al alcanzarlas) y, llena, un destello que la recorre y el borde que parpadea.
 */
export function drawPowerMeterFill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, t: number) {
  const anim = !lowFx();
  const iw = w - 4;
  const ih = h - 4;
  const fw = Math.max(0, iw * Math.min(1, fill));
  const full = fill >= 1;
  if (fw > 0) {
    const s = 3;
    const shift = anim ? Math.floor(t / 90) : 0;
    for (let xx = 0; xx < fw; xx += s) {
      const stripe = (Math.floor(xx / s) + shift) % 6 < 2;
      const c = full ? (stripe ? 0xff8a9a : 0xff5a6e) : stripe ? 0xd8486a : 0xc23a5a;
      g.fillStyle(c, 1).fillRect(x + 2 + xx, y + 2, Math.min(s, fw - xx), ih);
    }
    g.fillStyle(0xffffff, full ? 0.55 : 0.3).fillRect(x + 2, y + 2, fw, Math.max(1, Math.floor(ih / 4)));
    g.fillStyle(0x000000, 0.25).fillRect(x + 2, y + 2 + ih - Math.max(1, Math.floor(ih / 4)), fw, Math.max(1, Math.floor(ih / 4)));
    // destello que la recorre cuando está llena
    if (full && anim) {
      const sx = ((t * 0.25) % (iw + 30)) - 15;
      for (let k = 0; k < 3; k++) {
        const bx = sx + k * 3;
        if (bx >= 0 && bx < iw) g.fillStyle(0xffffff, 0.75 - k * 0.2).fillRect(x + 2 + bx, y + 2, 3, ih);
      }
    }
  }
  for (const m of METER_MARKS) {
    const mx = Math.round(x + 2 + iw * m.at) - 1;
    const lit = fill >= m.at;
    const mx2 = Math.min(mx, x + w - 4);
    g.fillStyle(0x101828, 1).fillRect(mx2 - 1, y - 3, 4, h + 6);
    g.fillStyle(lit ? m.color : 0x5a6688, 1).fillRect(mx2, y - 2, 2, h + 4);
  }
  if (full) {
    const blink = anim ? 0.5 + 0.5 * Math.sin(t / 120) : 1;
    g.lineStyle(2, 0xffe066, blink).strokeRect(x - 1, y - 1, w + 2, h + 2);
  }
}
