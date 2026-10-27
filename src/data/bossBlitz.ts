// Ataques nuevos de los jefes («asaltos»): siempre con aviso legible y sin salir de la arena. Lógica pura (sin Phaser),
// con tests en tests/bossBlitz.test.ts. GameScene.bossBlitz los dibuja (arte en src/ui/art/blitzFx.ts).
import { clampDash, clipBeamToBounds, type Bounds } from '../level/bounds.ts';

/**
 * meteor: meteoros que caen sobre zonas marcadas (en tandas); helix: doble espiral que gira en sentidos contrarios;
 * wallGap: muro que cruza la sala con un hueco por el que pasar; crossMines: minas que estallan en cruz;
 * gridBeams: rejilla de rayos de pared a pared (filas y columnas) con calles seguras; bounce: orbes que rebotan en las
 * paredes; miasma: zonas de niebla que se quedan un rato; lineDash: embestidas en línea marcada de pared a pared.
 */
export type BlitzAttack = 'meteor' | 'helix' | 'wallGap' | 'crossMines' | 'gridBeams' | 'bounce' | 'miasma' | 'lineDash';
export const BLITZ_ATTACKS: readonly BlitzAttack[] = ['meteor', 'helix', 'wallGap', 'crossMines', 'gridBeams', 'bounce', 'miasma', 'lineDash'];
export const isBlitzAttack = (a: string): a is BlitzAttack => (BLITZ_ATTACKS as readonly string[]).includes(a);

export const BLITZ_LABEL: Record<BlitzAttack, string> = {
  meteor: 'Lluvia de meteoros',
  helix: 'Doble hélice',
  wallGap: 'Muro implacable',
  crossMines: 'Minas en cruz',
  gridBeams: 'Rejilla de rayos',
  bounce: 'Orbes rebotantes',
  miasma: 'Niebla persistente',
  lineDash: 'Embestida marcada',
};

/** El aviso de cualquier asalto nunca baja de esto (ms). */
export const BLITZ_MIN_WARN = 900;

/** Dos asaltos por tipo (el primer tipo del jefe manda; el segundo tipo aporta su primero si es distinto). */
const TYPE_BLITZ: Record<string, [BlitzAttack, BlitzAttack]> = {
  fire: ['meteor', 'miasma'],
  water: ['bounce', 'helix'],
  grass: ['miasma', 'crossMines'],
  electric: ['gridBeams', 'crossMines'],
  ice: ['wallGap', 'meteor'],
  fighting: ['lineDash', 'bounce'],
  poison: ['miasma', 'crossMines'],
  ground: ['meteor', 'lineDash'],
  flying: ['lineDash', 'bounce'],
  psychic: ['helix', 'gridBeams'],
  bug: ['crossMines', 'helix'],
  rock: ['meteor', 'wallGap'],
  ghost: ['helix', 'miasma'],
  dragon: ['lineDash', 'gridBeams'],
  dark: ['crossMines', 'lineDash'],
  steel: ['wallGap', 'gridBeams'],
  fairy: ['bounce', 'helix'],
  normal: ['wallGap', 'bounce'],
};

export function blitzAttacksFor(types: readonly string[]): BlitzAttack[] {
  const first = types.find((t) => TYPE_BLITZ[t]);
  const out: BlitzAttack[] = [...(first ? TYPE_BLITZ[first] : TYPE_BLITZ.normal)];
  for (const t of types) {
    const extra = TYPE_BLITZ[t]?.[0];
    if (extra && !out.includes(extra)) {
      out.push(extra);
      break;
    }
  }
  return out;
}

/** 0 en el piso 1 y 1 desde el 6. */
const depth = (floor: number): number => Math.min(1, Math.max(0, (Math.floor(floor) - 1) / 5));

export interface Pt {
  x: number;
  y: number;
}

// --- Lluvia de meteoros ---

export interface MeteorSpec {
  waves: number;
  perWave: number;
  radius: number;
  warnMs: number;
  everyMs: number;
}
export function meteorSpec(floor: number, phase: 1 | 2): MeteorSpec {
  const d = depth(floor);
  return {
    waves: 2 + (phase === 2 ? 1 : 0),
    perWave: Math.min(6, 3 + Math.round(d * 2) + (phase === 2 ? 1 : 0)),
    radius: 64,
    warnMs: Math.max(BLITZ_MIN_WARN, 1250 - Math.round(d * 250)),
    everyMs: 650,
  };
}

/** Zonas de una tanda: la primera sobre el jugador (acotada) y el resto al azar; todas enteras dentro de la arena. */
export function meteorSpots(b: Bounds, n: number, radius: number, player: Pt, rng: () => number): Pt[] {
  const m = radius + 4;
  const cl = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const out: Pt[] = [{ x: cl(player.x, b.x0 + m, b.x1 - m), y: cl(player.y, b.y0 + m, b.y1 - m) }];
  for (let k = 1; k < n; k++) out.push({ x: cl(b.x0 + m + rng() * (b.x1 - b.x0 - 2 * m), b.x0 + m, b.x1 - m), y: cl(b.y0 + m + rng() * (b.y1 - b.y0 - 2 * m), b.y0 + m, b.y1 - m) });
  return out;
}

// --- Doble hélice ---

export interface HelixSpec {
  arms: number;
  shots: number;
  everyMs: number;
  turn: number;
}
export function helixSpec(floor: number, phase: 1 | 2): HelixSpec {
  const d = depth(floor);
  return {
    arms: phase === 2 && d >= 0.5 ? 3 : 2,
    shots: 12 + Math.round(d * 6),
    // Nunca más seguido que cada 110 ms
    everyMs: Math.max(110, 170 - Math.round(d * 40) - (phase === 2 ? 15 : 0)),
    turn: 0.2 + d * 0.05,
  };
}
/** Ángulos del disparo `i`: una hélice gira a un lado y la otra al contrario (desfasada media separación). */
export function helixAngles(spec: HelixSpec, base: number, i: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < spec.arms; k++) {
    const a = base + (k / spec.arms) * Math.PI * 2;
    out.push(a + i * spec.turn, a + Math.PI / spec.arms - i * spec.turn);
  }
  return out;
}

// --- Muro con hueco ---

export interface WallSpec {
  walls: number;
  speed: number;
  gap: number;
  thick: number;
  warnMs: number;
  everyMs: number;
}
export function wallSpec(floor: number, phase: 1 | 2): WallSpec {
  const d = depth(floor);
  return {
    walls: 1 + (phase === 2 ? 1 : 0) + (d >= 0.6 ? 1 : 0),
    // Como mucho 260 px/s y un hueco de 120 px o más: siempre se llega
    speed: Math.min(260, 170 + Math.round(d * 70) + (phase === 2 ? 20 : 0)),
    gap: Math.max(120, 170 - Math.round(d * 40)),
    thick: 28,
    warnMs: Math.max(BLITZ_MIN_WARN, 1200 - Math.round(d * 200)),
    everyMs: 1400,
  };
}
export interface WallPlan {
  /** 'x': el muro es vertical y avanza en x; 'y': horizontal y avanza en y. */
  axis: 'x' | 'y';
  /** 1: de x0/y0 hacia x1/y1; -1 al revés. */
  dir: 1 | -1;
  gapStart: number;
  gapEnd: number;
}
export function wallPlan(b: Bounds, spec: WallSpec, rng: () => number): WallPlan {
  const axis: 'x' | 'y' = rng() < 0.5 ? 'x' : 'y';
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const lo = axis === 'x' ? b.y0 : b.x0;
  const hi = axis === 'x' ? b.y1 : b.x1;
  const gap = Math.min(spec.gap, hi - lo);
  const start = lo + rng() * Math.max(0, hi - lo - gap);
  return { axis, dir, gapStart: start, gapEnd: start + gap };
}
/** Posición del muro (en su eje) a los `t` s; null cuando ya ha salido por el otro lado. */
export function wallPos(b: Bounds, plan: WallPlan, speed: number, t: number): number | null {
  const lo = plan.axis === 'x' ? b.x0 : b.y0;
  const hi = plan.axis === 'x' ? b.x1 : b.y1;
  const p = plan.dir === 1 ? lo + speed * t : hi - speed * t;
  return p < lo || p > hi ? null : p;
}
export const wallTravelMs = (b: Bounds, plan: WallPlan, speed: number): number =>
  (((plan.axis === 'x' ? b.x1 - b.x0 : b.y1 - b.y0) / speed) * 1000);
export function wallHits(plan: WallPlan, pos: number, thick: number, x: number, y: number): boolean {
  const along = plan.axis === 'x' ? x : y;
  const across = plan.axis === 'x' ? y : x;
  if (Math.abs(along - pos) > thick / 2) return false;
  return across < plan.gapStart || across > plan.gapEnd;
}

// --- Minas en cruz ---

export interface CrossSpec {
  mines: number;
  fuseMs: number;
  width: number;
  length: number;
}
export function crossSpec(floor: number, phase: 1 | 2): CrossSpec {
  const d = depth(floor);
  return { mines: Math.min(5, 2 + Math.round(d * 2) + (phase === 2 ? 1 : 0)), fuseMs: Math.max(BLITZ_MIN_WARN + 200, 1500 - Math.round(d * 300)), width: 26, length: 340 };
}
/** Brazos de una mina (4 haces cortados en el borde): [ángulo, largo]. */
export function crossArms(m: Pt, len: number, b: Bounds): [number, number][] {
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => [a, clipBeamToBounds(m.x, m.y, a, len, b)] as [number, number]);
}
export function crossHits(m: Pt, len: number, width: number, b: Bounds, x: number, y: number): boolean {
  for (const [a, l] of crossArms(m, len, b)) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = Math.max(0, Math.min(l, (x - m.x) * dx + (y - m.y) * dy));
    if (Math.hypot(x - (m.x + dx * t), y - (m.y + dy * t)) <= width / 2) return true;
  }
  return false;
}
/** Minas repartidas (al azar, dentro de la arena con margen). */
export function crossMinePlaces(b: Bounds, n: number, rng: () => number, margin = 60): Pt[] {
  return Array.from({ length: n }, () => ({ x: b.x0 + margin + rng() * Math.max(0, b.x1 - b.x0 - 2 * margin), y: b.y0 + margin + rng() * Math.max(0, b.y1 - b.y0 - 2 * margin) }));
}

// --- Rejilla de rayos ---

export interface GridSpec {
  /** Franjas por eje (la sala se divide en `slots` franjas y se encienden `lit`). */
  slots: number;
  lit: number;
  width: number;
  warnMs: number;
  /** Cuánto dura encendido cada barrido (ms). */
  onMs: number;
}
export function gridSpec(floor: number, phase: 1 | 2): GridSpec {
  const d = depth(floor);
  return { slots: 7, lit: Math.min(3, 2 + (phase === 2 || d >= 0.8 ? 1 : 0)), width: 30, warnMs: Math.max(BLITZ_MIN_WARN, 1150 - Math.round(d * 200)), onMs: 450 };
}
export interface GridBeam {
  axis: 'x' | 'y';
  /** Coordenada del centro del rayo (x para los verticales, y para los horizontales). */
  at: number;
}
/** Rayos de un barrido: `lit` franjas de `slots`, nunca dos seguidas (siempre queda una calle libre al lado). */
export function gridBeams(b: Bounds, spec: GridSpec, axis: 'x' | 'y', rng: () => number): GridBeam[] {
  const lo = axis === 'x' ? b.x0 : b.y0;
  const hi = axis === 'x' ? b.x1 : b.y1;
  const size = (hi - lo) / spec.slots;
  const free = Array.from({ length: spec.slots }, (_, k) => k);
  const chosen: number[] = [];
  for (let n = 0; n < spec.lit && free.length; n++) {
    const pick = free[Math.floor(rng() * free.length) % free.length];
    chosen.push(pick);
    for (const k of [pick - 1, pick, pick + 1]) {
      const i = free.indexOf(k);
      if (i >= 0) free.splice(i, 1);
    }
  }
  return chosen.sort((a, c) => a - c).map((k) => ({ axis, at: lo + size * (k + 0.5) }));
}
export const gridHits = (beam: GridBeam, width: number, x: number, y: number): boolean => Math.abs((beam.axis === 'x' ? x : y) - beam.at) <= width / 2;

// --- Orbes que rebotan ---

export interface BounceSpec {
  orbs: number;
  speed: number;
  bounces: number;
  radius: number;
  warnMs: number;
}
export function bounceSpec(floor: number, phase: 1 | 2): BounceSpec {
  const d = depth(floor);
  return { orbs: Math.min(6, 3 + Math.round(d * 2) + (phase === 2 ? 1 : 0)), speed: Math.min(300, 220 + Math.round(d * 60)), bounces: phase === 2 ? 3 : 2, radius: 16, warnMs: BLITZ_MIN_WARN };
}
export interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number;
}
/** Un paso del orbe: avanza y rebota en las paredes (gasta un rebote); con `left` < 0 ya se ha apagado. */
export function bounceStep(o: Orb, dt: number, b: Bounds, r: number): Orb {
  let { x, y, vx, vy, left } = o;
  x += vx * dt;
  y += vy * dt;
  if (x < b.x0 + r) { x = b.x0 + r + (b.x0 + r - x); vx = Math.abs(vx); left--; }
  else if (x > b.x1 - r) { x = b.x1 - r - (x - (b.x1 - r)); vx = -Math.abs(vx); left--; }
  if (y < b.y0 + r) { y = b.y0 + r + (b.y0 + r - y); vy = Math.abs(vy); left--; }
  else if (y > b.y1 - r) { y = b.y1 - r - (y - (b.y1 - r)); vy = -Math.abs(vy); left--; }
  x = Math.min(b.x1 - r, Math.max(b.x0 + r, x));
  y = Math.min(b.y1 - r, Math.max(b.y0 + r, y));
  return { x, y, vx, vy, left };
}
/** Abanico de salida (apuntado al jugador, separados lo justo). */
export function bounceAngles(n: number, aim: number): number[] {
  const spread = Math.min(Math.PI * 1.2, 0.45 * (n - 1));
  return Array.from({ length: n }, (_, k) => (n === 1 ? aim : aim - spread / 2 + (k / (n - 1)) * spread));
}

// --- Niebla persistente ---

export interface MiasmaSpec {
  zones: number;
  radius: number;
  warnMs: number;
  lingerMs: number;
}
export function miasmaSpec(floor: number, phase: 1 | 2): MiasmaSpec {
  const d = depth(floor);
  return { zones: Math.min(5, 2 + Math.round(d * 2) + (phase === 2 ? 1 : 0)), radius: 78, warnMs: Math.max(BLITZ_MIN_WARN + 100, 1300 - Math.round(d * 200)), lingerMs: 3200 + Math.round(d * 800) };
}

// --- Embestida marcada ---

export interface DashSpec {
  dashes: number;
  warnMs: number;
  speed: number;
  /** Ancho del golpe alrededor de la línea. */
  width: number;
}
export function dashSpec(floor: number, phase: 1 | 2): DashSpec {
  const d = depth(floor);
  return { dashes: 2 + (phase === 2 ? 1 : 0), warnMs: Math.max(BLITZ_MIN_WARN, 1000 - Math.round(d * 100)), speed: 900, width: 60 };
}
/** Hasta dónde llega la embestida: de `from` hacia `to` y sigue hasta la pared (con `margin` = medio cuerpo). */
export function dashEnd(from: Pt, to: Pt, b: Bounds, margin: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const far = 4000;
  return clampDash(from.x, from.y, from.x + (dx / l) * far, from.y + (dy / l) * far, b, margin);
}
/** ¿El punto está en la franja de la embestida (segmento con ancho)? */
export function dashHits(a: Pt, c: Pt, width: number, x: number, y: number): boolean {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)) <= width / 2;
}
