// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_CHANCE,
  MERCHANT_PRICES,
  ROOM_EVENTS,
  ROOM_EVENT_COLOR,
  ROOM_EVENT_LABEL,
  TRAP_CHANCE,
  altarCost,
  canUseAltar,
  merchantStock,
  pickRoomEvent,
  runawayTickets,
  trapChestOutcome,
} from '../src/level/roomEvents.ts';
import { generateFloor, mulberry32 } from '../src/level/floorGen.ts';
import { PASSIVE_ITEMS } from '../src/data/items.ts';

const floorFor = (seed: number) => generateFloor({ seed, roomCount: 11, special: true, extra: true });

test('cada evento tiene nombre en español y color en el minimapa', () => {
  for (const k of ROOM_EVENTS) {
    assert.ok(ROOM_EVENT_LABEL[k]);
    assert.equal(typeof ROOM_EVENT_COLOR[k], 'number');
  }
});

test('sala sorpresa: a veces, nunca en el piso 1, en una sala de combate libre y siempre la misma con la misma semilla', () => {
  let some = 0;
  const kinds = new Set<string>();
  const n = 600;
  for (let i = 0; i < n; i++) {
    const f = floorFor(1000 + i);
    const exclude = new Set([f.rooms.find((r) => r.kind === 'combat')!.id]);
    const ev = pickRoomEvent(f, 3, mulberry32(i), exclude);
    if (!ev) continue;
    some++;
    kinds.add(ev.kind);
    const room = f.rooms[ev.roomId];
    assert.equal(room.kind, 'combat');
    assert.ok(!exclude.has(ev.roomId));
    assert.ok(!(f.chestRooms ?? []).includes(ev.roomId));
    assert.deepEqual(pickRoomEvent(f, 3, mulberry32(i), exclude), ev);
  }
  assert.ok(Math.abs(some / n - EVENT_CHANCE) < 0.06, `${some / n}`);
  assert.equal(kinds.size, ROOM_EVENTS.length);
  for (let i = 0; i < 40; i++) assert.equal(pickRoomEvent(floorFor(i), 1, mulberry32(i)), null);
  // Sin salas de combate libres, nada
  const f = floorFor(7);
  const all = new Set(f.rooms.map((r) => r.id));
  assert.equal(pickRoomEvent(f, 4, () => 0, all), null);
});

test('mercader: tres artículos sin pociones, con sus precios, sin repetir pasivos', () => {
  const moves = [{ id: 1, name: 'ascuas', type: 'fire', power: 40, shape: 'bolt' as const, cooldown: 900 }];
  for (let s = 0; s < 50; s++) {
    const pool = [...moves];
    const stock = merchantStock(mulberry32(s), new Set(), pool);
    assert.deepEqual(stock.map((x) => x.price), [...MERCHANT_PRICES]);
    assert.ok(stock.every((x) => !x.sold && x.goods.kind !== 'potion'));
    const ids = stock.flatMap((x) => (x.goods.kind === 'passive' ? [x.goods.id] : []));
    assert.equal(new Set(ids).size, ids.length);
    // El poder vendido sale de la bolsa
    if (stock.some((x) => x.goods.kind === 'move')) assert.equal(pool.length, 0);
  }
  // Evita los que ya tienes
  const owned = new Set(PASSIVE_ITEMS.slice(1).map((i) => i.id));
  const only = merchantStock(mulberry32(3), owned, []);
  assert.ok(only.some((x) => x.goods.kind === 'passive' && x.goods.id === PASSIVE_ITEMS[0].id));
});

test('altar, cofre trampa y premio del Pokémon raro', () => {
  assert.equal(altarCost(100), 15);
  assert.equal(altarCost(20), 5);
  assert.ok(canUseAltar(100));
  assert.ok(!canUseAltar(34));
  const rng = mulberry32(11);
  let monsters = 0;
  for (let i = 0; i < 2000; i++) if (trapChestOutcome(rng) === 'monster') monsters++;
  assert.ok(Math.abs(monsters / 2000 - TRAP_CHANCE) < 0.04);
  assert.ok(runawayTickets(4) > runawayTickets(2));
  assert.equal(runawayTickets(0), 4);
});

// --- T48 ---
import {
  EGG_ROOMS,
  ROOM_EVENT_DESC,
  TIME_TRIAL_SECONDS,
  eggHatch,
  eggTick,
  eventWeights,
  fountainHeal,
  fountainPrice,
  pickEventKind,
  rivalBonus,
  rivalWaveSize,
  timeTrialExtra,
  timeTrialSize,
} from '../src/level/roomEvents.ts';

test('T48: los 8 eventos tienen nombre, descripción (premio y riesgo) y color distinto', () => {
  assert.equal(ROOM_EVENTS.length, 8);
  for (const k of ROOM_EVENTS) assert.ok(ROOM_EVENT_DESC[k], k);
  assert.equal(new Set(ROOM_EVENTS.map((k) => ROOM_EVENT_COLOR[k])).size, ROOM_EVENTS.length);
});

test('T48: probabilidades por piso: la sala del tiempo desde el piso 3, más rivales y menos huevos al bajar', () => {
  assert.equal(eventWeights(2).timeTrial, 0);
  assert.ok(eventWeights(3).timeTrial > 0);
  assert.ok(eventWeights(6).rival > eventWeights(2).rival);
  assert.ok(eventWeights(6).egg < eventWeights(2).egg);
  for (const f of [2, 3, 5, 9]) for (const k of ROOM_EVENTS) assert.ok(eventWeights(f)[k] >= 0, `${f} ${k}`);
  // El reparto sigue los pesos (muestreo uniforme de x)
  for (const f of [2, 6]) {
    const w = eventWeights(f);
    const total = ROOM_EVENTS.reduce((a, k) => a + w[k], 0);
    const count = Object.fromEntries(ROOM_EVENTS.map((k) => [k, 0])) as Record<string, number>;
    const n = 4000;
    for (let i = 0; i < n; i++) count[pickEventKind(f, (i + 0.5) / n)]++;
    for (const k of ROOM_EVENTS) assert.ok(Math.abs(count[k] / n - w[k] / total) < 0.01, `${f} ${k}`);
  }
  assert.ok(ROOM_EVENTS.includes(pickEventKind(4, 0.9999999)));
  assert.notEqual(pickEventKind(2, 0.9999999), 'timeTrial');
});

test('T48: rival, fuente, sala del tiempo y huevo', () => {
  assert.ok(rivalWaveSize(1, 1) >= 2);
  assert.ok(rivalWaveSize(5, 3) > rivalWaveSize(1, 1));
  assert.ok(rivalWaveSize(99, 3) <= 6);
  assert.equal(rivalBonus(2), 2);
  assert.equal(rivalBonus(0), 1);
  assert.equal(fountainHeal(100), 50);
  assert.ok(fountainPrice(4) > fountainPrice(2));
  assert.equal(TIME_TRIAL_SECONDS, 20);
  assert.ok(timeTrialSize(6) >= timeTrialSize(1) && timeTrialSize(99) <= 8);
  assert.ok(timeTrialExtra(99) <= 6);
  assert.equal(eggTick(EGG_ROOMS), 1);
  assert.equal(eggTick(eggTick(EGG_ROOMS)), 0);
  assert.equal(eggTick(0), 0);
  const rng = mulberry32(4);
  let helpers = 0;
  for (let i = 0; i < 1000; i++) if (eggHatch(rng) === 'helper') helpers++;
  assert.ok(helpers > 500 && helpers < 700, `${helpers}`);
});

test('T59: el rival tiene 2 o 3 Pokémon, cada uno más duro, y un nombre inventado', async () => {
  const { rivalTeamSize, rivalMemberHpMul, rivalTrainerName, RIVAL_NAMES, RIVAL_TITLES } = await import('../src/level/roomEvents.ts');
  assert.equal(rivalTeamSize(1), 2);
  assert.equal(rivalTeamSize(2), 2);
  assert.equal(rivalTeamSize(3), 3);
  assert.equal(rivalTeamSize(9), 3);
  assert.ok(rivalMemberHpMul(1, 1) > 1);
  assert.ok(rivalMemberHpMul(1, 2) > rivalMemberHpMul(1, 1));
  assert.ok(rivalMemberHpMul(5, 2) > rivalMemberHpMul(1, 2));
  // Con cualquier valor del azar (también los extremos) sale un título y un nombre de las listas
  for (const r of [0, 0.5, 0.999999]) {
    const [title, name] = rivalTrainerName(() => r).split(' ');
    assert.ok(RIVAL_TITLES.includes(title));
    assert.ok(RIVAL_NAMES.includes(name));
  }
});
