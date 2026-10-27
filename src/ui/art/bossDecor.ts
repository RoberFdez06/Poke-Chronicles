// Decoración ambiental de la arena del jefe según su tema (arenaPhase.FallTheme): props pixel art propios de cada
// legendario/tipo repartidos por los bordes de toda la arena (no estorban: sin colisión). Posiciones por semilla; con
// pocos efectos, quietos. Se puede cambiar de tema (al cambiar de fase la arena se transforma entera).
import Phaser from 'phaser';
import type { FallTheme } from '../../level/arenaPhase';
import { mulberry32 } from '../../level/floorGen';
import { darkOf, lightOf } from './pixelFx';

type G = Phaser.GameObjects.Graphics;
const OUT = 0x101828;
const sn = (v: number, s = 4) => Math.round(v / s) * s;

/** Paleta de cada tema: [base, luz, acento]. */
const PAL: Record<FallTheme, [number, number, number]> = {
  lava: [0x5a2010, 0xff8a30, 0xffe066], inundada: [0x1e5a8a, 0x7ec8ff, 0xffffff], hielo: [0x6ab0e0, 0xdff4ff, 0xffffff],
  raices: [0x4a3018, 0x6ab84a, 0xffd34d], ruinas: [0x6a6058, 0xa89c8c, 0xff9a4a], tiempo: [0x2a4a6a, 0x7fd4ff, 0xc0f0ff],
  espacio: [0x2a1a4a, 0xff7ad8, 0xffffff], distorsion: [0x2a2034, 0xc04aff, 0x7aff9a], cielo: [0xe8f4ff, 0x6aff8a, 0xffffff],
  mar: [0x0e4a7a, 0x4ad0ff, 0xe0ffff], magma: [0x3a1408, 0xff5a1f, 0xffd040], creacion: [0xd8c890, 0xfff0a0, 0xffffff],
  arcoiris: [0x8a4a1a, 0xffb04a, 0xff5a7a], tormenta: [0x3a4050, 0xffe94a, 0xffffff], psique: [0x4a2a5a, 0xff70d0, 0xffd0ff],
};

/** Un prop del tema en (x, y) con tamaño de píxel q; `t` anima. */
function prop(g: G, th: FallTheme, x: number, y: number, q: number, t: number, k: number) {
  const [b, l, a] = PAL[th];
  const tw = 0.5 + 0.5 * Math.sin(t / 300 + k);
  const r = (dx: number, dy: number, w: number, h: number, c: number, al = 1) => g.fillStyle(c, al).fillRect(sn(x + dx * q, 2), sn(y + dy * q, 2), w * q, h * q);
  // Sombra común
  g.fillStyle(0x000000, 0.18).fillEllipse(x, y + 3 * q, 9 * q, 3 * q);
  switch (th) {
    case 'lava': case 'magma': // roca volcánica con grieta incandescente y brasa
      r(-4, -3, 8, 6, OUT); r(-3, -2, 6, 4, b); r(-1, -2, 1, 4, l, 0.6 + 0.4 * tw); r(1, 0, 2, 1, a, tw);
      r(-1, -6 - (t / 120 + k) % 4, 1, 1, l, 0.8); break;
    case 'hielo': // cristal de hielo
      r(-1, -8, 3, 11, OUT); r(0, -7, 1, 9, l); r(-4, -4, 2, 7, OUT); r(-3, -3, 1, 5, b); r(3, -5, 2, 8, OUT); r(3, -4, 1, 6, l);
      r(0, -7, 1, 1, a, tw); break;
    case 'raices': // raíz retorcida con brote
      r(-5, 0, 10, 2, OUT); r(-4, 0, 8, 1, b); r(-5, -2, 2, 2, b); r(3, -3, 2, 3, b); r(3, -5, 2, 2, l); r(4, -6, 1, 1, a, tw); break;
    case 'inundada': case 'mar': // alga y burbujas
      r(-1, -7, 2, 9, OUT); r(-1, -6 + (k % 2), 1, 8, l); r(1, -4, 1, 3, b); r(2, -10 - (t / 90 + k * 3) % 6, 1, 1, a, 0.8); r(-3, -12 - (t / 140 + k) % 5, 1, 1, a, 0.6); break;
    case 'ruinas': // columna rota con musgo
      r(-3, -7, 6, 9, OUT); r(-2, -6, 4, 8, l); r(-2, -6, 1, 8, b); r(-3, -8, 3, 1, l); r(1, 1, 2, 1, 0x5a8a3a); break;
    case 'tiempo': { // engranaje-reloj que gira
      g.fillStyle(OUT, 1).fillCircle(x, y - 3 * q, 4 * q); g.fillStyle(b, 1).fillCircle(x, y - 3 * q, 3 * q);
      for (let i = 0; i < 6; i++) { const an = t / 900 + (i / 6) * Math.PI * 2; g.fillStyle(l, 1).fillRect(sn(x + Math.cos(an) * 4 * q) - q / 2, sn(y - 3 * q + Math.sin(an) * 4 * q) - q / 2, q, q); }
      const h = t / 400; g.lineStyle(2, a, 1).lineBetween(x, y - 3 * q, x + Math.cos(h) * 2.4 * q, y - 3 * q + Math.sin(h) * 2.4 * q); break;
    }
    case 'espacio': // estrella titilante sobre roca flotante
      r(-3, 0, 6, 2, b); r(-2, 2, 4, 1, OUT); r(0, -6, 1, 3, a, tw); r(-1, -5, 3, 1, a, tw); r(-3, -9, 1, 1, l, 1 - tw); break;
    case 'distorsion': // fragmento de suelo flotante invertido
      { const fy = Math.sin(t / 500 + k) * 2; r(-4, -6 + fy, 8, 3, OUT); r(-3, -5 + fy, 6, 1, l); r(-2, -3 + fy, 4, 2, b); r(0, -9 + fy, 1, 1, a, tw); } break;
    case 'cielo': // nube
      r(-5, -2, 10, 3, OUT); r(-4, -3, 8, 3, b); r(-2, -5, 4, 2, b); r(-4, -1, 8, 1, lightOf(b)); r(3, -4, 1, 1, l, tw); break;
    case 'creacion': // flor dorada
      r(0, -4, 1, 6, 0x5a8a3a); r(-1, -6, 3, 3, OUT); r(-1, -6, 1, 1, l); r(1, -6, 1, 1, l); r(0, -5, 1, 1, a, 0.6 + 0.4 * tw); r(-2, -5, 1, 1, l); r(2, -5, 1, 1, l); break;
    case 'arcoiris': // pluma de fuego sagrado
      r(-1, -7, 2, 8, OUT); r(0, -6, 1, 6, l); r(1, -5, 1, 3, a); r(-1, -4, 1, 2, b); r(0, -8, 1, 1, 0xffffff, tw); break;
    case 'tormenta': // pararrayos con chispa
      r(-1, -9, 2, 11, OUT); r(0, -8, 1, 9, 0x8a94a8); r(-2, 1, 4, 1, b); if (tw > 0.7) { r(1, -10, 1, 1, l); r(2, -11, 1, 1, a); } break;
    case 'psique': // orbe psíquico flotante
      { const fy = Math.sin(t / 420 + k) * 2; g.fillStyle(OUT, 1).fillCircle(x, y - 5 * q + fy * q, 3 * q); g.fillStyle(l, 0.8).fillCircle(x, y - 5 * q + fy * q, 2.2 * q); g.fillStyle(a, tw).fillRect(x - q, y - 6 * q + fy * q, q, q); } break;
  }
}

export interface BossDecorOpts { x0: number; y0: number; w: number; h: number; theme: FallTheme; seed: number; low?: boolean }

/** Decoración del tema por los bordes de toda la arena. */
export function bossDecor(sc: Phaser.Scene, o: BossDecorOpts) {
  const g = sc.add.graphics().setDepth(0.46);
  const t0 = sc.time.now;
  let theme = o.theme;
  let spots: { x: number; y: number; q: number }[] = [];
  const layout = () => {
    const rng = mulberry32((o.seed ^ theme.length * 0x9e37) >>> 0);
    // Cuantas más salas, más props: bandas de 90 px por dentro de las paredes y algunos sueltos lejos del centro
    const n = Math.round(((o.w + o.h) / 70) * (o.low ? 0.6 : 1));
    spots = [];
    for (let i = 0; i < n; i++) {
      const side = Math.floor(rng() * 4);
      const u = rng();
      const d = 24 + rng() * 70;
      const x = side < 2 ? o.x0 + 30 + u * (o.w - 60) : side === 2 ? o.x0 + d : o.x0 + o.w - d;
      const y = side >= 2 ? o.y0 + 40 + u * (o.h - 60) : side === 0 ? o.y0 + d + 20 : o.y0 + o.h - d;
      spots.push({ x, y, q: rng() < 0.25 ? 6 : 4 });
    }
    for (let i = 0; i < Math.round(n / 4); i++) {
      const x = o.x0 + 60 + rng() * (o.w - 120);
      const y = o.y0 + 60 + rng() * (o.h - 120);
      if (Math.hypot((x - o.x0 - o.w / 2) / o.w, (y - o.y0 - o.h / 2) / o.h) > 0.22) spots.push({ x, y, q: 4 });
    }
    spots.sort((a, b) => a.y - b.y);
  };
  // Manchas de suelo del tema (pixel, por debajo de los props)
  const paint = () => {
    const t = sc.time.now - t0;
    g.clear();
    const [b] = PAL[theme];
    spots.forEach((s, k) => { if (k % 3 === 0) g.fillStyle(darkOf(b), 0.18).fillRect(sn(s.x - 18, 6), sn(s.y - 4, 6), 36, 12); });
    spots.forEach((s, k) => prop(g, theme, s.x, s.y, s.q, o.low ? 0 : t, k));
  };
  layout();
  paint();
  const timer = o.low ? undefined : sc.time.addEvent({ delay: 90, loop: true, callback: paint });
  return {
    g,
    setTheme(th: FallTheme) {
      if (th === theme) return;
      theme = th;
      layout();
      paint();
    },
    destroy() {
      timer?.remove();
      g.destroy();
    },
  };
}
