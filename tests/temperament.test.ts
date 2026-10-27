import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPERAMENTS, TEMPERAMENT_BOUNDS, expectedAttackRate, rollTemperament, tempoCooldown, tempoShot } from '../src/data/temperament.ts';

test('multiplicadores acotados', () => {
    for (const t of Object.values(TEMPERAMENTS)) {
      for (const v of [t.cooldownMul, t.shotSpeedMul, t.rangeMul]) {
        assert.ok(v >= TEMPERAMENT_BOUNDS.min);
        assert.ok(v <= TEMPERAMENT_BOUNDS.max);
      }
      assert.ok(Math.abs(t.sizeMul - 1) <= 0.1);
    }
  });
test('el ágil ataca más rápido con menos alcance; el pesado al revés', () => {
    assert.ok(TEMPERAMENTS.agil.cooldownMul < 1);
    assert.ok(TEMPERAMENTS.agil.rangeMul < 1);
    assert.ok(TEMPERAMENTS.pesado.cooldownMul > 1);
    assert.ok(TEMPERAMENTS.pesado.rangeMul > 1);
  });
test('el daño medio apenas sube', () => {
    assert.ok(expectedAttackRate() > 0.97);
    assert.ok(expectedAttackRate() < 1.05);
  });
test('sorteo cubre todos y respeta pesos', () => {
    assert.equal(rollTemperament(() => 0).id, 'agil');
    assert.equal(rollTemperament(() => 0.5).id, 'normal');
    assert.equal(rollTemperament(() => 0.99).id, 'pesado');
    assert.equal(rollTemperament(() => 1).id, 'pesado');
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n: Record<string, number> = { agil: 0, normal: 0, pesado: 0 };
    for (let i = 0; i < 10000; i++) n[rollTemperament(rng).id]++;
    assert.ok(n.normal / 10000 > 0.45);
    assert.ok(n.agil / 10000 > 0.2);
  });
test('alcance = velocidad × vida × rangeMul', () => {
    const t = TEMPERAMENTS.agil;
    const s = tempoShot(t, 250, 2600);
    assert.ok(Math.abs((s.speed * s.life) / (250 * 2600) - t.rangeMul) < 0.01);
    assert.deepEqual(tempoShot(undefined, 250, 2600), { speed: 250, life: 2600 });
    assert.equal(tempoCooldown(TEMPERAMENTS.pesado, 1000), 1250);
  });

