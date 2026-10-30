import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCounters, isCounters, noteCombo, noteDash, notePerfectParry, parseHistory, type RunRecord } from '../src/data/runHistory.ts';
import { COMBO_BEST_KEY, loadComboBest, parseComboBest, PROGRESS_KEYS, submitComboBest, type StorageLike } from '../src/data/save.ts';
import { controlSections, CONTROL_ACTIONS } from '../src/data/controls.ts';
import { DEFAULT_KEYS } from '../src/data/keybinds.ts';
import { tipText, TIPS, TIP_IDS } from '../src/data/tutorial.ts';
import { tokenizeGlyphs } from '../src/data/glyphTokens.ts';

const base: RunRecord = {
  endedAt: 1, starterId: 1, starterName: 'Bulbasaur', mode: 'normal', floor: 2, won: false, seconds: 60, kills: 3, damage: 100,
  items: [], tickets: 0, newRecord: false,
};

test('contadores: el combo máximo de la partida, parrys perfectos y esquivas (opcionales: los guardados de antes valen)', () => {
  const c = emptyCounters();
  assert.ok(isCounters(c));
  noteCombo(c, 12);
  noteCombo(c, 7);
  notePerfectParry(c);
  noteDash(c);
  noteDash(c);
  assert.equal(c.bestCombo, 12);
  assert.equal(c.perfectParries, 1);
  assert.equal(c.dashes, 2);
  assert.ok(isCounters(c));
  assert.ok(!isCounters({ ...c, bestCombo: -1 }));
});

test('historial: combo máximo y nivel se guardan; las partidas antiguas sin ellos se siguen leyendo', () => {
  const nuevo = { ...base, bestCombo: 34, comboLevel: 2, comboRecord: true, perfectParries: 2, dashes: 9 };
  const sinNivel = { ...base, bestCombo: 2, comboLevel: -1 };
  const malo = { ...base, comboLevel: 1.5 };
  const list = parseHistory(JSON.stringify([nuevo, base, sinNivel, malo]));
  assert.equal(list.length, 3);
  assert.equal(list[0].bestCombo, 34);
  assert.equal(list[1].bestCombo, undefined);
});

test('récord de combo de todas las partidas: solo sube y se borra con el progreso', () => {
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  assert.equal(loadComboBest(st), 0);
  assert.ok(submitComboBest(20, st));
  assert.ok(!submitComboBest(20, st));
  assert.ok(!submitComboBest(5, st));
  assert.equal(loadComboBest(st), 20);
  assert.equal(parseComboBest('basura'), 0);
  assert.ok(PROGRESS_KEYS.includes(COMBO_BEST_KEY));
});

test('la esquiva sale en Controles con los cuatro modos y en los consejos (con versión táctil)', () => {
  assert.ok(CONTROL_ACTIONS.includes('dash'));
  const sec = controlSections({ ...DEFAULT_KEYS });
  assert.match(sec.keyboard.dash, /Mayús/);
  assert.match(sec.mouse.dash, /clic derecho/);
  assert.equal(sec.gamepad.dash, 'Cruceta abajo');
  assert.match(sec.touch.dash, /Esquiva/);
  assert.ok(TIP_IDS.includes('defend'));
  assert.match(TIPS.defend.text, /RT/);
  assert.match(TIPS.defend.text, /clic/);
  assert.match(TIPS.defend.text, /Mayús/);
  assert.doesNotMatch(tipText('defend', true), /Mayús|RT/);
  // La cruceta abajo se dibuja como glifo del mando
  assert.deepEqual(tokenizeGlyphs('Cruceta abajo', 'gamepad'), [{ t: 'glyph', name: 'pad:dpad-down' }]);
});
