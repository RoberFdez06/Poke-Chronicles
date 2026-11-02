import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_W, MAX_W, MENU_SPREAD_MAX, centerOffset, menuSpread, hudSlices, logicalWidth, screenToHudX } from '../src/data/wideLayout.ts';

test('16:9 y ventanas estrechas se quedan en 1920', () => {
  assert.equal(logicalWidth(1600, 900, false), BASE_W);
  assert.equal(logicalWidth(1920, 1080, false), BASE_W);
  assert.equal(logicalWidth(800, 900, false), BASE_W);
  assert.equal(logicalWidth(1000, 400, true), BASE_W, 'en táctil nunca se ensancha');
  assert.equal(logicalWidth(0, 0, false), BASE_W);
  assert.equal(logicalWidth(1940, 1080, false), BASE_W, 'un sobrante mínimo no cuenta');
});

test('21:9 ensancha y respeta el tope de 2,4:1', () => {
  assert.equal(logicalWidth(2560, 1080, false), 2560);
  assert.equal(logicalWidth(3440, 1440, false), 2580);
  assert.equal(logicalWidth(5120, 1080, false), MAX_W);
  assert.equal(MAX_W, 2592);
  assert.equal(logicalWidth(2561, 1080, false) % 2, 0, 'siempre par para centrar sin medios píxeles');
});

test('el centro queda centrado', () => {
  assert.equal(centerOffset(1920), 0);
  assert.equal(centerOffset(2560), 320);
});

test('las tres cámaras del HUD: sin solapes y paneles pegados a los bordes', () => {
  for (const lw of [1920, 2200, 2560, 2592]) {
    const s = hudSlices(lw, 240, 240);
    assert.equal(s.left.dst.x, 0);
    assert.equal(s.right.dst.x + s.right.dst.w, lw);
    assert.ok(s.left.dst.x + s.left.dst.w <= s.center.dst.x);
    assert.ok(s.center.dst.x + s.center.dst.w <= s.right.dst.x);
    assert.equal(s.center.dst.x + s.center.dst.w / 2, lw / 2, 'la sala sigue en el centro');
    // los trozos del diseño cubren 0..1920 sin huecos
    assert.equal(s.left.src.w + s.center.src.w + s.right.src.w, BASE_W);
    assert.equal(s.center.src.x, s.left.src.x + s.left.src.w);
    assert.equal(s.right.src.x, s.center.src.x + s.center.src.w);
  }
  const s = hudSlices(1920, 240, 240);
  assert.deepEqual(s.center.dst, s.center.src, 'en 16:9 es el reparto de siempre');
});

test('pantalla → diseño según el trozo', () => {
  assert.equal(screenToHudX(100, 2560, 240, 240), 100);
  assert.equal(screenToHudX(2560 - 10, 2560, 240, 240), 1910);
  assert.equal(screenToHudX(1280, 2560, 240, 240), 960);
  assert.equal(screenToHudX(960, 1920, 240, 240), 960);
});

test('separación de columnas de menú: 0 en 16:9, con tope en 21:9', () => {
  const band = (lw: number) => (lw / (1080 / 640) - 960) / 2;
  assert.equal(menuSpread(band(1920)), 0);
  const wide = menuSpread(band(2560));
  assert.ok(wide > 0 && wide <= MENU_SPREAD_MAX);
  assert.equal(menuSpread(band(2592)), MENU_SPREAD_MAX);
  // las columnas de la Pausa (40..560 y 615..905) no salen de lo visible
  const b = band(2592);
  assert.ok(40 - MENU_SPREAD_MAX >= -b && 905 + MENU_SPREAD_MAX <= 960 + b);
});
