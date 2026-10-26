// Rutas del piso (T80): al acabar un piso de Normal o Infinito eliges el siguiente entre 2 o 3 rutas, cada una con
// su bioma, su dificultad y su premio. Lógica pura, sin Phaser, para poder testearla.
// Con extensión .ts para que los tests (node --test) puedan importarlo sin bundler
import { mulberry32 } from './floorGen.ts';
import { BIOMES, biomeById, biomeFor } from './biomes.ts';
import type { GameMode } from '../data/modes.ts';
import type { RoomEventKind } from './roomEvents.ts';

export const ROUTE_REWARDS = ['shop', 'rest', 'event', 'loot'] as const;
export type RouteReward = (typeof ROUTE_REWARDS)[number];

export const ROUTE_REWARD_LABEL: Record<RouteReward, string> = {
  shop: 'Tienda extra',
  rest: 'Descanso con fuente',
  event: 'Evento con decisiones',
  loot: 'Mejor botín',
};

export const ROUTE_REWARD_DESC: Record<RouteReward, string> = {
  shop: 'Un mercader ambulante te espera en el piso.',
  rest: 'Hay una fuente para recuperar fuerzas.',
  event: 'Una historia con elecciones en el camino.',
  loot: 'Un objeto más te espera al llegar.',
};

/**
 * Premios que son una sala sorpresa forzada (ver roomEvents.ts). El botín no: es un objeto más en la sala de inicio.
 */
export const ROUTE_EVENT: Partial<Record<RouteReward, RoomEventKind>> = { shop: 'merchant', rest: 'fountain', event: 'story' };

/** Subidas de dificultad posibles de las rutas no tranquilas (en %). */
export const ROUTE_HARD_PCT = [20, 35] as const;

export interface RouteOption {
  biomeId: string;
  /** Dificultad extra en % (0 = ruta tranquila): sube la vida y el daño de los enemigos. */
  diffPct: number;
  reward: RouteReward;
}

/** Hay rutas para llegar al piso `nextFloor` (no en Torre, Oleadas ni Rush; ni antes del reto final de Normal). */
export function hasRoutes(mode: GameMode, nextFloor: number, finalFloor: (n: number) => boolean): boolean {
  return (mode === 'normal' || mode === 'endless') && nextFloor >= 2 && !finalFloor(nextFloor);
}

/**
 * Rutas ofrecidas para llegar al piso `floor`. Deterministas por `seed` (en el desafío diario, la semilla del día:
 * las mismas para todos). Siempre hay una ruta tranquila (la primera, con el bioma de siempre y sin dificultad
 * extra); los premios no se repiten y los biomas de las otras rutas son distintos entre sí.
 */
export function routeOptions(floor: number, seed: number, mode: GameMode = 'normal'): RouteOption[] {
  const rng = mulberry32((Math.floor(seed) ^ Math.imul(Math.floor(floor) + 1, 0x27d4eb2d)) >>> 0);
  const count = rng() < 0.5 ? 2 : 3;
  const rewards = [...ROUTE_REWARDS];
  for (let i = rewards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rewards[i], rewards[j]] = [rewards[j], rewards[i]];
  }
  const calmBiome = biomeFor(mode, floor).id;
  const others = BIOMES.map((b) => b.id).filter((id) => id !== calmBiome);
  const out: RouteOption[] = [{ biomeId: calmBiome, diffPct: 0, reward: rewards[0] }];
  for (let k = 1; k < count; k++) {
    const b = others.splice(Math.floor(rng() * others.length), 1)[0] ?? calmBiome;
    out.push({ biomeId: b, diffPct: ROUTE_HARD_PCT[k - 1], reward: rewards[k] });
  }
  return out;
}

/** Multiplicador de vida y daño de los enemigos de la ruta. */
export const routeMul = (r: RouteOption | null | undefined): number => 1 + Math.max(0, r?.diffPct ?? 0) / 100;

/** Texto de la carta / del resumen: «Cueva · +20 % · Tienda extra». */
export function routeLabel(r: RouteOption): string {
  return `${biomeById(r.biomeId).name} · ${r.diffPct > 0 ? `+${r.diffPct} %` : 'Tranquila'} · ${ROUTE_REWARD_LABEL[r.reward]}`;
}

export function isRouteOption(r: unknown): r is RouteOption {
  const o = r as RouteOption;
  return !!o && typeof o.biomeId === 'string' && BIOMES.some((b) => b.id === o.biomeId) &&
    Number.isInteger(o.diffPct) && o.diffPct >= 0 && o.diffPct <= 100 && (ROUTE_REWARDS as readonly string[]).includes(o.reward);
}

/**
 * Azar para forzar la sala sorpresa del premio con `pickRoomEvent`: la primera tirada (¿hay evento?) sale 0 y el
 * resto vienen de `rng`.
 */
export function forcedEventRng(rng: () => number): () => number {
  let first = true;
  return () => {
    if (first) {
      first = false;
      return 0;
    }
    return rng();
  };
}
