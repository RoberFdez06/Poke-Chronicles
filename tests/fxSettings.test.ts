// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FX, FxBudget, parseFx } from '../src/data/fxSettings.ts';
import { loadFx, saveFx, FX_KEY, PROGRESS_KEYS, type StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('ajustes de efectos: por defecto altos y sin FPS; aguanta datos rotos', () => {
  assert.deepEqual(parseFx(null), { low: false, showFps: false, texts: 'reduced' });
  assert.deepEqual(parseFx('{malo'), DEFAULT_FX);
  assert.deepEqual(parseFx(JSON.stringify({ low: true, showFps: 'sí' })), { low: true, showFps: false, texts: 'reduced' });
  const st = fakeStorage();
  saveFx({ low: true, showFps: true, texts: 'minimal' }, st);
  assert.deepEqual(loadFx(st), { low: true, showFps: true, texts: 'minimal' });
  // Es un ajuste del aparato, como el volumen: no se borra con el progreso
  assert.ok(!PROGRESS_KEYS.includes(FX_KEY));
});

test('tope de partículas: como mucho N por ventana; con efectos bajos, ninguna', () => {
  const b = new FxBudget(false, 3, 100);
  assert.deepEqual([b.take(0), b.take(10), b.take(20), b.take(30)], [true, true, true, false]);
  assert.equal(b.take(99), false);
  assert.equal(b.take(100), true);
  const low = new FxBudget(true);
  for (let t = 0; t < 1000; t += 50) assert.equal(low.take(t), false);
});
