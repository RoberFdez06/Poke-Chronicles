import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DARK_ALPHA, quantizeDarkAlpha } from '../src/level/roomRules.ts';

test('el halo nunca supera el alpha de la capa oscura (sin recuadro)', () => {
  for (let a = 0; a <= 255; a++) assert.ok(quantizeDarkAlpha(a) <= DARK_ALPHA * 255 + 1e-9);
  assert.ok(Math.abs(quantizeDarkAlpha(255) - DARK_ALPHA * 255) < 1e-9);
});
test('0 es transparente y la cuantización es monótona', () => {
  assert.equal(quantizeDarkAlpha(0), 0);
  for (let a = 1; a <= 255; a++) assert.ok(quantizeDarkAlpha(a) >= quantizeDarkAlpha(a - 1));
});
import { darkHoleAlpha, darkEdge } from '../src/level/roomRules.ts';
test('el borde de la luz es suave: sin saltos grandes entre píxeles vecinos', () => {
  for (const edge of [darkEdge(false), darkEdge(true)]) {
    assert.ok(edge > 0);
    let prev = darkHoleAlpha(0, 190, edge);
    for (let d = 1; d <= 200; d++) {
      const a = darkHoleAlpha(d, 190, edge);
      assert.ok(a >= prev && a - prev < 0.1, `salto en ${d}`);
      prev = a;
    }
    assert.equal(darkHoleAlpha(190, 190, edge), DARK_ALPHA);
  }
});
