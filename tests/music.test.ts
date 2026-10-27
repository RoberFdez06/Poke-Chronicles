import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackForBiome, trackForMood } from '../src/data/music.ts';

test('música por situación: combate, jefe y jefe final cada vez más intensos; al acabar, la del bioma', () => {
  const calm = trackForMood('calm', 'bosque');
  const fight = trackForMood('combat', 'bosque');
  const boss = trackForMood('boss', 'bosque');
  const fin = trackForMood('final', 'bosque');
  assert.equal(calm, trackForBiome('bosque'));
  assert.ok(fight.bpm > calm.bpm && boss.bpm > fight.bpm && fin.bpm > boss.bpm);
  for (const t of [fight, boss, fin]) {
    assert.ok(t.drums && t.drums.length > 0);
    assert.ok(t.harmony && t.harmony.length > 0);
  }
  assert.ok(boss.arp && fin.arp);
});
