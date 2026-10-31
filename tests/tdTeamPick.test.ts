// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCursor, clampPanel, cursorOf, cycle, filterLabel, filterOptions, filterPicks, indexOf, itemsOnPage, jumpPage,
  moveCursor, movePanel, pageCount, sortPicks, turnPage, CLASS_COLOR, CLASS_ORDER, START_FOCUS, TRIAL_FOCUS, type PickLike,
} from '../src/data/towerDefense/teamPick.ts';
import { STYLE_LABEL, towerStyle } from '../src/data/towerDefense/towers.ts';

const G = { cols: 6, rows: 4 };
const mk = (i: number, types: string[], rarity: PickLike['rarity'] = 'common', bst = 300 + i, name = `P${i}`): PickLike => ({ id: 1000 + i, name, types, rarity, bst });
const list: PickLike[] = [
  mk(1, ['psychic'], 'legendary', 600, 'Mewtwo'),
  mk(2, ['fire'], 'rare', 500, 'Arcanine'),
  mk(3, ['bug', 'flying'], 'common', 300, 'Butterfree'),
  mk(4, ['water'], 'epic', 450, 'Lapras'),
  mk(5, ['electric'], 'common', 320, 'Pikachu'),
];

test('cada clase de torre tiene color y está en el orden de la leyenda', () => {
  for (const k of Object.keys(STYLE_LABEL)) {
    assert.ok(CLASS_ORDER.includes(k as never), k);
    assert.equal(typeof CLASS_COLOR[k as keyof typeof CLASS_COLOR], 'number');
  }
});

test('ordenar por poder, coste, nombre y clase sin tocar la original', () => {
  const copy = [...list];
  assert.deepEqual(sortPicks(list, 'poder').map((p) => p.name), ['Mewtwo', 'Arcanine', 'Lapras', 'Pikachu', 'Butterfree']);
  assert.deepEqual(sortPicks(list, 'coste').map((p) => p.name), ['Pikachu', 'Butterfree', 'Arcanine', 'Lapras', 'Mewtwo']);
  assert.deepEqual(sortPicks(list, 'nombre').map((p) => p.name), ['Arcanine', 'Butterfree', 'Lapras', 'Mewtwo', 'Pikachu']);
  const byClass = sortPicks(list, 'clase');
  assert.equal(towerStyle(byClass[0]), 'sniper');
  assert.deepEqual(list, copy);
});

test('filtros: clase, aéreo, tipo y mi equipo; las opciones solo salen si hay alguien', () => {
  const team = new Set([1002]);
  assert.deepEqual(filterPicks(list, 'equipo', team).map((p) => p.name), ['Arcanine']);
  assert.deepEqual(filterPicks(list, 'clase:sniper', team).map((p) => p.name), ['Mewtwo']);
  assert.deepEqual(filterPicks(list, 'tipo:flying', team).map((p) => p.name), ['Butterfree']);
  assert.ok(filterPicks(list, 'aereo', team).every((p) => p.name !== 'Arcanine'));
  const opts = filterOptions(list);
  assert.equal(opts[0], 'todos');
  assert.ok(opts.includes('equipo'));
  assert.ok(!opts.includes('clase:farm'));
  assert.ok(opts.includes('tipo:fire'));
  assert.equal(filterLabel('clase:rapid'), 'Ráfaga');
  assert.equal(filterLabel('aereo'), 'Aéreo');
  assert.equal(cycle(opts, 'todos', -1), opts[opts.length - 1]);
  assert.equal(cycle(opts, 'clase:farm', 1), 'todos');
});

test('paginación: 45 páginas y última incompleta', () => {
  assert.equal(pageCount(1080, G), 45);
  assert.equal(pageCount(0, G), 1);
  assert.equal(itemsOnPage(50, 2, G), 2);
  assert.deepEqual(cursorOf(30, G), { page: 1, idx: 6 });
  assert.equal(indexOf({ page: 1, idx: 6 }, G), 30);
});

test('mover por los bordes pasa de página conservando la fila', () => {
  const total = 60; // 3 páginas, la última con 12
  let r = moveCursor({ page: 0, idx: 11 }, 1, 0, total, G);
  assert.deepEqual(r, { cur: { page: 1, idx: 6 }, exit: 'none' });
  r = moveCursor({ page: 1, idx: 6 }, -1, 0, total, G);
  assert.deepEqual(r.cur, { page: 0, idx: 11 });
  // A la última página por la fila 3: no hay fila 3, cae en la última casilla
  r = moveCursor({ page: 1, idx: 23 }, 1, 0, total, G);
  assert.deepEqual(r.cur, { page: 2, idx: 11 });
  // En la primera página por la izquierda no se mueve
  assert.deepEqual(moveCursor({ page: 0, idx: 0 }, -1, 0, total, G), { cur: { page: 0, idx: 0 }, exit: 'none' });
  // Última página por la derecha: al panel del equipo
  assert.equal(moveCursor({ page: 2, idx: 5 }, 1, 0, total, G).exit, 'right');
  assert.equal(moveCursor({ page: 2, idx: 11 }, 1, 0, total, G).exit, 'right');
  // Arriba de la primera fila: a la barra de filtro
  assert.equal(moveCursor({ page: 1, idx: 3 }, 0, -1, total, G).exit, 'up');
  // Abajo sin fila siguiente: se queda
  assert.deepEqual(moveCursor({ page: 2, idx: 7 }, 0, 1, total, G).cur, { page: 2, idx: 7 });
  assert.deepEqual(moveCursor({ page: 2, idx: 3 }, 0, 1, total, G).cur, { page: 2, idx: 9 });
});

test('saltos de página: ±5 sin dar la vuelta, ±1 con vuelta', () => {
  const total = 1080;
  assert.deepEqual(jumpPage({ page: 2, idx: 7 }, 5, total, G), { page: 7, idx: 7 });
  assert.deepEqual(jumpPage({ page: 42, idx: 7 }, 5, total, G), { page: 44, idx: 7 });
  assert.deepEqual(jumpPage({ page: 3, idx: 7 }, -5, total, G), { page: 0, idx: 7 });
  assert.deepEqual(turnPage({ page: 44, idx: 0 }, 1, total, G), { page: 0, idx: 0 });
  assert.deepEqual(turnPage({ page: 0, idx: 0 }, -1, total, G), { page: 44, idx: 0 });
  assert.deepEqual(jumpPage({ page: 0, idx: 20 }, 5, 30, G), { page: 1, idx: 5 });
});

test('el cursor nunca se pierde (filtros que vacían o encogen la lista)', () => {
  assert.deepEqual(clampCursor({ page: 9, idx: 23 }, 0, G), { page: 0, idx: 0 });
  assert.deepEqual(clampCursor({ page: 9, idx: 23 }, 30, G), { page: 1, idx: 5 });
  assert.deepEqual(clampCursor({ page: NaN, idx: -3 }, 30, G), { page: 0, idx: 0 });
  for (let total = 0; total < 80; total += 7) {
    let c = { page: 0, idx: 0 };
    for (const [dx, dy] of [[1, 0], [1, 0], [0, 1], [-1, 0], [0, 1], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [0, -1], [-1, 0]]) {
      c = moveCursor(c, dx, dy, total, G).cur;
      const n = itemsOnPage(total, c.page, G);
      assert.ok(total === 0 ? c.idx === 0 : c.idx < n, `total ${total} ${JSON.stringify(c)}`);
    }
  }
});

test('panel del equipo: huecos, ¡A jugar! y vuelta a la rejilla', () => {
  assert.equal(movePanel(0, 1, 0, 6), 1);
  assert.equal(movePanel(0, -1, 0, 6), -1);
  assert.equal(movePanel(4, 0, 1, 6), START_FOCUS);
  assert.equal(movePanel(START_FOCUS, 0, 1, 6), TRIAL_FOCUS);
  assert.equal(movePanel(TRIAL_FOCUS, 0, -1, 6), START_FOCUS);
  assert.equal(movePanel(START_FOCUS, 0, -1, 3), 2);
  assert.equal(movePanel(START_FOCUS, 0, -1, 0), START_FOCUS);
  assert.equal(movePanel(1, 0, 1, 3), 2); // fila de abajo a medias
  assert.equal(movePanel(2, 1, 0, 3), 2);
  assert.equal(clampPanel(5, 3), 2);
  assert.equal(clampPanel(0, 0), START_FOCUS);
});
