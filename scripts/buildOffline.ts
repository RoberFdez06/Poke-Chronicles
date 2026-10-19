// Genera public/data/offline/: lo imprescindible para jugar sin conexión (T42), con el MISMO formato que las
// respuestas de PokeAPI (recortadas) para que el juego las use tal cual si la red falla.
//   node scripts/buildOffline.ts        (necesita internet; tarda un par de minutos)
// Incluye: los iniciales de las 9 regiones y sus evoluciones, unos cuantos enemigos de cada bioma y piso, jefes
// de cada bioma, los enemigos de reserva, movimientos con potencia de los 18 tipos y sus sprites.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { REGIONS } from '../src/data/regions.ts';
import { BIOMES, biomeBossPool, biomeEnemyPool } from '../src/level/biomes.ts';
import { FALLBACK_ENEMIES } from '../src/data/enemies.ts';
import { ABILITY_EFFECTS } from '../src/data/abilities.ts';
import type { SpeciesFact } from '../src/data/gacha.ts';
import { makePlaceholder } from './makePlaceholder.ts';

const API = 'https://pokeapi.co/api/v2';
const OUT = 'public/data/offline';
/** Ruta pública de los sprites (relativa, como el resto de recursos del juego). */
const SPRITES = 'data/offline/sprites';
const ENEMIES_PER_POOL = 4;
const BOSSES_PER_BIOME = 3;
const MOVES_PER_TYPE = 14;
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

async function get(url: string, tries = 4): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= tries) throw new Error(`${url}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}
const getJson = async (url: string) => (await get(url)).json();
const es = (names: { name: string; language: { name: string } }[]) => names.filter((n) => n.language.name === 'es');

async function save(path: string, data: unknown) {
  const file = `${OUT}/${path}.json`;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, JSON.stringify(data));
}

/** Descarga un sprite; devuelve la ruta pública o null si no hay. */
async function sprite(url: string | null, name: string): Promise<string | null> {
  if (!url) return null;
  const res = await get(url);
  if (!res.ok) return null;
  await writeFile(`${OUT}/sprites/${name}.png`, Buffer.from(await res.arrayBuffer()));
  return `${SPRITES}/${name}.png`;
}

/** Varias tareas a la vez, sin pasarse. */
async function pool<T>(items: T[], n: number, job: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) await job(items[next++]);
  }));
}

await mkdir(`${OUT}/sprites`, { recursive: true });
await makePlaceholder(`${OUT}/placeholder.png`);
const index = JSON.parse(await readFile('public/data/species-index.json', 'utf8')) as SpeciesFact[];

// --- Qué Pokémon ---
const ids = new Set<number>(FALLBACK_ENEMIES);
for (const r of REGIONS) r.starters.forEach((id) => ids.add(id));
for (const b of BIOMES) {
  for (let floor = 1; floor <= 5; floor++) {
    biomeEnemyPool(index, floor, b).sort((a, c) => a - c).slice(0, ENEMIES_PER_POOL).forEach((id) => ids.add(id));
  }
  biomeBossPool(index, b).sort((a, c) => a - c).slice(0, BOSSES_PER_BIOME).forEach((id) => ids.add(id));
}

// Evoluciones de los iniciales (para evolucionar sin conexión): cadenas completas
const chains = new Map<string, unknown>();
const starters = REGIONS.flatMap((r) => [...r.starters]);
for (const id of starters) {
  const sp = await getJson(`${API}/pokemon-species/${id}`);
  const url: string = sp.evolution_chain.url;
  if (chains.has(url)) continue;
  const chain = await getJson(url);
  chains.set(url, chain);
  const walk = (node: { species: { url: string }; evolves_to: unknown[] }) => {
    ids.add(Number(node.species.url.split('/').filter(Boolean).pop()));
    (node.evolves_to as (typeof node)[]).forEach(walk);
  };
  walk(chain.chain);
}
for (const [url, chain] of chains) {
  const strip = (n: { species: { name: string; url: string }; evolves_to: unknown[] }): unknown => ({
    species: n.species,
    evolves_to: (n.evolves_to as (typeof n)[]).map(strip),
  });
  const id = url.split('/').filter(Boolean).pop();
  await save(`evolution-chain/${id}`, { id: Number(id), chain: strip((chain as { chain: Parameters<typeof strip>[0] }).chain) });
}

// --- Pokémon, especies, habilidades y sprites ---
const abilities = new Set<string>();
const done: number[] = [];
await pool([...ids].sort((a, b) => a - b), 6, async (id) => {
  const p = await getJson(`${API}/pokemon/${id}`);
  const s = p.sprites;
  const front = await sprite(s.front_default, `${id}`);
  if (!front) return; // sin sprite no sirve para jugar
  const back = (await sprite(s.back_default, `${id}-back`)) ?? front;
  const shinyFront = (await sprite(s.front_shiny, `${id}-s`)) ?? front;
  const shinyBack = (await sprite(s.back_shiny, `${id}-s-back`)) ?? shinyFront;
  await save(`pokemon/${id}`, {
    id,
    name: p.name,
    types: p.types,
    stats: p.stats.map((x: { base_stat: number; stat: { name: string } }) => ({ base_stat: x.base_stat, stat: { name: x.stat.name } })),
    abilities: p.abilities,
    sprites: { front_default: front, back_default: back, front_shiny: shinyFront, back_shiny: shinyBack, other: { 'official-artwork': { front_default: front } } },
    cries: { latest: null, legacy: null },
  });
  for (const a of p.abilities) abilities.add(a.ability.name);
  const sp = await getJson(`${API}/pokemon-species/${id}`);
  await save(`pokemon-species/${id}`, { id, name: sp.name, names: es(sp.names), evolution_chain: sp.evolution_chain });
  done.push(id);
  if (done.length % 20 === 0) console.log(`${done.length} Pokémon…`);
});

for (const name of abilities) {
  if (ABILITY_EFFECTS[name]) continue;
  const res = await get(`${API}/ability/${name}`);
  if (!res.ok) continue;
  const a = await res.json();
  await save(`ability/${name}`, { name, names: es(a.names) });
}

// --- Movimientos con potencia de cada tipo ---
for (const type of TYPES) {
  const t = await getJson(`${API}/type/${type}`);
  const kept: { name: string; url: string }[] = [];
  const list = (t.moves as { name: string; url: string }[])
    .map((m) => ({ ...m, id: Number(m.url.split('/').filter(Boolean).pop()) }))
    .filter((m) => m.id < 10000)
    .sort((a, b) => a.id - b.id);
  for (const m of list) {
    if (kept.length >= MOVES_PER_TYPE) break;
    const mv = await getJson(m.url);
    if (!mv.power) continue;
    await save(`move/${m.id}`, { id: m.id, name: mv.name, names: es(mv.names), type: { name: mv.type.name }, power: mv.power });
    kept.push({ name: m.name, url: m.url });
  }
  await save(`type/${type}`, { name: type, moves: kept });
  console.log(`tipo ${type}: ${kept.length} movimientos`);
}

done.sort((a, b) => a - b);
await save('manifest', { pokemon: done, types: TYPES });
console.log(`Listo: ${done.length} Pokémon en ${OUT}`);
