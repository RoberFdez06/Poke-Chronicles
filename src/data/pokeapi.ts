import type { MoveInfo } from './items';
import { isUsableMove, localName, pickMoveIds, typeMoveIds } from './moves';

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

/** Cachea una promesa por clave; si falla, se borra para poder reintentar. */
function cached<K, V>(map: Map<K, Promise<V>>, key: K, make: () => Promise<V>): Promise<V> {
  if (!map.has(key)) {
    map.set(
      key,
      make().catch((err) => {
        map.delete(key);
        throw err;
      }),
    );
  }
  return map.get(key)!;
}

const typeMovesCache = new Map<string, Promise<number[]>>();

/** Ids de los movimientos de un tipo (`/type/{tipo}`). */
export function fetchTypeMoveIds(type: string): Promise<number[]> {
  return cached(typeMovesCache, type, async () => typeMoveIds((await getJson(`${BASE}/type/${type}`)).moves));
}

const moveCache = new Map<number, Promise<MoveInfo>>();

/** Un movimiento con su nombre en español (potencia 0 si no tiene). */
export function fetchMoveInfo(id: number): Promise<MoveInfo> {
  return cached(moveCache, id, async () => {
    const m = await getJson(`${BASE}/move/${id}`);
    return { id: m.id, name: localName(m.names, m.name.replace(/-/g, ' ')), type: m.type.name, power: m.power ?? 0 };
  });
}

/**
 * Hasta `n` movimientos de ataque (con potencia) de los tipos dados, repartidos entre ellos y con
 * nombre en español. Pide pocos a la vez y descarta los que fallan.
 */
export async function fetchAttackMovesForTypes(
  types: readonly string[],
  n: number,
  rng: () => number = Math.random,
): Promise<MoveInfo[]> {
  const idsByType = await Promise.all(types.map((t) => fetchTypeMoveIds(t).catch(() => [] as number[])));
  // Se piden de más porque muchos movimientos de estado no tienen potencia
  const ids = pickMoveIds(idsByType, n * 3, rng);
  const out: MoveInfo[] = [];
  for (let i = 0; i < ids.length && out.length < n; i += 6) {
    const batch = await Promise.all(ids.slice(i, i + 6).map((id) => fetchMoveInfo(id).catch(() => null)));
    for (const m of batch) if (m && out.length < n && isUsableMove(m, types)) out.push(m);
  }
  return out;
}

let speciesCount: Promise<number> | null = null;

/** Número total de especies que ofrece PokeAPI. */
export function fetchSpeciesCount(): Promise<number> {
  speciesCount ??= getJson(`${BASE}/pokemon-species?limit=1`).then((r) => r.count as number);
  return speciesCount;
}
