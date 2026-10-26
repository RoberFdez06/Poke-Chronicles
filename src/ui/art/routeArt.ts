// Elegir ruta (supervisor): mapa con el camino que se bifurca desde tu posición hacia cada carta (con pasos que
// avanzan), estampa del bioma en cada carta (bosque, cueva, mar, volcán, torre, ciudad, nieve, pantano, cumbre) con
// su pequeña animación, e icono del premio que flota. Solo dibujo: las rutas salen de level/routes.ts.
import type Phaser from 'phaser';
import { darkOf, lightOf, mixColor } from './pixelFx';
import { OUT, live, stamp, twinkle } from './menuArt';

export interface BiomeLook {
  id: string;
  colors: { floor: number; wall: number; rock: number; rockTop: number; puddle: number; bush: number };
}

/** Camino del mapa: de (sx, sy) a la parte de arriba de cada carta, con codo, puntos y pasos que avanzan. */
export function addRouteMap(scene: Phaser.Scene, sx: number, sy: number, ends: { x: number; y: number; hard: boolean }[]) {
  const g = scene.add.graphics();
  const paths = ends.map((e) => {
    const my = Math.round((sy + e.y) / 2);
    return [[sx, sy], [sx, my], [e.x, my], [e.x, e.y]] as const;
  });
  return live(scene, g, (t) => {
    paths.forEach((p, i) => {
      const hard = ends[i].hard;
      for (let s = 0; s < 3; s++) {
        const [x1, y1] = p[s];
        const [x2, y2] = p[s + 1];
        const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
        for (let d = 0; d <= len; d += 10) {
          const f = len ? d / len : 0;
          const x = Math.round((x1 + (x2 - x1) * f) / 2) * 2;
          const y = Math.round((y1 + (y2 - y1) * f) / 2) * 2;
          g.fillStyle(OUT, 1).fillRect(x - 4, y - 4, 8, 8);
          g.fillStyle(hard ? 0xf0a090 : 0xd8f0b0, 1).fillRect(x - 2, y - 2, 4, 4);
        }
      }
      // Paso que recorre el camino
      const total = p.slice(1).reduce((s, q, k) => s + Math.abs(q[0] - p[k][0]) + Math.abs(q[1] - p[k][1]), 0);
      let d = ((t / 1400 + i * 0.27) % 1) * total;
      for (let s = 0; s < 3; s++) {
        const [x1, y1] = p[s];
        const [x2, y2] = p[s + 1];
        const l = Math.abs(x2 - x1) + Math.abs(y2 - y1);
        if (d <= l) {
          const f = l ? d / l : 0;
          const x = Math.round((x1 + (x2 - x1) * f) / 2) * 2;
          const y = Math.round((y1 + (y2 - y1) * f) / 2) * 2;
          g.fillStyle(0xffffff, 1).fillRect(x - 3, y - 3, 6, 6);
          break;
        }
        d -= l;
      }
    });
    // Marcador «estás aquí»: chincheta roja que bota
    const bob = Math.round(Math.sin(t / 220) * 1.5) * 2;
    g.fillStyle(0x000000, 0.35).fillEllipse(sx, sy + 4, 18, 6);
    stamp(g, sx - 10, sy - 22 + bob, ['.kkk.', 'kRRWk', 'kRRRk', 'kRRRk', '.kRk.', '..k..'], { k: OUT, R: 0xe04848, W: 0xffffff }, 4);
  }, 70);
}

/** Estampa del bioma (x, y = esquina; w × h), viva: hojas, gotas, olas, humo, nieve… */
export function addBiomeVignette(scene: Phaser.Scene, x: number, y: number, w: number, h: number, b: BiomeLook) {
  const g = scene.add.graphics();
  const c = b.colors;
  const sky = mixColor(c.wall, 0x9fd0ff, b.id === 'cueva' || b.id === 'torre' ? 0.15 : 0.55);
  return live(scene, g, (t) => {
    g.fillStyle(OUT, 1).fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle(sky, 1).fillRect(x, y, w, h);
    g.fillStyle(lightOf(sky), 1).fillRect(x, y, w, 4);
    const gy = y + h - 18;
    const cx = x + w / 2;
    const em = (rows: string[], px: number, py: number, pal: Record<string, number>, s = 4) => stamp(g, px, py, rows, { k: OUT, ...pal }, s);
    /** Estampa centrada en `px` y apoyada en el suelo. */
    const big = (rows: string[], px: number, pal: Record<string, number>, s = 6) => em(rows, Math.round(px - (rows[0].length * s) / 2), gy - rows.length * s + 2, pal, s);
    switch (b.id) {
      case 'bosque':
        for (let i = 0; i < 5; i++) {
          const tx = x + 14 + i * 44;
          const sway = Math.round(Math.sin(t / 400 + i) * 1) * 2;
          em(['..kk..', '.kGGk.', 'kGgGGk', 'kGGGgk', '.kkkk.', '..bb..', '..bb..'], tx + sway, gy - 26 + (i % 2) * 4, { G: c.bush === 0xffffff ? 0x3fa34d : c.bush, g: 0x2f7a3a, b: 0x7a5232 });
        }
        break;
      case 'cueva':
        for (let i = 0; i < 8; i++) g.fillStyle(c.rock, 1).fillRect(x + i * 28, y, 16, 10 + (i % 3) * 8).fillRect(x + i * 28 + 4, y + 10 + (i % 3) * 8, 8, 6);
        {
          const k = (t / 900) % 1;
          g.fillStyle(c.puddle, 1 - k).fillRect(x + 60, y + 24 + k * 20, 4, 6);
          g.fillStyle(c.puddle, 1).fillRect(x + 52, gy + 4, 20, 4);
        }
        break;
      case 'mar':
        g.fillStyle(c.puddle, 1).fillRect(x, gy - 12, w, 30);
        for (let i = -1; i < 9; i++) {
          const wx = x + i * 28 + ((t / 60) % 28);
          if (wx > x - 4 && wx < x + w - 12) g.fillStyle(0xffffff, 0.9).fillRect(wx, gy - 12 + (i % 2) * 8, 12, 4);
        }
        em(['..kkk..', '.kYYYk.', 'kYYWYYk', 'kYYYYYk', '.kYYYk.', '..kkk..'], cx + 50, y + 6, { Y: 0xffe066, W: 0xffffff });
        break;
      case 'volcan':
        big(['....kkkkkk....', '...kRRRRRRk...', '...kbRRRRbk...', '..kbbbRRbbbk..', '..kbbbbRbbbk..', '.kbbbbbbbbbbk.', 'kbbbbbbbbbbbbk'], cx, { R: 0xff7a2a, b: c.wall }, 5);
        for (let i = 0; i < 3; i++) {
          const k = ((t / 1100 + i / 3) % 1);
          g.fillStyle(0x6e5656, 1 - k).fillRect(Math.round(cx - 6 + Math.sin(k * 6 + i) * 6), Math.round(gy - 40 - k * 22), 10 - k * 4, 8 - k * 4);
        }
        break;
      case 'torre':
        big(['.k.kk.k.', '.kkkkkk.', '.kTTTTk.', '.kTyyTk.', '.kTTTTk.', '.kTyyTk.', '.kTTTTk.', 'kTTTTTTk'], cx, { T: c.rockTop, y: (Math.floor(t / 500) % 2) ? 0xffe066 : 0x9b7ff0 }, 6);
        twinkle(g, x + 30, y + 14, 0xffffff, 0.6 + 0.4 * Math.sin(t / 300), 2);
        twinkle(g, x + w - 34, y + 22, 0xffffff, 0.6 + 0.4 * Math.cos(t / 300), 2);
        break;
      case 'ciudad':
        for (let i = 0; i < 6; i++) {
          const bh = 16 + ((i * 13) % 20);
          g.fillStyle(OUT, 1).fillRect(x + 8 + i * 36, gy - bh, 30, bh);
          g.fillStyle(c.rock, 1).fillRect(x + 10 + i * 36, gy - bh + 2, 26, bh - 2);
          const on = (Math.floor(t / 700) + i) % 3 !== 0;
          g.fillStyle(on ? 0xffe066 : darkOf(c.rock), 1).fillRect(x + 14 + i * 36, gy - bh + 6, 6, 4).fillRect(x + 24 + i * 36, gy - bh + 6, 6, 4);
        }
        break;
      case 'nieve':
        big(['.....kk.....', '....kWWk....', '...kWWWbk...', '..kWbbbbbk..', '.kbbbbbbbbk.', 'kbbbbbbbbbbk'], cx, { W: 0xffffff, b: c.wall }, 5);
        for (let i = 0; i < 9; i++) {
          const k = ((t / 2000 + i / 9) % 1);
          g.fillStyle(0xffffff, 1).fillRect(Math.round((x + 10 + ((i * 53) % (w - 20)) + Math.sin(k * 6 + i) * 4) / 2) * 2, Math.round((y + k * (h - 10)) / 2) * 2, 4, 4);
        }
        break;
      case 'pantano':
        g.fillStyle(c.puddle, 1).fillRect(x + 20, gy - 4, w - 40, 10);
        for (let i = 0; i < 7; i++) g.fillStyle(0x5e5a40, 1).fillRect(x + 16 + i * 30, gy - 22 + (i % 2) * 6, 4, 20).fillStyle(0x7a5232, 1).fillRect(x + 15 + i * 30, gy - 24 + (i % 2) * 6, 6, 8);
        {
          const k = (t / 1300) % 1;
          g.fillStyle(lightOf(c.puddle), 1 - k).fillRect(x + 80, gy - 6 - k * 12, 6, 6).fillRect(x + 140, gy - 4 - ((k + 0.5) % 1) * 12, 4, 4);
        }
        break;
      default:
        big(['.....kk.......kk....', '....kWWk.....kWWk...', '...kWWbbk...kWbbbk..', '..kbbbbbbk.kbbbbbbk.', '.kbbbbbbbbkbbbbbbbbk', 'kbbbbbbbbbbbbbbbbbbk'], cx, { W: 0xffffff, b: c.wall }, 5);
        twinkle(g, x + 24, y + 12, 0xf0b8d8, 0.5 + 0.5 * Math.sin(t / 260), 2);
        twinkle(g, x + w - 30, y + 18, 0xffe066, 0.5 + 0.5 * Math.cos(t / 260), 2);
    }
    // Suelo
    g.fillStyle(OUT, 1).fillRect(x, gy, w, 2);
    g.fillStyle(c.floor, 1).fillRect(x, gy + 2, w, 16);
    g.fillStyle(darkOf(c.floor), 1).fillRect(x, y + h - 4, w, 4);
    for (let i = 0; i < 10; i++) g.fillStyle(darkOf(c.floor), 1).fillRect(x + 8 + i * 21, gy + 6 + (i % 2) * 4, 4, 2);
  }, 90);
}

const REWARD_ICON: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  shop: { rows: ['...kk...', '..kGGk..', '..kkkk..', '.kCCCCk.', 'kCCGGCCk', 'kCGCCCCk', 'kCCGGCCk', 'kCCCCGCk', 'kCCGGCCk', '.kkkkkk.'], pal: { G: 0xffd34d, C: 0x6b4f8a } },
  rest: { rows: ['...kk...', '..kWWk..', '.kWkkWk.', 'kWk..kWk', '..kWWk..', 'kkkSSkkk', 'kBBBBBBk', 'kBWBBWBk', '.kSSSSk.', 'kkkkkkkk'], pal: { W: 0x9fd4ef, B: 0x3d8fd6, S: 0xaab8c4 } },
  event: { rows: ['.kkkkkk.', 'kPPPPPPk', 'kPkkkkPk', 'kPPPPkPk', 'kPPPkkPk', 'kPPPkPPk', 'kPPPPPPk', 'kPPPkPPk', 'kPPPPPPk', '.kkkkkk.'], pal: { P: 0xfff3d6 } },
  loot: { rows: ['.kkkkkkkk.', 'kBBBBBBBBk', 'kBbbbbbbBk', 'kkkkGGkkkk', 'kBBkGGkBBk', 'kBBBkkBBBk', 'kBBBBBBBBk', 'kkkkkkkkkk'], pal: { B: 0xc9a27a, b: 0x8f6a46, G: 0xffd34d } },
};

/** Icono del premio que flota, centrado en (cx, cy), con destellos. */
export function addRewardIcon(scene: Phaser.Scene, cx: number, cy: number, reward: string, size = 4) {
  const g = scene.add.graphics();
  const ic = REWARD_ICON[reward] ?? REWARD_ICON.loot;
  const w = ic.rows[0].length * size;
  const h = ic.rows.length * size;
  return live(scene, g, (t) => {
    const bob = Math.round(Math.sin(t / 300) * 1.5) * 2;
    g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + h / 2 + 4, w, 8);
    stamp(g, cx - w / 2, cy - h / 2 + bob, ic.rows, { k: OUT, ...ic.pal }, size);
    const k = (t / 1200) % 1;
    twinkle(g, cx + w / 2 + 4, cy - h / 2 + 4 - k * 6, 0xffe066, Math.sin(k * Math.PI), 2);
  }, 90);
}
