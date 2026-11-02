// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceLabel, edgePlacement, guideModeOn, knownRooms, lootMarks, roomAtPoint, roomRoute, separate, type GuideRoom,
} from '../src/data/guideArrows.ts';
import { generateFloor } from '../src/level/floorGen.ts';

// 0 - 1 - 2
//     |
//     3 - 4(jefe)
const ROOMS: GuideRoom[] = [
  { id: 0, gx: 0, gy: 0, doors: { right: 1 } },
  { id: 1, gx: 1, gy: 0, doors: { left: 0, right: 2, down: 3 } },
  { id: 2, gx: 2, gy: 0, doors: { left: 1 } },
  { id: 3, gx: 1, gy: 1, doors: { up: 1, right: 4 } },
  { id: 4, gx: 2, gy: 1, doors: { left: 3 } },
];

test('modos: todos menos la Defensa de torres', () => {
  for (const m of ['normal', 'waves', 'endless', 'bossrush', 'tower']) assert.equal(guideModeOn(m), true);
  assert.equal(guideModeOn('towerdef'), false);
});

test('salas conocidas: visitadas y vecinas, sin las ocultas', () => {
  assert.deepEqual([...knownRooms(ROOMS, [0], 0)].sort(), [0, 1]);
  assert.deepEqual([...knownRooms(ROOMS, [0, 1], 1)].sort(), [0, 1, 2, 3]);
  assert.deepEqual([...knownRooms(ROOMS, [0, 1], 1, new Set([3]))].sort(), [0, 1, 2]);
  assert.deepEqual([...knownRooms(ROOMS, [99], 0)].sort(), [0, 1]);
});

test('camino: primera puerta y salas que faltan', () => {
  assert.deepEqual(roomRoute(ROOMS, 0, 4), { kind: 'door', room: 0, dir: 'right', rooms: 3 });
  assert.deepEqual(roomRoute(ROOMS, 2, 4), { kind: 'door', room: 2, dir: 'left', rooms: 3 });
  assert.deepEqual(roomRoute(ROOMS, 1, 4), { kind: 'door', room: 1, dir: 'down', rooms: 2 });
  assert.deepEqual(roomRoute(ROOMS, 4, 4), { kind: 'here' });
});

test('camino: jefe sin descubrir en el mapa no se indica', () => {
  const known = knownRooms(ROOMS, [0, 1], 1);
  assert.equal(roomRoute(ROOMS, 0, 4, { known }).kind, 'none');
  const known2 = knownRooms(ROOMS, [0, 1, 3], 3);
  assert.equal(roomRoute(ROOMS, 0, 4, { known: known2 }).kind, 'door');
});

test('camino: no cruza puertas ocultas sin abrir', () => {
  assert.equal(roomRoute(ROOMS, 0, 4, { blocked: (r, d) => r === 1 && d === 'down' }).kind, 'none');
});

test('camino: una sala grande cuenta como una sola', () => {
  const big: GuideRoom[] = [
    { id: 0, gx: 0, gy: 0, doors: { right: 1 }, group: 0 },
    { id: 1, gx: 1, gy: 0, doors: { left: 0, right: 2 }, group: 0 },
    { id: 2, gx: 2, gy: 0, doors: { left: 1 } },
  ];
  assert.deepEqual(roomRoute(big, 1, 0), { kind: 'here' });
  assert.deepEqual(roomRoute(big, 0, 2), { kind: 'door', room: 1, dir: 'right', rooms: 1 });
  assert.deepEqual(roomRoute(big, 2, 0), { kind: 'door', room: 2, dir: 'left', rooms: 1 });
});

test('camino en pisos generados: siempre llega al jefe', () => {
  for (let seed = 1; seed < 40; seed++) {
    const f = generateFloor({ seed, special: true, extra: true, big: true });
    const r = roomRoute(f.rooms, f.startId, f.bossId);
    assert.ok(r.kind === 'door' || r.kind === 'here', `semilla ${seed}`);
    if (r.kind === 'door') assert.ok(f.rooms[r.room].doors[r.dir] !== undefined);
  }
});

const VIEW = { x: 240, y: 60, w: 1440, h: 960 };

test('borde: objetivo dentro de la vista no lleva flecha', () => {
  assert.equal(edgePlacement(VIEW, 900, 500, 40).onScreen, true);
  assert.equal(edgePlacement(VIEW, 2400, 500, 40).onScreen, false);
});

test('borde: la flecha va al borde por dentro y apunta al objetivo', () => {
  const r = edgePlacement(VIEW, 5000, 540, 40);
  assert.equal(Math.round(r.x), 240 + 1440 - 40);
  assert.equal(Math.round(r.y), 540);
  assert.equal(Math.round(r.angle * 100), 0);
  const u = edgePlacement(VIEW, 960, -3000, 40);
  assert.equal(Math.round(u.y), 60 + 40);
  assert.equal(Math.round(u.x), 960);
  const diag = edgePlacement(VIEW, 960 + 2000, 540 + 2000, 40);
  assert.ok(diag.y <= 60 + 960 - 40 + 1e-6 && diag.x <= 240 + 1440 - 40 + 1e-6);
  assert.ok(Math.abs(diag.angle - Math.PI / 4) < 1e-9);
});

test('borde: dos flechas en el mismo sitio se apartan', () => {
  const a = { x: 1640, y: 540 };
  const b = separate(a, { x: 1640, y: 545 }, 60, VIEW, 40);
  assert.equal(b.x, 1640);
  assert.ok(Math.abs(b.y - 540) >= 60);
  assert.deepEqual(separate(a, { x: 1640, y: 900 }, 60, VIEW, 40), { x: 1640, y: 900 });
});

test('sala bajo un punto del mundo', () => {
  assert.equal(roomAtPoint(ROOMS, 960 * 2 + 10, 640 + 10, 960, 640), 4);
  assert.equal(roomAtPoint(ROOMS, 10, 700, 960, 640), undefined);
});

test('marcas de objetos: solo salas vistas, sin repetir y en orden', () => {
  const things = [
    { roomId: 1, drop: { kind: 'coin' } },
    { roomId: 1, drop: { kind: 'bomb' } },
    { roomId: 1, drop: { kind: 'passive' } },
    { roomId: 2, drop: { kind: 'move' } },
    { roomId: 3, drop: { kind: 'key' } },
  ];
  const m = lootMarks(things, [2, 4], new Set([0, 1, 2]));
  assert.deepEqual(m.get(1), ['item', 'small']);
  assert.deepEqual(m.get(2), ['item', 'chest']);
  assert.equal(m.has(3), false);
  assert.equal(m.has(4), false);
  // Al cogerlo todo, la sala se queda sin marcas
  assert.equal(lootMarks([], [], new Set([1])).size, 0);
});

test('distancia en salas', () => {
  assert.equal(distanceLabel({ kind: 'door', room: 0, dir: 'up', rooms: 1 }), '1 sala');
  assert.equal(distanceLabel({ kind: 'door', room: 0, dir: 'up', rooms: 3 }), '3 salas');
  assert.equal(distanceLabel({ kind: 'here' }), '');
});
