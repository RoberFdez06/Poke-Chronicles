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
