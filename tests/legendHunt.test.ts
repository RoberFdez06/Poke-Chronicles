import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES } from '../src/level/biomes.ts';
import {
  canCaptureLegend, clueOnFloor, finishLair, huntChance, huntComplete, huntText, HUNT, lairOnFloor, leaveFloor, legendCaptureChance,
  legendPhase, nextClueFloor, noHunt, rollHunt, takeClue,
} from '../src/data/legendHunt.ts';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
const bosque = BIOMES.find((b) => b.id === 'bosque')!;
const torre = BIOMES.find((b) => b.id === 'torre') ?? bosque;

test('T88: sin suerte no hay cacería', () => {
  assert.equal(rollHunt(() => 0.99, bosque, [150], [], 30).active, false);
});

test('T88: el bioma sube la probabilidad', () => {
  assert.ok(huntChance(torre.id) >= huntChance('bosque'));
  assert.equal(huntChance('inexistente'), HUNT.baseChance);
});

test('T88: pistas en pisos crecientes y legendario del pool', () => {
  const h = rollHunt(seq([0, 0.5, 0.2, 0.9, 0.1]), bosque, [150, 249], [], 30);
  assert.equal(h.active, true);
  assert.equal(h.floors.length, HUNT.clues);
  for (let i = 1; i < h.floors.length; i++) assert.ok(h.floors[i] > h.floors[i - 1]);
  assert.ok(h.floors[0] >= HUNT.firstFloor);
  assert.ok([150, 249].includes(h.legendId));
});

test('T88: si no caben antes del final, no hay cacería', () => {
  assert.equal(rollHunt(() => 0, bosque, [150], [], 3).active, false);
});

test('T88: seguir todas las pistas abre la sala', () => {
  let h = { ...noHunt(), active: true, floors: [2, 3, 5], kinds: ['huella', 'ruido', 'pluma'] as const as any, legendId: 150 };
  assert.equal(huntText(h), 'Rastro legendario 0/3');
  assert.equal(clueOnFloor(h, 3), false);
  h = takeClue(h, 2); h = leaveFloor(h, 2);
  h = takeClue(h, 3);
  assert.equal(nextClueFloor(h), 5);
  h = takeClue(h, 5);
  assert.equal(huntComplete(h), true);
  assert.equal(lairOnFloor(h, 5), false);
  assert.equal(lairOnFloor(h, 6), true);
  h = finishLair(h);
  assert.equal(lairOnFloor(h, 7), false);
});

test('T88: saltarse una pista pierde el rastro', () => {
  let h = { ...noHunt(), active: true, floors: [2, 3, 5], kinds: [] as any, legendId: 150 };
  h = leaveFloor(h, 2);
  assert.equal(h.lost, true);
  assert.equal(nextClueFloor(h), null);
  assert.equal(takeClue(h, 3).found, 0);
  assert.equal(huntText(h), 'Has perdido el rastro');
});

test('T88: fases y captura más difícil', () => {
  assert.equal(legendPhase(100, 100), 0);
  assert.equal(legendPhase(50, 100), 1);
  assert.equal(legendPhase(20, 100), 2);
  assert.equal(canCaptureLegend(20, 100), false);
  assert.equal(canCaptureLegend(15, 100), true);
  assert.equal(canCaptureLegend(0, 100), false);
  assert.ok(legendCaptureChance(1, 100) > legendCaptureChance(15, 100));
  assert.ok(legendCaptureChance(15, 100) >= 0.1 - 1e-9 && legendCaptureChance(1, 100) <= 0.5);
});
