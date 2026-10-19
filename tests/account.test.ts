// Ejecutar con `npm test`. Cuentas (T45): almacenamiento intercambiable y validación del formulario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameData, hasProgress, MemoryStorage, pickInitialData, SyncedStorage, DEV_LOCAL_FLAG } from '../src/data/storage.ts';
import { accountErrorMessage, checkEmail, checkName, checkPassword, firebaseConfigFrom, retryDelay } from '../src/data/account.ts';

test('MemoryStorage guarda, lee y borra', () => {
  const m = new MemoryStorage({ 'pokeisaac.a': '1' });
  assert.equal(m.getItem('pokeisaac.a'), '1');
  m.setItem('pokeisaac.b', '2');
  m.removeItem('pokeisaac.a');
  assert.deepEqual(m.snapshot(), { 'pokeisaac.b': '2' });
  assert.equal(m.getItem('nada'), null);
});

test('SyncedStorage avisa solo cuando cambia algo', () => {
  const calls: Record<string, string>[] = [];
  const s = new SyncedStorage({}, (d) => calls.push(d));
  s.setItem('pokeisaac.x', '1');
  s.setItem('pokeisaac.x', '1'); // igual: no avisa
  s.removeItem('pokeisaac.y'); // no existe: no avisa
  s.removeItem('pokeisaac.x');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { 'pokeisaac.x': '1' });
  assert.deepEqual(calls[1], {});
});

test('gameData solo coge las claves del juego y no la bandera de pruebas', () => {
  const entries: [string, string][] = [['pokeisaac.a', '1'], ['otra', '2'], [DEV_LOCAL_FLAG, '1'], ['pokeisaac.vacia', '']];
  const store = { length: entries.length, key: (i: number) => entries[i]?.[0] ?? null, getItem: (k: string) => entries.find((e) => e[0] === k)?.[1] ?? null };
  assert.deepEqual(gameData(store), { 'pokeisaac.a': '1' });
});

test('hasProgress ignora volumen, teclas y tutorial', () => {
  assert.equal(hasProgress(null), false);
  assert.equal(hasProgress({ 'pokeisaac.audio': '{}', 'pokeisaac.keys': '{}', 'pokeisaac.tutorial': '{}' }), false);
  assert.equal(hasProgress({ 'pokeisaac.unlocked': '{}' }), true);
});

test('pickInitialData: nube con progreso > invitado > navegador > vacío', () => {
  const cloud = { 'pokeisaac.unlocked': 'nube' };
  const guest = { 'pokeisaac.unlocked': 'invitado' };
  const legacy = { 'pokeisaac.unlocked': 'viejo' };
  assert.equal(pickInitialData(cloud, guest, legacy).imported, 'cloud');
  assert.equal(pickInitialData({ 'pokeisaac.audio': 'a' }, guest, legacy).data['pokeisaac.unlocked'], 'invitado');
  assert.equal(pickInitialData(null, null, legacy).imported, 'legacy');
  assert.deepEqual(pickInitialData(null, null, null), { data: {}, imported: 'empty' });
  // Los ajustes de la nube se conservan al subir lo de invitado
  assert.equal(pickInitialData({ 'pokeisaac.audio': 'a' }, guest, null).data['pokeisaac.audio'], 'a');
});

test('firebaseConfigFrom necesita las cuatro claves básicas', () => {
  const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' };
  assert.equal(firebaseConfigFrom(env)?.projectId, 'p');
  assert.equal(firebaseConfigFrom({ ...env, VITE_FIREBASE_APP_ID: ' ' }), null);
  assert.equal(firebaseConfigFrom({}), null);
});

test('validación del formulario y mensajes en español', () => {
  assert.equal(checkEmail('ash@kanto.com'), null);
  assert.ok(checkEmail('ash@kanto'));
  assert.equal(checkPassword('123456'), null);
  assert.ok(checkPassword('12345'));
  assert.equal(checkName(''), null);
  assert.equal(checkName('Rojo-1'), null);
  assert.ok(checkName('<script>'));
  assert.ok(checkName('x'.repeat(21)));
  assert.equal(accountErrorMessage({ code: 'auth/invalid-credential' }), 'Correo o contraseña incorrectos');
  assert.match(accountErrorMessage(new Error('?')), /inténtalo otra vez/);
});

test('retryDelay crece y se queda en 60 s', () => {
  assert.equal(retryDelay(0), 2000);
  assert.equal(retryDelay(2), 8000);
  assert.equal(retryDelay(20), 60_000);
});
