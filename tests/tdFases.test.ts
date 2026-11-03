// Defensa de torres: una fase por tipo, enemigos por probabilidad, oscuros, minijefes y jefes (rama tdfases).
// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_MAPS, mapIndex } from '../src/data/towerDefense/maps.ts';
import {
  ALL_TYPES, FOE_SOURCES, MAP_FINAL_BOSS, bigMonCandidates, contraTypes, foeSource, foeWeights, levelBossFor, levelSeed, levelTheme,
  minibossFor, themesOf, unitRoll, visitorTypes,
} from '../src/data/towerDefense/themes.ts';
import { THEME_FOES } from '../src/data/towerDefense/themes.ts';
import { bossSpecies, darkChance, darkWaveCap, isBossWave, isChiefWave, levelSpeciesIds, waveSpawns, wavesInLevel } from '../src/data/towerDefense/waves.ts';
import { BOSS_POOL, CHIEF_NAMES, MINIBOSS_POOL, bigMonLabel, isBossMon, isMinibossMon } from '../src/data/towerDefense/chiefs.ts';
import { MAP_FOES, tdTypesOf, type TdMon } from '../src/data/towerDefense/species.ts';
import { PSEUDO_LEGENDARY_IDS, ULTRA_IDS } from '../src/data/guardians.ts';
import { emptyTdProgress, isMapUnlocked, levelsNeeded, mapProgress, parseTdProgress, withOutcome } from '../src/data/towerDefense/progress.ts';
import { TdGame, type TdEnemy } from '../src/data/towerDefense/engine.ts';
import { autoplay } from '../src/data/towerDefense/autoplay.ts';
import { levelFoesLine, matchupWarning } from '../src/data/towerDefense/matchupWarning.ts';
import { TD_DARK_MUL, eyeSize } from '../src/data/darkMon.ts';

const st = (v: number) => ({ hp: v, attack: v, defense: v, spAttack: v, spDefense: v, speed: v });
const stage = (m: (typeof TD_MAPS)[number], level: number) => ({ tier: m.tier, level, levels: m.levels });

test('una fase por tipo: los 18 tipos como tipo principal; las nuevas van al final sin tocar las de siempre', () => {
  assert.equal(TD_MAPS.length, 18);
  const own = TD_MAPS.map((m) => themesOf(m)[0]);
  assert.deepEqual([...own].sort(), [...ALL_TYPES].sort());
  assert.equal(themesOf(TD_MAPS[16])[0], 'psychic');
  assert.equal(themesOf(TD_MAPS[17])[0], 'normal');
  assert.equal(themesOf(TD_MAPS[13])[0], 'dark', 'Siniestro tiene su fase (Lodazal Negro)');
  // Dificultad creciente y niveles al máximo en las dos últimas; jefe final propio
  for (const id of ['templo', 'origen']) {
    const m = TD_MAPS[mapIndex(id)];
    assert.equal(m.levels, 15);
    assert.ok(m.startMoney > TD_MAPS[mapIndex(id) - 1].startMoney);
    assert.equal(bossSpecies(m, m.levels, wavesInLevel(m.levels, m.levels)), MAP_FINAL_BOSS[id]);
    assert.ok(tdTypesOf(MAP_FINAL_BOSS[id]).includes(themesOf(m)[0]), `${id}: el jefe final es de su tipo`);
  }
  // Desbloqueo: el templo con la mitad de Cumbre Celeste y el origen con la mitad del templo
  let p = emptyTdProgress();
  for (let i = 0; i < 16; i++) for (let l = 1; l <= TD_MAPS[i].levels; l++) p = withOutcome(p, { mapId: TD_MAPS[i].id, level: l, waves: 1, won: true, stars: 1 });
  assert.ok(isMapUnlocked(p, 16) && !isMapUnlocked(p, 17));
  for (let l = 1; l <= levelsNeeded(15); l++) p = withOutcome(p, { mapId: 'templo', level: l, waves: 1, won: true, stars: 2 });
  assert.ok(isMapUnlocked(p, 17));
  // Un guardado de antes (16 mapas) se lee igual y las fases nuevas empiezan vacías
  const old = JSON.stringify({ maps: { pradera: { stars: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0], endless: 4 }, cumbre: { stars: Array(15).fill(1), endless: 9 } } });
  const q = parseTdProgress(old);
  assert.deepEqual(q.maps.pradera.stars.slice(0, 3), [3, 2, 1]);
  assert.equal(q.maps.cumbre.endless, 9);
  assert.deepEqual(mapProgress(q, 'templo').stars, Array(15).fill(0));
});

test('probabilidad, no cuota: sorteo ponderado reproducible por semilla de nivel', () => {
  for (const [w, W] of [[1, 10], [7, 10], [10, 10], [3, Infinity], [14, Infinity]] as const) {
    const ws = foeWeights(w, W);
    assert.ok(Math.abs(FOE_SOURCES.reduce((a, k) => a + ws[k], 0) - 1) < 1e-9);
    assert.ok(ws.tema >= 0.45 && ws.tema === Math.max(...FOE_SOURCES.map((k) => ws[k])), 'el tema es lo más probable');
    assert.ok(ws.entorno > 0 && ws.otro > 0, 'también salen del bioma y de otros tipos');
  }
  assert.equal(foeWeights(2, 10).contra, 0, 'sin contra-tipos en la primera mitad');
  assert.ok(foeWeights(9, 10).contra > foeWeights(6, 10).contra, 'más contra-tipos al final');
  assert.ok(foeWeights(9, 10, 'tank').contra > foeWeights(9, 10).contra, 'los grandes, más a menudo contra-tipos');
  // Determinista: misma semilla, misma tirada; otra semilla, otra secuencia
  const seq = (seed: string) => Array.from({ length: 40 }, (_, i) => foeSource(i, 3, 10, 'normal', seed));
  assert.deepEqual(seq('pradera|3'), seq('pradera|3'));
  assert.notDeepEqual(seq('pradera|3'), seq('gruta|3'));
  assert.ok(unitRoll('a') >= 0 && unitRoll('a') < 1 && unitRoll('a') === unitRoll('a'));
  // Frecuencias: con muchas tiradas, ~58 % del tema al principio (no 3 de cada 4 fijos)
  const n = 4000;
  const cnt: Record<string, number> = { tema: 0, entorno: 0, otro: 0, contra: 0 };
  for (let i = 0; i < n; i++) cnt[foeSource(i % 30, 1 + Math.floor(i / 30) % 3, 12, 'normal', `m${i % 7}|${i % 11}`)]++;
  assert.ok(cnt.tema / n > 0.52 && cnt.tema / n < 0.64, `tema ${cnt.tema / n}`);
  assert.ok(cnt.entorno / n > 0.2 && cnt.otro / n > 0.1 && cnt.contra === 0);
  // Las oleadas, iguales cada vez y con «visitas» de otros tipos (que no son el tema ni sus contra-tipos)
  for (const m of TD_MAPS) {
    assert.deepEqual(waveSpawns(m, 3, 4), waveSpawns(m, 3, 4));
    const theme = levelTheme(m, 3);
    const vis = visitorTypes(theme, levelSeed(m.id, 3));
    assert.equal(new Set(vis).size, 2);
    for (const v of vis) assert.ok(v !== theme && !contraTypes(theme).includes(v));
    const visIds = new Set(vis.flatMap((v) => [...THEME_FOES[v].ground, ...THEME_FOES[v].air, ...THEME_FOES[v].big]));
    const W = wavesInLevel(3, m.levels);
    const all = Array.from({ length: W }, (_, i) => waveSpawns(m, 3, i + 1)).flat();
    assert.ok(all.some((s) => visIds.has(s.species) && !tdTypesOf(s.species).includes(theme)), `${m.id}: sin visitas`);
    // Todo lo que sale se carga antes de empezar
    const ids = new Set(levelSpeciesIds(m, 3));
    for (const s of all) assert.ok(ids.has(s.species));
  }
});

test('oscuros: nada al principio, probabilidad creciente, más en Siniestro y con su ventaja en el motor', () => {
  for (const m of TD_MAPS) {
    for (const lv of [1, Math.ceil(m.levels / 2), m.levels]) {
      const W = wavesInLevel(lv, m.levels);
      const s = stage(m, lv);
      for (let w = 1; w <= W; w++) {
        const sp = waveSpawns(m, lv, w);
        if (w < 4 || w < W / 2) assert.ok(!sp.some((q) => q.dark), `${m.id}/${lv}/${w}: oscuro demasiado pronto`);
        assert.ok(sp.filter((q) => q.dark && q.kind !== 'boss' && q.kind !== 'chief').length <= darkWaveCap(s));
        if (w > 1) assert.ok(darkChance(s, w, 'enemy') >= darkChance(s, w - 1, 'enemy'), 'nunca baja');
        assert.ok(!sp.some((q) => q.dark && q.kind === 'brood'));
      }
    }
  }
  const lod = TD_MAPS[mapIndex('lodazal')];
  const s = stage(lod, lod.levels);
  const W = wavesInLevel(lod.levels, lod.levels);
  assert.ok(darkChance(s, W, 'enemy', 'dark') > darkChance(s, W, 'enemy', 'fire'), 'más oscuros en la fase Siniestro');
  assert.ok(darkChance(s, W, 'miniboss') > darkChance(s, W, 'enemy'), 'minijefes oscuros, algo más');
  assert.ok(darkChance(stage(TD_MAPS[0], 1), 6, 'enemy') < darkChance(s, W, 'enemy'), 'más en los mapas difíciles');
  // Salen de verdad: el último nivel del Lodazal trae varios oscuros
  const darks = Array.from({ length: W }, (_, i) => waveSpawns(lod, lod.levels, i + 1)).flat().filter((q) => q.dark);
  assert.ok(darks.length >= 3, `solo ${darks.length} oscuros`);
  // El motor respeta la marca: más vida y más dinero
  const g = new TdGame({ map: lod, level: 2, team: [{ id: 1000, name: 'x', types: ['fighting'], stats: st(70), rarity: 'rare' } as TdMon] });
  const sp = (g as unknown as { spawn: (s: object, d?: number) => TdEnemy }).spawn;
  const a = sp.call(g, { at: 0, kind: 'normal', species: 261, path: 0 }, 1);
  const b = sp.call(g, { at: 0, kind: 'normal', species: 261, path: 0, dark: true }, 1);
  assert.ok(!a.dark && b.dark);
  assert.equal(b.def.maxHp, Math.round(a.def.maxHp * TD_DARK_MUL.hp));
  assert.ok(b.def.bounty > a.def.bounty);
  // Ojos rojos visibles en los sprites pequeños de la defensa (mínimo 3 px)
  assert.equal(eyeSize(42, 3), 3);
  assert.equal(eyeSize(42), 2);
  assert.equal(eyeSize(130, 3), 5);
  assert.equal(eyeSize(Number.NaN, 3), 3);
});

test('minijefes pseudolegendarios o ultraentes y jefes legendarios o singulares, del tipo tema si hay', () => {
  assert.deepEqual([...MINIBOSS_POOL].sort((a, b) => a - b), [...new Set([...PSEUDO_LEGENDARY_IDS, ...ULTRA_IDS])].sort((a, b) => a - b));
  for (const id of [...MINIBOSS_POOL, ...BOSS_POOL]) {
    assert.ok(CHIEF_NAMES[id], `sin nombre ${id}`);
    assert.ok(tdTypesOf(id).length >= 1 && tdTypesOf(id).every((t) => (ALL_TYPES as readonly string[]).includes(t)));
  }
  for (const b of Object.values(MAP_FOES)) for (const id of b.bosses) assert.ok(isBossMon(id), `jefe del bioma ${id} no es legendario`);
  assert.equal(bigMonLabel(149), 'Pseudolegendario');
  assert.equal(bigMonLabel(796), 'Ultraente');
  assert.equal(bigMonLabel(150), 'Legendario');
  // Los 18 tipos tienen candidatos (del tipo o, si no hay, rivales que le ganan)
  for (const ty of ALL_TYPES) {
    for (const pool of [MINIBOSS_POOL, BOSS_POOL]) {
      const c = bigMonCandidates(pool, ty);
      assert.ok(c.match.length + c.rival.length >= 1, `${ty}: sin candidatos`);
    }
    for (let k = 0; k < 6; k++) {
      const a = minibossFor(ty, `x|${ty}`, 5 * (k + 1));
      const b = minibossFor(ty, `x|${ty}`, 5 * (k + 2));
      assert.ok(isMinibossMon(a));
      assert.notEqual(a, b, `${ty}: minijefes repetidos seguidos`);
    }
  }
  // Por oleada: minijefe cada 5, jefe en la última de cada nivel (y cada 10 en el infinito), con su categoría
  for (const m of TD_MAPS) {
    let prevBoss = -1;
    for (let lv = 1; lv <= m.levels; lv++) {
      const s = stage(m, lv);
      const W = wavesInLevel(lv, m.levels);
      const theme = levelTheme(m, lv);
      let prevMini = -1;
      for (let w = 1; w <= W; w++) {
        const sp = waveSpawns(m, lv, w);
        const minis = sp.filter((q) => q.kind === 'chief');
        const bosses = sp.filter((q) => q.kind === 'boss');
        assert.equal(minis.length, isChiefWave(s, w) ? 1 : 0, `${m.id}/${lv}/${w}`);
        assert.equal(bosses.length, isBossWave(s, w) ? 1 : 0);
        assert.equal(isBossWave(s, w), w === W);
        for (const q of minis) {
          assert.ok(isMinibossMon(q.species), `${m.id}/${lv}/${w}: ${q.species} no es minijefe`);
          const { match } = bigMonCandidates(MINIBOSS_POOL, theme);
          if (match.length >= 2) assert.ok(tdTypesOf(q.species).includes(theme), `${m.id}/${lv}: minijefe fuera del tema`);
          assert.notEqual(q.species, prevMini);
          prevMini = q.species;
        }
        for (const q of bosses) {
          assert.ok(isBossMon(q.species), `${m.id}/${lv}: ${q.species} no es legendario`);
          if (lv < m.levels) {
            const { match } = bigMonCandidates(BOSS_POOL, theme);
            if (match.length >= 3) assert.ok(tdTypesOf(q.species).includes(theme), `${m.id}/${lv}: jefe fuera del tema`);
            assert.notEqual(q.species, prevBoss, `${m.id}/${lv}: jefe repetido`);
            assert.notEqual(q.species, bossSpecies(m, m.levels, wavesInLevel(m.levels, m.levels)), 'el jefe final se guarda');
            assert.equal(q.species, levelBossFor(m, lv, bossSpecies(m, m.levels, wavesInLevel(m.levels, m.levels))));
          }
          prevBoss = q.species;
        }
      }
    }
    // Infinito: minijefe en la 5 y la 15, jefe en la 10 y la 20
    const inf = stage(m, 0);
    assert.ok(isChiefWave(inf, 5) && isBossWave(inf, 10) && isChiefWave(inf, 15) && isBossWave(inf, 20));
    assert.ok(isMinibossMon(waveSpawns(m, 0, 15).find((q) => q.kind === 'chief')!.species));
    assert.ok(isBossMon(waveSpawns(m, 0, 20).find((q) => q.kind === 'boss')!.species));
  }
  // Ficha del nivel
  const p = TD_MAPS[0];
  assert.match(levelFoesLine(p, 1), /Jefe: \w+ · Oscuros desde la oleada \d+$/);
  assert.match(levelFoesLine(p, p.levels), /Minijefes: .+ y .+ · Jefe final: Celebi/);
  assert.match(levelFoesLine(p, 0), /cada 10/);
});

test('equilibrio: con los tipos que sugiere el aviso, cada fase se gana (primer y último nivel)', () => {
  const teamFor = (theme: string, lv: number): TdMon[] => {
    const types = [theme, ...matchupWarning(theme, lv, []).suggest, 'electric', 'ice'].filter((t, i, a) => a.indexOf(t) === i).slice(0, 6);
    return types.map((t, i) => ({ id: 1000 + i, name: t, types: [t], stats: st(75), rarity: 'rare' }));
  };
  for (const m of TD_MAPS) {
    for (const lv of [1, m.levels]) {
      const g = autoplay(new TdGame({ map: m, level: lv, team: teamFor(levelTheme(m, lv), lv), seed: 7 }), { upgrades: true, abilities: true });
      assert.equal(g.phase, 'won', `${m.id} nv. ${lv} (${levelTheme(m, lv)})`);
    }
  }
});
