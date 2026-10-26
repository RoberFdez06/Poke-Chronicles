import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADRENALINE_ACTIVE_MS, ADRENALINE_DAMAGE_MUL, ADRENALINE_GAIN, ADRENALINE_IDLE_MS, ADRENALINE_MAX, ADRENALINE_SPEED_MUL,
  adrenalineActive, adrenalineDamageMul, adrenalineFill, adrenalineSpeedMul, gainAdrenaline, newAdrenaline, tickAdrenaline,
} from '../src/data/adrenaline.ts';

/** Avanza `ms` en fotogramas de 16 ms, como el juego. */
function advance(s: ReturnType<typeof newAdrenaline>, ms: number) {
  for (let t = 0; t < ms; t += 16) tickAdrenaline(s, 16);
}

test('sube con bajas, esquivas y parrys (el parry vale más)', () => {
  const s = newAdrenaline();
  gainAdrenaline(s, 'kill');
  gainAdrenaline(s, 'dodge');
  gainAdrenaline(s, 'parry');
  assert.equal(s.value, ADRENALINE_GAIN.kill + ADRENALINE_GAIN.dodge + ADRENALINE_GAIN.parry);
  assert.ok(ADRENALINE_GAIN.parry > ADRENALINE_GAIN.kill);
});

test('baja sola si dejas de pelear, pero no enseguida', () => {
  const s = newAdrenaline();
  gainAdrenaline(s, 'parry');
  advance(s, ADRENALINE_IDLE_MS - 100);
  assert.equal(s.value, ADRENALINE_GAIN.parry);
  advance(s, 1000);
  assert.ok(s.value < ADRENALINE_GAIN.parry);
  advance(s, 60_000);
  assert.equal(s.value, 0);
});

test('al llenarse se activa unos segundos con velocidad y daño extra, y luego se vacía', () => {
  const s = newAdrenaline();
  let activated = false;
  for (let i = 0; i < 20 && !activated; i++) activated = gainAdrenaline(s, 'kill');
  assert.ok(activated);
  assert.ok(adrenalineActive(s));
  assert.equal(adrenalineSpeedMul(s), ADRENALINE_SPEED_MUL);
  assert.equal(adrenalineDamageMul(s), ADRENALINE_DAMAGE_MUL);
  assert.equal(adrenalineFill(s), 1);
  // Mientras dura no se carga más
  assert.ok(!gainAdrenaline(s, 'parry'));
  advance(s, ADRENALINE_ACTIVE_MS / 2);
  assert.ok(adrenalineFill(s) < 0.6 && adrenalineFill(s) > 0.4);
  advance(s, ADRENALINE_ACTIVE_MS);
  assert.ok(!adrenalineActive(s));
  assert.equal(s.value, 0);
  assert.equal(adrenalineDamageMul(s), 1);
  assert.equal(s.activations, 1);
});

test('una pausa no la vacía ni gasta el subidón: el paso largo se recorta', () => {
  const s = newAdrenaline();
  gainAdrenaline(s, 'parry');
  tickAdrenaline(s, 5 * 60_000); // cinco minutos en el menú de pausa
  assert.equal(s.value, ADRENALINE_GAIN.parry);
  const a = newAdrenaline();
  while (!gainAdrenaline(a, 'parry'));
  tickAdrenaline(a, 5 * 60_000);
  assert.ok(adrenalineActive(a));
  assert.ok(a.activeLeft >= ADRENALINE_ACTIVE_MS - 100);
});

test('nunca pasa del máximo', () => {
  const s = newAdrenaline();
  for (let i = 0; i < 50; i++) gainAdrenaline(s, 'parry');
  assert.ok(s.value <= ADRENALINE_MAX);
});

test('con la sala despejada (hold) la barra no baja; hacer daño reinicia la espera', async () => {
  const m = await import('../src/data/adrenaline.ts');
  const s = m.newAdrenaline();
  m.gainAdrenaline(s, 'parry');
  for (let i = 0; i < 600; i++) m.tickAdrenaline(s, 100, true);
  assert.equal(s.value, m.ADRENALINE_GAIN.parry);
  for (let i = 0; i < m.ADRENALINE_IDLE_MS / 100 - 5; i++) m.tickAdrenaline(s, 100);
  m.touchAdrenaline(s);
  for (let i = 0; i < m.ADRENALINE_IDLE_MS / 100 - 5; i++) m.tickAdrenaline(s, 100);
  assert.equal(s.value, m.ADRENALINE_GAIN.parry);
});
