// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCHETYPE, AMBUSH_MAX_HIDE_MS, IDLE_LIMIT_MS, flankDir, lineOfSight, newMemo, norm, rangedDir, separation, steer,
  tickIdle, tickRetreat, tickStuck, unstickDir, shouldFlinch, type V2,
} from '../src/data/enemyAI.ts';
import { BEHAVIORS, EXTRA_BEHAVIORS } from '../src/data/enemies.ts';
import { COLS, ROWS, flowField, stepToward, type Grid } from '../src/level/roomLayouts.ts';

const T = 48;
const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array(COLS).fill('.')) as Grid;
const blockedIn = (g: Grid) => (tx: number, ty: number) => g[ty]?.[tx] !== undefined && g[ty][tx] !== '.' && g[ty][tx] !== 'W';

/** Mini simulación: enemigos a 120 px/s hacia el jugador quieto, con campo de flujo, separación y desatasco. */
function simulate(g: Grid, player: V2, starts: V2[], ms: number) {
  const blocked = blockedIn(g);
  const [ptx, pty] = [Math.floor(player.x / T), Math.floor(player.y / T)];
  const dist = flowField(g, ptx, pty);
  const es = starts.map((p) => ({ ...p, m: newMemo(p.x, p.y, 0), idleMax: 0, idleAt: 0 }));
  const dt = 16;
  for (let t = 0; t < ms; t += dt) {
    for (const e of es) {
      const toP = norm({ x: player.x - e.x, y: player.y - e.y });
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      const tx = Math.floor(e.x / T), ty = Math.floor(e.y / T);
      let want = toP;
      const st = stepToward(dist, tx, ty);
      if (st && dist[ty][tx] > 1) want = norm({ x: (tx + st[0]) * T + T / 2 - e.x, y: (ty + st[1]) * T + T / 2 - e.y });
      if (tickStuck(e.m, e.x, e.y, t, d > 70)) want = unstickDir(want, e.m.unstickSide);
      const v = d > 60 ? steer(want, separation(e, es.filter((o) => o !== e))) : steer({ x: 0, y: 0 }, separation(e, es.filter((o) => o !== e)));
      const nx = e.x + v.x * 120 * dt / 1000, ny = e.y + v.y * 120 * dt / 1000;
      const ox = e.x, oy = e.y;
      if (!blocked(Math.floor(nx / T), Math.floor(e.y / T))) e.x = nx;
      if (!blocked(Math.floor(e.x / T), Math.floor(ny / T))) e.y = ny;
      const sp = Math.hypot(e.x - ox, e.y - oy) / (dt / 1000);
      if (sp < 12 && d > 80) { e.idleAt += dt; e.idleMax = Math.max(e.idleMax, e.idleAt); } else e.idleAt = 0;
    }
  }
  return es.map((e) => ({ x: e.x, y: e.y, d: Math.hypot(player.x - e.x, player.y - e.y), idleMax: e.idleMax }));
}

test('todo comportamiento tiene arquetipo', () => {
  for (const b of [...BEHAVIORS, ...EXTRA_BEHAVIORS]) assert.ok(ARCHETYPE[b], b);
});

test('con el jugador quieto, ninguno se queda inactivo y todos llegan cerca (sala con muro en medio)', () => {
  const g = emptyGrid();
  for (let y = 2; y < 10; y++) g[y][10] = 'R'; // muro vertical entre enemigos y jugador
  const res = simulate(g, { x: 16 * T, y: 6 * T }, [{ x: 3 * T, y: 6 * T }, { x: 3 * T + 4, y: 6 * T + 2 }, { x: 4 * T, y: 3 * T }], 10000);
  for (const r of res) {
    assert.ok(r.d < 140, `llega cerca: ${r.d.toFixed(0)}`);
    assert.ok(r.idleMax < 1000, `nunca parado más de 1 s: ${r.idleMax}`);
  }
});

test('desatasca contra un obstáculo en U sin campo de flujo útil', () => {
  const m = newMemo(100, 100, 0);
  assert.equal(tickStuck(m, 100, 100, 0, true), false);
  assert.equal(tickStuck(m, 102, 100, 800, true), true, 'tras 700 ms casi sin moverse, desatasca');
  const d = unstickDir({ x: 1, y: 0 }, m.unstickSide);
  assert.ok(Math.abs(d.y) > 0.8, 'rodea de lado');
});

test('se separan: cinco apilados en el mismo punto acaban repartidos', () => {
  const res = simulate(emptyGrid(), { x: 10 * T, y: 6 * T }, Array.from({ length: 5 }, () => ({ x: 3 * T, y: 6 * T })), 6000);
  for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) {
    assert.ok(Math.hypot(res[i].x - res[j].x, res[i].y - res[j].y) > 20, `separados ${i}-${j}`);
  }
});

test('separación: empuja lejos del vecino y nada si está lejos', () => {
  const s = separation({ x: 0, y: 0 }, [{ x: 10, y: 0 }]);
  assert.ok(s.x < 0);
  const z = separation({ x: 0, y: 0 }, [{ x: 500, y: 0 }]);
  assert.equal(z.x, 0);
});

test('vigilante: quieto más de IDLE_LIMIT_MS lejos del jugador obliga a moverse; telegrafiando no', () => {
  const m = newMemo(0, 0, 0);
  assert.equal(tickIdle(m, 0, 0, false, 300), false);
  assert.equal(tickIdle(m, 0, IDLE_LIMIT_MS + 1, false, 300), true);
  const m2 = newMemo(0, 0, 0);
  assert.equal(tickIdle(m2, 0, 0, true, 300), false);
  assert.equal(tickIdle(m2, 0, IDLE_LIMIT_MS + 1, true, 300), false);
});

test('tirador: sin visión se acerca; en su franja nunca está parado', () => {
  const to = { x: 1, y: 0 };
  const path = { x: 0, y: 1 };
  assert.deepEqual(rangedDir(to, 230, 230, 1, false, path), path);
  const v = rangedDir(to, 230, 230, 1, true, path);
  assert.ok(Math.hypot(v.x, v.y) > 0.99);
  const back = rangedDir(to, 100, 230, 1, true, path);
  assert.ok(back.x < 0, 'muy cerca se aleja');
});

test('línea de visión: la corta una roca', () => {
  const g = emptyGrid();
  g[5][5] = 'R';
  assert.equal(lineOfSight({ x: 2 * T, y: 5.5 * T }, { x: 8 * T, y: 5.5 * T }, T, blockedIn(g)), false);
  assert.equal(lineOfSight({ x: 2 * T, y: 2.5 * T }, { x: 8 * T, y: 2.5 * T }, T, blockedIn(g)), true);
});

test('retirada con poca vida: solo una vez cada rato y nunca jefes ni embestidores', () => {
  const m = newMemo(0, 0, 0);
  assert.equal(tickRetreat(m, 'acosador', 0.2, 0, false), true);
  assert.equal(tickRetreat(m, 'acosador', 0.2, 2000, false), false);
  assert.equal(tickRetreat(newMemo(0, 0, 0), 'embestidor', 0.1, 0, false), false);
  assert.equal(tickRetreat(newMemo(0, 0, 0), 'acosador', 0.1, 0, true), false);
});

test('flanqueo y duda: apunta a un punto alrededor y duda tras esquiva cercana', () => {
  const d = flankDir({ x: 0, y: 0 }, { x: 300, y: 0 }, 1, 4, 80);
  assert.ok(Math.hypot(d.x, d.y) > 0.99);
  assert.equal(shouldFlinch('acosador', 1000, 1020, 100), true);
  assert.equal(shouldFlinch('francotirador', 1000, 1020, 100), false);
  assert.ok(AMBUSH_MAX_HIDE_MS < 9000);
});
