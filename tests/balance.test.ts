// Ejecutar con `npm test`. Fija los rangos del equilibrio (T32): si alguien cambia un número y se sale, falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedFloorRewards, expectedRunRewards } from '../src/data/balance.ts';
import { FLOOR_COUNT, difficultyFor } from '../src/level/progression.ts';
import { PULL_COST } from '../src/data/gacha.ts';
import { bossStats, AVERAGE_STATS } from '../src/data/pokeStats.ts';
import { BASE_STATS } from '../src/data/items.ts';
import { BOSS_PHASE2_AT, attackInterval, bossAttacks, bossPhase, mixBehaviors, pickAttack, ringCount } from '../src/data/bossPatterns.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('tickets: una tirada del gacha cada 2-3 partidas buenas', () => {
  const full = expectedRunRewards(FLOOR_COUNT).tickets;
  const floor3 = expectedRunRewards(3).tickets;
  assert.ok(full >= 40 && full <= 70, `partida completa: ${full}`);
  assert.ok(floor3 >= 15 && floor3 <= 40, `hasta el piso 3: ${floor3}`);
  const good = (full + floor3) / 2;
  assert.ok(PULL_COST / good >= 2 && PULL_COST / good <= 3, `partidas por tirada: ${PULL_COST / good}`);
});

test('monedas: la tienda obliga a elegir', () => {
  // Poción 5 + Superpoción 12 + objeto 15 = 32: no da para todo en un piso
  for (let f = 1; f <= FLOOR_COUNT; f++) {
    const c = expectedFloorRewards(f).coins;
    assert.ok(c >= 8 && c < 32, `piso ${f}: ${c}`);
  }
});

test('bayas: un premio raro, 1-2 por piso de media', () => {
  let total = 0;
  for (let f = 1; f <= FLOOR_COUNT; f++) total += expectedFloorRewards(f).berries;
  const avg = total / FLOOR_COUNT;
  assert.ok(avg >= 1 && avg <= 2, `${avg}`);
});

test('un jefe del piso 1 dura 30-60 s con un personaje normal sin mejoras', () => {
  // Disparo base y un poder de potencia 60, acertando el 70 % (lo mismo que scripts/simulate.ts)
  const dps = (BASE_STATS.damage / (BASE_STATS.fireDelay / 1000) + (60 * 0.5 * 1.2) / 1.08) * 0.7;
  const s = bossStats(AVERAGE_STATS, difficultyFor(1)).hp / dps;
  assert.ok(s >= 30 && s <= 60, `${s}`);
});

test('cada jefe tiene al menos dos ataques y una segunda fase', () => {
  for (const t of ['fire', 'water', 'rock', 'psychic', 'dragon', 'steel', 'ghost']) {
    const a = bossAttacks([t]);
    assert.ok(a.length >= 2 && a.includes('ring'), t);
  }
  assert.deepEqual(bossAttacks(['dragon', 'flying']), ['ring', 'charge', 'rain']);
  assert.equal(bossPhase(1), 1);
  assert.equal(bossPhase(BOSS_PHASE2_AT - 0.01), 2);
  assert.ok(attackInterval(2) < attackInterval(1));
  assert.ok(ringCount(2) > ringCount(1));
  const rng = mulberry32(2);
  for (let i = 0; i < 20; i++) assert.notEqual(pickAttack(['ring', 'rain'], rng, 'ring'), 'ring');
  assert.equal(pickAttack(['ring'], rng, 'ring'), 'ring');
});

test('al menos uno de cada tres enemigos dispara', () => {
  const room = mixBehaviors(['chase', 'chase', 'charge', 'hop', 'chase', 'chase', 'chase']);
  assert.ok(room.filter((b) => b === 'shoot').length >= 3);
  assert.deepEqual(mixBehaviors(['shoot', 'chase', 'chase']), ['shoot', 'chase', 'chase']);
  assert.deepEqual(mixBehaviors([]), []);
});
