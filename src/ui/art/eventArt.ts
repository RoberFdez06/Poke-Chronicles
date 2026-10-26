// Arte de las salas de evento (supervisor): tragaperras, laguna de pesca y forja. Todo en píxel gordo (PX) y con vida
// propia en reposo: luces que corren, ondas en el agua, llamas y chispas. Cada builder devuelve un Graphics que se
// puede guardar como cualquier objeto de sala; al destruirlo se para su temporizador. Con pocos efectos se dibuja
// un único fotograma y se refresca despacio.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { PX, darkOf, lightOf, mixColor } from './pixelFx';

const OUT = 0x18202c;
const snap = (v: number) => Math.round(v / PX) * PX;
const box = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number, a = 1) =>
  g.fillStyle(c, a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h)));
/** Caja con contorno oscuro y un filo de luz arriba, el aspecto del resto del arte. */
const slab = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number) => {
  box(g, x - PX / 2, y - PX / 2, w + PX, h + PX, OUT);
  box(g, x, y, w, h, c);
  box(g, x, y, w, PX, lightOf(c));
  box(g, x, y + h - PX, w, PX, darkOf(c));
};

function live(scene: Phaser.Scene, depth: number, draw: (g: Phaser.GameObjects.Graphics, t: number) => void, step = 90): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const tick = () => {
    g.clear();
    draw(g, lowFx() ? 0 : scene.time.now);
  };
  tick();
  const ev = scene.time.addEvent({ delay: lowFx() ? 600 : step, loop: true, callback: () => g.active && tick() });
  g.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
  return g;
}

/**
 * Tragaperras de la sala de juegos, centrada en (cx, cy): cuerpo con rótulo y bombillas que corren, ventana de los rodillos
 * (los símbolos los pone el texto de GameScene encima), palanca que sube y baja, y bandeja de monedas que brilla.
 * `g.setData('hot', true)` acelera las luces (mientras giran los rodillos).
 */
export function buildSlotArt(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.Graphics {
  return live(scene, 2, (g, t) => {
    const hot = !!g.getData('hot');
    const x0 = snap(cx - 130);
    const y0 = snap(cy - 110);
    // sombra y patas
    box(g, x0 + PX, y0 + 132, 252, PX * 2, 0x000000, 0.25);
    slab(g, x0 + PX * 3, y0 + 116, PX * 3, PX * 3, 0x4a3a3a);
    slab(g, x0 + 260 - PX * 6, y0 + 116, PX * 3, PX * 3, 0x4a3a3a);
    // cuerpo
    slab(g, x0, y0, 260, 126, 0x5b3a3a);
    box(g, x0 + PX, y0 + PX * 2, PX, 100, lightOf(0x5b3a3a), 0.4);
    // rótulo con bombillas
    slab(g, x0 + PX, y0 + PX, 260 - PX * 2, PX * 4, 0xff7043);
    const n = 20;
    const phase = Math.floor(t / (hot ? 70 : 220));
    for (let k = 0; k < n; k++) {
      const on = (k + phase) % 3 === 0;
      box(g, x0 + PX * 2 + k * 12, y0 + PX * 2, PX, PX, on ? 0xfff59d : 0x8d4a2f);
      if (on && !lowFx()) box(g, x0 + PX * 2 + k * 12 - 2, y0 + PX * 2 - 2, PX + 4, PX + 4, 0xfff59d, 0.25);
    }
    // ventana de los rodillos
    slab(g, x0 + PX * 3, y0 + PX * 7, 260 - PX * 6, PX * 11, 0x2a1f1f);
    box(g, x0 + PX * 4, y0 + PX * 8, 260 - PX * 8, PX * 9, 0xfdf6e3);
    for (const dx of [-36, 36]) box(g, cx + dx - 2, y0 + PX * 8, 4, PX * 9, 0xb0a58a);
    box(g, x0 + PX * 4, y0 + PX * 8, 260 - PX * 8, PX, 0xffffff, 0.6);
    box(g, x0 + PX * 4, y0 + PX * 16, 260 - PX * 8, PX, 0xb0a58a);
    // destello que cruza el cristal
    const sweep = (t / 25) % 520;
    if (!lowFx() && sweep < 260 - PX * 8) box(g, x0 + PX * 4 + sweep, y0 + PX * 8, PX, PX * 9, 0xffffff, 0.35);
    // panel inferior y bandeja de monedas
    slab(g, x0 + PX * 3, y0 + PX * 20, 260 - PX * 6, PX * 2, 0x3a2626);
    slab(g, cx - 36, y0 + 108, 72, PX * 2, 0x2a1f1f);
    const glint = Math.floor(t / 400) % 4;
    for (let k = 0; k < 4; k++) box(g, cx - 24 + k * 14, y0 + 112, PX, PX, k === glint ? 0xfff9c4 : 0xffd34d);
    // palanca a la derecha: sube y baja despacio; con 'hot' cae del todo
    const pull = hot ? 1 : (Math.sin(t / 1200) + 1) / 2 > 0.92 ? 1 : 0;
    const bx = x0 + 260 + PX * 2;
    box(g, bx, y0 + PX * 6, PX, PX * 6, 0x9aa3b4);
    const knobY = y0 + PX * 3 + pull * PX * 8;
    box(g, bx + PX / 2 - 2, y0 + PX * 5, PX / 2, PX * 8, OUT, 0.0);
    slab(g, bx - PX, knobY - PX, PX * 3, PX * 3, 0xe53935);
    box(g, bx - PX + PX / 2, knobY - PX + PX / 2, PX, PX, 0xff8a80);
  }, 70);
}

/**
 * Laguna de pesca centrada en (cx, cy - 20), de 300x150: orilla de píxeles con juncos que se mecen, agua en tres tonos,
 * ondas que se abren, destellos, un nenúfar y la sombra de un pez que nada despacio.
 */
export function buildLagoonArt(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.Graphics {
  const wy = cy - 20;
  return live(scene, 2, (g, t) => {
    const rx = 150;
    const ry = 75;
    const inside = (x: number, y: number, k: number) => ((x - cx) / (rx * k)) ** 2 + ((y - wy) / (ry * k)) ** 2 <= 1;
    for (let y = snap(wy - ry - PX); y <= wy + ry + PX; y += PX) {
      for (let x = snap(cx - rx - PX); x <= cx + rx + PX; x += PX) {
        let c: number | null = null;
        if (inside(x, y, 1.0)) c = 0x0d47a1;
        if (inside(x, y, 0.95)) c = 0x1976d2;
        if (inside(x, y, 0.82)) c = 0x29b6f6;
        if (inside(x, y, 0.55)) c = 0x4fc3f7;
        if (c === null && inside(x, y, 1.08)) c = 0x8d6e63; // orilla
        if (c === null) continue;
        box(g, x, y, PX, PX, c);
      }
    }
    // olas que recorren el agua: filas de píxeles claros que se desplazan
    for (let k = 0; k < 6; k++) {
      const yy = snap(wy - ry * 0.6 + k * 26);
      const off = Math.floor((t / 380 + k * 3) % 8) * PX;
      for (let x = cx - rx * 0.8 + off; x < cx + rx * 0.8; x += PX * 8) {
        if (inside(x, yy, 0.8)) box(g, x, yy, PX * 2, PX, 0xb3e5fc, 0.75);
      }
    }
    if (!lowFx()) {
      // ondas de pez/gota: tres anillos que nacen en sitios fijos y se abren por turnos
      for (let k = 0; k < 3; k++) {
        const cycle = 2400;
        const age = ((t + k * 800) % cycle) / cycle;
        const ox = cx + [-70, 40, 80][k];
        const oy = wy + [10, -24, 18][k];
        const r = age * 34;
        for (let a = 0; a < Math.PI * 2; a += 0.35) {
          box(g, ox + Math.cos(a) * r, oy + Math.sin(a) * r * 0.5, PX, PX, 0xe1f5fe, (1 - age) * 0.9);
        }
      }
      // sombra de pez
      const fx = cx + Math.sin(t / 3600) * 90;
      const fy = wy + 20 + Math.sin(t / 2300) * 14;
      const dir = Math.cos(t / 3600) > 0 ? 1 : -1;
      for (let i = 0; i < 6; i++) box(g, fx - dir * i * PX, fy + (i < 4 ? 0 : (i - 4) * PX * (Math.sin(t / 200) > 0 ? 1 : -1)), PX, PX * (i === 2 ? 2 : 1), 0x0b3d91, 0.55);
      // destellos
      for (let k = 0; k < 5; k++) {
        const on = Math.floor(t / 300 + k * 2) % 7 === 0;
        if (on) box(g, cx - 100 + k * 50, wy - 30 + ((k * 37) % 60), PX, PX, 0xffffff);
      }
    }
    // nenúfar
    const lx = cx - 90;
    const ly = wy + 30 + (lowFx() ? 0 : Math.sin(t / 900) * 3);
    box(g, lx, ly, PX * 4, PX * 2, 0x2e7d32);
    box(g, lx + PX, ly, PX * 2, PX, 0x66bb6a);
    box(g, lx + PX * 3, ly + PX * 2, PX, PX, 0xf48fb1);
    // juncos a los lados, mecidos por el viento
    for (const [bx, by, h] of [[cx - rx - 6, wy + 30, 5], [cx - rx + 12, wy + 40, 4], [cx + rx + 6, wy + 24, 5], [cx + rx - 12, wy + 36, 4]] as const) {
      const sway = lowFx() ? 0 : Math.round(Math.sin(t / 700 + bx) * 1.2) * PX / 2;
      for (let i = 0; i < h; i++) box(g, bx + (i > 2 ? sway : 0), by - i * PX, PX, PX, i === h - 1 ? 0x8d6e63 : 0x558b2f);
    }
  }, 120);
}

/**
 * Forja centrada en (x, y): yunque con una barra al rojo, horno a un lado con llamas de tres tonos que bailan,
 * chispas que suben y un temblor de calor encima. `g.setData('strike', t)` (en ms de escena) lanza una lluvia de chispas.
 */
export function buildForgeArt(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  return live(scene, 2, (g, t) => {
    // yunque
    const ax = x - 70;
    box(g, ax - PX * 7, y + 34, PX * 14, PX, 0x000000, 0.25);
    slab(g, ax - PX * 2, y + PX * 2, PX * 4, PX * 4, 0x4a4a55);
    slab(g, ax - PX * 3, y + PX * 6, PX * 6, PX * 2, 0x3a3a44);
    slab(g, ax - PX * 6, y - PX * 2, PX * 12, PX * 3, 0x6d6d78);
    box(g, ax + PX * 6, y - PX, PX * 3, PX, 0x6d6d78); // cuerno
    box(g, ax - PX * 5, y - PX * 2, PX * 10, PX / 2 + 2, 0xb8bcc8);
    // barra al rojo sobre el yunque: respira
    const heat = lowFx() ? 0.7 : (Math.sin(t / 500) + 1) / 2;
    const hot = mixColor(0xe65100, 0xffd54f, heat);
    slab(g, ax - PX * 4, y - PX * 4, PX * 7, PX * 2, hot);
    box(g, ax - PX * 4, y - PX * 4, PX * 7, PX, 0xfff3b0, 0.4 + heat * 0.3);
    // horno
    const hx = x + 40;
    slab(g, hx - PX * 6, y - PX * 6, PX * 12, PX * 12, 0x4e342e);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2 === 0) box(g, hx - PX * 6 + PX * (1 + c * 3), y - PX * 5 + PX * (1 + r * 3), PX * 2, PX, darkOf(0x4e342e));
    slab(g, hx - PX * 4, y - PX * 2, PX * 8, PX * 6, 0x1c1010);
    // llamas en la boca del horno: tres capas que parpadean con el tiempo
    const f = Math.floor(t / 110);
    for (let i = 0; i < 6; i++) {
      const hgt = PX * (2 + ((f * 3 + i * 5) % 4));
      const fx = hx - PX * 3 + i * PX * 1.3;
      box(g, fx, y + PX * 4 - hgt, PX, hgt, 0xe65100);
      box(g, fx, y + PX * 4 - hgt * 0.7, PX, hgt * 0.7, 0xff9800);
      if (i % 2 === (f % 2)) box(g, fx, y + PX * 4 - hgt * 0.4, PX, hgt * 0.4, 0xfff176);
    }
    box(g, hx - PX * 4, y + PX * 4, PX * 8, PX, 0xffb74d, 0.5);
    // chimenea y humo
    slab(g, hx - PX * 2, y - PX * 10, PX * 4, PX * 4, 0x5d4037);
    if (!lowFx()) {
      for (let k = 0; k < 4; k++) {
        const age = ((t + k * 700) % 2800) / 2800;
        box(g, hx + Math.sin(age * 6 + k) * PX, y - PX * 10 - age * 90, PX * (1 + Math.round(age * 2)), PX * (1 + Math.round(age * 2)), 0xcfd8dc, (1 - age) * 0.5);
      }
      // chispas sueltas que suben del horno
      for (let k = 0; k < 6; k++) {
        const age = ((t + k * 380) % 2300) / 2300;
        box(g, hx - PX * 3 + ((k * 29) % 36) + Math.sin(age * 9 + k) * PX, y + PX * 2 - age * 70, PX / 2 + 2, PX / 2 + 2, age < 0.5 ? 0xffd54f : 0xff7043, 1 - age);
      }
      // golpe de martillo: lluvia de chispas desde la barra
      const strike = g.getData('strike') as number | undefined;
      if (strike !== undefined) {
        const a = (t - strike) / 700;
        if (a >= 0 && a <= 1) {
          for (let k = 0; k < 12; k++) {
            const ang = -Math.PI * (0.1 + (k / 12) * 0.8);
            const d = a * (30 + (k % 3) * 18);
            box(g, ax + Math.cos(ang) * d, y - PX * 4 + Math.sin(ang) * d + a * a * 40, PX / 2 + 2, PX / 2 + 2, k % 2 ? 0xfff176 : 0xff8a65, 1 - a);
          }
        }
      }
    }
  }, 90);
}
