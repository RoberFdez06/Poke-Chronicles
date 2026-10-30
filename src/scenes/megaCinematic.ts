// Cinemática de la megaevolución del jugador: tiempos, fases y estado de cámara (lógica pura, sin Phaser).
// GameScene la conduce fotograma a fotograma con megaCineFrame() y la pinta con megaCinematicFx (ui/art/megaFx.ts).
// Lenguaje visual de los cambios de fase de los jefes: mundo congelado, zoom hacia el Pokémon, temblor creciente,
// destello blanco con la silueta que cambia de forma, onda expansiva y vuelta de la cámara a su sitio.

export type MegaCinePhase = 'zoom' | 'charge' | 'morph' | 'burst' | 'release' | 'done';

export interface MegaCinePlan {
  /** Duración total (ms). */
  total: number;
  /** Fin de cada fase (ms desde el inicio), en orden. */
  ends: Record<Exclude<MegaCinePhase, 'done'>, number>;
  /** Momento del cambio de sprite (base → mega), en mitad del destello. */
  swapAt: number;
  /** Zoom extra máximo sobre el de la sala (1 = nada). */
  zoomPeak: number;
  /** Intensidad máxima del temblor (fracción de la vista, como camera.shake). */
  shakePeak: number;
}

/** Plan completo (~2,1 s) y reducido para efectos bajos (~0,9 s, sin zoom fuerte ni temblor largo). */
export function megaCinePlan(low: boolean): MegaCinePlan {
  if (low) {
    return { total: 900, ends: { zoom: 150, charge: 450, morph: 650, burst: 750, release: 900 }, swapAt: 550, zoomPeak: 1.08, shakePeak: 0.004 };
  }
  return { total: 2100, ends: { zoom: 350, charge: 1150, morph: 1550, burst: 1750, release: 2100 }, swapAt: 1350, zoomPeak: 1.45, shakePeak: 0.014 };
}

export interface MegaCineFrame {
  phase: MegaCinePhase;
  /** Avance dentro de la fase actual (0-1). */
  k: number;
  /** Avance total (0-1). */
  total: number;
  /** Multiplicador de zoom sobre el de la sala. */
  zoom: number;
  /** Temblor de cámara de este instante (0 = quieto). */
  shake: number;
  /** Blanco sobre el sprite (0-1): silueta de luz. */
  white: number;
  /** Mezcla base → mega (0 = base, 1 = mega). */
  morph: number;
  /** Escala pulsante del sprite (1 = normal). */
  pulse: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);

/** Fase en la que cae el instante `ms`. */
export function megaCinePhaseAt(plan: MegaCinePlan, ms: number): MegaCinePhase {
  const order: Exclude<MegaCinePhase, 'done'>[] = ['zoom', 'charge', 'morph', 'burst', 'release'];
  for (const p of order) if (ms < plan.ends[p]) return p;
  return 'done';
}

/** Estado de la cinemática en el instante `ms` (se recorta a [0, total]). */
export function megaCineFrame(plan: MegaCinePlan, ms: number): MegaCineFrame {
  const t = Math.max(0, ms);
  const phase = megaCinePhaseAt(plan, t);
  const e = plan.ends;
  const start: Record<MegaCinePhase, number> = { zoom: 0, charge: e.zoom, morph: e.charge, burst: e.morph, release: e.burst, done: plan.total };
  const end = phase === 'done' ? plan.total : e[phase];
  const k = phase === 'done' ? 1 : clamp01((t - start[phase]) / Math.max(1, end - start[phase]));
  const extra = plan.zoomPeak - 1;
  let zoom = 1;
  let shake = 0;
  let white = 0;
  let pulse = 1;
  switch (phase) {
    case 'zoom':
      zoom = 1 + extra * easeInOut(k) * 0.8;
      shake = plan.shakePeak * 0.1 * k;
      break;
    case 'charge':
      zoom = 1 + extra * (0.8 + 0.2 * k);
      shake = plan.shakePeak * (0.1 + 0.6 * k * k); // temblor creciente
      white = 0.6 * k * k;
      pulse = 1 + 0.06 * Math.sin(k * Math.PI * 6) * k;
      break;
    case 'morph':
      zoom = plan.zoomPeak;
      shake = plan.shakePeak * 0.8;
      white = 1;
      pulse = 1 + 0.14 * Math.abs(Math.sin(k * Math.PI * 3));
      break;
    case 'burst':
      zoom = plan.zoomPeak - extra * 0.25 * k;
      shake = plan.shakePeak; // último sacudón
      white = 1 - k;
      pulse = 1 + 0.18 * (1 - k);
      break;
    case 'release':
      zoom = 1 + extra * 0.75 * (1 - easeInOut(k));
      shake = plan.shakePeak * 0.25 * (1 - k);
      break;
    case 'done':
      break;
  }
  const morph = clamp01((t - (plan.swapAt - 150)) / 300);
  return { phase, k, total: clamp01(t / plan.total), zoom, shake, white, morph, pulse };
}

/** Lo que hay que dejar como estaba al acabar (o al cortarse) la cinemática. */
export interface MegaCamHome {
  zoom: number;
  scrollX: number;
  scrollY: number;
  /** Sala grande: la cámara sigue al jugador con límites (se vuelven a poner con setRoomCamera). */
  follows: boolean;
}

export interface MegaCamRestore {
  zoom: number;
  /** null = la cámara la recoloca setRoomCamera (sala grande), no se toca el scroll. */
  scroll: { x: number; y: number } | null;
  resetShake: true;
  thaw: boolean;
}

/**
 * Cómo restaurar: zoom de la sala (nunca el de la cinemática), scroll fijo en salas normales, deshelar el mundo solo
 * si lo heló la cinemática (si ya estaba helado por otra intro, esa lo suelta) y si no se ha cambiado de sala.
 */
export function megaCamRestore(home: MegaCamHome, opts: { frozeWorld: boolean; roomChanged: boolean; ended: boolean }): MegaCamRestore {
  return {
    zoom: home.zoom,
    scroll: home.follows || opts.roomChanged ? null : { x: home.scrollX, y: home.scrollY },
    resetShake: true,
    thaw: opts.frozeWorld && !opts.ended,
  };
}

export type MegaFxStyle = 'embers' | 'drops' | 'sparks' | 'crystals' | 'leaves' | 'smoke' | 'scales' | 'rocks' | 'stars';

/** Partículas de la carga según el tipo (las de cada tipo caen, suben o zigzaguean distinto). */
export function megaTypeStyle(type: string): MegaFxStyle {
  switch (type) {
    case 'fire': return 'embers';
    case 'water': return 'drops';
    case 'electric': return 'sparks';
    case 'ice': return 'crystals';
    case 'grass': case 'bug': return 'leaves';
    case 'ghost': case 'dark': case 'poison': return 'smoke';
    case 'dragon': return 'scales';
    case 'rock': case 'ground': case 'steel': return 'rocks';
    default: return 'stars';
  }
}
