// Ejecutar con `npm test`. Controles de la defensa de torres y la salida de escena al reiniciar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HoldRepeat, TD_KEYS, TD_PAD, cycle, stepCursor, tdHelp, tdKeyLabel, type TdDevice } from '../src/data/towerDefense/controls.ts';
import { CONTROL_MODES, TD_CONTROLS, TD_CONTROL_ACTIONS, TD_CONTROL_ACTION_LABEL } from '../src/data/controls.ts';
import { goTo } from '../src/ui/theme.ts';

test('el cursor no se sale del mapa', () => {
  assert.deepEqual(stepCursor({ x: 0, y: 0 }, -1, -1, 16, 11), { x: 0, y: 0 });
  assert.deepEqual(stepCursor({ x: 15, y: 10 }, 1, 1, 16, 11), { x: 15, y: 10 });
  assert.deepEqual(stepCursor({ x: 3, y: 4 }, 1, 0, 16, 11), { x: 4, y: 4 });
});

test('cycle da la vuelta en los dos sentidos', () => {
  assert.equal(cycle(0, -1, 4), 3);
  assert.equal(cycle(3, 1, 4), 0);
  assert.equal(cycle(1, 1, 4), 2);
  assert.equal(cycle(0, 1, 0), 0);
});

test('mantener una dirección: un paso al momento, espera y luego repite', () => {
  const r = new HoldRepeat(200, 50);
  assert.deepEqual(r.update(1, 0, 16), { dx: 1, dy: 0 });
  assert.deepEqual(r.update(1, 0, 100), { dx: 0, dy: 0 });
  assert.deepEqual(r.update(1, 0, 100), { dx: 1, dy: 0 }); // 200 ms
  assert.deepEqual(r.update(1, 0, 30), { dx: 0, dy: 0 });
  assert.deepEqual(r.update(1, 0, 30), { dx: 1, dy: 0 }); // 260 ms
  // Cambiar de dirección o soltar empieza de nuevo
  assert.deepEqual(r.update(0, 1, 16), { dx: 0, dy: 1 });
  assert.deepEqual(r.update(0, 0, 16), { dx: 0, dy: 0 });
  assert.deepEqual(r.update(0, 1, 16), { dx: 0, dy: 1 });
});

test('la barra de ayuda cambia con el dispositivo y con lo elegido', () => {
  const devs: TdDevice[] = ['keyboard', 'mouse', 'gamepad', 'touch'];
  const placing = { kind: 'placing', name: 'Pikachu', cost: 50, canPlace: true } as const;
  for (const d of devs) {
    const idle = tdHelp(d, { kind: 'idle' });
    const pl = tdHelp(d, placing);
    const tw = tdHelp(d, { kind: 'tower', actions: 3 });
    assert.equal(idle.length, 2);
    assert.notDeepEqual(idle, pl, d);
    assert.notDeepEqual(pl, tw, d);
    assert.match(pl.join(' '), /Pikachu \(50 \$\)/);
  }
  assert.match(tdHelp('keyboard', { kind: 'tower', actions: 3 })[0], /^1 2 3:/);
  assert.match(tdHelp('gamepad', placing)[0], /^A: colocar/);
  assert.match(tdHelp('mouse', placing)[1], /Clic derecho: cancelar/);
  // El mando no habla de teclas ni el teclado de botones del mando
  assert.doesNotMatch(tdHelp('gamepad', { kind: 'idle' }).join(' '), /Enter|Esc|WASD/);
  assert.doesNotMatch(tdHelp('keyboard', { kind: 'idle' }).join(' '), /LB|RT|Start/);
});

test('los botones enseñan su tecla: la del teclado en PC, la del mando con mando y nada en táctil', () => {
  assert.equal(tdKeyLabel('rayo', 'keyboard'), 'Z');
  assert.equal(tdKeyLabel('rayo', 'mouse'), 'Z');
  assert.equal(tdKeyLabel('rayo', 'gamepad'), 'LT');
  assert.equal(tdKeyLabel('rayo', 'touch'), '');
  // Ninguna tecla o botón repetido
  assert.equal(new Set(Object.values(TD_KEYS)).size, Object.keys(TD_KEYS).length);
  assert.equal(new Set(Object.values(TD_PAD)).size, Object.keys(TD_PAD).length);
});

test('la pantalla de Controles (TD_CONTROLS) va con las mismas teclas que la partida', () => {
  for (const m of CONTROL_MODES) {
    assert.deepEqual(Object.keys(TD_CONTROLS[m]).sort(), [...TD_CONTROL_ACTIONS].sort(), m);
    for (const a of TD_CONTROL_ACTIONS) assert.ok(TD_CONTROLS[m][a].trim(), `${m}.${a}`);
  }
  for (const a of TD_CONTROL_ACTIONS) assert.ok(TD_CONTROL_ACTION_LABEL[a]);
  // Caben en la pantalla de Controles (14 filas)
  assert.ok(TD_CONTROL_ACTIONS.length <= 14);
  const kb = Object.values(TD_CONTROLS.keyboard).join(' ');
  for (const v of Object.values(TD_KEYS)) assert.ok(kb.includes(v), `falta ${v} en Teclado`);
  const pad = Object.values(TD_CONTROLS.gamepad).join(' ');
  for (const v of Object.values(TD_PAD)) assert.ok(pad.includes(v), `falta ${v} en Mando`);
});

/** Escena falsa con lo que usa goTo: datos, eventos y el gestor de escenas. */
function fakeScene() {
  const data = new Map<string, unknown>();
  const once = new Map<string, () => void>();
  const started: string[] = [];
  const scene = {
    data: { get: (k: string) => data.get(k), set: (k: string, v: unknown) => data.set(k, v) },
    events: { once: (ev: string, f: () => void) => once.set(ev, f) },
    cameras: { main: null },
    scene: { isPaused: () => false, start: (k: string) => started.push(k) },
  };
  // Lo que hace Phaser al reiniciar: avisa del cierre; los datos de la escena se quedan
  const shutdown = () => {
    const f = once.get('shutdown');
    once.delete('shutdown');
    f?.();
  };
  return { scene: scene as unknown as Parameters<typeof goTo>[0], started, shutdown };
}

test('una escena que se reinicia a sí misma puede volver a salir (Reiniciar nivel dos veces)', () => {
  const f = fakeScene();
  assert.equal(goTo(f.scene, 'TowerDefense'), true);
  // Mientras se va, no se lanza otro cambio
  assert.equal(goTo(f.scene, 'TowerDefense'), false);
  f.shutdown();
  // Sin pasar por fadeIn (p. ej. una escena que no lo llama), la marca ya no bloquea
  assert.equal(goTo(f.scene, 'TowerDefense'), true);
  assert.deepEqual(f.started, ['TowerDefense', 'TowerDefense']);
});
