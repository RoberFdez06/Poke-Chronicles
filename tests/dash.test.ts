import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canDash, dashCooldownLeft, dashDirection, dashEnd, dashing, dashInvulnerable, dashSpeed, newDash, startDash,
  DASH_COOLDOWN_MS, DASH_DISTANCE, DASH_INVULN_MS, DASH_MS,
} from '../src/data/dash.ts';

test('valores: impulso corto, ~0,25 s de invulnerabilidad y ~1,2 s de recarga', () => {
  assert.ok(DASH_INVULN_MS >= 200 && DASH_INVULN_MS <= 300);
  assert.ok(DASH_COOLDOWN_MS >= 1000 && DASH_COOLDOWN_MS <= 1500);
  assert.ok(DASH_MS <= DASH_INVULN_MS);
  assert.ok(Math.abs(dashSpeed() * (DASH_MS / 1000) - DASH_DISTANCE) < 1e-9);
});

test('dirección: la del movimiento; quieto, la de la mirada; siempre de largo 1', () => {
  assert.deepEqual(dashDirection({ x: 0, y: -1 }, { x: 1, y: 0 }), { x: 0, y: -1 });
  const d = dashDirection({ x: 0.05, y: 0 }, { x: 0, y: 3 });
  assert.deepEqual(d, { x: 0, y: 1 });
  const diag = dashDirection({ x: 1, y: 1 }, { x: 0, y: 0 });
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-9);
  assert.deepEqual(dashDirection({ x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 1 });
});

test('recarga, invulnerabilidad e impulso', () => {
  const s = newDash();
  assert.ok(canDash(s, 0));
  const v = startDash(s, 1000, { x: 1, y: 0 }, { x: 0, y: 1 });
  assert.ok(v && v.x > 0 && v.y === 0);
  assert.ok(dashing(s, 1000 + DASH_MS - 1));
  assert.ok(!dashing(s, 1000 + DASH_MS));
  assert.ok(dashInvulnerable(s, 1000 + DASH_INVULN_MS - 1));
  assert.ok(!dashInvulnerable(s, 1000 + DASH_INVULN_MS));
  assert.equal(startDash(s, 1000 + DASH_COOLDOWN_MS - 1, { x: 1, y: 0 }, { x: 1, y: 0 }), null);
  assert.equal(dashCooldownLeft(s, 1000), 1);
  assert.equal(dashCooldownLeft(s, 1000 + DASH_COOLDOWN_MS), 0);
  assert.ok(startDash(s, 1000 + DASH_COOLDOWN_MS, { x: 1, y: 0 }, { x: 1, y: 0 }));
  assert.equal(s.uses, 2);
});

test('no sale de la sala: el final se para en el borde', () => {
  const b = { x0: 0, y0: 0, x1: 400, y1: 300 };
  assert.deepEqual(dashEnd(100, 100, { x: 1, y: 0 }, b, 20), { x: 100 + DASH_DISTANCE, y: 100 });
  const e = dashEnd(350, 100, { x: 1, y: 0 }, b, 20);
  assert.equal(e.x, 380);
  const c = dashEnd(10, 10, { x: -1, y: 0 }, b, 20);
  assert.ok(c.x >= 20 && c.y >= 20);
});
