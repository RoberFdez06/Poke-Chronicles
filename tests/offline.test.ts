import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { offlinePath, PLACEHOLDER_SPRITE, substitutePokemon, withTimeout } from '../src/data/offline.ts';
import { REGIONS } from '../src/data/regions.ts';
import { FALLBACK_ENEMIES } from '../src/data/enemies.ts';
import { parseApiStats } from '../src/data/pokeStats.ts';

test('cada URL de PokeAPI tiene su sitio en el paquete', () => {
  assert.equal(offlinePath('https://pokeapi.co/api/v2/pokemon/4'), 'data/offline/pokemon/4.json');
  assert.equal(offlinePath('https://pokeapi.co/api/v2/evolution-chain/2/'), 'data/offline/evolution-chain/2.json');
  assert.equal(offlinePath('https://pokeapi.co/api/v2/type/fire'), 'data/offline/type/fire.json');
  assert.equal(offlinePath('https://pokeapi.co/api/v2/ability/solar-power'), 'data/offline/ability/solar-power.json');
  assert.equal(offlinePath('https://pokeapi.co/api/v2/pokemon-species?limit=1'), null);
  assert.equal(offlinePath('https://pokeapi.co/api/v2/berry/1'), null);
});

test('el sustituto tiene tipos, estadísticas y el sprite genérico', () => {
  const p = substitutePokemon(6, [{ id: 6, name: 'charizard', nameEs: 'Charizard', bst: 534, types: ['fire', 'flying'], legendary: false, mythical: false }]) as {
    types: { type: { name: string } }[];
    stats: { base_stat: number; stat: { name: string } }[];
    sprites: { front_default: string };
  };
  assert.deepEqual(p.types.map((t) => t.type.name), ['fire', 'flying']);
  const stats = parseApiStats(p.stats);
  assert.equal(stats.hp, 89);
  assert.equal(p.sprites.front_default, PLACEHOLDER_SPRITE);
  // Sin datos del índice: Normal y estadísticas medias
  assert.deepEqual((substitutePokemon(9999, []) as { types: { type: { name: string } }[] }).types.map((t) => t.type.name), ['normal']);
});

test('withTimeout: falla si tarda y deja pasar si no', async () => {
  assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
  await assert.rejects(withTimeout(new Promise(() => {}), 20), /más de 20 ms/);
  await assert.rejects(withTimeout(Promise.reject(new Error('x')), 50), /x/);
});

test('el paquete trae los iniciales de las 9 regiones, los de reserva y sus sprites', () => {
  const m = JSON.parse(readFileSync('public/data/offline/manifest.json', 'utf8')) as { pokemon: number[]; types: string[] };
  for (const id of [...REGIONS.flatMap((r) => [...r.starters]), ...FALLBACK_ENEMIES]) {
    assert.ok(m.pokemon.includes(id), `falta ${id}`);
    const raw = JSON.parse(readFileSync(`public/data/offline/pokemon/${id}.json`, 'utf8'));
    assert.ok(existsSync(`public/${raw.sprites.front_default}`), `sprite ${id}`);
  }
  assert.equal(m.types.length, 18);
  for (const t of m.types) assert.ok(JSON.parse(readFileSync(`public/data/offline/type/${t}.json`, 'utf8')).moves.length >= 5, t);
  assert.ok(existsSync(`public/${PLACEHOLDER_SPRITE}`));
});
