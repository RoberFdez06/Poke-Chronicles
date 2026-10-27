import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_SAFE_TELEPORT_DIST,
  BOSS_TELEPORT_GRACE_MS,
  PHASE_INVULN_MAX_MS,
  canBossTeleport,
  circleHitsRect,
  clearOfRects,
  extendGrace,
  nearestClearPoint,
  phaseShieldActive,
  phaseShieldStuck,
  pickSafeSpot,
  shiftTimers,
} from '../src/data/bossSafety.ts';
import { clampFinaleHp, finaleHpFloor, finalePhaseFor, nextFinalePhase, type FinalePhase } from '../src/data/finalePhases.ts';

test('el jefe no se teletransporta durante el respiro ni congelado', () => {
  const g = extendGrace(undefined, 1000);
  assert.equal(g, 1000 + BOSS_TELEPORT_GRACE_MS);
  assert.equal(canBossTeleport(1500, g, false), false);
  assert.equal(canBossTeleport(g, g, false), true);
  assert.equal(canBossTeleport(g + 10, g, true), false);
  // Un respiro nuevo nunca acorta el que ya había
  assert.equal(extendGrace(99999, 1000, 10), 99999);
  assert.ok(BOSS_TELEPORT_GRACE_MS >= 3000, 'respiro largo');
});

test('pickSafeSpot: libre y a distancia segura; si no cabe, el libre más lejano', () => {
  const player = { x: 0, y: 0 };
  const cands = [{ x: 50, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 0 }];
  assert.deepEqual(pickSafeSpot(cands, player, BOSS_SAFE_TELEPORT_DIST, () => true), { x: 300, y: 0 });
  // La de 300 está ocupada: la de 400
  assert.deepEqual(pickSafeSpot(cands, player, 220, (p) => p.x !== 300), { x: 400, y: 0 });
  // Ninguna lejos: la más lejana libre
  assert.deepEqual(pickSafeSpot([{ x: 10, y: 0 }, { x: 90, y: 0 }], player, 220, () => true), { x: 90, y: 0 });
  assert.equal(pickSafeSpot(cands, player, 220, () => false), undefined);
  assert.ok(BOSS_SAFE_TELEPORT_DIST >= 220);
});

test('trampilla: el centro si está libre; si no, la casilla libre más cercana', () => {
  const ideal = { x: 500, y: 300 };
  assert.deepEqual(nearestClearPoint(ideal, () => true, 40, 5), ideal);
  // Columna en el centro (unión de salas 2x2): bloquea un cuadrado de 100 px
  const block = { x: 450, y: 250, w: 100, h: 100 };
  const p = nearestClearPoint(ideal, (q) => clearOfRects(q, 40, [block]), 40, 10)!;
  assert.ok(p, 'encuentra sitio');
  assert.ok(clearOfRects(p, 40, [block]), 'no toca el bloque');
  // Y es de las más cercanas posibles (a 3 pasos: 50 de medio bloque + 40 de radio)
  assert.ok(Math.hypot(p.x - ideal.x, p.y - ideal.y) <= 40 * 3 * Math.SQRT2 + 1);
  // Sin sitio libre: undefined
  assert.equal(nearestClearPoint(ideal, () => false, 40, 3), undefined);
});

test('círculo contra rectángulo', () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(circleHitsRect({ x: 5, y: 5 }, 1, r), true);
  assert.equal(circleHitsRect({ x: 20, y: 5 }, 5, r), false);
  assert.equal(circleHitsRect({ x: 14, y: 5 }, 5, r), true);
});

test('la invulnerabilidad de fase es breve, tiene tope y el seguro la suelta', () => {
  assert.equal(phaseShieldActive(1000, 1500, 1200), true);
  assert.equal(phaseShieldActive(1000, 1500, 1500), false);
  // Aunque el fin se pierda (o sea enorme), a los PHASE_INVULN_MAX_MS se acaba
  assert.equal(phaseShieldActive(1000, Number.POSITIVE_INFINITY, 1000 + PHASE_INVULN_MAX_MS), false);
  assert.equal(phaseShieldActive(1000, undefined, 1000 + PHASE_INVULN_MAX_MS + 1), false);
  assert.equal(phaseShieldActive(undefined, 5000, 10), false);
  assert.equal(phaseShieldStuck(0, PHASE_INVULN_MAX_MS - 1), false);
  assert.equal(phaseShieldStuck(0, PHASE_INVULN_MAX_MS), true);
  assert.equal(phaseShieldStuck(undefined, 1e9), false);
});

test('al reanudar tras la intro los temporizadores se corren (sin saltos) y los infinitos siguen igual', () => {
  const ai = { until: 100, knockUntil: 0, nextAttack: Number.POSITIVE_INFINITY, eliteAt: 50, graceUntil: undefined };
  shiftTimers(ai, 3000);
  assert.deepEqual(ai, { until: 3100, knockUntil: 3000, nextAttack: Number.POSITIVE_INFINITY, eliteAt: 3050, graceUntil: undefined });
  shiftTimers(ai, -5);
  assert.equal(ai.until, 3100);
});

test('reto final: con la vida en el mínimo de una fase siempre se puede pasar a la siguiente (no se atasca)', () => {
  for (const max of [997, 1000, 1234, 4000, 7]) {
    let ph: FinalePhase = 1;
    let hp = max;
    for (let i = 0; i < 10 && ph < 4; i++) {
      hp = clampFinaleHp(hp - max * 10, ph, max);
      const next = nextFinalePhase(ph, hp / max);
      assert.ok(next, `max ${max}: de la fase ${ph} se pasa a otra (hp ${hp})`);
      ph = next!;
    }
    assert.equal(ph, 4);
    assert.ok(finaleHpFloor(1, max) / max < 0.75);
    assert.ok(finalePhaseFor(finaleHpFloor(2, max) / max) >= 3);
  }
});
