// Shinies (variocolor): probabilidades y lo que cambian. Lógica pura; los conseguidos se guardan en save.ts.

/** Probabilidad de shiny en cada tirada del gacha y en cada enemigo. Ajustables. */
export const SHINY_ODDS = { gacha: 1 / 64, enemy: 1 / 200 } as const;

export const rollShiny = (rng: () => number, odds: number): boolean => rng() < odds;

/** Un enemigo shiny es más duro y suelta más premio. */
export const SHINY_ENEMY = { hpMul: 1.5, extraCoins: 2 } as const;

/** Lista de ids shiny guardada: enteros positivos, sin repetir. */
export function parseShinies(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const d: unknown = JSON.parse(raw);
    if (!Array.isArray(d)) return [];
    return [...new Set(d.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0))];
  } catch {
    return [];
  }
}

/**
 * T84: cadena shiny. Derrotar o capturar seguidos enemigos de la misma especie sube la cadena; cada eslabón
 * multiplica la probabilidad de shiny de los enemigos hasta un tope. Ajustables.
 */
export const SHINY_CHAIN = { perLink: 0.5, maxMul: 8 } as const;

export interface ShinyChain {
  /** Especie de la cadena (0 si no hay). */
  speciesId: number;
  count: number;
}

export const newShinyChain = (): ShinyChain => ({ speciesId: 0, count: 0 });

/** Probabilidad de shiny de un enemigo con una cadena de `n`: sube con cada eslabón y se queda en el tope. */
export function chainOdds(n: number, base: number = SHINY_ODDS.enemy): number {
  const links = Math.max(0, Math.floor(n));
  return base * Math.min(SHINY_CHAIN.maxMul, 1 + links * SHINY_CHAIN.perLink);
}

/** Derrota o captura: misma especie suma un eslabón; otra especie empieza una cadena nueva de 1. */
export function chainHit(c: ShinyChain, speciesId: number): ShinyChain {
  if (speciesId <= 0) return c;
  return speciesId === c.speciesId ? { speciesId, count: c.count + 1 } : { speciesId, count: 1 };
}

/** Te quitan vida de golpe: la cadena se rompe. */
export const chainBreak = (): ShinyChain => newShinyChain();

/** El contador del HUD solo se ve con 2 o más. */
export const chainVisible = (c: ShinyChain): boolean => c.count >= 2;
