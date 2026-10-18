// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVERAGE_STATS,
  PLAYER_LIMITS,
  STAT_KEYS,
  STAT_LABEL,
  bossStats,
  BOSS_BASE,
  parseApiStats,
  playerBaseStats,
  shapeEnemyStats,
  statBar,
  statTotal,
  type BaseStats,
} from '../src/data/pokeStats.ts';
import { BASE_STATS, computeStats } from '../src/data/items.ts';
import { difficultyFor } from '../src/level/progression.ts';

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const all = (v: number): BaseStats => ({ hp: v, attack: v, defense: v, spAttack: v, spDefense: v, speed: v });

test('lee las estadísticas de PokeAPI', () => {
  const api = [
    { base_stat: 45, stat: { name: 'hp' } },
    { base_stat: 49, stat: { name: 'attack' } },
    { base_stat: 49, stat: { name: 'defense' } },
    { base_stat: 65, stat: { name: 'special-attack' } },
    { base_stat: 65, stat: { name: 'special-defense' } },
    { base_stat: 45, stat: { name: 'speed' } },
  ];
  assert.deepEqual(parseApiStats(api), { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 });
  assert.deepEqual(parseApiStats(undefined), AVERAGE_STATS);
  assert.equal(statTotal(parseApiStats(api)), 318);
  for (const k of STAT_KEYS) assert.ok(STAT_LABEL[k]);
});

test('el Pokémon medio juega como antes', () => {
  const s = playerBaseStats(AVERAGE_STATS);
  for (const k of Object.keys(BASE_STATS) as (keyof typeof BASE_STATS)[]) {
    const v = BASE_STATS[k];
    if (typeof v === 'number') assert.ok(close(s[k] as number, v), k);
    else assert.deepEqual(s[k], v, k);
  }
});

test('cada estadística mueve lo suyo', () => {
  const avg = playerBaseStats(AVERAGE_STATS);
  const tanky = playerBaseStats({ ...AVERAGE_STATS, hp: 120, defense: 120, spDefense: 120 });
  assert.ok(tanky.maxHp > avg.maxHp);
  assert.ok(tanky.damageTaken < 1);
  const hitter = playerBaseStats({ ...AVERAGE_STATS, attack: 120, spAttack: 120 });
  assert.ok(hitter.damage > avg.damage && hitter.powerMul > 1);
  const fast = playerBaseStats({ ...AVERAGE_STATS, speed: 120 });
  assert.ok(fast.speed > avg.speed && fast.fireDelay < avg.fireDelay);
});

test('los extremos tienen límites', () => {
  const huge = playerBaseStats(all(255));
  const tiny = playerBaseStats(all(1));
  assert.equal(huge.maxHp, Math.round(BASE_STATS.maxHp * PLAYER_LIMITS.hp[1]));
  assert.equal(tiny.maxHp, Math.round(BASE_STATS.maxHp * PLAYER_LIMITS.hp[0]));
  assert.ok(close(huge.damageTaken, PLAYER_LIMITS.damageTaken[0]));
  assert.ok(close(tiny.damageTaken, PLAYER_LIMITS.damageTaken[1]));
  assert.ok(huge.speed <= BASE_STATS.speed * PLAYER_LIMITS.speed[1] + 1e-9);
  assert.ok(tiny.powerMul >= PLAYER_LIMITS.spAttack[0]);
});

test('los objetos pasivos se aplican encima de las del Pokémon', () => {
  const base = playerBaseStats({ ...AVERAGE_STATS, hp: 120 });
  const s = computeStats(['baya-aranja'], base);
  assert.equal(s.maxHp, base.maxHp + 20);
  assert.ok(close(computeStats(['vidasfera'], base).damage, base.damage * 1.3));
});

test('los enemigos reparten su fuerza según sus estadísticas', () => {
  const st = { hp: 60, damage: 10, speed: 80 };
  assert.deepEqual(shapeEnemyStats(st, all(50)), st);
  const wall = shapeEnemyStats(st, { ...all(50), hp: 150, attack: 20 });
  assert.ok(wall.hp > st.hp && wall.damage < st.damage);
  const quick = shapeEnemyStats(st, { ...all(50), speed: 150 });
  assert.ok(quick.speed > st.speed);
  const b1 = bossStats(all(100), difficultyFor(1));
  const b3 = bossStats(all(100), difficultyFor(3));
  assert.equal(b1.hp, BOSS_BASE.hp);
  assert.ok(b3.hp > b1.hp && b3.damage > b1.damage);
});

test('barras de estadísticas entre 0 y 1', () => {
  assert.ok(statBar(255) === 1 && statBar(0) > 0 && statBar(90) === 0.5);
});
