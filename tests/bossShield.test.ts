// Ejecutar con `npm test`. Escudo de jefe al 33 % de vida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bossShieldAbsorb, bossShieldAmount, grantBossShield, shouldGrantBossShield } from '../src/data/bossShield.ts';
import { clampBossHp, pendingThresholds } from '../src/data/bossThreshold.ts';

test('cantidad: 33 % de la vida máxima, ajustada por dificultad', () => {
  assert.equal(bossShieldAmount(1000), 330);
  assert.equal(bossShieldAmount(1000, 'easy'), 231);
  assert.equal(bossShieldAmount(1000, 'hard'), 429);
  assert.equal(bossShieldAmount(1), 1);
});

test('se concede al bajar a 33 % o menos, una sola vez', () => {
  assert.equal(shouldGrantBossShield(400, 1000, false), false);
  assert.equal(shouldGrantBossShield(330, 1000, false), true);
  assert.equal(shouldGrantBossShield(100, 1000, false), true);
  assert.equal(shouldGrantBossShield(100, 1000, true), false);
  assert.equal(shouldGrantBossShield(0, 1000, false), false);
});

test('espera a la caída de arena del 34 % pero no a umbrales por debajo', () => {
  assert.equal(shouldGrantBossShield(330, 1000, false, [0.34]), false);
  assert.equal(shouldGrantBossShield(330, 1000, false, []), true);
  assert.equal(shouldGrantBossShield(330, 1000, false, [0.25]), true);
});

test('con el tope de umbral: tras la caída (34 %) la vida queda ≤ 33 % y se concede', () => {
  const st = { arena: true, arenaDone: 1 as const, mega: true, megaDone: true, phase1: false };
  const r = clampBossHp(500, 99999, 100, pendingThresholds(st));
  assert.equal(r.clamped, true);
  assert.equal(shouldGrantBossShield(r.hp, 100, false, pendingThresholds(st)), false);
  const done = { ...st, arenaDone: 2 as const };
  assert.equal(shouldGrantBossShield(r.hp, 100, false, pendingThresholds(done)), true);
});

test('absorción: el escudo se come el daño antes que la vida y nunca deja inmortal', () => {
  const g = grantBossShield(undefined, undefined, 330);
  assert.deepEqual(g, { shield: 330, shieldMax: 330 });
  let r = bossShieldAbsorb(g.shield, 100);
  assert.deepEqual(r, { absorbed: 100, through: 0, left: 230 });
  r = bossShieldAbsorb(r.left, 1000);
  assert.equal(r.through, 770);
  assert.equal(r.left, 0);
  r = bossShieldAbsorb(0, 50);
  assert.equal(r.through, 50);
});

test('suma al escudo previo (jefe Escudado)', () => {
  assert.deepEqual(grantBossShield(40, 100, 330), { shield: 370, shieldMax: 430 });
});
