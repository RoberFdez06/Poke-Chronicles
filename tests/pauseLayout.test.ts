import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowY, itemLinesFromHeight, pauseTailLayout, PAUSE_ITEMS_Y, PAUSE_ITEM_LINE_H } from '../src/data/pauseLayout.ts';

test('con 1 línea de objetos la disposición es la de siempre', () => {
  const l = pauseTailLayout(1, true, 4);
  assert.equal(l.reactionsY, 456);
  assert.equal(l.powersTitleY, 474);
  assert.equal(l.movesY, 500);
  assert.equal(l.panelH, 470);
  assert.equal(pauseTailLayout(1, false, 4).powersTitleY, 474);
});

test('con 1, 2 y 3 líneas de objetos nada se pisa', () => {
  for (const hasR of [true, false]) {
    let prev = 0;
    for (const lines of [1, 2, 3]) {
      const l = pauseTailLayout(lines, hasR, 4);
      const itemsEnd = PAUSE_ITEMS_Y + lines * PAUSE_ITEM_LINE_H;
      if (l.reactionsY !== null) {
        assert.ok(l.reactionsY >= itemsEnd, `reacciones sobre objetos (${lines})`);
        assert.ok(l.powersTitleY >= l.reactionsY + 15, 'poderes sobre reacciones');
      } else assert.ok(l.powersTitleY >= itemsEnd);
      assert.ok(l.movesY > l.powersTitleY + 18);
      assert.ok(l.bottom > prev, 'cada línea más baja el contenido');
      assert.ok(l.panelH >= l.bottom - 100, 'el panel contiene todo');
      prev = l.bottom;
    }
  }
});

test('las líneas se acotan a 1..3 y salen del alto real', () => {
  assert.equal(itemLinesFromHeight(0), 1);
  assert.equal(itemLinesFromHeight(17), 1);
  assert.equal(itemLinesFromHeight(34), 2);
  assert.equal(itemLinesFromHeight(200), 3);
  assert.equal(pauseTailLayout(9, true, 4).itemLines, 3);
  assert.equal(pauseTailLayout(0, true, 4).itemLines, 1);
});

test('sin medidas queda como en escritorio; con las de móvil nada se pisa', () => {
  const desk = pauseTailLayout(2, true, 4);
  assert.deepEqual(pauseTailLayout(2, true, 4, {}), desk);
  // Medidas más pequeñas que las de escritorio no cambian nada
  assert.deepEqual(pauseTailLayout(2, true, 4, { itemLineH: 10, reactionsH: 5, titleH: 5, moveRowH: 10 }), desk);
  // Letra de móvil: líneas más altas
  const m = { itemsY: 450, itemLineH: 22, reactionsH: 24, titleH: 30, moveRowH: 36 };
  const l = pauseTailLayout(2, true, 4, m);
  assert.ok(l.reactionsY! >= 450 + 2 * 22, 'reacciones bajo los objetos');
  assert.ok(l.powersTitleY >= l.reactionsY! + 24, 'título bajo las reacciones');
  assert.ok(l.movesY >= l.powersTitleY + 30, 'poderes bajo el título');
  assert.equal(l.moveRowH, 36);
  assert.equal(l.bottom, l.movesY + 2 * 36 + 8);
  assert.ok(l.bottom > desk.bottom);
});

test('flowY: su sitio de siempre o justo debajo de la línea de arriba', () => {
  assert.equal(flowY(200, 150), 200);
  assert.equal(flowY(200, 230), 228);
  assert.equal(flowY(200, 230, 0), 230);
});
