// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PAIR_KEYS, applyFusion, fusableSlots, fusePowers, fusionBlock, fusionCooldown, fusionParts, fusionPower, FUSION_CD_CAP, FUSION_POWER_CAP,
  FUSION_TYPES, isFusionTag, moveHasType, NAMED_RECIPES, powerTypes, recipeFor, styleSignature,
} from '../src/data/fusion.ts';
import { toMovePower, type MovePower } from '../src/data/items.ts';
import { parseRun, RUN_VERSION } from '../src/data/runSave.ts';

const mv = (id: number, name: string, type: string, power: number): MovePower => toMovePower({ id, name, type, power });

test('hay 171 parejas sin orden (153 de tipos distintos + 18 del mismo)', () => {
  assert.equal(FUSION_TYPES.length, 18);
  assert.equal(ALL_PAIR_KEYS.length, 171);
  assert.equal(new Set(ALL_PAIR_KEYS).size, 171);
});

test('recetas: simétricas, sin vacías, cubren las 18×18 y entre 40 y 70 con nombre propio', () => {
  const n = Object.keys(NAMED_RECIPES).length;
  assert.ok(n >= 40 && n <= 70, `recetas con nombre: ${n}`);
  for (const a of FUSION_TYPES) {
    for (const b of FUSION_TYPES) {
      const ab = recipeFor(a, b, a);
      const ba = recipeFor(b, a, a);
      assert.ok(ab.recipe.name.trim().length > 0, `${a}+${b} sin nombre`);
      assert.equal(ab.recipe.name, ba.recipe.name, `${a}+${b} no es simétrica`);
      assert.equal(styleSignature(ab.recipe.style), styleSignature(ba.recipe.style));
      if (a === b) assert.equal(ab.recipe.kind, 'superior');
    }
  }
  assert.equal(recipeFor('fire', 'water').recipe.name, 'Vapor Ardiente');
  assert.equal(recipeFor('ground', 'grass').recipe.name, 'Raíz Sísmica');
  assert.equal(recipeFor('water', 'electric').recipe.name, 'Descarga Marina');
  assert.equal(recipeFor('ice', 'fire').recipe.name, 'Choque Térmico');
});

test('cada pareja tiene un estilo único (171 firmas distintas, ninguna por defecto)', () => {
  const sigs = new Set<string>();
  const triples = new Set<string>();
  for (const k of ALL_PAIR_KEYS) {
    const [a, b] = k.split('+');
    const st = recipeFor(a, b, a).recipe.style;
    sigs.add(styleSignature(st));
    triples.add(`${st.trail}|${st.impact}|${st.motion}`);
  }
  assert.equal(sigs.size, 171);
  // Ni siquiera estela + impacto + movimiento se repiten
  assert.equal(triples.size, 171);
  // Las parejas sin nombre propio también tienen nombre propio de su pareja (no un genérico repetido)
  const compound = ALL_PAIR_KEYS.filter((k) => { const [a, b] = k.split('+'); return a !== b && !NAMED_RECIPES[k]; })
    .map((k) => { const [a, b] = k.split('+'); return recipeFor(a, b, a).recipe.name; });
  assert.equal(new Set(compound).size, compound.length);
});

test('daño ≈1,6× el más fuerte con tope; Superior 1,5×; nunca menos que el más fuerte', () => {
  assert.equal(fusionPower(80, 40), 128);
  assert.equal(fusionPower(60, 60, true), 90);
  assert.equal(fusionPower(200, 10), FUSION_POWER_CAP);
  assert.equal(fusionPower(250, 10), 250);
});

test('recarga nunca más barata que la mayor y con tope', () => {
  assert.equal(fusionCooldown(2000, 3000), 3450);
  assert.ok(fusionCooldown(9000, 100) <= FUSION_CD_CAP && fusionCooldown(9000, 100) >= 9000);
  assert.equal(fusionCooldown(12000, 1), 12000);
});

test('fusionar: resultado en la primera ranura, la otra libre, dos tipos y partes con ambos', () => {
  const slots = [mv(52, 'ascuas', 'fire', 40), mv(55, 'pistola-agua', 'water', 90), null, null];
  const r = applyFusion(slots, 0, 1, 2, 0)!;
  assert.ok(r);
  assert.equal(r.slots[1], null);
  const f = r.slots[0]!;
  assert.equal(f.name, 'Vapor Ardiente');
  assert.equal(f.type, 'water'); // manda el más potente
  assert.deepEqual(f.fusion!.types, ['water', 'fire']);
  assert.equal(f.power, 144);
  assert.ok(f.id < 0);
  const parts = fusionParts(f);
  assert.deepEqual(parts.map((p) => p.type), ['water', 'fire']);
  assert.ok(moveHasType(f, 'fire') && moveHasType(f, 'water'));
  assert.deepEqual(powerTypes(r.slots), ['water', 'fire']);
});

test('Superior: mismo tipo, más potencia y nombre del más fuerte', () => {
  const f = fusePowers(mv(52, 'ascuas', 'fire', 40), mv(53, 'lanzallamas', 'fire', 90));
  assert.equal(f.name, 'Lanzallamas Superior');
  assert.equal(f.power, 135);
  assert.equal(fusionParts(f).length, 2);
});

test('reglas: una por piso, no fusionar fusionados, ranuras vacías y la misma', () => {
  const slots = [mv(1, 'a', 'fire', 40), mv(2, 'b', 'water', 40), mv(3, 'c', 'grass', 40), null];
  assert.match(fusionBlock(slots, 0, 1, 3, 3)!, /este piso/);
  assert.equal(fusionBlock(slots, 0, 1, 3, 3, true), null);
  assert.equal(fusionBlock(slots, 0, 1, 3, 2), null);
  assert.ok(fusionBlock(slots, 0, 0, 3, 0));
  assert.ok(fusionBlock(slots, 0, 3, 3, 0));
  const once = applyFusion(slots, 0, 1, 3, 0)!.slots;
  assert.match(fusionBlock(once, 0, 2, 4, 3)!, /fusionado/);
  assert.equal(applyFusion(once, 2, 0, 4, 3), null);
  assert.deepEqual(fusableSlots(once), []);
  assert.deepEqual(fusableSlots(slots), [0, 1, 2]);
});

test('guardado: v30 conserva los poderes fusionados y el piso de la fusión; v29 migra', () => {
  assert.equal(RUN_VERSION, 30);
  const f = fusePowers(mv(1, 'a', 'fire', 60), mv(2, 'b', 'ice', 50));
  assert.ok(isFusionTag(f.fusion));
  assert.ok(!isFusionTag({ recipe: 'x', types: ['fire', 'nada'], from: ['a', 'b'] }));
  const base = JSON.parse(minimalRun());
  const v30 = parseRun(JSON.stringify({ ...base, version: 30, slots: [f, null, null, null], fusionFloor: 2 }));
  assert.ok(v30);
  assert.equal(v30!.fusionFloor, 2);
  assert.equal(v30!.slots[0]!.fusion!.recipe, f.fusion!.recipe);
  const v29 = parseRun(JSON.stringify({ ...base, version: 29 }));
  assert.equal(v29?.fusionFloor, 0);
  assert.equal(parseRun(JSON.stringify({ ...base, version: 30, slots: [{ ...f, fusion: { recipe: 1 } }], fusionFloor: 0 })), null);
});

/** Guardado mínimo válido de v29 (el de tests/runSave.test.ts). */
function minimalRun(): string {
  const move = { id: 1, name: 'pound', type: 'normal', power: 40, shape: 'bolt', cooldown: 920 };
  return JSON.stringify({
    version: 29, savedAt: 1700000000000, starterId: 4, formId: 5, starterName: 'charmander', mode: 'normal', floor: 2, bossHistory: [144, 150],
    floorSeed: 1234, roomCount: 10, bossId: 150, roomId: 3, visited: [0, 3], cleared: [0], hp: 80, maxHp: 120, passives: ['lupa'],
    slots: [move, null, null, null], nextSlotReplace: 0, movePool: [move], floorItems: [], earned: 15, coins: 7, centerUsed: true, shop: [],
    layout: 3, keys: 1, bombs: 2, openedChests: [4], revealedDoors: ['3:up'], active: null, healed: false,
    counters: { seconds: 125.5, kills: 14, damage: 900, newRecord: false }, daily: null, difficulty: 'hard', eventsDone: [5], hpSacrificed: 12,
    eggLeft: 1, allyId: 16, tiredRooms: 0, potions: 2, secondChance: false, captureDone: false, capturePrevAlly: -1, slotSpins: [], fishCasts: [],
    bossesBeaten: 1, powerForm: { active: null, leftMs: 0, used: false }, powerMeter: 0, zUsed: false, reactionsFound: [], storiesSeen: ['mochila'],
    route: null, routesTaken: [], seeded: { seed: 123456, fromCode: true }, gardenBerries: [],
    legendHunt: { active: true, floors: [2, 4, 5], kinds: ['huella', 'ruido', 'pluma'], found: 1, lost: false, legendId: 150, done: false },
    itemLevels: { lupa: 2 }, teraPick: 'fire', dark: true,
  });
}

test('fusión al recoger un 5.º poder: 4 sueltos, 3 fusiones + 1 suelto, reemplazo con aviso y todo fusionado', async () => {
  const { canFuseOnPickup, applyPickupFusion, pickupFusionBlock, replaceLosesFusion, NEW_POWER_INDEX } = await import('../src/data/fusion.ts');
  const mv = (id: number, type: string, power = 60) => ({ id, name: `m${id}`, type, power, shape: 'orb', cooldown: 1000 }) as never;
  const four = [mv(1, 'fire'), mv(2, 'water'), mv(3, 'grass'), mv(4, 'ice')];
  const nu = mv(5, 'rock');
  // Con hueco no se ofrece (se recoge sin más)
  assert.equal(canFuseOnPickup([four[0], null, four[2], four[3]], nu), false);
  // 4 sueltos + nuevo
  assert.ok(canFuseOnPickup(four, nu));
  const a = applyPickupFusion(four, nu, 0, 1)!;
  assert.ok(a.slots[0]!.fusion);
  assert.equal(a.newAt, 1);
  assert.equal((a.slots[1] as { id: number }).id, 5);
  const b = applyPickupFusion(four, nu, 2, NEW_POWER_INDEX)!;
  assert.equal(b.at, 2);
  assert.equal(b.newAt, -1);
  assert.ok(b.slots[2]!.fusion);
  // 3 fusiones + 1 suelto + nuevo: se fusiona el suelto con el nuevo; las fusiones no se re-fusionan
  const f = fusePowers(mv(7, 'dark'), mv(8, 'bug'));
  const three = [f, f, mv(9, 'fairy'), f];
  assert.ok(canFuseOnPickup(three, nu));
  assert.match(pickupFusionBlock(three, nu, 0, NEW_POWER_INDEX)!, /fusionado/);
  const c = applyPickupFusion(three, nu, 2, NEW_POWER_INDEX)!;
  assert.equal(c.slots.filter((m) => m?.fusion).length, 4);
  // Reemplazar una ranura con fusión avisa; una suelta no
  assert.ok(replaceLosesFusion(three, 0));
  assert.ok(!replaceLosesFusion(three, 2));
  // Todo fusionado + nuevo: solo reemplazo (con aviso)
  const all = [f, f, f, f];
  assert.equal(canFuseOnPickup(all, nu), false);
  assert.ok(replaceLosesFusion(all, 3));
  assert.equal(applyPickupFusion(four, nu, 1, 1), null);
});
