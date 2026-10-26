// T88 — Cacería legendaria: un rastro de pistas (huellas, ruido, plumas) repartido por varios pisos de la run.
// Si se encuentran todas, se abre una sala con un legendario capturable de forma especial (más difícil y con fases).
// Lógica pura, sin Phaser: el efecto visual de las pistas y la sala van en la escena (TODO(supervisor)).
// El legendario sale con el mismo sorteo que los jefes (T64): de todos, con ×3 si comparte tipo con el bioma.
import { pickBossWeighted, type Biome } from '../level/biomes.ts';
import type { SpeciesFact } from './gacha.ts';

export type ClueKind = 'huella' | 'ruido' | 'pluma';

export const CLUE_NAMES: Record<ClueKind, string> = {
  huella: 'Huella gigante',
  ruido: 'Rugido lejano',
  pluma: 'Pluma brillante',
};

export const HUNT = {
  /** Probabilidad base de que una run tenga cacería. */
  baseChance: 0.25,
  /** Pistas que hay que seguir. */
  clues: 3,
  /** Primer piso en que puede aparecer una pista. */
  firstFloor: 2,
  /** Pisos como mucho entre una pista y la siguiente. */
  maxGap: 3,
  /** PS del legendario respecto a un jefe normal. */
  hpMul: 2.5,
} as const;

/** Biomas donde es más fácil que haya rastro (coherente con T64: el bioma solo sube un poco la probabilidad). */
export const BIOME_HUNT_BONUS: Record<string, number> = { torre: 0.1, volcan: 0.05, mar: 0.05 };

export function huntChance(biomeId: string): number {
  return Math.min(1, HUNT.baseChance + (BIOME_HUNT_BONUS[biomeId] ?? 0));
}

export interface LegendHunt {
  active: boolean;
  /** Pisos con pista, en orden. */
  floors: number[];
  kinds: ClueKind[];
  /** Pistas encontradas (en orden). */
  found: number;
  /** Se perdió el rastro (se saltó un piso con pista sin cogerla). */
  lost: boolean;
  legendId: number;
  /** Ya se peleó en la sala (capturado o no). */
  done: boolean;
}

export const noHunt = (): LegendHunt => ({ active: false, floors: [], kinds: [], found: 0, lost: false, legendId: 0, done: false });

const KINDS: readonly ClueKind[] = ['huella', 'ruido', 'pluma'];

/**
 * Sortea la cacería al empezar la run. `lastFloor` es el último piso donde puede ir la sala (después de la última pista).
 */
export function rollHunt(
  rng: () => number,
  biome: Biome,
  pool: readonly number[],
  index: readonly SpeciesFact[],
  lastFloor: number,
  seen: readonly number[] = [],
): LegendHunt {
  if (rng() >= huntChance(biome.id)) return noHunt();
  const floors: number[] = [];
  let f = HUNT.firstFloor + Math.floor(rng() * HUNT.maxGap);
  for (let i = 0; i < HUNT.clues; i++) {
    floors.push(f);
    f += 1 + Math.floor(rng() * HUNT.maxGap);
  }
  if (floors[floors.length - 1] >= lastFloor) return noHunt();
  const kinds = floors.map((_, i) => KINDS[(i + Math.floor(rng() * KINDS.length)) % KINDS.length]);
  const legendId = pickBossWeighted(pool, rng, seen, biome, index);
  return { active: true, floors, kinds, found: 0, lost: false, legendId, done: false };
}

/** Piso de la siguiente pista pendiente, o null. */
export function nextClueFloor(h: LegendHunt): number | null {
  if (!h.active || h.lost || h.found >= h.floors.length) return null;
  return h.floors[h.found];
}

/** ¿Hay que colocar una pista en este piso? */
export const clueOnFloor = (h: LegendHunt, floor: number): boolean => nextClueFloor(h) === floor;

/** El jugador recoge la pista del piso. */
export function takeClue(h: LegendHunt, floor: number): LegendHunt {
  if (!clueOnFloor(h, floor)) return h;
  return { ...h, found: h.found + 1 };
}

/** Al salir de un piso: si tenía pista y no se cogió, el rastro se pierde. */
export function leaveFloor(h: LegendHunt, floor: number): LegendHunt {
  if (clueOnFloor(h, floor)) return { ...h, lost: true };
  return h;
}

export const huntComplete = (h: LegendHunt): boolean => h.active && !h.lost && h.found >= h.floors.length;

/** ¿Se abre la sala del legendario en este piso? (el piso siguiente a la última pista, o cualquiera después). */
export function lairOnFloor(h: LegendHunt, floor: number): boolean {
  return huntComplete(h) && !h.done && floor > h.floors[h.floors.length - 1];
}

export const finishLair = (h: LegendHunt): LegendHunt => ({ ...h, done: true });

/** Texto del HUD con el progreso del rastro. */
export function huntText(h: LegendHunt): string {
  if (!h.active) return '';
  if (h.lost) return 'Has perdido el rastro';
  if (huntComplete(h)) return h.done ? '' : '¡El rastro lleva a una sala oculta!';
  return `Rastro legendario ${h.found}/${h.floors.length}`;
}

// --- Combate especial por fases ---

/** Fase según la vida: 0 (>66 %), 1 (>33 %), 2 (resto). */
export function legendPhase(hp: number, maxHp: number): 0 | 1 | 2 {
  const r = maxHp > 0 ? hp / maxHp : 0;
  return r > 2 / 3 ? 0 : r > 1 / 3 ? 1 : 2;
}

/** Solo se puede lanzar la Ball en la última fase y con 15 % o menos (más difícil que el 25 % normal de T65). */
export const LEGEND_CAPTURE_RATIO = 0.15;

export function canCaptureLegend(hp: number, maxHp: number): boolean {
  return hp > 0 && legendPhase(hp, maxHp) === 2 && hp / maxHp <= LEGEND_CAPTURE_RATIO;
}

/** Probabilidad de captura: entre 10 % y 50 %, sube cuanto menos PS le quede. */
export function legendCaptureChance(hp: number, maxHp: number): number {
  if (!canCaptureLegend(hp, maxHp)) return 0;
  const r = hp / maxHp / LEGEND_CAPTURE_RATIO; // 0..1
  return 0.5 - 0.4 * r;
}

// TODO(supervisor): en GameScene, dibujar la pista (color liso), llamar a takeClue/leaveFloor al cambiar de piso,
// generar la sala con lairOnFloor y el combate con legendPhase/canCaptureLegend. El estado no se guarda en RunSave
// (si se reanuda la partida, el rastro se pierde).
