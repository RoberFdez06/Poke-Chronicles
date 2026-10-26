// T69: laguna de pesca. Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FISH_BITE_MAX_MS,
  FISH_BITE_MIN_MS,
  FISH_CHANCE,
  FISH_MAX_CASTS,
  FISH_WINDOW_MS,
  canCast,
  fishBiteDelay,
  fishPrize,
  fishingWeight,
  hookResult,
} from '../src/level/fishing.ts';
import { eventWeights, pickEventKind } from '../src/level/roomEvents.ts';
import { GYARADOS, MAGIKARP } from '../src/data/easterEggs.ts';

test('espera hasta que pica, dentro de sus límites', () => {
  assert.equal(fishBiteDelay(0), FISH_BITE_MIN_MS);
  assert.ok(fishBiteDelay(0.999999) <= FISH_BITE_MAX_MS);
  assert.ok(fishBiteDelay(-1) >= FISH_BITE_MIN_MS && fishBiteDelay(5) <= FISH_BITE_MAX_MS);
});

test('ventana de tiempo: pronto, a tiempo y tarde', () => {
  assert.equal(hookResult(1000, 999), 'early');
  assert.equal(hookResult(1000, 1000), 'hooked');
  assert.equal(hookResult(1000, 1000 + FISH_WINDOW_MS), 'hooked');
  assert.equal(hookResult(1000, 1001 + FISH_WINDOW_MS), 'late');
  assert.ok(FISH_WINDOW_MS >= 600, 'dificultad suave');
});

test('tope de lanzamientos por sala', () => {
  for (let k = 0; k < FISH_MAX_CASTS; k++) assert.ok(canCast(k));
  assert.equal(canCast(FISH_MAX_CASTS), false);
  assert.equal(canCast(FISH_MAX_CASTS + 1), false);
});

test('tabla de premios: orden, rarezas y Magikarp/Gyarados una sola vez', () => {
  assert.equal(fishPrize(0), 'gyarados');
  assert.equal(fishPrize(FISH_CHANCE.gyarados + 0.001), 'magikarp');
  assert.equal(fishPrize(0.999), 'coins');
  assert.ok(FISH_CHANCE.gyarados < FISH_CHANCE.magikarp && FISH_CHANCE.magikarp < 0.05);
  assert.equal(fishPrize(0, [MAGIKARP]), 'coins');
  assert.equal(fishPrize(FISH_CHANCE.gyarados + 0.001, [GYARADOS]), 'coins');
  const seen = new Map<string, number>();
  const n = 100000;
  for (let i = 0; i < n; i++) {
    const p = fishPrize(i / n);
    seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  for (const k of ['coins', 'berry', 'item', 'rareFoe', 'magikarp', 'gyarados']) assert.ok(seen.get(k), k);
  assert.ok(Math.abs((seen.get('rareFoe') ?? 0) / n - FISH_CHANCE.rareFoe) < 0.002);
});

test('la laguna sale sobre todo en biomas con agua', () => {
  assert.ok(fishingWeight(['water', 'flying']) > fishingWeight(['fire', 'rock']));
  assert.ok(fishingWeight([]) > 0, 'en el resto, poco peso pero puede salir');
  assert.ok(eventWeights(4, ['water']).fishing > eventWeights(4, ['fire']).fishing);
  // Con todo el peso al final de la lista, la última tirada cae en la laguna
  assert.equal(pickEventKind(4, 0.999, ['water']), 'fishing');
});
