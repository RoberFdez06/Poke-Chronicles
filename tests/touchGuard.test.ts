// Seguro completo de dedos (rama `movil`): árbitro de joysticks, lista real de toques y cuándo soltar todo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostTouches, noFingersLeft, PRESS_TTL_MS, pressFresh, STALE_MS, StickArbiter } from '../src/data/touchPointers.ts';

const f = (id: number, side: 'move' | 'aim', t = 0, x = 10, y = 10) => ({ id, side, x, y, t });

test('ghostTouches: retenidos que no están ni en touches ni en changedTouches', () => {
  assert.deepEqual(ghostTouches([1, 2, null, 3], [2], [3]), [1]);
  assert.deepEqual(ghostTouches([1, 1], [], []), [1]);
  assert.deepEqual(ghostTouches([null], [], []), []);
  assert.deepEqual(ghostTouches([4, 5], [4, 5]), []);
});

test('noFingersLeft: solo al terminar o cancelar sin dedos', () => {
  assert.equal(noFingersLeft('touchend', 0), true);
  assert.equal(noFingersLeft('touchcancel', 0), true);
  assert.equal(noFingersLeft('touchend', 1), false);
  assert.equal(noFingersLeft('touchstart', 0), false);
  assert.equal(noFingersLeft('touchmove', 0), false);
});

test('dos sticks a la vez y un tercer dedo que espera y adopta al levantar el primero', () => {
  const a = new StickArbiter();
  assert.ok(a.down(f(1, 'move', 0)));
  assert.ok(a.down(f(2, 'aim', 10)));
  assert.equal(a.down(f(3, 'move', 20, 50, 60)), false);
  a.move(3, 70, 80, 30);
  const r = a.up(1);
  assert.equal(r?.side, 'move');
  assert.deepEqual([r?.adopt?.id, r?.adopt?.x, r?.adopt?.y], [3, 70, 80]);
  assert.equal(a.owner('move'), 3);
  assert.equal(a.owner('aim'), 2);
});

test('5 dedos: los que sobran esperan y se olvidan al levantarse', () => {
  const a = new StickArbiter();
  a.down(f(1, 'move'));
  a.down(f(2, 'aim'));
  for (const id of [3, 4, 5]) assert.equal(a.down(f(id, id % 2 ? 'move' : 'aim', 5)), false);
  for (const id of [3, 4, 5]) assert.equal(a.up(id), null);
  assert.equal(a.up(1)?.adopt, null);
  assert.deepEqual(a.tracked(), [2]);
});

test('touchcancel / pointercancel sueltan igual que up', () => {
  const a = new StickArbiter();
  a.down(f(7, 'aim'));
  assert.equal(a.up(7)?.side, 'aim');
  assert.equal(a.owner('aim'), null);
});

test('dedo perdido (sin touchend): sync con la lista real lo suelta y adopta al que espera', () => {
  const a = new StickArbiter();
  a.down(f(1, 'move'));
  a.down(f(2, 'move', 5, 30, 40));
  const rs = a.sync((id) => id === 2);
  assert.equal(rs.length, 1);
  assert.equal(rs[0].adopt?.id, 2);
  assert.equal(a.owner('move'), 2);
  // Y si se pierden todos, no queda nada
  assert.equal(a.sync(() => false).length, 1);
  assert.deepEqual(a.tracked(), []);
});

test('dedo perdido sin lista real: el siguiente toque se queda el stick pasado STALE_MS', () => {
  const a = new StickArbiter();
  a.down(f(1, 'move', 0));
  assert.equal(a.down(f(2, 'move', STALE_MS - 1)), false);
  a.up(2);
  assert.ok(a.down(f(3, 'move', STALE_MS)));
  assert.equal(a.owner('move'), 3);
  // El dedo viejo ya no manda: su move no mueve el stick
  assert.equal(a.move(1, 0, 0, STALE_MS + 5), null);
});

test('releaseAll (pausa, giro, foco perdido, cambio de escena): nadie adopta y nada queda vigilado', () => {
  const a = new StickArbiter();
  a.down(f(1, 'move'));
  a.down(f(2, 'aim'));
  a.down(f(3, 'move'));
  assert.deepEqual(a.releaseAll().sort(), ['aim', 'move']);
  assert.deepEqual(a.tracked(), []);
  assert.equal(a.up(3), null);
  // Tras reanudar, un toque nuevo funciona al momento
  assert.ok(a.down(f(4, 'move', 1)));
});

test('un mismo dedo no puede tener los dos sticks', () => {
  const a = new StickArbiter();
  a.down(f(1, 'move'));
  a.down(f(1, 'aim'));
  assert.equal(a.owner('move'), null);
  assert.equal(a.owner('aim'), 1);
});

test('secuencia larga aleatoria: nunca queda un stick con un dedo que no está en la pantalla', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const a = new StickArbiter();
  const down = new Set<number>();
  let next = 1;
  for (let step = 0; step < 5000; step++) {
    const t = step * 16;
    const r = rnd();
    if (r < 0.3 && down.size < 5) {
      const id = next++;
      down.add(id);
      a.down(f(id, rnd() < 0.5 ? 'move' : 'aim', t));
    } else if (r < 0.55 && down.size) {
      const id = [...down][Math.floor(rnd() * down.size)];
      down.delete(id);
      // 10 %: el navegador se come el touchend (la lista real ya no lo tiene)
      if (rnd() < 0.9) a.up(id);
    } else if (down.size) {
      const id = [...down][Math.floor(rnd() * down.size)];
      a.move(id, rnd() * 100, rnd() * 100, t);
    }
    // Cada evento táctil trae la lista real
    a.sync((id) => down.has(id));
    for (const id of a.tracked()) assert.ok(down.has(id), `paso ${step}: dedo ${id} retenido sin estar en la pantalla`);
  }
});

test('pressFresh: un toque de botón no recogido caduca (sin bombas ni pociones «fantasma» tras una transición)', () => {
  assert.equal(pressFresh(1000, 1000), true);
  assert.equal(pressFresh(1000, 1000 + PRESS_TTL_MS), true);
  assert.equal(pressFresh(1000, 1001 + PRESS_TTL_MS), false);
  assert.equal(pressFresh(1000, 5000), false);
  // Reloj de escena reiniciado (escena nueva): no cuenta
  assert.equal(pressFresh(1000, 10), false);
});
