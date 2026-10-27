import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickStarterMoves, starterMoveCount } from '../src/data/items.ts';

const mv = (id: number, type: string, power: number) => ({ id, name: `m${id}`, type, power });
const pool = [mv(1, 'water', 40), mv(2, 'water', 60), mv(3, 'water', 90), mv(4, 'water', 110), mv(5, 'ice', 55), mv(6, 'ice', 95)];
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };

test('Rush de jefes empieza con 2 especiales; los demás modos con 1', () => {
  assert.equal(starterMoveCount('bossrush'), 2);
  for (const m of ['normal', 'daily', 'tower', 'endless']) assert.equal(starterMoveCount(m), 1);
});

test('con 2: uno ligero y uno pesado del tipo principal, sin repetir', () => {
  for (let k = 0; k < 20; k++) {
    const r = Math.random;
    const out = pickStarterMoves(pool, 2, r, 'water');
    assert.equal(out.length, 2);
    assert.ok(out[0].power < 75 && out[0].type === 'water');
    assert.ok(out[1].power >= 75 && out[1].type === 'water');
    assert.notEqual(out[0].id, out[1].id);
  }
});

test('con 2 sin movimientos pesados: completa con otro distinto', () => {
  const out = pickStarterMoves([mv(1, 'fire', 40), mv(2, 'fire', 50)], 2, seq(0, 0.9), 'fire');
  assert.deepEqual(out.map((m) => m.id).sort(), [1, 2]);
});

test('con 2 y un solo movimiento: devuelve uno; pool vacío: ninguno; no toca el pool', () => {
  assert.equal(pickStarterMoves([mv(1, 'fire', 40)], 2, Math.random).length, 1);
  assert.equal(pickStarterMoves([], 2, Math.random).length, 0);
  const copy = [...pool];
  pickStarterMoves(pool, 2, Math.random, 'water');
  assert.deepEqual(pool, copy);
});

test('con 1: como siempre, uno común/raro (nunca épico ni legendario si hay otros)', () => {
  for (let k = 0; k < 20; k++) assert.ok(pickStarterMoves(pool, 1, Math.random)[0].power < 70);
});
