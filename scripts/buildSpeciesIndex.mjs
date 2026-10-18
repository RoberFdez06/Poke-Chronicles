// Genera public/data/species-index.json con los datos de todas las especies de PokeAPI.
// Ejecutar una vez desde la raíz del proyecto (necesita internet):
//   node scripts/buildSpeciesIndex.mjs
// El juego lo cargará con fetch('/data/species-index.json') y lo clasificará con gacha.ts.
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;
const OUT_DIR = 'public/data';
const OUT_FILE = `${OUT_DIR}/species-index.json`;

async function getJson(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= tries) throw new Error(`${url}: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

const { count } = await getJson(`${BASE}/pokemon-species?limit=1`);
const index = new Array(count);
let next = 1;
let done = 0;

async function worker() {
  while (next <= count) {
    const id = next++;
    const species = await getJson(`${BASE}/pokemon-species/${id}`);
    // La variedad por defecto es la forma "normal" de la especie
    const variety = species.varieties.find((v) => v.is_default) ?? species.varieties[0];
    const pokemon = await getJson(variety.pokemon.url);

    index[id - 1] = {
      id,
      name: species.name,
      // Nombre en español (si PokeAPI no lo tiene, el de siempre)
      nameEs: species.names.find((n) => n.language.name === 'es')?.name ?? species.name,
      bst: pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0),
      // Tipos (para el filtro de la Pokédex), en el orden de PokeAPI
      types: pokemon.types.map((t) => t.type.name),
      legendary: species.is_legendary,
      mythical: species.is_mythical,
    };
    if (++done % 100 === 0 || done === count) console.log(`${done}/${count}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(index));
console.log(`Escrito ${OUT_FILE} con ${index.length} especies`);
