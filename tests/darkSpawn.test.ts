// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DARK_SPAWN, darkBossEnrages, darkRoomCap, darkSpawnChance, darkWarning, decideDark, eyeFacing, eyeSpots,
} from '../src/data/darkMon.ts';
import { adminNextDarkPending, clearCheatRun, isCheatRun, setAdminNextDark, takeAdminNextDark } from '../src/data/admin.ts';
import { addDark, addDarkSeen, DARK_SEEN_KEY, loadDarkSeen, PROGRESS_KEYS, type StorageLike } from '../src/data/save.ts';

const fake = (): StorageLike => {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
};

test('oscuros en salas: nunca en el piso 1, suben con el piso y tienen tope', () => {
  for (const who of ['enemy', 'miniboss', 'boss'] as const) {
    assert.equal(darkSpawnChance(who, 1), 0);
    assert.equal(darkSpawnChance(who, 2), DARK_SPAWN[who].min);
    assert.ok(darkSpawnChance(who, 5) > darkSpawnChance(who, 2));
    assert.equal(darkSpawnChance(who, 999), DARK_SPAWN[who].max);
    assert.ok(darkSpawnChance(who, 6, 'hard') > darkSpawnChance(who, 6) && darkSpawnChance(who, 6, 'easy') < darkSpawnChance(who, 6));
  }
  assert.ok(darkSpawnChance('enemy', 2) >= 0.04 && darkSpawnChance('enemy', 99) <= 0.12);
  assert.ok(darkSpawnChance('miniboss', 2) >= 0.2 && darkSpawnChance('miniboss', 99) <= 0.35);
  assert.ok(darkSpawnChance('boss', 2) >= 0.15 && darkSpawnChance('boss', 99) <= 0.3);
});

test('oscuros en salas: tope por sala y forzado', () => {
  assert.equal(darkRoomCap(3), 1);
  assert.equal(darkRoomCap(6), 2);
  const yes = () => 0;
  assert.equal(decideDark({ who: 'enemy', floor: 5, inRoom: 0, rng: yes }), true);
  assert.equal(decideDark({ who: 'enemy', floor: 5, inRoom: 1, rng: yes }), false);
  assert.equal(decideDark({ who: 'enemy', floor: 8, inRoom: 1, rng: yes }), true);
  assert.equal(decideDark({ who: 'boss', floor: 1, rng: yes }), false);
  assert.equal(decideDark({ who: 'boss', floor: 1, forced: true, rng: () => 1 }), true);
  assert.match(darkWarning('enemy'), /¡Un Pokémon oscuro!/);
});

test('jefe oscuro: se enfurece una vez a media vida', () => {
  assert.equal(darkBossEnrages(60, 100, false), false);
  assert.equal(darkBossEnrages(50, 100, false), true);
  assert.equal(darkBossEnrages(30, 100, true), false);
  assert.equal(darkBossEnrages(0, 100, false), false);
});

test('ojos rojos: arriba de la figura, siguen la orientación y no salen de espaldas', () => {
  const box = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.9 };
  const f = eyeSpots(box, 0, false)!;
  assert.ok(f.y > 0.1 && f.y < 0.4);
  assert.equal(f.xs.length, 2);
  assert.ok(Math.abs((f.xs[0] + f.xs[1]) / 2 - 0.5) < 1e-9);
  const r = eyeSpots(box, 1, false)!;
  assert.ok(r.xs[0] > f.xs[0]);
  assert.equal(eyeSpots(box, 0, true), null);
  assert.deepEqual(eyeFacing({ pmdRow: 4 }), { face: 0, back: true });
  assert.deepEqual(eyeFacing({ pmdRow: 2 }), { face: 1, back: false });
  assert.deepEqual(eyeFacing({ pmdRow: 6 }), { face: -1, back: false });
  assert.deepEqual(eyeFacing({ facing: 'up' }), { face: 0, back: true });
  assert.deepEqual(eyeFacing({ facing: 'left' }), { face: -1, back: false });
});

test('admin: forzar el siguiente oscuro se consume una vez y marca la partida', () => {
  clearCheatRun();
  setAdminNextDark(true);
  assert.equal(adminNextDarkPending(), true);
  assert.equal(isCheatRun(), true);
  assert.equal(takeAdminNextDark(), true);
  assert.equal(takeAdminNextDark(), false);
  clearCheatRun();
});

test('oscuros descubiertos: se apuntan sin repetir, la captura cuenta y es progreso', () => {
  const st = fake();
  assert.equal(addDarkSeen(25, st), true);
  assert.equal(addDarkSeen(25, st), false);
  addDark(150, st);
  assert.deepEqual(loadDarkSeen(st), [25, 150]);
  assert.ok(PROGRESS_KEYS.includes(DARK_SEEN_KEY));
});
