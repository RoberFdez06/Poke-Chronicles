// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, hpColor, hpTier, hex } from '../src/ui/theme.ts';

test('la barra de PS es verde, amarilla o roja según lo que queda', () => {
  assert.equal(hpTier(1), 'green');
  assert.equal(hpTier(0.51), 'green');
  assert.equal(hpTier(0.5), 'yellow');
  assert.equal(hpTier(0.21), 'yellow');
  assert.equal(hpTier(0.2), 'red');
  assert.equal(hpTier(0), 'red');
  assert.equal(hpColor(0.9), COLORS.hpGreen);
  assert.equal(hpColor(0.1), COLORS.hpRed);
});

test('colores en hexadecimal para los textos', () => {
  assert.equal(hex(0x2b3a67), '#2b3a67');
  assert.equal(hex(0xff), '#0000ff');
});
