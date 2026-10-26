import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absorbWithShield, DYNAMAX_BAND_ID, GMAX_FORMS, gmaxFormName, hasGigamax, isPowerFormSave, newPowerFormState, nextFloorPowerForm,
  pickPower, pickTeraType, POWER_FORMS, powerBlock, powerCost, powerFormFromSave, powerFormSizeMul, powerFormTeraType,
  powerFormToSave, powerOffered, startPowerForm, TERA_GEM_ID, tickPowerForm, useZMove, Z_CRYSTAL_ID, type PowerContext,
} from '../src/data/powerForm.ts';
import {
  meterOnDamage, meterOnParry, newPowerMeter, POWER_METER_IDLE_MS, POWER_METER_MAX, POWER_METER_MAX_PER_HIT, POWER_METER_PARRY,
  spendPowerMeter, tickPowerMeter,
} from '../src/data/powerMeter.ts';
import { rawEffectiveness } from '../src/data/typeChart.ts';
import { passiveById, passiveRarity } from '../src/data/items.ts';

const ctx = (o: Partial<PowerContext> = {}): PowerContext => ({
  speciesId: 4, passives: [DYNAMAX_BAND_ID, TERA_GEM_ID, Z_CRYSTAL_ID], meter: 100, hp: 40, maxHp: 100, zUsed: false, ...o,
});

test('T75: medidor de poder: sube con el daño (con tope por golpe) y con los parrys, sin pasar del máximo', () => {
  const m = newPowerMeter();
  meterOnDamage(m, 10);
  assert.ok(m.value > 0 && m.value < POWER_METER_MAX_PER_HIT);
  const before = m.value;
  meterOnDamage(m, 100000);
  assert.equal(m.value, before + POWER_METER_MAX_PER_HIT);
  meterOnDamage(m, -5);
  assert.equal(m.value, before + POWER_METER_MAX_PER_HIT);
  meterOnParry(m);
  assert.equal(m.value, before + POWER_METER_MAX_PER_HIT + POWER_METER_PARRY);
  for (let i = 0; i < 20; i++) meterOnParry(m);
  assert.equal(m.value, POWER_METER_MAX);
});

test('T75: medidor de poder: baja poco a poco solo tras un rato sin pelear, y la pausa no lo vacía', () => {
  const m = newPowerMeter(50);
  for (let t = 0; t < POWER_METER_IDLE_MS; t += 100) tickPowerMeter(m, 100);
  assert.equal(m.value, 50);
  for (let t = 0; t < 10_000; t += 100) tickPowerMeter(m, 100);
  assert.ok(m.value < 50 && m.value > 25, `${m.value}`);
  const v = m.value;
  tickPowerMeter(m, 600_000); // fotograma tras una pausa larga: se recorta
  assert.ok(v - m.value < 1);
  meterOnDamage(m, 10); // pelear reinicia la espera
  const after = m.value;
  tickPowerMeter(m, 100);
  assert.equal(m.value, after);
});

test('T75: gasto por forma: Dinamax/Gigamax todo, Tera algo más de la mitad, Z todo', () => {
  assert.equal(powerCost('dynamax'), POWER_METER_MAX);
  assert.equal(powerCost('gigamax'), POWER_METER_MAX);
  assert.equal(powerCost('z'), POWER_METER_MAX);
  assert.ok(powerCost('tera') > 50 && powerCost('tera') < 100);
  const m = newPowerMeter(70);
  assert.equal(spendPowerMeter(m, powerCost('dynamax')), false);
  assert.equal(m.value, 70);
  assert.equal(spendPowerMeter(m, powerCost('tera')), true);
  assert.equal(m.value, 70 - powerCost('tera'));
});

test('T75: Dinamax solo con 50 % de PS o menos y el medidor lleno', () => {
  const s = newPowerFormState();
  assert.equal(powerBlock(s, 'dynamax', ctx({ hp: 50 })), null);
  assert.equal(powerBlock(s, 'dynamax', ctx({ hp: 51 })), 'hp');
  assert.equal(powerBlock(s, 'dynamax', ctx({ meter: 99 })), 'meter');
  assert.equal(powerBlock(s, 'dynamax', ctx({ passives: [] })), 'item');
  // Tera no tiene límite de PS
  assert.equal(powerBlock(s, 'tera', ctx({ hp: 100, meter: powerCost('tera') })), null);
});

test('T75: Gigamax solo para sus especies (con su forma de PokeAPI); las demás hacen Dinamax', () => {
  for (const id of [6, 25, 143, 892]) assert.ok(hasGigamax(id));
  assert.ok(!hasGigamax(4));
  assert.equal(gmaxFormName(6), 'charizard-gmax');
  for (const [, name] of GMAX_FORMS) assert.match(name, /-gmax$/);
  assert.ok(powerOffered('gigamax', ctx({ speciesId: 6 })));
  assert.ok(!powerOffered('dynamax', ctx({ speciesId: 6 })));
  assert.ok(powerOffered('dynamax', ctx({ speciesId: 4 })));
  assert.ok(!powerOffered('gigamax', ctx({ speciesId: 4 })));
});

test('T75: una sola forma a la vez y una por piso (el Z también cuenta); el Z una vez por partida', () => {
  let s = startPowerForm(newPowerFormState(), 'dynamax');
  assert.equal(powerBlock(s, 'tera', ctx()), 'active');
  while (!tickPowerForm(s, 100));
  assert.equal(powerBlock(s, 'tera', ctx()), 'used');
  s = useZMove(nextFloorPowerForm());
  assert.equal(powerBlock(s, 'dynamax', ctx()), 'used');
  assert.equal(powerBlock(nextFloorPowerForm(), 'z', ctx({ zUsed: true })), 'zUsed');
  assert.ok(!powerOffered('z', ctx({ zUsed: true })));
});

test('T75: el botón elige la primera que se puede; si ninguna, la primera ofrecida con su motivo', () => {
  const s = newPowerFormState();
  assert.equal(pickPower(s, ctx())?.choice, 'dynamax');
  assert.equal(pickPower(s, ctx({ hp: 90 }))?.choice, 'tera');
  assert.deepEqual(pickPower(s, ctx({ hp: 90, meter: 10 })), { choice: 'dynamax', block: 'hp' });
  assert.equal(pickPower(s, ctx({ passives: [] })), null);
  assert.equal(pickPower(s, ctx({ passives: [Z_CRYSTAL_ID] }))?.choice, 'z');
});

test('T75: Dinamax: tamaño ×1,5 y escudo que para golpes antes que los PS', () => {
  const s = startPowerForm(newPowerFormState(), 'dynamax');
  assert.equal(powerFormSizeMul(s), 1.5);
  assert.equal(powerFormSizeMul(newPowerFormState()), 1);
  const shield = POWER_FORMS.dynamax.shield;
  assert.equal(absorbWithShield(s, 10), 0);
  assert.equal(s.shield, shield - 10);
  assert.equal(absorbWithShield(s, shield), 10);
  assert.equal(s.shield, 0);
  assert.equal(absorbWithShield(s, 7), 7);
  assert.equal(absorbWithShield(newPowerFormState(), 7), 7);
});

test('T75: Teracristal: tipo con ventaja contra el bioma, solo mientras dura, y se guarda', () => {
  assert.equal(rawEffectiveness(pickTeraType(['fire'], 'normal', rawEffectiveness), ['fire']), 2);
  assert.equal(pickTeraType(['fire'], 'water', rawEffectiveness), 'water'); // empate con el tuyo: el tuyo
  assert.equal(pickTeraType([], 'grass', rawEffectiveness), 'grass');
  const s = startPowerForm(newPowerFormState(), 'tera', 'water');
  assert.equal(powerFormTeraType(s), 'water');
  const back = powerFormFromSave(powerFormToSave(s));
  assert.ok(isPowerFormSave(powerFormToSave(s)));
  assert.equal(powerFormTeraType(back), 'water');
  while (!tickPowerForm(s, 100));
  assert.equal(powerFormTeraType(s), null);
});

test('T75: los tres objetos existen y son raros', () => {
  for (const id of [DYNAMAX_BAND_ID, TERA_GEM_ID, Z_CRYSTAL_ID]) {
    assert.ok(passiveById(id), id);
    assert.equal(passiveRarity(id), 'legendary');
  }
});
