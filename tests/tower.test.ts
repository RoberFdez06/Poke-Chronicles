import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hazardCount, SUPPLY_CHOICES, TOWER_FLOORS, towerBiome, towerCheckpoint, towerCheckpointCost, towerFloor, towerFloorKind,
  towerFloorSpec, towerLevel, towerPlayable, upcomingRule,
} from '../src/level/tower.ts';
import { isLastStage, progressText, recordText, emptyRecords, withRecord, TOWER_FLOORS as MODES_TOWER } from '../src/data/modes.ts';
import { difficultyFor } from '../src/level/progression.ts';

const SEEDS = [1, 42, 977, 123456];

test('qué piso es minijefe, jefe, descanso, suministros o final', () => {
  assert.equal(TOWER_FLOORS, 100);
  assert.equal(MODES_TOWER, TOWER_FLOORS);
  assert.equal(towerFloorKind(5, 1), 'miniboss');
  assert.equal(towerFloorKind(10, 1), 'boss');
  assert.equal(towerFloorKind(15, 1), 'miniboss');
  assert.equal(towerFloorKind(11, 1), 'rest');
  assert.equal(towerFloorKind(1, 1), 'combat');
  assert.equal(towerFloorKind(100, 1), 'final');
  for (const s of SEEDS)
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const k = towerFloorKind(f, s);
      if (k === 'supply') assert.ok(f % 5 === 3, `suministros solo en pisos que no son jefe ni minijefe (${f})`);
    }
  // Algún piso de suministros sale en una torre entera
  assert.ok(Array.from({ length: 100 }, (_, i) => towerFloorKind(i + 1, 42)).includes('supply'));
});

test('todo piso es jugable y determinista por semilla', () => {
  for (const s of SEEDS)
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const a = towerFloorSpec(f, s);
      assert.ok(towerPlayable(a), `piso ${f} semilla ${s}`);
      assert.deepEqual(towerFloorSpec(f, s), a);
      const fl = towerFloor(a, s);
      assert.equal(fl.rooms.length, a.cells.length);
      assert.equal(fl.startId, 0);
      // Las casillas de una sala grande están unidas entre sí y no hay puertas hacia fuera
      for (const r of fl.rooms) for (const n of Object.values(r.doors)) assert.ok(n !== undefined && n < fl.rooms.length);
    }
});

test('nunca dos pisos seguidos con la misma forma ni la misma plantilla; jefes en sala grande', () => {
  for (const s of SEEDS) {
    for (let f = 2; f <= TOWER_FLOORS; f++) {
      const a = towerFloorSpec(f - 1, s);
      const b = towerFloorSpec(f, s);
      if (a.kind === 'combat' && b.kind === 'combat') assert.notEqual(a.shape, b.shape);
      if (a.template && b.template) assert.notEqual(a.template, b.template);
      if (b.kind === 'boss' || b.kind === 'miniboss' || b.kind === 'final') assert.ok(b.cells.length > 1);
    }
  }
});

test('el bioma cambia cada 10 pisos y el jefe es del bioma de su tramo', () => {
  for (const s of SEEDS) {
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const seg = Math.floor((f - 1) / 10);
      assert.equal(towerBiome(f, s).id, towerBiome(seg * 10 + 1, s).id);
      if (f % 10 === 0) assert.equal(towerFloorSpec(f, s).biome.id, towerBiome(f - 9, s).id);
    }
    for (let seg = 1; seg < 10; seg++) assert.notEqual(towerBiome(seg * 10 + 1, s).id, towerBiome(seg * 10, s).id);
  }
});

test('reglas especiales cada 6 o 7 pisos, solo en combate y con cartel antes', () => {
  for (const s of SEEDS) {
    const ruled: number[] = [];
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const sp = towerFloorSpec(f, s);
      if (sp.rule) {
        assert.equal(sp.kind, 'combat');
        ruled.push(f);
      }
      if (f < TOWER_FLOORS) assert.equal(upcomingRule(f, s), towerFloorSpec(f + 1, s).rule);
    }
    assert.ok(ruled.length >= 10);
    for (let i = 1; i < ruled.length; i++) assert.ok(ruled[i] - ruled[i - 1] >= 6);
  }
});

test('más peligros cuanto más alto, nunca en descanso ni suministros', () => {
  assert.equal(hazardCount(1), 0);
  for (let f = 2; f <= TOWER_FLOORS; f++) assert.ok(hazardCount(f) >= hazardCount(f - 1));
  for (const s of SEEDS)
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const sp = towerFloorSpec(f, s);
      if (sp.kind === 'rest' || sp.kind === 'supply') assert.equal(sp.hazards.length, 0);
    }
  const volcan = Array.from({ length: 100 }, (_, i) => towerFloorSpec(i + 1, 1)).find((sp) => sp.biome.id === 'volcan');
  assert.equal(volcan?.hazard, 'lava');
});

test('la dificultad sube suave y sin dispararse', () => {
  assert.equal(towerLevel(1), 1);
  for (let f = 2; f <= TOWER_FLOORS; f++) {
    const d = towerLevel(f) - towerLevel(f - 1);
    assert.ok(d === 0 || d === 1);
  }
  assert.ok(towerLevel(100) <= 13);
  // A partir del piso 30 los enemigos no van más rápido que el tope de siempre (se puede esquivar)
  for (let f = 30; f <= TOWER_FLOORS; f++) assert.ok(difficultyFor(towerLevel(f)).speed <= 1.6);
});

test('puntos de control, coste y récord', () => {
  assert.equal(towerCheckpoint(0), 1);
  assert.equal(towerCheckpoint(9), 1);
  assert.equal(towerCheckpoint(10), 11);
  assert.equal(towerCheckpoint(37), 31);
  assert.equal(towerCheckpoint(100), 91);
  assert.equal(towerCheckpointCost(1), 0);
  assert.ok(towerCheckpointCost(31) > towerCheckpointCost(11));
  assert.ok(isLastStage('tower', 100));
  assert.ok(!isLastStage('tower', 99));
  assert.equal(progressText('tower', 7), 'Piso 7/100');
  const r = withRecord(emptyRecords(), 'tower', 23);
  assert.ok(r.improved);
  assert.equal(recordText('tower', 23), 'Récord: piso 23/100');
  assert.equal(SUPPLY_CHOICES.length, 3);
});

test('las arenas de jefe de la Torre tienen de 4 a 9 casillas', () => {
  for (const seed of SEEDS)
    for (let f = 10; f <= TOWER_FLOORS; f += 10) {
      const spec = towerFloorSpec(f, seed);
      assert.ok(spec.cells.length >= 4 && spec.cells.length <= 9, `piso ${f}: ${spec.cells.length}`);
      const fl = towerFloor(spec, seed);
      assert.ok(fl.rooms.every((r) => r.gx < fl.cols && r.gy < fl.rows));
    }
});

import { TOWER_SEGMENT, towerClearCoins, towerHasChest, towerRestCell } from '../src/level/tower.ts';
import { towerShopOffer } from '../src/level/towerExtras.ts';
import { RANDOM_PASSIVES } from '../src/data/items.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('desde el piso 11 el descanso es 2x2 (solo la casilla 0 es Centro) y no hay salas pequeñas de combate', () => {
  for (const s of SEEDS)
    for (let f = TOWER_SEGMENT + 1; f <= TOWER_FLOORS; f++) {
      const sp = towerFloorSpec(f, s);
      if (sp.kind === 'rest') {
        assert.equal(sp.shape, 'square');
        const fl = towerFloor(sp, s);
        assert.deepEqual(fl.rooms.map((r) => r.kind), ['center', 'start', 'start', 'start']);
        const cells = new Set(['altar', 'shop', 'mega'].map((w) => towerRestCell(sp, w as 'altar')));
        assert.equal(cells.size, 3);
        assert.ok(!cells.has(0));
      }
      if (sp.kind === 'combat') assert.notEqual(sp.shape, 'small');
    }
  assert.equal(towerFloorSpec(1, 1).shape === 'square' && towerFloorSpec(1, 1).kind === 'rest', false);
});

test('cofres de la Torre: en minijefes siempre, nunca en jefes/descansos y nunca dos pisos de combate seguidos', () => {
  for (const s of SEEDS) {
    let n = 0;
    for (let f = 1; f <= TOWER_FLOORS; f++) {
      const k = towerFloorKind(f, s);
      const c = towerHasChest(f, s);
      if (k === 'miniboss') assert.ok(c);
      if (k === 'boss' || k === 'rest' || k === 'supply' || k === 'final') assert.ok(!c);
      if (c && k === 'combat' && f > 1 && towerFloorKind(f - 1, s) === 'combat') assert.ok(!towerHasChest(f - 1, s));
      if (c) n++;
    }
    // Unos 2-4 por tramo de 10 (minijefe + algún combate)
    assert.ok(n >= 15 && n <= 40, `cofres en la torre (semilla ${s}): ${n}`);
  }
});

test('balance de monedas de la Torre: en cada tramo da para comprar algo en el descanso, pero no toda la tienda', () => {
  const rng = mulberry32(7);
  for (let f = 1; f <= TOWER_FLOORS; f++) {
    const c = towerClearCoins(f, rng);
    assert.ok(c >= 1 && c <= 4, `monedas del piso ${f}: ${c}`);
  }
  const pool = RANDOM_PASSIVES;
  for (const s of SEEDS)
    for (let seg = 0; seg < 9; seg++) {
      // Monedas medias del tramo: pisos limpios + ~35 % de cofres con ~4,5 monedas
      let coins = 0;
      for (let f = seg * 10 + 1; f <= seg * 10 + 10; f++) {
        const k = towerFloorKind(f, s);
        if (k !== 'rest' && k !== 'supply') coins += TOWER_CLEAR_AVG(f);
        if (towerHasChest(f, s)) coins += 0.35 * 4.5;
      }
      const offer = towerShopOffer(mulberry32(s + seg), pool, new Set(), new Set());
      const prices = offer.map((o) => o.price);
      assert.ok(coins >= Math.min(...prices), `tramo ${seg}: ${coins} < más barato ${Math.min(...prices)}`);
      assert.ok(coins < prices.reduce((a, b) => a + b, 0), `tramo ${seg}: ${coins} compra toda la tienda`);
    }
});

const TOWER_CLEAR_AVG = (f: number) => (towerClearCoins(f, () => 0) * 0.35 + towerClearCoins(f, () => 0.99) * 0.65);
