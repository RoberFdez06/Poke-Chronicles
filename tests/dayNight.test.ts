import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_NIGHT_MINUTES, FAVORED_DAMAGE_MUL, PHASE_MS, phaseAt, phaseAtSeconds, phaseChange, phasePowerMul, pickByPhase, msToNextPhase, spawnWeight,
} from '../src/data/dayNight.ts';

test('el ciclo es de entre 5 y 10 minutos y empieza de día', () => {
  assert.ok(DAY_NIGHT_MINUTES >= 5 && DAY_NIGHT_MINUTES <= 10);
  assert.equal(phaseAt(0), 'day');
});

test('la fase alterna cada PHASE_MS de tiempo jugado', () => {
  assert.equal(phaseAt(PHASE_MS - 1), 'day');
  assert.equal(phaseAt(PHASE_MS), 'night');
  assert.equal(phaseAt(2 * PHASE_MS - 1), 'night');
  assert.equal(phaseAt(2 * PHASE_MS), 'day');
  assert.equal(phaseAtSeconds(DAY_NIGHT_MINUTES * 60), 'night');
  assert.equal(phaseAt(-5), 'day');
  assert.equal(phaseAt(NaN), 'day');
  assert.equal(msToNextPhase(PHASE_MS - 1000), 1000);
});

test('phaseChange avisa solo al cruzar el límite', () => {
  assert.equal(phaseChange(0, PHASE_MS - 1), null);
  assert.equal(phaseChange(PHASE_MS - 1, PHASE_MS), 'night');
  assert.equal(phaseChange(PHASE_MS, 2 * PHASE_MS), 'day');
});

test('multiplicadores: favorecidos suben, el resto no cambia ni se oculta', () => {
  assert.equal(phasePowerMul('night', 'ghost'), FAVORED_DAMAGE_MUL);
  assert.equal(phasePowerMul('night', 'fire'), 1);
  assert.equal(phasePowerMul('day', 'grass'), FAVORED_DAMAGE_MUL);
  assert.equal(phasePowerMul('day', 'psychic'), 1);
  assert.equal(phasePowerMul('day', undefined), 1);
  assert.ok(spawnWeight('night', ['dark', 'flying']) > 1);
  assert.equal(spawnWeight('night', ['water']), 1);
});

test('pickByPhase favorece a los de la fase pero salen todos', () => {
  const foes = [{ t: ['ghost'] }, { t: ['water'] }, { t: ['fire'] }];
  const count = (phase: 'day' | 'night') => {
    const c = [0, 0, 0];
    for (let i = 0; i < 3000; i++) c[foes.indexOf(pickByPhase(foes, phase, (f) => f.t, () => (i + 0.5) / 3000)!)]++;
    return c;
  };
  const night = count('night');
  assert.ok(night[0] > night[1] && night[1] > 0 && night[2] > 0);
  const day = count('day');
  assert.ok(day[2] > day[0] && day[0] > 0);
  assert.equal(pickByPhase([], 'day', () => [], Math.random), undefined);
});

test('continuar partida mantiene la fase: depende del tiempo guardado en los contadores', () => {
  const seconds = DAY_NIGHT_MINUTES * 60 + 30;
  const antes = phaseAtSeconds(seconds);
  const raw = JSON.stringify({ version: 1, counters: { seconds } });
  assert.equal(JSON.parse(raw).counters.seconds, seconds);
  assert.equal(phaseAtSeconds(JSON.parse(raw).counters.seconds), antes);
  assert.equal(antes, 'night');
});
