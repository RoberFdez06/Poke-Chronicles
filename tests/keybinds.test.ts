import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, bindKey, controlsFor, DEFAULT_KEYS, isValidKey, keyLabel, parseKeys } from '../src/data/keybinds.ts';
import { loadKeys, PROGRESS_KEYS, saveKeys, KEYS_KEY, type StorageLike } from '../src/data/save.ts';

test('las teclas por defecto son las de siempre y no se repiten', () => {
  assert.equal(DEFAULT_KEYS.up, 'W');
  assert.equal(DEFAULT_KEYS.shootLeft, 'LEFT');
  assert.equal(DEFAULT_KEYS.bomb, 'E');
  assert.equal(new Set(Object.values(DEFAULT_KEYS)).size, ACTIONS.length);
  for (const k of Object.values(DEFAULT_KEYS)) assert.ok(isValidKey(k), k);
});

test('cambiar una tecla; si ya la usa otra acción, avisa y no cambia', () => {
  const r = bindKey(DEFAULT_KEYS, 'bomb', 'Q');
  assert.ok(r.ok);
  assert.equal(r.ok && r.keys.bomb, 'Q');
  assert.equal(DEFAULT_KEYS.bomb, 'E'); // no toca el original
  const c = bindKey(DEFAULT_KEYS, 'bomb', 'W');
  assert.deepEqual(c, { ok: false, conflict: 'up' });
  // Volver a poner la suya no es conflicto
  assert.ok(bindKey(DEFAULT_KEYS, 'up', 'W').ok);
});

test('parseKeys: lo que no valga se queda por defecto y nunca quedan repetidas', () => {
  assert.deepEqual(parseKeys(null), DEFAULT_KEYS);
  assert.deepEqual(parseKeys('{roto'), DEFAULT_KEYS);
  const k = parseKeys(JSON.stringify({ bomb: 'Q', up: 'nada', power1: 'F1' }));
  assert.equal(k.bomb, 'Q');
  assert.equal(k.up, 'W');
  assert.equal(k.power1, 'F1');
  // Dos acciones con la misma tecla: vuelve a lo de por defecto
  assert.deepEqual(parseKeys(JSON.stringify({ bomb: 'W' })), DEFAULT_KEYS);
});

test('nombres en pantalla y texto de controles con las teclas actuales', () => {
  assert.equal(keyLabel('UP'), '↑');
  assert.equal(keyLabel('SPACE'), 'Espacio');
  assert.equal(keyLabel('THREE'), '3');
  assert.equal(keyLabel('NUMPAD_ONE'), 'Num 1');
  assert.equal(keyLabel('Q'), 'Q');
  const r = bindKey(DEFAULT_KEYS, 'bomb', 'Q');
  const text = controlsFor(r.ok ? r.keys : DEFAULT_KEYS).map(([a, b]) => `${a} ${b}`).join('\n');
  assert.match(text, /Bomba: Q/);
  assert.match(text, /W A S D/);
});

test('se guardan aparte del progreso (como el volumen)', () => {
  const data = new Map<string, string>();
  const st: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  saveKeys({ ...DEFAULT_KEYS, bomb: 'Q' }, st);
  assert.equal(loadKeys(st).bomb, 'Q');
  assert.equal(PROGRESS_KEYS.includes(KEYS_KEY), false);
});

test('T49: usar poción tiene su tecla (C) y sale en los controles', async () => {
  const { DEFAULT_KEYS, ACTIONS, ACTION_LABEL, controlsFor } = await import('../src/data/keybinds.ts');
  assert.ok(ACTIONS.includes('potion'));
  assert.equal(DEFAULT_KEYS.potion, 'C');
  assert.equal(ACTION_LABEL.potion, 'Usar poción');
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([, how]) => how.includes('Poción: C')));
  // La pantalla de teclas (KeysScene) tiene dos columnas de 12 filas
  assert.ok(ACTIONS.length <= 24);
});

test('T53: el parry tiene su tecla (F), sale en los controles y va detrás de las de antes', () => {
  assert.equal(DEFAULT_KEYS.parry, 'F');
  assert.ok(ACTIONS.indexOf('parry') > ACTIONS.indexOf('back'));
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([what, how]) => what === 'Parry' && how.includes('F') && how.includes('RT')));
});

test('T53: un guardado de antes con la F en otra acción no pierde sus teclas', () => {
  const k = parseKeys(JSON.stringify({ ...DEFAULT_KEYS, parry: undefined, bomb: 'F' }));
  assert.equal(k.bomb, 'F');
  assert.notEqual(k.parry, 'F');
  assert.equal(new Set(Object.values(k)).size, ACTIONS.length);
  // El resto se queda como estaba
  assert.equal(k.up, 'W');
  assert.equal(k.potion, 'C');
});

test('T65: la Poké Ball tiene su tecla (G), va detrás del parry y sale en los controles', () => {
  assert.equal(DEFAULT_KEYS.ball, 'G');
  assert.ok(ACTIONS.indexOf('ball') > ACTIONS.indexOf('parry'));
  // La pantalla de teclas (KeysScene) tiene dos columnas de 12 filas
  assert.ok(ACTIONS.length <= 24);
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([what, how]) => what === 'Poké Ball' && how.includes('G') && how.includes('R3')));
  // Un guardado de antes con la G en otra acción no pierde sus teclas
  const k = parseKeys(JSON.stringify({ ...DEFAULT_KEYS, ball: undefined, bomb: 'G' }));
  assert.equal(k.bomb, 'G');
  assert.notEqual(k.ball, 'G');
  assert.equal(new Set(Object.values(k)).size, ACTIONS.length);
});

test('T74: megaevolucionar tiene su tecla (M), va justo antes de la de carga y sale en los controles', () => {
  assert.equal(DEFAULT_KEYS.mega, 'M');
  assert.equal(ACTIONS.indexOf('mega'), ACTIONS.indexOf('charge') - 1);
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([what, how]) => what === 'Megaevolución' && how.includes('M') && how.includes('cruceta')));
  // Un guardado de antes con la M en otra acción no pierde sus teclas
  const k = parseKeys(JSON.stringify({ ...DEFAULT_KEYS, mega: undefined, bomb: 'M' }));
  assert.equal(k.bomb, 'M');
  assert.notEqual(k.mega, 'M');
  assert.equal(new Set(Object.values(k)).size, ACTIONS.length);
});

test('T77: el ataque cargado tiene su tecla (V), es la última acción y sale en los controles', () => {
  assert.equal(DEFAULT_KEYS.charge, 'V');
  assert.equal(ACTIONS.indexOf('charge'), ACTIONS.length - 2);
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([n]) => n === 'Ataque cargado'));
});

test('Formas de poder: cambiar de forma tiene su tecla (X), es la última acción y sale en los controles', () => {
  assert.equal(DEFAULT_KEYS.powerNext, 'X');
  assert.equal(ACTIONS[ACTIONS.length - 1], 'powerNext');
  assert.ok(controlsFor({ ...DEFAULT_KEYS }).some(([what, how]) => what.includes('Tera') && how.includes('X') && how.includes('cruceta izquierda')));
  // Un guardado de antes con la X en otra acción no pierde sus teclas
  const k = parseKeys(JSON.stringify({ ...DEFAULT_KEYS, powerNext: undefined, bomb: 'X' }));
  assert.equal(k.bomb, 'X');
  assert.notEqual(k.powerNext, 'X');
  assert.equal(new Set(Object.values(k)).size, ACTIONS.length);
});
