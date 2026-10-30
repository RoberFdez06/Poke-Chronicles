import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newParry, parryCooldownLeft, parryOpen, parryReflectDamage, parryStun, PARRY_COOLDOWN_MS, PARRY_COUNTER_MS, PARRY_HIT_COOLDOWN_MS,
  PARRY_MISS_COOLDOWN_MS, PARRY_PERFECT_MS, PARRY_STUN_MS, PARRY_WARN_MS, PARRY_WINDOW_MS, pressParry, takeCounterCrit, threatLevel,
  timeToImpact, tryParry,
} from '../src/data/parry.ts';

test('la ventana es amplia (unos 0,4 s) y se ajusta en constantes', () => {
  assert.ok(PARRY_WINDOW_MS >= 350 && PARRY_WINDOW_MS <= 500);
  assert.ok(PARRY_PERFECT_MS > 0 && PARRY_PERFECT_MS < PARRY_WINDOW_MS);
  const s = newParry();
  assert.ok(pressParry(s, 1000));
  assert.ok(parryOpen(s, 1000 + PARRY_WINDOW_MS));
  assert.ok(tryParry(s, 1000 + PARRY_WINDOW_MS, 0));
  const t = newParry();
  pressParry(t, 1000);
  assert.equal(tryParry(t, 1000 + PARRY_WINDOW_MS + 1, 0), null);
  // Sin pulsar no hay parry
  assert.equal(tryParry(newParry(), 5000, 0), null);
  // Golpe antes de pulsar (reloj hacia atrás) no cuenta
  const u = newParry();
  pressParry(u, 1000);
  assert.equal(tryParry(u, 999, 0), null);
});

test('perfecto en la primera mitad de la ventana, normal en la segunda', () => {
  const a = newParry();
  pressParry(a, 0);
  assert.equal(tryParry(a, PARRY_PERFECT_MS, 0), 'perfect');
  const b = newParry();
  pressParry(b, 0);
  assert.equal(tryParry(b, PARRY_PERFECT_MS + 1, 0), 'normal');
  assert.equal(a.perfects, 1);
  assert.equal(b.perfects, 0);
  assert.equal(b.hits, 1);
});

test('una pulsación para un solo golpe; los ataques imparables no se bloquean ni la gastan', () => {
  const s = newParry();
  pressParry(s, 0);
  assert.equal(tryParry(s, 10, 0, true), null);
  assert.ok(tryParry(s, 20, 0));
  assert.equal(tryParry(s, 30, 0), null);
});

test('fallar solo tiene un enfriamiento corto; acertar deja volver a pulsar casi enseguida', () => {
  const s = newParry();
  assert.ok(pressParry(s, 0));
  assert.equal(PARRY_COOLDOWN_MS, PARRY_WINDOW_MS + PARRY_MISS_COOLDOWN_MS);
  assert.ok(PARRY_MISS_COOLDOWN_MS <= 400);
  assert.ok(!pressParry(s, PARRY_COOLDOWN_MS - 1));
  assert.equal(parryCooldownLeft(s, 0), 1);
  assert.equal(parryCooldownLeft(s, PARRY_COOLDOWN_MS), 0);
  assert.ok(pressParry(s, PARRY_COOLDOWN_MS));
  // Acierto: el enfriamiento pasa a ser muy corto
  const h = newParry();
  pressParry(h, 0);
  tryParry(h, 100, 0);
  assert.ok(!pressParry(h, 100 + PARRY_HIT_COOLDOWN_MS - 1));
  assert.ok(pressParry(h, 100 + PARRY_HIT_COOLDOWN_MS));
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
  pressParry(s, 500);
  tryParry(s, 510, 600);
  assert.equal(s.hits, 2);
  assert.ok(takeCounterCrit(s, 700));
  assert.ok(!takeCounterCrit(s, 701));
});

test('lo que devuelve: aturdimiento (más si es perfecto, poco a jefes) y reflejo con más daño', () => {
  assert.ok(parryStun('perfect', false) > parryStun('normal', false));
  assert.equal(parryStun('perfect', true), PARRY_STUN_MS.boss);
  assert.ok(parryReflectDamage('perfect', 10, 1) > parryReflectDamage('normal', 10, 1));
  assert.ok(parryReflectDamage('normal', 10, 1) > 10);
  // Nunca menos que tu disparo normal
  assert.equal(parryReflectDamage('normal', 1, 30), 30);
});

test('tiempo hasta el impacto y marca de aviso', () => {
  // A 300 px, acercándose a 1000 px/s, con alcance 20: llega en 280 ms
  assert.ok(Math.abs(timeToImpact(300, 0, -1000, 0, 20) - 280) < 1e-6);
  // Alejándose o quieto: nunca
  assert.equal(timeToImpact(300, 0, 1000, 0, 20), Infinity);
  assert.equal(timeToImpact(300, 0, 0, 0, 20), Infinity);
  // Pasa de largo (a 100 px de lado, alcance 20)
  assert.equal(timeToImpact(300, 100, -1000, 0, 20), Infinity);
  // Ya encima
  assert.equal(timeToImpact(5, 5, 0, 0, 20), 0);
  assert.equal(threatLevel(Infinity), 'none');
  assert.equal(threatLevel(PARRY_WARN_MS + 1), 'none');
  assert.equal(threatLevel(PARRY_WARN_MS), 'soon');
  assert.equal(threatLevel(PARRY_WINDOW_MS), 'now');
  assert.ok(PARRY_WARN_MS > PARRY_WINDOW_MS);
});
