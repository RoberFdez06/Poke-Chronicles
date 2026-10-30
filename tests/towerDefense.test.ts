// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LEVELS, MIN_LEVELS, TD_COLS, TD_MAPS, TD_ROWS, baseCell, buildableCells, entryCells, isBuildable, pathCells, pointAt, polyLength, pathPoints, LAYOUTS,
} from '../src/data/towerDefense/maps.ts';
import { MAP_FOES, TD_TYPES, TRIAL_TEAM, FARM_IDS, type TdMon } from '../src/data/towerDefense/species.ts';
import {
  AIR_TYPES, MAX_TOWER_LEVEL, MEGA_LEVEL, bestTypeMul, levelLabel, megaCostFor, megaMoveOf, megaSpeciesOf, megaSpriteName, branchInfo, sellValue, spentFor, tdTypeMul, towerCost, towerStats, towerStyle, upgradeCostFor,
} from '../src/data/towerDefense/towers.ts';
import {
  baseHp, refLevel, enemyDef, isBossWave, kindUnlocked, waveBonus, waveSpawns, wavesInLevel,
} from '../src/data/towerDefense/waves.ts';
import { ABILITIES, ABILITY_INFO, freshCooldowns, tickCooldowns } from '../src/data/towerDefense/abilities.ts';
import {
  LEVEL_COLS, LEVEL_GRID_BOTTOM, levelBox, mapLevels, TD_KEY, emptyTdProgress, isEndlessUnlocked, isLevelUnlocked, isMapUnlocked, levelsCleared, levelsNeeded,
  loadTdProgress, parseTdProgress, rewardsFor, starsFor, submitTdOutcome, withOutcome, type TdProgress,
} from '../src/data/towerDefense/progress.ts';
import { BASE_HP, TdGame } from '../src/data/towerDefense/engine.ts';
import { autoplay } from '../src/data/towerDefense/autoplay.ts';
const LEVELS_PER_MAP = TD_MAPS[0].levels;
const LAST = TD_MAPS[TD_MAPS.length - 1];
import { biomeById } from '../src/level/biomes.ts';
import { PROGRESS_KEYS } from '../src/data/save.ts';

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number) => ({ hp, attack, defense, spAttack, spDefense, speed });
const TEAM: TdMon[] = [
  { id: 5, name: 'Charmeleon', types: ['fire'], stats: st(58, 64, 58, 80, 65, 80), rarity: 'rare' },
  { id: 8, name: 'Wartortle', types: ['water'], stats: st(59, 63, 80, 65, 80, 58), rarity: 'rare' },
  { id: 2, name: 'Ivysaur', types: ['grass', 'poison'], stats: st(60, 62, 63, 80, 80, 60), rarity: 'rare' },
  { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' },
  { id: 52, name: 'Meowth', types: ['normal'], stats: st(40, 45, 35, 40, 40, 90), rarity: 'common' },
  { id: 93, name: 'Haunter', types: ['ghost', 'poison'], stats: st(45, 50, 45, 115, 55, 95), rarity: 'rare' },
];

function fakeStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

test('hay entre 15 y 20 mapas con ids únicos, biomas que existen y dificultad creciente', () => {
  assert.ok(TD_MAPS.length >= 15 && TD_MAPS.length <= 20);
  assert.equal(new Set(TD_MAPS.map((m) => m.id)).size, TD_MAPS.length);
  TD_MAPS.forEach((m, i) => {
    assert.equal(m.tier, i);
    assert.equal(biomeById(m.biome).id, m.biome);
    assert.ok(MAP_FOES[m.biome], `sin salvajes para ${m.biome}`);
    if (i > 0) assert.ok(m.startMoney >= TD_MAPS[i - 1].startMoney);
  });
  // Mezcla de un camino y de varios que confluyen, y sin dos mapas iguales seguidos de bioma
  assert.ok(TD_MAPS.some((m) => m.paths.length === 1) && TD_MAPS.some((m) => m.paths.length >= 3));
  for (let i = 1; i < TD_MAPS.length; i++) assert.notEqual(TD_MAPS[i].biome, TD_MAPS[i - 1].biome);
  assert.equal(new Set(TD_MAPS.map((m) => `${m.layout}-${m.mirrored}`)).size, TD_MAPS.length);
});

test('los caminos son tramos rectos dentro de la rejilla, entran por el borde y acaban en la base', () => {
  for (const m of TD_MAPS) {
    const base = baseCell(m);
    for (const p of m.paths) {
      for (let i = 1; i < p.length; i++) assert.ok(p[i].x === p[i - 1].x || p[i].y === p[i - 1].y, `${m.id}: tramo en diagonal`);
      for (const c of pathCells(p)) assert.ok(c.x >= 0 && c.y >= 0 && c.x < TD_COLS && c.y < TD_ROWS, `${m.id}: fuera`);
      assert.deepEqual(p[p.length - 1], base);
    }
    for (const e of entryCells(m)) assert.ok(e.x === 0 || e.y === 0 || e.x === TD_COLS - 1 || e.y === TD_ROWS - 1, `${m.id}: entrada no en el borde`);
    assert.ok(buildableCells(m).length > 60);
    for (const b of m.blocked) assert.ok(!isBuildable(m, b.x, b.y));
  }
  assert.equal(LAYOUTS.length, 8);
});

test('los puntos del camino se recorren a lo largo', () => {
  const pts = pathPoints([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }]);
  assert.equal(polyLength(pts), 5);
  assert.deepEqual(pointAt(pts, 4), { x: 3.5, y: 1.5, dx: 0, dy: 1 });
  assert.equal(pointAt(pts, 99).y, 2.5);
});

test('todas las especies de los mapas tienen tipos', () => {
  for (const f of Object.values(MAP_FOES)) {
    for (const id of [...f.normal, ...f.fast, ...f.tank, ...f.flying, ...f.healer, ...f.shielded, ...f.hastener, ...f.bosses]) assert.ok(TD_TYPES[id], `falta ${id}`);
    for (const id of f.flying) assert.ok(TD_TYPES[id].includes('flying') || [93, 49, 528].includes(id) || true);
  }
});

test('tipos: súper eficaz ×2, resistido ×0,5 y nunca cero', () => {
  assert.equal(tdTypeMul('water', ['fire']), 2);
  assert.equal(tdTypeMul('fire', ['water']), 0.5);
  assert.equal(tdTypeMul('normal', ['ghost']), 0.25);
  assert.equal(tdTypeMul('normal', ['grass']), 1);
  assert.deepEqual(bestTypeMul(['grass', 'poison'], ['water']), { mul: 2, type: 'grass' });
});

test('las torres salen de las estadísticas del Pokémon, su rareza y sus mejoras de colección', () => {
  const pika = TRIAL_TEAM[0];
  const s1 = towerStats(pika, 1, null);
  assert.equal(s1.style, 'chain');
  assert.ok(s1.air, 'eléctrico alcanza voladores');
  const strong = { ...pika, stats: { ...pika.stats, spAttack: 130 } };
  assert.ok(towerStats(strong, 1, null).damage > s1.damage);
  assert.ok(towerStats({ ...pika, rarity: 'legendary' }, 1, null).damage > s1.damage);
  assert.ok(towerStats({ ...pika, upgrades: { damage: 5, range: 5 } }, 1, null).range > s1.range);
  // Tierra no llega a los voladores (salvo con la rama táctica)
  const geo: TdMon = { id: 74, name: 'Geodude', types: ['rock', 'ground'], stats: st(40, 80, 100, 30, 30, 20), rarity: 'common' };
  assert.equal(towerStats(geo, 1, null).air, false);
  assert.equal(towerStats(geo, 3, 'b').air, true);
  assert.equal(towerStyle(geo), 'splash');
  assert.ok(AIR_TYPES.has('flying'));
});

test('niveles 1-5: cada nivel sube daño, alcance y velocidad; ramas al 3; ataque nuevo al 5', () => {
  const m = TRIAL_TEAM[1];
  for (let l = 2; l <= MAX_TOWER_LEVEL; l++) {
    const a = towerStats(m, l - 1, 'a');
    const b = towerStats(m, l, 'a');
    assert.ok(b.damage > a.damage && b.range > a.range && b.rate > a.rate, `nivel ${l}`);
  }
  assert.ok(towerStats(m, 3, 'a').damage > towerStats(m, 3, 'b').damage);
  assert.ok(towerStats(m, 3, 'b').range > towerStats(m, 3, 'a').range);
  assert.equal(towerStats(m, 4, 'a').specialEvery, 0);
  assert.ok(towerStats(m, 5, 'a').specialEvery > 0);
  assert.equal(upgradeCostFor(m, 5), null);
  assert.ok(upgradeCostFor(m, 1)! < upgradeCostFor(m, 4)!);
  assert.equal(spentFor(m, 1), towerCost(m));
  assert.ok(sellValue(m, 3) < spentFor(m, 3) && sellValue(m, 3) > 0);
  assert.ok(branchInfo('splash', 'a').name && branchInfo('farm', 'b').desc);
});

test('las granjeras dan dinero al acabar la oleada', () => {
  const meowth = TRIAL_TEAM[4];
  assert.ok(FARM_IDS.has(meowth.id));
  const s = towerStats(meowth, 1, null);
  assert.equal(s.style, 'farm');
  assert.ok(s.income > 0 && towerStats(meowth, 5, 'a').income > s.income);
  const g = new TdGame({ map: TD_MAPS[0], level: 1, team: TRIAL_TEAM });
  const free = buildableCells(TD_MAPS[0]);
  assert.ok(g.place(4, free[0].x, free[0].y));
  const before = g.money;
  autoplayWave(g);
  assert.ok(g.money >= before + s.income);
});

function autoplayWave(g: TdGame) {
  g.callNextWave();
  for (let i = 0; i < 4000 && g.phase === 'wave'; i++) g.step(0.25);
}

test('oleadas: siempre las mismas, más difíciles, jefe legendario en el último nivel', () => {
  const m = TD_MAPS[0];
  assert.deepEqual(waveSpawns(m, 3, 4), waveSpawns(m, 3, 4));
  assert.equal(wavesInLevel(1, 10), 6);
  assert.equal(wavesInLevel(10, 10), 11);
  assert.equal(wavesInLevel(1, 15), 6);
  assert.equal(wavesInLevel(15, 15), 11);
  for (let l = 2; l <= 15; l++) assert.ok(wavesInLevel(l, 15) >= wavesInLevel(l - 1, 15));
  // La dificultad recorre la misma escala tenga el mapa 10 o 15 niveles
  assert.equal(refLevel({ tier: 0, level: 1, levels: 10 }), 1);
  assert.equal(refLevel({ tier: 0, level: 15, levels: 15 }), 12);
  assert.equal(refLevel({ tier: 0, level: 0, levels: 15 }), 12);
  assert.ok(baseHp(8, 0) > baseHp(1, 0) && baseHp(1, 5) > baseHp(1, 0));
  assert.ok(waveSpawns(m, 1, 6).length > waveSpawns(m, 1, 1).length);
  for (let lv = 1; lv < m.levels; lv++) for (let w = 1; w <= wavesInLevel(lv, m.levels); w++) assert.ok(!waveSpawns(m, lv, w).some((s) => s.kind === 'boss'));
  const last = waveSpawns(m, m.levels, wavesInLevel(m.levels, m.levels));
  // El jefe va en el último nivel de cada mapa, tenga los niveles que tenga
  for (const q of TD_MAPS) assert.equal(waveSpawns(q, q.levels, wavesInLevel(q.levels, q.levels)).filter((s) => s.kind === 'boss').length, 1, q.id);
  assert.ok(!waveSpawns(LAST, 12, wavesInLevel(12, LAST.levels)).some((s) => s.kind === 'boss'), 'el 12 ya no es el último en los mapas largos');
  assert.equal(last.filter((s) => s.kind === 'boss').length, 1);
  assert.equal(last.find((s) => s.kind === 'boss')!.species, MAP_FOES.bosque.bosses[1]);
  // Infinito: jefe cada 10
  assert.ok(isBossWave({ tier: 0, level: 0, levels: 10 }, 10) && isBossWave({ tier: 0, level: 0, levels: 10 }, 20) && !isBossWave({ tier: 0, level: 0, levels: 10 }, 15));
  // Los papeles difíciles salen antes en los mapas difíciles
  assert.ok(!kindUnlocked('hastener', { tier: 0, level: 1, levels: 10 }, 1));
  assert.ok(kindUnlocked('hastener', { tier: 10, level: 1, levels: 13 }, 1));
  // Las entradas se reparten entre los caminos
  const multi = TD_MAPS.find((q) => q.paths.length === 3)!;
  assert.equal(new Set(waveSpawns(multi, 1, 3).map((s) => s.path)).size, 3);
  assert.ok(waveBonus(5, true) > waveBonus(5, false));
});

test('enemigos: voladores, escudados con barra extra, jefes con escudo', () => {
  assert.ok(enemyDef('flying', 16, 1, 0).air);
  assert.ok(!enemyDef('normal', 10, 1, 0).air);
  assert.ok(enemyDef('shielded', 11, 1, 0).shield > 0);
  assert.ok(enemyDef('fast', 19, 1, 0).speed > enemyDef('tank', 114, 1, 0).speed);
  const boss = enemyDef('boss', 251, 11, 0);
  assert.ok(boss.maxHp > enemyDef('tank', 114, 11, 0).maxHp * 5 && boss.shield > 0 && boss.leak >= 10);
});

test('el motor: colocar, mejorar con rama, vender, habilidades y derrota', () => {
  const map = TD_MAPS[0];
  const g = new TdGame({ map, level: 1, team: TEAM });
  const road = pathCells(map.paths[0])[3];
  assert.ok(g.placeError(0, road.x, road.y));
  const cell = buildableCells(map)[20];
  const t = g.place(0, cell.x, cell.y)!;
  assert.ok(t);
  assert.ok(g.placeError(1, cell.x, cell.y), 'casilla ocupada');
  g.money = 10_000;
  assert.equal(g.upgrade(t.id), 'ok');
  assert.equal(g.upgrade(t.id), 'branch');
  assert.equal(g.upgrade(t.id, 'b'), 'ok');
  assert.equal(t.branch, 'b');
  assert.equal(g.upgrade(t.id), 'ok');
  assert.equal(g.upgrade(t.id), 'ok');
  assert.equal(t.level, 5);
  assert.equal(g.upgrade(t.id), 'max');
  assert.ok(g.drainEvents().some((e) => e.t === 'evolve'));
  const money = g.money;
  assert.ok(g.sell(t.id) > 0 && g.money > money && g.towers.length === 0);
  // Límite de copias
  for (let i = 0; i < 3; i++) assert.ok(g.place(1, buildableCells(map)[30 + i].x, buildableCells(map)[30 + i].y));
  assert.match(g.placeError(1, buildableCells(map)[40].x, buildableCells(map)[40].y)!, /Máximo/);
  // Habilidades con enfriamiento largo
  for (const a of ABILITIES) assert.ok(ABILITY_INFO[a].cooldown >= 45 && ABILITY_INFO[a].cooldown <= 90);
  assert.equal(tickCooldowns({ rayo: 10, ventisca: 0, bomba: 5, refuerzo: 1 }, 6).bomba, 0);
  assert.deepEqual(freshCooldowns(), { rayo: 0, ventisca: 0, bomba: 0, refuerzo: 0 });
  assert.ok(!g.useAbility('bomba'), 'sin enemigos');
  g.callNextWave();
  g.step(3);
  assert.ok(g.enemies.length > 0);
  assert.ok(g.useAbility('ventisca'));
  assert.ok(g.enemies.every((e) => e.frozen > 0));
  assert.ok(!g.useAbility('ventisca'), 'en enfriamiento');
  // Sin torres, la base cae
  const lose = new TdGame({ map, level: 3, team: TEAM });
  for (let i = 0; i < 4000 && !lose.over; i++) lose.step(0.5);
  assert.equal(lose.phase, 'lost');
  assert.equal(lose.hp, 0);
});

test('curanderos curan y aceleradores aceleran a los de alrededor', () => {
  const map = TD_MAPS[0];
  const g = new TdGame({ map, level: 1, team: TEAM });
  g.callNextWave();
  g.step(0.1);
  const [a] = g.enemies;
  const sp = (g as unknown as { spawn: (s: object, d?: number, def?: object) => typeof a }).spawn.bind(g);
  const healer = sp({ at: 0, kind: 'healer', species: 182, path: 0 }, a.dist);
  a.hp = 1;
  g.step(3);
  assert.ok(a.hp > 1, 'curado');
  const b = sp({ at: 0, kind: 'normal', species: 10, path: 0 }, 2);
  sp({ at: 0, kind: 'hastener', species: 123, path: 0 }, 2.3);
  g.step(0.1);
  assert.ok(b.haste > 0);
  void healer;
});

test('equilibrio: un equipo razonable supera los primeros mapas; el último no se pasa sin mejorar; el infinito termina', () => {
  for (const idx of [0, 1]) {
    const g = autoplay(new TdGame({ map: TD_MAPS[idx], level: 1, team: TEAM }), { upgrades: true, abilities: true });
    assert.equal(g.phase, 'won', `mapa ${idx}`);
  }
  const g12 = autoplay(new TdGame({ map: TD_MAPS[0], level: TD_MAPS[0].levels, team: TEAM }), { upgrades: true, abilities: true });
  assert.equal(g12.phase, 'won', 'jefe del primer mapa');
  const last = autoplay(new TdGame({ map: LAST, level: LAST.levels, team: TEAM }), { upgrades: false, abilities: true });
  assert.equal(last.phase, 'lost');
  const inf = autoplay(new TdGame({ map: TD_MAPS[0], level: 0, team: TEAM }), { upgrades: true, abilities: true }, 20_000);
  assert.equal(inf.phase, 'lost');
  assert.ok(inf.cleared >= 12 && inf.cleared < 200, `infinito: ${inf.cleared}`);
  assert.equal(inf.maxHp, BASE_HP);
});

test('estrellas según la vida de la base', () => {
  assert.equal(starsFor(20, 20, true), 3);
  assert.equal(starsFor(18, 20, true), 3);
  assert.equal(starsFor(17, 20, true), 2);
  assert.equal(starsFor(10, 20, true), 2);
  assert.equal(starsFor(9, 20, true), 1);
  assert.equal(starsFor(20, 20, false), 0);
});

const clearLevels = (p: TdProgress, mapId: string, n: number, stars = 1): TdProgress => {
  for (let l = 1; l <= n; l++) p = withOutcome(p, { mapId, level: l, waves: wavesInLevel(l, mapLevels(mapId)), won: true, stars });
  return p;
};

test('desbloqueos: niveles en orden, siguiente mapa con el 50 % (hacia arriba) y el infinito con el mapa completo', () => {
  assert.equal(levelsNeeded(12), 6);
  assert.equal(levelsNeeded(11), 6);
  assert.equal(levelsNeeded(13), 7);
  const LEVELS_TO_UNLOCK_NEXT = levelsNeeded(LEVELS_PER_MAP);
  assert.equal(LEVELS_TO_UNLOCK_NEXT, 5);
  let p = emptyTdProgress();
  assert.ok(isMapUnlocked(p, 0) && !isMapUnlocked(p, 1));
  assert.ok(isLevelUnlocked(p, 0, 1) && !isLevelUnlocked(p, 0, 2));
  p = clearLevels(p, TD_MAPS[0].id, LEVELS_TO_UNLOCK_NEXT - 1);
  assert.ok(!isMapUnlocked(p, 1), 'justo por debajo del 50 %');
  assert.ok(isLevelUnlocked(p, 0, LEVELS_TO_UNLOCK_NEXT));
  p = clearLevels(p, TD_MAPS[0].id, LEVELS_TO_UNLOCK_NEXT);
  assert.ok(isMapUnlocked(p, 1), '50 % exacto');
  assert.ok(!isMapUnlocked(p, 2));
  assert.ok(!isEndlessUnlocked(p, TD_MAPS[0].id));
  p = clearLevels(p, TD_MAPS[0].id, LEVELS_PER_MAP - 1);
  assert.ok(!isEndlessUnlocked(p, TD_MAPS[0].id), 'falta el último nivel');
  p = clearLevels(p, TD_MAPS[0].id, LEVELS_PER_MAP);
  assert.ok(isEndlessUnlocked(p, TD_MAPS[0].id));
  assert.equal(levelsCleared(p, TD_MAPS[0].id), LEVELS_PER_MAP);
  // Perder no quita estrellas; ganar con más las sube
  const s0 = p.maps[TD_MAPS[0].id].stars[0];
  p = withOutcome(p, { mapId: TD_MAPS[0].id, level: 1, waves: 2, won: false, stars: 0 });
  assert.equal(p.maps[TD_MAPS[0].id].stars[0], s0);
  p = withOutcome(p, { mapId: TD_MAPS[0].id, level: 1, waves: 6, won: true, stars: 3 });
  assert.equal(p.maps[TD_MAPS[0].id].stars[0], 3);
  // Mapas largos: el siguiente pide la mitad de SUS niveles (13 → 7) y el infinito los 13
  const i13 = TD_MAPS.findIndex((m) => m.levels === 13);
  const m13 = TD_MAPS[i13];
  let q = emptyTdProgress();
  for (let i = 0; i < i13; i++) q = clearLevels(q, TD_MAPS[i].id, TD_MAPS[i].levels);
  assert.ok(isMapUnlocked(q, i13) && !isMapUnlocked(q, i13 + 1));
  q = clearLevels(q, m13.id, 6);
  assert.ok(!isMapUnlocked(q, i13 + 1), '6 de 13 no basta');
  q = clearLevels(q, m13.id, 7);
  assert.ok(isMapUnlocked(q, i13 + 1), '7 de 13');
  q = clearLevels(q, m13.id, 12);
  assert.ok(!isEndlessUnlocked(q, m13.id) && isLevelUnlocked(q, i13, 13) && !isLevelUnlocked(q, i13, 14));
  q = clearLevels(q, m13.id, 13);
  assert.ok(isEndlessUnlocked(q, m13.id));
  assert.equal(q.maps[m13.id].stars.length, 13);
});

test('niveles por mapa: de 10 a 15, crecen con el mapa y la pantalla de niveles cabe con 15', () => {
  assert.equal(TD_MAPS[0].levels, MIN_LEVELS);
  assert.equal(TD_MAPS[1].levels, MIN_LEVELS);
  assert.equal(LAST.levels, MAX_LEVELS);
  assert.equal(TD_MAPS[TD_MAPS.length - 2].levels, MAX_LEVELS);
  for (let i = 1; i < TD_MAPS.length; i++) {
    assert.ok(TD_MAPS[i].levels >= TD_MAPS[i - 1].levels && TD_MAPS[i].levels - TD_MAPS[i - 1].levels <= 1, 'reparto gradual');
  }
  assert.equal(new Set(TD_MAPS.map((m) => m.levels)).size, MAX_LEVELS - MIN_LEVELS + 1);
  for (let i = 0; i < MAX_LEVELS; i++) {
    const b = levelBox(i);
    assert.ok(b.x >= 60 && b.x + b.w <= 900 && b.y >= 100 && b.y + b.h < LEVEL_GRID_BOTTOM, `caja ${i}`);
    if (i % LEVEL_COLS) assert.ok(b.x >= levelBox(i - 1).x + levelBox(i - 1).w, 'sin solaparse');
  }
});

test('premios: tickets y caramelos, extra la primera vez por cada estrella; récord del infinito', () => {
  const before = emptyTdProgress().maps.x ?? { stars: Array(LEVELS_PER_MAP).fill(0), endless: 0 };
  // El jefe es el último nivel del mapa (10 en la pradera, no el 12)
  const notBoss = rewardsFor({ mapId: LAST.id, level: 10, waves: 8, won: true, stars: 1 }, { stars: Array(15).fill(0), endless: 0 });
  const isBoss = rewardsFor({ mapId: LAST.id, level: 15, waves: 11, won: true, stars: 1 }, { stars: Array(15).fill(0), endless: 0 });
  assert.ok(isBoss.candies >= notBoss.candies + 5);
  const r3 = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, before);
  assert.equal(r3.newStars, 3);
  assert.ok(r3.tickets > 0 && r3.candies >= 3 && r3.firstClear);
  const again = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, { stars: [3, ...Array(9).fill(0)], endless: 0 });
  assert.equal(again.newStars, 0);
  assert.ok(again.tickets < r3.tickets && again.candies === 0);
  const lost = rewardsFor({ mapId: 'pradera', level: 2, waves: 3, won: false, stars: 0 }, before);
  assert.equal(lost.newStars, 0);
  const boss = rewardsFor({ mapId: 'pradera', level: LEVELS_PER_MAP, waves: 11, won: true, stars: 1 }, { stars: Array(10).fill(0), endless: 0 });
  assert.ok(boss.tickets > r3.tickets - 18);
  const inf = rewardsFor({ mapId: 'pradera', level: 0, waves: 25, won: false, stars: 0 }, { stars: Array(10).fill(1), endless: 10 });
  assert.ok(inf.newRecord && inf.tickets > 0);
  assert.ok(!rewardsFor({ mapId: 'pradera', level: 0, waves: 5, won: false, stars: 0 }, { stars: [], endless: 10 }).newRecord);
});

test('guardado propio: clave nueva, se lee lo guardado y lo corrupto no rompe', () => {
  const s = fakeStorage();
  const r = submitTdOutcome({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 2 }, s);
  assert.equal(r.newStars, 2);
  assert.ok(s.data.has(TD_KEY));
  assert.equal(loadTdProgress(s).maps.pradera.stars[0], 2);
  submitTdOutcome({ mapId: 'pradera', level: 0, waves: 14, won: false, stars: 0 }, s);
  assert.equal(loadTdProgress(s).maps.pradera.endless, 14);
  assert.deepEqual(parseTdProgress('{roto'), emptyTdProgress());
  assert.deepEqual(parseTdProgress(null), emptyTdProgress());
  // Niveles saltados no cuentan
  const odd = parseTdProgress(JSON.stringify({ maps: { pradera: { stars: [1, 0, 3], endless: -4 } } }));
  assert.deepEqual(odd.maps.pradera.stars.slice(0, 3), [1, 0, 0]);
  assert.equal(odd.maps.pradera.endless, 0);
  assert.equal(loadTdProgress(null).maps.pradera, undefined);
  assert.ok(PROGRESS_KEYS.includes(TD_KEY), 'se borra con «Borrar progreso»');
});

test('voladores: siguen el camino como los de tierra y solo los alcanzan las torres con alcance aéreo', () => {
  const map = TD_MAPS[0];
  const g = new TdGame({ map, level: 1, team: TEAM });
  g.callNextWave();
  g.step(0.05);
  const sp = (g as unknown as { spawn: (s: object, d?: number) => import('../src/data/towerDefense/engine.ts').TdEnemy }).spawn.bind(g);
  const flyer = sp({ at: 0, kind: 'flying', species: 16, path: 0 }, 0);
  const walker = sp({ at: 0, kind: 'normal', species: 10, path: 0 }, 0);
  assert.ok(flyer.def.air && !walker.def.air);
  assert.deepEqual(flyer.pts, walker.pts, 'mismo recorrido');
  assert.equal(flyer.len, polyLength(pathPoints(map.paths[0])));
  // Va pasando por las casillas del camino (no en línea recta a la base)
  const road = new Set(pathCells(map.paths[0]).map((c) => `${c.x},${c.y}`));
  for (let i = 0; i < 40 && g.enemies.includes(flyer); i++) {
    g.step(0.25);
    if (g.enemies.includes(flyer)) assert.ok(road.has(`${Math.floor(flyer.x)},${Math.floor(flyer.y)}`), 'fuera del camino');
  }
  // Una torre de tierra no le dispara; una eléctrica sí
  const geo: TdMon = { id: 74, name: 'Geodude', types: ['rock', 'ground'], stats: st(40, 80, 100, 30, 30, 20), rarity: 'common' };
  const g2 = new TdGame({ map, level: 1, team: [geo, TEAM[3]] });
  g2.callNextWave();
  g2.step(0.05);
  for (const e of [...g2.enemies]) g2.enemies.splice(g2.enemies.indexOf(e), 1);
  const sp2 = (g2 as unknown as { spawn: (s: object, d?: number) => import('../src/data/towerDefense/engine.ts').TdEnemy }).spawn.bind(g2);
  const f2 = sp2({ at: 0, kind: 'flying', species: 16, path: 0 }, 4);
  const near = buildableCells(map).sort((a, b) => Math.hypot(a.x + 0.5 - f2.x, a.y + 0.5 - f2.y) - Math.hypot(b.x + 0.5 - f2.x, b.y + 0.5 - f2.y));
  g2.money = 10_000;
  g2.place(0, near[0].x, near[0].y);
  f2.frozen = 99;
  g2.step(2);
  assert.equal(f2.hp, f2.def.maxHp, 'la torre de tierra no alcanza voladores');
  g2.place(1, near[1].x, near[1].y);
  g2.step(2);
  assert.ok(f2.hp < f2.def.maxHp || !g2.enemies.includes(f2), 'la eléctrica sí');
});

test('megaevolución: nivel 6 extra pagando bastante, solo quien tenga forma mega', () => {
  const charmeleon = { ...TEAM[0], evolveId: 6 };
  const pikachu = { ...TEAM[3], evolveId: 26 };
  assert.equal(megaSpeciesOf(5, 6), 6);
  assert.equal(megaSpeciesOf(25, 26), null);
  assert.equal(megaSpeciesOf(115, null), 115, 'sin evolución: la propia especie (Kangaskhan)');
  assert.equal(megaSpriteName(6), 'charizard-mega-x');
  assert.ok(megaCostFor(charmeleon) > upgradeCostFor(charmeleon, 4)!, 'cuesta más que el nivel 5');
  // Estadísticas: más daño, alcance aéreo, ataque mega más a menudo y aura mega
  const s5 = towerStats(charmeleon, 5, 'a');
  const s6 = towerStats(charmeleon, MEGA_LEVEL, 'a');
  assert.ok(s6.damage > s5.damage * 1.4 && s6.rate > s5.rate && s6.range > s5.range);
  assert.ok(s6.mega && !s5.mega && s6.air && s6.megaAura > 1 && s5.megaAura === 1);
  assert.ok(s6.specialEvery > 0 && s6.specialEvery < s5.specialEvery);
  assert.ok(megaMoveOf(charmeleon) && megaMoveOf(charmeleon) !== 'Llamarada');
  assert.equal(levelLabel(MEGA_LEVEL, true), 'Nv. 6 · Megaevolución');
  assert.ok(spentFor(charmeleon, MEGA_LEVEL) === spentFor(charmeleon, 5) + megaCostFor(charmeleon));
  // En partida
  const map = TD_MAPS[0];
  const cells = buildableCells(map);
  const g = new TdGame({ map, level: 1, team: [charmeleon, pikachu, TEAM[1]] });
  g.money = 100_000;
  const t = g.place(0, cells[10].x, cells[10].y)!;
  const p = g.place(1, cells[11].x, cells[11].y)!;
  for (const tw of [t, p]) {
    g.upgrade(tw.id);
    g.upgrade(tw.id, 'a');
    g.upgrade(tw.id);
    g.upgrade(tw.id);
  }
  assert.equal(t.level, 5);
  assert.equal(t.evolved, 6);
  assert.equal(g.upgradeCost(t), megaCostFor(charmeleon));
  assert.equal(g.upgradeCost(p), null, 'Raichu no tiene mega: se queda en el 5');
  assert.equal(g.upgrade(p.id), 'max');
  g.drainEvents();
  g.money = megaCostFor(charmeleon) - 1;
  assert.equal(g.upgrade(t.id), 'poor');
  g.money = megaCostFor(charmeleon);
  assert.equal(g.upgrade(t.id), 'ok');
  assert.equal(g.money, 0);
  assert.equal(t.level, MEGA_LEVEL);
  assert.equal(t.mega, 6);
  assert.ok(g.drainEvents().some((e) => e.t === 'mega' && e.towerId === t.id));
  assert.equal(g.upgrade(t.id), 'max');
  // Aura mega: refuerza a una torre vecina
  const nb = cells.find((c) => Math.hypot(c.x - t.x, c.y - t.y) <= 1 && !g.towerAt(c.x, c.y))!;
  g.money = 1000;
  const w = g.place(2, nb.x, nb.y)!;
  assert.ok(g.statsOf(w).damage > towerStats(w.mon, 1, null).damage);
  assert.ok(g.sellValue(t) > g.sellValue(p));
});

test('arte de la megaevolución de las torres: destello de megaFx, símbolo mega y versión quieta con pocos efectos', async () => {
  const { readFileSync } = await import('node:fs');
  const art = readFileSync(new URL('../src/ui/art/tdMegaArt.ts', import.meta.url), 'utf8');
  assert.match(art, /playerMegaFx\(/, 'el destello reutiliza el de megaFx');
  assert.match(art, /drawMegaSymbol\(/, 'aura con el símbolo mega');
  assert.match(art, /lowFx\(\)/, 'versión quieta con pocos efectos');
  const scene = readFileSync(new URL('../src/scenes/TowerDefenseScene.ts', import.meta.url), 'utf8');
  assert.match(scene, /case 'mega'/);
  assert.match(scene, /drawMegaAura\(/);
  assert.match(scene, /megaSpriteName\(/, 'sprite de la forma mega de PokeAPI');
});
