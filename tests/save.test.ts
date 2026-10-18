// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STARTERS,
  UNLOCKED_KEY,
  loadUnlocked,
  needsFirstStarter,
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

test('sin nada guardado no tienes ningún Pokémon: toca elegir región e inicial', () => {
  assert.deepEqual(parseUnlocked(null), []);
  assert.deepEqual(loadUnlocked(fakeStorage()), []);
  assert.deepEqual(loadUnlocked(null), []);
  assert.equal(needsFirstStarter(fakeStorage()), true);
});

test('migración: el formato antiguo (array) conserva Bulbasaur, Charmander y Squirtle', () => {
  assert.deepEqual(parseUnlocked('[]'), [...DEFAULT_STARTERS]);
  assert.deepEqual(parseUnlocked('[25]'), [1, 4, 7, 25]);
  assert.equal(needsFirstStarter(fakeStorage('[]')), false);
});

test('migración: quien ya jugaba sin usar el gacha (monedas o partidas guardadas) conserva los iniciales', () => {
  const withCoins = fakeStorage();
  withCoins.data.set(COINS_KEY, '40');
  assert.deepEqual(loadUnlocked(withCoins), [...DEFAULT_STARTERS]);
  const withRun = fakeStorage();
  withRun.data.set('pokeisaac.run.2', '{}');
  assert.deepEqual(loadUnlocked(withRun), [...DEFAULT_STARTERS]);
  assert.equal(needsFirstStarter(withRun), false);
});

test('un guardado corrupto o con otro formato deja los iniciales de siempre', () => {
  assert.deepEqual(parseUnlocked('{'), [...DEFAULT_STARTERS]);
  assert.deepEqual(parseUnlocked('{"a":1}'), [...DEFAULT_STARTERS]);
  assert.deepEqual(parseUnlocked('"hola"'), [...DEFAULT_STARTERS]);
});

test('filtra valores que no son ids y no duplica', () => {
  assert.deepEqual(parseUnlocked(JSON.stringify([25, 'x', -3, 1.5, 25, 4, null])), [1, 4, 7, 25]);
  assert.deepEqual(parseUnlocked(JSON.stringify({ v: 2, ids: [152, 'x', 152, 0] })), [152]);
});

test('el primer inicial elegido es el único desbloqueado', () => {
  const s = fakeStorage();
  assert.deepEqual(unlockPokemon(152, s), [152]);
  assert.deepEqual(loadUnlocked(s), [152]);
  assert.equal(needsFirstStarter(s), false);
});

test('desbloquear guarda en el formato nuevo y se recupera', () => {
  const s = fakeStorage('[25]');
  assert.deepEqual(unlockPokemon(26, s), [1, 4, 7, 25, 26]);
  assert.deepEqual(JSON.parse(s.data.get(UNLOCKED_KEY)!), { v: 2, ids: [1, 4, 7, 25, 26] });
  assert.deepEqual(loadUnlocked(s), [1, 4, 7, 25, 26]);
});

test('desbloquear uno que ya está no lo repite', () => {
  const s = fakeStorage();
  unlockPokemon(25, s);
  assert.deepEqual(unlockPokemon(25, s), [25]);
  assert.deepEqual(unlockPokemon(4, s), [25, 4]);
});

test('sin almacenamiento o con almacenamiento que falla, no lanza', () => {
  assert.deepEqual(unlockPokemon(25, null), [25]);
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

import { addTickets, loadTickets, spendTickets, COINS_KEY, TICKETS_KEY } from '../src/data/save.ts';

test('tickets: se suman, se gastan y no bajan de 0', () => {
  const st = fakeStorage();
  assert.equal(loadTickets(st), 0);
  assert.equal(addTickets(150, st), 150);
  assert.equal(addTickets(-5, st), 150);
  assert.equal(spendTickets(100, st), true);
  assert.equal(loadTickets(st), 50);
  assert.equal(spendTickets(100, st), false);
  assert.equal(loadTickets(st), 50);
  st.data.set(TICKETS_KEY, 'basura');
  assert.equal(loadTickets(st), 0);
  assert.equal(loadTickets(null), 0);
});

test('migración: el saldo de monedas de antes pasa a tickets sin perder nada', () => {
  const st = fakeStorage();
  st.data.set(COINS_KEY, '340');
  assert.equal(loadTickets(st), 340);
  assert.equal(st.data.get(TICKETS_KEY), '340');
  assert.equal(addTickets(10, st), 350);
  // Una vez migrado manda la clave nueva
  st.data.set(COINS_KEY, '9999');
  assert.equal(loadTickets(st), 350);
});
