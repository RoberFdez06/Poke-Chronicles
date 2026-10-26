import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_MAX_ITEMS, cardFileName, NO_SEED_TEXT, parseItemLabel, shareCardData } from '../src/data/shareCard.ts';
import type { RunRecord } from '../src/data/runHistory.ts';

const base: RunRecord = {
  endedAt: new Date(2026, 9, 26, 12).getTime(), starterId: 25, starterName: 'Pikachu', mode: 'normal', floor: 4, won: false,
  seconds: 187, kills: 42, damage: 900, items: ['Bola Lupa x2', 'Cinta Elegida'], tickets: 3, newRecord: false, parries: 5,
};

test('derrota: piso, tiempo, kills, parrys y objetos', () => {
  const c = shareCardData(base);
  assert.equal(c.won, false);
  assert.match(c.result, /^Hasta /);
  assert.deepEqual(c.stats.map((s) => s.value), ['3:07', '42', '5', '3']);
  assert.deepEqual(c.items, [{ name: 'Bola Lupa', count: 2 }, { name: 'Cinta Elegida', count: 1 }]);
  assert.equal(c.moreItems, 0);
});

test('victoria y partidas antiguas sin parrys', () => {
  const c = shareCardData({ ...base, won: true, parries: undefined });
  assert.equal(c.result, '¡Victoria!');
  assert.equal(c.stats[2].value, '0');
});

test('código de semilla: hueco si no hay y en mayúsculas si hay', () => {
  assert.equal(shareCardData(base).seedText, NO_SEED_TEXT);
  assert.equal(shareCardData(base, '  ').seedText, NO_SEED_TEXT);
  assert.equal(shareCardData(base, 'pki-7f3k-9qxa').seedText, 'Código: PKI-7F3K-9QXA');
});

test('los objetos que no caben salen como +N', () => {
  const items = Array.from({ length: CARD_MAX_ITEMS + 3 }, (_, i) => `Objeto ${i}`);
  const c = shareCardData({ ...base, items });
  assert.equal(c.items.length, CARD_MAX_ITEMS);
  assert.equal(c.moreItems, 3);
});

test('etiquetas de objeto y nombre de archivo', () => {
  assert.deepEqual(parseItemLabel('Restos x3'), { name: 'Restos', count: 3 });
  assert.deepEqual(parseItemLabel('Restos'), { name: 'Restos', count: 1 });
  assert.equal(cardFileName('Ñandú Ágil', base.endedAt), 'pokeisaac-nandu-agil-2026-10-26.png');
  assert.equal(cardFileName('???', base.endedAt), 'pokeisaac-partida-2026-10-26.png');
  assert.match(shareCardData(base).fileName, /^pokeisaac-pikachu-\d{4}-\d{2}-\d{2}\.png$/);
});
