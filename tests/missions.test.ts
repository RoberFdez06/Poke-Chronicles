import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENTS,
  applyMissionEvent,
  DAILY_COUNT,
  dailyMissions,
  emptyMissions,
  isAchieved,
  LOCKED_ITEMS,
  lockedItems,
  parseMissions,
  rewardText,
} from '../src/data/missions.ts';
import { PASSIVE_ITEMS, passiveById, rollItem } from '../src/data/items.ts';
import { rollShop } from '../src/data/loot.ts';
import { loadMissions, loadTickets, loadUnlocked, MISSIONS_KEY, PROGRESS_KEYS, recordMission, type StorageLike } from '../src/data/save.ts';

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

test('las diarias son 3 distintas y las mismas durante todo el día', () => {
  for (let day = 20000; day < 20060; day++) {
    const a = dailyMissions(day);
    assert.equal(a.length, DAILY_COUNT);
    assert.equal(new Set(a.map((m) => m.id.split('-')[0])).size, DAILY_COUNT, `día ${day}`);
    assert.deepEqual(dailyMissions(day).map((m) => m.text), a.map((m) => m.text));
    for (const m of a) {
      assert.ok(m.goal >= 1 && m.reward.tickets > 0);
      assert.match(m.text, /^[A-ZÁÉÍÓÚ]/);
    }
  }
  // Cambian de un día a otro (al menos a veces)
  const texts = new Set(Array.from({ length: 10 }, (_, k) => dailyMissions(20000 + k).map((m) => m.text).join('|')));
  assert.ok(texts.size > 5);
});

test('el progreso de las diarias se suma, se topa y se completa una sola vez', () => {
  const day = 20100;
  const missions = dailyMissions(day);
  let state = emptyMissions(day);
  const done: string[] = [];
  // Muchos sucesos de todo tipo: al final todas las diarias quedan completas
  const events = [
    ...Array.from({ length: 60 }, () => ({ kind: 'defeat' as const, types: ['water', 'fire', 'grass', 'normal', 'bug', 'poison', 'flying', 'electric', 'ground', 'rock'] })),
    ...Array.from({ length: 5 }, () => ({ kind: 'chest' as const })),
    ...Array.from({ length: 5 }, () => ({ kind: 'boss' as const })),
    ...Array.from({ length: 20 }, () => ({ kind: 'room' as const })),
    ...Array.from({ length: 6 }, () => ({ kind: 'item' as const })),
    { kind: 'coins' as const, amount: 100 },
    { kind: 'floor' as const, floor: 3, healed: false },
  ];
  for (const e of events) {
    const r = applyMissionEvent(state, e, day);
    state = r.state;
    done.push(...r.completed.filter((c) => c.kind === 'daily').map((c) => c.id));
  }
  assert.deepEqual(done.sort(), missions.map((m) => m.id).sort());
  missions.forEach((m, k) => assert.equal(state.daily[k], m.goal));
});

test('llegar al piso curándote no cuenta para "sin curarte"', () => {
  const a = ACHIEVEMENTS.find((x) => x.id === 'intocable')!;
  let state = emptyMissions(1);
  state = applyMissionEvent(state, { kind: 'floor', floor: 5, healed: true }, 1).state;
  assert.equal(isAchieved(state, a.id), false);
  const r = applyMissionEvent(state, { kind: 'floor', floor: 3, healed: false }, 1);
  assert.ok(r.completed.some((c) => c.id === 'intocable'));
  assert.ok(isAchieved(r.state, 'intocable'));
});

test('al cambiar de día las diarias vuelven a cero, los logros no', () => {
  let state = emptyMissions(10);
  state = applyMissionEvent(state, { kind: 'boss' }, 10).state;
  assert.ok(isAchieved(state, 'primer-jefe'));
  const next = applyMissionEvent(state, { kind: 'room' }, 11).state;
  assert.equal(next.day, 11);
  assert.ok(isAchieved(next, 'primer-jefe'));
  assert.ok(next.daily.every((n) => n <= 1));
  // Un logro ya conseguido no se vuelve a completar
  assert.equal(applyMissionEvent(next, { kind: 'boss' }, 11).completed.filter((c) => c.id === 'primer-jefe').length, 0);
});

test('parseMissions: corrupto o de otro día', () => {
  assert.deepEqual(parseMissions(null, 5), emptyMissions(5));
  assert.deepEqual(parseMissions('{roto', 5), emptyMissions(5));
  const old = JSON.stringify({ v: 1, day: 4, daily: [3, 1, 2], achievements: { cazador: 50, falso: 3, cofres: -2 } });
  const s = parseMissions(old, 5);
  assert.deepEqual(s.daily, [0, 0, 0]);
  assert.deepEqual(s.achievements, { cazador: 50 });
  assert.deepEqual(parseMissions(old, 4).daily, [3, 1, 2]);
});

test('los objetos de los logros existen y no salen hasta conseguirlos', () => {
  assert.ok(LOCKED_ITEMS.length >= 3);
  for (const id of LOCKED_ITEMS) assert.ok(passiveById(id), id);
  const locked = lockedItems(emptyMissions(1));
  assert.deepEqual([...locked].sort(), [...LOCKED_ITEMS].sort());
  const pool = PASSIVE_ITEMS.filter((i) => !locked.has(i.id));
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 500; k++) {
    const it = rollItem(rng, new Set(), [], 0, [], pool);
    assert.ok(it.kind === 'passive' && !locked.has(it.item.id));
    const shop = rollShop(rng, new Set(), [], pool)[2].goods;
    assert.ok(shop.kind === 'passive' && !locked.has(shop.id));
  }
});

test('recordMission guarda, da tickets y desbloquea el Pokémon del logro', () => {
  const st = memory();
  const day = 30000;
  assert.equal(loadTickets(st), 0);
  const c = recordMission({ kind: 'floor', floor: 4, healed: true }, day, st);
  assert.ok(c.some((x) => x.id === 'explorador'));
  assert.ok(loadUnlocked(st).includes(133));
  assert.ok(loadTickets(st) >= 8);
  assert.ok(isAchieved(loadMissions(day, st), 'explorador'));
  assert.ok(PROGRESS_KEYS.includes(MISSIONS_KEY));
});

test('rewardText', () => {
  assert.equal(rewardText({ tickets: 5 }), '+5 tickets');
  assert.equal(rewardText({ tickets: 8, pokemon: 133, pokemonName: 'Eevee' }), '+8 tickets · desbloquea Eevee');
});
