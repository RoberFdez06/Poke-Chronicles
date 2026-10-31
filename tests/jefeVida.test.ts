import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_HELD_CAP, BOSS_PROTECT_MAX_MS, BOSS_STALL_MS, bossCellOrder, newBossGuard, noteBossHit, tickBossGuard } from '../src/data/bossSafety.ts';
import { CLEAR_CONFIRM_MS, FOE_STUCK_MS, roomWatch, stuckFoe } from '../src/data/roomClear.ts';
import { generateFloor, repairBossArena, type Floor } from '../src/level/floorGen.ts';
import { reserveSanctuaryRoom } from '../src/level/roomEvents.ts';

// --- Limpieza de sala ---

test('sala cerrada sin hostiles: se limpia tras confirmarlo un rato', () => {
  const base = { cleared: false, doorsLocked: true, hostile: 0, holdUntil: 0 };
  const a = roomWatch({ ...base, now: 1000, zeroSince: undefined });
  assert.equal(a.action, 'none');
  assert.equal(a.zeroSince, 1000);
  const b = roomWatch({ ...base, now: 1000 + CLEAR_CONFIRM_MS, zeroSince: a.zeroSince });
  assert.equal(b.action, 'clear');
});

test('con enemigos vivos, en espera de oleada o sin puertas cerradas no se limpia', () => {
  assert.equal(roomWatch({ cleared: false, doorsLocked: true, hostile: 1, now: 9999, holdUntil: 0, zeroSince: 0 }).action, 'none');
  assert.equal(roomWatch({ cleared: false, doorsLocked: true, hostile: 1, now: 9999, holdUntil: 0, zeroSince: 0 }).zeroSince, undefined);
  assert.equal(roomWatch({ cleared: false, doorsLocked: true, hostile: 0, now: 9999, holdUntil: 20000, zeroSince: 0 }).action, 'none');
  assert.equal(roomWatch({ cleared: false, doorsLocked: false, hostile: 0, now: 9999, holdUntil: 0, zeroSince: 0 }).action, 'none');
});

test('sala ya limpia con puertas cerradas: se abren', () => {
  assert.equal(roomWatch({ cleared: true, doorsLocked: true, hostile: 0, now: 5, holdUntil: 0, zeroSince: undefined }).action, 'unlock');
  assert.equal(roomWatch({ cleared: true, doorsLocked: true, hostile: 2, now: 5, holdUntil: 0, zeroSince: undefined }).action, 'none');
});

test('enemigo atascado fuera: se recoloca pasado FOE_STUCK_MS', () => {
  let s = stuckFoe(true, undefined, 100);
  assert.equal(s.relocate, false);
  s = stuckFoe(true, s.since, 100 + FOE_STUCK_MS);
  assert.equal(s.relocate, true);
  assert.deepEqual(stuckFoe(false, 50, 99999), { since: undefined, relocate: false });
});

// --- Vigilante de la vida del jefe ---

test('protección larga: se corta a BOSS_PROTECT_MAX_MS y el daño guardado se aplica con tope', () => {
  const g = newBossGuard();
  tickBossGuard(g, 0, 500, true, 1000);
  noteBossHit(g, 100, 500, 400, true, 1000);
  const mid = tickBossGuard(g, BOSS_PROTECT_MAX_MS - 1, 500, true, 1000);
  assert.equal(mid.release, false);
  const t = tickBossGuard(g, BOSS_PROTECT_MAX_MS, 500, true, 1000);
  assert.equal(t.release, true);
  assert.equal(t.hpAtMost, 500 - 1000 * BOSS_HELD_CAP);
});

test('al acabar la protección normal se aplica lo guardado', () => {
  const g = newBossGuard();
  tickBossGuard(g, 0, 500, true, 1000);
  noteBossHit(g, 100, 500, 50, true, 1000);
  const t = tickBossGuard(g, 300, 500, false, 1000);
  assert.equal(t.release, false);
  assert.equal(t.hpAtMost, 450);
});

test('le pegas y no baja (causa desconocida): pasado BOSS_STALL_MS se corta y baja', () => {
  const g = newBossGuard();
  for (let t = 0; t < BOSS_STALL_MS; t += 200) {
    noteBossHit(g, t, 500, 10, false, 1000);
    assert.equal(tickBossGuard(g, t, 500, false, 1000).release, false);
  }
  noteBossHit(g, BOSS_STALL_MS, 500, 10, false, 1000);
  const t = tickBossGuard(g, BOSS_STALL_MS, 500, false, 1000);
  assert.equal(t.release, true);
  assert.ok(t.hpAtMost !== undefined && t.hpAtMost < 500);
});

test('si la vida baja, o dejas de pegar, no hay atasco', () => {
  const g = newBossGuard();
  noteBossHit(g, 0, 500, 10, false, 1000);
  tickBossGuard(g, 100, 490, false, 1000);
  assert.equal(g.stallSince, undefined);
  noteBossHit(g, 200, 490, 10, false, 1000);
  tickBossGuard(g, 5000, 490, false, 1000);
  assert.equal(g.stallSince, undefined);
});

test('el daño guardado nunca mata', () => {
  const g = newBossGuard();
  tickBossGuard(g, 0, 20, true, 1000);
  noteBossHit(g, 10, 20, 999, true, 1000);
  assert.equal(tickBossGuard(g, 20, 20, false, 1000).hpAtMost, 1);
});

// --- Casilla del jefe ---

test('el jefe nunca sale en la casilla del jugador; primero la más lejana', () => {
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, x: (id % 3) * 100, y: Math.floor(id / 3) * 100 }));
  const order = bossCellOrder(cells, 0, { x: 0, y: 0 });
  assert.ok(!order.includes(0));
  assert.equal(order[0], 8);
  assert.equal(order.length, 8);
  assert.deepEqual(bossCellOrder([{ id: 3, x: 0, y: 0 }], 3, { x: 0, y: 0 }), [3]);
});

// --- Arena del jefe: un solo grupo ---

const bossGroupOk = (f: Floor) => {
  const bosses = f.rooms.filter((r) => r.kind === 'boss');
  if (bosses.length <= 1) return true;
  const g = bosses[0].group;
  return g !== undefined && bosses.every((r) => r.group === g) && f.groups?.[g]?.length === bosses.length;
};

test('el santuario nunca deshace la arena del jefe (muchas semillas)', () => {
  for (let seed = 1; seed <= 400; seed++) {
    for (const layout of [1, 2, 3, 4]) {
      let f: Floor;
      try {
        f = generateFloor({ seed, roomCount: 6 + (seed % 6), special: layout >= 2, extra: layout >= 3, big: layout >= 4, bossArena: true });
      } catch {
        continue;
      }
      const r = reserveSanctuaryRoom(f);
      assert.ok(bossGroupOk(r), `semilla ${seed} layout ${layout}`);
      assert.ok(r.rooms.filter((x) => x.kind === 'boss').length >= 4, `semilla ${seed}: arena de 4 a 9`);
    }
  }
});

test('repairBossArena vuelve a unir casillas de jefe sueltas', () => {
  const f = generateFloor({ seed: 7, roomCount: 8, bossArena: true });
  const broken: Floor = { ...f, rooms: f.rooms.map((r) => (r.kind === 'boss' ? (({ group: _g, ...rest }) => rest)(r) : r)), groups: (f.groups ?? []).filter((g) => !g.some((id) => f.rooms[id].kind === 'boss')) };
  assert.equal(bossGroupOk(broken), false);
  const fixed = repairBossArena(broken);
  assert.ok(bossGroupOk(fixed));
  assert.equal(repairBossArena(f), f);
});
