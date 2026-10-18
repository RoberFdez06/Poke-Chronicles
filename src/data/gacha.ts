// Rarezas y gacha: lógica pura, sin Phaser ni red, para poder testearla.
// Los datos de cada especie salen de PokeAPI (ver scripts/buildSpeciesIndex.mjs).

// De menos a más valiosa: los legendarios y singulares son lo más difícil de conseguir.
export const RARITIES = ['common', 'rare', 'epic', 'ultra', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  ultra: 'Ultraente',
  legendary: 'Legendario',
};

/** Lo que necesitamos saber de cada especie para clasificarla. */
export interface SpeciesFact {
  id: number;
  name: string;
  /** Nombre en español (lo añade scripts/buildSpeciesIndex.mjs; las listas antiguas no lo tienen). */
  nameEs?: string;
  /** Suma de estadísticas base. */
  bst: number;
  legendary: boolean;
  mythical: boolean;
}

/**
 * PokeAPI no marca a los Ultraentes, así que esta es la única lista fija:
 * Nihilego, Buzzwole, Pheromosa, Xurkitree, Celesteela, Kartana, Guzzlord,
 * Poipole, Naganadel, Stakataka y Blacephalon.
 */
export const ULTRA_BEAST_IDS: ReadonlySet<number> = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

/** Umbrales de estadísticas base para raro y épico. Ajustables. */
export const BST_RARE = 400;
export const BST_EPIC = 500;

export function classifyRarity(s: SpeciesFact): Rarity {
  if (ULTRA_BEAST_IDS.has(s.id)) return 'ultra';
  if (s.legendary || s.mythical) return 'legendary';
  if (s.bst >= BST_EPIC) return 'epic';
  if (s.bst >= BST_RARE) return 'rare';
  return 'common';
}

/** Probabilidad (en %) de cada rareza en una tirada. Ajustable. */
export const GACHA_RATES: Readonly<Record<Rarity, number>> = {
  common: 60,
  rare: 25,
  epic: 10,
  ultra: 4,
  legendary: 1,
};

/** Monedas por tirada. Ajustable cuando sepamos cuánto se gana por partida. */
export const PULL_COST = 100;

export type RarityPools = Record<Rarity, number[]>;

export function buildPools(index: readonly SpeciesFact[]): RarityPools {
  const pools: RarityPools = { common: [], rare: [], epic: [], ultra: [], legendary: [] };
  for (const s of index) pools[classifyRarity(s)].push(s.id);
  return pools;
}

export function rollRarity(rng: () => number, rates: Readonly<Record<Rarity, number>> = GACHA_RATES): Rarity {
  const total = RARITIES.reduce((n, r) => n + rates[r], 0);
  if (!(total > 0)) throw new Error('Las probabilidades del gacha suman 0');

  let x = rng() * total;
  let last: Rarity = RARITIES[0];
  for (const r of RARITIES) {
    if (rates[r] <= 0) continue;
    last = r;
    x -= rates[r];
    if (x < 0) return r;
  }
  return last;
}

export interface PullResult {
  /** Rareza que ha salido (puede diferir de la tirada si esa rareza no tiene Pokémon). */
  rarity: Rarity;
  speciesId: number;
  /** Ya lo tenías: más adelante decidimos si devuelve monedas. */
  duplicate: boolean;
}

export function pull(
  rng: () => number,
  pools: RarityPools,
  owned: ReadonlySet<number> = new Set(),
  rates: Readonly<Record<Rarity, number>> = GACHA_RATES,
): PullResult {
  const rolled = RARITIES.indexOf(rollRarity(rng, rates));

  // Si la rareza tirada está vacía, usa la más cercana que tenga Pokémon (a igual distancia, la menos valiosa)
  for (let d = 0; d < RARITIES.length; d++) {
    for (const i of [rolled - d, rolled + d]) {
      const rarity = RARITIES[i];
      if (rarity === undefined || pools[rarity].length === 0) continue;
      const pool = pools[rarity];
      const speciesId = pool[Math.floor(rng() * pool.length)];
      return { rarity, speciesId, duplicate: owned.has(speciesId) };
    }
  }
  throw new Error('El gacha no tiene ningún Pokémon');
}
