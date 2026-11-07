// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bossTicketsFor,
  minibossTicketsFor,
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
import { BOSS_BASE_TICKETS, BOSS_TICKETS, ROOM_TICKETS } from '../src/data/save.ts';

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

test('los tickets escalan con el piso: jefe 6 + 2 × piso, salas +1 cada dos pisos hasta +2 (economía 06/11)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 20].map(roomTicketsFor), [ROOM_TICKETS, ROOM_TICKETS, ROOM_TICKETS + 1, ROOM_TICKETS + 1, ROOM_TICKETS + 2, ROOM_TICKETS + 2, ROOM_TICKETS + 2]);
  assert.equal(bossTicketsFor(1), BOSS_BASE_TICKETS + BOSS_TICKETS);
  assert.deepEqual([1, 2, 3, 4, 5].map(bossTicketsFor), [8, 10, 12, 14, 16]);
  // La Torre (jefe cada 10 pisos) apenas cambia: 206 en el piso 100 (antes 200)
  assert.equal(bossTicketsFor(100), 206);
  assert.equal(minibossTicketsFor(2), ROOM_TICKETS * 2);
  assert.equal(minibossTicketsFor(5), (ROOM_TICKETS + 2) * 2);
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
