import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferRevive, REVIVE_TICKETS_BASE, REVIVE_TICKETS_MAX, reviveCharge, reviveCost, revivedHp,
} from '../src/data/secondChance.ts';
import { CANDY_PER_TICKET, loadCandies, loadTickets, spendCandies, spendTickets, type StorageLike } from '../src/data/save.ts';

test('coste: tickets que suben con el piso (con tope) y caramelos al cambio de siempre', () => {
  assert.equal(reviveCost('tickets', 1), REVIVE_TICKETS_BASE);
  assert.ok(reviveCost('tickets', 4) > reviveCost('tickets', 1));
  assert.equal(reviveCost('tickets', 999), REVIVE_TICKETS_MAX);
  assert.equal(reviveCost('candies', 3), reviveCost('tickets', 3) * CANDY_PER_TICKET);
});

test('una sola vez por partida', () => {
  const rich = { candies: 9999, tickets: 9999 };
  assert.ok(canOfferRevive(false, rich, 2));
  assert.ok(!canOfferRevive(true, rich, 2));
  assert.deepEqual(reviveCharge(true, 'tickets', 9999, 2), { ok: false, reason: 'used' });
});

test('no se puede pagar sin saldo; con una de las dos basta para ofrecerla', () => {
  const cost = reviveCost('tickets', 2);
  assert.deepEqual(reviveCharge(false, 'tickets', cost - 1, 2), { ok: false, reason: 'funds' });
  assert.deepEqual(reviveCharge(false, 'tickets', cost, 2), { ok: true, cost });
  assert.ok(!canOfferRevive(false, { candies: 0, tickets: 0 }, 2));
  assert.ok(canOfferRevive(false, { candies: reviveCost('candies', 2), tickets: 0 }, 2));
});

test('el cobro real no deja el saldo en negativo (save.ts)', () => {
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  assert.ok(!spendTickets(reviveCost('tickets', 1), st));
  assert.ok(!spendCandies(reviveCost('candies', 1), st));
  assert.equal(loadTickets(st), 0);
  assert.equal(loadCandies(st), 0);
});

test('vuelves con media vida (al menos 1 PS)', () => {
  assert.equal(revivedHp(100), 50);
  assert.equal(revivedHp(1), 1);
});
