import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudLayout, hudRects, itemGrid, nameFontSize, approxTextWidth, HUD_NAME_MIN_FONT, HUD_ITEM_R, type HudRect } from '../src/data/hudLayout.ts';

/** Ancho del contenido del panel izquierdo: franja de 240 px (GAME_VIEW.x) menos 16 px a cada lado. */
const LW = 240 - 32;
/** Altura donde empieza el cuadro del objeto activo (H − pad − 110). */
const ACTIVE_Y = 1080 - 16 - 110;

const hits = (a: HudRect, b: HudRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: HudRect, b: HudRect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

// Pares que van uno dentro de otro a propósito (la etiqueta del parry dentro de su cuadro, etc.)
const NESTED = new Set(['parry']);

for (const n of [0, 1, 4, 5, 8, 10, 16]) {
  test(`con ${n} objetos nada se pisa ni se sale del panel`, () => {
    const r = hudRects(LW, n);
    const names = Object.keys(r).filter((k) => !NESTED.has(k));
    for (let i = 0; i < names.length; i++) {
      const a = r[names[i]];
      assert.ok(a.x >= 0 && a.x + a.w <= LW, `${names[i]} se sale por los lados (${a.x}..${a.x + a.w})`);
      assert.ok(a.y + a.h <= ACTIVE_Y, `${names[i]} pisa el objeto activo`);
      for (let j = i + 1; j < names.length; j++) assert.ok(!hits(a, r[names[j]]), `${names[i]} pisa ${names[j]}`);
    }
  });
}

test('cada pieza queda dentro de su cuadro', () => {
  const l = hudLayout(LW);
  const r = hudRects(LW, 0);
  for (const k of ['name', 'ball', 'mega', 'ballBadge', 'megaBadge', 'progress', 'hpBar', 'hpText']) assert.ok(inside(r[k], l.card), `${k} fuera de la ficha`);
  for (const k of ['coinIcon', 'keyIcon', 'bombIcon', 'potionIcon', 'bombBadge', 'potionBadge']) assert.ok(inside(r[k], l.counters), `${k} fuera de los contadores`);
  assert.ok(l.meter.y >= l.adrenaline.y + l.adrenaline.h && l.meter.y + l.meter.h <= l.card.y, 'el medidor va entre la adrenalina y la ficha');
});

test('el título «Objetos» queda encima de la primera fila de iconos, sin tocarla', () => {
  const l = hudLayout(LW);
  const [first] = itemGrid(1, LW);
  assert.ok(l.itemsTitleY + 18 < first.y - HUD_ITEM_R);
});

test('la rejilla de objetos usa 1 fila hasta 4 y 2 filas hasta 8, sin salirse', () => {
  const g = itemGrid(8, LW);
  assert.equal(new Set(g.slice(0, 4).map((p) => p.y)).size, 1);
  assert.equal(new Set(g.map((p) => p.y)).size, 2);
  for (const p of itemGrid(16, LW)) assert.ok(p.x - HUD_ITEM_R >= 0 && p.x + HUD_ITEM_R <= LW);
});

test('los nombres largos se encogen para no pisar la Mega Piedra ni la Poké Ball', () => {
  const l = hudLayout(LW);
  for (const name of ['Mew', 'Genesect', 'Charizard', 'Fletchinder', 'Crabominable', 'Blacephalon']) {
    const s = nameFontSize(name, l.name.maxWMega);
    assert.ok(s >= HUD_NAME_MIN_FONT);
    if (s > HUD_NAME_MIN_FONT) assert.ok(approxTextWidth(name, s) <= l.name.maxWMega, name);
  }
  assert.equal(nameFontSize('Mew', l.name.maxW), 24);
});
