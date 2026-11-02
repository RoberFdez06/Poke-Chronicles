import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NAME_LENGTH, parseStringMap, sanitizeName, sanitizeStringMap } from '../src/data/safeData.ts';

test('sanitizeStringMap: solo acepta objetos', () => {
  for (const v of [null, undefined, 3, 'x', [], [1], true]) assert.equal(sanitizeStringMap(v), null);
  assert.deepEqual(sanitizeStringMap({}), {});
});

test('sanitizeStringMap: descarta valores no texto y claves peligrosas', () => {
  const evil = JSON.parse('{"__proto__":{"admin":true},"constructor":"x","pokeisaac.a":"1","n":5,"o":{}}');
  const r = sanitizeStringMap(evil)!;
  assert.deepEqual(Object.keys(r), ['pokeisaac.a']);
  assert.equal(({} as Record<string, unknown>).admin, undefined);
  assert.equal((r as Record<string, unknown>).admin, undefined);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
});

test('sanitizeStringMap: límites de claves y tamaño', () => {
  const lim = { maxKeys: 3, maxKeyLength: 5, maxValueLength: 4, maxTotalLength: 20 };
  assert.deepEqual(sanitizeStringMap({ largisima: 'a', b: 'muylargo', c: 'ok' }, lim), { c: 'ok' });
  assert.equal(sanitizeStringMap({ a: '1', b: '2', c: '3', d: '4' }, lim), null);
  assert.equal(sanitizeStringMap({ a: 'xxxx', b: 'xxxx', c: 'xxxx', dd: 'xxxx', e: 'xxxx' }, { ...lim, maxKeys: 99 }), null);
});

test('parseStringMap: JSON roto o con otra forma → null', () => {
  assert.equal(parseStringMap(null), null);
  assert.equal(parseStringMap(''), null);
  assert.equal(parseStringMap('{roto'), null);
  assert.equal(parseStringMap('[1,2]'), null);
  assert.deepEqual(parseStringMap('{"a":"1","b":2}'), { a: '1' });
});

test('sanitizeName: tipo, control y longitud', () => {
  assert.equal(sanitizeName(5), undefined);
  assert.equal(sanitizeName('   '), undefined);
  assert.equal(sanitizeName(' Ash\u0000‮ '), 'Ash');
  assert.equal(sanitizeName('x'.repeat(100))!.length, MAX_NAME_LENGTH);
  assert.equal(sanitizeName('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>'.slice(0, MAX_NAME_LENGTH));
});
