// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bossTicketsFor,
  bossPool,
  difficultyFor,
  pickBoss,
  roomTicketsFor,
  roomCountFor,
  FALLBACK_BOSSES,
  FLOOR_COUNT,
  MAX_ROOMS,
} from '../src/level/progression.ts';
import { generateFloor, mulberry32 } from '../src/level/floorGen.ts';
import { BOSS_TICKETS, ROOM_TICKETS } from '../src/data/save.ts';

test('cada piso tiene más salas y nunca pasa del máximo', () => {
  assert.equal(roomCountFor(1, () => 0), 8);
  assert.equal(roomCountFor(1, () => 0.999), 12);
  assert.ok(roomCountFor(3, () => 0) > roomCountFor(1, () => 0));
  assert.equal(roomCountFor(50, () => 0.999), MAX_ROOMS);
});

test('los pisos más grandes se pueden generar', () => {
  for (let floor = 1; floor <= FLOOR_COUNT + 5; floor++) {
    const rng = mulberry32(floor);
    const n = roomCountFor(floor, rng);
    const f = generateFloor({ seed: floor * 77, roomCount: n });
    assert.equal(f.rooms.length, n);
  }
});

test('la dificultad sube con el piso', () => {
  const a = difficultyFor(1);
  const b = difficultyFor(3);
  assert.deepEqual([a.hp, a.damage, a.speed], [1, 1, 1]);
  assert.deepEqual(a.enemies, [3, 5]);
  assert.ok(b.hp > a.hp && b.damage > a.damage && b.speed > a.speed);
  assert.ok(b.enemies[0] > a.enemies[0]);
  assert.ok(difficultyFor(100).speed <= 1.6);
});

test('los tickets escalan con el piso', () => {
  assert.equal(roomTicketsFor(1), ROOM_TICKETS);
  assert.equal(bossTicketsFor(1), BOSS_TICKETS);
  assert.equal(roomTicketsFor(3), ROOM_TICKETS + 10);
  assert.equal(bossTicketsFor(3), BOSS_TICKETS * 3);
});

test('el jefe siempre es legendario o singular', () => {
  const index = [
    { id: 1, legendary: false, mythical: false },
    { id: 150, legendary: true, mythical: false },
    { id: 151, legendary: false, mythical: true },
  ];
  assert.deepEqual(bossPool(index), [150, 151]);
  assert.deepEqual(bossPool([]), [...FALLBACK_BOSSES]);
  for (let i = 0; i < 20; i++) assert.ok([150, 151].includes(pickBoss(bossPool(index), Math.random)));
});

test('no repite jefe mientras queden otros', () => {
  assert.equal(pickBoss([150, 151], () => 0, [150]), 151);
  // Si ya han salido todos, vuelve a valer cualquiera
  assert.ok([150, 151].includes(pickBoss([150, 151], () => 0.5, [150, 151])));
});
