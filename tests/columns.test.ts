import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontForStep, rowStep, shrinkTo, splitColumns } from '../src/data/columns.ts';

test('si caben, la etiqueta lleva justo su ancho y la descripción el resto', () => {
  const s = splitColumns(200, 300, 760, 20);
  assert.equal(s.labelW, 200);
  assert.equal(s.descX, 220);
  assert.equal(s.descW, 540);
});

test('si no caben, nunca se pisan: etiqueta + hueco + descripción = total', () => {
  for (const [l, d] of [[500, 700], [900, 100], [50, 2000], [0, 0], [400, 400]]) {
    const s = splitColumns(l, d, 760, 16);
    assert.ok(s.labelW + 16 <= s.descX, `${l}/${d}`);
    assert.ok(s.descX + s.descW <= 760, `${l}/${d}`);
    assert.ok(s.labelW >= 0 && s.descW >= 0);
  }
});

test('la etiqueta queda entre el mínimo y el máximo del total cuando hay que repartir', () => {
  const big = splitColumns(900, 100, 516, 16);
  assert.equal(big.labelW, 250); // tope del 50 %
  const small = splitColumns(300, 2000, 516, 16);
  assert.equal(small.labelW, 140); // mínimo del 28 %
  const tiny = splitColumns(60, 2000, 516, 16);
  assert.equal(tiny.labelW, 140);
});

test('paso de fila y letra', () => {
  assert.equal(rowStep(16, 170, 540, 27), 23);
  assert.equal(rowStep(4, 170, 540, 27), 27);
  assert.equal(rowStep(100, 0, 100, 27), 12);
  assert.equal(fontForStep(23, 19), 18);
  assert.equal(fontForStep(40, 19), 19);
  assert.equal(fontForStep(5, 19), 10);
  assert.equal(shrinkTo(100, 50), 0.5);
  assert.equal(shrinkTo(40, 50), 1);
});

test('al cambiar «Tamaño de la interfaz», la letra del HUD se recalcula desde su base', async () => {
  const { hudRescaledPx, MOBILE_VIEW_CHANGED } = await import('../src/data/mobileView.ts');
  assert.equal(MOBILE_VIEW_CHANGED, 'mobile-view-changed');
  const base = 18 / 1.25; // creada al 125 %
  assert.equal(hudRescaledPx(base, 1.5), 22);
  assert.equal(hudRescaledPx(base, 1), 14);
  assert.equal(hudRescaledPx(base, 1.25), 18); // ida y vuelta sin deriva
  assert.equal(hudRescaledPx(0.2, 1), 1);
});
