// Arte pixel de los poderes fusionados (sin emojis ni imágenes externas): cada fusión ensambla su estilo único
// (data/fusion.ts) con piezas de este catálogo: 14 formas de proyectil, 9 estelas y 11 impactos, con los colores de
// sus dos tipos. También el destello al fusionar y el dibujo de la vista previa. Con lowFx(), versión simple.
import Phaser from 'phaser';
import type { FusionImpact, FusionShape, FusionStyle, FusionTrail } from '../../data/fusion';
import { lowFx } from '../theme';
import { animate, darkOf, lightOf, mixColor, PX } from './pixelFx';

type G = Phaser.GameObjects.Graphics;
type Sprite = Phaser.Physics.Arcade.Sprite;

/** Paleta de una fusión: 0 = tipo A, 1 = tipo B, 2 = mezcla clara, 3 = blanco, 4 = oscuro. */
export function fusionPalette(a: number, b: number): number[] {
  return [a, b, lightOf(mixColor(a, b, 0.5)), 0xffffff, darkOf(mixColor(a, b, 0.5))];
}

/** Píxeles de cada forma en unidades de rejilla (u hacia delante, v de lado) y su color (índice de la paleta). */
type Px = [number, number, number];
const SHAPES: Record<FusionShape, (t: number) => Px[]> = {
  // Dos hebras que se enroscan
  helice: (t) => {
    const out: Px[] = [];
    for (let u = -3; u <= 2; u++) {
      const s = Math.round(Math.sin(u * 1.1 + t / 70) * 1.6);
      out.push([u, s, 0], [u, -s, 1]);
    }
    out.push([3, 0, 3]);
    return out;
  },
  // Cabeza blanca y cola partida en dos colores
  cometa: () => [[2, 0, 3], [1, 0, 2], [1, 1, 0], [1, -1, 1], [0, 1, 0], [0, -1, 1], [-1, 2, 0], [-1, -2, 1], [-2, 2, 4], [-2, -2, 4], [0, 0, 2]],
  // Rombo facetado
  cristal: () => [[2, 0, 3], [1, 0, 2], [1, 1, 0], [1, -1, 1], [0, 0, 2], [0, 1, 0], [0, -1, 1], [0, 2, 4], [0, -2, 4], [-1, 1, 0], [-1, -1, 1], [-1, 0, 2], [-2, 0, 4]],
  // Nube de esporas que late
  espora: (t) => {
    const k = Math.round(Math.sin(t / 90));
    return [[0, 0, 2], [1, 0, 0], [-1, 0, 1], [0, 1, 1], [0, -1, 0], [1 + k, 1 + k, 3], [-1 - k, -1 - k, 3], [1, -2, 0], [-2, 1, 1], [2, 2, 4], [-2, -2, 4]];
  },
  // Núcleo con anillo que gira
  anillo: (t) => {
    const out: Px[] = [[0, 0, 3]];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + t / 160;
      out.push([Math.round(Math.cos(a) * 2.2), Math.round(Math.sin(a) * 2.2), k % 2]);
    }
    return out;
  },
  // Media luna cortante
  'media-luna': () => [[2, 0, 3], [2, 1, 2], [1, 2, 0], [0, 3, 0], [2, -1, 2], [1, -2, 1], [0, -3, 1], [1, 0, 2], [-1, 3, 4], [-1, -3, 4]],
  // Estrella de cuatro puntas que gira
  estrella: (t) => {
    const r = Math.floor(t / 120) % 2;
    const arm: Px[] = r ? [[2, 2, 0], [-2, -2, 1], [2, -2, 0], [-2, 2, 1], [1, 1, 2], [-1, -1, 2], [1, -1, 2], [-1, 1, 2]] : [[3, 0, 0], [-3, 0, 1], [0, 3, 0], [0, -3, 1], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [2, 0, 0], [-2, 0, 1], [0, 2, 0], [0, -2, 1]];
    return [[0, 0, 3], ...arm];
  },
  // Gota con núcleo del otro color
  gota: () => [[2, 0, 0], [1, 0, 0], [1, 1, 0], [1, -1, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 1], [-1, 1, 0], [-1, -1, 0], [-2, 0, 4], [0, 0, 3]],
  // Runa cuadrada con marca dentro
  runa: (t) => {
    const out: Px[] = [];
    for (let k = -2; k <= 2; k++) out.push([k, -2, 0], [k, 2, 0], [-2, k, 1], [2, k, 1]);
    out.push(Math.floor(t / 150) % 2 ? [0, 0, 3] : [1, -1, 3], [-1, 1, 2]);
    return out;
  },
  // Colmillo / punta de flecha
  colmillo: () => [[3, 0, 3], [2, 0, 2], [2, 1, 0], [1, 1, 0], [1, 2, 0], [0, 2, 4], [2, -1, 1], [1, -1, 1], [1, -2, 1], [0, -2, 4], [0, 0, 2], [-1, 0, 4]],
  // Flor de pétalos alternos
  flor: (t) => {
    const r = Math.floor(t / 140) % 2;
    return [[0, 0, 3], [1, 0, r], [-1, 0, r], [0, 1, 1 - r], [0, -1, 1 - r], [2, 1, 0], [2, -1, 1], [-2, 1, 1], [-2, -1, 0], [1, 2, 2], [-1, -2, 2]];
  },
  // Roca encendida
  meteoro: (t) => {
    const f = Math.floor(t / 80) % 2;
    return [[1, 0, 4], [0, 0, 4], [1, 1, 4], [0, 1, 4], [1, -1, 4], [0, -1, 4], [-1, 0, 4], [2, 0, 1], [-1, 1, 0], [-1, -1, 0], [-2, f, 0], [-3, -f, 2], [-2, 0, 3]];
  },
  // Dos rayos en zigzag cruzados
  'rayo-doble': (t) => {
    const f = Math.floor(t / 60) % 2 ? 1 : -1;
    return [[3, 0, 3], [2, f, 0], [1, -f, 0], [0, f, 0], [-1, -f, 0], [2, -f, 1], [1, f, 1], [0, -f, 1], [-1, f, 1], [-2, 0, 2]];
  },
  // Remolino de puntos
  remolino: (t) => {
    const out: Px[] = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 0.8 + t / 110;
      const r = 0.5 + k * 0.3;
      out.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), k < 3 ? 3 : k % 2]);
    }
    return out;
  },
};

/** Dibuja la forma en (x, y) mirando a `ang`. `px` = tamaño del píxel. */
export function drawFusionShape(g: G, x: number, y: number, ang: number, shape: FusionShape, pal: number[], t: number, px = PX, alpha = 1) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const cells = SHAPES[shape](t);
  // Contorno primero, luego los colores
  for (const [u, v] of cells) {
    const wx = x + (u * c - v * s) * px;
    const wy = y + (u * s + v * c) * px;
    g.fillStyle(0x18202c, alpha * 0.9).fillRect(Math.round(wx - px / 2 - 2), Math.round(wy - px / 2 - 2), px + 4, px + 4);
  }
  for (const [u, v, k] of cells) {
    const wx = x + (u * c - v * s) * px;
    const wy = y + (u * s + v * c) * px;
    g.fillStyle(pal[k], alpha).fillRect(Math.round(wx - px / 2), Math.round(wy - px / 2), px, px);
  }
}

/** Dibuja la estela con los puntos por los que ha pasado (del más viejo al más nuevo). */
export function drawFusionTrail(g: G, pts: { x: number; y: number }[], trail: FusionTrail, pal: number[], t: number, n: number, px = PX) {
  const len = pts.length;
  if (len < 2) return;
  const step = Math.max(1, Math.floor(len / Math.max(2, n)));
  for (let i = 0; i < len - 1; i += step) {
    const p = pts[i];
    const q = pts[i + 1];
    const k = i / len; // 0 = viejo
    const a = 0.15 + 0.65 * k;
    const sz = Math.max(2, Math.round(px * (0.35 + 0.6 * k)));
    const nx = -(q.y - p.y);
    const ny = q.x - p.x;
    const nl = Math.hypot(nx, ny) || 1;
    const side = (o: number) => [p.x + (nx / nl) * o, p.y + (ny / nl) * o] as const;
    const sq = (x: number, y: number, c: number, s = sz, al = a) => g.fillStyle(c, al).fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    switch (trail) {
      case 'chispas':
        if ((i + Math.floor(t / 60)) % 3 === 0) sq(...side(Math.sin(i * 7) * px), pal[3]);
        sq(p.x, p.y, pal[i % 2], sz * 0.6);
        break;
      case 'cinta':
        sq(...side(px * 0.5), pal[0]);
        sq(...side(-px * 0.5), pal[1]);
        break;
      case 'puntos':
        if (i % 2 === 0) sq(p.x, p.y, pal[2]);
        break;
      case 'trenza': {
        const o = Math.sin(i * 0.9 + t / 80) * px;
        sq(...side(o), pal[0]);
        sq(...side(-o), pal[1]);
        break;
      }
      case 'humo':
        sq(...side(Math.sin(i + t / 200) * px * 0.8), mixColor(pal[4], 0x888888, 0.4), sz * 1.6, a * 0.6);
        break;
      case 'escamas':
        if (i % 2 === 0) {
          sq(...side(px * 0.7), pal[i % 4 === 0 ? 0 : 1], sz);
          sq(...side(-px * 0.7), pal[4], sz * 0.7);
        }
        break;
      case 'llamas':
        sq(p.x, p.y, k > 0.6 ? pal[3] : k > 0.3 ? pal[0] : pal[1], sz * (1 + 0.4 * Math.sin(i + t / 50)));
        break;
      case 'estrellas':
        if ((i + Math.floor(t / 90)) % 4 === 0) {
          sq(p.x, p.y, pal[3], sz * 0.6);
          sq(p.x + sz, p.y, pal[0], sz * 0.5);
          sq(p.x - sz, p.y, pal[0], sz * 0.5);
          sq(p.x, p.y + sz, pal[1], sz * 0.5);
          sq(p.x, p.y - sz, pal[1], sz * 0.5);
        }
        break;
      case 'quebrada':
        sq(...side((i % 2 ? 1 : -1) * px * 0.8), pal[i % 3 === 0 ? 3 : 2], sz * 0.8);
        break;
    }
  }
}

/** Impacto propio del estilo. */
export function fusionImpact(sc: Phaser.Scene, x: number, y: number, impact: FusionImpact, pal: number[], scale = 1) {
  if (lowFx()) {
    const c = sc.add.circle(x, y, 8, pal[2], 0.7).setDepth(8);
    sc.tweens.add({ targets: c, radius: 26 * scale, alpha: 0, duration: 180, onComplete: () => c.destroy() });
    return;
  }
  const R = 34 * scale;
  animate(sc, 8.5, 360, (g, k, t) => {
    const a = 1 - k;
    const sq = (px: number, py: number, c: number, s = PX) => g.fillStyle(c, a).fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
    const ring = (r: number, c: number, n = 16, off = 0) => {
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + off;
        sq(x + Math.cos(an) * r, y + Math.sin(an) * r, c);
      }
    };
    switch (impact) {
      case 'anillos':
        ring(R * k, pal[0]);
        ring(R * k * 0.6, pal[1], 12, 0.3);
        break;
      case 'estallido':
        for (let i = 0; i < 10; i++) {
          const an = i * 0.63;
          sq(x + Math.cos(an) * R * k, y + Math.sin(an) * R * k, pal[i % 2], PX * (1.6 - k));
        }
        sq(x, y, pal[3], PX * 3 * a);
        break;
      case 'cruz':
        for (let i = -3; i <= 3; i++) {
          sq(x + i * PX * (1 + k * 2), y, pal[0]);
          sq(x, y + i * PX * (1 + k * 2), pal[1]);
        }
        break;
      case 'petalos':
        for (let i = 0; i < 6; i++) {
          const an = i * 1.047 + k * 2;
          sq(x + Math.cos(an) * R * k, y + Math.sin(an) * R * k, pal[i % 2], PX * 1.4);
          sq(x + Math.cos(an) * R * k * 0.6, y + Math.sin(an) * R * k * 0.6, pal[2]);
        }
        break;
      case 'grietas':
        for (let i = 0; i < 5; i++) {
          const an = i * 1.26 + 0.4;
          for (let s = 1; s <= 4; s++) sq(x + Math.cos(an + (s % 2) * 0.25) * s * PX * 1.4, y + Math.sin(an + (s % 2) * 0.25) * s * PX * 1.4, s > 2 ? pal[4] : pal[i % 2]);
        }
        break;
      case 'chispazo':
        for (let i = 0; i < 6; i++) {
          if ((i + Math.floor(t / 50)) % 2) continue;
          const an = i * 1.05;
          for (let s = 1; s <= 3; s++) sq(x + Math.cos(an) * s * PX * 2 + (s % 2) * PX, y + Math.sin(an) * s * PX * 2, s === 3 ? pal[3] : pal[0]);
        }
        break;
      case 'burbujas':
        for (let i = 0; i < 7; i++) {
          const an = i * 0.9;
          const bx = x + Math.cos(an) * R * 0.7 * k;
          const by = y + Math.sin(an) * R * 0.7 * k - k * 20;
          sq(bx, by, pal[i % 2], PX * 1.2);
          sq(bx - 2, by - 2, pal[3], 3);
        }
        break;
      case 'sello':
        for (let i = -2; i <= 2; i++) {
          const r = R * 0.6;
          sq(x + i * r * 0.4, y - r, pal[0]);
          sq(x + i * r * 0.4, y + r, pal[0]);
          sq(x - r, y + i * r * 0.4, pal[1]);
          sq(x + r, y + i * r * 0.4, pal[1]);
        }
        sq(x, y, pal[3], PX * 2 * a);
        break;
      case 'espiral':
        for (let i = 0; i < 12; i++) {
          const an = i * 0.55 + k * 5;
          const r = i * 3 * (0.5 + k);
          sq(x + Math.cos(an) * r, y + Math.sin(an) * r, pal[i % 2]);
        }
        break;
      case 'esquirlas':
        for (let i = 0; i < 8; i++) {
          const an = i * 0.785 + 0.2;
          const d = R * k * (0.7 + (i % 3) * 0.2);
          sq(x + Math.cos(an) * d, y + Math.sin(an) * d, i % 3 === 0 ? pal[3] : pal[i % 2], PX * 0.9);
          sq(x + Math.cos(an) * (d - PX), y + Math.sin(an) * (d - PX), pal[2], PX * 0.6);
        }
        break;
      case 'destello':
        sq(x, y, pal[3], PX * 5 * a);
        ring(R * 0.5 * (0.5 + k), pal[2], 8);
        break;
    }
  });
}

/**
 * Viste un proyectil del motor con el arte de la fusión: lo dibuja con su forma, le pone su estela y su impacto.
 * El proyectil de verdad (el que choca) se queda casi transparente debajo.
 */
export function dressFusionShot(sc: Phaser.Scene, s: Sprite, style: FusionStyle, colA: number, colB: number) {
  if (!s.active || s.getData('fusionArt')) return;
  s.setData('fusionArt', true);
  const pal = fusionPalette(colA, colB);
  const tail = s.getData('tail') as Phaser.GameObjects.Image | undefined;
  tail?.setAlpha(0).setVisible(false);
  s.setAlpha(0.18);
  const px = Math.max(3, Math.round(PX * 0.75 * style.scale * Math.min(1.6, Math.max(0.8, s.scaleX / 2.4))));
  const g = sc.add.graphics().setDepth(s.depth + 0.1);
  const pts: { x: number; y: number }[] = [];
  const low = lowFx();
  const t0 = sc.time.now;
  const tick = () => {
    if (!s.active) return;
    const v = (s.body as Phaser.Physics.Arcade.Body | null)?.velocity;
    const ang = v && v.lengthSq() > 4 ? Math.atan2(v.y, v.x) : ((s.getData('ang') as number | undefined) ?? 0);
    const t = sc.time.now - t0;
    g.clear();
    if (!low) {
      pts.push({ x: s.x, y: s.y });
      if (pts.length > 10 + style.particles) pts.shift();
      drawFusionTrail(g, pts, style.trail, pal, t, style.particles, px);
    }
    drawFusionShape(g, s.x, s.y, ang, style.shape, pal, t, px);
  };
  tick();
  sc.events.on(Phaser.Scenes.Events.UPDATE, tick);
  s.once(Phaser.GameObjects.Events.DESTROY, (_o: unknown, fromScene?: boolean) => {
    sc.events.off(Phaser.Scenes.Events.UPDATE, tick);
    g.destroy();
    if (fromScene || !sc.sys.isActive()) return;
    fusionImpact(sc, s.x, s.y, style.impact, pal, style.scale * 0.8);
  });
}

/** Destello al fusionar: anillos de los dos colores que se cierran, chispas y un flash blanco. */
export function fusionFlash(sc: Phaser.Scene, x: number, y: number, colA: number, colB: number, depth = 20) {
  const pal = fusionPalette(colA, colB);
  if (lowFx()) {
    const c = sc.add.circle(x, y, 60, pal[2], 0.6).setDepth(depth);
    sc.tweens.add({ targets: c, radius: 10, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    return;
  }
  animate(sc, depth, 900, (g, k, t) => {
    const sq = (px: number, py: number, c: number, s = PX, a = 1) => g.fillStyle(c, a).fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s);
    // Fase 1 (0-0,55): las dos mitades giran y se juntan
    if (k < 0.55) {
      const p = k / 0.55;
      const r = 120 * (1 - p) + 8;
      for (let i = 0; i < 14; i++) {
        const an = (i / 14) * Math.PI * 2 + p * 6;
        sq(x + Math.cos(an) * r, y + Math.sin(an) * r, pal[0]);
        sq(x + Math.cos(-an) * r * 0.75, y + Math.sin(-an) * r * 0.75, pal[1]);
      }
      sq(x, y, pal[3], PX * (1 + p * 3));
      return;
    }
    // Fase 2: flash y onda hacia fuera con chispas de ambos colores
    const p = (k - 0.55) / 0.45;
    if (p < 0.25) g.fillStyle(0xffffff, 0.7 * (1 - p * 4)).fillCircle(x, y, 40 + p * 200);
    for (let i = 0; i < 24; i++) {
      const an = (i / 24) * Math.PI * 2;
      sq(x + Math.cos(an) * 150 * p, y + Math.sin(an) * 150 * p, pal[i % 2], PX, 1 - p);
    }
    for (let i = 0; i < 16; i++) {
      const an = i * 2.4 + t / 300;
      const d = 30 + 110 * p * (0.5 + (i % 4) * 0.2);
      sq(x + Math.cos(an) * d, y + Math.sin(an) * d, i % 3 === 0 ? pal[3] : pal[2], PX * 0.8, 1 - p);
    }
  });
}

/** Vista previa en la pantalla de fusión: el proyectil volando en bucle por una franja de `w` px con su estela. */
export function addFusionPreview(sc: Phaser.Scene, x: number, y: number, w: number, style: FusionStyle, colA: number, colB: number): Phaser.GameObjects.Graphics {
  const g = sc.add.graphics();
  const pal = fusionPalette(colA, colB);
  const t0 = sc.time.now;
  const draw = () => {
    if (!g.active) return;
    const t = sc.time.now - t0;
    const k = (t % 1600) / 1600;
    const wob = style.motion === 'ondula' ? Math.sin(k * 18) * 10 : style.motion === 'zigzag' ? (Math.floor(k * 10) % 2 ? 8 : -8) : 0;
    const px0 = x - w / 2 + (style.motion === 'acelera' ? k * k : k) * w;
    const pts: { x: number; y: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const kk = Math.max(0, k - i * 0.012);
      const ww = style.motion === 'ondula' ? Math.sin(kk * 18) * 10 : style.motion === 'zigzag' ? (Math.floor(kk * 10) % 2 ? 8 : -8) : 0;
      pts.push({ x: x - w / 2 + (style.motion === 'acelera' ? kk * kk : kk) * w, y: y + ww });
    }
    g.clear();
    if (!lowFx()) drawFusionTrail(g, pts, style.trail, pal, t, style.particles, PX);
    const ang = style.motion === 'gira' ? t / 200 : 0;
    drawFusionShape(g, px0, y + wob, ang, style.shape, pal, t, PX * style.scale);
  };
  draw();
  sc.events.on(Phaser.Scenes.Events.UPDATE, draw);
  g.once(Phaser.GameObjects.Events.DESTROY, () => sc.events.off(Phaser.Scenes.Events.UPDATE, draw));
  return g;
}

/** Marco dorado de ranura fusionada con las dos mitades de los colores (HUD). */
export function drawFusedSlotFrame(g: G, x: number, y: number, w: number, h: number, colA: number, colB: number, ready: boolean) {
  const a = ready ? 1 : 0.55;
  g.fillStyle(0x7a5a10, a).fillRect(x - 3, y - 3, w + 6, h + 6);
  g.fillStyle(0xf8d030, a).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(darkOf(colA), a).fillRect(x + 2, y + 2, w / 2 - 2, h - 4);
  g.fillStyle(darkOf(colB), a).fillRect(x + w / 2, y + 2, w / 2 - 2, h - 4);
  g.fillStyle(0x101828, 0.55).fillRect(x + 4, y + 4, w - 8, h - 8);
  // Remaches dorados en las esquinas
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) g.fillStyle(0xfff0a0, a).fillRect(cx - 3, cy - 3, 6, 6);
}
