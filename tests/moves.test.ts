// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterMovesByTypes, idFromUrl, isUsableMove, localName, pickMoveIds, typeMoveIds } from '../src/data/moves.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('solo valen movimientos con potencia de los tipos de tu Pokémon', () => {
  const moves = [
    { id: 1, name: 'ascuas', type: 'fire', power: 40 },
    { id: 2, name: 'pistola agua', type: 'water', power: 40 },
    { id: 3, name: 'día soleado', type: 'fire', power: null as unknown as number },
    { id: 4, name: 'ataque ala', type: 'flying', power: 60 },
    { id: 5, name: 'nada', type: 'fire', power: 0 },
  ];
  assert.deepEqual(filterMovesByTypes(moves, ['fire']).map((m) => m.id), [1]);
  assert.deepEqual(filterMovesByTypes(moves, ['fire', 'flying']).map((m) => m.id), [1, 4]);
  assert.deepEqual(filterMovesByTypes(moves, []), []);
  assert.ok(isUsableMove({ type: 'water', power: 1 }, ['water']));
  assert.ok(!isUsableMove({ type: 'water', power: 90 }, ['grass']));
});

test('ids de la respuesta de /type sin los especiales', () => {
  const url = (id: number) => `https://pokeapi.co/api/v2/move/${id}/`;
  assert.equal(idFromUrl(url(52)), 52);
  assert.deepEqual(typeMoveIds([{ url: url(52) }, { url: url(10001) }, { url: url(53) }]), [52, 53]);
});

test('reparte los poderes entre los tipos y no repite', () => {
  const ids = pickMoveIds([[1, 2, 3, 4], [10, 11, 12]], 4, mulberry32(3));
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids.filter((id) => id < 10).length, 2);
  assert.equal(ids.filter((id) => id >= 10).length, 2);
  // Si un tipo se queda sin movimientos, sigue con el otro
  assert.deepEqual(pickMoveIds([[1], []], 5, mulberry32(1)), [1]);
  assert.equal(pickMoveIds([[1, 2, 3], [9]], 4, mulberry32(2)).length, 4);
  assert.deepEqual(pickMoveIds([], 3, mulberry32(1)), []);
});

test('nombre en español con respaldo', () => {
  const names = [
    { name: 'Flamethrower', language: { name: 'en' } },
    { name: 'Lanzallamas', language: { name: 'es' } },
  ];
  assert.equal(localName(names, 'flamethrower'), 'Lanzallamas');
  assert.equal(localName([], 'flamethrower'), 'flamethrower');
  assert.equal(localName(undefined, 'x'), 'x');
});
