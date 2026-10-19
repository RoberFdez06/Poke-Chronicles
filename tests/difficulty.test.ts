// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  DIFFICULTY_MODS,
  applyDifficulty,
  isDifficulty,
  recordsKeyFor,
  scaleHeal,
  scaleTickets,
  withDifficulty,
} from '../src/data/difficulty.ts';
import { difficultyFor } from '../src/level/progression.ts';
import { loadRecords, submitRecord, RECORDS_KEY, type StorageLike } from '../src/data/save.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('tres dificultades en español, ordenadas de más fácil a más difícil', () => {
  assert.deepEqual(DIFFICULTIES.map((d) => DIFFICULTY_LABEL[d]), ['Fácil', 'Normal', 'Difícil']);
  assert.ok(isDifficulty('hard'));
  assert.ok(!isDifficulty('imposible'));
  const [e, n, h] = DIFFICULTIES.map((d) => DIFFICULTY_MODS[d]);
  assert.deepEqual(n, { enemyHp: 1, enemyDamage: 1, heal: 1, tickets: 1 });
  assert.ok(e.enemyHp < 1 && e.enemyDamage < 1 && e.heal > 1 && e.tickets < 1);
  assert.ok(h.enemyHp > 1 && h.enemyDamage > 1 && h.heal < 1 && h.tickets > 1);
});

test('vida y daño enemigos según la dificultad; Normal no cambia nada', () => {
  const base = difficultyFor(3);
  assert.deepEqual(applyDifficulty(base, 'normal'), base);
  const hard = applyDifficulty(base, 'hard');
  assert.ok(hard.hp > base.hp && hard.damage > base.damage);
  assert.equal(hard.speed, base.speed);
  assert.deepEqual(hard.enemies, base.enemies);
  assert.ok(applyDifficulty(base, 'easy').hp < base.hp);
});

test('curas y tickets', () => {
  assert.equal(scaleHeal(20, 'normal'), 20);
  assert.equal(scaleHeal(20, 'easy'), 26);
  assert.equal(scaleHeal(20, 'hard'), 16);
  assert.equal(scaleHeal(1, 'hard'), 1);
  assert.equal(scaleHeal(0, 'easy'), 0);
  // Normal da lo mismo siempre; Difícil 1,5 de media; Fácil la mitad de media
  for (const n of [1, 2, 5, 60]) assert.equal(scaleTickets(n, 'normal'), n);
  const avg = (n: number, d: 'easy' | 'hard') => {
    const rng = mulberry32(9);
    let t = 0;
    for (let i = 0; i < 2000; i++) t += scaleTickets(n, d, rng);
    return t / 2000;
  };
  assert.ok(Math.abs(avg(1, 'hard') - 1.5) < 0.05);
  assert.ok(Math.abs(avg(1, 'easy') - 0.5) < 0.05);
  assert.equal(scaleTickets(4, 'hard'), 6);
  assert.equal(scaleTickets(0, 'hard'), 0);
});

test('récords separados por dificultad (Normal sigue en la clave de siempre)', () => {
  const s = fakeStorage();
  assert.equal(recordsKeyFor(RECORDS_KEY, 'normal'), RECORDS_KEY);
  assert.notEqual(recordsKeyFor(RECORDS_KEY, 'hard'), RECORDS_KEY);
  assert.equal(submitRecord('normal', 3, s), true);
  assert.equal(submitRecord('normal', 1, s, 'hard'), true);
  assert.equal(loadRecords(s).normal, 3);
  assert.equal(loadRecords(s, 'hard').normal, 1);
  assert.equal(loadRecords(s, 'easy').normal, 0);
});

test('nombre del modo con la dificultad', () => {
  assert.equal(withDifficulty('Infinito', 'normal'), 'Infinito');
  assert.equal(withDifficulty('Infinito', 'hard'), 'Infinito (Difícil)');
});
