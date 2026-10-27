// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLAN, needsStarter, planLabel, planSteps } from '../src/data/runPlan.ts';
import { LEGEND_SCENES, legendFor } from '../src/ui/inputMode.ts';

test('solo los modos normales piden Pokémon; diario, código y continuar no', () => {
  assert.equal(needsStarter(DEFAULT_PLAN), true);
  assert.equal(needsStarter({ kind: 'daily' }), false);
  assert.equal(needsStarter({ kind: 'code' }), false);
  assert.equal(needsStarter({ kind: 'resume' }), false);
  assert.deepEqual(planSteps(DEFAULT_PLAN), ['Hueco', 'Pokémon']);
  assert.deepEqual(planSteps({ kind: 'code' }), ['Hueco', 'Código']);
});

test('la etiqueta del plan dice modo, dificultad y piso de salida de la Torre', () => {
  assert.equal(planLabel({ kind: 'mode', mode: 'waves', difficulty: 'hard' }), 'Oleadas · Difícil');
  assert.equal(planLabel({ kind: 'mode', mode: 'tower', difficulty: 'normal', towerStart: { floor: 21, cost: 30 } }), 'Torre · Normal · desde el piso 21');
  assert.equal(planLabel({ kind: 'mode', mode: 'tower', difficulty: 'normal', towerStart: { floor: 1, cost: 0 } }), 'Torre · Normal');
  assert.equal(planLabel({ kind: 'daily' }), 'Desafío diario');
});

test('la pantalla de modos y las que faltaban llevan ayuda del mando', () => {
  for (const k of ['Mode', 'Slots', 'Garden', 'TowerDefenseMenu', 'ItemChoice', 'Confirm', 'Controls']) assert.ok(LEGEND_SCENES.has(k), k);
  assert.match(legendFor('Mode'), /LB\/RB: dificultad/);
  assert.match(legendFor('Controls'), /Y: Partida ⇄ Defensa de torres/);
});
