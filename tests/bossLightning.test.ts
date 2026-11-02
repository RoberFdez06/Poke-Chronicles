import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FRENZY_LABEL, FRENZY_MIN_WARN, aimStrike, lightningPlan, lightningSpec, pickFrenzy, strikeHits, strikeMaxLive, strikesLiveAt, type Strike,
} from '../src/data/bossFrenzy.ts';
import { BOSS_ATTACK_LABEL } from '../src/data/bossPatterns.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const ROOMS = [
  { x0: 0, y0: 0, x1: 1200, y1: 800 },
  { x0: 0, y0: 0, x1: 480, y1: 360 },
  { x0: 40, y0: 40, x1: 2200, y1: 700 },
];
const DIFFS = ['easy', 'normal', 'hard'] as const;
const inCircle = (b: (typeof ROOMS)[number], k: Strike) => k.x - k.r >= b.x0 - 1e-6 && k.x + k.r <= b.x1 + 1e-6 && k.y - k.r >= b.y0 - 1e-6 && k.y + k.r <= b.y1 + 1e-6;

test('rayos: nombre en español y elegido a menudo en las dos fases', () => {
  assert.equal(FRENZY_LABEL.lightning, 'Rayos');
  assert.equal(BOSS_ATTACK_LABEL.lightning, 'Rayos');
  for (const ph of [1, 2] as const) {
    const rng = mulberry32(ph);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (pickFrenzy(ph, 'normal', rng) === 'lightning') n++;
    assert.ok(n > 2000 * (ph === 2 ? 0.8 : 0.6) * 0.22, `fase ${ph}: ${n}`);
  }
  // Nunca dos seguidos
  const rng = mulberry32(8);
  for (let i = 0; i < 300; i++) assert.notEqual(pickFrenzy(2, 'normal', rng, 'lightning'), 'lightning');
});

test('rayos: specs (fase 1 6-10, fase 2 más y más seguidos, radio 90-130, aviso mínimo, Fácil más suave)', () => {
  for (const diff of DIFFS)
    for (const floor of [1, 3, 6, 10]) {
      const a = lightningSpec(floor, 1, diff);
      const c = lightningSpec(floor, 2, diff);
      assert.ok(a.strikes >= 6 && a.strikes <= 10, `${a.strikes}`);
      assert.ok(c.strikes > a.strikes);
      assert.ok(c.staggerMs < a.staggerMs, 'fase 2 más seguidos');
      for (const s of [a, c]) {
        assert.ok(s.warnMs >= FRENZY_MIN_WARN);
        assert.ok(s.rMin >= 90 && s.rMax <= 130 && s.rMin < s.rMax);
        assert.ok(s.cover < 0.5);
      }
    }
  assert.ok(lightningSpec(6, 2, 'easy').warnMs > lightningSpec(6, 2).warnMs);
  assert.ok(lightningSpec(6, 2, 'easy').staggerMs > lightningSpec(6, 2).staggerMs);
  assert.ok(lightningSpec(6, 2, 'easy').strikes < lightningSpec(6, 2, 'hard').strikes);
});

test('rayos: plan determinista con semilla, círculos dentro de la sala, en cascada y con aviso', () => {
  const b = ROOMS[0];
  const spec = lightningSpec(4, 1);
  const p1 = lightningPlan(b, spec, { x: 300, y: 300 }, mulberry32(42));
  const p2 = lightningPlan(b, spec, { x: 300, y: 300 }, mulberry32(42));
  assert.deepEqual(p1, p2);
  let seed = 1;
  for (const room of ROOMS)
    for (const diff of DIFFS)
      for (const ph of [1, 2] as const)
        for (let k = 0; k < 6; k++) {
          const rng = mulberry32(seed++);
          const player = { x: room.x0 + (room.x1 - room.x0) * rng(), y: room.y0 + (room.y1 - room.y0) * rng() };
          const s = lightningSpec(1 + k * 2, ph, diff);
          const p = lightningPlan(room, s, player, rng);
          assert.equal(p.strikes.length, s.strikes);
          for (let i = 0; i < p.strikes.length; i++) {
            const st = p.strikes[i];
            assert.ok(inCircle(room, st), 'dentro de la sala');
            assert.ok(st.r <= 130 && st.r >= 60);
            assert.ok(st.fireAt - st.warnAt >= FRENZY_MIN_WARN);
            assert.ok(st.offAt > st.fireAt);
            if (i > 0) assert.ok(st.warnAt >= p.strikes[i - 1].warnAt + s.staggerMs - 1e-6, 'uno detrás de otro');
            // Apuntado recolocado en cualquier sitio: sigue dentro
            assert.ok(inCircle(room, aimStrike(st, { x: room.x1 + 50, y: room.y0 - 50 }, room)));
          }
          assert.ok(p.strikes.filter((x) => x.aimed).length >= Math.floor(s.strikes * s.aimed), 'algunos apuntados');
          assert.equal(p.totalMs, Math.max(...p.strikes.map((x) => x.offAt)));
        }
});

test('rayos: siempre queda hueco (aunque los apuntados caigan donde sea) y nunca cubren la sala', () => {
  let seed = 100;
  for (const room of ROOMS)
    for (const diff of DIFFS)
      for (const ph of [1, 2] as const)
        for (let k = 0; k < 4; k++) {
          const rng = mulberry32(seed++);
          const s = lightningSpec(8, ph, diff);
          let p = lightningPlan(room, s, { x: room.x0 + 100, y: room.y0 + 100 }, rng);
          // Peor caso: cada apuntado sobre un punto al azar
          p = { ...p, strikes: p.strikes.map((x) => (x.aimed ? aimStrike(x, { x: room.x0 + rng() * (room.x1 - room.x0), y: room.y0 + rng() * (room.y1 - room.y0) }, room) : x)) };
          const area = (room.x1 - room.x0) * (room.y1 - room.y0);
          for (let t = 0; t <= p.totalMs; t += 40) {
            const live = strikesLiveAt(p.strikes, t);
            assert.ok(live.length <= strikeMaxLive(room, s));
            const covered = live.reduce((a, x) => a + Math.PI * x.r * x.r, 0);
            assert.ok(covered <= 0.5 * area, `cubre ${Math.round((covered / area) * 100)} %`);
            // Hay un punto libre con el cuerpo del jugador (rejilla)
            let free = false;
            for (let x = room.x0 + 20; x < room.x1 && !free; x += 24)
              for (let y = room.y0 + 20; y < room.y1 && !free; y += 24) if (!live.some((z) => strikeHits(z, x, y, 18))) free = true;
            assert.ok(free, `sin hueco en t=${t}`);
          }
        }
});

test('rayos: el daño es solo dentro del círculo y el apuntado se esquiva moviéndose durante el aviso', () => {
  const k: Strike = { x: 500, y: 400, r: 110, warnAt: 0, fireAt: 900, offAt: 1140, aimed: true };
  assert.ok(strikeHits(k, 500, 400));
  assert.ok(strikeHits(k, 500 + 105, 400));
  assert.equal(strikeHits(k, 500 + 140, 400), false);
  assert.equal(strikeHits(k, 500, 400 - 200), false);
  const room = ROOMS[0];
  const a = aimStrike(k, { x: 300, y: 300 }, room);
  assert.equal(a.x, 300);
  assert.equal(a.y, 300);
  // En el aviso (≥ 750 ms) el jugador (240 px/s) recorre más que el radio + su cuerpo
  for (const diff of DIFFS) for (const ph of [1, 2] as const) {
    const s = lightningSpec(10, ph, diff);
    assert.ok((240 * s.warnMs) / 1000 > s.rMax + 18);
  }
});

test('rayos: la fase 2 cae con más cadencia que la fase 1', () => {
  const room = ROOMS[0];
  for (const diff of DIFFS) {
    const rate = (ph: 1 | 2) => {
      const p = lightningPlan(room, lightningSpec(6, ph, diff), { x: 600, y: 400 }, mulberry32(7));
      const span = p.strikes[p.strikes.length - 1].fireAt - p.strikes[0].fireAt;
      return (p.strikes.length - 1) / span;
    };
    assert.ok(rate(2) > rate(1) * 1.2, diff);
  }
});
