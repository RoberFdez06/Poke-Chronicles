// Defensa de torres: niveles temáticos por tipo (themes.ts). Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_MAPS } from '../src/data/towerDefense/maps.ts';
import {
  ALL_TYPES, COUNTER_DAMAGE, CONTRA_HP, MAP_THEMES, THEME_DAMAGE, THEME_FOES, THEME_RANGE, contraFoes, contraTypes, counterTypes, levelTheme,
  resistsTheme, themeBanner, themeBoost, themeHint, themeSpeciesIds, themeSummary, themesOf,
} from '../src/data/towerDefense/themes.ts';
import { THEME_TERRAIN, TERRAIN_FX, TERRAIN_INFO, THEME_TERRAINS, mapForLevel } from '../src/data/towerDefense/variants.ts';
import { enemyDef, stagePower, waveSpawns, wavesInLevel } from '../src/data/towerDefense/waves.ts';
import { TD_TYPES, THEME_MON_TYPES, tdTypesOf, type TdMon } from '../src/data/towerDefense/species.ts';
import { CHIEF_TYPES } from '../src/data/towerDefense/chiefs.ts';
import { TdGame, type TdEnemy } from '../src/data/towerDefense/engine.ts';
import { towerStats, tdTypeMul } from '../src/data/towerDefense/towers.ts';
import { autoplay } from '../src/data/towerDefense/autoplay.ts';
import { pathCells } from '../src/data/towerDefense/maps.ts';

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number) => ({ hp, attack, defense, spAttack, spDefense, speed });
const mon = (id: number, name: string, types: string[]): TdMon => ({ id, name, types, stats: st(60, 70, 60, 70, 60, 70), rarity: 'rare' });
const TEAM: TdMon[] = [
  { id: 5, name: 'Charmeleon', types: ['fire'], stats: st(58, 64, 58, 80, 65, 80), rarity: 'rare' },
  { id: 8, name: 'Wartortle', types: ['water'], stats: st(59, 63, 80, 65, 80, 58), rarity: 'rare' },
  { id: 2, name: 'Ivysaur', types: ['grass', 'poison'], stats: st(60, 62, 63, 80, 80, 60), rarity: 'rare' },
  { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' },
  { id: 52, name: 'Meowth', types: ['normal'], stats: st(40, 45, 35, 40, 40, 90), rarity: 'common' },
  { id: 93, name: 'Haunter', types: ['ghost', 'poison'], stats: st(45, 50, 45, 115, 55, 95), rarity: 'rare' },
];
type Spawner = { spawn: (s: object, d?: number) => TdEnemy };
const spawnIn = (g: TdGame, kind: string, species: number, dist = 1, path = 0) => (g as unknown as Spawner).spawn.call(g, { at: 0, kind, species, path }, dist);

test('cada mapa tiene sus tipos; una fase por cada uno de los 18 tipos y los propios no se repiten', () => {
  assert.deepEqual(Object.keys(MAP_THEMES), TD_MAPS.map((m) => m.id));
  const own = TD_MAPS.map((m) => themesOf(m)[0]);
  assert.equal(new Set(own).size, TD_MAPS.length, 'tipo propio distinto en cada mapa');
  assert.deepEqual([...own].sort(), [...ALL_TYPES].sort(), 'los 18 tipos como tipo principal');
  const used = new Set<string>();
  for (const m of TD_MAPS) for (let l = 0; l <= m.levels; l++) used.add(mapForLevel(m, l).theme);
  assert.deepEqual([...used].sort(), [...ALL_TYPES].sort(), 'se usan los 18 tipos en los niveles');
  for (const m of TD_MAPS) {
    assert.equal(levelTheme(m, 1), themesOf(m)[0], `${m.id}: el nivel 1 es el tipo del mapa`);
    assert.equal(levelTheme(m, m.levels), themesOf(m)[0], `${m.id}: el último, también`);
    assert.equal(levelTheme(m, 0), themesOf(m)[0], `${m.id}: y el infinito`);
    for (let l = 1; l <= m.levels; l++) assert.ok(themesOf(m).includes(levelTheme(m, l)));
    // Varios tipos por mapa: no siempre el mismo
    assert.ok(new Set(Array.from({ length: m.levels }, (_, i) => levelTheme(m, i + 1))).size >= 2, `${m.id}: un solo tipo`);
  }
});

test('potenciación: las torres del tipo tema ganan daño y alcance; las súper eficaces, Ventaja', () => {
  assert.deepEqual(themeBoost('ghost', ['ghost', 'poison']), { kind: 'tema', damage: THEME_DAMAGE, range: THEME_RANGE });
  assert.equal(themeBoost('ghost', ['dark']).kind, 'ventaja');
  assert.equal(themeBoost('ghost', ['dark']).damage, COUNTER_DAMAGE);
  assert.equal(themeBoost('ghost', ['water']).kind, null);
  assert.equal(themeBoost(null, ['ghost']).kind, null);
  assert.deepEqual(counterTypes('ghost').sort(), ['dark', 'ghost']);
  assert.ok(THEME_DAMAGE >= 1.25 && THEME_RANGE > 1, 'bonus claro');
  assert.match(themeBanner('ghost'), /^Nivel Fantasma: tus torres Fantasma \+30 % de daño y \+15 % de alcance$/);
  assert.match(themeHint('ghost'), /Siniestro/);
  assert.ok(themeSummary('fire').startsWith('Tipo Fuego'));
  // En la partida: la torre Fantasma de Torre Espectral nv. 1 sale con el bonus aplicado
  const torre = TD_MAPS.find((m) => m.id === 'torre')!;
  const g = new TdGame({ map: torre, level: 1, team: [mon(92, 'Gastly', ['ghost']), mon(261, 'Poochyena', ['dark']), mon(7, 'Squirtle', ['water'])] });
  assert.equal(g.theme, 'ghost');
  g.money = 10_000;
  const free = (x0: number) => {
    for (let y = 0; y < 11; y++) for (let x = x0; x < 16; x++) if (!g.placeError(0, x, y) && !g.terrainAt(x, y)) return { x, y };
    throw new Error('sin sitio');
  };
  const at = free(0);
  const t = g.place(0, at.x, at.y)!;
  const base = towerStats(t.mon, 1, null);
  const s = g.statsOf(t);
  assert.ok(Math.abs(s.damage - base.damage * THEME_DAMAGE) < 0.2, `daño ${s.damage} vs ${base.damage}`);
  assert.ok(Math.abs(s.range - base.range * THEME_RANGE) < 0.02);
  const at2 = free(at.x + 2);
  const d = g.place(1, at2.x, at2.y)!;
  assert.ok(g.statsOf(d).damage > towerStats(d.mon, 1, null).damage, 'Ventaja');
  const at3 = free(at2.x + 2);
  const w = g.place(2, at3.x, at3.y)!;
  assert.equal(g.statsOf(w).damage, towerStats(w.mon, 1, null).damage, 'sin bonus');
});

test('enemigos acordes: sobre todo del tipo tema (sorteo), también del bioma y de visita, y contra-tipos al final', () => {
  for (const ty of ALL_TYPES) {
    const f = THEME_FOES[ty];
    assert.ok(f, `faltan los Pokémon de ${ty}`);
    for (const id of [...f.ground, ...f.air, ...f.big]) {
      assert.ok(TD_TYPES[id] || THEME_MON_TYPES[id] || CHIEF_TYPES[id], `falta el tipo de ${id}`);
      assert.ok(tdTypesOf(id).includes(ty), `${id} no es de tipo ${ty}`);
    }
    const c = contraFoes(ty);
    assert.ok(contraTypes(ty).length >= 1);
    for (const g of ['ground', 'air', 'big'] as const) {
      assert.ok(c[g].length >= 1, `${ty}: sin contra-tipos (${g})`);
      for (const id of c[g]) assert.ok(tdTypeMul(ty, tdTypesOf(id)) < 1, `${id} no resiste ${ty}`);
    }
    assert.ok(themeSpeciesIds(ty).length >= 10);
  }
  for (const m of TD_MAPS) {
    for (const lv of [1, Math.ceil(m.levels / 2), m.levels]) {
      const theme = levelTheme(m, lv);
      const W = wavesInLevel(lv, m.levels);
      let themed = 0;
      let related = 0;
      let total = 0;
      for (let w = 1; w <= W; w++) {
        const sp = waveSpawns(m, lv, w).filter((s) => s.kind !== 'boss' && s.kind !== 'chief');
        total += sp.length;
        themed += sp.filter((s) => tdTypesOf(s.species).includes(theme)).length;
        related += sp.filter((s) => !s.contra).length;
        // Primera mitad sin contra-tipos; en la última oleada, contra-tipos que resisten el tema con vida extra
        if (w <= W / 2) assert.ok(!sp.some((s) => s.contra), `${m.id}/${lv}/${w}: contra-tipos antes de tiempo`);
        if (w === W) {
          const contra = sp.filter((s) => s.contra);
          assert.ok(contra.length >= 1, `${m.id}/${lv}: sin contra-tipos al final`);
          for (const s of contra) {
            assert.ok(resistsTheme(theme, s.species), `${m.id}/${lv}: ${s.species} no resiste ${theme}`);
            assert.equal(s.hpMul, CONTRA_HP);
          }
        }
      }
      // Mayoría del tema y su entorno; el tipo tema solo, al menos el 40 % (es el más probable, no una cuota fija)
      assert.ok(related / total >= 0.6, `${m.id}/${lv}: solo ${Math.round((related / total) * 100)} % del tema y el bioma`);
      assert.ok(themed / total >= 0.4, `${m.id}/${lv}: solo ${Math.round((themed / total) * 100)} % del tipo ${theme}`);
    }
  }
});

test('mapa enfocado al tipo: terreno propio de cada tipo con efecto real', () => {
  assert.equal(new Set(Object.values(THEME_TERRAIN)).size, ALL_TYPES.length, 'un terreno por tipo');
  for (const k of THEME_TERRAINS) assert.ok(TERRAIN_INFO[k] && TERRAIN_FX[k] && Object.keys(TERRAIN_FX[k]).length, k);
  for (const ty of ALL_TYPES) assert.ok(THEME_TERRAIN[ty], ty);
  for (const m of TD_MAPS) {
    for (let l = 0; l <= m.levels; l++) {
      const lm = mapForLevel(m, l);
      const kind = THEME_TERRAIN[lm.theme];
      const n = lm.terrain.filter((t) => t.kind === kind).length;
      assert.ok(n >= 2, `${m.id}/${l}: sin terreno de ${lm.theme}`);
      const keys = lm.terrain.map((t) => `${t.x},${t.y}`);
      assert.equal(new Set(keys).size, keys.length, `${m.id}/${l}: terreno repetido`);
    }
  }
  // Efectos: lava quema (no a los Fuego), losas protegen, almas esconden, placa evita aturdir, charca frena
  const g = new TdGame({ map: TD_MAPS[0], level: 2, team: TEAM });
  const lm = g.map;
  const road = lm.paths.flatMap((p) => pathCells(p));
  const cell = road[4];
  lm.terrain = lm.terrain.filter((t) => !(t.x === cell.x && t.y === cell.y));
  const put = (kind: (typeof THEME_TERRAINS)[number]) => {
    lm.terrain = lm.terrain.filter((t) => !(t.x === cell.x && t.y === cell.y));
    lm.terrain.push({ ...cell, kind });
  };
  const atCell = (e: TdEnemy) => {
    e.x = cell.x + 0.5;
    e.y = cell.y + 0.5;
  };
  put('lava');
  const e = spawnIn(g, 'normal', 43);
  atCell(e);
  const hp0 = e.hp;
  (g as unknown as { terrainTick: (e: TdEnemy, fx: object, dt: number) => void }).terrainTick(e, TERRAIN_FX.lava, 1);
  assert.ok(e.hp < hp0, 'la lava quema');
  assert.ok((g as unknown as { groundFx: (e: TdEnemy) => unknown }).groundFx(e));
  const fire = spawnIn(g, 'normal', 4);
  atCell(fire);
  assert.equal((g as unknown as { groundFx: (e: TdEnemy) => unknown }).groundFx(fire), null, 'a los Fuego no');
  put('almas');
  assert.ok(g.isHidden(e), 'en la niebla de almas no se le apunta');
  put('losas');
  const before = e.hp;
  (g as unknown as { damage: (e: TdEnemy, raw: number, t: null, o: object) => void }).damage(e, 40, null, { type: 'normal', mul: 1, crit: false, special: false, splash: 0 });
  assert.equal(before - e.hp, 30, 'las losas quitan un 25 %');
  const tile = lm.terrain.find((t) => !TERRAIN_INFO[t.kind].road) ?? { x: 0, y: 0 };
  lm.terrain = lm.terrain.filter((t) => !(t.x === tile.x && t.y === tile.y));
  lm.terrain.push({ x: tile.x, y: tile.y, kind: 'placa' });
  g.money = 10_000;
  const tw = g.place(0, tile.x, tile.y);
  if (tw) assert.ok(g.stunProof(tw), 'la placa de acero evita el aturdimiento');
  lm.terrain = lm.terrain.filter((t) => !(t.x === tile.x && t.y === tile.y));
  lm.terrain.push({ x: tile.x, y: tile.y, kind: 'escamas' });
  if (tw) assert.ok(g.statsOf(tw).damage > towerStats(tw.mon, 1, null).damage * 1.25, 'escamas +30 % de daño');
  assert.ok(enemyDef('normal', 43, 3, stagePower(g.stage)).maxHp > 0);
});

test('equilibrio: el bot sigue ganando los primeros niveles y, con los tipos adecuados, uno difícil', () => {
  for (const idx of [0, 1, 2, 3]) {
    const g = autoplay(new TdGame({ map: TD_MAPS[idx], level: 1, team: TEAM, seed: 7 }), { upgrades: true, abilities: true });
    assert.equal(g.phase, 'won', `mapa ${TD_MAPS[idx].id}`);
  }
  // Cráter Ígneo nv. 7 (Roca): llevando Agua y Roca se gana; potenciar el tema solo no lo hace trivial
  const volcan = TD_MAPS.find((m) => m.id === 'volcan')!;
  assert.equal(levelTheme(volcan, 7), 'rock');
  const team = [...TEAM.slice(0, 3), TEAM[5], mon(74, 'Geodude', ['rock']), mon(7, 'Squirtle', ['water'])];
  const g = autoplay(new TdGame({ map: volcan, level: 7, team, seed: 7 }), { upgrades: true, abilities: true });
  assert.equal(g.phase, 'won', 'Cráter Ígneo nv. 7 con un equipo pensado');
});
