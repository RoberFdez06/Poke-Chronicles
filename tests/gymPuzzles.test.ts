// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateGymPuzzle, isSolvable, gymPuzzleKind, hasGym, gymTier, rockStep, rockSolved, solveRock, iceSlide, solveIce,
  pressSwitch, electricSolved, ghostCandidates, ghostClueText, DIRS,
  type GymPuzzleKind, type RockPuzzle, type RockState, type Dir,
} from '../src/level/gymPuzzles.ts';

const KINDS: GymPuzzleKind[] = ['roca', 'electrico', 'hielo', 'fantasma'];

test('todo puzzle generado tiene solución (400 semillas por tipo y nivel)', () => {
  for (const k of KINDS) for (let tier = 0; tier <= 2; tier++) for (let s = 0; s < 400; s++) {
    assert.ok(isSolvable(generateGymPuzzle(k, s * 7919 + 13, tier)), `${k} semilla ${s} nivel ${tier}`);
  }
});

test('determinista por semilla', () => {
  for (const k of KINDS) {
    assert.deepEqual(generateGymPuzzle(k, 1234, 1), generateGymPuzzle(k, 1234, 1));
  }
  assert.notDeepEqual(generateGymPuzzle('electrico', 1, 2), generateGymPuzzle('electrico', 2, 2));
});

test('roca: siguiendo la solución BFS se coloca el bloque', () => {
  const p = generateGymPuzzle('roca', 42) as RockPuzzle;
  assert.ok(p.minMoves >= 1);
  // BFS que guarda el camino para comprobar que los pasos de rockStep llevan a la marca
  const key = (s: RockState) => JSON.stringify(s);
  const prev = new Map<string, { from: RockState; d: Dir } | null>([[key(p.start), null]]);
  let frontier = [p.start];
  let end: RockState | null = null;
  while (frontier.length && !end) {
    const next: RockState[] = [];
    for (const s of frontier) {
      if (rockSolved(p, s)) { end = s; break; }
      for (const d of DIRS) {
        const n = rockStep(p.board, s, d);
        if (!prev.has(key(n))) { prev.set(key(n), { from: s, d }); next.push(n); }
      }
    }
    frontier = next;
  }
  assert.ok(end);
  const path: Dir[] = [];
  for (let s = end!; prev.get(key(s)); s = prev.get(key(s))!.from) path.unshift(prev.get(key(s))!.d);
  assert.equal(path.length, p.minMoves);
  let s = p.start;
  for (const d of path) s = rockStep(p.board, s, d);
  assert.ok(rockSolved(p, s));
});

test('roca: no se empuja contra la pared y sin salida da -1', () => {
  const board = { w: 3, h: 1, walls: [false, false, false] };
  const s = { player: { x: 1, y: 0 }, block: { x: 2, y: 0 } };
  assert.deepEqual(rockStep(board, s, 'right'), s);
  assert.equal(solveRock(board, { player: { x: 0, y: 0 }, block: { x: 1, y: 0 } }, { x: 0, y: 0 }), -1);
});

test('hielo: resbala hasta chocar y se para en la salida', () => {
  const board = { w: 5, h: 1, walls: [false, false, false, false, true] };
  assert.deepEqual(iceSlide(board, { x: 0, y: 0 }, 'right', { x: 9, y: 9 }), { x: 3, y: 0 });
  assert.deepEqual(iceSlide(board, { x: 0, y: 0 }, 'right', { x: 2, y: 0 }), { x: 2, y: 0 });
  assert.equal(solveIce(board, { x: 0, y: 0 }, { x: 2, y: 0 }), 1);
});

test('eléctrico: un fallo reinicia la secuencia', () => {
  const p = generateGymPuzzle('electrico', 7, 0);
  assert.equal(p.kind, 'electrico');
  if (p.kind !== 'electrico') return;
  let prog = 0;
  const wrong = p.order.find((i) => i !== p.order[0])!;
  prog = pressSwitch(p, prog, p.order[0]);
  assert.equal(prog, 1);
  assert.equal(pressSwitch(p, prog, wrong === p.order[1] ? p.order[0] : wrong), 0);
  prog = 0;
  for (const i of p.order) prog = pressSwitch(p, prog, i);
  assert.ok(electricSolved(p, prog));
});

test('fantasma: las pistas dejan una sola puerta y tienen texto', () => {
  for (let s = 0; s < 200; s++) {
    const p = generateGymPuzzle('fantasma', s, 2);
    if (p.kind !== 'fantasma') continue;
    assert.deepEqual(ghostCandidates(p), [p.real]);
    for (const c of p.clues) assert.ok(ghostClueText(c).length > 0);
  }
});

test('tipo por bioma, cuándo hay gimnasio y nivel', () => {
  assert.equal(gymPuzzleKind('cueva', 0), 'roca');
  assert.equal(gymPuzzleKind('ciudad', 0), 'electrico');
  assert.equal(gymPuzzleKind('nieve', 0), 'hielo');
  assert.equal(gymPuzzleKind('torre', 0), 'fantasma');
  assert.ok(KINDS.includes(gymPuzzleKind('desconocido', 5)));
  assert.ok(hasGym('normal', 'boss', false));
  assert.ok(hasGym('tower', 'boss', false));
  assert.ok(!hasGym('normal', 'combat', false));
  assert.ok(!hasGym('normal', 'boss', true));
  assert.ok(!hasGym('waves', 'boss', false));
  assert.equal(gymTier('normal', 1), 0);
  assert.equal(gymTier('tower', 100), 2);
});
