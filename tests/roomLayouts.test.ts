// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTER_TILES,
  SPAWN_TILES,
  TEMPLATE_NAMES,
  clearSpawnZones,
  COLS,
  DOOR_TILES,
  ROWS,
  TEMPLATES,
  allConnected,
  flowField,
  isWalkable,
  layoutFor,
  nearestWalkable,
  parseTemplate,
  stepToward,
  type Grid,
} from '../src/level/roomLayouts.ts';
import { DIRS } from '../src/level/floorGen.ts';

const mustReach = Object.values(DOOR_TILES).flat().concat(CENTER_TILES);

test('todas las plantillas miden 20 × 12 y solo usan casillas conocidas', () => {
  for (const [name, rows] of Object.entries(TEMPLATES)) {
    assert.equal(rows.length, ROWS, name);
    for (const r of rows) {
      assert.equal(r.length, COLS, `${name}: "${r}"`);
      assert.match(r, /^[.RPBHWX]+$/, name);
    }
  }
});

test('en todas las plantillas (y sus espejos) las puertas y el centro quedan conectados', () => {
  for (const [name, rows] of Object.entries(TEMPLATES)) {
    const g = parseTemplate(rows);
    const variants: Grid[] = [g, g.map((r) => [...r].reverse()), [...g].reverse(), [...g].reverse().map((r) => [...r].reverse())];
    for (const v of variants) assert.ok(allConnected(v, mustReach), name);
  }
});

test('las salas generadas siempre dejan pasar entre puertas (BFS)', () => {
  for (let seed = 0; seed < 300; seed++) {
    for (let room = 0; room < 12; room++) {
      const g = layoutFor(seed * 7919, room, 'combat');
      assert.ok(allConnected(g, mustReach), `semilla ${seed}, sala ${room}`);
      // La casilla de dentro junto a cada puerta también está libre (ahí apareces al entrar)
      // y la de una más hacia dentro, que es donde apareces (a 70 px de la pared)
      const inward = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] } as const;
      for (const d of DIRS) {
        for (const [x, y] of DOOR_TILES[d]) {
          assert.ok(isWalkable(g[y][x]));
          assert.ok(isWalkable(g[y + inward[d][1]][x + inward[d][0]]), `${d} semilla ${seed}`);
        }
      }
    }
  }
});

test('el diseño depende de la semilla y solo hay obstáculos en salas de combate', () => {
  assert.deepEqual(layoutFor(5, 2, 'combat'), layoutFor(5, 2, 'combat'));
  const kinds = new Set<string>();
  for (let s = 0; s < 40; s++) kinds.add(JSON.stringify(layoutFor(s, 1, 'combat')));
  assert.ok(kinds.size > 4);
  for (const kind of ['start', 'item', 'boss', 'center', 'shop'] as const) {
    assert.ok(layoutFor(5, 2, kind).every((r) => r.every((c) => c === '.')), kind);
  }
});

test('el campo de flujo rodea los obstáculos', () => {
  const g = parseTemplate(TEMPLATES.muros);
  // De arriba del muro a abajo del muro hay que rodearlo
  const dist = flowField(g, 4, 11);
  assert.ok(dist[1][4] < Infinity);
  assert.ok(dist[1][4] > 10, 'el camino rodea el muro');
  const step = stepToward(dist, 4, 1);
  assert.ok(step);
  const [dx, dy] = step!;
  assert.ok(isWalkable(g[1 + dy][4 + dx]));
  assert.ok(dist[1 + dy][4 + dx] < dist[1][4]);
  assert.equal(stepToward(dist, 4, 11), null);
});

test('la casilla libre más cercana', () => {
  const g = parseTemplate(TEMPLATES.rocasEsquinas);
  assert.equal(g[2][2], 'R');
  const [x, y] = nearestWalkable(g, 2, 2);
  assert.ok(isWalkable(g[y][x]));
  assert.ok(Math.abs(x - 2) <= 1 && Math.abs(y - 2) <= 1);
  assert.deepEqual(nearestWalkable(g, 0, 0), [0, 0]);
});

test('las casillas de una sala grande no llevan muros X', () => {
  for (let seed = 0; seed < 200; seed++) {
    const g = layoutFor(seed * 31, 3, 'combat', true);
    assert.ok(g.every((r) => !r.includes('X')));
  }
});

test('los muros X dejan dos casillas de margen junto a cada puerta (el marco no queda pegado al recorte)', () => {
  for (const [name, rows] of Object.entries(TEMPLATES)) {
    const g = parseTemplate(rows);
    for (const x of [0, COLS - 1]) for (let y = 3; y <= 8; y++) assert.notEqual(g[y][x], 'X', `${name} (${x},${y})`);
    for (const y of [0, ROWS - 1]) for (let x = 7; x <= 12; x++) assert.notEqual(g[y][x], 'X', `${name} (${x},${y})`);
  }
});

test('ningún obstáculo cae en la zona de aparición junto a las puertas (muchas semillas, salas y espejos)', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (let id = 0; id < 12; id++) {
      for (const big of [false, true]) {
        const g = layoutFor(seed * 7919, id, 'combat', big);
        for (const [x, y] of SPAWN_TILES) assert.ok(isWalkable(g[y][x]), `semilla ${seed} sala ${id} (${x},${y}) = ${g[y][x]}`);
        assert.ok(allConnected(g, [...mustReach, ...SPAWN_TILES]), `semilla ${seed} sala ${id}: zona de aparición aislada`);
      }
    }
  }
});

test('las plantillas, en todos sus espejos, quedan con la zona de aparición libre y conectada', () => {
  for (const name of TEMPLATE_NAMES) {
    for (const fx of [false, true]) {
      for (const fy of [false, true]) {
        let g = parseTemplate(TEMPLATES[name]);
        if (fx) g = g.map((r) => [...r].reverse());
        if (fy) g = [...g].reverse();
        for (const [x, y] of SPAWN_TILES) assert.notEqual(g[y][x], 'X', `${name}: muro X en la zona de aparición`);
        g = clearSpawnZones(g);
        for (const [x, y] of SPAWN_TILES) assert.equal(g[y][x] === '.' || g[y][x] === 'W', true, `${name} (${x},${y})`);
        assert.ok(allConnected(g, [...mustReach, ...SPAWN_TILES]), name);
      }
    }
  }
});
