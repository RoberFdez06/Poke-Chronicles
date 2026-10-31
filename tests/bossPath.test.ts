// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_AIM_RANGE, NAV_R_BIG, NAV_R_SMALL, aimUsable, attackUsable, buildNav, navField, navStep, pathDir, segmentClear,
  usableAttacks, type Box, type P,
} from '../src/data/bossPath.ts';
import { newMemo, tickStuck, unstickDir } from '../src/data/enemyAI.ts';

// Sala 2x2 de juguete con pilar macizo en el centro
const AREA = { x0: 0, y0: 0, x1: 1600, y1: 1000 };
const PILLAR: Box = { x: 700, y: 400, w: 200, h: 200 };

const hits = (p: P, r: number, rects: readonly Box[]) =>
  p.x < AREA.x0 + r || p.x > AREA.x1 - r || p.y < AREA.y0 + r || p.y > AREA.y1 - r ||
  rects.some((q) => p.x > q.x - r && p.x < q.x + q.w + r && p.y > q.y - r && p.y < q.y + q.h + r);

/** Mueve un cuerpo de radio r a 150 px/s; choca (se queda) si entra en un bloque, como el cuerpo físico. */
function run(start: P, player: P, r: number, rects: Box[], smart: boolean, ms = 8000) {
  const nav = buildNav(AREA, rects, r);
  const dist = navField(nav, player);
  const p = { ...start };
  const m = newMemo(p.x, p.y, 0);
  for (let t = 0; t < ms; t += 16) {
    if (Math.hypot(player.x - p.x, player.y - p.y) < r + 40) return { reached: true, t, p };
    let d = smart ? pathDir(p, player, rects, r, nav, dist) : (() => {
      const l = Math.hypot(player.x - p.x, player.y - p.y);
      return { x: (player.x - p.x) / l, y: (player.y - p.y) / l };
    })();
    if (smart && tickStuck(m, p.x, p.y, t, true)) d = unstickDir(d, m.unstickSide);
    const step = 150 * 0.016;
    const nx = { x: p.x + d.x * step, y: p.y };
    if (!hits(nx, r, rects)) p.x = nx.x;
    const ny = { x: p.x, y: p.y + d.y * step };
    if (!hits(ny, r, rects)) p.y = ny.y;
  }
  return { reached: false, t: ms, p };
}

test('el jefe rodea el pilar 2x2 cuando el jugador se esconde detrás (antes se quedaba empujando)', () => {
  const player = { x: 1000, y: 500 };
  const boss = { x: 560, y: 500 };
  assert.equal(run(boss, player, NAV_R_BIG, [PILLAR], false).reached, false, 'yendo recto se atasca');
  const smart = run(boss, player, NAV_R_BIG, [PILLAR], true);
  assert.ok(smart.reached, `rodeando llega (acabó en ${smart.p.x | 0},${smart.p.y | 0})`);
  assert.ok(smart.t < 5000);
});

test('enemigos normales también rodean el pilar y bloques sueltos', () => {
  const rocks: Box[] = [PILLAR, { x: 300, y: 200, w: 48, h: 400 }];
  for (const [s, pl] of [[{ x: 150, y: 400 }, { x: 1000, y: 500 }], [{ x: 800, y: 150 }, { x: 800, y: 850 }]] as [P, P][]) {
    assert.ok(run(s, pl, NAV_R_SMALL, rocks, true).reached);
  }
});

test('con camino directo libre va recto; bloqueado, el paso no apunta al pilar', () => {
  const nav = buildNav(AREA, [PILLAR], NAV_R_BIG);
  const dist = navField(nav, { x: 1000, y: 500 });
  const free = pathDir({ x: 200, y: 100 }, { x: 600, y: 100 }, [PILLAR], NAV_R_BIG, nav, dist);
  assert.ok(free.x > 0.99);
  const d = navStep(nav, dist, { x: 560, y: 500 })!;
  assert.ok(Math.abs(d.y) > 0.5, 'se va hacia arriba o abajo para rodear');
});

test('metido dentro de un bloque, el paso le saca a la casilla libre más cercana', () => {
  const nav = buildNav(AREA, [PILLAR], NAV_R_SMALL);
  const dist = navField(nav, { x: 100, y: 100 });
  const d = navStep(nav, dist, { x: 705, y: 500 })!;
  assert.ok(d.x < -0.7);
});

test('salas en L: el hueco de fuera cuenta como bloqueado', () => {
  const outside = (x: number, y: number) => x > 800 && y > 500;
  const nav = buildNav(AREA, [], NAV_R_SMALL, 32, outside);
  const dist = navField(nav, { x: 1200, y: 200 });
  assert.ok(dist[Math.floor(800 / 32) * nav.cols + Math.floor(1200 / 32)] === Infinity);
  assert.ok(dist[Math.floor(800 / 32) * nav.cols + Math.floor(200 / 32)] < Infinity);
});

test('segmentClear detecta el pilar en medio', () => {
  assert.equal(segmentClear({ x: 560, y: 500 }, { x: 1000, y: 500 }, [PILLAR]), false);
  assert.equal(segmentClear({ x: 560, y: 100 }, { x: 1000, y: 100 }, [PILLAR]), true);
  assert.equal(segmentClear({ x: 560, y: 380 }, { x: 1000, y: 380 }, [PILLAR], 30), false);
});

test('sin visión o fuera de alcance el jefe no lanza ataques apuntados (sí los de zona)', () => {
  for (const a of ['charge', 'fan', 'laser', 'lineDash', 'cross', 'sweep']) {
    assert.equal(attackUsable(a, false, 200), false, `${a} sin visión`);
    assert.equal(attackUsable(a, true, BOSS_AIM_RANGE + 50), false, `${a} lejos`);
    assert.equal(attackUsable(a, true, 300), true);
  }
  for (const a of ['rain', 'summon', 'meteor', 'ring', 'gridBeams', 'nova']) assert.equal(attackUsable(a, false, 900), true);
  assert.equal(attackUsable('shockwave', true, 900), false);
  assert.deepEqual(usableAttacks(['charge', 'fan'], false, 300), []);
  assert.deepEqual(usableAttacks(['charge', 'rain'], false, 300), ['rain']);
  assert.equal(aimUsable(false, 100), false);
  assert.equal(aimUsable(true, 100), true);
});

test('desatasco: un jefe empujando contra una pared sin avanzar empieza a rodear', () => {
  const m = newMemo(500, 500, 0);
  let stuck = false;
  for (let t = 0; t <= 1000; t += 16) stuck = tickStuck(m, 500, 500, t, true) || stuck;
  assert.ok(stuck);
});
