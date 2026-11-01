// Firmas de los ataques (auditoría 01/11): dibuja el MOTIVO pixel art de cada estilo (data/moveSignatures.ts) con la
// colocación de su forma: cono al disparar, línea en chorros y rayos, anillo en ondas, caída en lluvias y bombas,
// remolino en órbitas, fila en olas, saltos en cadenas, brotes en erupciones y trampas, y estela en embestidas.
// Solo dibujo (el daño lo pone attacks.ts). Rendimiento: un único Graphics por firma redibujado a saltos de 50 ms,
// como mucho MAX_LIVE firmas a la vez y MAX_GLYPHS motivos por firma; con «reducir efectos» no se dibuja nada.
import Phaser from 'phaser';
import { COMBO_MOTIF, LAYOUT_OF, MOTIFS, motifFor, type Layout, type Motif } from '../../data/moveSignatures';
import type { PatternKind } from '../../data/movePatterns';
import { typeColor } from '../../data/types';
import { lowFx } from '../theme';
import { animate, darkOf, lightOf } from './pixelFx';

const OUT = 0x18202c;
/** Firmas vivas a la vez (las de más se saltan) y motivos por firma. */
export const MAX_LIVE = 5;
export const MAX_GLYPHS = 8;
/** Tamaño de cada celda del motivo (px de juego): 7 × 4 = 28 px, legible en móvil. */
const CELL = 4;
let live = 0;

/** Dibuja un motivo 7×7 centrado en (x, y); `s` escala la celda; `a` transparencia. */
export function drawMotif(g: Phaser.GameObjects.Graphics, m: Motif, x: number, y: number, col: number, s = 1, a = 1) {
  const rows = MOTIFS[m];
  const c = Math.max(2, Math.round(CELL * s));
  const x0 = Math.round(x - c * 3.5);
  const y0 = Math.round(y - c * 3.5);
  const light = lightOf(col);
  const dark = darkOf(col);
  for (let r = 0; r < 7; r++) {
    const row = rows[r];
    for (let q = 0; q < 7; q++) {
      const ch = row[q];
      if (ch === '.') continue;
      const fill = ch === 'o' ? OUT : ch === '+' ? light : ch === '-' ? dark : ch === 'w' ? 0xffffff : col;
      g.fillStyle(fill, a).fillRect(x0 + q * c, y0 + r * c, c, c);
    }
  }
}

/** Posición y escala de cada motivo en el avance `k` (0-1) según la colocación. */
function place(layout: Layout, i: number, n: number, k: number, ang: number): { dx: number; dy: number; s: number; a: number } {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const fwd = (d: number, side = 0) => ({ dx: cos * d - sin * side, dy: sin * d + cos * side });
  const u = n > 1 ? i / (n - 1) : 0.5;
  const fade = 1 - k * k;
  switch (layout) {
    case 'cono': {
      // Salen en abanico desde la boca y se apagan
      const spread = (u - 0.5) * 0.9;
      const d = 22 + k * 70;
      const p = { dx: Math.cos(ang + spread) * d, dy: Math.sin(ang + spread) * d };
      return { ...p, s: 0.8 + 0.3 * (1 - k), a: fade };
    }
    case 'linea':
      // Repartidos por la línea del chorro o rayo, con un temblor lateral
      return { ...fwd(40 + u * 260, Math.sin(k * 12 + i * 1.7) * 10), s: 0.9, a: fade };
    case 'anillo': {
      const t = (i / n) * Math.PI * 2 + k * 0.6;
      const r = 26 + k * 120;
      return { dx: Math.cos(t) * r, dy: Math.sin(t) * r * 0.7, s: 1.1 - 0.4 * k, a: fade };
    }
    case 'caida': {
      // Caen sobre la zona de delante
      const c = fwd(170, (u - 0.5) * 140);
      return { dx: c.dx + (i % 2 ? 8 : -8), dy: c.dy - (1 - k) * 120, s: 0.8 + 0.4 * k, a: k < 0.85 ? 1 : (1 - k) / 0.15 };
    }
    case 'remolino': {
      const t = (i / n) * Math.PI * 2 + k * 7;
      const r = 70 - 40 * k;
      return { dx: Math.cos(t) * r, dy: Math.sin(t) * r, s: 0.9, a: fade };
    }
    case 'fila':
      // Fila perpendicular que avanza
      return { ...fwd(30 + k * 160, (u - 0.5) * 150), s: 1, a: fade };
    case 'saltos': {
      // Saltan en arco de punto en punto hacia delante
      const seg = Math.min(n - 1, Math.floor(k * n));
      const kk = k * n - seg;
      const p = fwd(30 + (seg + kk) * 55, 0);
      return { dx: p.dx, dy: p.dy - Math.sin(kk * Math.PI) * 28, s: i === seg ? 1.2 : 0.7, a: i <= seg ? fade : 0 };
    }
    case 'brote': {
      // Brotan del suelo delante, uno tras otro
      const born = u * 0.6;
      const kk = Phaser.Math.Clamp((k - born) / 0.4, 0, 1);
      const p = fwd(60 + u * 160, (i % 2 ? 1 : -1) * 18);
      return { dx: p.dx, dy: p.dy - Math.sin(kk * Math.PI) * 26, s: 0.5 + kk * 0.7, a: kk > 0 ? 1 - kk * 0.6 : 0 };
    }
    case 'estela':
    default:
      // Imágenes que se quedan atrás mientras te lanzas
      return { ...fwd(-20 - u * 120 + k * 60, Math.sin(i * 2.1) * 12), s: 1.1 - u * 0.4, a: fade * (1 - u * 0.5) };
  }
}

const COUNT: Record<Layout, number> = { cono: 3, linea: 6, anillo: 8, caida: 5, remolino: 6, fila: 5, saltos: 5, brote: 5, estela: 5 };
const MS: Record<Layout, number> = { cono: 320, linea: 600, anillo: 520, caida: 620, remolino: 900, fila: 700, saltos: 600, brote: 700, estela: 420 };

/** Lanza una firma con un motivo y una colocación desde (x, y) hacia `ang`. Devuelve si se dibujó. */
export function signatureFx(sc: Phaser.Scene, motif: Motif, layout: Layout, x: number, y: number, ang: number, col: number, scale = 1): boolean {
  if (lowFx() || live >= MAX_LIVE || !sc.sys.isActive()) return false;
  live++;
  const n = Math.min(MAX_GLYPHS, COUNT[layout]);
  let done = false;
  const g = animate(sc, 7.5, MS[layout], (gr, k) => {
    for (let i = 0; i < n; i++) {
      const p = place(layout, i, n, k, ang);
      if (p.a <= 0.02) continue;
      drawMotif(gr, motif, x + p.dx, y + p.dy, col, p.s * scale, p.a);
    }
  });
  const free = () => {
    if (done) return;
    done = true;
    live = Math.max(0, live - 1);
  };
  g.once(Phaser.GameObjects.Events.DESTROY, free);
  return true;
}

/** Firma de un estilo del catálogo (el motivo según su nombre y tipo; la colocación, según su forma). */
export function moveSignatureFx(sc: Phaser.Scene, styleId: string, type: string, kind: PatternKind, x: number, y: number, dir: Phaser.Math.Vector2): boolean {
  return signatureFx(sc, motifFor(styleId, type), LAYOUT_OF[kind], x, y, Math.atan2(dir.y, dir.x), typeColor(type));
}

/** Firma de una combinación de fusión: su motivo, en anillo y con el color del segundo tipo, un poco más grande. */
export function fusionSignatureFx(sc: Phaser.Scene, combo: string, typeB: string, x: number, y: number, dir: Phaser.Math.Vector2): boolean {
  const m = COMBO_MOTIF[combo];
  if (!m) return false;
  return signatureFx(sc, m, 'anillo', x, y, Math.atan2(dir.y, dir.x), typeColor(typeB), 1.15);
}

/** Solo pruebas: cuántas firmas hay vivas. */
export const liveSignatures = () => live;
