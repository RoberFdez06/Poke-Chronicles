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
    formId: 5,
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
    maxHp: 120,
    passives: ['lupa', 'lupa'],
    slots: [move, null, null, null],
    nextSlotReplace: 0,
    movePool: [move],
    floorItems: [{ roomId: 2, x: 100, y: 200, drop: { kind: 'passive', id: 'restos' } }],
    earned: 15,
    coins: 7,
    centerUsed: true,
    shop: [{ goods: { kind: 'potion', id: 'pocion' }, price: 5, sold: false }],
    layout: 3,
    keys: 1,
    bombs: 2,
    openedChests: [4],
    revealedDoors: ['3:up'],
    active: { id: 'pokeblock', charge: 2 },
    healed: false,
    counters: { seconds: 125.5, kills: 14, damage: 900, newRecord: false },
    daily: null,
    difficulty: 'hard',
    eventsDone: [5],
    hpSacrificed: 12,
    eggLeft: 1,
    allyId: 16,
    tiredRooms: 0,
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

test('un guardado v3 (sin monedas ni tienda) se migra con el piso de antes', () => {
  const { coins: _c, centerUsed: _u, shop: _s, layout: _l, ...v3 } = sample();
  const run = parseRun(JSON.stringify({ ...v3, version: 3 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.coins, 0);
  assert.equal(run.centerUsed, false);
  assert.deepEqual(run.shop, []);
  assert.equal(run.layout, 1);
});

test('monedas y bayas en el suelo se guardan; las raras invalidan', () => {
  const ok = { ...sample(), floorItems: [{ roomId: 1, x: 0, y: 0, drop: { kind: 'coin', value: 5 } }, { roomId: 1, x: 0, y: 0, drop: { kind: 'berry', id: 'zidra' } }] };
  assert.ok(parseRun(JSON.stringify(ok)));
  assert.equal(parseRun(JSON.stringify({ ...sample(), floorItems: [{ roomId: 1, x: 0, y: 0, drop: { kind: 'berry', id: 'nada' } }] })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), coins: -1 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), shop: [{ goods: { kind: 'potion', id: 'x' }, price: 5, sold: false }] })), null);
});

test('un guardado v4 (sin PS máximos) los calcula con los objetos', () => {
  const { maxHp: _m, ...v4 } = sample();
  const run = parseRun(JSON.stringify({ ...v4, version: 4 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  // Sin Baya Aranja: los 100 de siempre
  assert.equal(run.maxHp, 100);
  const withBerry = parseRun(JSON.stringify({ ...v4, version: 4, passives: ['baya-aranja'] }));
  assert.equal(withBerry?.maxHp, 120);
});

test('un guardado v5 (sin evolución) sigue con el Pokémon elegido', () => {
  const { formId: _f, ...v5 } = sample();
  const run = parseRun(JSON.stringify({ ...v5, version: 5 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.formId, 4);
});

test('un guardado v6 (sin llaves ni bombas) empieza con una bomba y conserva su diseño de piso', () => {
  const { keys: _k, bombs: _b, openedChests: _o, revealedDoors: _r, ...v6 } = sample();
  const run = parseRun(JSON.stringify({ ...v6, version: 6, layout: 2 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual([run.keys, run.bombs, run.layout], [0, 1, 2]);
  assert.deepEqual(run.openedChests, []);
  assert.equal(parseRun(JSON.stringify({ ...sample(), bombs: -1 })), null);
});

test('un guardado v7 (sin objeto activo) se migra sin él', () => {
  const { active: _a, ...v7 } = sample();
  const run = parseRun(JSON.stringify({ ...v7, version: 7 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.active, null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), active: { id: 'x', charge: -1 } })), null);
});

test('un guardado v8 se migra contando que te has curado', () => {
  const { healed: _h, ...v8 } = sample();
  const run = parseRun(JSON.stringify({ ...v8, version: 8 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.healed, true);
  assert.equal(parseRun(JSON.stringify({ ...sample(), healed: 'no' })), null);
});

test('un guardado v9 se migra con los contadores a cero', () => {
  const { counters: _c, ...v9 } = sample();
  const run = parseRun(JSON.stringify({ ...v9, version: 9 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual(run.counters, { seconds: 0, kills: 0, damage: 0, newRecord: false });
  assert.equal(parseRun(JSON.stringify({ ...sample(), counters: { seconds: -1, kills: 0, damage: 0, newRecord: false } })), null);
});

test('un guardado v10 se migra como partida no diaria', () => {
  const { daily: _d, ...v10 } = sample();
  const run = parseRun(JSON.stringify({ ...v10, version: 10 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.daily, null);
  const daily = parseRun(JSON.stringify({ ...sample(), daily: { day: 20000, counts: true } }));
  assert.deepEqual(daily?.daily, { day: 20000, counts: true });
  assert.equal(parseRun(JSON.stringify({ ...sample(), daily: { day: 'hoy', counts: true } })), null);
});

test('un guardado v11 se migra a dificultad Normal', () => {
  const { difficulty: _d, ...v11 } = sample();
  const run = parseRun(JSON.stringify({ ...v11, version: 11 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.difficulty, 'normal');
  assert.equal(parseRun(JSON.stringify({ ...sample(), difficulty: 'imposible' })), null);
});

test('un guardado v12 se migra sin salas sorpresa ni altares', () => {
  const { eventsDone: _e, hpSacrificed: _h, ...v12 } = sample();
  const run = parseRun(JSON.stringify({ ...v12, version: 12 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual(run.eventsDone, []);
  assert.equal(run.hpSacrificed, 0);
  assert.equal(parseRun(JSON.stringify({ ...sample(), hpSacrificed: -3 })), null);
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

test('un guardado v13 se migra sin huevo, ayudante ni cansancio (T48)', () => {
  const { eggLeft: _e, allyId: _a, tiredRooms: _t, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 13 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual([run.eggLeft, run.allyId, run.tiredRooms], [0, 0, 0]);
  assert.deepEqual([parseRun(JSON.stringify(sample()))?.eggLeft, parseRun(JSON.stringify(sample()))?.allyId], [1, 16]);
  assert.equal(parseRun(JSON.stringify({ ...sample(), eggLeft: -1 })), null);
});
