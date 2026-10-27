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

// --- T51 ---
import { MAX_HEALERS, MAX_MINES, biomeExtraBehaviors, mixBehaviors, twistBehaviors, twistChance } from '../src/data/bossPatterns.ts';
import { EXTRA_BEHAVIORS, EXTRA_BEHAVIOR_LABEL, absorbShieldHit, enemyStats, hitFromFront, shieldPoolFor, turnToward } from '../src/data/enemies.ts';
import { difficultyFor } from '../src/level/progression.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('T51: cuatro comportamientos nuevos con nombre, repartidos por bioma', () => {
  assert.equal(EXTRA_BEHAVIORS.length, 4);
  for (const b of EXTRA_BEHAVIORS) assert.ok(EXTRA_BEHAVIOR_LABEL[b]);
  for (const b of BIOMES) {
    const [x, y] = biomeExtraBehaviors(b.types);
    assert.notEqual(x, y, b.id);
  }
  const all = new Set(BIOMES.flatMap((b) => biomeExtraBehaviors(b.types)));
  for (const b of EXTRA_BEHAVIORS) assert.ok(all.has(b), `${b} sale en algún bioma`);
});

test('T51: más cuanto más hondo, nunca en el piso 1, sin tocar a los que disparan y con topes', () => {
  assert.equal(twistChance(1), 0);
  assert.ok(twistChance(3) > twistChance(2));
  assert.ok(twistChance(20) <= 0.35);
  const rng = mulberry32(8);
  const room = ['chase', 'charge', 'shoot', 'hop', 'chase', 'chase', 'circle', 'charge'] as const;
  assert.deepEqual(twistBehaviors(room, 1, ['grass'], rng), [...room]);
  let changed = 0;
  for (let i = 0; i < 300; i++) {
    const out = twistBehaviors(mixBehaviors([...room]), 6, ['grass', 'bug'], rng);
    assert.ok(out.filter((b) => b === 'healer').length <= MAX_HEALERS);
    assert.ok(out.filter((b) => b === 'mine').length <= MAX_MINES);
    assert.ok(out.filter((b) => b === 'shoot').length >= Math.ceil(out.length / 3));
    changed += out.filter((b) => (EXTRA_BEHAVIORS as readonly string[]).includes(b)).length;
    for (const b of out) if ((EXTRA_BEHAVIORS as readonly string[]).includes(b)) assert.ok(['healer', 'mine'].includes(b));
  }
  assert.ok(changed > 100, `${changed}`);
});

test('T51: escudado (golpes de frente), giro limitado y estadísticas', () => {
  // Mira a la derecha (0 rad): de frente bloquea, por la espalda no
  assert.ok(hitFromFront(0, 30, 5));
  assert.ok(!hitFromFront(0, -30, 5));
  assert.ok(!hitFromFront(Math.PI, 30, 0));
  assert.ok(Math.abs(turnToward(0, Math.PI / 2, 0.1) - 0.1) < 1e-9);
  assert.ok(Math.abs(turnToward(3, -3, 1) - (3 + (2 * Math.PI - 6))) < 1e-9);
  const d = difficultyFor(3);
  assert.ok(enemyStats(400, 'shielded', d).hp > enemyStats(400, 'shoot', d).hp);
  assert.ok(enemyStats(400, 'mine', d).hp < enemyStats(400, 'chase', d).hp);
  for (const b of EXTRA_BEHAVIORS) assert.ok(enemyStats(400, b, d).speed > 0, b);
});

test('escudado: el escudo es una reserva de PS que absorbe de cualquier lado', () => {
  assert.equal(shieldPoolFor(100), 60);
  assert.deepEqual(absorbShieldHit(60, 25), { absorbed: 25, through: 0, left: 35 });
  assert.deepEqual(absorbShieldHit(10, 25), { absorbed: 10, through: 15, left: 0 });
  assert.deepEqual(absorbShieldHit(0, 25), { absorbed: 0, through: 25, left: 0 });
});
