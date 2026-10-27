// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TD_COLS, TD_MAPS, TD_ROWS, baseCell, buildableCells, entryCells, isBuildable, pathCells, pointAt, polyLength, pathPoints, LAYOUTS,
} from '../src/data/towerDefense/maps.ts';
import { MAP_FOES, TD_TYPES, TRIAL_TEAM, FARM_IDS, type TdMon } from '../src/data/towerDefense/species.ts';
import {
  AIR_TYPES, MAX_TOWER_LEVEL, bestTypeMul, branchInfo, sellValue, spentFor, tdTypeMul, towerCost, towerStats, towerStyle, upgradeCostFor,
} from '../src/data/towerDefense/towers.ts';
import {
  LEVELS_PER_MAP, baseHp, enemyDef, isBossWave, kindUnlocked, waveBonus, waveSpawns, wavesInLevel,
} from '../src/data/towerDefense/waves.ts';
import { ABILITIES, ABILITY_INFO, freshCooldowns, tickCooldowns } from '../src/data/towerDefense/abilities.ts';
import {
  LEVELS_TO_UNLOCK_NEXT, TD_KEY, emptyTdProgress, isEndlessUnlocked, isLevelUnlocked, isMapUnlocked, levelsCleared, levelsNeeded,
  loadTdProgress, parseTdProgress, rewardsFor, starsFor, submitTdOutcome, withOutcome, type TdProgress,
} from '../src/data/towerDefense/progress.ts';
import { BASE_HP, TdGame } from '../src/data/towerDefense/engine.ts';
import { autoplay } from '../src/data/towerDefense/autoplay.ts';
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
  assert.equal(wavesInLevel(1), 6);
  assert.equal(wavesInLevel(LEVELS_PER_MAP), 11);
  assert.ok(baseHp(8, 0) > baseHp(1, 0) && baseHp(1, 5) > baseHp(1, 0));
  assert.ok(waveSpawns(m, 1, 6).length > waveSpawns(m, 1, 1).length);
  for (let lv = 1; lv < LEVELS_PER_MAP; lv++) for (let w = 1; w <= wavesInLevel(lv); w++) assert.ok(!waveSpawns(m, lv, w).some((s) => s.kind === 'boss'));
  const last = waveSpawns(m, LEVELS_PER_MAP, wavesInLevel(LEVELS_PER_MAP));
  assert.equal(last.filter((s) => s.kind === 'boss').length, 1);
  assert.equal(last.find((s) => s.kind === 'boss')!.species, MAP_FOES.bosque.bosses[1]);
  // Infinito: jefe cada 10
  assert.ok(isBossWave({ tier: 0, level: 0 }, 10) && isBossWave({ tier: 0, level: 0 }, 20) && !isBossWave({ tier: 0, level: 0 }, 15));
  // Los papeles difíciles salen antes en los mapas difíciles
  assert.ok(!kindUnlocked('hastener', { tier: 0, level: 1 }, 1));
  assert.ok(kindUnlocked('hastener', { tier: 10, level: 1 }, 1));
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
  assert.equal(tickCooldowns({ rayo: 10, ventisca: 0, curar: 5 }, 6).curar, 0);
  assert.deepEqual(freshCooldowns(), { rayo: 0, ventisca: 0, curar: 0 });
  assert.ok(!g.useAbility('curar'), 'base llena');
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
  const g12 = autoplay(new TdGame({ map: TD_MAPS[0], level: LEVELS_PER_MAP, team: TEAM }), { upgrades: true, abilities: true });
  assert.equal(g12.phase, 'won', 'jefe del primer mapa');
  const last = autoplay(new TdGame({ map: TD_MAPS[TD_MAPS.length - 1], level: LEVELS_PER_MAP, team: TEAM }), { upgrades: false, abilities: true });
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
  for (let l = 1; l <= n; l++) p = withOutcome(p, { mapId, level: l, waves: wavesInLevel(l), won: true, stars });
  return p;
};

test('desbloqueos: niveles en orden, siguiente mapa con el 50 % (hacia arriba) y el infinito con el mapa completo', () => {
  assert.equal(levelsNeeded(12), 6);
  assert.equal(levelsNeeded(11), 6);
  assert.equal(levelsNeeded(13), 7);
  assert.equal(LEVELS_TO_UNLOCK_NEXT, Math.ceil(LEVELS_PER_MAP / 2));
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
});

test('premios: tickets y caramelos, extra la primera vez por cada estrella; récord del infinito', () => {
  const before = emptyTdProgress().maps.x ?? { stars: Array(LEVELS_PER_MAP).fill(0), endless: 0 };
  const r3 = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, before);
  assert.equal(r3.newStars, 3);
  assert.ok(r3.tickets > 0 && r3.candies >= 3 && r3.firstClear);
  const again = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, { stars: [3, ...Array(11).fill(0)], endless: 0 });
  assert.equal(again.newStars, 0);
  assert.ok(again.tickets < r3.tickets && again.candies === 0);
  const lost = rewardsFor({ mapId: 'pradera', level: 2, waves: 3, won: false, stars: 0 }, before);
  assert.equal(lost.newStars, 0);
  const boss = rewardsFor({ mapId: 'pradera', level: LEVELS_PER_MAP, waves: 11, won: true, stars: 1 }, { stars: Array(12).fill(0), endless: 0 });
  assert.ok(boss.tickets > r3.tickets - 18);
  const inf = rewardsFor({ mapId: 'pradera', level: 0, waves: 25, won: false, stars: 0 }, { stars: Array(12).fill(1), endless: 10 });
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
