import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MOBILE_VIEW, loadMobileView, MOBILE_VIEW_KEY, parseMobileView, saveMobileView, stepPct, viewFactor } from '../src/data/mobileView.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test('vista móvil: por defecto 100 %', () => {
  assert.deepEqual(parseMobileView(null), DEFAULT_MOBILE_VIEW);
  assert.deepEqual(parseMobileView('{roto'), DEFAULT_MOBILE_VIEW);
});
test('vista móvil: valores no permitidos se ignoran', () => {
  assert.deepEqual(parseMobileView(JSON.stringify({ roomZoom: 175, uiSize: 125 })), { roomZoom: 100, uiSize: 125 });
});
test('vista móvil: pasos 100 -> 125 -> 150 -> 100 y al revés', () => {
  assert.equal(stepPct(100), 125);
  assert.equal(stepPct(125), 150);
  assert.equal(stepPct(150), 100);
  assert.equal(stepPct(100, -1), 150);
});
test('vista móvil: factor solo en móvil', () => {
  assert.equal(viewFactor(150, true), 1.5);
  assert.equal(viewFactor(150, false), 1);
});
test('vista móvil: guardar y cargar', () => {
  const s = mem();
  saveMobileView({ roomZoom: 150, uiSize: 125 }, s);
  assert.ok(s.m.has(MOBILE_VIEW_KEY));
  assert.deepEqual(loadMobileView(s), { roomZoom: 150, uiSize: 125 });
});
test('vista móvil: almacenamiento que falla no rompe', () => {
  const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.deepEqual(loadMobileView(bad), DEFAULT_MOBILE_VIEW);
  assert.doesNotThrow(() => saveMobileView({ roomZoom: 125, uiSize: 125 }, bad));
  assert.deepEqual(loadMobileView(undefined), DEFAULT_MOBILE_VIEW);
});
