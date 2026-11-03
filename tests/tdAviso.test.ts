// Defensa de torres: aviso previo de emparejamiento (matchupWarning.ts). Lógica pura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_MAPS } from '../src/data/towerDefense/maps.ts';
import { ALL_TYPES, counterTypes, levelTheme } from '../src/data/towerDefense/themes.ts';
import { levelHint, matchupForLevel, matchupWarning, VERDICT_LABEL } from '../src/data/towerDefense/matchupWarning.ts';
import { TdGame } from '../src/data/towerDefense/engine.ts';
import { autoplay } from '../src/data/towerDefense/autoplay.ts';
import type { TdMon } from '../src/data/towerDefense/species.ts';

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number) => ({ hp, attack, defense, spAttack, spDefense, speed });
const mon = (id: number, name: string, types: string[]): TdMon => ({ id, name, types, stats: st(60, 70, 60, 70, 60, 70), rarity: 'rare' });
const FIRE = { id: 5, name: 'Charmeleon', types: ['fire'], stats: st(58, 64, 58, 80, 65, 80), rarity: 'rare' } as TdMon;
const ELEC = { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' } as TdMon;
const NORM = { id: 52, name: 'Meowth', types: ['normal'], stats: st(40, 45, 35, 40, 40, 90), rarity: 'common' } as TdMon;
const BAD = [FIRE, ELEC, NORM];
const GOOD = [FIRE, mon(8, 'Wartortle', ['water']), mon(2, 'Ivysaur', ['grass', 'poison']), mon(93, 'Haunter', ['ghost', 'poison']), mon(74, 'Geodude', ['rock']), mon(7, 'Squirtle', ['water'])];
const types = (t: TdMon[]) => t.map((m) => m.types);
const volcan = TD_MAPS.find((m) => m.id === 'volcan')!;

test('Cráter Ígneo (Roca) nv. 7 y 13: Fuego/Eléctrico/Normal = Arriesgado, con motivo y sugerencia', () => {
  for (const lv of [7, 13]) {
    assert.equal(levelTheme(volcan, lv), 'rock');
    const w = matchupForLevel(volcan, lv, types(BAD));
    assert.equal(w.verdict, 'arriesgado');
    assert.equal(w.reason, 'Tu equipo hace poco daño a Roca: Fuego, Eléctrico y Normal.');
    assert.match(w.tip, /^Lleva Agua, .+ o .+\.$/);
    assert.ok(w.suggest.length <= 4 && w.suggest.every((t) => counterTypes('rock').includes(t) || t === 'rock'));
    assert.equal(VERDICT_LABEL[w.verdict], 'Arriesgado');
  }
});

test('con Agua o Roca en el equipo el veredicto es Bien', () => {
  for (const lv of [7, 13]) {
    assert.equal(matchupForLevel(volcan, lv, types(GOOD)).verdict, 'bien');
    assert.equal(matchupForLevel(volcan, lv, [...types(BAD), ['water']]).verdict !== 'arriesgado', true);
    assert.equal(matchupForLevel(volcan, lv, [...types(BAD), ['rock'], ['water']]).verdict, 'bien');
  }
});

test('concuerda con la simulación: el equipo avisado pierde y el que sale Bien gana', () => {
  for (const lv of [7, 13]) {
    const bad = autoplay(new TdGame({ map: volcan, level: lv, team: BAD, seed: 7 }), { upgrades: true, abilities: true });
    const good = autoplay(new TdGame({ map: volcan, level: lv, team: GOOD, seed: 7 }), { upgrades: true, abilities: true });
    assert.equal(bad.phase, 'lost', `nv. ${lv} con el equipo desfavorable`);
    assert.equal(good.phase, 'won', `nv. ${lv} con el equipo adecuado`);
  }
});

test('sin torres: Justo sin quejas de tipos; siempre hay texto y los tipos sugeridos no se repiten con el equipo', () => {
  const w = matchupWarning('ghost', 5, []);
  assert.equal(w.verdict, 'justo');
  assert.ok(w.reason.includes('Fantasma') && w.tip.startsWith('Lleva '));
  for (const t of ALL_TYPES) {
    const r = matchupWarning(t, 8, [['normal'], ['normal']]);
    assert.ok(r.reason.length > 0);
    assert.ok(!r.suggest.includes('normal'));
    assert.ok(Number.isFinite(r.score));
  }
});

test('los niveles bajos perdonan más y un equipo con los tipos sugeridos nunca sale Arriesgado', () => {
  const lo = matchupWarning('rock', 1, types(BAD)).score;
  assert.ok(lo > 0);
  assert.ok(matchupWarning('rock', 10, types(BAD)).score < matchupWarning('rock', 10, types(GOOD)).score);
  for (const t of ALL_TYPES) {
    const sug = matchupWarning(t, 10, []).suggest;
    assert.ok(sug.length > 0, t);
    assert.notEqual(matchupWarning(t, 10, sug.slice(0, 3).map((x) => [x])).verdict, 'arriesgado', t);
  }
});

test('pista del nivel: tipos recomendados y tipo del nivel', () => {
  assert.match(levelHint('rock'), /^Lleva Agua, .+ o .+ para el nivel Roca$/);
});
