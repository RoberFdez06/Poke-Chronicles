import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MULTIPLY_CHANCE, ONE_TYPE_OFF_MUL, ROOM_RULES, ROOM_RULE_COLOR, ROOM_RULE_LABEL, oneTypeFor, pickRoomRules, ruleChance,
  ruleDamageMul, ruleNotice, shouldMultiply, speedRoomBonus,
} from '../src/level/roomRules.ts';
import { ROOM_EVENT_COLOR } from '../src/level/roomEvents.ts';
import { generateFloor, mulberry32 } from '../src/level/floorGen.ts';

const floorFor = (seed: number) => generateFloor({ seed, roomCount: 11, special: true, extra: true });

test('cada regla tiene nombre en español y un color propio en el minimapa', () => {
  const eventColors = new Set(Object.values(ROOM_EVENT_COLOR));
  for (const r of ROOM_RULES) {
    assert.ok(ROOM_RULE_LABEL[r]);
    assert.ok(!eventColors.has(ROOM_RULE_COLOR[r]), r);
  }
});

test('probabilidad por piso: nada en el piso 1, sube con la profundidad y tiene tope', () => {
  assert.equal(ruleChance(1), 0);
  assert.ok(ruleChance(3) > ruleChance(2));
  assert.ok(ruleChance(50) <= 0.3);
});

test('solo en salas de combate (nunca jefe, tienda ni inicial), fuera de las excluidas y siempre igual con la misma semilla', () => {
  const seen = new Set<string>();
  let total = 0;
  for (let i = 0; i < 300; i++) {
    const f = floorFor(500 + i);
    const exclude = new Set([f.rooms.find((r) => r.kind === 'combat')!.id]);
    const rules = pickRoomRules(f, 5, mulberry32(i), exclude);
    for (const [id, rule] of rules) {
      const room = f.rooms[id];
      assert.equal(room.kind, 'combat');
      assert.ok(!exclude.has(id));
      seen.add(rule);
      total++;
    }
    assert.deepEqual([...pickRoomRules(f, 5, mulberry32(i), exclude)], [...rules]);
  }
  assert.ok(total > 0);
  assert.equal(seen.size, ROOM_RULES.length, 'salen las cuatro');
  // En el piso 1 no hay ninguna
  assert.equal(pickRoomRules(floorFor(1), 1, mulberry32(1)).size, 0);
});

test('un solo tipo: siempre uno de los del jugador; el resto hace la mitad', () => {
  assert.equal(oneTypeFor(['fire', 'flying'], 3), 'flying');
  assert.equal(oneTypeFor(['water'], 7), 'water');
  assert.equal(ruleDamageMul('oneType', 'fire', 'fire'), 1);
  assert.equal(ruleDamageMul('oneType', 'grass', 'fire'), ONE_TYPE_OFF_MUL);
  assert.equal(ruleDamageMul('oneType', undefined, 'normal'), 1);
  assert.equal(ruleDamageMul('dark', 'grass', 'fire'), 1);
  assert.equal(ruleDamageMul(undefined, 'grass', 'fire'), 1);
  assert.match(ruleNotice('oneType', 'Fuego'), /Fuego/);
});

test('se multiplican: más o menos uno de cada cuatro y nunca los especiales', () => {
  let n = 0;
  const rng = mulberry32(9);
  for (let i = 0; i < 4000; i++) if (shouldMultiply('multiply', false, rng)) n++;
  assert.ok(Math.abs(n / 4000 - MULTIPLY_CHANCE) < 0.03);
  assert.ok(!shouldMultiply('multiply', true, () => 0));
  assert.ok(!shouldMultiply('speed', false, () => 0));
});

test('velocidad: botín extra, con monedas solo si hay tienda', () => {
  assert.ok(speedRoomBonus(3, true).some((d) => d.kind === 'coin'));
  assert.ok(!speedRoomBonus(3, false).some((d) => d.kind === 'coin'));
  assert.ok(speedRoomBonus(3, false).length >= 2);
});

test('pisos de fantasma o siniestro: entre 1 y 4 salas a oscuras, solo en combate y fuera de las excluidas', async () => {
  const { DARK_MIN, DARK_MAX, isDarkBiome } = await import('../src/level/roomRules.ts');
  assert.ok(isDarkBiome(['ghost', 'psychic', 'dark']));
  assert.ok(isDarkBiome(['dark']));
  assert.ok(!isDarkBiome(['water', 'flying']));
  for (let i = 0; i < 400; i++) {
    const f = floorFor(900 + i);
    const exclude = new Set([f.rooms.find((r) => r.kind === 'combat')!.id]);
    for (const floorNum of [1, 3, 5, 9]) {
      const rules = pickRoomRules(f, floorNum, mulberry32(i), exclude, ['ghost', 'psychic', 'dark']);
      const dark = [...rules].filter(([, v]) => v === 'dark').map(([k]) => k);
      assert.ok(dark.length >= DARK_MIN && dark.length <= DARK_MAX, `semilla ${i}: ${dark.length}`);
      for (const id of dark) {
        assert.equal(f.rooms[id].kind, 'combat');
        assert.ok(!exclude.has(id));
      }
      assert.deepEqual([...pickRoomRules(f, floorNum, mulberry32(i), exclude, ['ghost'])], [...rules]);
    }
    // En el resto de biomas sale como siempre (igual que sin tipos)
    assert.deepEqual([...pickRoomRules(f, 5, mulberry32(i), exclude, ['water'])], [...pickRoomRules(f, 5, mulberry32(i), exclude)]);
  }
});
