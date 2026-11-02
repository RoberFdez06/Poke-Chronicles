// Ejecutar con `npm test`. Tope de umbral del trío del reto final (barra compartida): sin instakill a Arceus y sus aliados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP_RELEASE_MS, clampSharedHp, finalePending, thresholdCap, trackHold } from '../src/data/bossThreshold.ts';
import { nextFinalePhase, type FinalePhase } from '../src/data/finalePhases.ts';

test('umbrales pendientes del trío por fase', () => {
  assert.deepEqual(finalePending(1), [0.75, 0.5, 0.25]);
  assert.deepEqual(finalePending(3), [0.25]);
  assert.deepEqual(finalePending(4), []);
  assert.deepEqual(finalePending(2, [0.5]), [0.25]);
});

test('golpe enorme a un miembro deja la barra justo bajo el 75 % y nadie muere', () => {
  const hps = [1200, 900, 900];
  const max = 3000;
  const r = clampSharedHp(hps[0], 999999, 3000, max, finalePending(1));
  assert.equal(r.clamped, true);
  assert.equal(r.shared, true);
  assert.equal(r.threshold, 0.75);
  const sum = r.hp + 1800;
  assert.equal(sum, thresholdCap(max, 0.75));
  assert.ok(r.hp > 0);
  assert.equal(nextFinalePhase(1, sum / max), 2);
});

test('un miembro bajo no cae de un golpe aunque la barra tenga margen (mínimo 1, no cuenta para el seguro)', () => {
  const r = clampSharedHp(50, 999999, 2800, 3000, finalePending(1));
  assert.equal(r.hp, 1);
  assert.equal(r.shared, false);
  assert.equal(r.threshold, undefined);
});

test('fase 4: daño normal, pueden caer', () => {
  const r = clampSharedHp(300, 999999, 600, 3000, finalePending(4));
  assert.equal(r.clamped, false);
  assert.ok(r.hp <= 0);
});

test('bossBigHit repetido pasa por las cuatro fases en orden (simulación)', () => {
  const max = 3000;
  const hps = [1200, 900, 900];
  let ph: FinalePhase = 1;
  const seen: number[] = [ph];
  for (let i = 0; i < 40 && hps.some((h) => h > 0); i++) {
    const k = hps.findIndex((h) => h > 0);
    const sum = hps.reduce((a, h) => a + Math.max(0, h), 0);
    let hp = clampSharedHp(hps[k], 999999, sum, max, finalePending(ph)).hp;
    if (hp <= 0 && finalePending(ph).length > 0) hp = 1;
    hps[k] = hp;
    // Con la barra frenada, el resto de golpes de la misma fase van a otro miembro hasta mover la fase
    const s2 = hps.reduce((a, h) => a + Math.max(0, h), 0);
    const nx = nextFinalePhase(ph, s2 / max);
    if (nx) { ph = nx; seen.push(ph); }
    else if (hps[k] === 1) {
      const j = hps.findIndex((h, q) => q !== k && h > 1);
      if (j >= 0) hps[j] = clampSharedHp(hps[j], 999999, s2, max, finalePending(ph)).hp;
      const n2 = nextFinalePhase(ph, hps.reduce((a, h) => a + Math.max(0, h), 0) / max);
      if (n2) { ph = n2; seen.push(ph); }
    }
    if (ph === 4) break;
  }
  assert.deepEqual(seen, [1, 2, 3, 4]);
});

test('seguro: el tope compartido se suelta a los 3 s retenido (nunca un trío inmortal)', () => {
  let h = trackHold(undefined, 0.5, 0).hold;
  assert.equal(trackHold(h, 0.5, CAP_RELEASE_MS - 1).release, false);
  h = trackHold(h, 0.5, CAP_RELEASE_MS - 1).hold;
  assert.equal(trackHold(h, 0.5, CAP_RELEASE_MS).release, true);
  // Umbral consumido: ya no frena
  const r = clampSharedHp(1000, 999999, 1400, 3000, finalePending(2, [0.5]));
  assert.equal(r.threshold, 0.25);
});
