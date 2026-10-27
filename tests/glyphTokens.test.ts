// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeGlyphs } from '../src/data/glyphTokens.ts';

const names = (s: string, d: Parameters<typeof tokenizeGlyphs>[1]) =>
  tokenizeGlyphs(s, d).map((t) => (t.t === 'glyph' ? `[${t.name}]` : t.s)).join('');

test('glifos: botones del mando solo con mando', () => {
  assert.equal(names('A: aceptar · LB/RB: región · B: volver', 'gamepad'), '[pad:A]: aceptar · [pad:LB]/[pad:RB]: región · [pad:B]: volver');
  assert.equal(names('Cruceta: moverse', 'gamepad'), '[pad:dpad]: moverse');
  assert.equal(names('Stick izquierdo', 'gamepad'), '[pad:stickL]');
});

test('glifos: teclas y ratón en PC, sin romper cifras ni palabras', () => {
  assert.equal(names('Q y E: Pokémon · Enter: colocar', 'keyboard'), '[key:Q] y [key:E]: Pokémon · [key:Enter]: colocar');
  assert.equal(names('Mantén Q y suelta tras 0,8 s', 'keyboard'), 'Mantén [key:Q] y suelta tras 0,8 s');
  assert.equal(names('Esc, Enter o ←/→', 'keyboard'), '[key:Esc], [key:Enter] o [key:←]/[key:→]');
  assert.equal(names('Pikachu (50 $) x1', 'keyboard'), 'Pikachu (50 $) x1');
  assert.equal(names('Clic derecho: cancelar', 'mouse'), '[mouse:right]Clic derecho: cancelar');
  assert.equal(names('{Esc} o {pad:B}', 'touch'), '[key:Esc] o [pad:B]');
  assert.equal(names('Toca una casilla', 'touch'), '[touch:tap]Toca una casilla');
});
