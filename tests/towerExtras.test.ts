// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/level/floorGen.ts';
import { RANDOM_PASSIVES, passivePrice, passiveRarity } from '../src/data/items.ts';
import {
  discounted, iceVelocity, isTowerFinale, TOWER_ALTAR_COUNT, towerAltarItems, towerCheckpointOptions, towerMinibossItem, towerShopStock,
} from '../src/level/towerExtras.ts';

test('T72: el altar del descanso da 3 objetos distintos, uno raro o mejor, y es determinista', () => {
  for (let seed = 1; seed < 60; seed++) {
    const ids = towerAltarItems(mulberry32(seed), new Set(), RANDOM_PASSIVES);
    assert.equal(ids.length, TOWER_ALTAR_COUNT);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.some((id) => passiveRarity(id) !== 'common'));
    assert.deepEqual(towerAltarItems(mulberry32(seed), new Set(), RANDOM_PASSIVES), ids);
  }
});

test('T72: el altar evita lo que ya llevas si puede', () => {
  const owned = new Set(RANDOM_PASSIVES.slice(0, RANDOM_PASSIVES.length - 5).map((i) => i.id));
  const ids = towerAltarItems(mulberry32(7), owned, RANDOM_PASSIVES);
  assert.ok(ids.every((id) => !owned.has(id)));
});

test('T72: la tienda del descanso vende 2 rebajados y un exclusivo legendario al final', () => {
  for (let seed = 1; seed < 40; seed++) {
    const st = towerShopStock(mulberry32(seed), new Set(), RANDOM_PASSIVES);
    assert.equal(st.length, 3);
    const last = st[2];
    assert.ok(last.exclusive && last.goods.kind === 'passive' && passiveRarity(last.goods.id) === 'legendary');
    for (const s of st) {
      assert.equal(s.goods.kind, 'passive');
      if (s.goods.kind === 'passive') assert.equal(s.price, discounted(passivePrice(s.goods.id)));
      assert.ok(s.price < (s.goods.kind === 'passive' ? passivePrice(s.goods.id) : 0));
    }
    assert.equal(new Set(st.map((s) => (s.goods.kind === 'passive' ? s.goods.id : ''))).size, 3);
  }
});

test('T72: el minijefe suelta un épico que no llevas', () => {
  const id = towerMinibossItem(mulberry32(3), new Set(), RANDOM_PASSIVES);
  assert.equal(passiveRarity(id), 'epic');
  const epics = RANDOM_PASSIVES.filter((i) => passiveRarity(i.id) === 'epic').map((i) => i.id);
  const id2 = towerMinibossItem(mulberry32(3), new Set(epics.slice(1)), RANDOM_PASSIVES);
  assert.equal(id2, epics[0]);
});

test('T72: el piso 100 de la Torre es el reto final', () => {
  assert.ok(isTowerFinale('tower', 100));
  assert.ok(!isTowerFinale('tower', 99));
  assert.ok(!isTowerFinale('normal', 100));
});

test('T72: en el hielo la velocidad se acerca poco a poco, sin pasarse', () => {
  const v = iceVelocity({ x: 0, y: 0 }, { x: 200, y: -100 }, 1000 / 60);
  assert.ok(v.x > 0 && v.x < 30 && v.y < 0 && v.y > -15);
  assert.deepEqual(iceVelocity({ x: 50, y: 5 }, { x: 0, y: 0 }, 0), { x: 50, y: 5 });
  let c = { x: 0, y: 0 };
  for (let k = 0; k < 300; k++) c = iceVelocity(c, { x: 200, y: 0 }, 16);
  assert.ok(c.x > 195 && c.x <= 200);
});

test('T72: puntos de control: piso 1 gratis y el descanso de cada jefe vencido', () => {
  assert.deepEqual(towerCheckpointOptions(0), [{ floor: 1, cost: 0 }]);
  assert.deepEqual(towerCheckpointOptions(9), [{ floor: 1, cost: 0 }]);
  const o = towerCheckpointOptions(34);
  assert.deepEqual(o.map((x) => x.floor), [1, 11, 21, 31]);
  assert.ok(o[1].cost > 0 && o[3].cost > o[1].cost);
});

test('T72: la sala 2x2 sale en la Torre y une sus 4 casillas', async () => {
  const { towerFloorSpec, towerFloor, towerPlayable } = await import('../src/level/tower.ts');
  let found = 0;
  for (let seed = 1; seed <= 4 && found === 0; seed++)
    for (let f = 1; f <= 100; f++) {
      const sp = towerFloorSpec(f, seed);
      if (sp.shape !== 'square') continue;
      found++;
      assert.equal(sp.cells.length, 4);
      assert.ok(towerPlayable(sp));
      const fl = towerFloor(sp, seed);
      assert.equal(fl.rooms.length, 4);
      assert.deepEqual(fl.groups, [[0, 1, 2, 3]]);
      assert.equal(fl.rooms[0].doors.right, 1);
      assert.equal(fl.rooms[0].doors.down, 2);
      assert.equal(fl.rooms[3].doors.up, 1);
      assert.equal(fl.rooms[3].doors.left, 2);
    }
  assert.ok(found > 0);
});
