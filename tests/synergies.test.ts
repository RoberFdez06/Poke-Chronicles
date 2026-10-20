// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_ITEMS,
  SYNERGIES,
  activeById,
  applySynergies,
  chargeAfterClear,
  isCharged,
  synergyActive,
} from '../src/data/synergies.ts';
import { BASE_STATS, PASSIVE_ITEMS, computeStats, passiveById, rollItem } from '../src/data/items.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('hay al menos 25 objetos pasivos nuevos, con nombre y efecto', () => {
  assert.ok(PASSIVE_ITEMS.length >= 9 + 25, `${PASSIVE_ITEMS.length}`);
  assert.equal(new Set(PASSIVE_ITEMS.map((i) => i.name)).size, PASSIVE_ITEMS.length);
  for (const item of PASSIVE_ITEMS) assert.notDeepEqual(computeStats([item.id]), BASE_STATS, item.id);
});

test('los objetos con efectos especiales hacen lo que dicen', () => {
  assert.equal(computeStats(['telescopio']).homing > 0, true);
  assert.equal(computeStats(['cola-gemela']).backShots, 1);
  assert.equal(computeStats(['gafas-protectoras']).shieldPerRoom, 1);
  assert.equal(computeStats(['banda-focus']).focusBand, 1);
  assert.equal(computeStats(['moneda-amuleto']).coinMul, 2);
  assert.equal(computeStats(['carbon', 'carbon']).typeBoost.fire, 0.5);
  assert.ok(computeStats(['polvo-brillo', 'polvo-brillo', 'polvo-brillo', 'polvo-brillo', 'polvo-brillo']).dodge <= 0.5);
  // Los mapas por tipo no se comparten entre cálculos
  computeStats(['carbon']);
  assert.equal(computeStats([]).typeBoost.fire, undefined);
});

test('las sinergias piden sus objetos y, algunas, un poder del tipo', () => {
  const fire = SYNERGIES.find((s) => s.id === 'fuego-interior')!;
  assert.ok(!synergyActive(fire, ['carbon'], []));
  assert.ok(!synergyActive(fire, [], ['fire']));
  assert.ok(synergyActive(fire, ['carbon'], ['fire', 'water']));
  const choice = SYNERGIES.find((s) => s.id === 'eleccion')!;
  assert.ok(!synergyActive(choice, ['cinta-elegida'], []));
  assert.ok(synergyActive(choice, ['cinta-elegida', 'panuelo-elegido'], []));
  for (const s of SYNERGIES) for (const id of [...(s.all ?? []), ...(s.anyOf?.ids ?? [])]) assert.ok(passiveById(id), `${s.id}: ${id}`);
});

test('una sinergia mejora de verdad las estadísticas', () => {
  const base = computeStats(['carbon']);
  const { stats, active } = applySynergies(base, ['carbon'], ['fire']);
  assert.deepEqual(active.map((s) => s.id), ['fuego-interior']);
  assert.equal(stats.statusBoost.fire, 2);
  assert.equal(base.statusBoost.fire, undefined);
  const sniper = applySynergies(computeStats(['lente-zoom', 'periscopio']), ['lente-zoom', 'periscopio'], []);
  assert.ok(sniper.stats.critMul > computeStats(['lente-zoom', 'periscopio']).critMul);
  assert.deepEqual(applySynergies(computeStats([]), [], []).active, []);
});

test('los objetos activos se recargan limpiando salas', () => {
  assert.ok(ACTIVE_ITEMS.length >= 3);
  for (const a of ACTIVE_ITEMS) assert.ok(a.charge >= 1 && activeById(a.id) === a);
  assert.equal(chargeAfterClear(0, 3), 1);
  assert.equal(chargeAfterClear(3, 3), 3);
  assert.ok(isCharged(2, 2) && !isCharged(1, 2));
});

test('a veces cae un objeto activo', () => {
  const rng = mulberry32(4);
  let n = 0;
  for (let i = 0; i < 1000; i++) if (rollItem(rng, new Set(), [], 0.15, ['pokeblock']).kind === 'active') n++;
  assert.ok(n > 100 && n < 200, `${n}`);
  assert.notEqual(rollItem(rng, new Set(), [], 0, ['pokeblock']).kind, 'active');
});

test('T49: los seis activos pedidos existen, con su carga y en español', () => {
  const want = ['pocion-activa', 'repelente', 'caramelo-raro', 'teletransporte', 'bomba-cebo', 'silbato'];
  for (const id of want) {
    const a = activeById(id);
    assert.ok(a, id);
    assert.ok(a!.charge >= 1 && a!.charge <= 4, id);
    assert.ok(a!.name && a!.description, id);
  }
  assert.equal(activeById('caramelo-raro')!.name, 'Caramelo Raro');
  assert.equal(new Set(ACTIVE_ITEMS.map((a) => a.id)).size, ACTIVE_ITEMS.length);
});
