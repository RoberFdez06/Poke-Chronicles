import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heavyPose, maxFitSize, maxFitSizePmd, PMD_UNIT, stomped } from '../src/data/maxLook.ts';

const isInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;

test('maxFitSize: píxeles enteros en pantalla y más grande que el normal', () => {
  for (const mul of [1.5, 1.65]) {
    const size = maxFitSize({ texSize: 96, baseSize: 84, sizeMul: mul, zoom: 1.5, contentH: 60, maxContentH: 130 });
    assert.ok(isInt((size / 96) * 1.5), `escala de pantalla entera (${size})`);
    assert.ok(size > 84);
  }
});

test('maxFitSize: recorta los dibujos muy altos, pero sigue creciendo un paso', () => {
  const tall = maxFitSize({ texSize: 96, baseSize: 84, sizeMul: 1.65, zoom: 1.5, contentH: 94, maxContentH: 120 });
  const short = maxFitSize({ texSize: 96, baseSize: 84, sizeMul: 1.65, zoom: 1.5, contentH: 40, maxContentH: 120 });
  assert.ok(tall <= short);
  assert.ok(tall > 84, 'nunca se queda igual');
});

test('maxFitSizePmd: escala de SpriteCollab entera en pantalla', () => {
  const size = maxFitSizePmd({ baseSize: 84, sizeMul: 1.65, zoom: 1.5, contentH: 30, maxContentH: 130 });
  assert.ok(isInt(size * PMD_UNIT * 1.5), `${size}`);
  assert.ok(size * PMD_UNIT * 30 <= 130 + 1e-9 || size * PMD_UNIT * 1.5 === Math.floor(84 * PMD_UNIT * 1.5) + 1);
});

test('heavyPose: pasos más altos y menos balanceo; stomped detecta el pisotón', () => {
  const p = { lift: 2, angle: 6, sx: 1, sy: 1, dx: 0, shadow: 1 };
  const h = heavyPose(p, 1.65, true);
  assert.ok(h.lift > p.lift * 1.5);
  assert.ok(Math.abs(h.angle) < Math.abs(p.angle));
  const f = heavyPose(p, 1.65, false);
  assert.ok(f.lift > p.lift && f.lift < h.lift);
  assert.equal(stomped(2, 0.2), true);
  assert.equal(stomped(0.2, 2), false);
});
