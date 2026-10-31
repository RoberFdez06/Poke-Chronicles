import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOUCH_ICONS, greyOf, shade } from '../src/ui/art/touchIcons.ts';

for (const [name, icon] of Object.entries(TOUCH_ICONS)) {
  test(`icono táctil «${name}»: rejilla rectangular, cabe en el botón y sin colores sin definir`, () => {
    const w = icon.rows[0].length;
    assert.ok(w <= 16 && icon.rows.length <= 16);
    for (const r of icon.rows) {
      assert.equal(r.length, w, `fila «${r}»`);
      for (const ch of r) if (ch !== '.') assert.ok(ch in icon.palette, `color «${ch}»`);
    }
  });
}

test('gris y tonos', () => {
  const g = greyOf(0xff0000);
  assert.equal((g >> 16) & 255, g & 255);
  assert.equal(shade(0x808080, 0), 0x808080);
  assert.equal(shade(0x000000, 1), 0xffffff);
  assert.equal(shade(0xffffff, -1), 0x000000);
});
