import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armKonami, evolveMagikarp, KONAMI, konamiStep, secretVariant, sellsMagikarp, takeKonamiShiny, MISSINGNO_CHANCE, TRUCK_CHANCE,
} from '../src/data/easterEggs.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test('el código Konami se completa solo con la secuencia exacta', () => {
  let p = 0;
  for (const k of KONAMI) p = konamiStep(p, k);
  assert.equal(p, KONAMI.length);
  p = 0;
  for (const k of ['up', 'up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']) p = konamiStep(p, k);
  assert.equal(p, KONAMI.length, 'un ↑ de más no rompe la secuencia');
  assert.equal(konamiStep(5, 'x'), 0);
});

test('el código da una tirada shiny, una vez al día', () => {
  const s = mem();
  assert.equal(takeKonamiShiny(s), false);
  assert.equal(armKonami(10, s), true);
  assert.equal(armKonami(10, s), false);
  assert.equal(takeKonamiShiny(s), true);
  assert.equal(takeKonamiShiny(s), false);
  assert.equal(armKonami(11, s), true);
});

test('Magikarp se vende a veces y evoluciona en Gyarados', () => {
  assert.equal(sellsMagikarp(0.1, []), true);
  assert.equal(sellsMagikarp(0.9, []), false);
  assert.equal(sellsMagikarp(0.1, ['gyarados']), false);
  assert.deepEqual(evolveMagikarp(['lupa', 'magikarp']), { passives: ['lupa', 'gyarados'], evolved: true });
  assert.equal(evolveMagikarp(['lupa']).evolved, false);
});

test('las salas secretas raras salen con la proporción esperada y siempre igual', () => {
  const n = 4000;
  const c = { normal: 0, missingno: 0, truck: 0 };
  for (let s = 0; s < n; s++) c[secretVariant(s * 7919, s % 13)]++;
  assert.ok(Math.abs(c.missingno / n - MISSINGNO_CHANCE) < 0.03);
  assert.ok(Math.abs(c.truck / n - TRUCK_CHANCE) < 0.03);
  assert.equal(secretVariant(5, 3), secretVariant(5, 3));
});
