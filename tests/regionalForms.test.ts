import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRegionalForms, formFacts, REGIONAL_FORMS, regionalForm, withRegionalForms } from '../src/data/regionalForms.ts';
import { filterCollection, regionOf } from '../src/data/regions.ts';
import { TYPE_COLORS } from '../src/data/types.ts';

test('T83: toda forma apunta a una especie válida de la Pokédex nacional', () => {
  for (const r of REGIONAL_FORMS) {
    assert.ok(Number.isInteger(r.baseId) && r.baseId >= 1 && r.baseId <= 1025, r.name);
    assert.ok(r.id > 10000, r.name);
    assert.ok(r.nameEs.includes(r.region === 'alola' ? 'Alola' : 'Galar'));
  }
});

test('T83: tipos válidos', () => {
  for (const r of REGIONAL_FORMS) {
    assert.ok(r.types.length >= 1 && r.types.length <= 2, r.name);
    for (const t of r.types) assert.ok(t in TYPE_COLORS, `${r.name}: ${t}`);
  }
});

test('T83: sin duplicados', () => {
  assert.equal(new Set(REGIONAL_FORMS.map((r) => r.id)).size, REGIONAL_FORMS.length);
  assert.equal(new Set(REGIONAL_FORMS.map((r) => r.name)).size, REGIONAL_FORMS.length);
  const base = [{ id: 37, name: 'vulpix', bst: 299, legendary: false, mythical: false }, ...formFacts().slice(0, 1)];
  const all = withRegionalForms(base);
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
  assert.equal(all.length, 1 + REGIONAL_FORMS.length);
});

test('T83: las formas cuentan en su región y van detrás de su especie', () => {
  assert.equal(regionOf(10103)?.id, 'alola');
  assert.equal(regionOf(10161)?.id, 'galar');
  assert.equal(regionOf(37)?.id, 'kanto');
  const list = filterCollection([
    { id: 10103, name: 'Vulpix de Alola', rarity: 'common' },
    { id: 38, name: 'Ninetales', rarity: 'rare' },
    { id: 37, name: 'Vulpix', rarity: 'common' },
  ]);
  assert.deepEqual(list.map((e) => e.id), [37, 10103, 38]);
  assert.deepEqual(filterCollection([{ id: 10103, name: 'x', rarity: 'common' }, { id: 37, name: 'y', rarity: 'common' }], { region: 'alola' }).map((e) => e.id), [10103]);
});

test('T83: applyRegionalForms cambia solo especies con forma y respeta la probabilidad', () => {
  const always = { swap: 1, biomeFitMul: 1, inject: 0 };
  const never = { swap: 0, biomeFitMul: 1, inject: 0 };
  assert.deepEqual(applyRegionalForms([37, 1], [], () => 0, never), [37, 1]);
  const out = applyRegionalForms([37, 1], [], () => 0, always);
  assert.equal(out[0], 10103);
  assert.equal(out[1], 1);
  assert.equal(regionalForm(out[0])?.baseId, 37);
  // El bioma mete una forma que le encaje
  const inj = applyRegionalForms([1, 4], ['ice'], () => 0, { swap: 0, biomeFitMul: 1, inject: 1 });
  assert.ok(regionalForm(inj[1])?.types.includes('ice'));
});
