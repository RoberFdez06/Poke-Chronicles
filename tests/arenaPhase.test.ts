// Ejecutar con `npm test`. T78: arenas de jefe que cambian de fase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_AFTER_MEGA_MS, ARENA_WARN_MS, arenaCanStart, arenaKindFor, arenaPhase, arenaStage, megaCanStart } from '../src/level/arenaPhase.ts';
import { allConnected, CENTER_TILES, emptyGrid, parseTemplate, SPAWN_TILES, TEMPLATES, type Grid } from '../src/level/roomLayouts.ts';
import { BIOMES } from '../src/level/biomes.ts';

const apply = (grid: Grid, cells: readonly [number, number][]): Grid => {
  const g = grid.map((r) => [...r]);
  for (const [x, y] of cells) g[y][x] = 'X';
  return g;
};
const grids = (): Grid[] => [emptyGrid(), ...Object.values(TEMPLATES).map((t) => parseTemplate(t))];
const walk = (g: Grid, [x, y]: readonly [number, number]) => g[y][x] === '.' || g[y][x] === 'W';

test('fases al 66 % y al 33 %', () => {
  assert.equal(arenaStage(1), 0);
  assert.equal(arenaStage(0.67), 0);
  assert.equal(arenaStage(0.65), 1);
  assert.equal(arenaStage(0.34), 1);
  assert.equal(arenaStage(0.32), 2);
});

test('siempre queda camino seguro entre puertas, centro y jugador, en las dos fases', () => {
  for (const biome of BIOMES) {
    for (const [gi, grid] of grids().entries()) {
      for (let seed = 1; seed <= 6; seed++) {
        const player: [number, number] = [3 + (seed % 5), 2 + (seed % 7)];
        const p1 = arenaPhase({ grid, biomeId: biome.id, bossTypes: biome.types, stage: 1, seed, player });
        const p2 = arenaPhase({ grid, biomeId: biome.id, bossTypes: biome.types, stage: 2, seed, player, taken: p1.cells });
        const g = apply(grid, [...p1.cells, ...p2.cells]);
        const must = [...SPAWN_TILES, CENTER_TILES[0], player].filter((t) => walk(grid, t));
        assert.ok(allConnected(g, must), `${biome.id} plantilla ${gi} semilla ${seed}`);
      }
    }
  }
});

test('no toca puertas, centro, ni la casilla del jugador o sus vecinas, y solo suelo libre', () => {
  const grid = emptyGrid();
  const player: [number, number] = [4, 3];
  for (let seed = 1; seed < 40; seed++) {
    const p = arenaPhase({ grid, biomeId: 'volcan', bossTypes: ['fire'], stage: 1, seed, player });
    assert.ok(p.cells.length > 0);
    const banned = new Set([...SPAWN_TILES, ...CENTER_TILES].map(([x, y]) => `${x},${y}`));
    for (const [x, y] of p.cells) {
      assert.ok(!banned.has(`${x},${y}`));
      assert.ok(Math.abs(x - player[0]) > 1 || Math.abs(y - player[1]) > 1);
      assert.equal(grid[y][x], '.');
    }
  }
});

test('determinista por semilla y sin repetir casillas de la fase anterior', () => {
  const grid = parseTemplate(Object.values(TEMPLATES)[1]);
  const a = arenaPhase({ grid, biomeId: 'mar', bossTypes: ['water'], stage: 1, seed: 42, player: [5, 5] });
  const b = arenaPhase({ grid, biomeId: 'mar', bossTypes: ['water'], stage: 1, seed: 42, player: [5, 5] });
  assert.deepEqual(a, b);
  const c = arenaPhase({ grid, biomeId: 'mar', bossTypes: ['water'], stage: 2, seed: 42, player: [5, 5], taken: a.cells });
  const seen = new Set(a.cells.map(([x, y]) => `${x},${y}`));
  assert.ok(c.cells.every(([x, y]) => !seen.has(`${x},${y}`)));
});

test('el tipo del jefe manda en la primera fase y la segunda es distinta', () => {
  assert.equal(arenaKindFor('bosque', ['water'], 1, 1), 'inundacion');
  assert.equal(arenaKindFor('bosque', ['fire'], 1, 1), 'grietas');
  for (const b of BIOMES) for (let s = 0; s < 10; s++) assert.notEqual(arenaKindFor(b.id, b.types, 1, s), arenaKindFor(b.id, b.types, 2, s));
});

test('coordinación con la megaevolución: nunca a la vez', () => {
  const MEGA = 1500;
  assert.ok(arenaCanStart(1000, undefined, MEGA));
  assert.ok(!arenaCanStart(1000, 900, MEGA));
  assert.ok(!arenaCanStart(900 + MEGA + ARENA_AFTER_MEGA_MS - 1, 900, MEGA));
  assert.ok(arenaCanStart(900 + MEGA + ARENA_AFTER_MEGA_MS, 900, MEGA));
  assert.ok(megaCanStart(10, undefined));
  assert.ok(!megaCanStart(500, 400));
  assert.ok(megaCanStart(400 + ARENA_WARN_MS, 400));
});
