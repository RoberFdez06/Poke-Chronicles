import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorDetails, isBenignError, shortMessage } from '../src/data/errorReport.ts';

test('mensaje corto: una línea y con tope', () => {
  assert.equal(shortMessage(new Error('falló\n  la carga')), 'falló la carga');
  assert.equal(shortMessage('texto'), 'texto');
  assert.equal(shortMessage({ a: 1 }), '{"a":1}');
  assert.equal(shortMessage(new Error('')), 'Error');
  const long = shortMessage('x'.repeat(500), 50);
  assert.equal(long.length, 50);
  assert.ok(long.endsWith('…'));
});

test('los avisos del navegador no sacan la pantalla de error', () => {
  assert.ok(isBenignError(new Error('ResizeObserver loop limit exceeded')));
  assert.ok(isBenignError(Object.assign(new Error('x'), { name: 'NotAllowedError' })));
  assert.ok(isBenignError('The play() request was interrupted by a call to pause()'));
  assert.equal(isBenignError(new TypeError("Cannot read properties of undefined (reading 'x')")), false);
});

test('detalles para copiar: contexto y pila', () => {
  const err = new TypeError('malo');
  const d = errorDetails(err, { scenes: ['Game', 'Pause'], url: 'http://x/', userAgent: 'UA', when: '2026-10-19T00:00:00Z' });
  assert.match(d, /Pantallas: Game, Pause/);
  assert.match(d, /Error: TypeError: malo/);
  assert.match(d, /Navegador: UA/);
  assert.ok(d.includes(err.stack!.split('\n')[0]));
  assert.match(errorDetails('cadena', { scenes: [], url: '', userAgent: '', when: '' }), /\(sin pila\)/);
});
