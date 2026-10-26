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
    potions: 2,
    secondChance: false,
    captureDone: false,
    capturePrevAlly: -1,
    slotSpins: [],
    fishCasts: [],
    bossesBeaten: 1,
    powerForm: { active: null, leftMs: 0, used: false },
    powerMeter: 0,
    zUsed: false,
    storiesSeen: ['mochila'],
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

test('un guardado v14 se migra sin pociones (T49) y las pociones del suelo se guardan', () => {
  const { potions: _p, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 14 }));
  assert.ok(run);
  assert.equal(run.potions, 0);
  const withPotion = parseRun(JSON.stringify({ ...sample(), floorItems: [{ roomId: 1, x: 5, y: 6, drop: { kind: 'potion' } }] }));
  assert.deepEqual(withPotion?.floorItems[0].drop, { kind: 'potion' });
  assert.equal(parseRun(JSON.stringify({ ...sample(), potions: -1 })), null);
});

test('T57: un guardado v15 se migra con la segunda oportunidad sin usar y se guarda si ya se usó', () => {
  const { secondChance: _s, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 15 }));
  assert.ok(run);
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.secondChance, false);
  assert.equal(parseRun(JSON.stringify({ ...sample(), secondChance: true }))?.secondChance, true);
  assert.equal(parseRun(JSON.stringify({ ...sample(), secondChance: 'sí' })), null);
});

test('T65: v16 sin captura se migra (sin capturar) y se valida', () => {
  const { captureDone: _c, capturePrevAlly: _p, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 16 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.captureDone, false);
  assert.equal(run.capturePrevAlly, -1);
  assert.equal(parseRun(JSON.stringify({ ...sample(), captureDone: true, capturePrevAlly: 7 }))?.capturePrevAlly, 7);
  assert.equal(parseRun(JSON.stringify({ ...sample(), capturePrevAlly: -2 })), null);
});

test('T68/T69: v17 sin contadores se migra a cero y los contadores hacen la ida y vuelta', () => {
  const { slotSpins: _s, fishCasts: _f, bossesBeaten: _b, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 17 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual(run.slotSpins, []);
  assert.deepEqual(run.fishCasts, []);
  const full = { ...sample(), slotSpins: [[3, 2], [5, 1]], fishCasts: [[4, 3]] };
  const back = parseRun(JSON.stringify(full))!;
  assert.deepEqual(new Map(back.slotSpins), new Map([[3, 2], [5, 1]]));
  assert.deepEqual(new Map(back.fishCasts), new Map([[4, 3]]));
  assert.equal(parseRun(JSON.stringify({ ...sample(), slotSpins: [[1, -1]] })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), fishCasts: 'x' })), null);
});

test('T73: v18 sin jefes vencidos se migra contando los jefes vistos menos el actual, sin tocar los objetos', () => {
  const many = Array.from({ length: 14 }, (_, i) => `obj-${i}`);
  const { bossesBeaten: _b, ...old } = { ...sample(), passives: many };
  const run = parseRun(JSON.stringify({ ...old, version: 18 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.bossesBeaten, 1); // bossHistory [144, 150]
  assert.deepEqual(run.passives, many);
  const none = parseRun(JSON.stringify({ ...old, bossHistory: [], version: 18 }))!;
  assert.equal(none.bossesBeaten, 0);
  assert.equal(parseRun(JSON.stringify({ ...sample(), bossesBeaten: -1 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), bossesBeaten: 1.5 })), null);
});

test('T74: v19 sin forma de poder se migra sin forma y lo que queda de megaevolución hace la ida y vuelta', () => {
  const { powerForm: _p, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 19 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual(run.powerForm, { active: null, leftMs: 0, used: false });
  const mid = parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'mega', leftMs: 12345, used: true } }))!;
  assert.deepEqual(mid.powerForm, { active: 'mega', leftMs: 12345, used: true });
  // Usada en el piso pero ya acabada
  assert.ok(parseRun(JSON.stringify({ ...sample(), powerForm: { active: null, leftMs: 0, used: true } })));
  // Corruptos: forma desconocida, tiempo negativo o de más, activa sin usar
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'ultra', leftMs: 100, used: true } })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'mega', leftMs: -1, used: true } })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'mega', leftMs: 999999, used: true } })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'mega', leftMs: 100, used: false } })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: null })), null);
});

test('T75: v20 se migra con el medidor vacío y el Z sin usar; medidor, Z, Tera y escudo hacen la ida y vuelta', () => {
  const { powerMeter: _m, zUsed: _z, ...old } = sample();
  const { storiesSeen: _s, ...old20 } = old;
  const run = parseRun(JSON.stringify({ ...old20, version: 20 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.equal(run.powerMeter, 0);
  assert.equal(run.zUsed, false);
  const tera = { active: 'tera', leftMs: 5000, used: true, tera: 'water', shield: 0 };
  const mid = parseRun(JSON.stringify({ ...sample(), powerMeter: 42.5, zUsed: true, powerForm: tera }))!;
  assert.equal(mid.powerMeter, 42.5);
  assert.equal(mid.zUsed, true);
  assert.deepEqual(mid.powerForm, tera);
  assert.ok(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'dynamax', leftMs: 100, used: true, tera: null, shield: 20 } })));
  // Corruptos: medidor fuera de rango, Tera sin tipo, escudo de más
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerMeter: 101 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerMeter: -1 })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), zUsed: 'no' })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'tera', leftMs: 100, used: true } })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), powerForm: { active: 'dynamax', leftMs: 100, used: true, shield: 999 } })), null);
});

test('T79: v21 se migra sin historias vistas; las vistas hacen la ida y vuelta y las corruptas se rechazan', () => {
  const { storiesSeen: _s, ...old } = sample();
  const run = parseRun(JSON.stringify({ ...old, version: 21 }))!;
  assert.equal(run.version, RUN_VERSION);
  assert.deepEqual(run.storiesSeen, []);
  assert.deepEqual(parseRun(JSON.stringify({ ...sample(), storiesSeen: ['eco', 'huevo'] }))!.storiesSeen, ['eco', 'huevo']);
  assert.equal(parseRun(JSON.stringify({ ...sample(), storiesSeen: [3] })), null);
  assert.equal(parseRun(JSON.stringify({ ...sample(), storiesSeen: null })), null);
});
