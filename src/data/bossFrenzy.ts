// Ataques «frenéticos» de los jefes (inspirados en la Radiance de Hollow Knight y los combos retardados de Elden Ring):
// - cascada: 10-14 rayos/franjas que se encienden UNO DETRÁS DE OTRO (80-150 ms entre uno y otro), cada uno con su
//   aviso, y siempre con un hueco seguro que nunca se dispara;
// - combo retardado (solo fase 2): 3-5 golpes encadenados (embestida, rayo, zona) con pausas variables y, a veces, un
//   amago: el aviso se queda encendido más tiempo antes de golpear (nunca menos aviso, solo más);
// - rayos: círculos marcados en el suelo que se rellenan y parpadean y, al acabar el aviso, reciben un rayo del cielo
//   (solo daña dentro del círculo), en cascada, algunos apuntados a donde estás. Sin anillos ni ondas circulares.
// Lógica pura (sin Phaser), con tests en tests/bossFrenzy.test.ts. Dibujo en src/ui/art/frenzyFx.ts y ejecución en
// src/scenes/frenzyRuntime.ts.
import type { Bounds } from '../level/bounds.ts';
import type { Difficulty } from './difficulty.ts';

/** storm: tormenta, varias cascadas solapadas durante varios segundos con un pasillo seguro común que se desplaza. */
/** chase (solo fase 2): acoso, zonas que se arrastran hacia ti, orbes teledirigidos y rayos sobre tu posición. */
/** lightning: rayos, círculos en el suelo donde cae un rayo al acabar el aviso, uno detrás de otro. */
export type FrenzyAttack = 'cascade' | 'feintCombo' | 'storm' | 'chase' | 'lightning';
export const FRENZY_ATTACKS: readonly FrenzyAttack[] = ['cascade', 'feintCombo', 'storm', 'chase', 'lightning'];
export const isFrenzyAttack = (a: string): a is FrenzyAttack => (FRENZY_ATTACKS as readonly string[]).includes(a);
export const FRENZY_LABEL: Record<FrenzyAttack, string> = { cascade: 'Cascada', feintCombo: 'Combo retardado', storm: 'Tormenta', chase: 'Acoso', lightning: 'Rayos' };

/**
 * Aviso mínimo de cualquier golpe frenético (ms). Igual que TELEGRAPH_MS (750): más bajo que BLITZ_MIN_WARN (900)
 * porque aquí los avisos se ven venir en cadena (la oleada se anuncia línea a línea mucho antes de llegar a ti) y cada
 * línea es fina; en Fácil sube a 950.
 */
export const FRENZY_MIN_WARN = 750;
/** Grosor mínimo de un rayo (px): legible en móvil. */
export const MIN_LANE_W = 20;
/** Pasillo libre mínimo (px) que deja siempre el hueco seguro (el jugador mide ~36). */
export const SAFE_MIN = 48;
/** Máximo de líneas por cascada (también limita objetos a la vez). */
export const MAX_LANES = 14;
export const MIN_LANES = 10;

export interface Pt {
  x: number;
  y: number;
}

// --- Cascada ---

/** sweepH: columnas que barren de lado a lado; sweepV: filas de arriba abajo; diagonal: franjas a 45°; pinzas:
 * columnas desde los dos lados hacia el centro; mixed: ráfaga que MEZCLA columnas, filas y diagonales (todas de pared a
 * pared, sin anillos). Todo líneas rectas: nada de rayos que giran ni anillos. */
export type CascadeShape = 'sweepH' | 'sweepV' | 'diagonal' | 'pincer' | 'mixed';
export const CASCADE_SHAPES: readonly CascadeShape[] = ['sweepH', 'sweepV', 'diagonal', 'pincer', 'mixed'];
export const isMixedShape = (s: CascadeShape): boolean => s === 'mixed';
/** Formas antiguas (circulares, ya quitadas) → la recta que las sustituye (para la consola de depuración). */
const LEGACY_SHAPE: Record<string, CascadeShape> = { radial: 'diagonal', spiral: 'pincer', mixedRing: 'mixed' };
export function normalizeShape(s: string): CascadeShape | undefined {
  if ((CASCADE_SHAPES as readonly string[]).includes(s)) return s as CascadeShape;
  return LEGACY_SHAPE[s];
}
export const CASCADE_LABEL: Record<CascadeShape, string> = {
  sweepH: 'Cascada de columnas',
  sweepV: 'Cascada de franjas',
  diagonal: 'Cascada diagonal',
  pincer: 'Pinzas de luz',
  mixed: 'Tormenta cruzada',
};
export type CascadeOrder = 'sweep' | 'pingpong' | 'random' | 'pincer';

/** Dos formas por tipo del jefe; el bioma aporta una más (variedad visual por tipo y bioma). */
const TYPE_CASCADE: Record<string, [CascadeShape, CascadeShape]> = {
  fire: ['diagonal', 'sweepV'],
  water: ['sweepH', 'pincer'],
  grass: ['diagonal', 'pincer'],
  electric: ['sweepH', 'diagonal'],
  ice: ['pincer', 'sweepV'],
  fighting: ['pincer', 'sweepH'],
  poison: ['diagonal', 'sweepH'],
  ground: ['sweepV', 'pincer'],
  flying: ['sweepH', 'diagonal'],
  psychic: ['pincer', 'diagonal'],
  bug: ['diagonal', 'sweepV'],
  rock: ['sweepV', 'diagonal'],
  ghost: ['diagonal', 'sweepV'],
  dragon: ['diagonal', 'pincer'],
  dark: ['diagonal', 'sweepH'],
  steel: ['sweepH', 'pincer'],
  fairy: ['pincer', 'sweepV'],
  normal: ['sweepH', 'sweepV'],
};
const BIOME_CASCADE: Record<string, CascadeShape> = {
  fire: 'sweepV', water: 'sweepH', grass: 'diagonal', electric: 'sweepH', ice: 'pincer', rock: 'sweepV', ground: 'sweepV',
  psychic: 'diagonal', ghost: 'pincer', dark: 'diagonal', dragon: 'diagonal', steel: 'pincer', fairy: 'pincer', poison: 'diagonal',
  bug: 'diagonal', flying: 'sweepH', fighting: 'pincer', normal: 'sweepH',
};

export function cascadeShapesFor(types: readonly string[], biomeTypes: readonly string[]): CascadeShape[] {
  const t = types.find((x) => TYPE_CASCADE[x]);
  const out: CascadeShape[] = [...(t ? TYPE_CASCADE[t] : TYPE_CASCADE.normal)];
  const bt = biomeTypes.find((x) => BIOME_CASCADE[x]);
  const extra = bt ? BIOME_CASCADE[bt] : undefined;
  if (extra && !out.includes(extra)) out.push(extra);
  // Las mezcladas son las más frecuentes (repetidas en la lista; las simples siguen saliendo, pero menos)
  return [...out, 'mixed', 'mixed', 'mixed', 'mixed', 'mixed'];
}

/** Siguiente forma sin repetir la última simple (las mezcladas pueden repetirse: cada ráfaga es distinta). */
export function pickShape(shapes: readonly CascadeShape[], rng: () => number, last?: CascadeShape): CascadeShape {
  const opts = shapes.length > 1 && last && !isMixedShape(last) && shapes.some((s) => s !== last) ? shapes.filter((s) => s !== last) : shapes;
  return opts[Math.floor(rng() * opts.length) % opts.length];
}

/** 0 en el piso 1 y 1 desde el 6. */
const depth = (floor: number): number => Math.min(1, Math.max(0, (Math.floor(floor) - 1) / 5));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface CascadeSpec {
  lanes: number;
  /** ms entre el aviso de una línea y el de la siguiente. */
  staggerMs: number;
  /** Aviso de cada línea (ms). */
  warnMs: number;
  /** Cuánto quema cada línea al dispararse (ms). */
  onMs: number;
  /** Grosor que pide (se reduce en salas pequeñas, nunca por debajo de MIN_LANE_W). */
  width: number;
  /** Tope de líneas (por defecto MAX_LANES; las tormentas piden más por cascada). */
  lanesCap?: number;
}

/** Fase 1: 10-12 líneas, 110-130 ms. Fase 2: 12-14 líneas, 80-100 ms. Fácil: menos líneas, más lentas y más aviso. */
export function cascadeSpec(floor: number, phase: 1 | 2, diff: Difficulty = 'normal'): CascadeSpec {
  const d = depth(floor);
  let lanes = (phase === 2 ? 12 : 10) + Math.round(d * 2);
  let stagger = (phase === 2 ? 100 : 130) - Math.round(d * 20);
  let warn = phase === 2 ? 750 : 820;
  if (diff === 'easy') {
    lanes -= 2;
    stagger += 30;
    warn = 950;
  } else if (diff === 'hard') {
    lanes += 1;
    stagger -= 10;
    warn = FRENZY_MIN_WARN;
  }
  return {
    lanes: clamp(lanes, MIN_LANES, MAX_LANES),
    staggerMs: clamp(stagger, 80, 150),
    warnMs: Math.max(FRENZY_MIN_WARN, warn),
    onMs: 260,
    width: phase === 2 ? 32 : 28,
  };
}

/** Una línea de la cascada: segmento (dentro de la sala), grosor y tiempos desde el inicio (ms). */
export interface Lane {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  warnAt: number;
  fireAt: number;
  offAt: number;
}
export type ElemKind = 'v' | 'h' | 'd';
export function elemKind(l: Lane): ElemKind {
  if (Math.abs(l.x1 - l.x2) < 1e-6) return 'v';
  if (Math.abs(l.y1 - l.y2) < 1e-6) return 'h';
  return 'd';
}
export interface CascadePlan {
  shape: CascadeShape;
  order: CascadeOrder;
  lanes: Lane[];
  /** Ancho real del pasillo seguro (px). */
  safeGap: number;
  /** Centro del hueco seguro (para pintarlo o para tests). */
  safeAt: Pt;
  totalMs: number;
}

/** Trozo de la recta p + t·d dentro de la sala (null si no la toca). */
export function clipLine(p: Pt, d: Pt, b: Bounds): [Pt, Pt] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const axes: [number, number, number, number][] = [
    [p.x, d.x, b.x0, b.x1],
    [p.y, d.y, b.y0, b.y1],
  ];
  for (const [o, v, lo, hi] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    const a = (lo - o) / v;
    const c = (hi - o) / v;
    t0 = Math.max(t0, Math.min(a, c));
    t1 = Math.min(t1, Math.max(a, c));
  }
  if (!(t1 > t0)) return null;
  return [
    { x: p.x + d.x * t0, y: p.y + d.y * t0 },
    { x: p.x + d.x * t1, y: p.y + d.y * t1 },
  ];
}

const shuffle = <T>(a: T[], rng: () => number): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Pone los tiempos (en el orden de disparo) a las líneas. */
function timed(segs: [Pt, Pt][], width: number, spec: CascadeSpec): Lane[] {
  return segs.map(([a, c], k) => {
    const warnAt = k * spec.staggerMs;
    const fireAt = warnAt + spec.warnMs;
    return { x1: a.x, y1: a.y, x2: c.x, y2: c.y, width, warnAt, fireAt, offAt: fireAt + spec.onMs };
  });
}

/**
 * Plan de una cascada en la sala `b`. `origin` es el jefe (las mezcladas eligen su hueco lejos de él). Las paralelas
 * reparten `lanes + 1` huecos a lo ancho y dejan uno sin disparar (el hueco seguro, nunca en el borde).
 */
export function cascadePlan(b: Bounds, shape: CascadeShape, spec: CascadeSpec, origin: Pt, rng: () => number, safe?: Pt): CascadePlan {
  const n = clamp(spec.lanes, MIN_LANES, Math.max(MIN_LANES, spec.lanesCap ?? MAX_LANES));
  if (isMixedShape(shape)) return mixedPlan(b, shape, n, spec, origin, rng, safe);
  // Paralelas: normal `nv` (la dirección del barrido) y dirección de la línea `dv`
  const diagSign = rng() < 0.5 ? 1 : -1;
  const vertical = shape === 'sweepH' || (shape === 'pincer' && rng() < 0.6);
  const nv: Pt = shape === 'diagonal' ? { x: Math.SQRT1_2, y: diagSign * Math.SQRT1_2 } : vertical ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const dv: Pt = { x: -nv.y, y: nv.x };
  const proj = [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x0, b.y1],
    [b.x1, b.y1],
  ].map(([x, y]) => x * nv.x + y * nv.y);
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  // Huecos: n líneas + k seguidos libres (el pasillo seguro); k crece en salas pequeñas hasta dejar SAFE_MIN libres
  let k = 1;
  let slots = n + 1;
  let spacing = (hi - lo) / (slots + 1);
  let width = Math.max(MIN_LANE_W, Math.min(spec.width * 2, spacing * 0.8));
  while ((k + 1) * spacing - width < SAFE_MIN && k < 6) {
    k++;
    slots = n + k;
    spacing = (hi - lo) / (slots + 1);
    width = Math.max(MIN_LANE_W, Math.min(spec.width * 2, spacing * 0.8));
  }
  // Hueco seguro: k huecos interiores seguidos (ni el primero ni el último), en las pinzas cerca del centro
  const room = slots - 1 - k; // posiciones de inicio válidas: 1..room
  let safe0 = shape === 'pincer' ? clamp(Math.floor((slots - k) / 2) - 1 + Math.floor(rng() * 3), 1, room) : 1 + Math.floor(rng() * room);
  if (safe) safe0 = clamp(Math.round((safe.x * nv.x + safe.y * nv.y - lo) / spacing - 1 - (k - 1) / 2), 1, Math.max(1, room));
  const isSafe = (i: number) => i >= safe0 && i < safe0 + k;
  const offs = (i: number) => lo + spacing * (i + 1);
  const all = Array.from({ length: slots }, (_, i) => i).filter((i) => !isSafe(i));
  let order: CascadeOrder;
  let seq: number[];
  if (shape === 'pincer') {
    order = 'pincer';
    seq = [];
    let l = 0;
    let r = all.length - 1;
    while (l <= r) {
      seq.push(all[l++]);
      if (l <= r) seq.push(all[r--]);
    }
  } else {
    const roll = rng();
    order = roll < 0.5 ? 'sweep' : roll < 0.78 ? 'pingpong' : 'random';
    const fwd = rng() < 0.5 ? all : [...all].reverse();
    if (order === 'sweep') seq = fwd;
    else if (order === 'pingpong') seq = [...fwd.filter((_, k) => k % 2 === 0), ...fwd.filter((_, k) => k % 2 === 1).reverse()];
    else seq = shuffle([...all], rng);
  }
  const segs: [Pt, Pt][] = [];
  for (const i of seq) {
    const s = offs(i);
    const seg = clipLine({ x: nv.x * s, y: nv.y * s }, dv, b);
    if (seg) segs.push(seg);
  }
  const sOff = offs(safe0 + (k - 1) / 2);
  const mid = clipLine({ x: nv.x * sOff, y: nv.y * sOff }, dv, b);
  const safeAt = mid ? { x: (mid[0].x + mid[1].x) / 2, y: (mid[0].y + mid[1].y) / 2 } : { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  return withTotal({ shape, order, lanes: timed(segs, width, spec), safeGap: (k + 1) * spacing - width, safeAt, totalMs: 0 });
}

/** Radio del disco seguro común de las mezcladas (diámetro 64 ≥ SAFE_MIN). */
export const MIXED_SAFE_R = 32;
/** Líneas de más en las mezcladas (sin anillos, compensan la densidad). */
export const MIXED_EXTRA = 3;

/**
 * Ráfaga mezclada: primero elige un disco seguro S (radio MIXED_SAFE_R, lejos de las paredes y, si se puede, del jefe)
 * y luego coloca columnas, filas y diagonales de pared a pared que NO lo cruzan (n + MIXED_EXTRA líneas, de los tres
 * tipos).
 */
function mixedPlan(b: Bounds, shape: CascadeShape, n: number, spec: CascadeSpec, origin: Pt, rng: () => number, safe?: Pt): CascadePlan {
  const W = b.x1 - b.x0;
  const H = b.y1 - b.y0;
  const rs = MIXED_SAFE_R;
  const lw = Math.max(MIN_LANE_W, Math.min(spec.width, Math.min(W, H) / 12));
  const o = { x: clamp(origin.x, b.x0, b.x1), y: clamp(origin.y, b.y0, b.y1) };
  const mx = Math.min(W / 2 - 1, rs + 24);
  const my = Math.min(H / 2 - 1, rs + 24);
  let S = { x: b.x0 + W / 2, y: b.y0 + H / 2 };
  let best = -1;
  for (let i = 0; i < 24; i++) {
    const c = { x: b.x0 + mx + rng() * (W - 2 * mx), y: b.y0 + my + rng() * (H - 2 * my) };
    const d = Math.min(Math.hypot(c.x - o.x, c.y - o.y), 180);
    if (d > best) {
      best = d;
      S = c;
    }
    if (d >= 180) break;
  }
  if (safe) S = { x: clamp(safe.x, b.x0 + mx, b.x1 - mx), y: clamp(safe.y, b.y0 + my, b.y1 - my) };
  const total = n + MIXED_EXTRA;
  const lineKinds: ElemKind[] = shuffle<ElemKind>(['v', 'h', 'd'], rng);
  const kinds: ElemKind[] = [];
  for (const k of lineKinds) kinds.push(k, k);
  while (kinds.length < total) kinds.push(lineKinds[Math.floor(rng() * lineKinds.length) % lineKinds.length]);
  shuffle(kinds, rng);
  const used: Record<ElemKind, number[]> = { v: [], h: [], d: [] };
  const clear = rs + lw / 2 + 4;
  const far = (arr: number[], v: number) => arr.every((u) => Math.abs(u - v) >= lw * 1.3);
  const placeLine = (k: ElemKind): Omit<Lane, 'warnAt' | 'fireAt' | 'offAt'> | null => {
    for (let tries = 0; tries < 40; tries++) {
      if (k === 'v' || k === 'h') {
        const lo = (k === 'v' ? b.x0 : b.y0) + lw / 2;
        const hi = (k === 'v' ? b.x1 : b.y1) - lw / 2;
        const v = lo + rng() * (hi - lo);
        if (Math.abs(v - (k === 'v' ? S.x : S.y)) < clear || !far(used[k], v)) continue;
        used[k].push(v);
        return k === 'v' ? { x1: v, y1: b.y0, x2: v, y2: b.y1, width: lw } : { x1: b.x0, y1: v, x2: b.x1, y2: v, width: lw };
      }
      const sg = rng() < 0.5 ? 1 : -1;
      const nv = { x: Math.SQRT1_2, y: sg * Math.SQRT1_2 };
      const pr = [b.x0 * nv.x + b.y0 * nv.y, b.x1 * nv.x + b.y0 * nv.y, b.x0 * nv.x + b.y1 * nv.y, b.x1 * nv.x + b.y1 * nv.y];
      const lo = Math.min(...pr);
      const hi = Math.max(...pr);
      const v = lo + rng() * (hi - lo);
      if (Math.abs(v - (S.x * nv.x + S.y * nv.y)) < clear || !far(used.d, v * sg)) continue;
      const seg = clipLine({ x: nv.x * v, y: nv.y * v }, { x: -nv.y, y: nv.x }, b);
      if (!seg || Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y) < Math.min(W, H) * 0.5) continue;
      used.d.push(v * sg);
      return { x1: seg[0].x, y1: seg[0].y, x2: seg[1].x, y2: seg[1].y, width: lw };
    }
    return null;
  };
  const elems: Omit<Lane, 'warnAt' | 'fireAt' | 'offAt'>[] = [];
  for (const k of kinds) {
    const order: ElemKind[] = [k, ...shuffle<ElemKind>(['v', 'h', 'd'], rng).filter((x) => x !== k)];
    for (const kk of order) {
      const e = placeLine(kk);
      if (e) {
        elems.push(e);
        break;
      }
    }
  }
  const lanes: Lane[] = elems.map((e, i) => {
    const warnAt = i * spec.staggerMs;
    const fireAt = warnAt + spec.warnMs;
    return { ...e, warnAt, fireAt, offAt: fireAt + spec.onMs };
  });
  return withTotal({ shape, order: 'random', lanes, safeGap: 2 * rs, safeAt: S, totalMs: 0 });
}

function withTotal(p: CascadePlan): CascadePlan {
  return { ...p, totalMs: Math.max(0, ...p.lanes.map((l) => l.offAt)) };
}

/** Distancia de (x, y) al segmento. */
export function segDist(x1: number, y1: number, x2: number, y2: number, x: number, y: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = dx * dx + dy * dy;
  const t = L > 0 ? clamp(((x - x1) * dx + (y - y1) * dy) / L, 0, 1) : 0;
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
}

/** ¿Le da la línea a algo de radio `pad` en (x, y)? (`t` se acepta por compatibilidad: las líneas no se mueven). */
export function laneHits(l: Lane, x: number, y: number, pad = 10, _t?: number): boolean {
  return segDist(l.x1, l.y1, l.x2, l.y2, x, y) <= l.width / 2 + pad;
}

/** Estado de una línea en el instante t: nada, aviso (k de 0 a 1), activa o apagándose. */
export type LaneState = { s: 'idle' } | { s: 'warn'; k: number } | { s: 'on'; k: number } | { s: 'fade'; k: number } | { s: 'done' };
export function laneState(l: Pick<Lane, 'warnAt' | 'fireAt' | 'offAt'>, t: number, fadeMs = 140): LaneState {
  if (t < l.warnAt) return { s: 'idle' };
  if (t < l.fireAt) return { s: 'warn', k: (t - l.warnAt) / (l.fireAt - l.warnAt) };
  if (t < l.offAt) return { s: 'on', k: (t - l.fireAt) / (l.offAt - l.fireAt) };
  if (t < l.offAt + fadeMs) return { s: 'fade', k: (t - l.offAt) / fadeMs };
  return { s: 'done' };
}

// --- Combo retardado ---

/** bolt: rayo que cae en un círculo marcado donde estabas al sacar el aviso. */
export type ComboHit = 'dash' | 'bolt' | 'zone';
/** Cuánto dura cada golpe una vez lanzado (ms). */
export const COMBO_ACT_MS: Record<ComboHit, number> = { dash: 380, bolt: 260, zone: 260 };

export interface ComboSpec {
  hits: number;
  warnMs: number;
  pauseMin: number;
  pauseMax: number;
  feintChance: number;
  /** Lo que se alarga el aviso en un amago (ms). */
  feintMin: number;
  feintMax: number;
  /** Radio de la zona (AoE amplia) y del círculo del rayo. */
  zoneR: number;
  boltR: number;
}

/** 3-5 golpes (más en pisos hondos y Difícil). Fácil: 3 golpes, más aviso, pausas más largas y menos amagos. */
export function comboSpec(floor: number, phase: 1 | 2, diff: Difficulty = 'normal'): ComboSpec {
  const d = depth(floor);
  let hits = 3 + Math.round(d) + (phase === 2 ? 1 : 0) + (diff === 'hard' ? 1 : 0);
  if (diff === 'easy') hits = 3;
  return {
    hits: clamp(hits, 3, 5),
    warnMs: diff === 'easy' ? 950 : diff === 'hard' ? FRENZY_MIN_WARN : 800,
    pauseMin: diff === 'easy' ? 450 : 220,
    pauseMax: diff === 'easy' ? 900 : 700,
    feintChance: diff === 'easy' ? 0.15 : diff === 'hard' ? 0.45 : 0.35,
    feintMin: 280,
    feintMax: 520,
    zoneR: diff === 'easy' ? 100 : 120,
    boltR: diff === 'easy' ? 90 : 105,
  };
}

export interface ComboStep {
  kind: ComboHit;
  /** Cuándo aparece el aviso, cuándo golpea y cuándo acaba (ms desde el inicio). */
  warnAt: number;
  fireAt: number;
  endAt: number;
  feint: boolean;
}

/** Golpes encadenados: empieza con embestida, luego rayo y zona, y sigue sin repetir el anterior. */
export function comboPlan(spec: ComboSpec, rng: () => number): { steps: ComboStep[]; totalMs: number } {
  const kinds: ComboHit[] = ['dash', 'bolt', 'zone'];
  const steps: ComboStep[] = [];
  let t = 0;
  for (let i = 0; i < clamp(spec.hits, 3, 5); i++) {
    let kind: ComboHit;
    if (i < 3) kind = kinds[i];
    else {
      const opts = kinds.filter((k) => k !== steps[i - 1].kind);
      kind = opts[Math.floor(rng() * opts.length) % opts.length];
    }
    const feint = i > 0 && rng() < spec.feintChance;
    const warnAt = t;
    const fireAt = warnAt + spec.warnMs + (feint ? spec.feintMin + rng() * (spec.feintMax - spec.feintMin) : 0);
    const endAt = fireAt + COMBO_ACT_MS[kind];
    steps.push({ kind, warnAt, fireAt, endAt, feint });
    t = endAt + spec.pauseMin + rng() * (spec.pauseMax - spec.pauseMin);
  }
  return { steps, totalMs: steps[steps.length - 1].endAt };
}

export const zoneHits = (cx: number, cy: number, r: number, x: number, y: number, pad = 6): boolean => Math.hypot(x - cx, y - cy) <= r + pad;

// --- Tormenta ---

/** Velocidad base del jugador (px/s; DASH_BASE_MOVE) y la del pasillo seguro de la tormenta (como mucho el 60 %). */
export const PLAYER_BASE_SPEED = 240;
export const STORM_SAFE_SPEED = PLAYER_BASE_SPEED * 0.6;
/** Radio del pasillo seguro de la tormenta (diámetro 60 ≥ SAFE_MIN; el jugador mide ~36). */
export const STORM_SAFE_R = 30;
/** Máximo de elementos a la vez (aviso, activos o apagándose); con efectos reducidos, menos. */
export const STORM_MAX_ACTIVE = 40;
export const STORM_MAX_ACTIVE_LOW = 26;
const STORM_FADE_MS = 140;

export interface StormSpec {
  cascades: number;
  /** Entre el arranque de una cascada y el de la siguiente (ms). */
  startMin: number;
  startMax: number;
  /** Duración total buscada (ms). */
  durMin: number;
  durMax: number;
  warnMs: number;
  maxActive: number;
  /** Rayos en círculo dentro de la tormenta: cada cuánto (ms) y cuántos a la vez. */
  strikeEvery: number;
  strikeMax: number;
}

/** Fase 1: 3-4 cascadas en 6-10 s; fase 2: 4-5 en 9-14 s. Aviso ≥ 750 ms (950 en Fácil). */
export function stormSpec(floor: number, phase: 1 | 2, diff: Difficulty = 'normal', low = false): StormSpec {
  const d = depth(floor);
  let cascades = (phase === 2 ? 4 : 3) + Math.round(d);
  if (diff === 'hard') cascades++;
  if (diff === 'easy') cascades--;
  return {
    cascades: clamp(cascades, 3, 5),
    startMin: 600,
    startMax: 900,
    durMin: phase === 2 ? 9500 : 6500,
    durMax: phase === 2 ? 13500 : 9500,
    warnMs: diff === 'easy' ? 950 : Math.max(FRENZY_MIN_WARN, phase === 2 || diff === 'hard' ? 750 : 820),
    maxActive: low ? STORM_MAX_ACTIVE_LOW : STORM_MAX_ACTIVE,
    strikeEvery: (phase === 2 ? 480 : 800) + (diff === 'easy' ? 250 : diff === 'hard' ? -80 : 0),
    strikeMax: low ? 2 : phase === 2 ? 4 : 3,
  };
}

/** Trayectoria segura: puntos de paso con su instante; entre ellos se desliza con suavidad (smoothstep). */
export interface SafePath {
  pts: { t: number; x: number; y: number }[];
  r: number;
}
export function safeAt(p: SafePath, t: number): Pt {
  const a = p.pts;
  if (t <= a[0].t) return { x: a[0].x, y: a[0].y };
  for (let i = 1; i < a.length; i++) {
    if (t <= a[i].t) {
      const u = (t - a[i - 1].t) / Math.max(1, a[i].t - a[i - 1].t);
      const k = u * u * (3 - 2 * u);
      return { x: a[i - 1].x + (a[i].x - a[i - 1].x) * k, y: a[i - 1].y + (a[i].y - a[i - 1].y) * k };
    }
  }
  const z = a[a.length - 1];
  return { x: z.x, y: z.y };
}

/** Margen del pasillo con las paredes (y el radio útil en salas pequeñas). */
const stormMargin = (b: Bounds) => ({
  mx: Math.min((b.x1 - b.x0) / 2 - 1, STORM_SAFE_R + 30),
  my: Math.min((b.y1 - b.y0) / 2 - 1, STORM_SAFE_R + 30),
});

/**
 * Pasillo seguro desde `start` (el jugador): cada ~1,1-1,6 s va hacia otro punto de la sala (preferiblemente lejos del
 * jefe), sin pasar nunca de STORM_SAFE_SPEED (el smoothstep llega a 1,5× la media, por eso se divide).
 */
export function stormPath(b: Bounds, start: Pt, origin: Pt, totalMs: number, rng: () => number): SafePath {
  const { mx, my } = stormMargin(b);
  const inX = (x: number) => clamp(x, b.x0 + mx, b.x1 - mx);
  const inY = (y: number) => clamp(y, b.y0 + my, b.y1 - my);
  const pts = [{ t: 0, x: inX(start.x), y: inY(start.y) }];
  // El primero se queda quieto un rato (aviso de la primera cascada): da tiempo a situarse
  pts.push({ t: 700, x: pts[0].x, y: pts[0].y });
  let t = 700;
  while (t < totalMs + 400) {
    const dt = 1100 + rng() * 500;
    const last = pts[pts.length - 1];
    const maxD = ((STORM_SAFE_SPEED * dt) / 1000 / 1.5) * 0.97;
    let best = { x: last.x, y: last.y };
    let score = -Infinity;
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2;
      const dd = maxD * (0.5 + 0.5 * rng());
      const c = { x: inX(last.x + Math.cos(a) * dd), y: inY(last.y + Math.sin(a) * dd) };
      const sc = Math.min(220, Math.hypot(c.x - origin.x, c.y - origin.y)) + Math.hypot(c.x - last.x, c.y - last.y) * 0.3;
      if (sc > score) {
        score = sc;
        best = c;
      }
    }
    t += dt;
    pts.push({ t, x: best.x, y: best.y });
  }
  return { pts, r: STORM_SAFE_R };
}

/** ¿Cubre el elemento (activo) el pasillo seguro en el instante t? */
export function coversSafe(l: Lane, p: SafePath, t: number, extra = 0): boolean {
  const s = safeAt(p, t);
  return laneHits(l, s.x, s.y, p.r + extra);
}
/** ¿Cubre el círculo del rayo el pasillo seguro en el instante t? */
export function strikeCoversSafe(k: Strike, p: SafePath, t: number, extra = 0): boolean {
  const s = safeAt(p, t);
  return strikeHits(k, s.x, s.y, p.r + extra);
}

/** Muestras del pasillo en [t0, t1] (cada `step` ms y los extremos). */
function pathSamples(p: SafePath, t0: number, t1: number, step = 20): Pt[] {
  const out: Pt[] = [];
  for (let t = t0; t < t1; t += step) out.push(safeAt(p, t));
  out.push(safeAt(p, t1));
  return out;
}

/** Descarta un elemento que podría tocar el pasillo seguro mientras avisa o quema. */
function respectPath(l: Lane, p: SafePath): Lane | null {
  // Margen extra: el pasillo se mueve como mucho ~4,4 px entre muestras de 20 ms
  const pad = p.r + 8;
  const pts = pathSamples(p, l.warnAt, l.offAt + STORM_FADE_MS);
  return pts.some((q) => segDist(l.x1, l.y1, l.x2, l.y2, q.x, q.y) <= l.width / 2 + pad) ? null : l;
}

export interface StormPlan {
  shapes: CascadeShape[];
  /** Arranque de cada cascada (ms). */
  starts: number[];
  lanes: Lane[];
  /** Rayos en círculo que caen entre las líneas (nunca sobre el pasillo). */
  strikes: Strike[];
  path: SafePath;
  totalMs: number;
}

/** Elementos «vivos» (aviso, activos o apagándose) en el instante t. */
export const liveAt = (lanes: readonly Lane[], t: number): number => lanes.reduce((n, l) => n + (t >= l.warnAt && t < l.offAt + STORM_FADE_MS ? 1 : 0), 0);

/** Formas de la tormenta: al menos una mezclada y las simples distintas entre sí. */
export function stormShapes(pool: readonly CascadeShape[], n: number, rng: () => number): CascadeShape[] {
  const simples = shuffle([...new Set(pool.filter((s) => !isMixedShape(s)))], rng);
  const out: CascadeShape[] = ['mixed'];
  while (out.length < n && simples.length) out.push(simples.shift() as CascadeShape);
  while (out.length < n) out.push('mixed');
  // La primera, simple (rampa: empieza legible); la mezclada más densa al final si cabe
  const first = out.findIndex((s) => !isMixedShape(s));
  if (first > 0) [out[0], out[first]] = [out[first], out[0]];
  return out;
}

/**
 * Tormenta: `cascades` cascadas que se solapan (cada una arranca 600-900 ms después de la anterior, mientras la otra
 * aún dispara), alargadas para que la tormenta dure lo pedido, con rampa (la primera con la mitad de elementos y la
 * última completa) y un pasillo seguro común que todas respetan (se lo pasan a cascadePlan y lo que lo tocaría se
 * quita o se reorienta). Como mucho `maxActive` elementos a la vez.
 */
export function stormPlan(b: Bounds, spec: StormSpec, origin: Pt, player: Pt, pool: readonly CascadeShape[], rng: () => number, base: CascadeSpec): StormPlan {
  const n = clamp(spec.cascades, 3, 5);
  const shapes = stormShapes(pool.length ? pool : CASCADE_SHAPES, n, rng);
  const starts: number[] = [0];
  for (let i = 1; i < n; i++) starts.push(starts[i - 1] + spec.startMin + rng() * (spec.startMax - spec.startMin));
  const target = spec.durMin + rng() * (spec.durMax - spec.durMin);
  // Cada cascada dura lo que falta desde su arranque hasta el final buscado (todas acaban juntas, densas al final)
  const path = stormPath(b, player, origin, target, rng);
  const lanes: Lane[] = [];
  // Cadencia de cada corriente: más rápida en fase 2 y en Difícil (base.staggerMs 80-150 → 160-240)
  const stagger = clamp(base.staggerMs + 70, 160, 240);
  const sub: CascadeSpec = { ...base, staggerMs: stagger, warnMs: spec.warnMs };
  const lastFire = target - base.onMs;
  for (let i = 0; i < n; i++) {
    // Cada cascada es una corriente: tanda tras tanda de su forma (cada tanda con el hueco común donde estará el
    // pasillo a mitad de ella) desde su arranque hasta el final; todas acaban juntas, densas al final
    let acc = 0;
    for (let t = starts[i]; t + spec.warnMs < lastFire; ) {
      const span = sub.lanes * stagger;
      const plan = cascadePlan(b, shapes[i], sub, origin, rng, safeAt(path, t + spec.warnMs + span / 2));
      for (const l of plan.lanes) {
        const shifted: Lane = { ...l, warnAt: l.warnAt + t, fireAt: l.fireAt + t, offAt: l.offAt + t };
        if (shifted.fireAt > lastFire) break;
        // Rampa: al principio se queda ~el 45 % de los elementos y al final todos (de forma regular)
        acc += 0.45 + 0.55 * clamp(shifted.warnAt / target, 0, 1);
        if (acc < 1) continue;
        acc -= 1;
        const ok = respectPath(shifted, path);
        if (ok) lanes.push(ok);
      }
      t += Math.max(span, stagger * 4);
    }
  }
  lanes.sort((a, c) => a.warnAt - c.warnAt);
  // Tope de elementos a la vez (se descartan los que lo pasarían)
  const kept: Lane[] = [];
  for (const l of lanes) {
    const busy = kept.filter((k) => k.offAt + STORM_FADE_MS > l.warnAt && k.warnAt < l.offAt + STORM_FADE_MS);
    // Peor caso: todos los solapados con l a la vez
    if (busy.length < spec.maxActive || maxOverlap([...busy, l]) <= spec.maxActive) kept.push(l);
  }
  const strikes = stormStrikes(b, spec, path, target, rng);
  return { shapes, starts, lanes: kept, strikes, path, totalMs: Math.max(0, ...kept.map((l) => l.offAt), ...strikes.map((k) => k.offAt)) };
}

/**
 * Rayos de la tormenta: cada `strikeEvery` ms un círculo (radio 90-110) donde no llegue el pasillo seguro mientras avisa
 * y quema; como mucho `strikeMax` a la vez y sin pisarse entre ellos. Sin apuntados (el pasillo manda).
 */
function stormStrikes(b: Bounds, spec: StormSpec, path: SafePath, target: number, rng: () => number): Strike[] {
  const out: Strike[] = [];
  if (spec.strikeEvery <= 0) return out;
  const rCap = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 3;
  for (let t = 600; t + spec.warnMs + LIGHTNING_ON_MS < target; t += spec.strikeEvery * (0.8 + 0.4 * rng())) {
    const live = out.filter((k) => k.offAt + STORM_FADE_MS > t);
    if (live.length >= spec.strikeMax) continue;
    const r = Math.min(rCap, 90 + rng() * 20);
    const warnAt = t;
    const fireAt = warnAt + spec.warnMs;
    const offAt = fireAt + LIGHTNING_ON_MS;
    const pts = pathSamples(path, warnAt, offAt + STORM_FADE_MS);
    for (let tries = 0; tries < 16; tries++) {
      const c = clampCenter(b, b.x0 + rng() * (b.x1 - b.x0), b.y0 + rng() * (b.y1 - b.y0), r);
      if (pts.some((q) => Math.hypot(q.x - c.x, q.y - c.y) <= r + path.r + 18)) continue;
      if (live.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < k.r + r * 0.6)) continue;
      out.push({ x: c.x, y: c.y, r, warnAt, fireAt, offAt, aimed: false });
      break;
    }
  }
  return out;
}

/** Máximo de elementos vivos a la vez (barrido por eventos). */
export function maxOverlap(lanes: readonly Lane[]): number {
  const ev: [number, number][] = [];
  for (const l of lanes) ev.push([l.warnAt, 1], [l.offAt + STORM_FADE_MS, -1]);
  ev.sort((a, c) => a[0] - c[0] || a[1] - c[1]);
  let n = 0;
  let m = 0;
  for (const [, d] of ev) m = Math.max(m, (n += d));
  return m;
}

/** Respiro tras un ataque frenético antes del siguiente (ms): corto, más en fase 2. */
export const frenzyRest = (phase: 1 | 2, attack: FrenzyAttack): number => (attack === 'storm' ? (phase === 2 ? 250 : 450) : phase === 2 ? 200 : 350);

// --- Acoso (fase 2): ataques que se acercan al jugador ---

export interface ChaseSpec {
  /** Zonas que se arrastran hacia ti (y al acabar estallan y dejan un charco que dura). */
  creepers: number;
  creepR: number;
  /** px/s, siempre por debajo de la velocidad del jugador (se puede huir). */
  creepSpeed: number;
  creepLife: number;
  /** Explosión final (radio) y charco persistente (radio, ms). */
  blastR: number;
  puddleR: number;
  puddleMs: number;
  /** Orbes teledirigidos: velocidad, giro máximo (rad/s) y vida corta (ms). */
  homers: number;
  homerSpeed: number;
  homerTurn: number;
  homerLife: number;
  /** Rayos que caen en un círculo donde estabas (aviso warnMs; se esquivan saliendo del círculo). */
  bolts: number;
  boltR: number;
  warnMs: number;
  /** Cada cuánto aparece un elemento nuevo (ms) y cuánto dura el acoso. */
  everyMs: number;
  durMs: number;
  /** Tope de objetos vivos a la vez. */
  maxLive: number;
}

/** Fácil: menos y más lentos, más aviso; Difícil: más y algo más rápidos (siempre esquivables). */
export function chaseSpec(floor: number, phase: 1 | 2, diff: Difficulty = 'normal', low = false): ChaseSpec {
  const d = depth(floor);
  const e = diff === 'easy';
  const h = diff === 'hard';
  return {
    creepers: (e ? 3 : h ? 6 : 5) + Math.round(d),
    creepR: e ? 50 : 60,
    creepSpeed: PLAYER_BASE_SPEED * (e ? 0.38 : h ? 0.55 : 0.48),
    creepLife: 2600,
    blastR: e ? 90 : 110,
    puddleR: e ? 44 : 54,
    puddleMs: e ? 2500 : 4000,
    homers: (e ? 4 : h ? 9 : 7) + Math.round(d * 2),
    homerSpeed: PLAYER_BASE_SPEED * (e ? 0.85 : h ? 1.15 : 1),
    homerTurn: e ? 1.4 : h ? 2.2 : 1.9,
    homerLife: e ? 1800 : 2400,
    bolts: e ? 2 : h ? 5 : 4,
    boltR: e ? 90 : 105,
    warnMs: e ? 950 : FRENZY_MIN_WARN,
    everyMs: e ? 520 : h ? 330 : 400,
    durMs: phase === 2 ? 8000 : 6000,
    maxLive: low ? 16 : 28,
  };
}

/** Un paso de algo que se arrastra hacia `to` a `speed` px/s (sin pasarse). */
export function creepStep(p: Pt, to: Pt, speed: number, dtMs: number): Pt {
  const dx = to.x - p.x;
  const dy = to.y - p.y;
  const d = Math.hypot(dx, dy);
  const m = (speed * dtMs) / 1000;
  if (d <= m || d < 1e-9) return { x: to.x, y: to.y };
  return { x: p.x + (dx / d) * m, y: p.y + (dy / d) * m };
}

/** Un paso de un orbe teledirigido: gira como mucho `turn` rad/s hacia `to` y avanza. */
export function homingStep(p: Pt, ang: number, to: Pt, speed: number, turn: number, dtMs: number): { x: number; y: number; ang: number } {
  let da = Math.atan2(to.y - p.y, to.x - p.x) - ang;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const max = (turn * dtMs) / 1000;
  const a = ang + clamp(da, -max, max);
  const m = (speed * dtMs) / 1000;
  return { x: p.x + Math.cos(a) * m, y: p.y + Math.sin(a) * m, ang: a };
}

export type ChaseKind = 'creep' | 'homer' | 'bolt';
/** Orden de aparición: mezcla de los tres, con los rayos repartidos (nunca dos seguidos). */
export function chaseOrder(spec: ChaseSpec, rng: () => number): ChaseKind[] {
  const rest = shuffle<ChaseKind>([...Array.from({ length: spec.creepers }, () => 'creep' as const), ...Array.from({ length: spec.homers }, () => 'homer' as const)], rng);
  const out: ChaseKind[] = [...rest];
  for (let i = 0; i < spec.bolts; i++) out.splice(Math.round(((i + 1) * out.length) / (spec.bolts + 1)) + i, 0, 'bolt');
  return out;
}

// --- Rayos: círculos en el suelo donde cae un rayo ---

/** Cuánto quema el rayo una vez cae (ms). */
export const LIGHTNING_ON_MS = 240;

export interface LightningSpec {
  strikes: number;
  /** ms entre el aviso de un círculo y el del siguiente. */
  staggerMs: number;
  warnMs: number;
  onMs: number;
  rMin: number;
  rMax: number;
  /** Fracción de círculos apuntados a donde estás al sacar su aviso. */
  aimed: number;
  /** Fracción máxima de la sala que pueden cubrir los círculos vivos a la vez (siempre queda hueco). */
  cover: number;
}

/** Fase 1: 6-10 rayos cada ~300-400 ms; fase 2: 11-18 cada ~150-260 ms y más apuntados. Fácil más lento y con más aviso. */
export function lightningSpec(floor: number, phase: 1 | 2, diff: Difficulty = 'normal'): LightningSpec {
  const d = depth(floor);
  let strikes = (phase === 2 ? 13 : 7) + Math.round(d * 2);
  let stagger = (phase === 2 ? 230 : 380) - Math.round(d * 30);
  let warn = phase === 2 ? 820 : 900;
  if (diff === 'easy') {
    strikes -= 1;
    stagger += 80;
    warn = 1050;
  } else if (diff === 'hard') {
    strikes += 1;
    stagger -= 30;
    warn -= 60;
  }
  return {
    strikes: phase === 2 ? clamp(strikes, 11, 18) : clamp(strikes, 6, 10),
    staggerMs: phase === 2 ? clamp(stagger, 150, 320) : clamp(stagger, 300, 460),
    warnMs: Math.max(FRENZY_MIN_WARN, warn),
    onMs: LIGHTNING_ON_MS,
    rMin: diff === 'easy' ? 90 : 95,
    rMax: diff === 'easy' ? 115 : 130,
    aimed: phase === 2 ? 0.5 : 0.35,
    cover: diff === 'easy' ? 0.35 : 0.45,
  };
}

/** Un rayo: círculo (centro y radio) y sus tiempos (ms desde el inicio). `aimed`: se recoloca sobre ti al avisar. */
export interface Strike {
  x: number;
  y: number;
  r: number;
  warnAt: number;
  fireAt: number;
  offAt: number;
  aimed: boolean;
}
export interface LightningPlan {
  strikes: Strike[];
  totalMs: number;
}

/** Centro para que el círculo entero quede dentro de la sala. */
export function clampCenter(b: Bounds, x: number, y: number, r: number): Pt {
  const W = b.x1 - b.x0;
  const H = b.y1 - b.y0;
  return {
    x: W > 2 * r ? clamp(x, b.x0 + r, b.x1 - r) : b.x0 + W / 2,
    y: H > 2 * r ? clamp(y, b.y0 + r, b.y1 - r) : b.y0 + H / 2,
  };
}
/** Radio real en la sala (como mucho un tercio del lado corto). */
export const strikeRadius = (b: Bounds, r: number): number => Math.min(r, Math.min(b.x1 - b.x0, b.y1 - b.y0) / 3);
/** ¿Le da el rayo a algo de radio `pad` en (x, y)? Solo dentro del círculo. */
export const strikeHits = (k: Pick<Strike, 'x' | 'y' | 'r'>, x: number, y: number, pad = 10): boolean => Math.hypot(x - k.x, y - k.y) <= k.r + pad;
/** Recoloca un rayo apuntado sobre `p` (dentro de la sala). */
export function aimStrike(k: Strike, p: Pt, b: Bounds): Strike {
  const c = clampCenter(b, p.x, p.y, k.r);
  return { ...k, x: c.x, y: c.y };
}
/** Cuántos círculos pueden estar vivos a la vez sin pasar de `cover` de la sala. */
export function strikeMaxLive(b: Bounds, spec: LightningSpec): number {
  const r = strikeRadius(b, spec.rMax);
  return Math.max(1, Math.floor((spec.cover * (b.x1 - b.x0) * (b.y1 - b.y0)) / (Math.PI * r * r)));
}
const LIGHTNING_FADE_MS = 160;

/**
 * Plan de rayos en la sala `b`: uno detrás de otro (staggerMs), cada uno con su aviso; si ya hay demasiados vivos
 * (strikeMaxLive), el siguiente espera. Los no apuntados buscan sitio lejos de los vivos; los apuntados nacen sobre
 * `player` y en marcha se recolocan donde estés al sacar su aviso (aimStrike).
 */
export function lightningPlan(b: Bounds, spec: LightningSpec, player: Pt, rng: () => number): LightningPlan {
  const maxLive = strikeMaxLive(b, spec);
  const out: Strike[] = [];
  let t = 0;
  let aimAcc = rng();
  for (let i = 0; i < spec.strikes; i++) {
    const r = strikeRadius(b, spec.rMin + rng() * (spec.rMax - spec.rMin));
    let warnAt = i === 0 ? 0 : t + spec.staggerMs;
    // Tope de vivos: espera a que se apague el que toque
    const ends = out.map((k) => k.offAt + LIGHTNING_FADE_MS).sort((a, c) => c - a);
    if (ends.length >= maxLive) warnAt = Math.max(warnAt, ends[maxLive - 1]);
    t = warnAt;
    const fireAt = warnAt + spec.warnMs;
    const offAt = fireAt + spec.onMs;
    // Reparto regular de apuntados (una fracción fija, con fase al azar)
    aimAcc += spec.aimed;
    const aimed = aimAcc >= 1;
    if (aimed) aimAcc -= 1;
    const live = out.filter((k) => k.offAt + LIGHTNING_FADE_MS > warnAt);
    let c = clampCenter(b, player.x, player.y, r);
    if (!aimed) {
      let best = -Infinity;
      for (let tries = 0; tries < 14; tries++) {
        const q = clampCenter(b, b.x0 + rng() * (b.x1 - b.x0), b.y0 + rng() * (b.y1 - b.y0), r);
        const sc = live.length ? Math.min(...live.map((k) => Math.hypot(k.x - q.x, k.y - q.y) - k.r - r)) : 0;
        // Algunos cerca de ti (sin estar encima): a 1-2,5 radios del jugador
        const dp = Math.hypot(q.x - player.x, q.y - player.y);
        const near = dp > r && dp < r * 2.5 ? 40 : 0;
        if (sc + near + rng() * 30 > best) {
          best = sc + near + rng() * 30;
          c = q;
        }
      }
    }
    out.push({ x: c.x, y: c.y, r, warnAt, fireAt, offAt, aimed });
  }
  return { strikes: out, totalMs: Math.max(0, ...out.map((k) => k.offAt)) };
}

/** Rayos vivos (aviso, cayendo o apagándose) en el instante t. */
export const strikesLiveAt = (ks: readonly Strike[], t: number): Strike[] => ks.filter((k) => t >= k.warnAt && t < k.offAt + LIGHTNING_FADE_MS);

// --- Selección ---

/** Fase 1: cascadas, tormentas y rayos. Fase 2: además combos retardados y acoso. */
export const frenzyAttacksFor = (phase: 1 | 2): FrenzyAttack[] => (phase === 2 ? ['cascade', 'storm', 'lightning', 'feintCombo', 'chase'] : ['cascade', 'storm', 'lightning']);

/** Probabilidad de que el siguiente ataque del jefe sea frenético: 60 % en fase 1 y 80 % en fase 2 (Fácil ×0,6,
 * Difícil ×1,2 hasta el 95 %). */
export function frenzyChance(phase: 1 | 2, diff: Difficulty = 'normal'): number {
  const base = phase === 2 ? 0.8 : 0.6;
  return diff === 'easy' ? base * 0.6 : diff === 'hard' ? Math.min(0.95, base * 1.2) : base;
}

/** ¿Toca un ataque frenético? ~40 % tormentas, ~30 % rayos (sin repetir) y el resto otro (sin repetir el último), o null. */
export function pickFrenzy(phase: 1 | 2, diff: Difficulty, rng: () => number, last?: string): FrenzyAttack | null {
  if (rng() >= frenzyChance(phase, diff)) return null;
  const r = rng();
  if (r < 0.4) return 'storm';
  if (r < 0.7 && last !== 'lightning') return 'lightning';
  const all = frenzyAttacksFor(phase).filter((a) => a !== 'storm' && a !== 'lightning');
  const opts = all.length > 1 ? all.filter((a) => a !== last) : all;
  return opts[Math.floor(rng() * opts.length) % opts.length];
}
