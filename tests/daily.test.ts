// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_STARTERS,
  currentStreak,
  dailyFloorSeed,
  dailyRng,
  dailySeed,
  dailyStarter,
  dailyText,
  emptyDaily,
  parseDaily,
  playedToday,
  startDaily,
  withDailyResult,
} from '../src/data/daily.ts';
import { beginDaily, loadDaily, submitDaily, DAILY_KEY, type StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const DAY = 20380;

test('semilla e inicial del día: iguales para todos ese día y distintos otro día', () => {
  assert.equal(dailySeed(DAY), dailySeed(DAY));
  assert.notEqual(dailySeed(DAY), dailySeed(DAY + 1));
  assert.ok(dailySeed(DAY) >= 0 && dailySeed(DAY) <= 0x7fffffff);
  for (let d = DAY; d < DAY + 60; d++) {
    assert.ok(DAILY_STARTERS.includes(dailyStarter(d)));
    assert.notEqual(dailyStarter(d), dailyStarter(d - 1), `día ${d}`);
  }
  // Salen iniciales variados
  const seen = new Set(Array.from({ length: 60 }, (_, k) => dailyStarter(DAY + k)));
  assert.ok(seen.size >= 15, `${seen.size}`);
});

test('cada piso tiene su semilla y el azar del piso se repite', () => {
  assert.notEqual(dailyFloorSeed(DAY, 1), dailyFloorSeed(DAY, 2));
  assert.equal(dailyFloorSeed(DAY, 3), dailyFloorSeed(DAY, 3));
  const a = dailyRng(DAY, 2);
  const b = dailyRng(DAY, 2);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  assert.notEqual(dailyRng(DAY, 2, 1)(), dailyRng(DAY, 2, 0)());
});

test('solo cuenta la primera partida del día y la racha sigue con días seguidos', () => {
  let s = emptyDaily();
  const first = startDaily(s, DAY);
  assert.equal(first.counts, true);
  s = first.state;
  assert.equal(s.streak, 1);
  assert.ok(playedToday(s, DAY));
  // Repetir el mismo día no cuenta ni cambia nada
  assert.deepEqual(startDaily(s, DAY), { state: s, counts: false });
  s = withDailyResult(s, DAY, 3).state;
  assert.equal(s.todayBest, 3);
  assert.equal(s.best, 3);
  // Día siguiente: racha 2
  s = startDaily(s, DAY + 1).state;
  assert.equal(s.streak, 2);
  assert.equal(s.todayBest, 0);
  const r = withDailyResult(s, DAY + 1, 5);
  assert.equal(r.newBest, true);
  s = r.state;
  // Un resultado peor no baja nada; otro día no se puede apuntar
  assert.equal(withDailyResult(s, DAY + 1, 2).state.todayBest, 5);
  assert.equal(withDailyResult(s, DAY + 5, 2).state, s);
  // Saltarse un día rompe la racha (se ve a 0) y al volver empieza en 1, pero la mejor se guarda
  assert.equal(currentStreak(s, DAY + 2), 2);
  assert.equal(currentStreak(s, DAY + 3), 0);
  s = startDaily(s, DAY + 3).state;
  assert.equal(s.streak, 1);
  assert.equal(s.bestStreak, 2);
  // Un día anterior (reloj cambiado) no cuenta
  assert.equal(startDaily(s, DAY).counts, false);
});

test('el estado diario se guarda y aguanta datos corruptos', () => {
  const st = fakeStorage();
  assert.deepEqual(loadDaily(st), emptyDaily());
  assert.equal(beginDaily(DAY, st), true);
  assert.equal(beginDaily(DAY, st), false);
  assert.equal(submitDaily(DAY, 4, st), true);
  assert.equal(loadDaily(st).todayBest, 4);
  st.setItem(DAILY_KEY, '{malo');
  assert.deepEqual(loadDaily(st), emptyDaily());
  assert.deepEqual(parseDaily(JSON.stringify({ lastDay: DAY, streak: -2, best: 'x' })), { ...emptyDaily(), lastDay: DAY });
});

test('texto del panel', () => {
  const s = startDaily(emptyDaily(), DAY).state;
  assert.match(dailyText(emptyDaily(), DAY, 5), /aún sin jugar/);
  assert.match(dailyText(s, DAY, 5), /0\/5 pisos/);
  assert.match(dailyText(withDailyResult(s, DAY, 5).state, DAY, 5), /completado/);
  assert.match(dailyText(s, DAY, 5), /Racha: 1 día /);
});
