// T69: laguna de pesca. Un evento de sala: lanzas la caña, esperas a que pique y pulsas dentro de una ventana corta.
// Lógica pura, sin Phaser: espera hasta que pica, ventana para pulsar, tope de lanzamientos y tabla de premios.
// Magikarp y Gyarados reutilizan los objetos pasivos del easter egg del mercader (easterEggs.ts).
import { GYARADOS, MAGIKARP } from '../data/easterEggs.ts';

/** Lanzamientos por sala: así la laguna no se vuelve una granja infinita de monedas. */
export const FISH_MAX_CASTS = 3;
/** Espera hasta que pica, en ms (entre el mínimo y el máximo): lo bastante corta para no aburrir. */
export const FISH_BITE_MIN_MS = 1200;
export const FISH_BITE_MAX_MS = 3200;
/** Ventana para pulsar cuando pica. Dificultad suave: casi un segundo, que da tiempo con mando o ratón. */
export const FISH_WINDOW_MS = 900;

/** Cuánto tarda en picar; `x` en [0, 1). */
export const fishBiteDelay = (x: number): number =>
  Math.round(FISH_BITE_MIN_MS + Math.min(0.999999, Math.max(0, x)) * (FISH_BITE_MAX_MS - FISH_BITE_MIN_MS));

export type HookResult = 'early' | 'hooked' | 'late';

/**
 * Resultado de pulsar en `pressAt` si pica en `biteAt` (mismo reloj, en ms). Antes de que pique: «early» (el pez se
 * asusta); dentro de la ventana: «hooked»; después: «late». Los dos fallos gastan el lanzamiento.
 */
export function hookResult(biteAt: number, pressAt: number): HookResult {
  if (pressAt < biteAt) return 'early';
  return pressAt - biteAt <= FISH_WINDOW_MS ? 'hooked' : 'late';
}

/** Se puede lanzar si quedan lanzamientos en esta sala. */
export const canCast = (castsDone: number): boolean => castsDone < FISH_MAX_CASTS;

export type FishPrize = 'coins' | 'berry' | 'item' | 'rareFoe' | 'magikarp' | 'gyarados';

/** Probabilidades de la tabla (el resto, monedas). Magikarp muy raro y Gyarados aún más. */
export const FISH_CHANCE = { gyarados: 0.004, magikarp: 0.02, rareFoe: 0.12, item: 0.12, berry: 0.26 } as const;

export const FISH_PRIZE_LABEL: Record<FishPrize, string> = {
  coins: 'Monedas',
  berry: 'Una baya',
  item: 'Un objeto',
  rareFoe: '¡Un Pokémon acuático raro!',
  magikarp: '¡Un Magikarp!',
  gyarados: '¡¡Un Gyarados!!',
};

/**
 * Premio de una captura con la tirada `x` en [0, 1). Magikarp y Gyarados solo si no llevas ya ninguno de los dos (como
 * en el mercader); si no, se quedan en monedas.
 */
export function fishPrize(x: number, owned: readonly string[] = []): FishPrize {
  const r = Math.min(0.999999, Math.max(0, x));
  const hasKarp = owned.includes(MAGIKARP) || owned.includes(GYARADOS);
  let acc = 0;
  for (const k of ['gyarados', 'magikarp', 'rareFoe', 'item', 'berry'] as const) {
    acc += FISH_CHANCE[k];
    if (r < acc) return (k === 'gyarados' || k === 'magikarp') && hasKarp ? 'coins' : k;
  }
  return 'coins';
}

/** Monedas del premio de monedas (algo más con el piso). */
export const fishCoins = (floorNum: number): number => 3 + Math.min(6, Math.floor(Math.max(1, floorNum) / 2));
/** Monedas extra al vencer al Pokémon acuático raro (además del objeto). */
export const fishRareCoins = (floorNum: number): number => 8 + 2 * Math.max(1, Math.floor(floorNum));
/** Vida del Pokémon raro respecto a uno normal. */
export const FISH_RARE_HP_MUL = 2;

/** Biomas con agua: ahí la laguna sale a menudo; en el resto, poco. */
export const isWaterBiome = (types: readonly string[]): boolean => types.includes('water');
export const fishingWeight = (biomeTypes: readonly string[] = []): number => (isWaterBiome(biomeTypes) ? 1.4 : 0.2);
