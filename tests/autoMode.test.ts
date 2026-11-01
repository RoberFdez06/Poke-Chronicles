import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_MODE_KEY, DEFAULT_AUTO_MODE, autoCasts, autoFires, autoMoves, effectiveAutoMode, loadAutoMode, manualOverride,
  parseAutoMode, pickAutoCast, quickToggle, saveAutoMode, stepAutoMode, withMode,
} from '../src/data/autoMode.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test('por defecto, Completo', () => {
  assert.deepEqual(parseAutoMode(null), DEFAULT_AUTO_MODE);
  assert.equal(parseAutoMode('{roto').mode, 'full');
  assert.equal(parseAutoMode('{"mode":"raro"}').mode, 'full');
});

test('guarda y carga', () => {
  const s = mem();
  saveAutoMode({ mode: 'shoot', last: 'shoot' }, s);
  assert.ok(s.m.has(AUTO_MODE_KEY));
  assert.deepEqual(loadAutoMode(s), { mode: 'shoot', last: 'shoot' });
});

test('sin almacenamiento o si lanza, no rompe', () => {
  const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.deepEqual(loadAutoMode(bad), DEFAULT_AUTO_MODE);
  assert.doesNotThrow(() => saveAutoMode(DEFAULT_AUTO_MODE, bad));
  assert.deepEqual(loadAutoMode(undefined), DEFAULT_AUTO_MODE);
});

test('pasos y botón rápido recuerdan el último encendido', () => {
  assert.equal(stepAutoMode('off'), 'shoot');
  assert.equal(stepAutoMode('full'), 'off');
  assert.equal(stepAutoMode('off', -1), 'full');
  const a = withMode(DEFAULT_AUTO_MODE, 'shoot');
  const off = quickToggle(a);
  assert.deepEqual(off, { mode: 'off', last: 'shoot' });
  assert.deepEqual(quickToggle(off), { mode: 'shoot', last: 'shoot' });
});

test('fuera de móvil siempre apagado; qué hace cada modo', () => {
  assert.equal(effectiveAutoMode('full', false), 'off');
  assert.equal(effectiveAutoMode('full', true), 'full');
  assert.deepEqual([autoFires('shoot'), autoCasts('shoot'), autoMoves('shoot')], [true, false, false]);
  assert.deepEqual([autoFires('full'), autoCasts('full'), autoMoves('full')], [true, true, true]);
  assert.deepEqual([autoFires('off'), autoCasts('off'), autoMoves('off')], [false, false, false]);
});

test('el joystick manda en cuanto se empuja', () => {
  assert.equal(manualOverride(0), false);
  assert.equal(manualOverride(0.3), true);
});

test('poder automático: recarga, alcance y separación', () => {
  const base = { now: 1000, readyAt: [2000, 500, 0], has: [true, true, false], targetDist: 200, lastAutoAt: 0 };
  assert.equal(pickAutoCast(base), 1);
  assert.equal(pickAutoCast({ ...base, targetDist: Infinity }), -1);
  assert.equal(pickAutoCast({ ...base, targetDist: 5000 }), -1);
  assert.equal(pickAutoCast({ ...base, lastAutoAt: 900 }), -1);
  assert.equal(pickAutoCast({ ...base, readyAt: [2000, 2000, 0] }), -1);
});

test('minimapa de móvil: no llega a los botones táctiles con ningún tamaño de interfaz', async () => {
  const { MOBILE_MAP } = await import('../src/data/mobileView.ts');
  const { padButtons, padRect } = await import('../src/data/touchPad.ts');
  // Medidas de src/ui/layout.ts (1920×1080, franjas de 240 px) y de GameScene.slotY(0)
  const left = { x: 0, w: 240 };
  const right = { x: 1680, w: 240 };
  const slotsTop = 1080 - 16 - 4 * 74;
  const mapBottom = MOBILE_MAP.top + MOBILE_MAP.maxH;
  for (const k of [1, 1.25, 1.5]) {
    const b = padButtons(left, right, 1080, 16, slotsTop, k);
    for (const id of ['parry', 'dash'] as const) assert.ok(padRect(b[id]).y > mapBottom + 100, `${id} con ${k}`);
  }
  assert.ok(MOBILE_MAP.scale / 1.5 >= 1.6 - 1e-9);
});
