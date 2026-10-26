// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADE_KINDS, UPGRADE_MAX, levelsFor, noUpgrades, parseUpgrades, upgradeCost } from '../src/data/upgrades.ts';
import { BRANCHES, UPGRADE_TREE, moveInTree, nodeState, remainingTreeCost, treeNode } from '../src/data/upgradeTree.ts';
import { addCandies, buyUpgrade, loadCandies, loadUpgrades, UPGRADES_KEY, type StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('cada mejora es un nodo del árbol, con padres válidos y un final caro por rama', () => {
  assert.equal(UPGRADE_TREE.length, UPGRADE_KINDS.length);
  for (const k of UPGRADE_KINDS) assert.ok(treeNode(k), k);
  for (const n of UPGRADE_TREE) {
    if (n.parent) {
      const p = treeNode(n.parent);
      assert.equal(p.branch, n.branch);
      assert.equal(p.depth, n.depth - 1);
    } else assert.equal(n.depth, 0);
  }
  for (const b of BRANCHES) {
    const finals = UPGRADE_TREE.filter((n) => n.branch === b && n.final);
    assert.equal(finals.length, 1, b);
    assert.ok((upgradeCost(0, finals[0].kind) ?? 0) >= 80, 'los finales son caros');
  }
});

test('requisitos: raíz disponible, hijo bloqueado hasta comprar el padre y máximo', () => {
  const lv = noUpgrades();
  assert.equal(nodeState('damage', lv), 'available');
  assert.equal(nodeState('rate', lv), 'locked');
  assert.equal(nodeState('rate', { ...lv, damage: 1 }), 'available');
  assert.equal(nodeState('bulwark', { ...lv, regen: 1 }), 'available');
  assert.equal(nodeState('bulwark', { ...lv, regen: 1, bulwark: 1 }), 'max');
  // Lo ya comprado nunca se bloquea aunque falte el padre (guardados antiguos)
  assert.equal(nodeState('crit', { ...lv, crit: 2 }), 'available');
});

test('costes: los de siempre no cambian y al máximo no hay coste', () => {
  assert.equal(upgradeCost(0, 'damage'), 15);
  assert.equal(upgradeCost(4, 'armor'), 75);
  for (const k of UPGRADE_KINDS) assert.equal(upgradeCost(UPGRADE_MAX[k], k), null);
  assert.equal(remainingTreeCost(Object.fromEntries(UPGRADE_KINDS.map((k) => [k, UPGRADE_MAX[k]])) as never), 0);
  assert.ok(remainingTreeCost(noUpgrades()) > remainingTreeCost({ ...noUpgrades(), damage: 3 }));
});

test('migración: el guardado viejo se lee igual, sin perder niveles ni gastar caramelos', () => {
  const st = fakeStorage();
  st.setItem(UPGRADES_KEY, JSON.stringify({ 25: { damage: 3, hp: 0, speed: 5, rate: 0, range: 0, crit: 2, armor: 1 } }));
  addCandies(100, st);
  const lv = levelsFor(loadUpgrades(st), 25);
  assert.deepEqual(lv, { ...noUpgrades(), damage: 3, speed: 5, crit: 2, armor: 1 });
  assert.equal(loadCandies(st), 100);
  assert.deepEqual(parseUpgrades('{"1":{"fortune":9,"magnet":2}}')[1], { ...noUpgrades(), fortune: 1, magnet: 2 });
});

test('comprar respeta el árbol', () => {
  const st = fakeStorage();
  addCandies(1000, st);
  assert.equal(buyUpgrade(1, 'coins', st), 'locked');
  assert.equal(loadCandies(st), 1000);
  assert.equal(buyUpgrade(1, 'magnet', st), 'ok');
  assert.equal(buyUpgrade(1, 'coins', st), 'ok');
  assert.equal(loadCandies(st), 1000 - 10 - 20);
});

test('navegación con flechas por ramas y filas', () => {
  assert.equal(moveInTree('damage', 0, 1), 'rate');
  assert.equal(moveInTree('damage', 1, 0), 'hp');
  assert.equal(moveInTree('damage', -1, 0), 'speed');
  assert.equal(moveInTree('critPower', 1, 0), 'bulwark');
  assert.equal(moveInTree('bulwark', 1, 0), 'fortune'); // la rama de botín es más corta: se queda en su último nodo
  assert.equal(moveInTree('damage', 0, -1), 'damage');
});
