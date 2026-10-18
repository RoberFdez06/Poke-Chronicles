// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONS,
  SEARCH_LETTERS,
  countByRegion,
  filterCollection,
  normalizeText,
  regionOf,
  type CollectionEntry,
} from '../src/data/regions.ts';

test('las 9 regiones cubren la Pokédex nacional sin huecos y sus iniciales son suyos', () => {
  assert.equal(REGIONS.length, 9);
  assert.equal(REGIONS[0].first, 1);
  for (let i = 1; i < REGIONS.length; i++) assert.equal(REGIONS[i].first, REGIONS[i - 1].last + 1);
  for (const r of REGIONS) {
    assert.equal(r.starters.length, 3);
    for (const s of r.starters) assert.equal(regionOf(s), r);
  }
  assert.equal(regionOf(25)?.name, 'Kanto');
  assert.equal(regionOf(1025)?.name, 'Paldea');
  assert.equal(regionOf(0), undefined);
  assert.equal(regionOf(5000), undefined);
});

test('normaliza texto para buscar', () => {
  assert.equal(normalizeText('  Mr-Mime '), 'mr mime');
  assert.equal(normalizeText('Pokémon Ñandú'), 'pokemon nandu');
  assert.ok(SEARCH_LETTERS.includes('Ñ'));
});

const entries: CollectionEntry[] = [
  { id: 152, name: 'chikorita', rarity: 'common' },
  { id: 4, name: 'charmander', rarity: 'common' },
  { id: 6, name: 'charizard', rarity: 'epic' },
  { id: 150, name: 'mewtwo', rarity: 'legendary' },
  { id: 122, name: 'mr-mime', rarity: 'rare' },
];

test('filtra por región, rareza y nombre, y ordena por número', () => {
  assert.deepEqual(filterCollection(entries).map((e) => e.id), [4, 6, 122, 150, 152]);
  assert.deepEqual(filterCollection(entries, { region: 'johto' }).map((e) => e.id), [152]);
  assert.deepEqual(filterCollection(entries, { rarity: 'common' }).map((e) => e.id), [4, 152]);
  assert.deepEqual(filterCollection(entries, { query: 'CHAR' }).map((e) => e.id), [4, 6]);
  assert.deepEqual(filterCollection(entries, { query: 'mr mime' }).map((e) => e.id), [122]);
  assert.deepEqual(filterCollection(entries, { region: 'kanto', rarity: 'epic', query: 'iz' }).map((e) => e.id), [6]);
  assert.deepEqual(filterCollection(entries, { region: 'paldea' }), []);
  assert.deepEqual(filterCollection(entries, { region: null, rarity: null, query: '' }).length, 5);
});

test('cuenta cuántos tienes por región', () => {
  const c = countByRegion(entries);
  assert.equal(c.kanto, 4);
  assert.equal(c.johto, 1);
  assert.equal(c.paldea, 0);
  assert.equal(Object.keys(c).length, 9);
});

test('filtra por tipo', () => {
  const typed = [
    { id: 4, name: 'charmander', rarity: 'common' as const, types: ['fire'] },
    { id: 6, name: 'charizard', rarity: 'epic' as const, types: ['fire', 'flying'] },
    { id: 16, name: 'pidgey', rarity: 'common' as const, types: ['normal', 'flying'] },
    { id: 999, name: 'sin tipos', rarity: 'common' as const },
  ];
  assert.deepEqual(filterCollection(typed, { type: 'flying' }).map((e) => e.id), [6, 16]);
  assert.deepEqual(filterCollection(typed, { type: 'fire', rarity: 'epic' }).map((e) => e.id), [6]);
  assert.equal(filterCollection(typed, { type: null }).length, 4);
});
