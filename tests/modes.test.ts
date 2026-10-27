// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
  RUN_MODES,
  isRunMode,
  arenaFloor,
  emptyRecords,
  isLastStage,
  isMode,
  modeDesc,
  parseRecords,
  progressText,
  recordText,
  waveDropsItem,
  waveSpec,
  withRecord,
} from '../src/data/modes.ts';
import { loadRecords, submitRecord, RECORDS_KEY, type StorageLike } from '../src/data/save.ts';
import { FLOOR_COUNT } from '../src/level/progression.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('hay seis modos con nombre y descripción (la Defensa de torres va en su escena)', () => {
  assert.deepEqual([...MODES], ['normal', 'waves', 'endless', 'bossrush', 'tower', 'towerdef']);
  assert.deepEqual([...RUN_MODES], ['normal', 'waves', 'endless', 'bossrush', 'tower']);
  assert.ok(isRunMode('tower') && !isRunMode('towerdef') && isMode('towerdef'));
  for (const m of MODES) assert.ok(modeDesc(m).length > 10);
  assert.ok(isMode('waves'));
  assert.ok(!isMode('otro'));
  assert.ok(!isMode(3));
});

test('solo el modo Normal tiene final', () => {
  assert.ok(isLastStage('normal', FLOOR_COUNT));
  assert.ok(!isLastStage('normal', FLOOR_COUNT - 1));
  for (const m of ['waves', 'endless', 'bossrush'] as const) assert.ok(!isLastStage(m, 999));
  assert.equal(progressText('normal', 2), `Piso 2/${FLOOR_COUNT}`);
  assert.equal(progressText('waves', 7), 'Ronda 7');
  assert.equal(progressText('bossrush', 3), 'Jefe 3');
});

test('las oleadas se endurecen y dan objeto cada 3 rondas', () => {
  assert.deepEqual(waveSpec(1), { level: 1, count: 3 });
  assert.equal(waveSpec(4).level, 2);
  assert.ok(waveSpec(10).count > waveSpec(1).count);
  assert.ok(waveSpec(1000).count <= 12);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(waveDropsItem), [false, false, true, false, false, true]);
  assert.ok(!waveDropsItem(0));
});

test('la arena de oleadas es una sola sala sin puertas', () => {
  const f = arenaFloor(5, 'combat');
  assert.equal(f.rooms.length, 1);
  assert.deepEqual(f.rooms[0].doors, {});
});

test('la arena de jefe (Rush, reto final) es una sala grande de 4 a 9 casillas', () => {
  const sizes = new Set<number>();
  for (let seed = 1; seed < 60; seed++) {
    const f = arenaFloor(seed, 'boss');
    assert.ok(f.rooms.length >= 4 && f.rooms.length <= 9);
    assert.ok(f.rooms.every((r) => r.kind === 'boss' && r.group === 0));
    assert.equal(f.groups?.[0].length, f.rooms.length);
    assert.equal(f.bossId, 0);
    assert.equal(f.startId, 0);
    sizes.add(f.rooms.length);
  }
  assert.ok(sizes.size > 1, 'varía con la semilla');
});

test('los récords solo suben y se leen aunque estén corruptos', () => {
  assert.deepEqual(parseRecords(null), emptyRecords());
  assert.deepEqual(parseRecords('{'), emptyRecords());
  assert.deepEqual(parseRecords('{"waves": 4, "normal": -2, "otro": 9, "endless": 1.5}'), { ...emptyRecords(), waves: 4 });
  const a = withRecord(emptyRecords(), 'waves', 5);
  assert.ok(a.improved);
  assert.equal(a.records.waves, 5);
  const b = withRecord(a.records, 'waves', 3);
  assert.ok(!b.improved);
  assert.equal(b.records.waves, 5);
});

test('los récords se guardan en save.ts', () => {
  const s = fakeStorage();
  assert.deepEqual(loadRecords(s), emptyRecords());
  assert.equal(submitRecord('bossrush', 2, s), true);
  assert.equal(submitRecord('bossrush', 1, s), false);
  assert.equal(loadRecords(s).bossrush, 2);
  assert.ok(s.data.has(RECORDS_KEY));
  assert.deepEqual(loadRecords(null), emptyRecords());
});

test('texto del récord', () => {
  assert.equal(recordText('waves', 0), 'Sin récord');
  assert.equal(recordText('waves', 1), 'Récord: 1 ronda');
  assert.equal(recordText('bossrush', 3), 'Récord: 3 jefes');
  assert.equal(recordText('normal', FLOOR_COUNT), 'Récord: ¡completado!');
  assert.equal(recordText('endless', 2), 'Récord: 2 pisos');
});
