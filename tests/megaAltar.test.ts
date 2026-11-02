import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardianReward, MEGA_DESCENT_HEIGHT, MEGA_DESCENT_MS, megaAltarMode, megaDescentFrame, megaGuardianBeatenKey } from '../src/level/megaAltar.ts';


test('guardián vivo: el altar está vacío aunque ya lleves la piedra', () => {
  assert.equal(megaAltarMode({ taken: false, guardianBeaten: false, have: false }), 'guarded');
  assert.equal(megaAltarMode({ taken: false, guardianBeaten: false, have: true }), 'guarded');
});

test('guardián vencido y piedra sin coger: la piedra está sobre el altar (al volver o al cargar)', () => {
  assert.equal(megaAltarMode({ taken: false, guardianBeaten: true, have: false }), 'stone');
});

test('cogida, o ya la llevabas: altar apagado (nunca dos piedras)', () => {
  assert.equal(megaAltarMode({ taken: true, guardianBeaten: true, have: true }), 'off');
  assert.equal(megaAltarMode({ taken: true, guardianBeaten: false, have: false }), 'off');
  assert.equal(megaAltarMode({ taken: false, guardianBeaten: true, have: true }), 'off');
});

test('premio del guardián: piedra si no la llevas, objeto si ya la llevas', () => {
  assert.equal(guardianReward(false), 'stone');
  assert.equal(guardianReward(true), 'item');
});

test('las marcas de «vencido» no chocan con las de «cogida» ni con ids de sala', () => {
  for (const id of [0, 1, 50, 999]) {
    assert.notEqual(megaGuardianBeatenKey(id), (100000 + id));
    assert.ok(megaGuardianBeatenKey(id) > 1000);
  }
  });

test('la bajada: haz primero, la piedra cae desde arriba y se posa con destello', () => {
  const a = megaDescentFrame(0);
  assert.equal(a.stone, 0);
  assert.equal(a.dy, -MEGA_DESCENT_HEIGHT);
  const mid = megaDescentFrame(MEGA_DESCENT_MS * 0.5);
  assert.equal(mid.beam, 1);
  assert.ok(mid.dy < 0 && mid.dy > -MEGA_DESCENT_HEIGHT);
  const end = megaDescentFrame(MEGA_DESCENT_MS);
  assert.equal(end.dy, 0);
  assert.equal(end.stone, 1);
  assert.ok(end.done);
  assert.ok(megaDescentFrame(MEGA_DESCENT_MS * 0.82).flash > 0);
  let prev = -Infinity;
  for (let ms = 0; ms <= MEGA_DESCENT_MS; ms += 50) {
    const f = megaDescentFrame(ms);
    assert.ok(f.dy >= prev, 'la piedra nunca vuelve a subir');
    prev = f.dy;
  }
});
