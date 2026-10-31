import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterLeave, afterRequest, parseAutoFs, REFRESH_DELAYS_MS, shouldRequestFullscreen, type AutoFsState } from '../src/data/autoFullscreen.ts';

const base: AutoFsState = { touch: true, supported: true, active: false, optedOut: false, armed: true };

test('pantalla completa: se pide en el primer toque de un móvil', () => {
  assert.equal(shouldRequestFullscreen(base), true);
});
test('pantalla completa: nunca en escritorio (sin táctil)', () => {
  assert.equal(shouldRequestFullscreen({ ...base, touch: false }), false);
});
test('pantalla completa: no se pide sin soporte (iPhone) ni si ya está activa', () => {
  assert.equal(shouldRequestFullscreen({ ...base, supported: false }), false);
  assert.equal(shouldRequestFullscreen({ ...base, active: true }), false);
});
test('pantalla completa: si el jugador la quitó a mano, no se fuerza', () => {
  assert.equal(shouldRequestFullscreen({ ...base, optedOut: true }), false);
});
test('pantalla completa: tras pedirla no se insiste en cada toque', () => {
  assert.equal(shouldRequestFullscreen({ ...base, armed: afterRequest() }), false);
});
test('pantalla completa: al salir se vuelve a pedir una vez, salvo que la rechazara', () => {
  assert.equal(shouldRequestFullscreen({ ...base, armed: afterLeave(false) }), true);
  assert.equal(shouldRequestFullscreen({ ...base, armed: afterLeave(true) }), false);
});
test('pantalla completa: la preferencia solo es negativa con "off"', () => {
  assert.equal(parseAutoFs(null), true);
  assert.equal(parseAutoFs('on'), true);
  assert.equal(parseAutoFs('off'), false);
});
test('reajuste: dos pasadas, una pronto y otra tarde', () => {
  assert.equal(REFRESH_DELAYS_MS.length, 2);
  assert.ok(REFRESH_DELAYS_MS[0] >= 100 && REFRESH_DELAYS_MS[0] <= 300);
  assert.ok(REFRESH_DELAYS_MS[1] >= 600);
});
