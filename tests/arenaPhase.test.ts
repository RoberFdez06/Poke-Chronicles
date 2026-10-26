// Ejecutar con `npm test`. T78: arenas de jefe que cambian de fase (desperfectos al 67 %, caída a otra arena al 34 %).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_AT, arenaFall, arenaPhase, arenaStage, EVENT_GAP_MS, fallTheme, FALL_GLOW, FALL_HAZARD, FALL_LANDING, FALL_PLAN, FALL_THEMES, FALL_TINT, FALL_TOTAL_MS, SPECIES_THEME, nextBossEvent, type BossEventState } from '../src/level/arenaPhase.ts';
import { allConnected, CENTER_TILES, emptyGrid, parseTemplate, SPAWN_TILES, TEMPLATES, type Grid } from '../src/level/roomLayouts.ts';
import { MEGA_AT } from '../src/data/megaBoss.ts';

const grids = (): Grid[] => [emptyGrid(), ...Object.values(TEMPLATES).map((t) => parseTemplate(t))];
const walk = (g: Grid, [x, y]: readonly [number, number]) => g[y][x] === '.' || g[y][x] === 'W';
const near = (a: readonly [number, number], x: number, y: number) => Math.abs(x - a[0]) <= 1 && Math.abs(y - a[1]) <= 1;
const reserved = new Set([...SPAWN_TILES, ...CENTER_TILES].map(([x, y]) => `${x},${y}`));
const TYPES = [['fire'], ['water'], ['ice'], ['grass'], ['bug', 'flying'], ['rock'], ['ghost'], ['normal'], ['flying', 'fire'], ['electric'], ['psychic'], ['dragon'], ['steel'], ['fairy'], ['ground']];

test('fases al 67 % y al 34 % (perder un tercio y dos tercios)', () => {
  assert.deepEqual(ARENA_AT, [0.67, 0.34]);
  assert.equal(arenaStage(1), 0);
  assert.equal(arenaStage(0.67), 0);
  assert.equal(arenaStage(0.66), 1);
  assert.equal(arenaStage(0.34), 1);
  assert.equal(arenaStage(0.33), 2);
});

test('fase 1: solo desperfectos leves en suelo libre, lejos de puertas, centro, jugador y jefe', () => {
  for (const [gi, grid] of grids().entries()) {
    for (let seed = 1; seed <= 8; seed++) {
      const player: [number, number] = [3 + (seed % 5), 2 + (seed % 7)];
      const boss: [number, number] = [15, 3 + (seed % 5)];
      const p = arenaPhase({ grid, seed, player, boss });
      assert.ok(p.cells.length > 0 && p.cells.length <= 22, `plantilla ${gi}`);
      const kinds = new Set(p.cells.map((c) => c.kind));
      assert.ok(kinds.has('grieta'));
      for (const c of p.cells) {
        assert.equal(grid[c.y][c.x], '.');
        assert.ok(!reserved.has(`${c.x},${c.y}`));
        assert.ok(!near(player, c.x, c.y) && !near(boss, c.x, c.y));
      }
      // Camino seguro (sin grietas ni escombros) entre puertas, centro y jugador
      const g = grid.map((r) => [...r]);
      for (const c of p.cells) if (c.kind !== 'charco') g[c.y][c.x] = 'X';
      const must = [...SPAWN_TILES, CENTER_TILES[0], player].filter((t) => walk(grid, t));
      assert.ok(allConnected(g, must), `plantilla ${gi} semilla ${seed}`);
    }
  }
});

test('fase 1: los charcos salen hacia las esquinas', () => {
  const p = arenaPhase({ grid: emptyGrid(), seed: 3, player: [9, 9] });
  const charcos = p.cells.filter((c) => c.kind === 'charco');
  assert.ok(charcos.length > 0);
  const corner = (x: number, y: number) => Math.min(x, 19 - x) + Math.min(y, 11 - y);
  assert.ok(charcos.every((c) => corner(c.x, c.y) <= 4));
});

test('fase 2: la arena depende del tipo del jefe (genérica si no tiene regla)', () => {
  assert.equal(fallTheme(['fire']), 'lava');
  assert.equal(fallTheme(['water', 'ground']), 'inundada');
  assert.equal(fallTheme(['ice']), 'hielo');
  assert.equal(fallTheme(['grass']), 'raices');
  assert.equal(fallTheme(['bug']), 'raices');
  assert.equal(fallTheme(['flying', 'fire']), 'lava');
  assert.equal(fallTheme(['psychic']), 'psique');
  assert.equal(fallTheme(['rock']), 'ruinas');
  assert.equal(fallTheme(['normal', 'fighting']), 'ruinas');
  assert.equal(fallTheme([]), 'ruinas');
  const water = arenaFall({ bossTypes: ['water'], seed: 5, player: [3, 3] });
  assert.ok(water.grid.flat().filter((c) => c === 'W').length >= 40);
  const fire = arenaFall({ bossTypes: ['fire'], seed: 5, player: [3, 3] });
  assert.ok(fire.hazards.length >= 15);
  const ice = arenaFall({ bossTypes: ['ice'], seed: 5, player: [3, 3] });
  assert.ok(ice.hazards.length >= 30);
  const grass = arenaFall({ bossTypes: ['grass'], seed: 5, player: [3, 3] });
  assert.ok(grass.grid.flat().filter((c) => c === 'B').length >= 10);
  const rock = arenaFall({ bossTypes: ['rock'], seed: 5, player: [3, 3] });
  assert.ok(rock.grid.flat().filter((c) => c === 'R' || c === 'P').length >= 10);
});

test('fase 2: siempre hay camino seguro, puertas y centro libres, y nada encima del jugador ni del jefe', () => {
  for (const types of TYPES) {
    for (let seed = 1; seed <= 25; seed++) {
      const player: [number, number] = [1 + (seed % 17), 1 + (seed % 10)];
      const boss: [number, number] = [18 - (seed % 15), 10 - (seed % 9)];
      const f = arenaFall({ bossTypes: types, seed, player, boss });
      const g = f.grid.map((r) => [...r]);
      const lava = FALL_HAZARD[f.theme] === 'lava';
      for (const [x, y] of f.hazards) {
        assert.equal(f.grid[y][x], '.');
        if (lava) g[y][x] = 'X';
      }
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 20; x++) {
          const blocked = g[y][x] !== '.' && g[y][x] !== 'W';
          if (reserved.has(`${x},${y}`) || near(player, x, y) || near(boss, x, y)) assert.ok(!blocked, `${types} ${seed} (${x},${y})`);
        }
      }
      if (FALL_HAZARD[f.theme] !== null) for (const [x, y] of f.hazards) assert.ok(!reserved.has(`${x},${y}`) && !near(player, x, y) && !near(boss, x, y));
      const must = [...SPAWN_TILES, CENTER_TILES[0], player, boss];
      assert.ok(allConnected(g, must), `${types} semilla ${seed}`);
    }
  }
});

test('determinista por semilla (las dos fases)', () => {
  const grid = parseTemplate(Object.values(TEMPLATES)[1]);
  assert.deepEqual(arenaPhase({ grid, seed: 42, player: [5, 5] }), arenaPhase({ grid, seed: 42, player: [5, 5] }));
  assert.notDeepEqual(arenaPhase({ grid, seed: 42, player: [5, 5] }), arenaPhase({ grid, seed: 43, player: [5, 5] }));
  for (const types of TYPES) assert.deepEqual(arenaFall({ bossTypes: types, seed: 9, player: [4, 4] }), arenaFall({ bossTypes: types, seed: 9, player: [4, 4] }));
  assert.notDeepEqual(arenaFall({ bossTypes: ['rock'], seed: 9, player: [4, 4] }).grid, arenaFall({ bossTypes: ['rock'], seed: 10, player: [4, 4] }).grid);
});

const st = (o: Partial<BossEventState>): BossEventState => ({ ratio: 1, arenaDone: 0, megaDone: false, arena: true, mega: true, now: 10_000, busyUntil: undefined, ...o });

test('orden: fase 1 → megaevolución → fase 2, y nunca dos a la vez', () => {
  assert.equal(MEGA_AT, 0.5);
  assert.equal(nextBossEvent(st({ ratio: 0.9 })), null);
  assert.equal(nextBossEvent(st({ ratio: 0.6 })), 'arena1');
  assert.equal(nextBossEvent(st({ ratio: 0.45, arenaDone: 1 })), 'mega');
  assert.equal(nextBossEvent(st({ ratio: 0.45, arenaDone: 1, megaDone: true })), null);
  assert.equal(nextBossEvent(st({ ratio: 0.3, arenaDone: 1, megaDone: true })), 'arena2');
  // Un golpe enorme de 100 % a 20 %: van en orden igualmente
  assert.equal(nextBossEvent(st({ ratio: 0.2 })), 'arena1');
  assert.equal(nextBossEvent(st({ ratio: 0.2, arenaDone: 1 })), 'mega');
  // La fase 2 espera a la mega aunque ya toque por vida
  assert.equal(nextBossEvent(st({ ratio: 0.2, arenaDone: 1, megaDone: false })), 'mega');
  // Sin mega posible (minijefe…), no se la espera
  assert.equal(nextBossEvent(st({ ratio: 0.2, arenaDone: 1, mega: false })), 'arena2');
  // Solo arena: los ayudantes no hacen nada
  assert.equal(nextBossEvent(st({ ratio: 0.2, arena: false, mega: false })), null);
  assert.equal(nextBossEvent(st({ ratio: 0, arenaDone: 1 })), null);
});

test('margen de un segundo entre sucesos', () => {
  const end = 10_000;
  assert.equal(nextBossEvent(st({ ratio: 0.45, arenaDone: 1, now: end + EVENT_GAP_MS - 1, busyUntil: end })), null);
  assert.equal(nextBossEvent(st({ ratio: 0.45, arenaDone: 1, now: end + EVENT_GAP_MS, busyUntil: end })), 'mega');
  assert.equal(nextBossEvent(st({ ratio: 0.2, arenaDone: 1, megaDone: true, now: end + 500, busyUntil: end })), null);
  assert.equal(EVENT_GAP_MS, 1000);
  assert.ok(FALL_TOTAL_MS <= 3000);
});

// --- Temas por concepto (legendarios) ---

test('fase 2: el tema depende del legendario antes que del tipo', () => {
  const cases: [number, string[], string][] = [
    [483, ['steel', 'dragon'], 'tiempo'], [484, ['water', 'dragon'], 'espacio'], [487, ['ghost', 'dragon'], 'distorsion'],
    [384, ['dragon', 'flying'], 'cielo'], [382, ['water'], 'mar'], [383, ['ground'], 'magma'], [249, ['psychic', 'flying'], 'mar'],
    [250, ['fire', 'flying'], 'arcoiris'], [493, ['normal'], 'creacion'], [150, ['psychic'], 'psique'], [644, ['dragon', 'electric'], 'tormenta'],
    [643, ['dragon', 'fire'], 'arcoiris'], [716, ['fairy'], 'creacion'], [717, ['dark', 'flying'], 'distorsion'], [791, ['psychic', 'steel'], 'espacio'],
    [792, ['psychic', 'ghost'], 'espacio'], [890, ['poison', 'dragon'], 'espacio'], [1007, ['fighting', 'dragon'], 'tiempo'], [1008, ['electric', 'dragon'], 'tiempo'],
    [888, ['fairy'], 'creacion'], [889, ['fighting'], 'creacion'], [898, ['psychic', 'grass'], 'creacion'], [800, ['psychic'], 'espacio'], [151, ['psychic'], 'creacion'],
    [251, ['psychic', 'grass'], 'tiempo'], [377, ['rock'], 'ruinas'], [378, ['ice'], 'hielo'],
    // Los de un solo elemento: lo básico de su tipo
    [146, ['fire', 'flying'], 'lava'], [144, ['ice', 'flying'], 'hielo'], [145, ['electric', 'flying'], 'tormenta'],
  ];
  for (const [id, types, theme] of cases) assert.equal(fallTheme(types, id), theme, `especie ${id}`);
  // Inventados o sin regla: por tipo, nunca polvo genérico si hay relación
  assert.equal(fallTheme(['electric'], 99999), 'tormenta');
  assert.equal(fallTheme(['ghost']), 'distorsion');
  assert.equal(fallTheme(['dark', 'fire']), 'lava');
  assert.equal(fallTheme(['steel']), 'tiempo');
  assert.equal(fallTheme(['fairy']), 'creacion');
  assert.equal(fallTheme(['ground']), 'magma');
  assert.equal(fallTheme(['dragon']), 'cielo');
  // arenaFall usa la especie
  assert.equal(arenaFall({ bossTypes: ['steel', 'dragon'], speciesId: 483, seed: 1, player: [3, 3] }).theme, 'tiempo');
  assert.equal(arenaFall({ bossTypes: ['steel', 'dragon'], seed: 1, player: [3, 3] }).theme, 'tiempo');
  assert.equal(arenaFall({ bossTypes: ['water', 'dragon'], speciesId: 484, seed: 1, player: [3, 3] }).theme, 'espacio');
});

test('fase 2: cada tema tiene plan, texto, tinte, luz y al menos 10 conceptos distintos', () => {
  const concepts = new Set(Object.values(SPECIES_THEME));
  assert.ok(concepts.size >= 10);
  for (const t of FALL_THEMES) {
    assert.ok(FALL_PLAN[t].length > 0, t);
    assert.ok(FALL_LANDING[t].startsWith('¡'), t);
    assert.equal(typeof FALL_TINT[t], 'number');
    assert.equal(typeof FALL_GLOW[t], 'number');
    assert.ok(t in FALL_HAZARD);
  }
});

test('fase 2: todos los temas dejan camino seguro y cada uno pone sus obstáculos', () => {
  const bySpecies = new Map<string, number>();
  for (const [id, t] of Object.entries(SPECIES_THEME)) if (!bySpecies.has(t)) bySpecies.set(t, Number(id));
  for (const theme of FALL_THEMES) {
    const id = bySpecies.get(theme);
    const types = id === undefined ? ({ lava: ['fire'], inundada: ['water'], hielo: ['ice'], raices: ['grass'], ruinas: ['rock'] } as Record<string, string[]>)[theme] : [];
    for (let seed = 1; seed <= 20; seed++) {
      const player: [number, number] = [1 + (seed % 17), 1 + (seed % 10)];
      const boss: [number, number] = [18 - (seed % 15), 10 - (seed % 9)];
      const f = arenaFall({ bossTypes: types ?? [], speciesId: id, seed, player, boss });
      assert.equal(f.theme, theme);
      const g = f.grid.map((r) => [...r]);
      for (const [x, y] of f.hazards) {
        assert.equal(f.grid[y][x], '.');
        assert.ok(!reserved.has(`${x},${y}`) && !near(player, x, y) && !near(boss, x, y));
        if (FALL_HAZARD[theme] === 'lava') g[y][x] = 'X';
      }
      if (FALL_HAZARD[theme] === null) assert.equal(f.hazards.length, 0, theme);
      for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) {
        const blocked = g[y][x] !== '.' && g[y][x] !== 'W';
        if (reserved.has(`${x},${y}`) || near(player, x, y) || near(boss, x, y)) assert.ok(!blocked, `${theme} ${seed} (${x},${y})`);
      }
      assert.ok(allConnected(g, [...SPAWN_TILES, CENTER_TILES[0], player, boss]), `${theme} semilla ${seed}`);
      const placed = f.hazards.length + f.grid.flat().filter((c) => c !== '.').length;
      assert.ok(placed >= 8, `${theme} semilla ${seed}: ${placed}`);
    }
  }
});
