// Ejecutar con `npm test`. T66: megaevolución de jefes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEGA_AT,
  MEGA_DAMAGE_MUL,
  MEGA_EXTRA_HELPERS,
  MEGA_SPEED_MUL,
  MEGA_WARN_MS,
  megaHelpersToSummon,
  megaInvulnerable,
  megaKind,
  megaName,
  megaWarning,
  shouldMegaEvolve,
} from '../src/data/megaBoss.ts';
import { BOSS_PHASE2_AT, MAX_HELPERS, MEGA_BLAST_MIN_GAP, MEGA_BLAST_MIN_WARN, megaBlastAngles, megaBlastGap, megaBlastSpec } from '../src/data/bossPatterns.ts';

const jefe = { boss: true, miniboss: false, helper: false };

test('se activa al bajar de la mitad, coincidiendo con la fase 2', () => {
  assert.equal(MEGA_AT, BOSS_PHASE2_AT);
  assert.equal(shouldMegaEvolve({ done: false }, jefe, 0.8), false);
  assert.equal(shouldMegaEvolve({ done: false }, jefe, 0.5), false);
  assert.equal(shouldMegaEvolve({ done: false }, jefe, 0.49), true);
});

test('solo una vez por jefe', () => {
  const st = { done: false };
  assert.equal(shouldMegaEvolve(st, jefe, 0.4), true);
  st.done = true;
  assert.equal(shouldMegaEvolve(st, jefe, 0.3), false);
  assert.equal(shouldMegaEvolve(st, jefe, 0.1), false);
});

test('solo jefes: ni minijefes, ni ayudantes, ni enemigos normales', () => {
  assert.equal(shouldMegaEvolve({ done: false }, { ...jefe, miniboss: true }, 0.3), false);
  assert.equal(shouldMegaEvolve({ done: false }, { ...jefe, helper: true }, 0.3), false);
  assert.equal(shouldMegaEvolve({ done: false }, { ...jefe, boss: false }, 0.3), false);
  assert.equal(shouldMegaEvolve({ done: false }, jefe, 0), false, 'derrotado no cambia');
});

test('mega real o forma furia, con nombres en español', () => {
  assert.equal(megaKind(384), 'mega');
  assert.equal(megaKind(150), 'mega');
  assert.equal(megaKind(644), 'furia');
  assert.equal(megaName(384, 'Rayquaza'), 'Mega Rayquaza');
  assert.equal(megaName(644, 'Zekrom'), 'Zekrom (forma furia)');
  assert.match(megaWarning(384, 'Rayquaza'), /megaevolucionar/);
  assert.match(megaWarning(644, 'Zekrom'), /forma furia/);
});

test('aviso de 1,5 s e invulnerable solo mientras dura', () => {
  assert.equal(MEGA_WARN_MS, 1500);
  assert.equal(megaInvulnerable(undefined, 100), false);
  assert.equal(megaInvulnerable(1000, 1000), true);
  assert.equal(megaInvulnerable(1000, 2499), true);
  assert.equal(megaInvulnerable(1000, 2500), false);
});

test('multiplicadores: más daño y velocidad, pero moderados', () => {
  assert.ok(MEGA_DAMAGE_MUL > 1 && MEGA_DAMAGE_MUL <= 1.5);
  assert.ok(MEGA_SPEED_MUL > 1 && MEGA_SPEED_MUL <= 1.3);
});

test('más ayudantes, con su tope ampliado', () => {
  assert.equal(megaHelpersToSummon(4, MAX_HELPERS, 0, false), 4);
  assert.equal(megaHelpersToSummon(4, MAX_HELPERS, 0, true), 4 + MEGA_EXTRA_HELPERS);
  assert.equal(megaHelpersToSummon(4, MAX_HELPERS, MAX_HELPERS, false), 0);
  assert.equal(megaHelpersToSummon(4, MAX_HELPERS, MAX_HELPERS, true), MEGA_EXTRA_HELPERS);
  assert.equal(megaHelpersToSummon(4, MAX_HELPERS, 99, true), 0);
});

test('el estallido mega siempre se puede esquivar (aviso y hueco mínimos en cualquier piso)', () => {
  for (const floor of [1, 3, 6, 10, 30, 100]) {
    const s = megaBlastSpec(floor);
    assert.ok(s.warnMs >= MEGA_BLAST_MIN_WARN, `aviso piso ${floor}`);
    assert.ok(megaBlastGap(s) >= MEGA_BLAST_MIN_GAP, `hueco piso ${floor}`);
    assert.equal(megaBlastAngles(s, 0).length, s.beams);
  }
  assert.ok(megaBlastSpec(1).beams <= megaBlastSpec(10).beams);
});
