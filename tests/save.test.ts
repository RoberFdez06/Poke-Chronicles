// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STARTERS,
  UNLOCKED_KEY,
  loadUnlocked,
  parseUnlocked,
  unlockPokemon,
  type StorageLike,
} from '../src/data/save.ts';

function fakeStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(UNLOCKED_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

test('sin nada guardado, solo están los iniciales por defecto', () => {
  assert.deepEqual(parseUnlocked(null), [...DEFAULT_STARTERS]);
  assert.deepEqual(loadUnlocked(fakeStorage()), [...DEFAULT_STARTERS]);
  assert.deepEqual(loadUnlocked(null), [...DEFAULT_STARTERS]);
});

test('un guardado corrupto o con otro formato se ignora', () => {
  assert.deepEqual(parseUnlocked('{'), [...DEFAULT_STARTERS]);
  assert.deepEqual(parseUnlocked('{"a":1}'), [...DEFAULT_STARTERS]);
  assert.deepEqual(parseUnlocked('"hola"'), [...DEFAULT_STARTERS]);
});

test('filtra valores que no son ids y no duplica', () => {
  assert.deepEqual(parseUnlocked(JSON.stringify([25, 'x', -3, 1.5, 25, 4, null])), [1, 4, 7, 25]);
});

test('desbloquear guarda y se recupera', () => {
  const s = fakeStorage();
  assert.deepEqual(unlockPokemon(25, s), [1, 4, 7, 25]);
  assert.deepEqual(loadUnlocked(s), [1, 4, 7, 25]);
});

test('desbloquear uno que ya está no lo repite', () => {
  const s = fakeStorage();
  unlockPokemon(25, s);
  assert.deepEqual(unlockPokemon(25, s), [1, 4, 7, 25]);
  assert.deepEqual(unlockPokemon(4, s), [1, 4, 7, 25]);
});

test('sin almacenamiento o con almacenamiento que falla, no lanza', () => {
  assert.deepEqual(unlockPokemon(25, null), [1, 4, 7, 25]);
  const broken: StorageLike = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.deepEqual(loadUnlocked(broken), [...DEFAULT_STARTERS]);
  assert.deepEqual(unlockPokemon(25, broken), [1, 4, 7, 25]);
});

import { addCoins, loadCoins, spendCoins, COINS_KEY } from '../src/data/save.ts';

test('monedas: se suman, se gastan y no bajan de 0', () => {
  const st = fakeStorage();
  assert.equal(loadCoins(st), 0);
  assert.equal(addCoins(150, st), 150);
  assert.equal(addCoins(-5, st), 150);
  assert.equal(spendCoins(100, st), true);
  assert.equal(loadCoins(st), 50);
  assert.equal(spendCoins(100, st), false);
  assert.equal(loadCoins(st), 50);
  st.data.set(COINS_KEY, 'basura');
  assert.equal(loadCoins(st), 0);
  assert.equal(loadCoins(null), 0);
});
