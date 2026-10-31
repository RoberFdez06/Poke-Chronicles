// Reanudar un piso: con los parámetros guardados se regenera idéntico (bug del minimapa con salas fantasma).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFloor, recoverRoomBase, type Floor } from '../src/level/floorGen.ts';

const shape = (f: Floor) => JSON.stringify({ rooms: f.rooms, groups: f.groups, hidden: f.hiddenDoors, boss: f.bossId, chests: f.chestRooms });
const optsFor = (layout: number, seed: number) => ({ seed, special: layout >= 2, extra: layout >= 3, big: layout >= 4, bossArena: true });

test('con el número base guardado el piso se regenera idéntico (diseños 1 a 4)', () => {
  for (const layout of [1, 2, 3, 4]) {
    for (let i = 0; i < 60; i++) {
      const opts = optsFor(layout, i * 104729 + 17);
      const base = 8 + (i % 7);
      const a = generateFloor({ ...opts, roomCount: base });
      const b = generateFloor({ ...opts, roomCount: base });
      assert.equal(shape(a), shape(b));
    }
  }
});

test('el bug: regenerar con las salas totales (lo que se guardaba antes) da otro piso en el diseño 4', () => {
  let differs = 0;
  for (let i = 0; i < 60; i++) {
    const opts = optsFor(4, i * 7919 + 3);
    const a = generateFloor({ ...opts, roomCount: 10 });
    if (a.rooms.length === 10) continue;
    if (shape(generateFloor({ ...opts, roomCount: a.rooms.length })) !== shape(a)) differs++;
  }
  assert.ok(differs > 0);
});

test('recoverRoomBase recupera un número base que regenera el mismo piso desde un guardado viejo', () => {
  let same = 0;
  let total = 0;
  for (const layout of [2, 3, 4]) {
    for (let i = 0; i < 40; i++) {
      const opts = optsFor(layout, i * 31337 + 5);
      const base = 8 + (i % 6);
      const a = generateFloor({ ...opts, roomCount: base });
      const n = recoverRoomBase(opts, a.rooms.length);
      const b = generateFloor({ ...opts, roomCount: n });
      assert.equal(b.rooms.length, a.rooms.length);
      total++;
      if (shape(a) === shape(b)) same++;
    }
  }
  // Casi siempre sale el mismo piso (solo puede fallar si dos números base dan las mismas salas totales)
  assert.ok(same / total > 0.9, `${same}/${total}`);
});

test('en las salas grandes todas las casillas del grupo existen y se apuntan entre sí', () => {
  for (let i = 0; i < 80; i++) {
    const f = generateFloor({ ...optsFor(4, i * 977 + 1), roomCount: 11 });
    (f.groups ?? []).forEach((g, gi) => {
      for (const id of g) {
        assert.ok(f.rooms[id]);
        assert.equal(f.rooms[id].group, gi);
      }
    });
  }
});
