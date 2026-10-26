import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMegaEvolution, isPowerFormSave, MEGA_FORMS, MEGA_STONE_ID, megaBlock, megaDisplayName, megaFormName, megaOffered,
  newPowerFormState, nextFloorPowerForm, POWER_FORM_MAX_STEP_MS, POWER_FORMS, powerFormActive, powerFormDamageMul,
  powerFormFill, powerFormFromSave, powerFormMaxHpBonus, powerFormSpeedMul, powerFormToSave, startPowerForm, tickPowerForm,
} from '../src/data/powerForm.ts';
import { ADRENALINE_MAX, adrenalineFull, gainAdrenaline, newAdrenaline, spendAdrenaline } from '../src/data/adrenaline.ts';
import { computeStats, passiveById, passiveRarity } from '../src/data/items.ts';

const ctx = (o: Partial<{ speciesId: number; passives: string[]; adrenalineFull: boolean }> = {}) => ({
  speciesId: 6, passives: [MEGA_STONE_ID], adrenalineFull: true, ...o,
});

test('T74: lista de especies con megaevolución y nombre de su forma en PokeAPI', () => {
  for (const id of [3, 6, 9, 65, 94, 130, 150, 248, 282, 384, 445, 448]) assert.ok(hasMegaEvolution(id), `${id}`);
  for (const id of [1, 4, 25, 133, 151, 249, 493, 890]) assert.ok(!hasMegaEvolution(id), `${id}`);
  assert.equal(megaFormName(6), 'charizard-mega-x');
  assert.equal(megaFormName(382), 'kyogre-primal');
  assert.equal(megaFormName(25), null);
  for (const [id, name] of MEGA_FORMS) assert.match(name, /^[a-z-]+-(mega(-x)?|primal)$/, `${id}`);
  assert.equal(megaDisplayName(6, 'Charizard'), 'Mega Charizard');
  assert.equal(megaDisplayName(383, 'Groudon'), 'Groudon Primigenio');
});

test('T74: requisitos, todos a la vez', () => {
  const s = newPowerFormState();
  assert.equal(megaBlock(s, ctx()), null);
  assert.equal(megaBlock(s, ctx({ speciesId: 4 })), 'species');
  assert.equal(megaBlock(s, ctx({ passives: [] })), 'stone');
  assert.equal(megaBlock(s, ctx({ adrenalineFull: false })), 'adrenaline');
  // Sin piedra o sin mega no se ofrece el botón
  assert.ok(megaOffered(ctx()));
  assert.ok(!megaOffered(ctx({ speciesId: 4 })));
  assert.ok(!megaOffered(ctx({ passives: ['lupa'] })));
});

test('T74: una vez por piso y una sola forma activa', () => {
  let s = startPowerForm(newPowerFormState(), 'mega');
  assert.ok(powerFormActive(s));
  assert.equal(megaBlock(s, ctx()), 'active');
  while (!tickPowerForm(s, 100));
  assert.ok(!powerFormActive(s));
  assert.equal(megaBlock(s, ctx()), 'used');
  s = nextFloorPowerForm();
  assert.equal(megaBlock(s, ctx()), null);
});

test('T74: dura unos 30 s, la pausa no la gasta y da daño, velocidad y vida', () => {
  const s = startPowerForm(newPowerFormState(), 'mega');
  const d = POWER_FORMS.mega;
  assert.ok(d.durationMs >= 25_000 && d.durationMs <= 35_000);
  assert.ok(powerFormDamageMul(s) > 1 && powerFormSpeedMul(s) > 1 && powerFormMaxHpBonus(s) > 0);
  assert.equal(powerFormFill(s), 1);
  // El paso enorme de después de una pausa solo cuenta POWER_FORM_MAX_STEP_MS
  assert.equal(tickPowerForm(s, 60_000), false);
  assert.equal(s.leftMs, d.durationMs - POWER_FORM_MAX_STEP_MS);
  let steps = 0;
  while (!tickPowerForm(s, 50)) steps++;
  assert.equal(steps + 1, Math.ceil((d.durationMs - POWER_FORM_MAX_STEP_MS) / 50));
  assert.equal(powerFormDamageMul(s), 1);
  assert.equal(powerFormSpeedMul(s), 1);
  assert.equal(powerFormMaxHpBonus(s), 0);
  assert.equal(powerFormFill(s), 0);
  // Sin forma, avanzar no hace nada
  assert.equal(tickPowerForm(newPowerFormState(), 1000), false);
});

test('T74: guardar y continuar mantiene lo que queda de megaevolución', () => {
  const s = startPowerForm(newPowerFormState(), 'mega');
  for (let i = 0; i < 40; i++) tickPowerForm(s, 100);
  const saved = JSON.parse(JSON.stringify(powerFormToSave(s)));
  assert.ok(isPowerFormSave(saved));
  const back = powerFormFromSave(saved);
  assert.equal(back.leftMs, POWER_FORMS.mega.durationMs - 4000);
  assert.ok(powerFormActive(back) && back.usedThisFloor);
  assert.deepEqual(powerFormToSave(newPowerFormState()), { active: null, leftMs: 0, used: false });
  assert.ok(!isPowerFormSave({ active: 'mega', leftMs: 0, used: true }));
});

test('T74: la megaevolución gasta la barra de adrenalina llena', () => {
  const a = newAdrenaline();
  assert.ok(!adrenalineFull(a));
  while (!gainAdrenaline(a, 'parry'));
  assert.equal(a.value, ADRENALINE_MAX);
  assert.ok(adrenalineFull(a));
  spendAdrenaline(a);
  assert.ok(!adrenalineFull(a));
  assert.equal(a.value, 0);
  assert.equal(a.activeLeft, 0);
});

test('T74: la Mega Piedra es un pasivo raro que cambia algo', () => {
  const item = passiveById(MEGA_STONE_ID);
  assert.ok(item);
  assert.equal(passiveRarity(MEGA_STONE_ID), 'legendary');
  assert.equal(computeStats([MEGA_STONE_ID]).maxHp, computeStats([]).maxHp + 5);
});
