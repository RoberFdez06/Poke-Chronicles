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
