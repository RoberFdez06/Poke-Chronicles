// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICE_MIN_MAX_HP, CHOICE_STORIES, canAfford, describeEffects, optionLabel, pickStory, resolveChoice, storyById } from '../src/level/choiceEvents.ts';
import { DAILY_EVENTS, ROOM_EVENTS, ROOM_EVENT_COLOR, ROOM_EVENT_DESC, ROOM_EVENT_LABEL, eventWeights } from '../src/level/roomEvents.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

test('T79: hay 10 historias válidas, con ids únicos y 2 o 3 opciones cuyas probabilidades suman 100', () => {
  assert.equal(CHOICE_STORIES.length, 10);
  assert.equal(new Set(CHOICE_STORIES.map((s) => s.id)).size, 10);
  for (const s of CHOICE_STORIES) {
    assert.ok(s.title && s.text, s.id);
    assert.ok(s.options.length >= 2 && s.options.length <= 3, s.id);
    for (const o of s.options) {
      assert.ok(o.label && o.outcomes.length > 0, `${s.id}: ${o.label}`);
      assert.equal(o.outcomes.reduce((a, x) => a + x.chance, 0), 100, `${s.id}: ${o.label}`);
      for (const x of o.outcomes) assert.ok(x.chance > 0 && x.text, `${s.id}: ${o.label}`);
      if (o.cost) assert.ok((o.cost.coins ?? 0) >= 0 && (o.cost.hp ?? 0) >= 0);
    }
    // Al menos una opción gratis: siempre se puede elegir algo
    assert.ok(s.options.some((o) => !o.cost), s.id);
    assert.equal(storyById(s.id), s);
  }
});

test('T79: nunca deja monedas ni PS en negativo, ni PS máximos por debajo del mínimo', () => {
  const states = [
    { coins: 0, hp: 1, maxHp: 30 },
    { coins: 3, hp: 5, maxHp: 34 },
    { coins: 15, hp: 16, maxHp: 100 },
    { coins: 999, hp: 100, maxHp: 100 },
  ];
  for (const s of CHOICE_STORIES)
    for (let k = 0; k < s.options.length; k++)
      for (const st of states)
        for (let i = 0; i < 50; i++) {
          const r = resolveChoice(s, k, () => i / 50, st);
          if (!canAfford(s.options[k], st)) {
            assert.equal(r, null);
            continue;
          }
          assert.ok(r);
          const e = r.effects;
          const maxHp = st.maxHp - (e.maxHpLoss ?? 0);
          assert.ok(st.coins + (e.coins ?? 0) >= 0, `${s.id} monedas`);
          assert.ok(st.hp + (e.hp ?? 0) >= 1, `${s.id} PS`);
          assert.ok(st.hp + (e.hp ?? 0) <= Math.max(st.hp, maxHp), `${s.id} PS por encima del máximo`);
          assert.ok(maxHp >= Math.min(st.maxHp, CHOICE_MIN_MAX_HP), `${s.id} PS máx.`);
        }
});

test('T79: las opciones de pago salen apagadas si no llegas y cobran el coste', () => {
  const herido = storyById('herido')!;
  const pobre = { coins: 0, hp: 10, maxHp: 100 };
  assert.equal(canAfford(herido.options[0], pobre), false); // 10 PS con 10 PS: te dejaría a 0
  assert.equal(canAfford(herido.options[1], pobre), false);
  assert.equal(canAfford(herido.options[2], pobre), true);
  assert.match(optionLabel(herido.options[1], pobre), /no te llega/);
  assert.equal(resolveChoice(herido, 1, () => 0, pobre), null);
  const r = resolveChoice(herido, 1, () => 0, { coins: 8, hp: 50, maxHp: 100 })!;
  assert.equal(r.effects.coins, 14 - 8);
  assert.equal(resolveChoice(herido, 7, () => 0, pobre), null);
});

test('T79: la tirada respeta las probabilidades', () => {
  const eco = storyById('eco')!;
  const st = { coins: 0, hp: 100, maxHp: 100 };
  assert.equal(resolveChoice(eco, 0, () => 0.49, st)!.effects.fight, 3);
  assert.equal(resolveChoice(eco, 0, () => 0.5, st)!.effects.coins, 12);
  const rng = mulberry32(7);
  let fights = 0;
  for (let i = 0; i < 4000; i++) if (resolveChoice(eco, 0, rng, st)!.effects.fight) fights++;
  assert.ok(Math.abs(fights / 4000 - 0.5) < 0.05);
});

test('T79: cada historia sale una sola vez por partida', () => {
  const seen: string[] = [];
  const rng = mulberry32(3);
  for (let i = 0; i < 10; i++) {
    const s = pickStory(seen, rng())!;
    assert.ok(s && !seen.includes(s.id));
    seen.push(s.id);
  }
  assert.equal(pickStory(seen, 0.5), null);
  assert.equal(pickStory([], 0.999999)?.id, CHOICE_STORIES[9].id);
});

test('T79: el evento existe en la sala sorpresa pero no en el desafío diario', () => {
  assert.ok(ROOM_EVENTS.includes('story'));
  assert.ok(!DAILY_EVENTS.includes('story'));
  assert.ok(ROOM_EVENT_LABEL.story && ROOM_EVENT_DESC.story && ROOM_EVENT_COLOR.story);
  for (const f of [2, 5, 12]) assert.ok(eventWeights(f).story > 0);
  assert.equal(describeEffects({ coins: 5, hp: -12, item: true }), '+5 monedas · −12 PS · un objeto');
});
