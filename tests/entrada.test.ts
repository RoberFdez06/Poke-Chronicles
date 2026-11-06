import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IME_KEY, KEY_ALT, KEY_SHIFT, emptyKeys, isHeld, stepKeys, stuckKeys, type KeyEvt, type KeyHold } from '../src/data/keyHold.ts';
import { ARM_MS, DOUBLE_MS, hitPad, judgeDown, padHit, pickHit, rectDist, shouldReHover, type DownInfo } from '../src/data/menuPointer.ts';

const W = 87, D = 68, M = 91;
const NO = { shift: false, ctrl: false, alt: false, meta: false };
const run = (evs: KeyEvt[], s: KeyHold = emptyKeys()) => evs.reduce(stepKeys, s);

test('teclado: pulsar y soltar, varias teclas a la vez', () => {
  let s = run([{ type: 'down', key: W, phys: 'KeyW', t: 0 }, { type: 'down', key: D, phys: 'KeyD', t: 10 }]);
  assert.ok(isHeld(s, W) && isHeld(s, D));
  s = stepKeys(s, { type: 'up', key: D, phys: 'KeyD' });
  assert.ok(isHeld(s, W), 'W sigue pulsada aunque el navegador ya no la repita');
  assert.ok(!isHeld(s, D));
});

test('teclado: blur / pestaña oculta / pagehide sueltan todo', () => {
  const s = run([{ type: 'down', key: W, t: 0 }, { type: 'down', key: D, t: 0 }, { type: 'blur' }]);
  assert.equal(s.held.size, 0);
});

test('teclado: la tecla física se suelta aunque suba con otro código (IME, AltGr)', () => {
  let s = run([{ type: 'down', key: W, phys: 'KeyW', t: 0 }]);
  s = stepKeys(s, { type: 'up', key: IME_KEY, phys: 'KeyW' });
  assert.ok(!isHeld(s, W));
  assert.ok(!isHeld(run([{ type: 'down', key: IME_KEY, t: 0 }]), IME_KEY), 'el 229 no es una tecla');
});

test('teclado: soltar Cmd suelta las demás (macOS se traga sus keyup)', () => {
  const s = run([{ type: 'down', key: M, t: 0 }, { type: 'down', key: W, t: 1 }, { type: 'up', key: M }]);
  assert.equal(s.held.size, 0);
});

test('teclado: Alt de un Alt+Tab o Mayús soltada fuera se corrigen con el estado real', () => {
  let s = run([{ type: 'down', key: KEY_ALT, t: 0, mods: { ...NO, alt: true } }, { type: 'down', key: KEY_SHIFT, t: 0, mods: { ...NO, alt: true, shift: true } }]);
  assert.ok(isHeld(s, KEY_ALT) && isHeld(s, KEY_SHIFT));
  s = stepKeys(s, { type: 'mods', mods: { ...NO, shift: true } });
  assert.ok(!isHeld(s, KEY_ALT) && isHeld(s, KEY_SHIFT));
  s = stepKeys(s, { type: 'down', key: W, t: 5, mods: NO });
  assert.ok(!isHeld(s, KEY_SHIFT) && isHeld(s, W));
});

test('teclado: stuckKeys suelta solo lo que el juego cree pulsado y no lo está', () => {
  const s = run([{ type: 'down', key: W, t: 0 }]);
  const game = [{ keyCode: W, isDown: true }, { keyCode: D, isDown: true }, { keyCode: 65, isDown: false }];
  assert.deepEqual(stuckKeys(s, game), [D]);
  assert.deepEqual(stuckKeys(emptyKeys(), game), [W, D], 'tras perder el foco se sueltan todas');
});

test('ratón: margen de la zona de clic', () => {
  assert.equal(hitPad(300, 54), 14);
  assert.equal(hitPad(30, 30), 8);
  assert.equal(hitPad(10, 10), 6);
  assert.equal(hitPad(0, 20), 0);
  const r = { x: 0, y: 0, w: 100, h: 40 };
  assert.equal(padHit(r, 50, 20, 10), 'exact');
  assert.equal(padHit(r, 105, 20, 10), 'pad');
  assert.equal(padHit(r, 115, 20, 10), null);
  assert.equal(rectDist(r, 103, 44), 5);
});

test('ratón: quién se queda el clic', () => {
  // Fila de abajo (margen) encima de la de arriba (de lleno): gana la tocada de lleno
  assert.equal(pickHit([{ exact: false, button: true, dist: 3 }, { exact: true, button: true, dist: 0 }]), 1);
  // Margen de un botón de un diálogo encima de su fondo: gana el botón
  assert.equal(pickHit([{ exact: false, button: true, dist: 4 }, { exact: true, button: false, dist: 0 }]), 0);
  // Fondo de un diálogo encima de un botón de debajo: sigue tapándolo
  assert.equal(pickHit([{ exact: true, button: false, dist: 0 }, { exact: true, button: true, dist: 0 }]), 0);
  // En el hueco entre dos filas, la más cercana
  assert.equal(pickHit([{ exact: false, button: true, dist: 9 }, { exact: false, button: true, dist: 2 }]), 1);
});

test('ratón: clic fiable', () => {
  const d: DownInfo = { t: 1000, scene: 'Menu', target: 1, button: 0, clicks: 1, sceneAge: 5000, touch: false };
  assert.equal(judgeDown(d, null), 'ok');
  assert.equal(judgeDown({ ...d, button: 2 }, null), 'button');
  assert.equal(judgeDown({ ...d, button: 2, scene: 'TowerDefenseMenu' }, null), 'ok');
  assert.equal(judgeDown({ ...d, button: 1 }, null), 'button');
  assert.equal(judgeDown({ ...d, sceneAge: ARM_MS - 1 }, null), 'early');
  // Segundo clic de un doble clic sobre lo que abrió el primero (otra escena u otro botón): no cuenta
  const last = { t: 1000 - 100, scene: 'Menu', target: 7 };
  assert.equal(judgeDown({ ...d, clicks: 2 }, last), 'double');
  assert.equal(judgeDown({ ...d, clicks: 2 }, { ...last, scene: 'Mode', target: 1 }), 'double');
  // Clics rápidos en el mismo botón (+/−) sí cuentan
  assert.equal(judgeDown({ ...d, clicks: 2 }, { ...last, target: 1 }), 'ok');
  assert.equal(judgeDown({ ...d, clicks: 2 }, { ...last, t: 1000 - DOUBLE_MS - 1 }), 'ok');
  // El táctil no pasa por aquí
  assert.equal(judgeDown({ ...d, touch: true, button: 2, sceneAge: 0 }, null), 'ok');
});

test('ratón: hover = selección tras usar teclado o mando', () => {
  assert.ok(shouldReHover(true, true, false));
  assert.ok(!shouldReHover(false, true, false));
  assert.ok(!shouldReHover(true, false, false));
  assert.ok(!shouldReHover(true, true, true));
});
