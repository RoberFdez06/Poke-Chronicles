import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { adminAllowed, adminHashFrom, clearCheatRun, godStats, isAdminEmail, isCheatRun, markCheatRun, setAdminAccount, setGodMode, isGodMode, sha256Hex, stepValue } from '../src/data/admin.ts';
import { addCandies, addRunHistory, addTickets, earnMedal, loadCandies, loadMedals, loadRecords, loadRunHistory, loadTickets, loadUnlocked, recordMission, submitRecord, unlockPokemon, HISTORY_KEY, RECORDS_KEY } from '../src/data/save.ts';
import { ADMIN_BACKUP_KEY, hasAdminBackup, restoreProgress, unlockEverything } from '../src/data/adminUnlock.ts';
import { MemoryStorage } from '../src/data/storage.ts';
import type { RunRecord } from '../src/data/runHistory.ts';

const EMAIL = 'Dev@Example.com';
const HASH = createHash('sha256').update('dev@example.com').digest('hex');

test('sha256Hex coincide con node:crypto', async () => {
  assert.equal(await sha256Hex('dev@example.com'), HASH);
});

test('el correo se compara en minúsculas y sin espacios', async () => {
  assert.equal(await isAdminEmail(EMAIL, HASH), true);
  assert.equal(await isAdminEmail('  dev@example.com ', HASH), true);
  assert.equal(await isAdminEmail('otro@example.com', HASH), false);
  assert.equal(await isAdminEmail(undefined, HASH), false);
  assert.equal(await isAdminEmail('', HASH), false);
});

test('sin variable (o con una mala) nadie es admin', async () => {
  assert.equal(adminHashFrom(undefined), null);
  assert.equal(adminHashFrom({}), null);
  assert.equal(adminHashFrom({ VITE_ADMIN_EMAIL_SHA256: '' }), null);
  assert.equal(adminHashFrom({ VITE_ADMIN_EMAIL_SHA256: 'dev@example.com' }), null);
  assert.equal(adminHashFrom({ VITE_ADMIN_EMAIL_SHA256: ` ${HASH.toUpperCase()} ` }), HASH);
  assert.equal(await isAdminEmail(EMAIL, null), false);
  // En los tests no hay import.meta.env: la constante queda vacía
  assert.equal(await isAdminEmail(EMAIL), false);
});

test('el panel solo con dev o con la cuenta admin', () => {
  setAdminAccount(false);
  assert.equal(adminAllowed(false), false);
  assert.equal(adminAllowed(true), true);
  setAdminAccount(true);
  assert.equal(adminAllowed(false), true);
  setAdminAccount(false);
});

const run = (): RunRecord => ({ endedAt: 1, starterId: 4, starterName: 'Charmander', mode: 'normal', floor: 3, won: false, seconds: 10, kills: 1, damage: 1, items: [], tickets: 5, newRecord: false }) as RunRecord;

test('una partida admin no escribe récords, tickets, caramelos, medallas, misiones, desbloqueos ni historial', () => {
  const s = new MemoryStorage();
  markCheatRun();
  try {
    assert.equal(isCheatRun(), true);
    assert.equal(submitRecord('normal', 9, s), false);
    assert.equal(s.getItem(RECORDS_KEY), null);
    assert.equal(loadRecords(s).normal, 0);
    addTickets(50, s);
    addCandies(50, s);
    assert.equal(loadTickets(s), 0);
    assert.equal(loadCandies(s), 0);
    assert.equal(earnMedal('bosque', s).gained, undefined);
    assert.deepEqual(loadMedals(s), []);
    assert.deepEqual(recordMission({ kind: 'boss' }, 1, s), []);
    unlockPokemon(25, s);
    assert.deepEqual(loadUnlocked(s), []);
    addRunHistory(run(), s);
    assert.equal(s.getItem(HISTORY_KEY), null);
    assert.deepEqual(loadRunHistory(s), []);
  } finally {
    clearCheatRun();
  }
  // Sin trucos vuelve a contar
  assert.equal(submitRecord('normal', 9, s), true);
  assert.equal(addTickets(5, s), 5);
});

test('modo dios: marca la partida, se olvida al volver al menú y sube las estadísticas', () => {
  setGodMode(true);
  assert.equal(isGodMode(), true);
  assert.equal(isCheatRun(), true);
  clearCheatRun();
  assert.equal(isGodMode(), false);
  const g = godStats({ damage: 9, fireDelay: 340, speed: 200, maxHp: 30, shotSpeed: 520, range: 600 });
  assert.ok(g.damage >= 9999 && g.maxHp >= 9999 && g.fireDelay <= 60 && g.speed > 200);
});

test('desbloquear todo hace copia y se puede restaurar', () => {
  const s = new MemoryStorage();
  unlockPokemon(4, s);
  addTickets(7, s);
  unlockEverything(s, [1, 2, 3, 4, 25]);
  assert.deepEqual(loadUnlocked(s), [1, 2, 3, 4, 25]);
  assert.ok(loadTickets(s) > 1000);
  assert.equal(hasAdminBackup(s), true);
  // Una segunda vez no pisa la copia buena
  unlockEverything(s, [1, 2]);
  assert.equal(restoreProgress(s), true);
  assert.deepEqual(loadUnlocked(s), [4]);
  assert.equal(loadTickets(s), 7);
  assert.equal(hasAdminBackup(s), false);
  assert.equal(s.getItem(ADMIN_BACKUP_KEY) ?? '', '');
  assert.equal(restoreProgress(s), false);
});

test('stepValue da la vuelta', () => {
  assert.equal(stepValue(1, -1, 1, 10), 10);
  assert.equal(stepValue(10, 1, 1, 10), 1);
  assert.equal(stepValue(5, 10, 1, 10), 5);
});
