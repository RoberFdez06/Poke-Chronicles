import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedToViewport, fixedViewRect } from '../src/ui/camView.ts';

const cam = { width: 1440, height: 960, zoom: 1.5 };

test('con zoom 1,5 el rectángulo fijo cubre exactamente el visor (sin franjas)', () => {
  const r = fixedViewRect(cam);
  assert.deepEqual(fixedToViewport(cam, r.x, r.y), { x: 0, y: 0 });
  assert.deepEqual(fixedToViewport(cam, r.x + r.w, r.y + r.h), { x: 1440, y: 960 });
});
test('el margen sobra por todos los lados (temblor de cámara)', () => {
  const r = fixedViewRect(cam, 30);
  const a = fixedToViewport(cam, r.x, r.y);
  const b = fixedToViewport(cam, r.x + r.w, r.y + r.h);
  assert.ok(a.x <= -29.9 && a.y <= -29.9 && b.x >= 1469.9 && b.y >= 989.9);
});
test('pintar de 0 a scale.width con zoom NO coincide con el visor (el fallo de antes)', () => {
  const p = fixedToViewport(cam, 0, 0);
  assert.notDeepEqual(p, { x: 0, y: 0 });
});
test('zoom de la intro del jefe y sin zoom', () => {
  for (const zoom of [1, 1.5 * 1.18]) {
    const c = { ...cam, zoom };
    const r = fixedViewRect(c);
    const b = fixedToViewport(c, r.x + r.w, r.y + r.h);
    assert.ok(Math.abs(b.x - 1440) < 1e-6 && Math.abs(b.y - 960) < 1e-6);
  }
});
