import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASCADE_SHAPES, FRENZY_ATTACKS, FRENZY_MIN_WARN, MAX_LANES, MIN_LANES, MIN_LANE_W, SAFE_MIN, cascadePlan, cascadeShapesFor, cascadeSpec,
  MIXED_EXTRA, MIXED_SAFE_R, comboPlan, comboSpec, elemKind, frenzyAttacksFor, frenzyChance, isFrenzyAttack, isMixedShape, laneHits, laneState, normalizeShape, pickFrenzy, pickShape, segDist, strikeHits, zoneHits,
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
            assert.ok(p.lanes.length >= MIN_LANES && p.lanes.length <= MAX_LANES + (isMixedShape(shape) ? MIXED_EXTRA : 0), `${tag}: ${p.lanes.length} líneas`);
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
            assert.equal(p.totalMs, Math.max(...p.lanes.map((l) => l.offAt)));
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

// Salas pedidas: 1200x800, 480x360 y 2160x660
const MIX_ROOMS = [
  { x0: 100, y0: 50, x1: 1300, y1: 850 },
  { x0: 0, y0: 0, x1: 480, y1: 360 },
  { x0: 40, y0: 40, x1: 2200, y1: 700 },
];

test('cascada mezclada: solo líneas rectas de 3 tipos, más densa, de pared a pared, escalonada y con hueco seguro común', () => {
  const rng = mulberry32(11);
  for (const b of MIX_ROOMS)
    for (const shape of ['mixed'] as const)
      for (const ph of [1, 2] as const)
        for (const diff of DIFFS)
          for (let rep = 0; rep < 25; rep++) {
            const spec = cascadeSpec(1 + rep % 10, ph, diff);
            const boss = { x: b.x0 + (b.x1 - b.x0) * rng(), y: b.y0 + (b.y1 - b.y0) * rng() };
            const p = cascadePlan(b, shape, spec, boss, rng);
            const tag = `${shape} ${b.x1 - b.x0}x${b.y1 - b.y0} ${ph} ${diff} #${rep}`;
            assert.ok(p.lanes.length >= spec.lanes && p.lanes.length <= spec.lanes + MIXED_EXTRA, `${tag}: nº ${p.lanes.length}`);
            const kinds = new Set(p.lanes.map(elemKind));
            assert.equal(kinds.size, 3, `${tag}: tipos ${[...kinds]}`);
            assert.ok(p.safeGap >= SAFE_MIN);
            const S = p.safeAt;
            assert.ok(inside(b, S.x - MIXED_SAFE_R, S.y - MIXED_SAFE_R) && inside(b, S.x + MIXED_SAFE_R, S.y + MIXED_SAFE_R), `${tag}: hueco dentro`);
            for (let i = 0; i < p.lanes.length; i++) {
              const l = p.lanes[i];
              assert.ok(l.width >= MIN_LANE_W);
              assert.ok(l.fireAt - l.warnAt >= (diff === 'easy' ? 900 : FRENZY_MIN_WARN), `${tag}: aviso`);
              if (i > 0) {
                const gap = l.warnAt - p.lanes[i - 1].warnAt;
                assert.ok(gap >= 80 && gap <= 150, `${tag}: escalonado ${gap}`);
              }
              // Pasillo: el disco seguro entero (diámetro ≥ 48) está libre de cada elemento en todo momento
              for (let a = 0; a < 16; a++)
                for (const rr of [0, MIXED_SAFE_R / 2, MIXED_SAFE_R]) {
                  const x = S.x + Math.cos((a * Math.PI) / 8) * rr;
                  const y = S.y + Math.sin((a * Math.PI) / 8) * rr;
                  assert.equal(laneHits(l, x, y, 0), false, `${tag}: el elemento ${i} (${elemKind(l)}) cruza el hueco`);
                }
              // Línea de pared a pared: los dos extremos tocan un borde de la sala
              const onEdge = (x: number, y: number) => Math.abs(x - b.x0) < 1e-6 || Math.abs(x - b.x1) < 1e-6 || Math.abs(y - b.y0) < 1e-6 || Math.abs(y - b.y1) < 1e-6;
              assert.ok(onEdge(l.x1, l.y1) && onEdge(l.x2, l.y2), `${tag}: de pared a pared`);
              assert.ok(inside(b, l.x1, l.y1) && inside(b, l.x2, l.y2));
            }
            assert.equal(p.totalMs, Math.max(...p.lanes.map((l) => l.offAt)));
          }
});

test('cascada mezclada: es la más frecuente para todos los tipos y puede repetirse', () => {
  for (const t of ['fire', 'water', 'grass', 'ghost', 'normal', 'nada']) {
    const sh = cascadeShapesFor([t], ['ice']);
    const mixed = sh.filter((s) => s === 'mixed').length;
    assert.ok(mixed > sh.length / 2, t);
  }
  const rng = mulberry32(9);
  let mixed = 0;
  let last: CascadeShape | undefined;
  for (let i = 0; i < 400; i++) {
    last = pickShape(cascadeShapesFor(['fire'], []), rng, last);
    if (last === 'mixed') mixed++;
  }
  assert.ok(mixed > 200, `mezcladas ${mixed}/400`);
});

test('cascada: formas por tipo y bioma (variedad), sin repetir la última', () => {
  assert.ok(cascadeShapesFor(['fire'], ['water']).length >= 2);
  assert.notDeepEqual(cascadeShapesFor(['fire'], []), cascadeShapesFor(['water'], []));
  assert.ok(cascadeShapesFor(['nada'], []).length >= 2);
  const rng = mulberry32(5);
  const shapes: CascadeShape[] = ['diagonal', 'sweepH', 'pincer'];
  for (let i = 0; i < 30; i++) assert.notEqual(pickShape(shapes, rng, 'diagonal'), 'diagonal');
});

test('sin ráfagas circulares: ni radial, ni espiral, ni anillos; las formas antiguas se cambian por rectas', () => {
  assert.deepEqual([...CASCADE_SHAPES].sort(), ['diagonal', 'mixed', 'pincer', 'sweepH', 'sweepV']);
  for (const t of ['fire', 'water', 'psychic', 'ghost', 'dragon', 'fairy', 'flying', 'dark', 'rock', 'poison', 'nada'])
    for (const s of cascadeShapesFor([t], [t])) assert.ok(CASCADE_SHAPES.includes(s), `${t}: ${s}`);
  assert.equal(normalizeShape('radial'), 'diagonal');
  assert.equal(normalizeShape('spiral'), 'pincer');
  assert.equal(normalizeShape('mixedRing'), 'mixed');
  assert.equal(normalizeShape('sweepV'), 'sweepV');
  assert.equal(normalizeShape('nada'), undefined);
  const p = cascadePlan(ROOMS[0], 'mixed', cascadeSpec(6, 2), { x: 500, y: 300 }, mulberry32(4));
  for (const l of p.lanes) assert.ok(!('ring' in l), 'sin anillos');
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
        assert.deepEqual(steps.slice(0, 3).map((x) => x.kind), ['dash', 'bolt', 'zone'], 'embestida + rayo + zona');
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

test('combo: el rayo solo da dentro de su círculo y la zona tiene radio', () => {
  const r = comboSpec(6, 2).boltR;
  assert.ok(r >= 90 && r <= 130);
  assert.ok(strikeHits({ x: 0, y: 0, r }, 0, r - 5));
  assert.equal(strikeHits({ x: 0, y: 0, r }, 0, r + 30), false, 'fuera del círculo');
  assert.ok(zoneHits(0, 0, 120, 80, 80));
  assert.equal(zoneHits(0, 0, 120, 120, 120), false);
});

test('selección: fase 1 cascadas, tormentas y rayos, fase 2 también combos; más a menudo en fase 2 y menos en Fácil', () => {
  assert.deepEqual(frenzyAttacksFor(1), ['cascade', 'storm', 'lightning']);
  assert.deepEqual(frenzyAttacksFor(2), ['cascade', 'storm', 'lightning', 'feintCombo', 'chase']);
  assert.ok(frenzyChance(2) > frenzyChance(1));
  assert.ok(frenzyChance(2, 'easy') < frenzyChance(2));
  const rng = mulberry32(9);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const a = pickFrenzy(1, 'normal', rng);
    if (a) {
      assert.ok(a === 'cascade' || a === 'storm' || a === 'lightning');
      n++;
    }
    const b = pickFrenzy(2, 'normal', rng, 'cascade');
    if (b) assert.ok(b !== 'cascade', 'sin repetir el último');
  }
  assert.ok(n > 200 && n < 280);
  assert.ok(attackInterval(2) <= 1400, 'fase 2 con menos respiro');
});
