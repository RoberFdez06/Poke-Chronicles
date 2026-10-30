// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUARDIAN_IDS, guardianKindLabel, isGuardian, isUltraBeast, MEGA_GUARDIAN, pickGuardian, PSEUDO_LEGENDARY_IDS, ULTRA_IDS } from '../src/data/guardians.ts';
import { ULTRA_BEAST_IDS } from '../src/data/gacha.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('guardianes: los diez pseudolegendarios y los ultraentes, sin repetir', () => {
  assert.equal(PSEUDO_LEGENDARY_IDS.length, 10);
  for (const id of [149, 248, 373, 376, 445, 635, 706, 784, 887, 998]) assert.ok(PSEUDO_LEGENDARY_IDS.includes(id), `${id}`);
  assert.deepEqual([...ULTRA_IDS].sort((a, b) => a - b), [...ULTRA_BEAST_IDS].sort((a, b) => a - b));
  assert.equal(new Set(GUARDIAN_IDS).size, GUARDIAN_IDS.length);
  assert.equal(GUARDIAN_IDS.length, PSEUDO_LEGENDARY_IDS.length + ULTRA_IDS.length);
  assert.ok(isGuardian(445) && isGuardian(794) && !isGuardian(25) && !isGuardian(150));
  assert.ok(isUltraBeast(794) && !isUltraBeast(445));
  assert.equal(guardianKindLabel(794), 'Ultraente');
  assert.equal(guardianKindLabel(445), 'Pseudolegendario');
});

test('guardianes: el sorteo es de la lista, respeta exclusiones y filtros, y repite con la misma semilla', () => {
  const rng = mulberry32(3);
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const id = pickGuardian(rng);
    assert.ok(isGuardian(id));
    seen.add(id);
  }
  assert.ok(seen.size > 15, 'salen casi todos');
  for (let i = 0; i < 100; i++) assert.notEqual(pickGuardian(mulberry32(i), [149]), 149);
  // Solo los que tienen sprite sin conexión
  for (let i = 0; i < 50; i++) assert.ok([248, 794].includes(pickGuardian(mulberry32(i), [], (id) => id === 248 || id === 794)));
  // Excluirlos todos o un filtro que no deja ninguno: vuelve a la lista completa
  assert.ok(isGuardian(pickGuardian(() => 0.5, GUARDIAN_IDS)));
  assert.ok(isGuardian(pickGuardian(() => 0.99999, [], () => false)));
  assert.equal(pickGuardian(mulberry32(9)), pickGuardian(mulberry32(9)));
  assert.ok(MEGA_GUARDIAN.hpMul > 1 && MEGA_GUARDIAN.damageMul > 1 && MEGA_GUARDIAN.tickets > 0);
});
