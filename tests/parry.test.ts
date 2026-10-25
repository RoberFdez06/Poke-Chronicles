import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newParry, parryCooldownLeft, PARRY_COOLDOWN_MS, PARRY_COUNTER_MS, PARRY_WINDOW_MS, pressParry, takeCounterCrit, tryParry,
} from '../src/data/parry.ts';

test('pulsar justo antes del golpe lo bloquea; tarde, no', () => {
  const s = newParry();
  assert.ok(pressParry(s, 1000));
  assert.ok(tryParry(s, 1000 + PARRY_WINDOW_MS, 0));
  const t = newParry();
  pressParry(t, 1000);
  assert.ok(!tryParry(t, 1000 + PARRY_WINDOW_MS + 1, 0));
  // Sin pulsar no hay nada que bloquear
  assert.ok(!tryParry(newParry(), 5000, 0));
});

test('una pulsación bloquea un solo golpe', () => {
  const s = newParry();
  pressParry(s, 0);
  assert.ok(tryParry(s, 50, 0));
  assert.ok(!tryParry(s, 60, 0));
  assert.equal(s.hits, 1);
});

test('los ataques inbloqueables no se paran', () => {
  const s = newParry();
  pressParry(s, 0);
  assert.ok(!tryParry(s, 10, 0, true));
  // La pulsación sigue viva para un golpe normal dentro de la ventana
  assert.ok(tryParry(s, 20, 0));
});

test('recarga de medio segundo, acierte o no', () => {
  const s = newParry();
  assert.ok(pressParry(s, 0));
  assert.ok(!pressParry(s, PARRY_COOLDOWN_MS - 1));
  assert.equal(parryCooldownLeft(s, 0), 1);
  assert.equal(parryCooldownLeft(s, PARRY_COOLDOWN_MS), 0);
  assert.ok(pressParry(s, PARRY_COOLDOWN_MS));
});

test('tras el parry el siguiente golpe es crítico seguro, solo uno y dentro de su plazo', () => {
  const s = newParry();
  pressParry(s, 0);
  tryParry(s, 10, 100);
  assert.ok(takeCounterCrit(s, 100 + PARRY_COUNTER_MS - 1));
  assert.ok(!takeCounterCrit(s, 100 + PARRY_COUNTER_MS - 1));
  const late = newParry();
  pressParry(late, 0);
  tryParry(late, 10, 100);
  assert.ok(!takeCounterCrit(late, 100 + PARRY_COUNTER_MS));
});

test('dos parrys seguidos no apilan críticos', () => {
  const s = newParry();
  pressParry(s, 0);
  tryParry(s, 10, 0);
  pressParry(s, PARRY_COOLDOWN_MS);
  tryParry(s, PARRY_COOLDOWN_MS + 10, 600);
  assert.equal(s.hits, 2);
  assert.ok(takeCounterCrit(s, 700));
  assert.ok(!takeCounterCrit(s, 701));
});
