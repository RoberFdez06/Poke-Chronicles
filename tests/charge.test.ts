import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelCharge, chargedDamage, chargedShapeFor, chargeProgress, CHARGE_DAMAGE_MUL, CHARGE_MIN_MS, CHARGE_MS, isCharging, newCharge, stepCharge,
} from '../src/data/charge.ts';

test('a los 0,8 s sale el cargado', () => {
  const s = newCharge();
  assert.equal(stepCharge(s, true, 1000), 'nada');
  assert.equal(stepCharge(s, true, 1000 + CHARGE_MS - 1), 'nada');
  assert.equal(stepCharge(s, true, 1000 + CHARGE_MS), 'cargado');
});

test('soltar antes de tiempo dispara el normal', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  assert.equal(stepCharge(s, false, 300), 'normal');
  assert.equal(stepCharge(s, false, 400), 'nada');
});

test('mantener sin soltar no hace dos disparos, y soltar tras el cargado no añade un normal', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  let cargados = 0;
  for (let t = 0; t <= 5000; t += 16) if (stepCharge(s, true, t) === 'cargado') cargados++;
  assert.equal(cargados, 1);
  assert.equal(stepCharge(s, false, 5016), 'nada');
  // Nueva pulsación: vuelve a cargar
  stepCharge(s, true, 6000);
  assert.equal(stepCharge(s, true, 6000 + CHARGE_MS), 'cargado');
});

test('autodisparo (pulsar y soltar cada fotograma) solo da normales, uno por pulsación', () => {
  const s = newCharge();
  let normales = 0;
  let cargados = 0;
  for (let t = 0; t < 2000; t += 32) {
    const a = stepCharge(s, true, t);
    const b = stepCharge(s, false, t + 16);
    for (const x of [a, b]) {
      if (x === 'normal') normales++;
      if (x === 'cargado') cargados++;
    }
  }
  assert.equal(cargados, 0);
  assert.equal(normales, Math.ceil(2000 / 32));
});

test('cancelar (pausa o cambio de sala) no dispara y bloquea hasta soltar', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  cancelCharge(s);
  assert.equal(stepCharge(s, true, 5000), 'nada');
  assert.equal(stepCharge(s, false, 5100), 'nada');
  stepCharge(s, true, 6000);
  assert.equal(stepCharge(s, true, 6000 + CHARGE_MS), 'cargado');
});

test('progreso, frenado y daño según la carga', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  assert.equal(chargeProgress(s, CHARGE_MS / 2), 0.5);
  assert.ok(!isCharging(s, CHARGE_MIN_MS - 1));
  assert.ok(isCharging(s, CHARGE_MIN_MS));
  assert.equal(chargedDamage(10, 0.5), 10);
  assert.equal(chargedDamage(10, 1), 10 * CHARGE_DAMAGE_MUL);
  stepCharge(s, true, CHARGE_MS);
  assert.ok(!isCharging(s, CHARGE_MS + 10));
  assert.equal(chargeProgress(s, CHARGE_MS + 10), 0);
});

test('la forma cambia según el tipo y siempre atraviesa', () => {
  assert.ok(chargedShapeFor('fire').trail);
  assert.ok(chargedShapeFor('water').pushMul > 1);
  assert.ok(chargedShapeFor('electric').bounces > 0);
  for (const t of ['normal', 'fire', 'water', 'electric', 'desconocido']) {
    const f = chargedShapeFor(t);
    assert.ok(f.pierce > 0 && f.sizeMul > 1);
  }
});
