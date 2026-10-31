import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES } from '../src/level/biomes.ts';
import { contrast, hudThemeFor, DEFAULT_HUD_THEME, HUD_TEXT, HUD_THEMES, MOTIFS } from '../src/ui/art/hudTheme.ts';

test('cada bioma tiene su propio tema del HUD', () => {
  for (const b of BIOMES) {
    const t = hudThemeFor(b.id);
    assert.notEqual(t, DEFAULT_HUD_THEME, b.id);
    assert.equal(t.id, b.id);
  }
  assert.equal(hudThemeFor('no-existe'), DEFAULT_HUD_THEME);
  assert.equal(hudThemeFor(undefined), DEFAULT_HUD_THEME);
});

test('los temas son legibles: texto claro sobre panel y acento visible', () => {
  for (const t of [...Object.values(HUD_THEMES), DEFAULT_HUD_THEME]) {
    assert.ok(contrast(HUD_TEXT, t.panel) >= 7, `${t.id}: texto/panel ${contrast(HUD_TEXT, t.panel).toFixed(2)}`);
    assert.ok(contrast(HUD_TEXT, t.bg) >= 4.5, `${t.id}: texto/fondo`);
    assert.ok(contrast(t.accent, t.panel) >= 3, `${t.id}: acento/panel ${contrast(t.accent, t.panel).toFixed(2)}`);
    assert.ok(contrast(t.accentHi, t.panel) >= 4.5, `${t.id}: brillo/panel`);
  }
});

test('los motivos son de 8×8 y solo usan su paleta', () => {
  for (const [k, rows] of Object.entries(MOTIFS)) {
    assert.equal(rows.length, 8, k);
    for (const r of rows) assert.match(r, /^[abc.]{8}$/, k);
  }
});

test('contrast cumple la definición WCAG', () => {
  assert.equal(Math.round(contrast(0xffffff, 0x000000)), 21);
  assert.equal(contrast(0x123456, 0x123456), 1);
});
