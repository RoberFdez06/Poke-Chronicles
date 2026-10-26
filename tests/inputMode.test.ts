import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGEND_SCENES, legendFor } from '../src/ui/inputMode.ts';

test('las pantallas de la Tanda 8 llevan la barra del mando y dicen lo que hace B', () => {
  // «Una más» se maneja con mando sola: la barra explica que B termina la partida
  assert.ok(LEGEND_SCENES.has('SecondChance'));
  assert.match(legendFor('SecondChance'), /B: terminar/);
  // En el registro de combate solo se puede volver: no debe decir que A acepta algo
  assert.ok(LEGEND_SCENES.has('RunDex'));
  assert.doesNotMatch(legendFor('RunDex'), /A:/);
});
