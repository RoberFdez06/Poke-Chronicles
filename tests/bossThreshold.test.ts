// Ejecutar con `npm test`. Tope de umbral de los jefes: sin instakill, cada suceso de vida sale con su pausa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP_RELEASE_MS, clampBossHp, nextThreshold, pendingThresholds, thresholdCap, trackHold, type BossThresholdState } from '../src/data/bossThreshold.ts';

const fresh: BossThresholdState = { arena: true, arenaDone: 0, mega: true, megaDone: false, phase1: true };

test('golpe enorme desde el 100 % deja al jefe justo bajo el 67 %', () => {
  const r = clampBossHp(1000, 99999, 1000, pendingThresholds(fresh));
  assert.equal(r.clamped, true);
  assert.equal(r.threshold, 0.67);
  assert.ok(r.hp / 1000 < 0.67 && r.hp > 0.66 * 1000);
});

test('tras cada suceso el siguiente tope es 50 % y luego 34 %; nunca 0 hasta el final', () => {
  assert.equal(nextThreshold(fresh), 0.67);
  const s1 = { ...fresh, arenaDone: 1 as const };
  assert.equal(nextThreshold(s1), 0.5);
  const r1 = clampBossHp(660, 99999, 1000, pendingThresholds(s1));
  assert.ok(r1.hp > 0 && r1.hp < 500);
  const s2 = { ...s1, megaDone: true, phase1: false };
  assert.equal(nextThreshold(s2), 0.34);
  const r2 = clampBossHp(499, 99999, 1000, pendingThresholds(s2));
  assert.ok(r2.hp > 0 && r2.hp < 340);
  const s3 = { ...s2, arenaDone: 2 as const };
  assert.equal(nextThreshold(s3), undefined);
  assert.ok(clampBossHp(339, 99999, 1000, pendingThresholds(s3)).hp <= 0);
});

test('golpes normales no se tocan y sin arena el primer tope es el 50 %', () => {
  assert.deepEqual(clampBossHp(1000, 10, 1000, [0.67]), { hp: 990, clamped: false });
  assert.equal(nextThreshold({ ...fresh, arena: false }), 0.5);
});

test('ya por debajo del umbral pendiente no baja más hasta que sale el suceso', () => {
  assert.equal(clampBossHp(600, 50, 1000, [0.67]).hp, 600);
});

test('tope con poca vida máxima: nunca 0 y por debajo del umbral', () => {
  assert.equal(thresholdCap(3, 0.34), 1);
  assert.ok(thresholdCap(7, 0.5) / 7 < 0.5);
});

test('reto final gigante: umbrales 75/50/25 según la fase', () => {
  assert.deepEqual(pendingThresholds({ ...fresh, finalePhase: 1 }), [0.75, 0.5, 0.25]);
  assert.deepEqual(pendingThresholds({ ...fresh, finalePhase: 3 }), [0.25]);
  assert.deepEqual(pendingThresholds({ ...fresh, finalePhase: 4 }), []);
});

test('seguro: el tope se suelta a los 3 s y el umbral consumido deja de contar', () => {
  let h = trackHold(undefined, 0.67, 0);
  assert.equal(h.release, false);
  h = trackHold(h.hold, 0.67, CAP_RELEASE_MS - 1);
  assert.equal(h.release, false);
  h = trackHold(h.hold, 0.67, CAP_RELEASE_MS);
  assert.equal(h.release, true);
  assert.equal(nextThreshold({ ...fresh, skipped: [0.67] }), 0.5);
  // Esperando a un suceso en marcha la cuenta no llega a soltarse de golpe
  const w = trackHold({ t: 0.5, since: 0 }, 0.5, 10000, true);
  assert.equal(w.release, false);
  assert.ok(trackHold(w.hold, 0.5, 10000 + CAP_RELEASE_MS / 2).release);
});
