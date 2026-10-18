import type { MoveInfo } from './items';

export interface MoveData {
  name: string;
  type: string;
  power: number;
}

export interface PokemonData {
  id: number;
  name: string;
  /** Tipos del Pokémon, en el orden de PokeAPI. */
  types: string[];
  artwork: string;
  /** Sprites pixel de PokeAPI: de frente y de espalda (si no hay, se repite el de frente). */
  sprites: { front: string; back: string };
  moves: MoveData[];
}

const BASE = 'https://pokeapi.co/api/v2';
const cache = new Map<number, Promise<PokemonData>>();

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PokeAPI ${res.status}: ${url}`);
  return res.json();
}

/** Respuesta de /pokemon/{id} en bruto, compartida entre fetchPokemon y fetchPokemonCard. */
const rawCache = new Map<number, Promise<any>>();

function getPokemonRaw(id: number): Promise<any> {
  if (!rawCache.has(id)) {
    rawCache.set(
      id,
      getJson(`${BASE}/pokemon/${id}`).catch((err) => {
        rawCache.delete(id); // no guardamos fallos: se podrá reintentar
        throw err;
      }),
    );
  }
  return rawCache.get(id)!;
}

const typesOf = (p: any): string[] => (p.types as { type: { name: string } }[]).map((t) => t.type.name);

/** Sprites pixel de frente y de espalda; si no hay de espalda se repite el de frente. */
function spritesOf(p: any): { front: string; back: string } {
  const front: string = p.sprites.front_default ?? p.sprites.other['official-artwork'].front_default;
  return { front, back: p.sprites.back_default ?? front };
}

/** Lo justo para dibujar a un Pokémon en un menú: una sola petición, sin movimientos. */
export interface PokemonCard {
  id: number;
  name: string;
  types: string[];
  sprites: { front: string; back: string };
}

export async function fetchPokemonCard(id: number): Promise<PokemonCard> {
  const p = await getPokemonRaw(id);
  return { id, name: p.name, types: typesOf(p), sprites: spritesOf(p) };
}

export function fetchPokemon(id: number): Promise<PokemonData> {
  if (!cache.has(id)) cache.set(id, load(id));
  return cache.get(id)!;
}

async function load(id: number): Promise<PokemonData> {
  const p = await getPokemonRaw(id);
  const urls: string[] = p.moves.slice(0, 14).map((m: any) => m.move.url);
  const details = await Promise.all(urls.map(getJson));

  const toMove = (m: any): MoveData => ({ name: m.name, type: m.type.name, power: m.power });
  const moves: MoveData[] = details.filter((m) => m.power).slice(0, 4).map(toMove);
  if (moves.length < 4) {
    // Relleno con Placaje, también desde PokeAPI
    const filler = toMove(await getJson(`${BASE}/move/tackle`));
    while (moves.length < 4) moves.push(filler);
  }

  return {
    id,
    name: p.name,
    types: typesOf(p),
    artwork: p.sprites.other['official-artwork'].front_default ?? p.sprites.front_default,
    sprites: spritesOf(p),
    moves,
  };
}

let moveUrls: Promise<string[]> | null = null;

const idFromUrl = (url: string) => Number(url.replace(/\/$/, '').split('/').pop());

/** URLs de todos los movimientos normales (los ids de 10000 en adelante son especiales). */
function allMoveUrls(): Promise<string[]> {
  moveUrls ??= getJson(`${BASE}/move?limit=2000`).then((r) =>
    (r.results as { url: string }[]).map((m) => m.url).filter((u) => idFromUrl(u) < 10000),
  );
  return moveUrls;
}

/** Un movimiento de ataque al azar (con potencia). Devuelve null si no encuentra ninguno. */
export async function fetchRandomAttackMove(rng: () => number = Math.random, tries = 12): Promise<MoveInfo | null> {
  const urls = await allMoveUrls();
  for (let i = 0; i < tries; i++) {
    const m = await getJson(urls[Math.floor(rng() * urls.length)]);
    if (m.power) return { id: m.id, name: m.name, type: m.type.name, power: m.power };
  }
  return null;
}

let speciesCount: Promise<number> | null = null;

/** Número total de especies que ofrece PokeAPI. */
export function fetchSpeciesCount(): Promise<number> {
  speciesCount ??= getJson(`${BASE}/pokemon-species?limit=1`).then((r) => r.count as number);
  return speciesCount;
}
