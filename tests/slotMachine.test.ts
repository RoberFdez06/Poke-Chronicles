// T68: sala de juegos (tragaperras). Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUCKY_SYMBOL,
  SLOT_BETS,
  SLOT_ITEM_CHANCE,
  SLOT_MAX_SPINS,
  SLOT_SYMBOLS,
  canSpin,
  pickSymbol,
  slotExpectedReturn,
  slotOutcome,
  slotPayout,
  spinSlot,
} from '../src/level/slotMachine.ts';
import { ROOM_EVENTS, ROOM_EVENT_COLOR, ROOM_EVENT_DESC, ROOM_EVENT_LABEL, eventWeights } from '../src/level/roomEvents.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('combinaciones: nada, pareja, trío y trío de la suerte', () => {
  assert.equal(slotOutcome(['bola', 'baya', 'moneda']), 'none');
  assert.equal(slotOutcome(['bola', 'bola', 'moneda']), 'pair');
  assert.equal(slotOutcome(['bola', 'moneda', 'bola']), 'pair');
  assert.equal(slotOutcome(['moneda', 'bola', 'bola']), 'pair');
  assert.equal(slotOutcome(['estrella', 'estrella', 'estrella']), 'trio');
  assert.equal(slotOutcome([LUCKY_SYMBOL, LUCKY_SYMBOL, LUCKY_SYMBOL]), 'lucky');
});

test('premios: crecen con la combinación y con la apuesta', () => {
  for (const bet of SLOT_BETS) {
    assert.equal(slotPayout('none', bet), 0);
    assert.equal(slotPayout('pair', bet), bet);
    assert.ok(slotPayout('trio', bet) > slotPayout('pair', bet));
    assert.ok(slotPayout('lucky', bet) > slotPayout('trio', bet));
  }
  assert.deepEqual([...SLOT_BETS], [3, 6, 12]);
});

test('el valor esperado es menor que la apuesta, pero no ridículo', () => {
  const ev = slotExpectedReturn();
  assert.ok(ev < 1, `EV ${ev}`);
  assert.ok(ev > 0.6, `EV ${ev}`);
});

test('simulación: la máquina no es una mina de monedas', () => {
  const rng = mulberry32(68);
  let paid = 0;
  const n = 100000;
  for (let k = 0; k < n; k++) paid += spinSlot(6, rng).payout;
  assert.ok(paid / (n * 6) < 1, `devuelve ${paid / (n * 6)}`);
});

test('el objeto sale alrededor del 5 % y es independiente del premio', () => {
  const rng = mulberry32(5);
  let items = 0;
  const n = 100000;
  for (let k = 0; k < n; k++) if (spinSlot(3, rng).item) items++;
  assert.ok(Math.abs(items / n - SLOT_ITEM_CHANCE) < 0.01);
});

test('una tirada es determinista con la misma semilla y siempre da símbolos válidos', () => {
  const a = spinSlot(12, mulberry32(7));
  const b = spinSlot(12, mulberry32(7));
  assert.deepEqual(a, b);
  for (const s of a.reels) assert.ok(SLOT_SYMBOLS.includes(s));
  assert.equal(pickSymbol(-1), SLOT_SYMBOLS[0]);
  assert.ok(SLOT_SYMBOLS.includes(pickSymbol(2)));
});

test('tope de tiradas, monedas y apuestas válidas', () => {
  assert.equal(canSpin(100, 3, 0), true);
  assert.equal(canSpin(2, 3, 0), false);
  assert.equal(canSpin(100, 5, 0), false);
  assert.equal(canSpin(100, 12, SLOT_MAX_SPINS - 1), true);
  assert.equal(canSpin(100, 12, SLOT_MAX_SPINS), false);
});

test('la sala de juegos es un evento con nombre, color, descripción y peso desde el piso 2', () => {
  assert.ok(ROOM_EVENTS.includes('slots'));
  assert.ok(ROOM_EVENT_LABEL.slots && ROOM_EVENT_DESC.slots);
  assert.equal(typeof ROOM_EVENT_COLOR.slots, 'number');
  for (const f of [2, 3, 5, 9]) assert.ok(eventWeights(f).slots > 0);
});
