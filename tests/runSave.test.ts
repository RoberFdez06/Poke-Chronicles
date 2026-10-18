// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearRun, loadAllRuns, loadRun, parseRun, runKey, saveRun, RUN_VERSION, type RunSave } from '../src/data/runSave.ts';
import type { StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const move = { id: 1, name: 'pound', type: 'normal', power: 40, shape: 'bolt' as const, cooldown: 920 };

function sample(): RunSave {
  return {
    version: RUN_VERSION,
    savedAt: 1700000000000,
    starterId: 4,
    starterName: 'charmander',
    mode: 'normal',
    floor: 2,
    bossHistory: [144, 150],
    floorSeed: 1234,
    roomCount: 10,
    bossId: 150,
    roomId: 3,
    visited: [0, 3],
    cleared: [0],
    hp: 80,
    passives: ['lupa', 'lupa'],
    slots: [move, null, null, null],
    nextSlotReplace: 0,
    movePool: [move],
    floorItems: [{ roomId: 2, x: 100, y: 200, drop: { kind: 'passive', id: 'restos' } }],
    earned: 15,
  };
}

test('guardar y cargar devuelve lo mismo, en su hueco', () => {
  const st = fakeStorage();
  assert.equal(saveRun(1, sample(), st), true);
  assert.deepEqual(loadRun(1, st), sample());
  assert.equal(loadRun(0, st), null);
  assert.deepEqual(loadAllRuns(st).map((r) => r !== null), [false, true, false]);
});

test('borrar deja el hueco vacío', () => {
  const st = fakeStorage();
  saveRun(2, sample(), st);
  clearRun(2, st);
  assert.equal(loadRun(2, st), null);
});

test('guardados corruptos, de otra versión o con datos mal se ignoran', () => {
  assert.equal(parseRun('{'), null);
  assert.equal(parseRun(''), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), version: 999 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), hp: 0 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), visited: ['x'] })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), slots: [{ name: 'x' }] })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), floorItems: [{ roomId: 1, x: 0, y: 0, drop: { kind: 'otro' } }] })), null);
});

test('un guardado v1 (sin pisos) se migra al piso 1', () => {
  const { floor: _f, bossHistory: _b, ...v1 } = sample();
  const run = parseRun(JSON.stringify({ ...v1, version: 1 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.floor, 1);
  assert.deepEqual(run.bossHistory, [150]);
  assert.equal(run.starterName, 'charmander');
  assert.equal(run.mode, 'normal');
});

test('un guardado v2 (sin modo) se migra al modo Normal', () => {
  const { mode: _m, ...v2 } = sample();
  const run = parseRun(JSON.stringify({ ...v2, version: 2 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.mode, 'normal');
  assert.equal(run.floor, 2);
});

test('un modo desconocido invalida el guardado', () => {
  assert.equal(parseRun(JSON.stringify({ ...sample(), mode: 'otro' })), null);
  const waves = parseRun(JSON.stringify({ ...sample(), mode: 'waves' }));
  assert.equal(waves?.mode, 'waves');
});

test('un piso no válido invalida el guardado', () => {
  assert.equal(parseRun(JSON.stringify({ ...sample(), floor: 0 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), bossHistory: 'x' })), null);
});

test('huecos fuera de rango no hacen nada', () => {
  const st = fakeStorage();
  assert.equal(saveRun(3, sample(), st), false);
  assert.equal(saveRun(-1, sample(), st), false);
  assert.equal(loadRun(7, st), null);
  assert.equal(st.data.size, 0);
  assert.equal(runKey(0), 'pokeisaac.run.0');
});
