// Evolución en partida: a partir de la cadena evolutiva de PokeAPI (`evolution-chain`), tu Pokémon evoluciona al
// llegar a ciertos pisos (o rondas, o jefes). Lógica pura, sin Phaser ni red, para poder testearla.
import { idFromUrl } from './moves.ts';
import type { GameMode } from './modes.ts';

/** Nodo de `evolution-chain/{id}` → `chain` (solo lo que usamos). */
export interface ChainLink {
  species: { name: string; url: string };
  evolves_to: ChainLink[];
}

/** Especies en las que puede evolucionar `id` (varias si la cadena se ramifica, como Eevee). Solo ids normales. */
export function nextEvolutionIds(chain: ChainLink, id: number): number[] {
  const find = (node: ChainLink): ChainLink | null => {
    if (idFromUrl(node.species.url) === id) return node;
    for (const n of node.evolves_to) {
      const hit = find(n);
      if (hit) return hit;
    }
    return null;
  };
  const node = find(chain);
  if (!node) return [];
  return node.evolves_to.map((n) => idFromUrl(n.species.url)).filter((n) => Number.isInteger(n) && n > 0 && n <= 1025);
}

/** Elige una de las evoluciones posibles (al azar si hay varias). */
export function pickEvolution(options: readonly number[], rng: () => number): number | null {
  return options.length > 0 ? options[Math.floor(rng() * options.length)] : null;
}

/**
 * Cuándo se evoluciona en cada modo: al empezar estos pisos (Normal, Infinito), rondas (Oleadas) o jefes (Rush).
 * Así un inicial llega a su última forma hacia el final de una partida Normal.
 */
export const EVOLVE_AT: Readonly<Record<GameMode, readonly number[]>> = {
  normal: [2, 4],
  endless: [2, 4],
  waves: [6, 12],
  bossrush: [3, 6],
};

export const shouldEvolve = (mode: GameMode, n: number): boolean => EVOLVE_AT[mode].includes(n);
