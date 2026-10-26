import type { MoveInfo } from './items';
import { isUsableMove, localName, pickMoveIds, typeMoveIds } from './moves';
import { loadSpeciesIndex } from './speciesIndex';
import { parseApiStats, type BaseStats } from './pokeStats';
import { evolutionsLeft, nextEvolutionIds, type ChainLink } from './evolution';
import { ABILITY_EFFECTS, pickAbility } from './abilities';
import { NETWORK_TIMEOUT_MS, offlinePath, substitutePokemon, withTimeout } from './offline';

const BASE = 'https://pokeapi.co/api/v2';

// --- Sin conexión (T42) ---
let offlineUsed = false;
const offlineListeners = new Set<() => void>();

/** Se ha tenido que tirar de datos guardados (PokeAPI no respondía). */
export const usingOfflineData = (): boolean => offlineUsed;

/** Aviso la primera vez que se usan datos guardados (devuelve cómo quitar el aviso). */
export function onOfflineData(cb: () => void): () => void {
  offlineListeners.add(cb);
  return () => offlineListeners.delete(cb);
}

function markOffline() {
  if (offlineUsed) return;
  offlineUsed = true;
  console.warn('[PokeIsaac] PokeAPI no responde: usando datos guardados');
  offlineListeners.forEach((cb) => cb());
}

let manifest: Promise<Set<number>> | null = null;

/** Pokémon que hay en el paquete sin conexión (public/data/offline/manifest.json). */
export function offlinePokemonIds(): Promise<Set<number>> {
  manifest ??= fetch('data/offline/manifest.json')
    .then((r) => (r.ok ? r.json() : { pokemon: [] }))
    .then((m: { pokemon?: number[] }) => new Set(m.pokemon ?? []))
    .catch(() => new Set<number>());
  return manifest;
}

/**
 * JSON de PokeAPI. Si tarda más de 6 s o falla, usa la copia de public/data/offline/ (mismo formato) si la hay.
 * Lo ya descargado lo sirve al instante el service worker (public/sw.js), también sin conexión.
 */
async function getJson(url: string) {
  try {
    const res = await withTimeout(fetch(url), NETWORK_TIMEOUT_MS, 'PokeAPI');
    if (!res.ok) throw new Error(`PokeAPI ${res.status}: ${url}`);
    return await res.json();
  } catch (err) {
    const path = offlinePath(url);
    if (path) {
      const local = await fetch(path).catch(() => null);
      if (local?.ok) {
        markOffline();
        return local.json();
      }
    }
    throw err;
  }
}

/** Respuesta de /pokemon/{id} en bruto, compartida entre fetchPokemon y fetchPokemonCard. */
const rawCache = new Map<number, Promise<any>>();

function getPokemonRaw(id: number): Promise<any> {
  if (!rawCache.has(id)) {
    rawCache.set(
      id,
      getJson(`${BASE}/pokemon/${id}`).catch(async (err) => {
        rawCache.delete(id); // no guardamos fallos (ni sustitutos): se podrá reintentar
        // Ni PokeAPI ni el paquete: un sustituto con el índice de especies para no colgarse nunca
        const index = await loadSpeciesIndex().catch(() => []);
        if (!index.some((sp) => sp.id === id)) throw err;
        markOffline();
        return substitutePokemon(id, index);
      }),
    );
  }
  return rawCache.get(id)!;
}

const typesOf = (p: any): string[] => (p.types as { type: { name: string } }[]).map((t) => t.type.name);

/** Sprites pixel de frente y de espalda, normales y shiny; lo que falte se cubre con lo que haya. */
function spritesOf(p: any): PokemonSprites {
  const front: string = p.sprites.front_default ?? p.sprites.other['official-artwork'].front_default;
  const back: string = p.sprites.back_default ?? front;
  const shinyFront: string = p.sprites.front_shiny ?? front;
  return { front, back, shinyFront, shinyBack: p.sprites.back_shiny ?? shinyFront };
}

export interface PokemonSprites {
  front: string;
  back: string;
  shinyFront: string;
  shinyBack: string;
}

/** Los sprites de frente y espalda que tocan (shiny o no). */
export const pickSprites = (s: PokemonSprites, shiny: boolean) =>
  shiny ? { front: s.shinyFront, back: s.shinyBack } : { front: s.front, back: s.back };

/** Lo que usamos de cada Pokémon: una petición (más el nombre en español, que suele venir del índice). */
export interface PokemonCard {
  id: number;
  name: string;
  /** Tipos del Pokémon, en el orden de PokeAPI. */
  types: string[];
  /** Sprites pixel de PokeAPI: de frente y de espalda (si no hay, se repite el de frente). */
  sprites: PokemonSprites;
  /** Estadísticas base (PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad). */
  stats: BaseStats;
}

export type PokemonData = PokemonCard;

export async function fetchPokemonCard(id: number): Promise<PokemonCard> {
  const [p, name] = await Promise.all([getPokemonRaw(id), fetchSpeciesName(id)]);
  return { id, name, types: typesOf(p), sprites: spritesOf(p), stats: parseApiStats(p.stats) };
}

const speciesNameCache = new Map<number, Promise<string>>();

/**
 * Nombre en español de la especie: de species-index.json si lo tiene (sin peticiones) y, si no,
 * de `pokemon-species/{id}`. Si todo falla, el nombre en inglés de PokeAPI.
 */
export function fetchSpeciesName(id: number): Promise<string> {
  return cached(speciesNameCache, id, async () => {
    const index = await loadSpeciesIndex().catch(() => []);
    const fromIndex = index.find((s) => s.id === id)?.nameEs;
    if (fromIndex) return fromIndex;
    try {
      const sp = await getJson(`${BASE}/pokemon-species/${id}`);
      return localName(sp.names, sp.name);
    } catch {
      return (await getPokemonRaw(id)).name as string;
    }
  });
}

const chainCache = new Map<number, Promise<number[]>>();

/** Especies en las que puede evolucionar `id` según su `evolution-chain` (vacío si no evoluciona). */
const leftCache = new Map<number, Promise<number>>();

/** Cuántas evoluciones le quedan a la especie `id` en su cadena (0 si no evoluciona). */
export function fetchEvolutionsLeft(id: number): Promise<number> {
  return cached(leftCache, id, async () => {
    const species = await getJson(`${BASE}/pokemon-species/${id}`);
    const url = species.evolution_chain?.url as string | undefined;
    if (!url) return 0;
    const chain = (await getJson(url)).chain as ChainLink;
    return evolutionsLeft(chain, id);
  });
}

export function fetchNextEvolutions(id: number): Promise<number[]> {
  return cached(chainCache, id, async () => {
    const species = await getJson(`${BASE}/pokemon-species/${id}`);
    const url = species.evolution_chain?.url as string | undefined;
    if (!url) return [];
    const chain = (await getJson(url)).chain as ChainLink;
    return nextEvolutionIds(chain, id);
  });
}

/** URL del grito del Pokémon (`cries.latest`, ogg) o null si no tiene. */
export async function fetchCryUrl(id: number): Promise<string | null> {
  const p = await getPokemonRaw(id);
  return (p.cries?.latest as string | undefined) ?? (p.cries?.legacy as string | undefined) ?? null;
}

/** Pokémon para jugar con él (mismos datos que la tarjeta: nombre en español, tipos, sprites y estadísticas). */
export const fetchPokemon = (id: number): Promise<PokemonData> => fetchPokemonCard(id);

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

const abilityCache = new Map<number, Promise<{ id: string; nameEs?: string } | null>>();

/**
 * Habilidad del Pokémon (T27): la primera no oculta de `pokemon/{id}`. El nombre en español solo se pide a
 * `ability/{nombre}` si no está en la tabla de abilities.ts. null si no tiene o falla.
 */
export function fetchAbility(id: number): Promise<{ id: string; nameEs?: string } | null> {
  return cached(abilityCache, id, async () => {
    const p = await getPokemonRaw(id);
    const list = ((p.abilities ?? []) as { ability: { name: string }; is_hidden: boolean; slot: number }[]).map((a) => ({
      name: a.ability.name,
      hidden: a.is_hidden,
      slot: a.slot,
    }));
    const name = pickAbility(list);
    if (!name) return null;
    if (ABILITY_EFFECTS[name]) return { id: name };
    try {
      const ab = await getJson(`${BASE}/ability/${name}`);
      return { id: name, nameEs: localName(ab.names, name) };
    } catch {
      return { id: name };
    }
  }).catch(() => null);
}

const formSpriteCache = new Map<string, Promise<PokemonSprites | null>>();

/**
 * T74: sprites de una forma alternativa por su nombre en PokeAPI (`charizard-mega-x`, `kyogre-primal`…; allí tienen
 * id desde 10000 y sprite propio). null si no hay red o la forma no trae sprite pixel: la escena deja el de siempre.
 */
export function fetchFormSprites(name: string): Promise<PokemonSprites | null> {
  if (!formSpriteCache.has(name)) {
    formSpriteCache.set(
      name,
      getJson(`${BASE}/pokemon/${name}`)
        .then((p: any) => (p?.sprites?.front_default ? spritesOf(p) : null))
        .catch(() => {
          formSpriteCache.delete(name); // se podrá reintentar en la próxima
          return null;
        }),
    );
  }
  return formSpriteCache.get(name)!;
}
