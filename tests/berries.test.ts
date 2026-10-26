import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSeed, emptyGarden, GARDEN_BERRIES, GARDEN_BERRY_IDS, GARDEN_CARRY, GARDEN_PLOTS, growGarden, harvest, isRipe, parseGarden, plant,
  rollSeed, runsLeft, shouldAutoHeal, takeBasket, useCarried,
} from '../src/data/berries.ts';
import { mulberry32 } from '../src/level/floorGen.ts';
import { GARDEN_KEY, gainSeed, loadGarden, PROGRESS_KEYS, takeGardenBerries, updateGarden } from '../src/data/save.ts';
import { MemoryStorage } from '../src/data/storage.ts';

test('huerto nuevo: parcelas vacías y una semilla de Aranja', () => {
  const g = emptyGarden();
  assert.equal(g.plots.length, GARDEN_PLOTS);
  assert.ok(g.plots.every((p) => p === null));
  assert.equal(g.seeds.aranja, 1);
});

test('plantar gasta la semilla y no se puede en parcela ocupada ni sin semillas', () => {
  const g = plant(emptyGarden(), 0, 'aranja')!;
  assert.equal(g.seeds.aranja, 0);
  assert.deepEqual(g.plots[0], { berry: 'aranja', runs: 0 });
  assert.equal(plant(addSeed(g, 'aranja'), 0, 'aranja'), null);
  assert.equal(plant(g, 1, 'aranja'), null);
  assert.equal(plant(g, GARDEN_PLOTS, 'aranja'), null);
});

test('crecimiento: por partidas jugadas, cada baya con su ritmo y sin pasarse', () => {
  let g = addSeed(addSeed(emptyGarden(), 'gonlan'), 'aslac');
  g = plant(g, 0, 'aranja')!;
  g = plant(g, 1, 'gonlan')!;
  g = plant(g, 2, 'aslac')!;
  for (let run = 1; run <= 4; run++) {
    g = growGarden(g);
    for (const k of [0, 1, 2]) {
      const p = g.plots[k]!;
      const need = GARDEN_BERRIES[p.berry].growRuns;
      assert.equal(isRipe(p), run >= need, `${p.berry} tras ${run}`);
      assert.equal(runsLeft(p), Math.max(0, need - run));
      assert.ok(p.runs <= need);
    }
  }
  assert.equal(g.plots[3], null);
});

test('cosecha: solo madura, llena la cesta y libera la parcela', () => {
  let g = plant(emptyGarden(), 2, 'aranja')!;
  assert.equal(harvest(g, 2), null);
  assert.equal(harvest(g, 0), null);
  g = growGarden(g);
  const r = harvest(g, 2)!;
  assert.equal(r.berry, 'aranja');
  assert.equal(r.state.basket.aranja, GARDEN_BERRIES.aranja.yield);
  assert.equal(r.state.plots[2], null);
});

test('a la partida te llevas como mucho 3, repartidas por tipos', () => {
  const g = { ...emptyGarden(), basket: { aranja: 5, gonlan: 1, aslac: 1 } };
  const r = takeBasket(g);
  assert.equal(r.berries.length, GARDEN_CARRY);
  assert.deepEqual([...r.berries].sort(), ['aranja', 'aslac', 'gonlan']);
  assert.deepEqual(r.state.basket, { aranja: 4, gonlan: 0, aslac: 0 });
  assert.deepEqual(takeBasket(emptyGarden()).berries, []);
  assert.deepEqual(useCarried(['aranja', 'gonlan', 'aranja'], 'aranja'), ['gonlan', 'aranja']);
  assert.equal(useCarried(['gonlan'], 'aslac'), null);
  assert.ok(shouldAutoHeal(30, 100) && !shouldAutoHeal(60, 100) && !shouldAutoHeal(0, 100));
});

test('semillas al azar: siempre válidas', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) assert.ok(GARDEN_BERRY_IDS.includes(rollSeed(rng)));
});

test('lectura saneada del guardado', () => {
  assert.deepEqual(parseGarden(null), emptyGarden());
  assert.deepEqual(parseGarden('{roto'), emptyGarden());
  const g = parseGarden(JSON.stringify({ v: 1, plots: [{ berry: 'aranja', runs: 50 }, { berry: 'nada', runs: 1 }], seeds: { gonlan: 2.7, aslac: -3 }, basket: { aranja: 'x' } }));
  assert.deepEqual(g.plots, [{ berry: 'aranja', runs: 1 }, null, null, null]);
  assert.deepEqual(g.seeds, { aranja: 0, gonlan: 2, aslac: 0 });
  assert.deepEqual(g.basket, { aranja: 0, gonlan: 0, aslac: 0 });
});

test('save.ts: guarda el huerto, da semillas, crece y se borra con el progreso', () => {
  const st = new MemoryStorage();
  assert.ok(PROGRESS_KEYS.includes(GARDEN_KEY));
  gainSeed('aslac', st);
  assert.equal(loadGarden(st).seeds.aslac, 1);
  updateGarden((g) => plant(g, 0, 'aranja')!, st);
  updateGarden(growGarden, st);
  updateGarden((g) => harvest(g, 0)!.state, st);
  assert.deepEqual(takeGardenBerries(st), ['aranja', 'aranja']);
  assert.equal(loadGarden(st).basket.aranja, 0);
  assert.deepEqual(takeGardenBerries(st), []);
});
