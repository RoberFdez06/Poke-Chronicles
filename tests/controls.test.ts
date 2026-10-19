// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROL_ACTIONS,
  CONTROL_ACTION_LABEL,
  CONTROL_MODES,
  CONTROL_MODE_LABEL,
  controlSections,
  isTouchOnly,
  visibleModes,
} from '../src/data/controls.ts';
import { DEFAULT_KEYS } from '../src/data/keybinds.ts';

test('cada acción tiene entrada en todos los modos (Teclado, Ratón, Mando y Táctil)', () => {
  const s = controlSections({ ...DEFAULT_KEYS });
  assert.deepEqual(CONTROL_MODES.map((m) => CONTROL_MODE_LABEL[m]), ['Teclado', 'Ratón', 'Mando', 'Táctil']);
  for (const m of CONTROL_MODES) {
    assert.deepEqual(Object.keys(s[m]).sort(), [...CONTROL_ACTIONS].sort(), m);
    for (const a of CONTROL_ACTIONS) assert.ok(s[m][a].trim().length > 0, `${m}.${a}`);
  }
  for (const a of CONTROL_ACTIONS) assert.ok(CONTROL_ACTION_LABEL[a]);
});

test('el teclado enseña las teclas configuradas', () => {
  const s = controlSections({ ...DEFAULT_KEYS, bomb: 'Q', power1: 'NUMPAD_ONE' });
  assert.equal(s.keyboard.bomb, 'Q');
  assert.match(s.keyboard.powers, /^Num 1 2 3 4$/);
  assert.match(s.keyboard.move, /W A S D/);
});

test('los controles táctiles solo salen en móvil o tableta, nunca con ratón', () => {
  assert.equal(isTouchOnly({ maxTouchPoints: 5, coarse: true, fine: false }), true);
  assert.equal(isTouchOnly({ maxTouchPoints: 0, coarse: true, fine: false }), true);
  // Portátil con pantalla táctil y ratón/panel: no
  assert.equal(isTouchOnly({ maxTouchPoints: 10, coarse: false, fine: true }), false);
  assert.equal(isTouchOnly({ maxTouchPoints: 0, coarse: false, fine: true }), false);
  assert.deepEqual(visibleModes(false), ['keyboard', 'mouse', 'gamepad']);
  assert.deepEqual(visibleModes(true), [...CONTROL_MODES]);
});
