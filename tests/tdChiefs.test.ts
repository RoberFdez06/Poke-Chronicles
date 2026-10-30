// Ejecutar con `npm test`. Defensa de torres: jefes de oleada, eventos, mejoras entre oleadas y habilidades de zona.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TD_MAPS, buildableCells, pathCells } from '../src/data/towerDefense/maps.ts';
import type { TdMon } from '../src/data/towerDefense/species.ts';
import { isChiefWave, isBossWave, waveSpawns, wavesInLevel } from '../src/data/towerDefense/waves.ts';
import { CHIEF_SKILL_INFO, CHIEF_SPECIES, STUN_TIME, chiefSkillsFor, chiefSpecies } from '../src/data/towerDefense/chiefs.ts';
import { WAVE_EVENTS, WAVE_EVENT_INFO, waveEventFor } from '../src/data/towerDefense/events.ts';
import { EPIC_ONLY, PERKS, addRelic, draftPerks, freshRelics, interestOf, perkDesc, perkName } from '../src/data/towerDefense/perks.ts';
import { ABILITIES, ABILITY_INFO, densestPoint, isZoneAbility } from '../src/data/towerDefense/abilities.ts';
import { chiefTicketsFor, rewardsFor } from '../src/data/towerDefense/progress.ts';
import { TdGame, type TdEnemy } from '../src/data/towerDefense/engine.ts';
import { tdTypesOf } from '../src/data/towerDefense/species.ts';

const st = (hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number) => ({ hp, attack, defense, spAttack, spDefense, speed });
const TEAM: TdMon[] = [
  { id: 5, name: 'Charmeleon', types: ['fire'], stats: st(58, 64, 58, 80, 65, 80), rarity: 'rare' },
  { id: 8, name: 'Wartortle', types: ['water'], stats: st(59, 63, 80, 65, 80, 58), rarity: 'rare' },
  { id: 25, name: 'Pikachu', types: ['electric'], stats: st(35, 55, 40, 50, 50, 90), rarity: 'common' },
];
const MAP = TD_MAPS[0];
type Spawner = { spawn: (s: object, d?: number) => TdEnemy };
const spawnIn = (g: TdGame, kind: string, species: number, dist = 1) => (g as unknown as Spawner).spawn.call(g, { at: 0, kind, species, path: 0 }, dist);

test('jefes de oleada: cada 5 oleadas, sin pisar al legendario, con especie y 2 habilidades fijas', () => {
  const lv = { tier: 0, level: 3, levels: MAP.levels };
  assert.ok(isChiefWave(lv, 5) && !isChiefWave(lv, 4) && !isChiefWave(lv, 6));
  const inf = { tier: 0, level: 0, levels: 10 };
  assert.ok(isChiefWave(inf, 5) && isChiefWave(inf, 15) && !isChiefWave(inf, 10) && isBossWave(inf, 10));
  const sp = waveSpawns(MAP, 3, 5);
  assert.equal(sp.filter((s) => s.kind === 'chief').length, 1);
  assert.equal(sp.find((s) => s.kind === 'chief')!.species, chiefSpecies(MAP.biome, 5));
  assert.ok(!waveSpawns(MAP, 3, 4).some((s) => s.kind === 'chief'));
  // El último nivel: jefe de oleada en la 10 y legendario en la última, nunca los dos juntos
  const last = wavesInLevel(MAP.levels, MAP.levels);
  assert.ok(!waveSpawns(MAP, MAP.levels, last).some((s) => s.kind === 'chief'));
  for (const b of Object.keys(CHIEF_SPECIES)) for (const id of CHIEF_SPECIES[b]) assert.notEqual(tdTypesOf(id)[0], 'normal', `tipos de ${id}`);
  assert.deepEqual(chiefSkillsFor('pradera', 2, 10), chiefSkillsFor('pradera', 2, 10));
  assert.equal(chiefSkillsFor('pradera', 2, 5)[0], 'aturdir', 'el primer jefe siempre aturde');
  for (let w = 5; w <= 60; w += 5) {
    const [a, b] = chiefSkillsFor(MAP.id, 0, w);
    assert.ok(['aturdir', 'invocar'].includes(a) && ['curar', 'acelerar', 'escudo'].includes(b));
  }
  for (const k of Object.values(CHIEF_SKILL_INFO)) assert.ok(k.name && (k.warn === 0 || k.warn >= 1));
});

test('el jefe avisa antes de aturdir las torres amontonadas y luego las aturde', () => {
  const g = new TdGame({ map: MAP, level: 1, team: TEAM });
  g.money = 10_000;
  const road = pathCells(MAP.paths[0]);
  const near = buildableCells(MAP).filter((c) => road.some((r) => Math.hypot(r.x - c.x, r.y - c.y) <= 1.5)).slice(0, 3);
  for (const c of near) assert.ok(g.place(0, c.x, c.y));
  g.callNextWave();
  g.drainEvents();
  const chief = spawnIn(g, 'chief', 3);
  chief.skills = ['aturdir', 'escudo'];
  // Colocado junto a las torres
  const r0 = road.findIndex((r) => Math.hypot(r.x - near[0].x, r.y - near[0].y) <= 1.5);
  chief.dist = r0;
  chief.def = { ...chief.def, speed: 0 };
  chief.skillCd = 0.01;
  g.step(0.1);
  const ev = g.drainEvents();
  const warn = ev.find((e) => e.t === 'chiefWarn');
  assert.ok(warn && warn.t === 'chiefWarn' && warn.skill === 'aturdir' && warn.time >= 1, 'aviso previo');
  assert.ok(g.towers.every((t) => t.stunned === 0), 'aún no aturde');
  g.step(CHIEF_SKILL_INFO.aturdir.warn + 0.1);
  const stunned = g.towers.filter((t) => t.stunned > 0);
  assert.ok(stunned.length >= 1);
  assert.ok(stunned[0].stunned <= STUN_TIME);
  const shots = stunned[0].shots;
  g.step(0.5);
  assert.equal(stunned[0].shots, shots, 'aturdida no dispara');
  // El Refuerzo quita el aturdimiento
  assert.ok(g.useAbility('refuerzo', { x: stunned[0].x + 0.5, y: stunned[0].y + 0.5 }));
  assert.ok(stunned[0].stunned === 0 && stunned[0].boost > 0);
});

test('la Recuperación del jefe se corta si le haces bastante daño durante el aviso; la Coraza da escudo por fases', () => {
  const g = new TdGame({ map: MAP, level: 1, team: TEAM });
  g.callNextWave();
  const c = spawnIn(g, 'chief', 3);
  c.skills = ['invocar', 'curar'];
  c.skillIdx = 1;
  c.def = { ...c.def, speed: 0 };
  c.hp = Math.round(c.def.maxHp * 0.8);
  c.skillCd = 0.01;
  g.step(0.05);
  const hp = c.hp;
  g.step(CHIEF_SKILL_INFO.curar.warn + 0.1);
  assert.ok(c.hp > hp, 'se cura sin daño');
  c.skillIdx = 1;
  c.skillCd = 0.01;
  g.step(0.05);
  c.hp -= Math.ceil(c.def.maxHp * 0.1);
  const cut = c.hp;
  g.drainEvents();
  g.step(CHIEF_SKILL_INFO.curar.warn + 0.1);
  assert.ok(c.hp <= cut, 'cortada');
  assert.ok(g.drainEvents().some((e) => e.t === 'chiefSkill' && e.skill === 'curar' && !e.ok));
  // Coraza
  const s = spawnIn(g, 'chief', 6);
  s.skills = ['invocar', 'escudo'];
  (g as unknown as { damage: (e: TdEnemy, n: number, t: null, o: object) => void }).damage.call(g, s, s.def.maxHp * 0.4, null, { type: 'fire', mul: 1, crit: false, special: false, splash: 0 });
  assert.ok(s.shield > 0, 'escudo al bajar del 66 %');
});

test('vencer a un jefe de oleada da dinero extra y tickets al acabar', () => {
  const g = new TdGame({ map: MAP, level: 1, team: TEAM });
  g.callNextWave();
  const c = spawnIn(g, 'chief', 3);
  const m = g.money;
  (g as unknown as { damage: (e: TdEnemy, n: number, t: null, o: object) => void }).damage.call(g, c, 1e9, null, { type: 'fire', mul: 1, crit: false, special: false, splash: 0 });
  assert.ok(g.money - m >= 60 && g.chiefsBeaten === 1 && g.outcome().chiefs === 1);
  assert.equal(chiefTicketsFor(2), 6);
  assert.equal(chiefTicketsFor(99), 15);
  const a = rewardsFor({ mapId: MAP.id, level: 2, waves: 6, won: true, stars: 3, chiefs: 1 }, { stars: [3, 0], endless: 0 });
  const b = rewardsFor({ mapId: MAP.id, level: 2, waves: 6, won: true, stars: 3 }, { stars: [3, 0], endless: 0 });
  assert.equal(a.tickets - b.tickets, 3);
  assert.equal(a.candies, b.candies, 'sin mezclar: solo tickets');
});

test('eventos: fijos por mapa, nivel y oleada; ninguno en la 1 ni con jefe; el desvío solo con varios caminos', () => {
  assert.equal(waveEventFor('x', 1, 1, 3, false), null);
  assert.equal(waveEventFor('x', 1, 7, 3, true), null);
  let seen = new Set<string>();
  let n = 0;
  for (let w = 2; w < 400; w++) {
    const e = waveEventFor('mapa', 2, w, 1, false);
    assert.equal(e, waveEventFor('mapa', 2, w, 1, false));
    if (e) {
      n++;
      seen.add(e);
    }
  }
  assert.ok(!seen.has('desvio'), 'un solo camino');
  assert.ok(n > 80 && n < 220, `frecuencia ${n}`);
  seen = new Set();
  for (let w = 2; w < 400; w++) {
    const e = waveEventFor('mapa', 2, w, 3, false);
    if (e) seen.add(e);
  }
  assert.equal(seen.size, WAVE_EVENTS.length);
  for (const e of WAVE_EVENTS) assert.ok(WAVE_EVENT_INFO[e].name && WAVE_EVENT_INFO[e].duration > 0);
});

/** Busca una oleada de un mapa/nivel con ese evento. */
function waveWith(map: typeof MAP, level: number, id: string): number {
  for (let w = 2; w < 200; w++) if (waveEventFor(map.id, level, w, map.paths.length, false) === id && w % 5) return w;
  throw new Error(`sin ${id}`);
}

test('niebla recorta el alcance, oleada doble duplica, el desvío lleva a todos por una entrada', () => {
  const g = new TdGame({ map: MAP, level: 0, team: TEAM });
  g.money = 10_000;
  const c = buildableCells(MAP)[10];
  const t = g.place(0, c.x, c.y)!;
  const r0 = g.statsOf(t).range;
  const fogW = waveWith(MAP, 0, 'niebla');
  g.wave = fogW - 1;
  g.callNextWave();
  assert.equal(g.waveEvent, 'niebla');
  assert.ok(g.statsOf(t).range < r0 * 0.75);
  assert.ok(g.drainEvents().some((e) => e.t === 'waveStart' && e.event === 'niebla'));
  const g2 = new TdGame({ map: MAP, level: 0, team: TEAM });
  const dw = waveWith(MAP, 0, 'doble');
  g2.wave = dw - 1;
  g2.callNextWave();
  assert.equal((g2 as unknown as { queue: unknown[] }).queue.length, waveSpawns(MAP, 0, dw).length * 2);
  const multi = TD_MAPS.find((m) => m.paths.length >= 2)!;
  const g3 = new TdGame({ map: multi, level: 0, team: TEAM });
  const det = waveWith(multi, 0, 'desvio');
  g3.wave = det - 1;
  g3.callNextWave();
  const q = (g3 as unknown as { queue: { path: number }[] }).queue;
  assert.equal(new Set(q.map((s) => s.path)).size, 1);
});

test('mejoras: 3 distintas, las épicas tras un jefe, y se aplican', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 50; i++) {
    const d = draftPerks(rng, { epic: false, types: ['fire'], towers: 0, canFuse: false });
    assert.equal(d.length, 3);
    assert.equal(new Set(d.map((p) => p.id)).size, 3);
    assert.ok(d.every((p) => !EPIC_ONLY.has(p.id) && p.id !== 'entreno'));
    const e = draftPerks(rng, { epic: true, types: ['fire'], towers: 4, canFuse: true });
    assert.ok(e.every((p) => p.epic) && e.some((p) => EPIC_ONLY.has(p.id)));
  }
  for (const id of PERKS) assert.ok(perkName({ id, epic: false }) && perkDesc({ id, epic: true }));
  let r = addRelic(freshRelics(), { id: 'alcance', epic: false });
  r = addRelic(r, { id: 'tipo', epic: true, type: 'fire' });
  r = addRelic(r, { id: 'interes', epic: false });
  assert.ok(r.range > 1 && r.typeDmg.fire === 1.5);
  assert.equal(interestOf(r, 100), 8);
  assert.equal(interestOf(r, 10_000), 50, 'con tope');
  // En el motor: tras una oleada se ofrecen; la vida sube la base; la fusión junta 2 torres
  const g = new TdGame({ map: MAP, level: 2, team: TEAM });
  g.money = 10_000;
  const cells = buildableCells(MAP);
  const a = g.place(0, cells[0].x, cells[0].y)!;
  g.place(0, cells[1].x, cells[1].y);
  const dmg = g.statsOf(a).damage;
  g.perkChoice = [{ id: 'tipo', epic: false, type: 'fire' }, { id: 'vida', epic: false }, { id: 'fusion', epic: true }];
  assert.ok(g.choosePerk(0));
  assert.ok(g.statsOf(a).damage > dmg);
  g.perkChoice = [{ id: 'vida', epic: false }];
  g.choosePerk(0);
  assert.equal(g.maxHp, 23);
  g.perkChoice = [{ id: 'fusion', epic: true }];
  g.choosePerk(0);
  assert.equal(g.towers.length, 1);
  assert.equal(g.towers[0].level, 4);
  // Al acabar una oleada hay elección y la cuenta atrás espera
  const h = new TdGame({ map: MAP, level: 1, team: TEAM });
  h.callNextWave();
  for (let i = 0; i < 4000 && h.phase === 'wave'; i++) h.step(0.25);
  assert.ok(h.perkChoice && h.perkChoice.length === 3);
  const left = h.prepLeft;
  h.step(5);
  assert.equal(h.prepLeft, left, 'en espera mientras eliges');
  h.callNextWave();
  assert.equal(h.perkChoice, null, 'sin elegir, se queda la primera');
  assert.equal(h.perks.length, 1);
});

test('habilidades de zona: la Bomba solo daña en su zona y la Tormenta respeta el radio', () => {
  assert.deepEqual([...ABILITIES], ['rayo', 'ventisca', 'bomba', 'refuerzo']);
  assert.ok(isZoneAbility('bomba') && !isZoneAbility('ventisca'));
  for (const a of ABILITIES) assert.ok(ABILITY_INFO[a].cooldown >= 40 && ABILITY_INFO[a].cooldown <= 90);
  const g = new TdGame({ map: MAP, level: 1, team: TEAM });
  g.callNextWave();
  const near = spawnIn(g, 'tank', 114, 2);
  const far = spawnIn(g, 'tank', 114, 14);
  g.step(0.01);
  assert.equal(g.abilityError('bomba', { x: -10, y: -10 }), 'No hay enemigos en la zona');
  assert.ok(g.useAbility('bomba', { x: near.x, y: near.y }));
  assert.ok(near.hp < near.def.maxHp || !g.enemies.includes(near));
  assert.equal(far.hp, far.def.maxHp);
  assert.match(g.abilityError('bomba', { x: far.x, y: far.y })!, /lista en/);
  assert.equal(g.abilityError('refuerzo'), 'No tienes torres');
  assert.deepEqual(densestPoint([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5.5, y: 5 }], 1), { x: 5, y: 5, n: 2 });
  // Reliquia de recarga
  g.relics = addRelic(g.relics, { id: 'recarga', epic: true });
  assert.ok(g.abilityCooldown('rayo') < ABILITY_INFO.rayo.cooldown);
});
