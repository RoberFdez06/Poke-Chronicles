// Ejecutar con `npm test`. Economía (06/11): premios por rendimiento, primera victoria del día, caramelos que caen,
// misiones con caramelos, Defensa de torres y cuántas partidas hacen falta para cada cosa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDY_DROP, candyDrop, claimFirstWinState, depthBonus, emptyFirstWin, firstWinPending, firstWinTickets, parseFirstWin,
  performanceBonus, runMilestones,
} from '../src/data/economy.ts';
import { economyReport, expectedRunRewards, expectedRunWithBonus, maxStatCost, simulateRuns } from '../src/data/balance.ts';
import { CANDY_PER_TICKET, claimFirstWin, FIRST_WIN_KEY, loadFirstWin, PROGRESS_KEYS, recordMission, loadCandies, loadTickets, type StorageLike } from '../src/data/save.ts';
import { MISSION_CANDY_PER_TICKET, missionCandies, rewardText, dailyMissions } from '../src/data/missions.ts';
import { waveTickets } from '../src/data/modes.ts';
import { rewardsFor, TD_CANDY_PER_TICKET } from '../src/data/towerDefense/progress.ts';
import { parseHistory } from '../src/data/runHistory.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const mem = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

test('premio por rendimiento: crece con el piso alcanzado y tiene tope', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(depthBonus), [0, 0, 4, 10, 18, 28]);
  assert.equal(depthBonus(6), 34);
  assert.equal(depthBonus(50), 60);
  // Hitos por modo: Oleadas cada 5 rondas, Rush cada 2 jefes, Torre cada 10 pisos
  assert.equal(runMilestones('waves', 14), 2);
  assert.equal(runMilestones('bossrush', 5), 2);
  assert.equal(runMilestones('tower', 37), 3);
  assert.equal(runMilestones('towerdef', 30), 0);
  assert.equal(performanceBonus('normal', 3), 10);
  assert.equal(performanceBonus('endless', -1), 0);
});

test('primera victoria del día: una vez al día, más con días seguidos (15 → 30) y la racha se corta', () => {
  assert.equal(firstWinTickets(1), 15);
  assert.equal(firstWinTickets(2), 18);
  assert.equal(firstWinTickets(99), 30);
  let s = emptyFirstWin();
  const a = claimFirstWinState(s, 100);
  assert.deepEqual([a.tickets, a.streak], [15, 1]);
  s = a.state;
  assert.equal(claimFirstWinState(s, 100).tickets, 0, 'el mismo día, nada');
  assert.ok(!firstWinPending(s, 100) && firstWinPending(s, 101));
  const b = claimFirstWinState(s, 101);
  assert.deepEqual([b.tickets, b.streak], [18, 2]);
  const c = claimFirstWinState(b.state, 105);
  assert.deepEqual([c.tickets, c.streak, c.state.best], [15, 1, 2]);
  assert.deepEqual(parseFirstWin('roto{'), emptyFirstWin());
  assert.deepEqual(parseFirstWin(JSON.stringify({ lastDay: 3, streak: 2 })), { lastDay: 3, streak: 2, best: 2 });
});

test('primera victoria guardada en su clave (y se borra con el progreso)', () => {
  const st = mem();
  assert.deepEqual(claimFirstWin(10, st), { tickets: 15, streak: 1 });
  assert.equal(claimFirstWin(10, st).tickets, 0);
  assert.equal(loadFirstWin(st).lastDay, 10);
  assert.equal(claimFirstWin(11, st).tickets, 18);
  assert.ok(PROGRESS_KEYS.includes(FIRST_WIN_KEY));
});

test('caramelos que caen: enemigos a veces, minijefe y jefe siempre, más con shiny y oscuro', () => {
  assert.equal(candyDrop(() => 0.99, 1), 0);
  assert.equal(candyDrop(() => 0, 1), CANDY_DROP.min);
  assert.equal(candyDrop(() => 0, 8), CANDY_DROP.min + 2);
  assert.equal(candyDrop(() => 0.99, 1, { mini: true }), 4);
  assert.equal(candyDrop(() => 0.99, 3, { boss: true }), 12);
  assert.equal(candyDrop(() => 0.99, 50, { boss: true }), 26, 'con tope en el piso 10');
  assert.equal(candyDrop(() => 0.99, 1, { shiny: true, dark: true }), CANDY_DROP.shiny + CANDY_DROP.dark);
  // De media, en un piso 1 de unos 17 enemigos caen 2-4 caramelos sueltos
  const rng = mulberry32(5);
  let n = 0;
  for (let i = 0; i < 17000; i++) n += candyDrop(rng, 1);
  assert.ok(n / 1000 >= 2 && n / 1000 <= 4, `${n / 1000}`);
});

test('misiones, logros y encargos dan caramelos al cambio de siempre; misiones diarias más altas', () => {
  assert.equal(MISSION_CANDY_PER_TICKET, CANDY_PER_TICKET);
  assert.equal(missionCandies({ tickets: 5 }), 15);
  assert.equal(rewardText({ tickets: 5 }), '+5 tickets');
  assert.equal(rewardText({ tickets: 5 }, { candies: true }), '+5 tickets · +15 caramelos');
  for (let d = 0; d < 30; d++) for (const m of dailyMissions(d)) assert.ok(m.reward.tickets >= 5, m.id);
  // Al cumplir una misión (el primer jefe, logro de 5 tickets) suben tickets y caramelos
  const st = mem();
  const done = recordMission({ kind: 'boss' }, 1, st);
  assert.ok(done.length > 0);
  const t = done.reduce((n, c) => n + c.reward.tickets, 0);
  assert.equal(loadTickets(st), t);
  assert.equal(loadCandies(st), t * CANDY_PER_TICKET);
});

test('Oleadas: 2 tickets por ronda y +1 cada 4 (30 hasta la ronda 10; antes 17)', () => {
  assert.equal(waveTickets(1), 2);
  assert.equal(waveTickets(4), 3);
  let sum = 0;
  for (let r = 1; r <= 10; r++) sum += waveTickets(r);
  assert.equal(sum, 30);
});

test('Defensa de torres: repetir un nivel da caramelos y la primera vez más; infinito con caramelos por oleada', () => {
  const none = { stars: Array(10).fill(0), endless: 0 };
  const first = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, none);
  // 2 (oleadas) + 2 (victoria) + 3 estrellas × 6 + 4 (primera vez)
  assert.equal(first.tickets, 26);
  assert.equal(first.candies, 4 * TD_CANDY_PER_TICKET + 3 * 4);
  const again = rewardsFor({ mapId: 'pradera', level: 1, waves: 6, won: true, stars: 3 }, { stars: [3, ...Array(9).fill(0)], endless: 0 });
  assert.equal(again.tickets, 4);
  assert.equal(again.candies, 12);
  const inf = rewardsFor({ mapId: 'pradera', level: 0, waves: 20, won: false, stars: 0 }, { stars: Array(10).fill(3), endless: 12 });
  assert.equal(inf.tickets, 10);
  assert.equal(inf.candies, 30 + 5);
});

test('caramelos en el historial: opcional (las partidas viejas siguen valiendo)', () => {
  const base = { endedAt: 1, starterId: 1, starterName: 'Bulbasaur', mode: 'normal', floor: 2, won: false, seconds: 60, kills: 3, damage: 9, items: [], tickets: 7, newRecord: false };
  assert.equal(parseHistory(JSON.stringify([base])).length, 1);
  assert.equal(parseHistory(JSON.stringify([{ ...base, candies: 30 }]))[0].candies, 30);
  assert.equal(parseHistory(JSON.stringify([{ ...base, candies: -1 }])).length, 0);
});

test('partidas necesarias (simulador): primer Pokémon y primera mejora en la primera partida, nada se acaba en un día', () => {
  const r = economyReport(600, 3, 0);
  // Una partida media (la simulación muere antes que un jugador real) da más de 55 tickets y 200 caramelos
  assert.ok(r.ticketsPerRun >= 55 && r.candiesPerRun >= 200, `${r.ticketsPerRun} / ${r.candiesPerRun}`);
  assert.ok(r.runsFirstPokemon < 1 && r.runsFirstUpgrade < 1);
  // La x10 (Épico asegurado) y una estadística al máximo en 1-2 partidas (antes ~2 y ~1,5)
  assert.ok(r.runsPull10 >= 1 && r.runsPull10 <= 2, `x10: ${r.runsPull10}`);
  assert.ok(r.runsMaxStat >= 0.8 && r.runsMaxStat <= 1.5, `estadística: ${r.runsMaxStat}`);
  assert.equal(maxStatCost(), 225);
  // Lo largo sigue siendo largo: el árbol entero de un Pokémon y un legendario, más de 12 partidas cada uno
  assert.ok(r.runsFullTree >= 12 && r.runsLegendary >= 12, `${r.runsFullTree} / ${r.runsLegendary}`);
  // Con la primera victoria del día, la primera partida ya da para una tirada
  assert.equal(economyReport(600, 3, 15).runsFirstPokemon, 0);
});

test('la partida completa con el premio por rendimiento: 28 tickets más y caramelos al cambio', () => {
  const a = expectedRunRewards(5);
  const b = expectedRunWithBonus(5);
  assert.equal(Math.round(b.tickets - a.tickets), 28);
  assert.equal(Math.round(b.candies - a.candies), 28 * CANDY_PER_TICKET);
  assert.ok(a.candies > a.tickets * CANDY_PER_TICKET, 'los caramelos que caen suman');
  assert.ok(simulateRuns(200, 4).candies > simulateRuns(200, 4).tickets * CANDY_PER_TICKET);
});
