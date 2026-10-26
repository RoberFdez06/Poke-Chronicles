import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCapture, canThrow, captureChance, CAPTURE_RETRY_MS, isCapturableKind, newCaptureState, nextFloorCapture, resolveThrow, rollCapture,
} from '../src/data/capture.ts';

test('T65: solo enemigos normales se pueden capturar', () => {
  const base = { hp: 10, maxHp: 100 };
  assert.equal(canCapture(base), true);
  for (const k of ['boss', 'miniboss', 'elite', 'legendary', 'helper', 'shinyBoss', 'special'] as const) {
    assert.equal(isCapturableKind({ ...base, [k]: true }), false, k);
  }
});

test('T65: hace falta 25 % de PS o menos y seguir vivo', () => {
  assert.equal(canCapture({ hp: 25, maxHp: 100 }), true);
  assert.equal(canCapture({ hp: 26, maxHp: 100 }), false);
  assert.equal(canCapture({ hp: 0, maxHp: 100 }), false);
});

test('T65: menos PS, más probabilidad', () => {
  assert.ok(captureChance(1, 100) > captureChance(20, 100));
  assert.ok(Math.abs(captureChance(25, 100) - 0.3) < 1e-9);
  assert.ok(captureChance(1, 100) <= 0.9);
  assert.equal(captureChance(50, 100), 0);
  assert.equal(rollCapture(1, 100, 0.5), true);
  assert.equal(rollCapture(25, 100, 0.5), false);
});

test('T65: un fallo no gasta la captura pero hay 3 s de espera', () => {
  const s0 = newCaptureState();
  assert.equal(canThrow(s0, 0), 'ok');
  const r = resolveThrow(s0, 1000, false, 0, 25);
  assert.equal(r.allyId, 0);
  assert.equal(r.state.done, false);
  assert.equal(canThrow(r.state, 1000 + CAPTURE_RETRY_MS - 1), 'cooldown');
  assert.equal(canThrow(r.state, 1000 + CAPTURE_RETRY_MS), 'ok');
});

test('T65: un solo éxito por piso; el capturado es el aliado hasta cambiar de piso', () => {
  const r = resolveThrow(newCaptureState(), 0, true, 7, 25);
  assert.equal(r.allyId, 25);
  assert.equal(canThrow(r.state, 99999), 'done');
  // Al cambiar de piso vuelve el ayudante del huevo y se puede capturar otra vez
  const n = nextFloorCapture(r.state, r.allyId);
  assert.equal(n.allyId, 7);
  assert.equal(canThrow(n.state, 0), 'ok');
  // Sin capturar, el ayudante del huevo sigue
  assert.equal(nextFloorCapture(newCaptureState(), 7).allyId, 7);
});
