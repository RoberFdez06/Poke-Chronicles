import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROSSFADE_S, MUSIC_ENTER_MS, MUSIC_EXIT_MS, RESUME_WINDOW_MS, crossfadeGains, forceMood, initialMood, moodDelay, needsResume, resumeStep, stepMood,
  type MoodState, type MusicMood,
} from '../src/audio/musicState.ts';

/** Simula un tick cada `dt` ms con la secuencia de situaciones pedidas; devuelve los cambios (instante, situación). */
function run(seq: [MusicMood, number][], start: MoodState = initialMood(), dt = 100) {
  let s = start;
  let now = 0;
  const changes: [number, MusicMood][] = [];
  for (const [desired, ms] of seq) {
    for (let t = 0; t < ms; t += dt) {
      const r = stepMood(s, desired, now);
      s = r.state;
      if (r.changed) changes.push([now, s.mood]);
      now += dt;
    }
  }
  return { s, changes };
}

test('entrar en combate cambia casi enseguida (<= 0,6 s)', () => {
  assert.ok(MUSIC_ENTER_MS <= 600);
  const { changes } = run([['combat', 2000]]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0][1], 'combat');
  assert.ok(changes[0][0] >= MUSIC_ENTER_MS && changes[0][0] <= 600);
});

test('salir de combate espera ~2,5-3 s', () => {
  assert.ok(MUSIC_EXIT_MS >= 2500 && MUSIC_EXIT_MS <= 3000);
  const { changes } = run([['calm', 6000]], initialMood('combat'));
  assert.equal(changes.length, 1);
  assert.ok(changes[0][0] >= MUSIC_EXIT_MS && changes[0][0] <= MUSIC_EXIT_MS + 100);
});

test('sala limpia y otra con enemigos antes del margen: no cambia nunca', () => {
  const { changes, s } = run([['calm', 2000], ['combat', 3000]], initialMood('combat'));
  assert.equal(changes.length, 0);
  assert.equal(s.mood, 'combat');
  assert.equal(s.pending, null);
});

test('parpadeo de un instante (puerta) no dispara combate', () => {
  const { changes } = run([['calm', 3000], ['combat', 200], ['calm', 3000]]);
  assert.equal(changes.length, 0);
});

test('entrar en una sala sin enemigos mantiene la música normal', () => {
  const { changes } = run([['calm', 10000]]);
  assert.equal(changes.length, 0);
});

test('oleadas seguidas (hueco < 2,8 s) mantienen combate; hueco largo vuelve a calma', () => {
  assert.equal(run([['calm', 2000], ['combat', 1000], ['calm', 2000], ['combat', 1000]], initialMood('combat')).changes.length, 0);
  const r = run([['calm', 4000], ['combat', 1000]], initialMood('combat'));
  assert.deepEqual(r.changes.map((c) => c[1]), ['calm', 'combat']);
});

test('subir de intensidad es rápido y bajar de jefe es lento', () => {
  assert.equal(moodDelay('calm', 'boss'), MUSIC_ENTER_MS);
  assert.equal(moodDelay('combat', 'final'), MUSIC_ENTER_MS);
  assert.equal(moodDelay('boss', 'combat'), MUSIC_EXIT_MS);
  assert.equal(moodDelay('boss', 'calm'), MUSIC_EXIT_MS);
});

test('forceMood fija la situación sin candidata', () => {
  const s = forceMood('boss', 500);
  assert.deepEqual(s, { mood: 'boss', pending: null, since: 500 });
  assert.equal(stepMood(s, 'boss', 600).changed, false);
});

test('crossfade: potencia constante, extremos y límites', () => {
  assert.deepEqual(crossfadeGains(0), { inGain: 0, outGain: 1 });
  const end = crossfadeGains(CROSSFADE_S);
  assert.ok(Math.abs(end.inGain - 1) < 1e-9 && Math.abs(end.outGain) < 1e-9);
  for (let t = 0; t <= CROSSFADE_S; t += 0.1) {
    const g = crossfadeGains(t);
    assert.ok(Math.abs(g.inGain ** 2 + g.outGain ** 2 - 1) < 1e-9);
  }
  assert.deepEqual(crossfadeGains(99), crossfadeGains(CROSSFADE_S));
  assert.ok(CROSSFADE_S >= 1.2 && CROSSFADE_S <= 2);
});

test('reanudar la pista si vuelve pronto; reiniciar si pasó mucho', () => {
  assert.equal(resumeStep(40, 3000, 32), 8);
  assert.equal(resumeStep(40, RESUME_WINDOW_MS + 1, 32), 0);
  assert.equal(resumeStep(0, 1000, 32), 0);
  assert.equal(resumeStep(5, 1000, 0), 0);
});

test('el audio se reanuda si está parado o interrumpido (iOS)', () => {
  assert.equal(needsResume('suspended'), true);
  assert.equal(needsResume('interrupted'), true);
  assert.equal(needsResume('running'), false);
  assert.equal(needsResume('closed'), false);
});
