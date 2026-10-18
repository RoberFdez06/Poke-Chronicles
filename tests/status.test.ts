// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_MIN_SPEED,
  PARALYSIS_STUN,
  STATUS_BY_TYPE,
  STATUS_EFFECTS,
  TICK_MS,
  applyStatus,
  drainHeal,
  isConfused,
  speedMultiplier,
  statusForType,
  statusTint,
  tickStatuses,
  enemyDamageMul,
  extraPierce,
  hitDamageMul,
  isFeared,
  FURY_BONUS,
  KNOCKBACK_FORCE,
  WEAKEN_FACTOR,
} from '../src/data/status.ts';
import { TYPE_COLORS } from '../src/data/types.ts';

test('cada tipo de la tabla existe y aplica el estado que toca', () => {
  for (const t of Object.keys(STATUS_BY_TYPE)) assert.ok(t in TYPE_COLORS, t);
  assert.equal(statusForType('fire')?.kind, 'burn');
  assert.equal(statusForType('ice')?.kind, 'freeze');
  assert.equal(statusForType('electric')?.kind, 'paralysis');
  assert.equal(statusForType('poison')?.kind, 'poison');
  assert.equal(statusForType('grass')?.kind, 'drain');
  assert.equal(statusForType('normal')?.kind, 'stun');
  assert.equal(statusForType('desconocido'), null);
});

test('quemar hace daño en el tiempo y se acaba', () => {
  let list = applyStatus([], STATUS_EFFECTS.burn, 0, 40);
  assert.equal(list.length, 1);
  assert.equal(list[0].dps, 10);
  let total = 0;
  for (let t = 0; t <= 4000; t += 100) {
    const r = tickStatuses(list, t);
    total += r.damage;
    list = r.list;
  }
  // 3 s a 10 de daño por segundo
  assert.equal(Math.round(total), 30);
  assert.equal(list.length, 0);
});

test('un salto grande de tiempo hace todos los ticks pendientes, sin pasarse del final', () => {
  const list = applyStatus([], STATUS_EFFECTS.poison, 0, 20);
  const r = tickStatuses(list, 60000);
  assert.equal(Math.round(r.damage), Math.round(20 * 0.15 * 5));
  assert.equal(r.list.length, 0);
  assert.equal(tickStatuses(list, TICK_MS - 1).damage, 0);
});

test('reaplicar renueva la duración sin duplicar', () => {
  let list = applyStatus([], STATUS_EFFECTS.burn, 0, 10);
  list = applyStatus(list, STATUS_EFFECTS.burn, 2000, 40);
  assert.equal(list.length, 1);
  assert.equal(list[0].until, 2000 + STATUS_EFFECTS.burn.duration);
  assert.equal(list[0].dps, 10);
  list = applyStatus(list, STATUS_EFFECTS.freeze, 2100, 10);
  assert.equal(list.length, 2);
});

test('los instantáneos (drenar, empujar) no se guardan', () => {
  assert.deepEqual(applyStatus([], STATUS_EFFECTS.drain, 0, 50), []);
  assert.deepEqual(applyStatus([], STATUS_EFFECTS.knockback, 0, 50), []);
  assert.equal(drainHeal(50), 15);
  assert.equal(drainHeal(1), 1);
});

test('congelar ralentiza; paralizar para a ratos; los jefes resisten', () => {
  const frozen = applyStatus([], STATUS_EFFECTS.freeze, 0, 10);
  assert.equal(speedMultiplier(frozen, 100), STATUS_EFFECTS.freeze.slow);
  assert.equal(speedMultiplier(frozen, 100, true), BOSS_MIN_SPEED);
  assert.equal(speedMultiplier(frozen, 99999), 1);
  const para = applyStatus([], STATUS_EFFECTS.paralysis, 0, 10);
  assert.equal(speedMultiplier(para, PARALYSIS_STUN - 1), 0);
  assert.equal(speedMultiplier(para, PARALYSIS_STUN + 1), STATUS_EFFECTS.paralysis.slow);
  assert.equal(speedMultiplier(para, PARALYSIS_STUN - 1, true), BOSS_MIN_SPEED);
  assert.equal(speedMultiplier([], 0), 1);
});

test('confusión y tinte', () => {
  const list = applyStatus([], STATUS_EFFECTS.confuse, 0, 10);
  assert.ok(isConfused(list, 100));
  assert.ok(!isConfused(list, 99999));
  assert.equal(statusTint(list, 100), STATUS_EFFECTS.confuse.color);
  assert.equal(statusTint([], 100), null);
});

test('todos los tipos tienen efecto', () => {
  for (const t of Object.keys(TYPE_COLORS)) assert.ok(statusForType(t), `${t} sin efecto`);
  assert.equal(Object.keys(STATUS_BY_TYPE).length, Object.keys(TYPE_COLORS).length);
  for (const k of Object.values(STATUS_BY_TYPE)) assert.ok(STATUS_EFFECTS[k!].label.length > 2);
});

test('Volador empuja más que Lucha; Dragón pega más; Acero atraviesa', () => {
  assert.equal(statusForType('flying')?.kind, 'gust');
  assert.ok(KNOCKBACK_FORCE.gust! > KNOCKBACK_FORCE.knockback!);
  assert.equal(hitDamageMul('dragon'), FURY_BONUS);
  assert.equal(hitDamageMul('fire'), 1);
  assert.equal(extraPierce('steel'), 1);
  assert.equal(extraPierce('water'), 0);
});

test('Siniestro asusta, Hada debilita y Normal aturde', () => {
  const fear = applyStatus([], STATUS_EFFECTS.fear, 0, 10);
  assert.ok(isFeared(fear, 1000));
  assert.ok(!isFeared(fear, 1600));
  const weak = applyStatus([], STATUS_EFFECTS.weaken, 0, 10);
  assert.equal(enemyDamageMul(weak, 100), WEAKEN_FACTOR);
  assert.equal(enemyDamageMul([], 100), 1);
  const stun = applyStatus([], STATUS_EFFECTS.stun, 0, 10);
  assert.equal(speedMultiplier(stun, 100), 0);
  assert.equal(speedMultiplier(stun, 400), 1);
  assert.equal(speedMultiplier(stun, 100, true), BOSS_MIN_SPEED);
});
