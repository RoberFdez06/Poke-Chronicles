// Ejecutar con `npm test`. T50: ataques extra de jefe por bioma y su dificultad por piso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_ATTACK_LABEL,
  EXTRA_ATTACKS,
  biomeExtraAttacks,
  bossAttacks,
  bossAttacksFor,
  hazardSpec,
  laserHits,
  laserSpec,
  shockwaveHits,
  shockwaveSpec,
  spiralSpec,
} from '../src/data/bossPatterns.ts';
import { BIOMES } from '../src/level/biomes.ts';

test('cuatro ataques nuevos con nombre en español', () => {
  assert.deepEqual([...EXTRA_ATTACKS], ['spiral', 'shockwave', 'laser', 'hazard']);
  for (const a of EXTRA_ATTACKS) assert.ok(BOSS_ATTACK_LABEL[a]);
  assert.equal(BOSS_ATTACK_LABEL.laser, 'Láser giratorio');
});

test('cada bioma da 2 ataques extra según su tipo (fuego → onda)', () => {
  for (const b of BIOMES) {
    const [x, y] = biomeExtraAttacks(b.types);
    assert.ok(EXTRA_ATTACKS.includes(x) && EXTRA_ATTACKS.includes(y), b.id);
    assert.notEqual(x, y, b.id);
  }
  assert.ok(biomeExtraAttacks(['fire', 'rock']).includes('shockwave'));
  assert.deepEqual(biomeExtraAttacks(['raro']), biomeExtraAttacks(['normal']));
  // Los extra se suman a los de siempre, sin repetir
  const all = bossAttacksFor(['fire'], ['fire', 'rock']);
  for (const a of bossAttacks(['fire'])) assert.ok(all.includes(a));
  assert.ok(all.includes('shockwave') && all.includes('hazard'));
  assert.equal(new Set(all).size, all.length);
  // Al menos dos biomas distintos dan pares distintos
  assert.ok(new Set(BIOMES.map((b) => biomeExtraAttacks(b.types).join())).size >= 4);
});

test('más duros con el piso, pero siempre esquivables', () => {
  for (const phase of [1, 2] as const) {
    let prev = { s: spiralSpec(1, phase), w: shockwaveSpec(1, phase), l: laserSpec(1, phase), h: hazardSpec(1, phase) };
    for (let f = 2; f <= 15; f++) {
      const s = spiralSpec(f, phase);
      const w = shockwaveSpec(f, phase);
      const l = laserSpec(f, phase);
      const h = hazardSpec(f, phase);
      assert.ok(s.arms >= prev.s.arms && s.shots >= prev.s.shots && s.everyMs <= prev.s.everyMs, `espiral ${f}`);
      assert.ok(w.waves >= prev.w.waves && w.gap <= prev.w.gap, `onda ${f}`);
      assert.ok(l.beams >= prev.l.beams && l.turnSpeed >= prev.l.turnSpeed, `láser ${f}`);
      assert.ok(h.zones >= prev.h.zones && h.warnMs <= prev.h.warnMs, `zonas ${f}`);
      // Topes para que se pueda esquivar
      assert.ok(s.arms <= 4 && s.everyMs >= 90);
      assert.ok(w.gap >= (50 * Math.PI) / 180 && w.speed <= 340 && w.waves <= 3);
      assert.ok(l.beams <= 3 && l.turnSpeed <= (75 * Math.PI) / 180 + 1e-9);
      assert.ok(h.zones <= 7 && h.warnMs >= 900);
      prev = { s, w, l, h };
    }
  }
  assert.ok(spiralSpec(1, 2).arms > spiralSpec(1, 1).arms);
});

test('el láser y la onda tocan donde deben', () => {
  // Láser hacia la derecha desde (0, 0)
  assert.ok(laserHits(0, 0, 0, 500, 200, 5));
  assert.ok(!laserHits(0, 0, 0, 500, 200, 40));
  assert.ok(!laserHits(0, 0, 0, 500, -50, 0));
  assert.ok(!laserHits(0, 0, 0, 500, 600, 0));
  // Onda de radio 100 con el hueco a la derecha (60°)
  const gap = Math.PI / 3;
  assert.ok(shockwaveHits(0, 0, 100, 0, gap, -100, 0));
  assert.ok(!shockwaveHits(0, 0, 100, 0, gap, 100, 0));
  assert.ok(!shockwaveHits(0, 0, 100, 0, gap, -50, 0));
  // El hueco funciona aunque cruce el ángulo ±π
  assert.ok(!shockwaveHits(0, 0, 100, Math.PI, gap, -100, 1));
});
