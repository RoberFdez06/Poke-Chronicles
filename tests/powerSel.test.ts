// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cyclePowerSel, DYNAMAX_BAND_ID, MEGA_STONE_ID, megaBlock, newPowerFormState, POWER_SEL_LABEL, powerBlock, powerCost, powerOptions,
  startPowerForm, TERA_GEM_COST, TERA_GEM_ID, validPowerSel, Z_CRYSTAL_ID, POWER_FORMS, Z_MOVE_COST,
} from '../src/data/powerForm.ts';
import { POWER_METER_MAX } from '../src/data/powerMeter.ts';

const ctx = (o = {}) => ({ speciesId: 4, passives: [] as string[], meter: 100, hp: 40, maxHp: 100, zUsed: false, ...o });

test('selector: Teracristal y Z para todos; Dinamax con la banda; Mega con la piedra', () => {
  assert.deepEqual(powerOptions(false, ctx()), ['tera', 'z']);
  assert.deepEqual(powerOptions(true, ctx({ passives: [DYNAMAX_BAND_ID] })), ['mega', 'dynamax', 'tera', 'z']);
  assert.deepEqual(powerOptions(false, ctx({ speciesId: 6, passives: [DYNAMAX_BAND_ID] })), ['gigamax', 'tera', 'z']);
  assert.deepEqual(powerOptions(false, ctx({ zUsed: true })), ['tera']);
  assert.deepEqual(powerOptions(false, ctx({ zUsed: true, passives: [Z_CRYSTAL_ID] })), ['tera', 'z']);
  for (const k of Object.keys(POWER_SEL_LABEL)) assert.ok(POWER_SEL_LABEL[k as keyof typeof POWER_SEL_LABEL]);
});

test('selector: cambia en los dos sentidos dando la vuelta, y la elegida que ya no vale pasa a automática', () => {
  const opts = ['mega', 'dynamax', 'tera', 'z'] as const;
  assert.equal(cyclePowerSel(opts, null), 'mega');
  assert.equal(cyclePowerSel(opts, null, -1), 'z');
  assert.equal(cyclePowerSel(opts, 'tera'), 'z');
  assert.equal(cyclePowerSel(opts, 'z'), 'mega');
  assert.equal(cyclePowerSel(opts, 'mega', -1), 'z');
  assert.equal(cyclePowerSel(opts, 'gigamax'), 'mega');
  assert.equal(cyclePowerSel([], 'tera'), null);
  assert.equal(validPowerSel(['tera', 'z'], 'mega'), null);
  assert.equal(validPowerSel(['tera', 'z'], 'z'), 'z');
  assert.equal(validPowerSel(['tera'], null), null);
});

test('costes y duraciones con sentido: Tera barato y corto, Dinamax/Z todo el medidor; la Teragema abarata', () => {
  assert.equal(powerCost('tera'), POWER_FORMS.tera.meterCost);
  assert.equal(powerCost('tera', [TERA_GEM_ID]), TERA_GEM_COST);
  assert.ok(TERA_GEM_COST < POWER_FORMS.tera.meterCost);
  assert.equal(powerCost('z'), Z_MOVE_COST);
  assert.equal(powerCost('dynamax'), POWER_METER_MAX);
  assert.ok(POWER_FORMS.tera.durationMs < POWER_FORMS.dynamax.durationMs);
  assert.ok(POWER_FORMS.dynamax.durationMs < POWER_FORMS.mega.durationMs);
  assert.ok(Math.abs(POWER_FORMS.dynamax.sizeMul - 1.65) < 1e-9);
  // Con 45 de medidor: sin Teragema no llega; con ella sí
  assert.equal(powerBlock(newPowerFormState(), 'tera', ctx({ meter: 45 })), 'meter');
  assert.equal(powerBlock(newPowerFormState(), 'tera', ctx({ meter: 45, passives: [TERA_GEM_ID] })), null);
});

test('Mega: solo hace falta la piedra (ni adrenalina ni otro objeto), una vez por piso', () => {
  const c = { speciesId: 6, passives: [MEGA_STONE_ID] };
  assert.equal(megaBlock(newPowerFormState(), c), null);
  const s = startPowerForm(newPowerFormState(), 'mega');
  assert.equal(megaBlock(s, c), 'active');
  assert.equal(megaBlock({ ...s, active: null, leftMs: 0 }, c), 'used');
});
