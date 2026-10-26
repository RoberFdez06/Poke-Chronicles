import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelCharge, chargedDamage, chargedShapeFor, chargeProgress, CHARGE_DAMAGE_MUL, CHARGE_MIN_MS, CHARGE_MS, isCharging, newCharge, stepCharge,
} from '../src/data/charge.ts';

test('mantener carga sin disparar; soltar con la carga completa lanza el cargado', () => {
  const s = newCharge();
  assert.equal(stepCharge(s, true, 1000), 'nada');
  assert.equal(stepCharge(s, true, 1000 + CHARGE_MS + 500), 'nada');
  assert.equal(stepCharge(s, false, 1000 + CHARGE_MS + 516), 'cargado');
  assert.equal(stepCharge(s, false, 1000 + CHARGE_MS + 600), 'nada');
});

test('soltar antes de tiempo no dispara nada (el disparo normal no pasa por la carga)', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  assert.equal(stepCharge(s, true, CHARGE_MS - 1), 'nada');
  assert.equal(stepCharge(s, false, CHARGE_MS - 1), 'nada');
  assert.equal(stepCharge(s, false, CHARGE_MS + 100), 'nada');
});

test('mantener sin soltar da un solo cargado y una nueva pulsación vuelve a cargar', () => {
  const s = newCharge();
  let cargados = 0;
  for (let t = 0; t <= 5000; t += 16) if (stepCharge(s, true, t) === 'cargado') cargados++;
  assert.equal(cargados, 0);
  assert.equal(stepCharge(s, false, 5016), 'cargado');
  stepCharge(s, true, 6000);
  assert.equal(stepCharge(s, false, 6000 + CHARGE_MS), 'cargado');
});

test('pulsar y soltar cada fotograma (autodisparo) nunca da un cargado', () => {
  const s = newCharge();
  let cargados = 0;
  for (let t = 0; t < 2000; t += 32) {
    if (stepCharge(s, true, t) === 'cargado') cargados++;
    if (stepCharge(s, false, t + 16) === 'cargado') cargados++;
  }
  assert.equal(cargados, 0);
});

test('cada fuente carga sola (teclado, ratón y mando no se pisan)', () => {
  const a = newCharge();
  const b = newCharge();
  stepCharge(a, true, 0);
  stepCharge(b, true, 400);
  assert.equal(stepCharge(a, false, CHARGE_MS), 'cargado');
  assert.equal(stepCharge(b, false, CHARGE_MS), 'nada');
});

test('cancelar (pausa o cambio de sala) no lanza nada y bloquea hasta soltar', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  cancelCharge(s);
  assert.equal(stepCharge(s, true, 5000), 'nada');
  assert.equal(stepCharge(s, false, 5100), 'nada');
  stepCharge(s, true, 6000);
  assert.equal(stepCharge(s, false, 6000 + CHARGE_MS), 'cargado');
});

test('progreso, frenado y daño según la carga', () => {
  const s = newCharge();
  stepCharge(s, true, 0);
  assert.equal(chargeProgress(s, CHARGE_MS / 2), 0.5);
  assert.ok(!isCharging(s, CHARGE_MIN_MS - 1));
  assert.ok(isCharging(s, CHARGE_MIN_MS));
  assert.equal(chargedDamage(10, 0.5), 10);
  assert.equal(chargedDamage(10, 1), 10 * CHARGE_DAMAGE_MUL);
  assert.equal(chargeProgress(s, CHARGE_MS * 3), 1);
  stepCharge(s, false, CHARGE_MS);
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
