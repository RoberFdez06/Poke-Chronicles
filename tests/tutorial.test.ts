import { test } from 'node:test';
import assert from 'node:assert/strict';
import { disableTips, emptyTutorial, markTipSeen, parseTutorial, shouldShowTip, TIP_IDS, TIPS } from '../src/data/tutorial.ts';
import { loadTutorial, PROGRESS_KEYS, saveTutorial, TUTORIAL_KEY, type StorageLike } from '../src/data/save.ts';

test('cada consejo tiene título y texto, y nombra los tres controles cuando hay que pulsar algo', () => {
  for (const id of TIP_IDS) {
    const t = TIPS[id];
    assert.ok(t.title && t.text.length > 20, id);
  }
  // Los de acciones mencionan teclado, ratón (clic) y mando
  for (const id of ['move', 'shoot', 'powers', 'active', 'center', 'shop'] as const) {
    assert.match(TIPS[id].text, /clic/i, id);
  }
  assert.match(TIPS.move.text, /stick/);
  assert.match(TIPS.pause.text, /Start/);
});

test('un consejo sale una sola vez y se pueden desactivar todos', () => {
  let s = emptyTutorial();
  assert.ok(shouldShowTip(s, 'move'));
  s = markTipSeen(s, 'move');
  assert.equal(shouldShowTip(s, 'move'), false);
  assert.ok(shouldShowTip(s, 'shoot'));
  assert.equal(markTipSeen(s, 'move'), s);
  s = disableTips(s);
  assert.equal(shouldShowTip(s, 'shoot'), false);
});

test('parseTutorial: corrupto, ids desconocidos y guardado', () => {
  assert.deepEqual(parseTutorial(null), emptyTutorial());
  assert.deepEqual(parseTutorial('{roto'), emptyTutorial());
  assert.deepEqual(parseTutorial(JSON.stringify({ seen: ['move', 'volar'], off: 'si' })), { seen: ['move'], off: false });
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  saveTutorial({ seen: ['shop'], off: true }, st);
  assert.deepEqual(loadTutorial(st), { seen: ['shop'], off: true });
  assert.ok(PROGRESS_KEYS.includes(TUTORIAL_KEY));
});

import { tipButtons, tipText } from '../src/data/tutorial.ts';

test('en táctil los consejos no hablan de teclas ni del mando', () => {
  for (const id of TIP_IDS) {
    if (id.startsWith('td_')) continue;
    const t = tipText(id, true);
    assert.ok(!/W A S D|\bstick\b|\bLT\b|\bRT\b|\bLB\b|\bRB\b|Esc|Enter|Espacio|clic/.test(t), `${id}: ${t}`);
  }
  assert.equal(tipText('move', false), TIPS.move.text);
  assert.ok(!/LT|RT/.test(Object.values(tipButtons(true)).join(' ')));
  assert.ok(tipButtons(false).off.includes('LT'));
});
