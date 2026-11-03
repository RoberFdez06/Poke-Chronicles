// Defensa de torres más retadora: mapas que cambian por nivel, enemigos con trucos, sinergias y decisiones en vivo.
// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_COLS, TD_MAPS, TD_ROWS, baseCell, buildableCells, entryCells, pathCells, LAYOUTS } from '../src/data/towerDefense/maps.ts';
import { LAYOUT_EXTRAS, VARIANTS, mapForLevel, routeAtCell, variantFor, variantSummary, TERRAIN_INFO } from '../src/data/towerDefense/variants.ts';
import { TdGame, type TdEnemy } from '../src/data/towerDefense/engine.ts';
import { TRICK_KINDS, MAP_FOES, TD_TYPES, ENEMY_KIND_LABEL, type TdMon } from '../src/data/towerDefense/species.ts';
import { kindUnlocked, waveSpawns, waveThemeOf, wavesInLevel, enemyDef } from '../src/data/towerDefense/waves.ts';
import { adaptType, waveTheme, SAB_FIRST, SAB_WARN } from '../src/data/towerDefense/tricks.ts';
import { COMBOS, applySynergy, comboOf, synergyBonus, synergyLinks } from '../src/data/towerDefense/synergy.ts';
import { MAX_TRAPS, moveCost, sellInWave, trapCost } from '../src/data/towerDefense/live.ts';
import { sellValue, towerStats } from '../src/data/towerDefense/towers.ts';
import { tdHelp } from '../src/data/towerDefense/controls.ts';

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number) => ({ hp, attack, defense, spAttack, spDefense, speed });
const TEAM: TdMon[] = [
  { id: 5, name: 'Charmeleon', types: ['fire'], stats: st(58, 64, 58, 80, 65, 80), rarity: 'rare' },
  { id: 8, name: 'Wartortle', types: ['water'], stats: st(59, 63, 80, 65, 80, 58), rarity: 'rare' },
  { id: 2, name: 'Ivysaur', types: ['grass', 'poison'], stats: st(60, 62, 63, 80, 80, 60), rarity: 'rare' },
  { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' },
];
type Spawner = { spawn: (s: object, d?: number) => TdEnemy };
const spawnOf = (g: TdGame) => (g as unknown as Spawner).spawn.bind(g);
const clearEnemies = (g: TdGame) => g.enemies.splice(0, g.enemies.length);

test('mapas: cada nivel es un mapa válido y distinto del anterior; los avanzados son más complejos', () => {
  assert.equal(LAYOUT_EXTRAS.length, LAYOUTS.length);
  for (const m of TD_MAPS) {
    let prev = '';
    for (let l = 0; l <= m.levels; l++) {
      const lm = mapForLevel(m, l);
      const b = baseCell(lm);
      assert.equal(lm.paths.length, lm.routes.length);
      for (const p of lm.paths) {
        for (let i = 1; i < p.length; i++) assert.ok(p[i].x === p[i - 1].x || p[i].y === p[i - 1].y, `${m.id}/${l}: diagonal`);
        for (const c of pathCells(p)) {
          assert.ok(c.x >= 0 && c.y >= 0 && c.x < TD_COLS && c.y < TD_ROWS, `${m.id}/${l}: fuera`);
          assert.ok(!lm.blocked.some((q) => q.x === c.x && q.y === c.y), `${m.id}/${l}: roca en el camino`);
        }
        assert.deepEqual(p[p.length - 1], b, `${m.id}/${l}: no acaba en la base`);
      }
      for (const e of entryCells(lm)) assert.ok(e.x === 0 || e.y === 0 || e.x === TD_COLS - 1 || e.y === TD_ROWS - 1);
      assert.ok(buildableCells(lm).length >= 55, `${m.id}/${l}: poco sitio`);
      for (const r of lm.routes) if (r.kind !== 'base') assert.ok(r.gate, `${m.id}/${l}: ruta extra sin casilla propia`);
      for (const t of lm.terrain) {
        const onRoad = lm.paths.some((p) => pathCells(p).some((c) => c.x === t.x && c.y === t.y));
        assert.equal(onRoad, TERRAIN_INFO[t.kind].road, `${m.id}/${l}: terreno ${t.kind} mal puesto`);
      }
      const sig = JSON.stringify([lm.paths, lm.blocked, lm.terrain]);
      if (l >= 2) assert.notEqual(sig, prev, `${m.id}: el nivel ${l} repite el ${l - 1}`);
      if (l >= 2) assert.notEqual(variantFor(m, l), variantFor(m, l - 1), `${m.id}: misma variante seguida`);
      prev = sig;
    }
    assert.equal(variantFor(m, 1), 0, 'el nivel 1 enseña el mapa tal cual');
    assert.equal(mapForLevel(m, 1).rocks.length, 0);
    assert.ok(variantSummary(m, 3).length > 5);
  }
  // Ningún mapa repite la plantilla del anterior; los 4 últimos usan las plantillas nuevas (bucles, bifurcación, 4 entradas)
  for (let i = 1; i < TD_MAPS.length; i++) assert.notEqual(TD_MAPS[i].layout, TD_MAPS[i - 1].layout);
  for (const m of TD_MAPS.slice(-4)) assert.ok(m.layout >= 8);
  assert.ok(TD_MAPS.some((m) => m.paths.length === 4));
  // Mapas difíciles: más variantes complejas que los fáciles
  const complexity = (m: (typeof TD_MAPS)[number]) => Array.from({ length: m.levels }, (_, i) => variantFor(m, i + 1)).reduce((a, b) => a + b, 0) / m.levels;
  assert.ok(complexity(TD_MAPS[TD_MAPS.length - 1]) > complexity(TD_MAPS[0]));
  assert.equal(VARIANTS.length, 6);
});

test('los ids, el orden y los niveles de los mapas no cambian (guardados)', () => {
  // Los 16 de siempre, igual; las fases nuevas (Psíquico y Normal) van al final
  assert.deepEqual(TD_MAPS.map((m) => m.id), ['pradera', 'gruta', 'arboleda', 'costa', 'cantera', 'nevada', 'ciudad', 'cienaga', 'glaciar', 'volcan', 'arrecife', 'torre', 'fundicion', 'lodazal', 'caldera', 'cumbre', 'templo', 'origen']);
  assert.deepEqual(TD_MAPS.map((m) => m.levels), [10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 15]);
});

test('rutas: las que se abren a mitad del nivel avisan; la barricada cierra una ruta con coste', () => {
  // Busca un nivel con una entrada que se abre a mitad
  let found: { m: (typeof TD_MAPS)[number]; l: number; i: number } | null = null;
  for (const m of TD_MAPS) {
    for (let l = 2; l <= m.levels && !found; l++) {
      const i = mapForLevel(m, l).routes.findIndex((r) => r.opensAt > 1);
      if (i >= 0) found = { m, l, i };
    }
    if (found) break;
  }
  assert.ok(found);
  const g = new TdGame({ map: found.m, level: found.l, team: TEAM });
  const at = g.map.routes[found.i].opensAt;
  assert.ok(!g.openRoutes(1).includes(found.i));
  assert.match(g.barricadeError(found.i)!, /aún no/);
  g.wave = at - 1;
  g.callNextWave();
  assert.ok(g.drainEvents().some((e) => e.t === 'routeOpen' && e.path === found!.i));
  assert.ok(g.openRoutes().includes(found.i));
  // Barricada: cuesta dinero, deja salir por otra y dura dos oleadas
  g.money = 0;
  assert.match(g.barricadeError(found.i)!, /dinero/);
  g.money = 1000;
  assert.ok(g.closeRoute(found.i));
  assert.equal(g.money, 1000 - g.barricadeCost());
  assert.ok(!g.routeOpen(found.i));
  const others = g.openRoutes();
  assert.ok(others.length >= 1 && !others.includes(found.i));
  for (const o of others) if (o !== found.i && g.openRoutes().length === 1) assert.match(g.barricadeError(o)!, /última/);
  const gate = g.map.routes[found.i].gate!;
  assert.equal(routeAtCell(g.map, gate.x, gate.y), found.i);
});

test('la última ruta abierta no se puede cerrar y los enemigos van por las abiertas', () => {
  const m = TD_MAPS.find((q) => q.paths.length >= 2)!;
  const g = new TdGame({ map: m, level: 1, team: TEAM });
  g.money = 10_000;
  assert.ok(g.closeRoute(0));
  const left = g.openRoutes();
  for (const i of left.slice(0, -1)) assert.ok(g.closeRoute(i));
  assert.match(g.barricadeError(left[left.length - 1])!, /última/);
  g.callNextWave();
  const q = (g as unknown as { queue: { path: number }[] }).queue;
  assert.ok(q.every((s) => s.path === left[left.length - 1]));
});

test('terreno: colina, cristal y lodo cambian la torre; barro frena', () => {
  const m = TD_MAPS[2];
  const lm = mapForLevel(m, 4);
  const g = new TdGame({ map: m, level: 4, team: TEAM });
  g.money = 10_000;
  for (const kind of ['alto', 'cristal', 'lodo'] as const) {
    const cell = lm.terrain.find((t) => t.kind === kind);
    if (!cell) continue;
    const t = g.place(1, cell.x, cell.y)!;
    const base = towerStats(t.mon, 1, null);
    const s = g.statsOf(t);
    if (kind === 'alto') assert.ok(s.range > base.range);
    if (kind === 'cristal') assert.ok(s.damage > base.damage);
    if (kind === 'lodo') assert.ok(s.rate < base.rate);
    g.sell(t.id);
  }
  assert.ok(lm.terrain.some((t) => t.kind === 'alto' || t.kind === 'cristal'));
});

test('enemigos con trucos: tienen especie, salen mezclados según la oleada y el protagonista cambia', () => {
  for (const f of Object.values(MAP_FOES)) for (const k of TRICK_KINDS) for (const id of f[k]) assert.ok(TD_TYPES[id], `falta el tipo de ${id}`);
  for (const k of TRICK_KINDS) assert.ok(ENEMY_KIND_LABEL[k]);
  assert.equal(enemyDef('soarer', 15, 3, 1).air, true);
  assert.equal(waveTheme('x', 1, 1, ['dodger']), null, 'la primera oleada, sin truco');
  const late = TD_MAPS[10];
  const themes = new Set<string>();
  for (let w = 2; w <= wavesInLevel(late.levels, late.levels); w++) themes.add(String(waveThemeOf(late, late.levels, w)));
  assert.ok(themes.size >= 3, 'protagonistas distintos en el mismo nivel');
  const spawns = waveSpawns(late, 5, 6);
  assert.ok(new Set(spawns.map((s) => s.kind)).size >= 4, 'mezcla');
  assert.ok(!kindUnlocked('adapter', { tier: 0, level: 1, levels: 10 }, 3));
  assert.ok(TRICK_KINDS.every((k) => kindUnlocked(k, { tier: 8, level: 1, levels: 13 }, 2)));
  assert.equal(adaptType({ fire: 30, water: 50 }), 'water');
  assert.equal(adaptType({}), null);
});

test('esquivos esquivan los disparos sueltos salvo si van frenados; los planeadores van recto', () => {
  const m = TD_MAPS[0];
  const g = new TdGame({ map: m, level: 1, team: [TEAM[0]], seed: 3 });
  g.callNextWave();
  g.step(0.05);
  clearEnemies(g);
  const sp = spawnOf(g);
  const d = sp({ at: 0, kind: 'dodger', species: 290, path: 0 }, 3);
  d.frozen = 99;
  d.hp = d.def.maxHp = 100_000;
  const impact = (g as unknown as { impact: (s: object, t: TdEnemy) => void }).impact.bind(g);
  const stats = { ...towerStats(TEAM[0], 1, null), splash: 0, chain: 0, crit: 0 };
  // Congelado: no esquiva nunca
  for (let i = 0; i < 30; i++) impact({ id: 0, towerId: 0, targetId: d.id, x: 0, y: 0, tx: d.x, ty: d.y, type: 'fire', types: ['fire'], damage: 10, special: false, stats }, d);
  assert.ok(!g.drainEvents().some((e) => e.t === 'dodge'));
  d.frozen = 0;
  for (let i = 0; i < 60; i++) impact({ id: 0, towerId: 0, targetId: d.id, x: 0, y: 0, tx: d.x, ty: d.y, type: 'fire', types: ['fire'], damage: 10, special: false, stats }, d);
  const n = g.drainEvents().filter((e) => e.t === 'dodge').length;
  assert.ok(n > 10 && n < 45, `esquiva a veces (${n})`);
  const s = sp({ at: 0, kind: 'soarer', species: 15, path: 0 }, 0);
  assert.equal(s.pts.length, 2, 'línea recta de la entrada a la base');
  assert.ok(s.def.air && s.len < d.len);
});

test('saboteadores avisan y aturden; divisores sueltan crías; adaptables resisten el tipo más usado', () => {
  const m = TD_MAPS[0];
  const g = new TdGame({ map: m, level: 1, team: TEAM });
  g.money = 10_000;
  g.callNextWave();
  g.step(0.05);
  clearEnemies(g);
  const sp = spawnOf(g);
  const sab = sp({ at: 0, kind: 'saboteur', species: 46, path: 0 }, 4);
  sab.frozen = 0;
  const near = buildableCells(g.map).sort((a, b) => Math.hypot(a.x + 0.5 - sab.x, a.y + 0.5 - sab.y) - Math.hypot(b.x + 0.5 - sab.x, b.y + 0.5 - sab.y))[0];
  const t = g.place(1, near.x, near.y)!;
  sab.hp = sab.def.maxHp = 1e9;
  const tick = (g as unknown as { tickSaboteurs: (dt: number) => void }).tickSaboteurs.bind(g);
  tick(SAB_FIRST + 0.01);
  assert.ok(g.drainEvents().some((e) => e.t === 'sabWarn' && e.towerId === t.id));
  assert.equal(t.stunned, 0, 'primero avisa');
  tick(SAB_WARN + 0.01);
  assert.ok(t.stunned > 0, 'luego aturde');
  // Divisor
  clearEnemies(g);
  const spl = sp({ at: 0, kind: 'splitter', species: 102, path: 0 }, 5);
  const dmg = (g as unknown as { damage: (e: TdEnemy, n: number, t: null, o: object) => void }).damage.bind(g);
  dmg(spl, 1e9, null, { type: 'fire', mul: 1, crit: false, special: false, splash: 0 });
  assert.equal(g.enemies.filter((e) => e.def.kind === 'brood').length, 2);
  // Adaptable: con fuego como tipo más dañino, resiste el fuego
  const g2 = new TdGame({ map: m, level: 1, team: TEAM });
  (g2 as unknown as { lastTypeDmg: Record<string, number> }).lastTypeDmg = { fire: 500, water: 10 };
  g2.callNextWave();
  assert.equal(g2.adaptType, 'fire');
  const ad = spawnOf(g2)({ at: 0, kind: 'adapter', species: 213, path: 0 }, 2);
  assert.equal(ad.def.resist, 'fire');
  const typeMul = (g2 as unknown as { typeMul: (t: readonly string[], e: TdEnemy) => { mul: number; type: string } }).typeMul.bind(g2);
  assert.ok(typeMul(['fire'], ad).mul < 1);
  assert.deepEqual(typeMul(['fire', 'water'], ad).type, 'water', 'la torre usa su otro tipo');
});

test('sinergias: resonancia del mismo tipo, combos de tipos complementarios y Dúo al nivel 5', () => {
  assert.ok(COMBOS.length >= 10);
  assert.equal(comboOf(['water'], ['electric'])!.id, 'electroagua');
  assert.equal(comboOf(['electric'], ['water'])!.id, 'electroagua');
  assert.equal(comboOf(['normal'], ['ice']), null);
  const links = synergyLinks([
    { id: 1, x: 2, y: 2, types: ['water'], level: 1 },
    { id: 2, x: 3, y: 2, types: ['electric'], level: 1 },
    { id: 3, x: 2, y: 3, types: ['water'], level: 1 },
    { id: 4, x: 9, y: 9, types: ['water'], level: 1 },
  ]);
  const b1 = synergyBonus(1, links);
  assert.ok(b1.names.includes('Electroagua') && b1.names.some((n) => n.startsWith('Resonancia')));
  assert.equal(synergyBonus(4, links).names.length, 0, 'lejos: nada');
  const b2 = synergyBonus(2, links);
  assert.equal(b2.chain, 1, 'cada combo cuenta una vez');
  const pika = towerStats(TEAM[3], 1, null);
  assert.equal(applySynergy(pika, b2).chain, pika.chain + 1);
  const duo = synergyLinks([
    { id: 1, x: 2, y: 2, types: ['water'], level: 5 },
    { id: 2, x: 3, y: 3, types: ['electric'], level: 6 },
  ]);
  assert.ok(duo[0].duo);
  assert.equal(synergyBonus(2, duo).duoWith, 1);
  assert.equal(synergyBonus(2, duo).chain, 2, 'el Dúo dobla el efecto');
  // En el motor
  const g = new TdGame({ map: TD_MAPS[0], level: 1, team: TEAM });
  g.money = 10_000;
  const free = buildableCells(g.map);
  const a = free.find((c) => free.some((d) => d.x === c.x + 1 && d.y === c.y))!;
  const w = g.place(1, a.x, a.y)!;
  const before = g.statsOf(w).damage;
  assert.ok(g.previewSynergy(3, a.x + 1, a.y).includes('Electroagua'));
  g.place(3, a.x + 1, a.y);
  assert.ok(g.statsOf(w).damage > before);
  assert.equal(g.synergyLinks().length, 1);
});

test('decisiones en vivo: trampas en el camino, mover torres con coste y vender más barato en plena oleada', () => {
  const m = TD_MAPS[0];
  const g = new TdGame({ map: m, level: 1, team: TEAM });
  g.money = 10_000;
  const road = pathCells(g.map.paths[0]);
  const free = buildableCells(g.map);
  assert.match(g.trapError('mina', free[0].x, free[0].y)!, /camino/);
  const b = baseCell(g.map);
  assert.match(g.trapError('mina', b.x, b.y)!, /camino/);
  for (let i = 0; i < MAX_TRAPS; i++) assert.ok(g.placeTrap(i % 2 ? 'red' : 'mina', road[3 + i].x, road[3 + i].y));
  assert.match(g.trapError('mina', road[10].x, road[10].y)!, /Máximo/);
  assert.ok(trapCost('mina', 5) > trapCost('mina', 1));
  // La mina explota al pisarla
  g.callNextWave();
  g.step(0.05);
  clearEnemies(g);
  const e = spawnOf(g)({ at: 0, kind: 'normal', species: 10, path: 0 }, 2.6);
  const hp0 = e.hp;
  for (let i = 0; i < 20 && g.enemies.includes(e) && g.traps.some((q) => q.kind === 'mina' && q.x === road[3].x && q.y === road[3].y); i++) g.step(0.1);
  assert.ok(!g.enemies.includes(e) || e.hp < hp0, 'la mina hace daño');
  assert.ok(g.drainEvents().some((q) => q.t === 'trap' && q.kind === 'mina'));
  // Mover: en plena oleada cuesta más y aturde
  const t = g.place(0, free[5].x, free[5].y)!;
  const cost = g.moveCost(t);
  assert.equal(cost, moveCost(t.mon, 1, true));
  assert.ok(moveCost(t.mon, 1, false) < cost);
  const money = g.money;
  assert.ok(g.moveTower(t.id, free[6].x, free[6].y));
  assert.equal(g.money, money - cost);
  assert.deepEqual([t.x, t.y], [free[6].x, free[6].y]);
  assert.ok(t.stunned > 0);
  assert.match(g.moveError(t.id, road[0].x, road[0].y)!, /no se puede/);
  // Vender en plena oleada: menos que en la preparación
  assert.equal(g.sellValue(t), sellInWave(t.mon, 1));
  assert.ok(sellInWave(t.mon, 1) < sellValue(t.mon, 1));
});

test('ayuda de controles para el camino y para mover torres con los tres dispositivos', () => {
  for (const d of ['keyboard', 'mouse', 'gamepad', 'touch'] as const) {
    const r = tdHelp(d, { kind: 'road', actions: 3 });
    const mv = tdHelp(d, { kind: 'moving', name: 'Pikachu', cost: 20 });
    assert.ok(r[0] && r[1] && mv[0] && mv[1], d);
    assert.match(mv.join(' '), /20 \$/);
  }
  assert.match(tdHelp('keyboard', { kind: 'road', actions: 3 })[0], /^1 2 3/);
  assert.doesNotMatch(tdHelp('gamepad', { kind: 'moving', name: 'X', cost: 5 }).join(' '), /Enter|Esc/);
});
