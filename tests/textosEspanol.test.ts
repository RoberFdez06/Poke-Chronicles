import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal } from '../src/data/decimal.ts';
import { GARDEN_BERRIES, GARDEN_BERRY_IDS, runsLeftLabel } from '../src/data/berries.ts';
import { modeDesc } from '../src/data/modes.ts';
import { TD_MAPS } from '../src/data/towerDefense/maps.ts';

test('los decimales llevan coma y respetan los dígitos pedidos', () => {
  assert.equal(decimal(18.1), '18,1');
  assert.equal(decimal(0.9, 2), '0,90');
  assert.equal(decimal(5.123, 1), '5,1');
  assert.equal(decimal(3), '3');
  assert.equal(decimal(1000.5), '1000,5');
});

test('el huerto concuerda en singular y en plural', () => {
  const berry = GARDEN_BERRY_IDS.find((id) => GARDEN_BERRIES[id].growRuns >= 2)!;
  const need = GARDEN_BERRIES[berry].growRuns;
  assert.equal(runsLeftLabel({ berry, runs: need - 1 }), 'Falta 1 partida');
  assert.equal(runsLeftLabel({ berry, runs: need - 2 }), 'Faltan 2 partidas');
});

test('la tarjeta de la Defensa de torres cuenta los mapas que hay', () => {
  assert.match(modeDesc('towerdef'), new RegExp(`en ${TD_MAPS.length} mapas`));
});
