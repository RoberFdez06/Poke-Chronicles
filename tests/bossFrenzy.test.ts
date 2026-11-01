import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASCADE_SHAPES, FRENZY_ATTACKS, FRENZY_MIN_WARN, MAX_LANES, MIN_LANES, MIN_LANE_W, SAFE_MIN, cascadePlan, cascadeShapesFor, cascadeSpec,
  comboPlan, comboSpec, frenzyAttacksFor, frenzyChance, isFrenzyAttack, laneHits, laneState, pickFrenzy, pickShape, segDist, waveHits, zoneHits,
  type CascadeShape,
} from '../src/data/bossFrenzy.ts';
import { BOSS_ATTACK_LABEL, TELEGRAPH_MS, attackInterval } from '../src/data/bossPatterns.ts';
import { attackUsable } from '../src/data/bossPath.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const ROOMS = [
  { x0: 100, y0: 50, x1: 1300, y1: 850 },
  { x0: 0, y0: 0, x1: 480, y1: 360 }, // sala pequeña
  { x0: 40, y0: 40, x1: 2200, y1: 700 }, // sala grande alargada
];
const inside = (b: (typeof ROOMS)[number], x: number, y: number) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && y >= b.y0 - 1e-6 && y <= b.y1 + 1e-6;
const DIFFS = ['easy', 'normal', 'hard'] as const;

test('ataques frenéticos con nombre, anunciables y siempre usables (no son apuntados)', () => {
  for (const a of FRENZY_ATTACKS) {
    assert.ok(isFrenzyAttack(a));
    assert.ok(BOSS_ATTACK_LABEL[a].length > 3);
    assert.ok(attackUsable(a, false, 9999));
  }
  assert.equal(isFrenzyAttack('ring'), false);
  assert.ok(FRENZY_MIN_WARN >= TELEGRAPH_MS, 'nunca menos aviso que el ataque normal');
});

test('cascada: 10-14 líneas, escalonadas 80-150 ms, aviso mínimo y Fácil más suave', () => {
  for (const ph of [1, 2] as const)
    for (const diff of DIFFS)
      for (const floor of [1, 3, 6, 10]) {
        const s = cascadeSpec(floor, ph, diff);
        assert.ok(s.lanes >= MIN_LANES && s.lanes <= MAX_LANES);
        assert.ok(s.staggerMs >= 80 && s.staggerMs <= 150);
        assert.ok(s.warnMs >= FRENZY_MIN_WARN);
        assert.ok(s.warnMs <= 1000);
      }
  assert.ok(cascadeSpec(6, 2).lanes > cascadeSpec(6, 1).lanes, 'fase 2 más densa');
  assert.ok(cascadeSpec(6, 2).staggerMs < cascadeSpec(6, 1).staggerMs, 'fase 2 más rápida');
  assert.ok(cascadeSpec(6, 2, 'easy').lanes < cascadeSpec(6, 2).lanes);
  assert.ok(cascadeSpec(6, 2, 'easy').warnMs > cascadeSpec(6, 2).warnMs);
  assert.ok(cascadeSpec(6, 2, 'easy').staggerMs > cascadeSpec(6, 2).staggerMs);
});

test('cascada: cada forma, en cada sala, deja hueco seguro, no sale de la sala y va en orden', () => {
  const rng = mulberry32(7);
  for (const b of ROOMS)
    for (const shape of CASCADE_SHAPES)
      for (const ph of [1, 2] as const)
        for (const diff of DIFFS)
          for (let rep = 0; rep < 6; rep++) {
            const spec = cascadeSpec(8, ph, diff);
            const boss = { x: b.x0 + (b.x1 - b.x0) * rng(), y: b.y0 + (b.y1 - b.y0) * rng() };
            const p = cascadePlan(b, shape, spec, boss, rng);
            const tag = `${shape} ${ph} ${diff}`;
            assert.ok(p.lanes.length >= MIN_LANES && p.lanes.length <= MAX_LANES, `${tag}: ${p.lanes.length} líneas`);
            assert.ok(p.safeGap >= SAFE_MIN, `${tag}: pasillo ${p.safeGap}`);
            // El centro del hueco seguro no lo toca ninguna línea (con el cuerpo del jugador)
            if (inside(b, p.safeAt.x, p.safeAt.y)) for (const l of p.lanes) assert.equal(laneHits(l, p.safeAt.x, p.safeAt.y, 14), false, tag);
            for (let i = 0; i < p.lanes.length; i++) {
              const l = p.lanes[i];
              assert.ok(l.width >= MIN_LANE_W);
              assert.ok(inside(b, l.x1, l.y1) && inside(b, l.x2, l.y2), `${tag}: dentro`);
              assert.ok(l.fireAt - l.warnAt >= FRENZY_MIN_WARN, 'aviso mínimo');
              assert.ok(l.offAt > l.fireAt);
              if (i > 0) {
                const gap = l.warnAt - p.lanes[i - 1].warnAt;
                assert.ok(gap >= 80 && gap <= 150, `${tag}: escalonado ${gap}`);
              }
            }
            assert.equal(p.totalMs, p.lanes[p.lanes.length - 1].offAt);
          }
});

test('cascada: el barrido va de verdad en un sentido y las pinzas se cierran desde los lados', () => {
  const b = ROOMS[0];
  const spec = cascadeSpec(3, 1);
  let swept = 0;
  for (let s = 1; s < 40; s++) {
    const p = cascadePlan(b, 'sweepH', spec, { x: 700, y: 450 }, mulberry32(s));
    if (p.order !== 'sweep') continue;
    const xs = p.lanes.map((l) => l.x1);
    const asc = xs.every((x, i) => i === 0 || x > xs[i - 1]);
    const desc = xs.every((x, i) => i === 0 || x < xs[i - 1]);
    assert.ok(asc || desc);
    swept++;
  }
  assert.ok(swept > 0);
  const p = cascadePlan(b, 'pincer', spec, { x: 700, y: 450 }, mulberry32(3));
  const pos = p.lanes.map((l) => (l.x1 === l.x2 ? l.x1 : l.y1));
  const mid = pos.reduce((a, c) => a + c, 0) / pos.length;
  assert.ok(Math.sign(pos[0] - mid) !== Math.sign(pos[1] - mid), 'alterna los lados');
  assert.ok(Math.abs(pos[0] - mid) > Math.abs(pos[pos.length - 1] - mid), 'de fuera hacia dentro');
});

test('cascada: formas por tipo y bioma (variedad), sin repetir la última', () => {
  assert.ok(cascadeShapesFor(['fire'], ['water']).length >= 2);
  assert.notDeepEqual(cascadeShapesFor(['fire'], []), cascadeShapesFor(['water'], []));
  assert.ok(cascadeShapesFor(['nada'], []).length >= 2);
  const rng = mulberry32(5);
  const shapes: CascadeShape[] = ['radial', 'sweepH', 'pincer'];
  for (let i = 0; i < 30; i++) assert.notEqual(pickShape(shapes, rng, 'radial'), 'radial');
});

test('estado de una línea: aviso que se enciende, activa, se apaga', () => {
  const l = { x1: 0, y1: 0, x2: 100, y2: 0, width: 20, warnAt: 100, fireAt: 900, offAt: 1160 };
  assert.equal(laneState(l, 50).s, 'idle');
  const w = laneState(l, 500);
  assert.ok(w.s === 'warn' && w.k > 0 && w.k < 1);
  assert.equal(laneState(l, 1000).s, 'on');
  assert.equal(laneState(l, 1200).s, 'fade');
  assert.equal(laneState(l, 2000).s, 'done');
  assert.ok(laneHits(l, 50, 15, 10));
  assert.equal(laneHits(l, 50, 40, 10), false);
  assert.equal(segDist(0, 0, 10, 0, 20, 0), 10);
});

test('combo retardado: 3-5 golpes encadenados, aviso mínimo, amagos solo alargan el aviso', () => {
  for (const diff of DIFFS)
    for (const floor of [1, 6])
      for (let s = 1; s < 40; s++) {
        const spec = comboSpec(floor, 2, diff);
        const { steps, totalMs } = comboPlan(spec, mulberry32(s));
        assert.ok(steps.length >= 3 && steps.length <= 5);
        assert.deepEqual(steps.slice(0, 3).map((x) => x.kind), ['dash', 'wave', 'zone'], 'embestida + onda + zona');
        for (let i = 0; i < steps.length; i++) {
          const st = steps[i];
          assert.ok(st.fireAt - st.warnAt >= Math.max(FRENZY_MIN_WARN, spec.warnMs));
          if (st.feint) assert.ok(st.fireAt - st.warnAt > spec.warnMs);
          if (i > 0) {
            assert.ok(st.warnAt >= steps[i - 1].endAt + spec.pauseMin, 'pausa entre golpes');
            assert.notEqual(st.kind, steps[i - 1].kind);
          }
        }
        assert.equal(totalMs, steps[steps.length - 1].endAt);
      }
  // Hay amagos (Normal) y Fácil es más suave
  let feints = 0;
  for (let s = 1; s < 60; s++) feints += comboPlan(comboSpec(6, 2), mulberry32(s)).steps.filter((x) => x.feint).length;
  assert.ok(feints > 0);
  assert.equal(comboSpec(10, 2, 'easy').hits, 3);
  assert.ok(comboSpec(10, 2, 'hard').hits <= 5);
  assert.ok(comboSpec(6, 2, 'easy').feintChance < comboSpec(6, 2).feintChance);
  assert.ok(comboSpec(6, 2, 'easy').warnMs > comboSpec(6, 2).warnMs);
});

test('combo: la onda deja su hueco y la zona tiene radio', () => {
  assert.ok(waveHits(0, 0, 100, 28, 0, Math.PI / 3, 0, 100));
  assert.equal(waveHits(0, 0, 100, 28, 0, Math.PI / 3, 100, 0), false, 'dentro del hueco');
  assert.equal(waveHits(0, 0, 100, 28, 0, Math.PI / 3, 0, 200), false, 'fuera del frente');
  assert.ok(zoneHits(0, 0, 120, 80, 80));
  assert.equal(zoneHits(0, 0, 120, 120, 120), false);
});

test('selección: fase 1 solo cascadas, fase 2 también combos; más a menudo en fase 2 y menos en Fácil', () => {
  assert.deepEqual(frenzyAttacksFor(1), ['cascade']);
  assert.deepEqual(frenzyAttacksFor(2), ['cascade', 'feintCombo']);
  assert.ok(frenzyChance(2) > frenzyChance(1));
  assert.ok(frenzyChance(2, 'easy') < frenzyChance(2));
  const rng = mulberry32(9);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const a = pickFrenzy(1, 'normal', rng);
    if (a) {
      assert.equal(a, 'cascade');
      n++;
    }
    const b = pickFrenzy(2, 'normal', rng, 'cascade');
    if (b) assert.equal(b, 'feintCombo', 'sin repetir el último');
  }
  assert.ok(n > 80 && n < 220);
  assert.ok(attackInterval(2) <= 1400, 'fase 2 con menos respiro');
});
