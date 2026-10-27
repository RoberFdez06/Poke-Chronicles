// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFloat, planFloat } from '../src/data/floatTexts.ts';

test('textos flotantes: las cifras se leen con su icono', () => {
  assert.deepEqual(classifyFloat('+12 PS'), { kind: 'number', sign: '+', amount: 12, icon: 'heart', note: '' });
  assert.deepEqual(classifyFloat('Baya Aranja +8 PS'), { kind: 'number', sign: '+', amount: 8, icon: 'heart', note: 'Baya Aranja' });
  assert.deepEqual(classifyFloat('−3 monedas'), { kind: 'number', sign: '-', amount: 3, icon: 'coin', note: '' });
  assert.deepEqual(classifyFloat('-4 PS (lava)'), { kind: 'number', sign: '-', amount: 4, icon: 'heart', note: '(lava)' });
  assert.equal((classifyFloat('+5', true) as { icon: string }).icon, 'coin');
  assert.deepEqual(classifyFloat('¡Escudo!'), { kind: 'label', text: '¡Escudo!', icon: 'shield' });
});

test('textos flotantes: reducidos = icono y cifra; mínimos = solo la vida', () => {
  assert.equal(planFloat(classifyFloat('Baya Aranja +8 PS'), 'reduced').text, '+8');
  assert.equal(planFloat(classifyFloat('+1 llave'), 'minimal').show, false);
  assert.equal(planFloat(classifyFloat('-2 PS'), 'minimal').show, true);
  assert.equal(planFloat(classifyFloat('Quemado'), 'minimal').show, false);
  assert.equal(planFloat(classifyFloat('¡Parry!'), 'reduced').text, 'Parry');
  assert.equal(planFloat(classifyFloat('¡Parry!'), 'full').text, '¡Parry!');
});
