// Arte de las formas de poder del jugador (supervisor): la megaevolución con su Mega Piedra, la crisálida de luz y el
// símbolo mega; las auras (mega ligera y roja del Dinamax para las formas sin sprite propio); el icono de la Mega
// Piedra del HUD y la barra de poder con las marcas de cada forma. Píxel gordo y redibujado a saltos, como formsFx.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { dustBurst, starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, mixColor, pixDebris, pixRing } from './pixelFx';
import { POWER_FORMS, Z_MOVE_COST } from '../../data/powerForm';
import { POWER_METER_MAX } from '../../data/powerMeter';
import type { MegaCineFrame, MegaFxStyle } from '../../scenes/megaCinematic';

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
export function playerFormAura(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, kind: 'mega' | 'max' | 'tera' | null, color: number, feetY: number, big: boolean) {
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
  if (kind === 'max') {
    // Dinamax: resplandor rojo suave detrás (capas que se apagan hacia fuera, sin silueta dura)
    const pulse = 1 + 0.06 * Math.sin(t / 200);
    for (let k = 0; k < 3; k++) disc(g, s.x, cy, half * (1.35 - k * 0.18) * pulse, k === 2 ? lightOf(main) : main, 0.1 + k * 0.05, PX, (hgt / (half * 2)) * 0.9);
  }
  if (kind === 'tera') return drawTeraAura(g, s.x, feetY, half, hgt, color, t);
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

/** Gema de cristal (rombo con facetas: arriba a la izquierda clara, abajo a la derecha oscura) de radio r. */
function gemPx(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, a = 1, s = 4) {
  for (let dy = -r; dy <= r; dy += s) {
    const halfW = r - Math.abs(dy);
    for (let dx = -halfW; dx <= halfW; dx += s) {
      const edge = Math.abs(dx) >= halfW - s / 2 || Math.abs(dy) >= r - s / 2;
      const c = edge ? OUT : dx <= 0 && dy <= 0 ? lightOf(color) : dx > 0 && dy > 0 ? darkOf(color) : color;
      px(g, x + dx, y + dy, c, a, s);
    }
  }
}

/**
 * Teracristal: corona de cristal sobre la cabeza (cinco gemas del color del tipo, la del centro más alta), facetas que
 * giran alrededor del cuerpo, aro de cristal a los pies y destellos blancos de gema que aparecen y se apagan.
 */
function drawTeraAura(g: Phaser.GameObjects.Graphics, x: number, feetY: number, half: number, hgt: number, color: number, t: number) {
  // aro facetado a los pies
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.283 + t * 0.001;
    gemPx(g, x + Math.cos(ang) * half * 1.1, feetY + Math.sin(ang) * half * 0.36, 6, i % 2 ? color : lightOf(color), 0.8, 3);
  }
  // facetas que orbitan el cuerpo (las de detrás, más tenues)
  for (let i = 0; i < 4; i++) {
    const ang = t * 0.0025 + (i / 4) * 6.283;
    const front = Math.sin(ang) > 0;
    gemPx(g, x + Math.cos(ang) * half * 1.05, feetY - hgt * 0.45 + Math.sin(ang) * hgt * 0.12, 8, color, front ? 0.9 : 0.45, 4);
  }
  // corona de cristal
  const top = feetY - hgt - 6 + Math.sin(t / 400) * 2;
  const crown = [[-2, 10, 0.75], [-1, 14, 0.9], [0, 20, 1], [1, 14, 0.9], [2, 10, 0.75]] as const;
  for (const [k, r, a] of crown) gemPx(g, x + k * 15, top - (r - 10) * 0.8, r, color, a, 4);
  // destellos de gema
  for (let i = 0; i < 3; i++) {
    const cyc = ((t + i * 700) % 2100) / 2100;
    if (cyc > 0.25) continue;
    const gx = x + Math.sin(i * 2.4 + Math.floor((t + i * 700) / 2100)) * half * 0.9;
    const gy = feetY - hgt * (0.3 + 0.25 * i);
    const sz = 4 + Math.round(Math.sin((cyc / 0.25) * Math.PI) * 8);
    g.fillStyle(0xffffff, 0.95).fillRect(snapTo(gx, 2) - sz / 2, snapTo(gy, 2) - 1, sz, 3);
    g.fillStyle(0xffffff, 0.95).fillRect(snapTo(gx, 2) - 1, snapTo(gy, 2) - sz / 2, 3, sz);
  }
}

/**
 * Icono del botón de forma de poder cuando la elegida no es la mega: el dibujo del objeto (Banda Dinamax, Teragema o
 * Cristal Z) lo pone la escena con su textura; aquí el fondo y el aro de estado, como drawMegaStoneHud.
 */
export function drawPowerSelHud(g: Phaser.GameObjects.Graphics, x: number, y: number, state: 'used' | 'idle' | 'ready' | 'on', fill: number, t: number, color: number) {
  const anim = !lowFx();
  g.fillStyle(0x101828, 1).fillCircle(x, y, 18);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i / n) * 6.283;
    const lit = state === 'on' ? i / n < fill : state === 'ready';
    const c = state === 'used' ? 0x3a4458 : lit ? (i % 2 ? color : 0xffffff) : 0x2a3450;
    px(g, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, c, 1, 3);
  }
  if (state === 'ready' && anim) {
    const ang = t * 0.004;
    px(g, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, 0xffffff, 1, 5);
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

/** Una partícula de la carga con la forma de su tipo (ascuas, gotas, chispas, cristales, hojas, humo, escamas, rocas, estrellas). */
function typeMote(g: Phaser.GameObjects.Graphics, style: MegaFxStyle, x: number, y: number, c: number, light: number, t: number, i: number, a: number) {
  switch (style) {
    case 'embers':
      px(g, x, y, light, a);
      px(g, x, y + PX, c, a * 0.8);
      px(g, x, y + PX * 2, 0xff5a1e, a * 0.4);
      break;
    case 'drops':
      px(g, x, y - PX, 0xffffff, a * 0.9);
      px(g, x - PX / 2, y, light, a);
      px(g, x + PX / 2, y, c, a);
      break;
    case 'sparks': {
      const z = (Math.floor(t / 60) + i) % 2 ? PX : -PX;
      px(g, x, y, 0xffffff, a);
      px(g, x + z, y + PX, light, a);
      px(g, x, y + PX * 2, c, a * 0.8);
      break;
    }
    case 'crystals':
      px(g, x, y - PX, 0xffffff, a);
      px(g, x - PX, y, light, a);
      px(g, x + PX, y, light, a);
      px(g, x, y + PX, c, a);
      break;
    case 'leaves': {
      const d = Math.sin(t / 90 + i) > 0 ? 1 : -1;
      px(g, x, y, light, a);
      px(g, x + PX * d, y + PX, c, a);
      break;
    }
    case 'smoke':
      px(g, x, y, c, a * 0.6, PX * 2);
      px(g, x + PX, y - PX, light, a * 0.5);
      break;
    case 'scales':
      px(g, x, y, light, a);
      px(g, x + PX, y, c, a);
      px(g, x + PX / 2, y + PX, darkOf(c), a);
      break;
    case 'rocks':
      px(g, x, y, c, a, PX * 2);
      px(g, x - PX / 2, y - PX / 2, light, a);
      break;
    default:
      px(g, x, y, 0xffffff, a);
      if ((Math.floor(t / 80) + i) % 2) {
        px(g, x - PX, y, light, a * 0.7);
        px(g, x + PX, y, light, a * 0.7);
        px(g, x, y - PX, light, a * 0.7);
        px(g, x, y + PX, light, a * 0.7);
      }
  }
}

/**
 * Cinemática de megaevolución del jugador, un fotograma (GameScene la redibuja cada ~33 ms con megaCineFrame):
 * viñeta oscura que se cierra, partículas de su tipo y anillos que convergen hacia el Pokémon, la Mega Piedra que baja
 * con el símbolo mega girando y lanza su rayo, columna de luz en el destello y, en la onda, un aro que se abre. El
 * sprite (silueta blanca, mezcla base → mega y pulso) lo mueve GameScene; esto es solo lo de alrededor.
 */
export function drawMegaCine(g: Phaser.GameObjects.Graphics, f: MegaCineFrame, x: number, y: number, feetY: number, color: number, style: MegaFxStyle, t: number, low: boolean) {
  const light = lightOf(color);
  const top = Math.min(y - 46, feetY - 90);
  const stoneY = top - 30;
  const ph = f.phase;
  if (ph === 'done') return;
  // 1) viñeta de píxeles: el resto de la pantalla se oscurece y se cierra hacia el Pokémon
  const dim = ph === 'zoom' ? f.k : ph === 'release' ? 1 - f.k : 1;
  if (!low && dim > 0) {
    for (let r = 120; r <= 260; r += PX * 4) {
      const n = Math.round((r * 6.283) / (PX * 4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283;
        px(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, OUT, dim * 0.18 * ((r - 100) / 160), PX * 4);
      }
    }
  }
  // 2) carga: partículas del tipo en espiral hacia dentro y anillos que se cierran
  if (ph === 'zoom' || ph === 'charge') {
    const ck = ph === 'zoom' ? 0 : f.k;
    const n = low ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const life = ((t / 700 + i / n) % 1);
      const r = (1 - life) * (110 - ck * 30) + 10;
      const a = i * 2.39996 + life * 3.2;
      typeMote(g, style, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, color, light, t, i, Math.min(1, life * 3) * (0.4 + ck * 0.6));
    }
    if (!low) {
      for (let j = 0; j < 3; j++) {
        const rk = ((t / 520 + j / 3) % 1);
        const rr = (1 - rk) * 90 + 12;
        const m = Math.round((rr * 6.283) / (PX * 2));
        for (let i = 0; i < m; i += 2) {
          const a = (i / m) * 6.283;
          px(g, x + Math.cos(a) * rr, feetY - 6 + Math.sin(a) * rr * 0.4, j === 1 ? 0xffffff : light, rk * 0.7 * (0.3 + ck));
        }
      }
    }
  }
  // 3) Mega Piedra: baja girando, late y al final de la carga lanza su rayo; el símbolo gira detrás
  if (ph === 'zoom' || ph === 'charge' || ph === 'morph') {
    const sa = ph === 'zoom' ? f.k : ph === 'morph' ? 1 - f.k : 1;
    const drop = ph === 'zoom' ? (1 - f.k) * 40 : 0;
    const sy = stoneY - drop + Math.sin(t / 110) * 3;
    if (!low) drawMegaSymbol(g, x, sy, 22 + Math.sin(t / 80) * 2, t, sa * 0.75);
    drawMegaStone(g, x, sy, 12, 0x9ad8ff, t, sa);
    if (ph === 'charge' && f.k > 0.55) {
      const ba = (f.k - 0.55) / 0.45;
      for (let yy = sy + 14; yy < y; yy += PX) {
        const w = PX * (1 + Math.round(ba * 2)) + (Math.floor((yy + t / 20) / PX) % 3 === 0 ? PX : 0);
        g.fillStyle(yy % (PX * 3) === 0 ? 0xffffff : light, ba * 0.9).fillRect(snapTo(x, PX) - w / 2, snapTo(yy, PX) - PX / 2, w, PX);
      }
    }
  }
  // 4) destello: columna de luz y aro de símbolos mega alrededor de la silueta
  if (ph === 'morph' || (ph === 'burst' && f.k < 0.5)) {
    const a = ph === 'morph' ? 1 : 1 - f.k * 2;
    const w = PX * (low ? 6 : 10) + Math.abs(Math.sin(t / 50)) * PX * 2;
    for (let yy = feetY; yy > feetY - 260; yy -= PX) {
      const wob = Math.sin(yy * 0.15 + t * 0.03) * PX;
      g.fillStyle(yy % (PX * 4) === 0 ? 0xffffff : light, a * 0.5 * (1 - (feetY - yy) / 300)).fillRect(snapTo(x + wob, PX) - w / 2, snapTo(yy, PX) - PX / 2, w, PX);
    }
    if (!low) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * 6.283 + t * 0.006;
        px(g, x + Math.cos(ang) * 48, y + Math.sin(ang) * 30, MEGA_COLS[i % 3], a, PX * 2);
        px(g, x + Math.cos(ang) * 48, y + Math.sin(ang) * 30 - PX * 2, 0xffffff, a);
      }
    }
  }
  // 5) onda expansiva: aro doble que se abre al ras del suelo y destellos en cruz
  if (ph === 'burst' || ph === 'release') {
    const wk = ph === 'burst' ? f.k * 0.5 : 0.5 + f.k * 0.5;
    const rr = 20 + wk * (low ? 120 : 220);
    const m = Math.round((rr * 6.283) / PX);
    for (let i = 0; i < m; i++) {
      const a = (i / m) * 6.283;
      const c = i % 5 === 0 ? 0xffffff : i % 2 ? light : color;
      px(g, x + Math.cos(a) * rr, feetY + Math.sin(a) * rr * 0.45, c, 1 - wk);
      if (!low) px(g, x + Math.cos(a) * rr * 0.8, feetY + Math.sin(a) * rr * 0.36, light, (1 - wk) * 0.5);
    }
    if (!low && ph === 'burst') {
      const len = 30 + f.k * 50;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        for (let d = 8; d < len; d += PX) px(g, x + dx * d, y + dy * d * 0.8, d % (PX * 3) === 0 ? 0xffffff : light, 1 - f.k);
      }
    }
  }
}

/** Golpe de la onda expansiva (una vez): polvo empujado, escombros del color, estrellas y anillos. */
export function megaCineBurst(scene: Phaser.Scene, x: number, y: number, feetY: number, color: number, low: boolean, depth = 12) {
  pixRing(scene, x, feetY, low ? 110 : 200, color, low ? 320 : 520, depth);
  if (low) return;
  pixRing(scene, x, feetY, 140, 0xffffff, 420, depth);
  dustBurst(scene, x, feetY, 1.8, 16, depth - 1);
  pixDebris(scene, x, feetY - 10, color, 14, 1.6, depth);
  starBurst(scene, x, y, lightOf(color), 10, 1.6, depth + 1);
  const g = scene.add.graphics().setDepth(depth + 1);
  drawMegaSymbol(g, x, y - 60, 26, scene.time.now, 1);
  scene.tweens.add({ targets: g, alpha: 0, y: -16, duration: 700, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}
