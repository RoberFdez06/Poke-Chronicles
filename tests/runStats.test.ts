import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCounters, isCounters, MIN_ROOM_SECONDS, noteFloorTime, noteParry, notePickup, noteRoomTime, parseHistory } from '../src/data/runHistory.ts';

test('los contadores nuevos empiezan vacíos y suben de uno en uno', () => {
  const c = emptyCounters();
  noteParry(c);
  noteParry(c);
  notePickup(c);
  assert.deepEqual([c.parries, c.picked], [2, 1]);
  assert.equal(isCounters(c), true);
});

test('la sala más rápida se queda con el menor tiempo y no cuenta lo instantáneo', () => {
  const c = emptyCounters();
  noteRoomTime(c, 0.4); // tienda: se limpia al entrar
  assert.equal(c.fastestRoom, undefined);
  noteRoomTime(c, 40);
  noteRoomTime(c, 25.5);
  noteRoomTime(c, 60);
  assert.equal(c.fastestRoom, 25.5);
  noteRoomTime(c, MIN_ROOM_SECONDS - 0.1);
  assert.equal(c.fastestRoom, 25.5);
});

test('el tiempo por piso se va apuntando redondeado', () => {
  const c = emptyCounters();
  noteFloorTime(c, 130.4);
  noteFloorTime(c, 95.6);
  noteFloorTime(c, Number.NaN);
  assert.deepEqual(c.floorSeconds, [130, 96]);
});

test('las partidas guardadas antes de T62 siguen siendo válidas y los datos malos no', () => {
  assert.equal(isCounters({ seconds: 5, kills: 1, damage: 2, newRecord: false }), true);
  assert.equal(isCounters({ seconds: 5, kills: 1, damage: 2, newRecord: false, parries: -1 }), false);
  assert.equal(isCounters({ seconds: 5, kills: 1, damage: 2, newRecord: false, floorSeconds: [1, 'x'] }), false);
  const old = { endedAt: 1, starterId: 25, starterName: 'Pikachu', mode: 'normal', floor: 2, won: false, seconds: 9, kills: 3, damage: 4, items: [], tickets: 0, newRecord: false };
  const withStats = { ...old, parries: 3, picked: 2, fastestRoom: 12, floorSeconds: [60, 70] };
  assert.equal(parseHistory(JSON.stringify([old, withStats])).length, 2);
  assert.equal(parseHistory(JSON.stringify([{ ...old, floorSeconds: 'no' }])).length, 0);
});
