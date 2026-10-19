// Ejecutar con `npm test`. Fija los rangos del equilibrio (T32): si alguien cambia un número y se sale, falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedFinaleRunTickets, expectedFloorRewards, expectedRunRewards, simulateRuns, SIM_DEFAULTS } from '../src/data/balance.ts';
import { FLOOR_COUNT, difficultyFor } from '../src/level/progression.ts';
import { PULL_COST, PULL10_COST } from '../src/data/gacha.ts';
import { bossStats, AVERAGE_STATS } from '../src/data/pokeStats.ts';
import { BASE_STATS } from '../src/data/items.ts';
import { BOSS_PHASE2_AT, MAX_HELPERS, attackInterval, bossAttacks, bossPhase, helpersToSummon, mixBehaviors, pickAttack, ringCount } from '../src/data/bossPatterns.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('tickets: una buena partida da para varias tiradas del gacha (x1 = 10), sin pasarse', () => {
  // Contando salas, minijefe y jefe de cada piso
  const full = expectedRunRewards(FLOOR_COUNT).tickets;
  const floor3 = expectedRunRewards(3).tickets;
  const floor1 = expectedRunRewards(1).tickets;
  assert.ok(floor1 >= 5 && floor1 < PULL_COST * 2.5, `solo el piso 1: ${floor1}`);
  assert.ok(floor3 / PULL_COST >= 5 && floor3 / PULL_COST <= 8, `hasta el piso 3: ${floor3}`);
  assert.ok(full / PULL_COST >= 10 && full / PULL_COST <= 16, `partida completa: ${full}`);
  // Ni con el reto final llega a tres tiradas x10 (ahora se ganan 2 por sala y 2 × piso por jefe)
  const finale = expectedFinaleRunTickets();
  assert.ok(finale > full && finale < 3 * PULL10_COST, `con el reto final: ${finale}`);
  // La simulación (que muere más que un jugador real) da al menos una tirada de media
  assert.ok(simulateRuns(400, 3).tickets >= PULL_COST, 'simulación');
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
  // T26: los invocadores tienen 3 ataques; nadie pasa de 3
  assert.deepEqual(bossAttacks(['psychic']), ['ring', 'rain', 'summon']);
  assert.deepEqual(bossAttacks(['ghost', 'dark']), ['ring', 'charge', 'summon']);
  assert.deepEqual(bossAttacks(['fire']), ['ring', 'rain']);
  for (const t of ['fire', 'water', 'rock', 'psychic', 'dragon', 'steel', 'ghost', 'grass', 'ice']) assert.ok(bossAttacks([t]).length <= 3, t);
  assert.equal(helpersToSummon(1, 0), 2);
  assert.ok(helpersToSummon(2, 0) > helpersToSummon(1, 0));
  assert.equal(helpersToSummon(2, MAX_HELPERS - 1), 1);
  assert.equal(helpersToSummon(1, MAX_HELPERS), 0);
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

test('simulación (T25): determinista, el piso 1 se supera casi siempre y cada piso es más duro', () => {
  const a = simulateRuns(400, 3);
  assert.deepEqual(simulateRuns(400, 3), a);
  assert.ok(a.floors[0].cleared >= 0.85, `piso 1: ${a.floors[0].cleared}`);
  for (let k = 1; k < a.floors.length; k++) {
    assert.ok(a.floors[k].reached <= a.floors[k - 1].reached);
    if (a.floors[k].reached > 0.05) assert.ok(a.floors[k].roomDamage > a.floors[k - 1].roomDamage, `piso ${k + 1}`);
  }
  // Esquivar más o tener mejoras ayuda
  const easy = simulateRuns(400, 3, { ...SIM_DEFAULTS, hitsPerSecond: SIM_DEFAULTS.hitsPerSecond / 2, baseDps: SIM_DEFAULTS.baseDps * 1.4 });
  assert.ok(easy.floors[2].cleared > a.floors[2].cleared);
});
