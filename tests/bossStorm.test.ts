import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CASCADE_SHAPES, FRENZY_MIN_WARN, STORM_MAX_ACTIVE, STORM_MAX_ACTIVE_LOW, STORM_SAFE_SPEED, PLAYER_BASE_SPEED, cascadeShapesFor, cascadeSpec,
  coversSafe, frenzyChance, isMixedShape, maxOverlap, pickFrenzy, safeAt, stormPlan, stormSpec,
} from '../src/data/bossFrenzy.ts';
import { DASH_BASE_MOVE } from '../src/data/dash.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const ROOMS = [
  { x0: 0, y0: 0, x1: 1200, y1: 800 },
  { x0: 0, y0: 0, x1: 480, y1: 360 },
  { x0: 0, y0: 0, x1: 2160, y1: 660 },
];
const DIFFS = ['easy', 'normal', 'hard'] as const;

function plans(cb: (p: ReturnType<typeof stormPlan>, ctx: { room: (typeof ROOMS)[number]; diff: (typeof DIFFS)[number]; phase: 1 | 2; low: boolean }) => void) {
  let seed = 1;
  for (const room of ROOMS)
    for (const diff of DIFFS)
      for (const phase of [1, 2] as const)
        for (let k = 0; k < 4; k++) {
          const rng = mulberry32(seed++);
          const low = k === 3;
          const W = room.x1 - room.x0;
          const H = room.y1 - room.y0;
          const boss = { x: room.x0 + W * (0.2 + rng() * 0.6), y: room.y0 + H * (0.2 + rng() * 0.3) };
          const player = { x: room.x0 + W * rng(), y: room.y0 + H * (0.5 + rng() * 0.5) };
          const pool = cascadeShapesFor([['fire', 'water', 'psychic', 'grass'][k]], ['ice']);
          const p = stormPlan(room, stormSpec(1 + k * 2, phase, diff, low), boss, player, pool, rng, cascadeSpec(1 + k * 2, phase, diff));
          cb(p, { room, diff, phase, low });
        }
}

test('tormenta: el pasillo seguro nunca queda cubierto por un elemento activo (3 salas, 3 dificultades, 2 fases)', () => {
  plans((p) => {
    for (let t = 0; t <= p.totalMs; t += 4) {
      for (const l of p.lanes) {
        if (t < l.fireAt || t >= l.offAt) continue;
        assert.equal(coversSafe(l, p.path, t), false, `cubierto en t=${t}`);
      }
    }
  });
});

test('tormenta: el pasillo se mueve suave y como mucho al 60 % de la velocidad del jugador, dentro de la sala', () => {
  assert.equal(PLAYER_BASE_SPEED, DASH_BASE_MOVE);
  plans((p, { room }) => {
    let prev = safeAt(p.path, 0);
    for (let t = 5; t <= p.totalMs; t += 5) {
      const q = safeAt(p.path, t);
      assert.ok((Math.hypot(q.x - prev.x, q.y - prev.y) / 5) * 1000 <= STORM_SAFE_SPEED + 1e-6, 'velocidad');
      assert.ok(q.x - p.path.r >= room.x0 && q.x + p.path.r <= room.x1 && q.y - p.path.r >= room.y0 && q.y + p.path.r <= room.y1, 'dentro');
      prev = q;
    }
  });
});

test('tormenta: 3-5 cascadas solapadas, duración por fase, aviso mínimo, rampa y tope de elementos', () => {
  plans((p, { diff, phase, low }) => {
    assert.ok(p.shapes.length >= 3 && p.shapes.length <= 5);
    assert.ok(p.shapes.some(isMixedShape), 'al menos una mezclada');
    const simples = p.shapes.filter((s) => !isMixedShape(s));
    assert.equal(new Set(simples).size, simples.length, 'simples distintas');
    for (let i = 1; i < p.starts.length; i++) {
      const gap = p.starts[i] - p.starts[i - 1];
      assert.ok(gap >= 600 && gap <= 900);
    }
    const [lo, hi] = phase === 2 ? [9000, 14000] : [6000, 10000];
    assert.ok(p.totalMs >= lo && p.totalMs <= hi, `duración ${p.totalMs} (fase ${phase})`);
    const minWarn = diff === 'easy' ? 950 : FRENZY_MIN_WARN;
    for (const l of p.lanes) assert.ok(l.fireAt - l.warnAt >= minWarn - 1e-6);
    assert.ok(maxOverlap(p.lanes) <= (low ? STORM_MAX_ACTIVE_LOW : STORM_MAX_ACTIVE));
    // Solape: la segunda cascada avisa mientras la primera ya dispara
    const firstFire = Math.min(...p.lanes.map((l) => l.fireAt));
    assert.ok(p.starts[1] < firstFire + 2000);
    // Rampa: menos elementos vivos al principio que al final
    const at = (t0: number, t1: number) => p.lanes.filter((l) => l.fireAt >= t0 && l.fireAt < t1).length;
    const third = p.totalMs / 3;
    assert.ok(at(0, third) < at(2 * third, p.totalMs + 1), 'rampa');
    assert.ok(p.lanes.length >= 25, `densa (${p.lanes.length})`);
  });
});

test('selección: 60 % / 80 % de frenesí (Fácil ×0,6, Difícil ×1,2 hasta 95 %), la mitad tormentas', () => {
  assert.equal(frenzyChance(1), 0.6);
  assert.equal(frenzyChance(2), 0.8);
  assert.ok(Math.abs(frenzyChance(1, 'easy') - 0.36) < 1e-9);
  assert.ok(Math.abs(frenzyChance(2, 'hard') - 0.95) < 1e-9);
  const rng = mulberry32(3);
  let f = 0;
  let s = 0;
  for (let i = 0; i < 4000; i++) {
    const a = pickFrenzy(2, 'normal', rng);
    if (a) f++;
    if (a === 'storm') s++;
  }
  assert.ok(f > 3000 && f < 3400);
  assert.ok(s > f * 0.42 && s < f * 0.58);
  assert.ok(CASCADE_SHAPES.length >= 8);
});
