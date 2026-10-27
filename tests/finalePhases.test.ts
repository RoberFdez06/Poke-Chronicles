// Ejecutar con `npm test`. Fases del reto final (finalePhases.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFinaleHp,
  FINALE_ATTACK_LABEL,
  FINALE_BEAT_MS,
  FINALE_PHASE_AT,
  finaleAttacks,
  finaleHpFloor,
  finaleIntervalMul,
  finalePhaseFor,
  finalePhaseText,
  JUDGMENT_BAND,
  JUDGMENT_MIN_WARN,
  judgmentHits,
  judgmentPlan,
  judgmentSpec,
  NOVA,
  NOVA_MAX_TURN,
  NOVA_MIN_GAP,
  nextFinalePhase,
  novaFollowable,
  novaGapAt,
  pickBands,
  pickFinaleAttack,
  type FinalePhase,
} from '../src/data/finalePhases.ts';
import { BOSS_ATTACK_LABEL, bossAttacksFor, TELEGRAPH_MS } from '../src/data/bossPatterns.ts';
import { BASE_STATS } from '../src/data/items.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const PHASES: FinalePhase[] = [1, 2, 3, 4];

test('umbrales 100-75-50-25-0 y fase por vida', () => {
  assert.deepEqual([...FINALE_PHASE_AT], [0.75, 0.5, 0.25]);
  assert.equal(finalePhaseFor(1), 1);
  assert.equal(finalePhaseFor(0.75), 1);
  assert.equal(finalePhaseFor(0.74), 2);
  assert.equal(finalePhaseFor(0.5), 2);
  assert.equal(finalePhaseFor(0.49), 3);
  assert.equal(finalePhaseFor(0.24), 4);
  assert.equal(finalePhaseFor(0), 4);
});

test('las fases avanzan de una en una y en orden, aunque la vida baje de golpe', () => {
  assert.equal(nextFinalePhase(1, 0.9), undefined);
  assert.equal(nextFinalePhase(1, 0.1), 2);
  assert.equal(nextFinalePhase(2, 0.1), 3);
  assert.equal(nextFinalePhase(3, 0.1), 4);
  assert.equal(nextFinalePhase(4, 0), undefined);
  // Recorrido completo con un golpe brutal: pasa por todas
  let ph: FinalePhase = 1;
  const seen: number[] = [1];
  for (let n; (n = nextFinalePhase(ph, 0)); ph = n) seen.push(n);
  assert.deepEqual(seen, [1, 2, 3, 4]);
});

test('un golpe enorme no se salta fases ni mata antes de la fase final', () => {
  const max = 1000;
  for (const ph of [1, 2, 3] as FinalePhase[]) {
    const hp = clampFinaleHp(-99999, ph, max);
    assert.ok(hp > 0, `fase ${ph}: no cae`);
    // Puede entrar en la siguiente fase, pero no en la de después
    assert.equal(finalePhaseFor(hp / max), Math.min(4, ph + 1));
  }
  assert.equal(finaleHpFloor(4, max), 0);
  assert.equal(clampFinaleHp(-5, 4, max), 0);
  // Daño normal no se toca
  assert.equal(clampFinaleHp(900, 1, max), 900);
});

test('cada fase tiene ataques válidos y trae algo nuevo', () => {
  const labels = { ...BOSS_ATTACK_LABEL, ...FINALE_ATTACK_LABEL };
  for (const types of [['psychic'], ['fire', 'flying'], ['dragon'], ['steel'], ['ghost', 'dark']]) {
    const base = [...bossAttacksFor(types, ['grass']), 'summon' as const];
    const sets = PHASES.map((p) => finaleAttacks(p, base));
    for (const s of sets) {
      assert.ok(s.length >= 2);
      assert.equal(new Set(s).size, s.length, 'sin repetidos');
      for (const a of s) assert.ok(labels[a], `${a} tiene nombre en español`);
    }
    assert.ok(!sets[0].includes('summon') && !sets[0].includes('judgment'));
    assert.ok(sets[1].includes('judgment'));
    assert.ok(sets[2].includes('summon') && sets[2].includes('laser'));
    assert.ok(sets[3].includes('nova') && !sets[3].includes('summon'));
  }
});

test('cada fase aprieta más y tiene su aviso en español', () => {
  for (let p = 1; p < 4; p++) assert.ok(finaleIntervalMul((p + 1) as FinalePhase) < finaleIntervalMul(p as FinalePhase));
  for (const p of [2, 3, 4] as FinalePhase[]) assert.match(finalePhaseText(p, 'Mewtwo'), /^¡Fase/);
  assert.ok(FINALE_BEAT_MS >= 500 && FINALE_BEAT_MS <= 1000);
});

test('la nova sale a menudo en la fase 4 y nunca dos veces seguidas', () => {
  const list = finaleAttacks(4, ['ring', 'rain']);
  const rng = mulberry32(3);
  let last: ReturnType<typeof pickFinaleAttack> | undefined;
  let since = 0;
  let novas = 0;
  for (let i = 0; i < 60; i++) {
    const a = pickFinaleAttack(list, rng, last, since);
    assert.notEqual(a, last);
    since = a === 'nova' ? 0 : since + 1;
    assert.ok(since <= 2);
    if (a === 'nova') novas++;
    last = a;
  }
  assert.ok(novas >= 20);
});

test('Cruz del juicio: aviso largo, franjas sin pegarse y siempre un sitio seguro cerca', () => {
  for (const p of PHASES) assert.ok(judgmentSpec(p).warnMs >= JUDGMENT_MIN_WARN && judgmentSpec(p).warnMs > TELEGRAPH_MS);
  const rng = mulberry32(11);
  const W = 13 * 64;
  const H = 7 * 64;
  for (let k = 0; k < 300; k++) {
    const p = PHASES[k % 4];
    const plan = judgmentPlan(W, H, judgmentSpec(p), rng);
    for (const idx of [plan.cols, plan.rows]) for (let i = 1; i < idx.length; i++) assert.ok(idx[i] - idx[i - 1] >= 2);
    // Desde cualquier punto, un sitio seguro al alcance durante el aviso (a la velocidad base)
    const reach = (BASE_STATS.speed * judgmentSpec(p).warnMs) / 1000;
    for (let x = 8; x < W; x += 40) {
      for (let y = 8; y < H; y += 40) {
        let best = Infinity;
        for (let sx = 4; sx < W; sx += 12) for (let sy = 4; sy < H; sy += 12) if (!judgmentHits(plan, sx, sy, 24)) best = Math.min(best, Math.hypot(sx - x, sy - y));
        assert.ok(best < reach * 0.7, `fase ${p}: (${x},${y}) a ${best.toFixed(0)} px de un sitio seguro`);
      }
    }
  }
  assert.deepEqual(pickBands(1, 3, () => 0), []);
  assert.ok(JUDGMENT_BAND >= 64);
});

test('Nova desesperada: hueco ancho que gira poco y se puede seguir, con ventana de castigo', () => {
  assert.ok(NOVA.gap >= NOVA_MIN_GAP && NOVA.turn <= NOVA_MAX_TURN);
  assert.ok(novaFollowable(NOVA, BASE_STATS.speed));
  assert.ok(NOVA.warnMs >= 1000);
  assert.ok(NOVA.punishMs >= 2000);
  assert.ok(Math.abs(novaGapAt(NOVA, 1, 2, -1) - (1 - 2 * NOVA.turn)) < 1e-9);
});
