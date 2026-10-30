import { test } from 'node:test';
import assert from 'node:assert/strict';
import { U } from '../src/ui/layout.ts';
import { boostedSize, cssPerGamePx, MAX_TEXT_BOOST, MIN_TEXT_CSS, parseFontPx, rowHitHeight, textBoost } from '../src/ui/uiScale.ts';

test('cssPerGamePx: escritorio 1920×1080 = 1; móvil apaisado ~0,36 y no cambia al girar', () => {
  assert.equal(cssPerGamePx(1920, 1080), 1);
  const land = cssPerGamePx(844, 390);
  assert.ok(Math.abs(land - 390 / 1080) < 1e-9);
  assert.equal(cssPerGamePx(390, 844), land);
  assert.equal(cssPerGamePx(0, 0), 1);
});

test('textBoost: en escritorio no agranda nada', () => {
  for (const s of [10, 12, 14, 24]) assert.equal(textBoost(s, 1), 1);
  assert.equal(boostedSize(14, 1), 14);
});

test('textBoost: en móvil sube los textos pequeños hasta el mínimo o el tope', () => {
  const k = cssPerGamePx(844, 390);
  const f14 = textBoost(14, k);
  assert.ok(f14 > 1 && f14 <= MAX_TEXT_BOOST);
  assert.ok(14 * f14 * U * k >= MIN_TEXT_CSS - 1e-9);
  assert.equal(textBoost(8, k), MAX_TEXT_BOOST);
  assert.equal(textBoost(48, k), 1); // los títulos grandes no cambian
  assert.equal(boostedSize(14, k), Math.round(14 * f14));
});

test('parseFontPx entiende px y números, y descarta lo demás', () => {
  assert.equal(parseFontPx('14px'), 14);
  assert.equal(parseFontPx(' 13.5px '), 13.5);
  assert.equal(parseFontPx(20), 20);
  assert.equal(parseFontPx('1.2em'), null);
  assert.equal(parseFontPx(undefined), null);
});

test('rowHitHeight: en móvil la fila de menú (54 + hueco 14) llega a ~41 px CSS en un móvil de 390 de alto', () => {
  assert.equal(rowHitHeight(54, 14, false), 54);
  assert.equal(rowHitHeight(54, 14, true), 68);
  const css = 68 * U * cssPerGamePx(844, 390);
  assert.ok(css > 40);
});
