import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRENZY_MIN_WARN, PLAYER_BASE_SPEED, SAFE_MIN, chaseOrder, chaseSpec, creepStep, frenzyAttacksFor, homingStep, pickFrenzy } from '../src/data/bossFrenzy.ts';
import { PHASE2_SPEED, attackInterval, volleyEvery, volleyShots } from '../src/data/bossPatterns.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const DIFFS = ['easy', 'normal', 'hard'] as const;

test('fase 2 mucho más agresiva (acotada)', () => {
  assert.ok(PHASE2_SPEED >= 1.5 && PHASE2_SPEED <= 1.7);
  assert.ok(attackInterval(2) <= 900 && attackInterval(2) >= 700);
  assert.ok(volleyEvery(2) <= 650 && volleyEvery(2) >= 500);
  assert.ok(volleyShots(2) >= 7 && volleyShots(2) <= 9);
});

test('acoso: solo en fase 2, se elige a menudo', () => {
  assert.ok(!frenzyAttacksFor(1).includes('chase'));
  assert.ok(frenzyAttacksFor(2).includes('chase'));
  const rng = mulberry32(5);
  let c = 0;
  for (let i = 0; i < 2000; i++) if (pickFrenzy(2, 'normal', rng) === 'chase') c++;
  assert.ok(c > 120, `${c}`);
});

test('acoso: esquivable en todas las dificultades, Fácil más suave, con tope de objetos', () => {
  for (const diff of DIFFS)
    for (const low of [false, true]) {
      const s = chaseSpec(6, 2, diff, low);
      assert.ok(s.warnMs >= (diff === 'easy' ? 950 : FRENZY_MIN_WARN));
      assert.ok(s.creepSpeed <= PLAYER_BASE_SPEED * 0.6, 'las zonas van más lentas que tú');
      assert.ok(s.homerLife <= 2500, 'vida corta');
      // Radio de giro del orbe mayor que el jugador: si giras cerca, se pasa de largo
      assert.ok(s.homerSpeed / s.homerTurn > 80);
      assert.ok(s.boltR >= 90 && s.boltR <= 130 && (PLAYER_BASE_SPEED * s.warnMs) / 1000 > s.boltR + SAFE_MIN, 'se sale del círculo del rayo durante el aviso');
      assert.ok(s.maxLive <= (low ? 16 : 28));
      assert.ok(s.blastR > s.puddleR, 'quien esquiva la explosión no está en el charco');
    }
  const e = chaseSpec(6, 2, 'easy');
  const h = chaseSpec(6, 2, 'hard');
  assert.ok(e.creepers < h.creepers && e.homers < h.homers && e.everyMs > h.everyMs && e.homerSpeed < h.homerSpeed);
});

test('acoso: pasos puros (arrastre sin pasarse, giro limitado) y rayos repartidos', () => {
  assert.deepEqual(creepStep({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, 500), { x: 50, y: 0 });
  assert.deepEqual(creepStep({ x: 0, y: 0 }, { x: 10, y: 0 }, 100, 500), { x: 10, y: 0 });
  const st = homingStep({ x: 0, y: 0 }, 0, { x: 0, y: 100 }, 200, 2, 100);
  assert.ok(Math.abs(st.ang - 0.2) < 1e-9, 'gira como mucho turn·dt');
  const s = chaseSpec(3, 2);
  const o = chaseOrder(s, mulberry32(2));
  assert.equal(o.length, s.creepers + s.homers + s.bolts);
  assert.ok(!(o as string[]).includes('ring'), 'sin anillos');
  for (let i = 1; i < o.length; i++) assert.ok(!(o[i] === 'bolt' && o[i - 1] === 'bolt'));
});
