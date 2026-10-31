import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandLayout, fitCanvas, touchLayoutMode, MIN_BAND_CSS } from '../src/data/touchLayout.ts';

test('fitCanvas: 16:9 exacto no deja bandas', () => {
  const f = fitCanvas(1920, 1080, 1920, 1080);
  assert.equal(f.scale, 1);
  assert.equal(f.band, 0);
});
test('fitCanvas: pantalla 20:9 deja bandas iguales a los lados', () => {
  const f = fitCanvas(2400, 1080, 1920, 1080);
  assert.equal(f.band, 240);
  assert.equal(f.w, 1920);
});
test('fitCanvas: medidas no válidas dan cero', () => {
  assert.deepEqual(fitCanvas(0, 100, 1920, 1080), { scale: 0, w: 0, h: 0, band: 0 });
});
test('touchLayoutMode: bandas anchas -> bands', () => {
  // Móvil 20:9 en CSS: 915×412 -> lienzo 732×412, bandas de 91,5
  assert.equal(touchLayoutMode(915, 412, 1920, 1080, 80), 'bands');
  assert.equal(touchLayoutMode(915, 412, 1920, 1080, 100), 'canvas');
});
test('touchLayoutMode: 16:9 o más estrecho -> canvas', () => {
  assert.equal(touchLayoutMode(800, 450, 1920, 1080), 'canvas');
  assert.equal(touchLayoutMode(1024, 768, 1920, 1080), 'canvas');
});
test('touchLayoutMode: el mínimo por defecto se respeta en el límite', () => {
  const h = 540;
  const w = 960 + MIN_BAND_CSS * 2;
  assert.equal(touchLayoutMode(w, h, 1920, 1080), 'bands');
  assert.equal(touchLayoutMode(w - 2, h, 1920, 1080), 'canvas');
});
test('bandLayout: todo cabe dentro de la banda', () => {
  for (const ui of [1, 1.25, 1.5]) {
    for (const [band, h] of [[130, 412], [92, 412], [200, 800]]) {
    const l = bandLayout(band, h, ui);
    assert.ok(l.move.x - l.stickR >= 0 && l.move.x + l.stickR <= band);
    assert.ok(l.move.y + l.stickR <= h);
    for (const b of [...Object.values(l.left), ...Object.values(l.right)]) {
      assert.ok(b.x - b.size / 2 >= 0 && b.x + b.size / 2 <= band, `x ${ui}`);
      assert.ok(b.y - b.size / 2 >= 0, `y ${ui}`);
      assert.ok(b.y + b.size / 2 <= l.move.y - l.stickR, 'botones encima del joystick');
    }
  }
  }
});
test('bandLayout: más interfaz, botones más grandes (si hay sitio)', () => {
  assert.ok(bandLayout(300, 600, 1.5).left.active.size > bandLayout(300, 600, 1).left.active.size);
});
