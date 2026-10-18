// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHINY_ENEMY, SHINY_ODDS, parseShinies, rollShiny } from '../src/data/shiny.ts';
import { addShiny, loadShinies, loadUnlocked, resetProgress, type StorageLike } from '../src/data/save.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('las probabilidades de shiny son las de la tarea', () => {
  assert.equal(SHINY_ODDS.gacha, 1 / 64);
  assert.equal(SHINY_ODDS.enemy, 1 / 200);
  const rng = mulberry32(1);
  let n = 0;
  for (let i = 0; i < 64000; i++) if (rollShiny(rng, SHINY_ODDS.gacha)) n++;
  assert.ok(n > 850 && n < 1150, `${n}`);
  assert.ok(SHINY_ENEMY.hpMul > 1);
});

test('los shinies se guardan, desbloquean el Pokémon y se borran con el progreso', () => {
  const st = fakeStorage();
  assert.deepEqual(loadShinies(st), []);
  assert.equal(addShiny(25, st), true);
  assert.equal(addShiny(25, st), false);
  assert.deepEqual(loadShinies(st), [25]);
  assert.ok(loadUnlocked(st).includes(25));
  resetProgress(st);
  assert.deepEqual(loadShinies(st), []);
  assert.deepEqual(parseShinies('[1, 1, "x", -2, 3.5, 4]'), [1, 4]);
  assert.deepEqual(parseShinies('{'), []);
});
