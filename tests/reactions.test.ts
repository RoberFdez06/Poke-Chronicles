import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, canReact, consumeStatus, discover, discoveredLine, findReaction, reactionDamage, REACTION_COOLDOWN } from '../src/data/reactions.ts';
import { STATUS_EFFECTS, applyStatus, type ActiveStatus } from '../src/data/status.ts';
import { SHOT_TYPES as TYPES } from '../src/data/sounds.ts';

const withStatus = (kind: keyof typeof STATUS_EFFECTS, now = 0): ActiveStatus[] => applyStatus([], STATUS_EFFECTS[kind], now, 10);

test('hay 8 reacciones, sin repetir, con estados que duran y tipos válidos', () => {
  assert.equal(REACTIONS.length, 8);
  assert.equal(new Set(REACTIONS.map((r) => r.id)).size, 8);
  assert.equal(new Set(REACTIONS.map((r) => r.status + r.attackType)).size, 8);
  for (const r of REACTIONS) {
    assert.ok(STATUS_EFFECTS[r.status].duration > 0, r.id);
    assert.ok((TYPES as readonly string[]).includes(r.attackType), r.id);
    assert.ok(r.name.startsWith('¡') && r.name.length <= 20, r.id);
  }
});

test('los ejemplos de la tarea reaccionan', () => {
  assert.equal(findReaction(withStatus('soak'), 'electric', 100)?.id, 'descarga');
  assert.equal(findReaction(withStatus('soak'), 'ice', 100)?.applies, 'freeze');
  assert.equal(findReaction(withStatus('burn'), 'water', 100)?.id, 'vapor');
  assert.equal(findReaction(withStatus('poison'), 'fire', 100)?.id, 'toxica');
  assert.equal(findReaction(withStatus('freeze'), 'fire', 100)?.id, 'deshielo');
  assert.equal(findReaction(withStatus('freeze'), 'fighting', 100)?.id, 'anicos');
});

test('sin estado, con el mismo tipo o con el estado acabado no hay reacción', () => {
  assert.equal(findReaction([], 'electric', 0), null);
  assert.equal(findReaction(withStatus('burn'), 'fire', 100), null);
  assert.equal(findReaction(withStatus('soak', 0), 'electric', STATUS_EFFECTS.soak.duration + 1), null);
});

test('una reacción por enemigo cada 1,5 s', () => {
  assert.ok(canReact(undefined, 0));
  assert.ok(!canReact(1000, 1000 + REACTION_COOLDOWN - 1));
  assert.ok(canReact(1000, 1000 + REACTION_COOLDOWN));
});

test('los jefes aguantan la mitad del daño y gasta el estado', () => {
  const r = REACTIONS[0];
  assert.equal(reactionDamage(r, 10, true), reactionDamage(r, 10, false) / 2);
  assert.ok(reactionDamage(r, 0, false) >= 1);
  assert.equal(consumeStatus(withStatus('soak'), r).length, 0);
});

test('descubiertas sin repetir y línea de la pausa', () => {
  let f = discover([], 'vapor');
  f = discover(f, 'descarga');
  f = discover(f, 'vapor');
  assert.deepEqual(f, ['descarga', 'vapor']);
  assert.match(discoveredLine(f), /2\/8.*Descarga · Vapor/);
  assert.match(discoveredLine([]), /ninguna/);
});
