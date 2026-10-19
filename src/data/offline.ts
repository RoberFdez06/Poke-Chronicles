// Jugar sin conexión (T42): dónde está cada respuesta de PokeAPI en el paquete de public/data/offline/ (lo genera
// scripts/buildOffline.ts) y un Pokémon "sustituto" hecho con species-index.json cuando no hay nada mejor.
// Lógica pura, con tests.
import type { SpeciesFact } from './gacha.ts';

/** Segundos que se espera a PokeAPI antes de tirar de lo guardado. */
export const NETWORK_TIMEOUT_MS = 6000;

/** Recursos de PokeAPI que hay en el paquete (los mismos nombres que en la API). */
const BUNDLED = new Set(['pokemon', 'pokemon-species', 'evolution-chain', 'type', 'move', 'ability']);

/**
 * Ruta (relativa, como los demás recursos del juego) de la copia empaquetada de una URL de PokeAPI, o null si ese
 * tipo de recurso no se empaqueta. `https://pokeapi.co/api/v2/pokemon/4/` → `data/offline/pokemon/4.json`.
 */
export function offlinePath(url: string): string | null {
  const m = url.match(/\/api\/v2\/([a-z-]+)\/([a-z0-9-]+)\/?$/i);
  if (!m || !BUNDLED.has(m[1])) return null;
  return `data/offline/${m[1]}/${m[2].toLowerCase()}.json`;
}

/** Sprite genérico (una Poké Ball) para los sustitutos. */
export const PLACEHOLDER_SPRITE = 'data/offline/placeholder.png';

/**
 * Respuesta de `pokemon/{id}` inventada a partir del índice de especies: tipos de verdad, estadísticas repartidas
 * a partes iguales según su suma, sin habilidad y con el sprite genérico. Sirve para no colgarse nunca.
 */
export function substitutePokemon(id: number, index: readonly SpeciesFact[]): Record<string, unknown> {
  const fact = index.find((s) => s.id === id);
  const bst = fact?.bst ?? 300;
  const each = Math.max(10, Math.round(bst / 6));
  const STATS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  return {
    id,
    name: fact?.name ?? `pokemon-${id}`,
    types: (fact?.types?.length ? fact.types : ['normal']).map((t, k) => ({ slot: k + 1, type: { name: t } })),
    stats: STATS.map((name) => ({ base_stat: each, stat: { name } })),
    abilities: [],
    sprites: {
      front_default: PLACEHOLDER_SPRITE,
      back_default: PLACEHOLDER_SPRITE,
      front_shiny: PLACEHOLDER_SPRITE,
      back_shiny: PLACEHOLDER_SPRITE,
      other: { 'official-artwork': { front_default: PLACEHOLDER_SPRITE } },
    },
    cries: { latest: null, legacy: null },
    substitute: true,
  };
}

/** Espera una promesa como mucho `ms`; si tarda más, falla (para no quedarse esperando a una red lenta). */
export function withTimeout<T>(p: Promise<T>, ms: number, what = 'petición'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what}: más de ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
