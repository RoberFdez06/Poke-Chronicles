import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITY_EFFECTS, abilityFor, GENERIC_EFFECT, pickAbility, pinchMul, PINCH_AT } from '../src/data/abilities.ts';
import { BASE_STATS, computeStats } from '../src/data/items.ts';

test('se usa la primera habilidad no oculta', () => {
  assert.equal(pickAbility([{ name: 'solar-power', hidden: true, slot: 3 }, { name: 'blaze', hidden: false, slot: 1 }]), 'blaze');
  assert.equal(pickAbility([{ name: 'b', hidden: false, slot: 2 }, { name: 'a', hidden: false, slot: 1 }]), 'a');
  assert.equal(pickAbility([{ name: 'solo-oculta', hidden: true, slot: 3 }]), 'solo-oculta');
  assert.equal(pickAbility([]), null);
});

test('cada habilidad de la tabla tiene nombre, descripción y algún efecto', () => {
  for (const [id, a] of Object.entries(ABILITY_EFFECTS)) {
    assert.ok(a.name && a.description, id);
    // Cabe en una línea de la pausa
    assert.ok(a.description.length <= 60, `${id}: ${a.description.length}`);
    assert.ok(a.apply || a.pinch || a.levitate, id);
    if (a.apply) {
      const s = computeStats([]);
      a.apply(s);
      assert.notDeepEqual(s, computeStats([]), id);
    }
  }
  assert.equal(ABILITY_EFFECTS.blaze.name, 'Mar Llamas');
  assert.ok(ABILITY_EFFECTS.levitate.levitate);
});

test('Mar Llamas: +50 % al daño de Fuego solo con poca vida', () => {
  const a = abilityFor('blaze');
  assert.equal(pinchMul(a, 'fire', 100, 100), 1);
  assert.equal(pinchMul(a, 'fire', 100 * PINCH_AT - 1, 100), 1.5);
  assert.equal(pinchMul(a, 'water', 10, 100), 1);
  assert.equal(pinchMul(null, 'fire', 10, 100), 1);
});

test('Intimidación baja el daño recibido; las desconocidas dan la mejora genérica con su nombre', () => {
  const s = computeStats([]);
  abilityFor('intimidate').apply!(s);
  assert.ok(s.damageTaken < BASE_STATS.damageTaken);
  const g = abilityFor('pressure', 'Presión');
  assert.equal(g.name, 'Presión');
  assert.equal(g.description, GENERIC_EFFECT.description);
  const d = computeStats([]);
  g.apply!(d);
  assert.ok(d.damage > BASE_STATS.damage);
  // Sin nombre en español: el de PokeAPI arreglado
  assert.equal(abilityFor('solar-power').name, 'Solar power');
});
