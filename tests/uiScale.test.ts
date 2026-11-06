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

test('HUD: en escritorio no cambia nada', async () => {
  const { hudFontSize } = await import('../src/ui/uiScale.ts');
  for (const s of [11, 15, 20, 46]) assert.equal(hudFontSize(s, 0.347, false), s);
});

test('HUD: en móvil (escala 0,347) las letras llegan a ~9,5 px CSS, con tope ×2 y máximo opcional', async () => {
  const { hudFontSize, HUD_MIN_CSS } = await import('../src/ui/uiScale.ts');
  const k = 667 / 1920;
  assert.ok(hudFontSize(18, k, true) * k >= HUD_MIN_CSS - 0.3);
  assert.equal(hudFontSize(11, k, true), 22); // tope ×2
  assert.equal(hudFontSize(16, k, true, 22), 22);
  assert.equal(hudFontSize(46, k, true), 46); // ya grande: igual
  // Nunca más pequeño que el original
  assert.equal(hudFontSize(30, k, true, 10), 30);
});

test('HUD: «Tamaño de la interfaz» agranda en móvil (también el tope) y no en escritorio', async () => {
  const { hudFontSize } = await import('../src/ui/uiScale.ts');
  const base = hudFontSize(20, 0.347, true);
  assert.ok(hudFontSize(20, 0.347, true, Infinity, 1.5) > base);
  assert.equal(hudFontSize(20, 0.347, false, Infinity, 1.5), 20);
  assert.equal(hudFontSize(14, 0.347, true, 22, 1.5), 33);
});

test('touchPad: margen para llegar a 56 px CSS, 0 si ya llega y con tope', async () => {
  const { touchPad, TOUCH_TARGET_CSS } = await import('../src/ui/uiScale.ts');
  assert.equal(TOUCH_TARGET_CSS, 56);
  // iPhone SE apaisado (667×375): 0,347 px CSS por px de lienzo × 1,6875 de los menús
  const k = (375 / 1080) * 1.6875;
  const pad = touchPad(46, k);
  assert.ok(Math.abs((46 + pad * 2) * k - 56) < 1e-9);
  assert.equal(touchPad(200, k), 0);
  assert.equal(touchPad(10, k, 56, 12), 12);
  assert.equal(touchPad(10, 0), 0);
});
