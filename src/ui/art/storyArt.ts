// Arte de los eventos de sala (supervisor): el dibujo de cada historia con decisiones (mochila, nido, pozo, estatua…),
// el santuario de la Mega Piedra, el ladrón (antifaz y saco de monedas), las monedas que te roba, el pez que salta al
// pescar y el aura de la cacería legendaria. Todo en píxel gordo (PX) y con una pequeña animación en reposo; con pocos
// efectos (lowFx) se dibuja quieto y no se lanzan efectos sueltos. Solo dibujo: la lógica sigue en GameScene.
import Phaser from 'phaser';
import { lowFx } from '../theme';
import { starBurst } from './combatFx';
import { PX, animate, darkOf, lightOf, mixColor, pixRing } from './pixelFx';

const OUT = 0x18202c;
const GOLD = 0xffd34d;
const snap = (v: number) => Math.round(v / PX) * PX;
type G = Phaser.GameObjects.Graphics;
const box = (g: G, x: number, y: number, w: number, h: number, c: number, a = 1) =>
  g.fillStyle(c, a).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h)));
/** Caja con contorno, filo de luz arriba y sombra abajo. */
const slab = (g: G, x: number, y: number, w: number, h: number, c: number) => {
  box(g, x - PX / 2, y - PX / 2, w + PX, h + PX, OUT);
  box(g, x, y, w, h, c);
  box(g, x, y, w, PX, lightOf(c));
  box(g, x, y + h - PX, w, PX, darkOf(c));
};
/** Elipse rellena de píxeles (con contorno opcional). */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, c: number, a = 1, outline = true) {
  for (let y = snap(cy - ry - PX); y <= cy + ry + PX; y += PX) {
    for (let x = snap(cx - rx - PX); x <= cx + rx + PX; x += PX) {
      const d = ((x + PX / 2 - cx) / rx) ** 2 + ((y + PX / 2 - cy) / ry) ** 2;
      if (d <= 1) g.fillStyle(d > 0.7 && outline ? darkOf(c) : c, a).fillRect(x, y, PX, PX);
      else if (outline && d <= 1.35) g.fillStyle(OUT, a).fillRect(x, y, PX, PX);
    }
  }
}
const shadow = (g: G, cx: number, cy: number, rx: number) => blob(g, cx, cy, rx, rx * 0.3, 0x000000, 0.22, false);

/** Graphics que se redibuja solo cada `step` ms (quieto con pocos efectos); se para al destruirlo. */
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
/** Destello de cuatro puntas que aparece y se va (fase 0-1). */
function twinkle(g: G, x: number, y: number, k: number, c = 0xffffff) {
  const s = k < 0.5 ? k * 2 : 2 - k * 2;
  if (s <= 0.15) return;
  const r = Math.round(s * 2);
  box(g, x - PX / 2, y - PX / 2 - r * PX, PX, PX * (r * 2 + 1), c, 0.9);
  box(g, x - PX / 2 - r * PX, y - PX / 2, PX * (r * 2 + 1), PX, c, 0.9);
}

// --- Historias con decisiones ---

type StoryDraw = (g: G, x: number, y: number, t: number) => void;

const STORY: Record<string, StoryDraw> = {
  // Mochila olvidada: hebilla que brilla y una moneda asomando que se mueve
  mochila: (g, x, y, t) => {
    shadow(g, x, y + 30, 50);
    slab(g, x - 36, y - 24, 72, 54, 0xc0603a);
    slab(g, x - 30, y - 38, 60, 22, 0xa34a2b);
    box(g, x - 24, y - 50, 48, PX, OUT);
    box(g, x - 30, y - 46, PX, PX * 2, OUT);
    box(g, x + 24, y - 46, PX, PX * 2, OUT);
    slab(g, x - 24, y + 4, 48, 18, 0xd9774f);
    box(g, x - 6, y - 22, 12, 12, GOLD);
    if (Math.floor(t / 600) % 3 === 0) box(g, x - 6, y - 22, PX, PX, 0xffffff);
    const peek = Math.sin(t / 300) > 0 ? PX : 0;
    blob(g, x + 42, y + 22 - peek, 10, 10, GOLD);
    twinkle(g, x + 44, y + 12 - peek, (t / 900) % 1);
  },
  // Pokémon herido: se le ve respirar sobre un lecho de hojas, con tirita
  herido: (g, x, y, t) => {
    shadow(g, x, y + 28, 56);
    for (let k = -4; k <= 4; k++) box(g, x + k * 12 - 6, y + 18 + (k % 2) * 4, 14, 10, k % 2 ? 0x5fa64a : 0x3f7f35);
    const br = Math.sin(t / 420) > 0 ? PX : 0;
    blob(g, x, y + 2 - br / 2, 34, 20 + br / 2, 0xf0d9a8);
    blob(g, x - 30, y - 6, 14, 12, 0xf0d9a8);
    box(g, x - 36, y - 10, PX, PX, OUT);
    slab(g, x - 6, y - 8, 24, 12, 0xffffff);
    box(g, x + 4, y - 6, PX, PX * 2, 0xe53935);
    if (t && Math.floor(t / 900) % 2) box(g, x + 30, y - 30 - ((t / 40) % 18), PX, PX, 0xff8a80, 0.8);
  },
  // Viajero: tienda de campaña y hoguera que chisporrotea
  viajero: (g, x, y, t) => {
    shadow(g, x, y + 30, 64);
    for (let r = 0; r < 9; r++) box(g, x - 64 + (8 - r) * 4, y - 30 + r * PX, r * 8 + PX, PX, r === 8 ? darkOf(0x4f8fc0) : 0x4f8fc0);
    box(g, x - 30, y - 12, 12, 30, OUT);
    box(g, x + 28, y + 18, 36, PX, 0x6b4423);
    const f = Math.floor(t / 110) % 3;
    blob(g, x + 46, y + 8 - f * 2, 10, 14 + f * 2, 0xff7043, 1, false);
    blob(g, x + 46, y + 12, 6, 8, GOLD, 1, false);
    if (t) box(g, x + 40 + (f * 5) % 12, y - 14 - ((t / 30) % 24), PX, PX, GOLD, 0.8);
  },
  // Eco del pozo: brocal de piedra, cubo que se mece y ondas que suben
  eco: (g, x, y, t) => {
    shadow(g, x, y + 32, 52);
    slab(g, x - 44, y - 6, 88, 34, 0x8a8f9c);
    for (let k = 0; k < 4; k++) box(g, x - 40 + k * 22, y + 4 + (k % 2) * 10, 16, PX, darkOf(0x8a8f9c));
    box(g, x - 34, y - 6, 68, PX, 0x101828);
    box(g, x - 40, y - 60, PX * 2, 54, 0x6b4423);
    box(g, x + 28, y - 60, PX * 2, 54, 0x6b4423);
    slab(g, x - 46, y - 66, 92, PX * 2, 0x8f6a46);
    const sw = Math.round(Math.sin(t / 500) * 2) * PX;
    box(g, x + sw, y - 54, 2, 24, 0xd8c8a0);
    slab(g, x - 8 + sw, y - 32, 18, 14, 0x9a6b3a);
    if (t) {
      const k = (t / 1400) % 1;
      const r = 10 + k * 40;
      for (let a = 0; a < 6; a++) box(g, x + Math.cos(a) * r, y - 8 - k * 30 + Math.sin(a) * r * 0.3, PX, PX, 0xb3e5fc, 1 - k);
    }
  },
  // Fuente: pila con chorros que suben y caen
  fuente: (g, x, y, t) => {
    shadow(g, x, y + 30, 60);
    blob(g, x, y + 10, 56, 20, 0xb0b8c8);
    blob(g, x, y + 8, 44, 13, 0x29b6f6, 1, false);
    slab(g, x - 8, y - 34, 16, 40, 0xb0b8c8);
    for (let j = 0; j < 8; j++) {
      const k = ((t / 900) + j / 8) % 1;
      const s = j % 2 ? 1 : -1;
      box(g, x + s * k * 34, y - 40 - Math.sin(k * Math.PI) * 22 + k * 40, PX, PX, j % 3 ? 0x81d4fa : 0xffffff);
    }
    twinkle(g, x - 20, y + 6, (t / 1100) % 1);
  },
  // Gimnasio: estandarte con medalla que ondea
  gimnasio: (g, x, y, t) => {
    shadow(g, x, y + 32, 40);
    box(g, x - 34, y - 70, PX, 100, 0x6b4423);
    slab(g, x - 40, y + 26, 18, PX * 2, 0x8f6a46);
    for (let c = 0; c < 10; c++) {
      const w = Math.round(Math.sin(t / 220 + c * 0.7) * 0.8) * PX;
      box(g, x - 28 + c * PX, y - 66 + w, PX, 54, c % 9 ? 0xe53935 : darkOf(0xe53935));
    }
    blob(g, x + 2, y - 40 + Math.round(Math.sin(t / 220 + 3) * 0.8) * PX, 10, 10, GOLD);
    twinkle(g, x + 6, y - 46, (t / 1000) % 1);
  },
  // Nido con huevo que se balancea
  huevo: (g, x, y, t) => {
    shadow(g, x, y + 28, 54);
    blob(g, x, y + 14, 48, 16, 0x8f6a46);
    for (let k = -3; k <= 3; k++) box(g, x + k * 13, y + 4 + (k % 2) * 4, 16, PX, 0xc9a27a);
    const w = Math.round(Math.sin(t / 200) * (Math.floor(t / 1500) % 2)) * PX;
    blob(g, x + w, y - 12, 20, 26, 0xfff3d6);
    box(g, x - 8 + w, y - 22, 10, 8, 0x7fd18b);
    box(g, x + 6 + w, y - 4, 8, 8, 0x7fd18b);
    twinkle(g, x + 16 + w, y - 34, (t / 1300) % 1);
  },
  // Tormenta: nube negra con lluvia y relámpagos
  tormenta: (g, x, y, t) => {
    shadow(g, x, y + 30, 50);
    for (let d = 0; d < 10; d++) {
      const k = ((t / 500) + d * 0.37) % 1;
      box(g, x - 44 + d * 10, y - 30 + k * 56, 2, PX * 2, 0x81d4fa, 0.8);
    }
    const flash = t && Math.floor(t / 90) % 23 === 0;
    blob(g, x - 22, y - 44, 26, 18, flash ? 0x8890a8 : 0x4a5068);
    blob(g, x + 18, y - 48, 30, 22, flash ? 0x8890a8 : 0x4a5068);
    if (flash || !t) {
      const zz = [[4, -26], [-6, -12], [6, -12], [-4, 4]];
      zz.forEach(([dx, dy]) => box(g, x + dx, y + dy, PX * 2, 14, GOLD));
    }
  },
  // Apuesta: mesa con tres vasos y una moneda que pasa de uno a otro
  apuesta: (g, x, y, t) => {
    shadow(g, x, y + 32, 64);
    slab(g, x - 60, y + 2, 120, 18, 0x2e7d4f);
    box(g, x - 54, y + 20, PX, 12, 0x6b4423);
    box(g, x + 48, y + 20, PX, 12, 0x6b4423);
    const hop = Math.floor(t / 700) % 3;
    for (let c = 0; c < 3; c++) {
      const up = c === hop && t ? PX * 2 : 0;
      slab(g, x - 50 + c * 38, y - 24 - up, 24, 26, 0xc0603a);
      if (up || (!t && c === 1)) blob(g, x - 38 + c * 38, y - 2, 6, 5, GOLD);
    }
  },
  // Estatua antigua: piedra con ojos que se encienden
  estatua: (g, x, y, t) => {
    shadow(g, x, y + 32, 52);
    slab(g, x - 44, y + 6, 88, 22, 0x7d8494);
    for (let k = 0; k < 5; k++) box(g, x - 36 + k * 16, y + 14, PX, PX, mixColor(0x7d8494, 0x8fd3ff, k % 2 ? 0.6 : 0.2));
    slab(g, x - 22, y - 36, 44, 42, 0x9aa1b0);
    blob(g, x, y - 48, 20, 18, 0x9aa1b0);
    box(g, x - 22, y - 70, PX, PX * 2, 0x9aa1b0);
    box(g, x + 16, y - 70, PX, PX * 2, 0x9aa1b0);
    const glow = 0.4 + 0.6 * Math.abs(Math.sin(t / 700));
    box(g, x - 10, y - 52, PX, PX, 0xff5252, t ? glow : 0.7);
    box(g, x + 4, y - 52, PX, PX, 0xff5252, t ? glow : 0.7);
    box(g, x - 4, y - 20, PX * 2, PX, darkOf(0x9aa1b0));
  },
};

/** Dibujo de una historia con decisiones, apoyado en (x, y + 30). Si la historia no tiene dibujo, un cartel de madera. */
export function buildStoryArt(scene: Phaser.Scene, storyId: string, x: number, y: number): G {
  const draw: StoryDraw =
    STORY[storyId] ??
    ((g, sx, sy) => {
      shadow(g, sx, sy + 30, 40);
      box(g, sx - 3, sy - 10, PX, 40, 0x6b4423);
      slab(g, sx - 40, sy - 40, 80, 34, 0xc9a27a);
    });
  return live(scene, 2, (g, t) => {
    draw(g, x, y, t);
    // Signo de exclamación que bota: aquí pasa algo
    const b = t ? Math.round(Math.abs(Math.sin(t / 260)) * 2) * PX : 0;
    slab(g, x + 52, y - 84 - b, PX * 2, PX * 4, GOLD);
    slab(g, x + 52, y - 54 - b, PX * 2, PX * 2, GOLD);
  });
}

// --- Santuario de la Mega Piedra ---

/** Pedestal con runas que se encienden en ronda y la Mega Piedra flotando con su hélice y destellos. `have`: apagado. */
export function buildMegaShrine(scene: Phaser.Scene, x: number, y: number, have: boolean): G {
  const RUNE = have ? 0x555566 : 0x8fd3ff;
  return live(scene, 2, (g, t) => {
    shadow(g, x, y + 40, 64);
    slab(g, x - 56, y + 18, 112, 18, have ? 0x4a4a56 : 0x5d6a86);
    slab(g, x - 42, y - 8, 84, 28, have ? 0x55555f : 0x6e7c9c);
    slab(g, x - 50, y - 20, 100, 14, have ? 0x5f5f6a : 0x8592b0);
    const lit = have ? -1 : Math.floor(t / 260) % 5;
    for (let k = 0; k < 5; k++) {
      const rx = x - 34 + k * 16;
      const on = k === lit || !t;
      box(g, rx, y - 2, PX, PX * 2, on && !have ? 0xffffff : RUNE, have ? 0.5 : on ? 1 : 0.55);
      box(g, rx + (k % 2 ? PX : -PX), y + 4, PX, PX, RUNE, have ? 0.4 : 0.6);
    }
    if (have) return;
    // Luz que sube del pedestal
    for (let k = 0; k < 3; k++) {
      const p = ((t / 1400) + k / 3) % 1;
      box(g, x - 24 + k * 22, y - 26 - p * 40, PX, PX, 0xb3e5fc, 1 - p);
    }
    const by = y - 62 + (t ? Math.round(Math.sin(t / 450) * 1.5) * PX : 0);
    blob(g, x, by, 22, 22, 0x6ec6ff);
    blob(g, x - 4, by - 4, 13, 13, 0xa8e2ff, 1, false);
    // Hélice del símbolo mega: dos hebras que se cruzan y giran
    for (let s = -2; s <= 2; s++) {
      const ph = t / 300 + s;
      box(g, x + Math.round(Math.sin(ph) * 1.5) * PX - PX / 2, by + s * PX - PX / 2, PX, PX, 0xff7043);
      box(g, x - Math.round(Math.sin(ph) * 1.5) * PX - PX / 2, by + s * PX - PX / 2, PX, PX, 0xfff3d6);
    }
    box(g, x - 12, by - 14, PX, PX, 0xffffff);
    twinkle(g, x + 20, by - 18, (t / 1100) % 1);
    twinkle(g, x - 24, by + 10, (t / 1100 + 0.5) % 1, 0xb3e5fc);
  });
}

// --- Ladrón ---

/** Antifaz sobre los ojos y saco de monedas a la espalda, pegados al sprite del ladrón hasta que desaparece. */
export function thiefGear(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite): G {
  const g = scene.add.graphics();
  const tick = (time: number) => {
    if (!s.active) {
      scene.events.off('update', tick);
      g.destroy();
      return;
    }
    const w = s.displayWidth;
    const h = s.displayHeight;
    const dir = s.flipX ? 1 : -1;
    const bob = lowFx() ? 0 : Math.round(Math.sin(time / 90)) * 2;
    g.clear().setDepth(s.depth + 0.1);
    // Saco detrás, del lado contrario a donde mira
    const sx = s.x - dir * w * 0.42;
    const sy = s.y + h * 0.05 + bob;
    blob(g, sx, sy, 15, 15, 0xc9a27a);
    box(g, sx - 6, sy - 22, 12, PX, 0x8f6a46);
    box(g, sx - 3, sy - 6, PX, PX * 2, GOLD);
    box(g, sx - 6, sy - 3, PX * 2, PX / 2 + 1, GOLD);
    if (!lowFx() && Math.floor(time / 500) % 4 === 0) box(g, sx + 6, sy - 26, PX, PX, GOLD);
    // Antifaz: franja oscura con agujeros de ojos y las cintas que ondean
    const my = s.y - h * 0.2;
    box(g, s.x - w * 0.3, my - PX, w * 0.6, PX * 2, OUT);
    box(g, s.x - w * 0.18, my - PX / 2, PX, PX, 0xffffff, 0.9);
    box(g, s.x + w * 0.1, my - PX / 2, PX, PX, 0xffffff, 0.9);
    const tail = lowFx() ? 0 : Math.round(Math.sin(time / 70)) * 3;
    box(g, s.x - dir * w * 0.32 - (dir > 0 ? PX * 2 : 0), my - PX + tail, PX * 2, PX, OUT);
    box(g, s.x - dir * w * 0.32 - (dir > 0 ? PX * 3 : -PX), my + tail, PX * 2, PX, OUT);
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
  tick(scene.time.now);
  return g;
}

/** Monedas que salen del jugador en arco hacia el ladrón (sin nada con pocos efectos). */
export function coinsStolenFx(scene: Phaser.Scene, from: { x: number; y: number }, to: Phaser.GameObjects.Sprite, n = 6, depth = 9) {
  if (lowFx()) return;
  const tx = to.x;
  const ty = to.y;
  const coins = Array.from({ length: Math.min(10, Math.max(3, n)) }, (_, i) => ({ d: i * 0.06, h: 50 + ((i * 37) % 40), j: ((i * 53) % 30) - 15 }));
  animate(scene, depth, 900, (g, k) => {
    for (const c of coins) {
      const p = Math.max(0, Math.min(1, (k - c.d) / 0.7));
      if (p <= 0 || p >= 1) continue;
      const x = Phaser.Math.Linear(from.x, (to.active ? to.x : tx) + c.j, p);
      const y = Phaser.Math.Linear(from.y - 20, (to.active ? to.y : ty), p) - Math.sin(p * Math.PI) * c.h;
      const spin = Math.floor(p * 8) % 2;
      box(g, x - PX, y - PX, spin ? PX : PX * 2, PX * 2, OUT);
      box(g, x - PX + 1, y - PX + 1, spin ? PX - 2 : PX * 2 - 2, PX * 2 - 2, GOLD);
      if (!spin) box(g, x - PX + 2, y - PX + 2, 2, 2, 0xffffff);
    }
  }, 40);
  pixRing(scene, from.x, from.y, PX * 6, GOLD, 300, depth - 1);
}

// --- Pesca ---

// Pez de perfil mirando a la derecha (k contorno, b cuerpo, l vientre, d aletas, w ojo)
const FISH = [
  'dd...kkkk...',
  'ddd.kbbbbkk.',
  '.ddkbbbbbwkk',
  '..dbbbbbbkbk',
  '.ddkllllllk.',
  'ddd.kllllk..',
  'dd...kkkk...',
];

/** Un pez salta del agua (wx, wy) en arco hasta (x, y), con salpicón al salir y destello al caer. */
export function fishLeap(scene: Phaser.Scene, wx: number, wy: number, x: number, y: number, color = 0x4fc3f7, depth = 9) {
  if (lowFx()) return;
  const body = color;
  pixRing(scene, wx, wy, PX * 7, 0xb3e5fc, 380, 3);
  animate(scene, depth, 800, (g, k) => {
    // Gotas del salpicón
    for (let d = 0; d < 6; d++) {
      const a = Math.PI + (d / 5) * Math.PI;
      const r = 10 + k * 40;
      box(g, wx + Math.cos(a) * r, wy + Math.sin(a) * r * 0.8 + k * k * 60, PX, PX, d % 2 ? 0xffffff : 0x81d4fa, 1 - k);
    }
    const fx = Phaser.Math.Linear(wx, x, k);
    const fy = Phaser.Math.Linear(wy, y, k) - Math.sin(k * Math.PI) * 110;
    const dir = x >= wx ? 1 : -1;
    const tilt = (k - 0.5) * 1.6; // morro arriba al subir, abajo al caer
    const flap = Math.floor(k * 10) % 2;
    FISH.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = flap && c < 2 && (r === 0 || r === row.length) ? '.' : row[c];
        const col = ch === 'k' ? OUT : ch === 'b' ? body : ch === 'l' ? lightOf(body) : ch === 'd' ? darkOf(body) : ch === 'w' ? 0xffffff : -1;
        if (col < 0) continue;
        const cc = c - 5;
        box(g, fx + cc * PX * dir - PX / 2, fy + (r - 3) * PX - cc * tilt * PX * 0.5, PX, PX, col);
      }
    });
    if (k > 0.9) box(g, x - PX, y - PX, PX * 2, PX * 2, 0xffffff, (1 - k) * 10);
  }, 40);
  scene.time.delayedCall(780, () => starBurst(scene, x, y, 0xb3e5fc, 4, 0.9, depth + 1));
}

// --- Cacería legendaria ---

/**
 * Aura del legendario: anillo de runas que gira a sus pies del color de su tipo, columnas de luz que suben y destellos
 * que orbitan. Con pocos efectos, solo el anillo quieto. Se va sola cuando el sprite desaparece.
 */
export function legendAura(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, color: number, feet: () => number, depth = 1.8) {
  const g = scene.add.graphics().setDepth(depth);
  const top = scene.add.graphics().setDepth(s.depth + 0.2);
  const hi = lightOf(color);
  let last = -1;
  const tick = (time: number) => {
    if (!s.active) {
      scene.events.off('update', tick);
      g.destroy();
      top.destroy();
      return;
    }
    const low = lowFx();
    const t = low ? 0 : time;
    const step = Math.floor(t / 70);
    if (step === last && !low) return;
    last = step;
    g.clear();
    top.clear().setDepth(s.depth + 0.2);
    const cx = s.x;
    const cy = feet();
    const rx = s.displayWidth * 0.75;
    const ry = rx * 0.38;
    // Anillo con 12 runas que giran; una de cada tres brilla
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t / 1500;
      box(g, cx + Math.cos(a) * rx - PX / 2, cy + Math.sin(a) * ry - PX / 2, PX, PX, darkOf(color), 0.85);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - t / 2200;
      const on = (i + Math.floor(t / 250)) % 3 === 0;
      const px = cx + Math.cos(a) * rx * 0.72;
      const py = cy + Math.sin(a) * ry * 0.72;
      box(g, px - PX, py - PX / 2, PX * 2, PX, on ? 0xffffff : hi);
      box(g, px - PX / 2, py - PX * 1.5, PX, PX, on ? hi : color);
    }
    if (low) return;
    // Haces de luz que suben desde el anillo
    for (let k = 0; k < 4; k++) {
      const p = ((t / 1100) + k / 4) % 1;
      const a = k * 1.7 + Math.floor((t / 1100) + k / 4) * 2.3;
      const bx = cx + Math.cos(a) * rx * 0.85;
      const by = cy + Math.sin(a) * ry * 0.85;
      for (let j = 0; j < 4; j++) box(g, bx - PX / 2, by - p * 120 - j * PX, PX, PX, j ? color : 0xffffff, (1 - p) * (1 - j * 0.2));
    }
    // Destellos que orbitan delante del sprite (la mitad de abajo de la órbita)
    for (let k = 0; k < 3; k++) {
      const a = t / 700 + (k * Math.PI * 2) / 3;
      if (Math.sin(a) < 0) continue;
      twinkle(top, cx + Math.cos(a) * rx, cy - s.displayHeight * 0.4 + Math.sin(a) * ry, ((t / 600) + k / 3) % 1, k ? hi : 0xffffff);
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
  tick(scene.time.now);
}
