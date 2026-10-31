import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bossCineKey, shouldShowBossCine } from '../src/data/bossCine.ts';

const base = { mode: 'normal', floorNum: 1, floorSeed: 1234, runSeed: 99, arenaIds: [7, 8, 11, 12] };

test('la clave lleva partida, modo, piso, semilla del piso y arena', () => {
  const k = bossCineKey(base);
  assert.notEqual(k, bossCineKey({ ...base, floorNum: 2 }));
  assert.notEqual(k, bossCineKey({ ...base, runSeed: 100 }));
  assert.notEqual(k, bossCineKey({ ...base, mode: 'daily' }));
  assert.notEqual(k, bossCineKey({ ...base, floorSeed: 4321 }));
  // La misma arena da igual en qué casilla estés (orden distinto)
  assert.equal(k, bossCineKey({ ...base, arenaIds: [12, 11, 8, 7] }));
});
test('la primera vez se muestra siempre (también si la clave guardada es de otro piso)', () => {
  const key = bossCineKey(base);
  assert.equal(shouldShowBossCine({ key, stored: null, resumed: false, savedInArena: false }), true);
  assert.equal(shouldShowBossCine({ key, stored: bossCineKey({ ...base, floorNum: 2 }), resumed: true, savedInArena: true }), true);
});
test('partida nueva con la misma semilla (mismo código): se vuelve a ver', () => {
  const key = bossCineKey(base);
  assert.equal(shouldShowBossCine({ key, stored: key, resumed: false, savedInArena: false }), true);
});
test('reanudar fuera de la arena: se ve al entrar; reanudar dentro y ya vista: no se repite', () => {
  const key = bossCineKey(base);
  assert.equal(shouldShowBossCine({ key, stored: key, resumed: true, savedInArena: false }), true);
  assert.equal(shouldShowBossCine({ key, stored: key, resumed: true, savedInArena: true }), false);
});
