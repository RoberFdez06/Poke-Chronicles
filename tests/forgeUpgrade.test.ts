// Ejecutar con `npm test`. T73 (mejorar en la forja) y tipo Tera elegido a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isItemLevels, levelLabel, levelOf, pruneLevels, upgrade, upgradeCandidates, upgradeCost, upgradeProblem } from '../src/data/forge.ts';
import { BASE_STATS, computeStats, PASSIVE_PRICE, UPGRADE_MAX, upgradeable } from '../src/data/items.ts';
import { pickTeraType, resolveTeraType } from '../src/data/powerForm.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('cada nivel da +25 % al efecto del objeto', () => {
  // Vidasfera: +30 % de daño → +37,5 / +45 / +52,5 %
  for (const [lv, pct] of [[0, 0.3], [1, 0.375], [2, 0.45], [3, 0.525]] as const) {
    close(computeStats(['vidasfera'], BASE_STATS, { vidasfera: lv }).damage, BASE_STATS.damage * (1 + pct));
  }
  close(computeStats(['baya-aranja'], BASE_STATS, { 'baya-aranja': 2 }).maxHp, BASE_STATS.maxHp + 30);
  // Garra Rápida: −20 % de espera entre disparos → −35 % a +3
  close(computeStats(['garra-rapida'], BASE_STATS, { 'garra-rapida': 3 }).fireDelay, BASE_STATS.fireDelay * 0.65);
  // El nivel no pasa de 3 y solo afecta a su objeto
  close(computeStats(['vidasfera'], BASE_STATS, { vidasfera: 9 }).damage, BASE_STATS.damage * 1.525);
  close(computeStats(['vidasfera', 'lupa'], BASE_STATS, { lupa: 3 }).damage, BASE_STATS.damage * 1.3);
});

test('las cuentas enteras no dan fracciones: +1 disparo no se puede mejorar', () => {
  assert.equal(computeStats(['doble-equipo'], BASE_STATS, { 'doble-equipo': 3 }).extraShots, 1);
  assert.equal(upgradeable('doble-equipo'), false);
  assert.equal(upgradeable('magikarp'), false);
  assert.equal(upgradeable('lupa'), true);
  assert.equal(upgradeable('no-existe'), false);
});

test('coste, problemas y niveles', () => {
  assert.equal(upgradeCost('lupa', 0), Math.round(PASSIVE_PRICE.rare * 0.5));
  assert.ok(upgradeCost('lupa', 2) > upgradeCost('lupa', 1));
  const p = ['lupa', 'lupa', 'doble-equipo'];
  assert.equal(upgradeProblem('lupa', p, {}), null);
  assert.ok(upgradeProblem('vidasfera', p, {}));
  assert.ok(upgradeProblem('doble-equipo', p, {}));
  assert.ok(upgradeProblem('lupa', p, { lupa: UPGRADE_MAX }));
  assert.deepEqual(upgradeCandidates(p, {}), ['lupa']);
  let l = upgrade({}, 'lupa');
  l = upgrade(upgrade(upgrade(l, 'lupa'), 'lupa'), 'lupa');
  assert.equal(levelOf(l, 'lupa'), UPGRADE_MAX);
  assert.equal(levelLabel('Lupa', 2), 'Lupa +2');
  assert.equal(levelLabel('Lupa', 0), 'Lupa');
  assert.deepEqual(pruneLevels({ lupa: 2, restos: 1, vidasfera: 0 }, ['lupa']), { lupa: 2 });
  assert.equal(isItemLevels({ lupa: 3 }), true);
  assert.equal(isItemLevels({ lupa: 4 }), false);
  assert.equal(isItemLevels([]), false);
});

test('tipo Tera: el elegido a mano manda; null o raro, el automático', () => {
  const eff = (a: string, d: readonly string[]) => (a === 'water' && d.includes('fire') ? 2 : 1);
  assert.equal(pickTeraType(['fire'], 'normal', eff), 'water');
  assert.equal(resolveTeraType(null, ['fire'], 'normal', eff), 'water');
  assert.equal(resolveTeraType('grass', ['fire'], 'normal', eff), 'grass');
  assert.equal(resolveTeraType('luz', ['fire'], 'normal', eff), 'water');
});
