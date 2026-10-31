import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectivePowerSel, powerPress, powerSelFromSave, POWER_SEL_ORDER, cyclePowerSel } from '../src/data/powerForm.ts';

test('con varias formas y ninguna elegida, el botón pide elegir (nunca escoge solo)', () => {
  assert.deepEqual(powerPress(['mega', 'tera', 'z'], null), { kind: 'choose', opts: ['mega', 'tera', 'z'] });
  assert.equal(effectivePowerSel(['mega', 'tera'], null), null);
});
test('si solo hay una forma, esa es la elegida por defecto', () => {
  assert.equal(effectivePowerSel(['tera'], null), 'tera');
  assert.deepEqual(powerPress(['tera'], null), { kind: 'fire', form: 'tera' });
});
test('el botón usa exactamente la elegida y nunca otra', () => {
  const opts = ['mega', 'dynamax', 'tera', 'z'] as const;
  for (const sel of opts) {
    const p = powerPress(opts, sel);
    assert.deepEqual(p, { kind: 'fire', form: sel });
  }
  // La mega elegida no se convierte en Tera aunque la mega esté en recarga: la lógica de bloqueo va aparte
  assert.deepEqual(powerPress(['mega', 'tera', 'z'], 'mega'), { kind: 'fire', form: 'mega' });
});
test('la elegida que ya no está disponible no hace saltar otra: vuelve a pedir elegir', () => {
  assert.deepEqual(powerPress(['tera', 'z'], 'mega'), { kind: 'choose', opts: ['tera', 'z'] });
  assert.deepEqual(powerPress([], 'mega'), { kind: 'none' });
});
test('se recuerda en el guardado (opcional, sin romper guardados viejos)', () => {
  for (const s of POWER_SEL_ORDER) assert.equal(powerSelFromSave(s), s);
  assert.equal(powerSelFromSave(undefined), null);
  assert.equal(powerSelFromSave(null), null);
  assert.equal(powerSelFromSave('random'), null);
  assert.equal(powerSelFromSave(3), null);
});
test('ciclar desde ninguna empieza por la primera y luego se recuerda', () => {
  const opts = ['mega', 'tera', 'z'] as const;
  const a = cyclePowerSel(opts, effectivePowerSel(opts, null));
  assert.equal(a, 'mega');
  assert.equal(effectivePowerSel(opts, a), 'mega');
});
