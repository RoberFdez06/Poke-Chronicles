import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCounters, formatDuration, HISTORY_SIZE, isCounters, parseHistory, withRun, type RunRecord } from '../src/data/runHistory.ts';
import { addRunHistory, HISTORY_KEY, loadRunHistory, PROGRESS_KEYS, type StorageLike } from '../src/data/save.ts';

const rec = (n: number, extra: Partial<RunRecord> = {}): RunRecord => ({
  endedAt: 1700000000000 + n,
  starterId: 4,
  starterName: 'Charmander',
  mode: 'normal',
  floor: 2,
  won: false,
  seconds: 300 + n,
  kills: 20,
  damage: 1500,
  items: ['Lupa x2'],
  tickets: 9,
  newRecord: false,
  ...extra,
});

test('el historial guarda las últimas 20, la más reciente primero', () => {
  let list: RunRecord[] = [];
  for (let i = 0; i < 25; i++) list = withRun(list, rec(i));
  assert.equal(list.length, HISTORY_SIZE);
  assert.equal(list[0].endedAt, rec(24).endedAt);
  assert.equal(list.at(-1)!.endedAt, rec(5).endedAt);
});

test('parseHistory descarta lo corrupto sin perder lo bueno', () => {
  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory('{roto'), []);
  assert.deepEqual(parseHistory('{"a":1}'), []);
  const ok = rec(1);
  const list = parseHistory(JSON.stringify([ok, { ...ok, mode: 'volar' }, { ...ok, kills: -1 }, 7]));
  assert.deepEqual(list, [ok]);
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(187.9), '3:07');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(-5), '0:00');
});

test('contadores de la partida', () => {
  assert.ok(isCounters(emptyCounters()));
  assert.equal(isCounters({ seconds: 1, kills: 2, damage: 3 }), false);
  assert.equal(isCounters({ seconds: 1, kills: -2, damage: 3, newRecord: false }), false);
});

test('se guarda en localStorage y se borra con el progreso', () => {
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  addRunHistory(rec(1), st);
  addRunHistory(rec(2, { won: true }), st);
  const list = loadRunHistory(st);
  assert.equal(list.length, 2);
  assert.equal(list[0].won, true);
  assert.ok(PROGRESS_KEYS.includes(HISTORY_KEY));
});
