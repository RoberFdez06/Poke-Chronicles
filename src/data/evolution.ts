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
  // Torre: tras los primeros jefes (pisos 11 y 31)
  tower: [11, 31],
};

/**
 * Para los que solo evolucionan una vez (líneas de dos formas, como Pikachu-Raichu): una sola evolución a mitad de
 * partida, en el piso 3 (pedido por Roberto el 20/10).
 */
export const EVOLVE_AT_SINGLE: Readonly<Record<GameMode, readonly number[]>> = {
  normal: [3],
  endless: [3],
  waves: [9],
  bossrush: [4],
  tower: [21],
};

/** Cuántas evoluciones le quedan a `id` en su cadena como mucho (0 si es la última forma o no está). */
export function evolutionsLeft(chain: ChainLink, id: number): number {
  const depth = (node: ChainLink): number => (node.evolves_to.length ? 1 + Math.max(...node.evolves_to.map(depth)) : 0);
  const find = (node: ChainLink): ChainLink | null => {
    if (idFromUrl(node.species.url) === id) return node;
    for (const n of node.evolves_to) {
      const hit = find(n);
      if (hit) return hit;
    }
    return null;
  };
  const node = find(chain);
  return node ? depth(node) : 0;
}

/** Pisos (o rondas, o jefes) en los que evoluciona un Pokémon al que, al empezar, le quedan `left` evoluciones. */
export function evolveFloors(mode: GameMode, left: number): readonly number[] {
  if (left <= 0) return [];
  return left === 1 ? EVOLVE_AT_SINGLE[mode] : EVOLVE_AT[mode];
}

/** Si en este piso puede tocar evolucionar (luego `evolveFloors` decide según la cadena del Pokémon). */
export const shouldEvolve = (mode: GameMode, n: number): boolean => EVOLVE_AT[mode].includes(n) || EVOLVE_AT_SINGLE[mode].includes(n);
