// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_EVENTS,
  EVENT_CHANCE,
  type RoomEventKind,
  MERCHANT_PRICES,
  ROOM_EVENTS,
  ROOM_EVENT_COLOR,
  ROOM_EVENT_LABEL,
  TRAP_CHANCE,
  altarCost,
  canUseAltar,
  merchantStock,
  pickRoomEvent,
  runawayTickets,
  trapChestOutcome,
  megaStoneDoneKey,
  pickMegaStoneRoom,
  planMegaStoneRoom,
  reserveSanctuaryRoom,
  isPlainCombatRoom,
} from '../src/level/roomEvents.ts';
import { generateFloor, mulberry32, addBigRooms, type Floor } from '../src/level/floorGen.ts';
import { pickRoomRules } from '../src/level/roomRules.ts';
import { PASSIVE_ITEMS } from '../src/data/items.ts';

const floorFor = (seed: number) => generateFloor({ seed, roomCount: 11, special: true, extra: true });

test('cada evento tiene nombre en español y color en el minimapa', () => {
  for (const k of ROOM_EVENTS) {
    assert.ok(ROOM_EVENT_LABEL[k]);
    assert.equal(typeof ROOM_EVENT_COLOR[k], 'number');
  }
});

test('sala sorpresa: a veces, nunca en el piso 1, en una sala de combate libre y siempre la misma con la misma semilla', () => {
  let some = 0;
  const kinds = new Set<string>();
  const n = 600;
  for (let i = 0; i < n; i++) {
    const f = floorFor(1000 + i);
    const exclude = new Set([f.rooms.find((r) => r.kind === 'combat')!.id]);
    const ev = pickRoomEvent(f, 3, mulberry32(i), exclude);
    if (!ev) continue;
    some++;
    kinds.add(ev.kind);
    const room = f.rooms[ev.roomId];
    assert.equal(room.kind, 'combat');
    assert.ok(!exclude.has(ev.roomId));
    assert.ok(!(f.chestRooms ?? []).includes(ev.roomId));
    assert.deepEqual(pickRoomEvent(f, 3, mulberry32(i), exclude), ev);
  }
  assert.ok(Math.abs(some / n - EVENT_CHANCE) < 0.06, `${some / n}`);
  // Salen todos menos el santuario de la Mega Piedra, que tiene su propia sala fija
  assert.equal(kinds.size, ROOM_EVENTS.length - 1);
  assert.ok(!kinds.has('megaStone'));
  for (let i = 0; i < 40; i++) assert.equal(pickRoomEvent(floorFor(i), 1, mulberry32(i)), null);
  // Sin salas de combate libres, nada
  const f = floorFor(7);
  const all = new Set(f.rooms.map((r) => r.id));
  assert.equal(pickRoomEvent(f, 4, () => 0, all), null);
});

test('mercader: tres artículos sin pociones, con sus precios, sin repetir pasivos', () => {
  const moves = [{ id: 1, name: 'ascuas', type: 'fire', power: 40, shape: 'bolt' as const, cooldown: 900 }];
  for (let s = 0; s < 50; s++) {
    const pool = [...moves];
    const stock = merchantStock(mulberry32(s), new Set(), pool);
    assert.deepEqual(stock.map((x) => x.price), [...MERCHANT_PRICES]);
    assert.ok(stock.every((x) => !x.sold && x.goods.kind !== 'potion'));
    const ids = stock.flatMap((x) => (x.goods.kind === 'passive' ? [x.goods.id] : []));
    assert.equal(new Set(ids).size, ids.length);
    // El poder vendido sale de la bolsa
    if (stock.some((x) => x.goods.kind === 'move')) assert.equal(pool.length, 0);
  }
  // Evita los que ya tienes
  const owned = new Set(PASSIVE_ITEMS.slice(1).map((i) => i.id));
  const only = merchantStock(mulberry32(3), owned, []);
  assert.ok(only.some((x) => x.goods.kind === 'passive' && x.goods.id === PASSIVE_ITEMS[0].id));
});

test('altar, cofre trampa y premio del Pokémon raro', () => {
  assert.equal(altarCost(100), 15);
  assert.equal(altarCost(20), 5);
  assert.ok(canUseAltar(100));
  assert.ok(!canUseAltar(34));
  const rng = mulberry32(11);
  let monsters = 0;
  for (let i = 0; i < 2000; i++) if (trapChestOutcome(rng) === 'monster') monsters++;
  assert.ok(Math.abs(monsters / 2000 - TRAP_CHANCE) < 0.04);
  assert.ok(runawayTickets(4) > runawayTickets(2));
  assert.equal(runawayTickets(0), 4);
});

// --- T48 ---
import {
  EGG_ROOMS,
  ROOM_EVENT_DESC,
  TIME_TRIAL_SECONDS,
  eggHatch,
  eggTick,
  eventWeights,
  fountainHeal,
  fountainPrice,
  pickEventKind,
  rivalBonus,
  rivalWaveSize,
  timeTrialExtra,
  timeTrialSize,
} from '../src/level/roomEvents.ts';

test('T48: los eventos tienen nombre, descripción (premio y riesgo) y color distinto', () => {
  assert.equal(ROOM_EVENTS.length, 14);
  for (const k of ROOM_EVENTS) assert.ok(ROOM_EVENT_DESC[k], k);
  assert.equal(new Set(ROOM_EVENTS.map((k) => ROOM_EVENT_COLOR[k])).size, ROOM_EVENTS.length);
});

test('T48: probabilidades por piso: la sala del tiempo desde el piso 3, más rivales y menos huevos al bajar', () => {
  assert.equal(eventWeights(2).timeTrial, 0);
  assert.ok(eventWeights(3).timeTrial > 0);
  assert.ok(eventWeights(6).rival > eventWeights(2).rival);
  assert.ok(eventWeights(6).egg < eventWeights(2).egg);
  for (const f of [2, 3, 5, 9]) for (const k of ROOM_EVENTS) assert.ok(eventWeights(f)[k] >= 0, `${f} ${k}`);
  // El reparto sigue los pesos (muestreo uniforme de x)
  for (const f of [2, 6]) {
    const w = eventWeights(f);
    const total = ROOM_EVENTS.reduce((a, k) => a + w[k], 0);
    const count = Object.fromEntries(ROOM_EVENTS.map((k) => [k, 0])) as Record<string, number>;
    const n = 4000;
    for (let i = 0; i < n; i++) count[pickEventKind(f, (i + 0.5) / n)]++;
    for (const k of ROOM_EVENTS) assert.ok(Math.abs(count[k] / n - w[k] / total) < 0.01, `${f} ${k}`);
  }
  assert.ok(ROOM_EVENTS.includes(pickEventKind(4, 0.9999999)));
  assert.notEqual(pickEventKind(2, 0.9999999), 'timeTrial');
});

test('T48: rival, fuente, sala del tiempo y huevo', () => {
  assert.ok(rivalWaveSize(1, 1) >= 2);
  assert.ok(rivalWaveSize(5, 3) > rivalWaveSize(1, 1));
  assert.ok(rivalWaveSize(99, 3) <= 6);
  assert.equal(rivalBonus(2), 2);
  assert.equal(rivalBonus(0), 1);
  assert.equal(fountainHeal(100), 50);
  assert.ok(fountainPrice(4) > fountainPrice(2));
  assert.equal(TIME_TRIAL_SECONDS, 20);
  assert.ok(timeTrialSize(6) >= timeTrialSize(1) && timeTrialSize(99) <= 8);
  assert.ok(timeTrialExtra(99) <= 6);
  assert.equal(eggTick(EGG_ROOMS), 1);
  assert.equal(eggTick(eggTick(EGG_ROOMS)), 0);
  assert.equal(eggTick(0), 0);
  const rng = mulberry32(4);
  let helpers = 0;
  for (let i = 0; i < 1000; i++) if (eggHatch(rng) === 'helper') helpers++;
  assert.ok(helpers > 500 && helpers < 700, `${helpers}`);
});

test('T59: el rival tiene 2 o 3 Pokémon, cada uno más duro, y un nombre inventado', async () => {
  const { rivalTeamSize, rivalMemberHpMul, rivalTrainerName, RIVAL_NAMES, RIVAL_TITLES } = await import('../src/level/roomEvents.ts');
  assert.equal(rivalTeamSize(1), 2);
  assert.equal(rivalTeamSize(2), 2);
  assert.equal(rivalTeamSize(3), 3);
  assert.equal(rivalTeamSize(9), 3);
  assert.ok(rivalMemberHpMul(1, 1) > 1);
  assert.ok(rivalMemberHpMul(1, 2) > rivalMemberHpMul(1, 1));
  assert.ok(rivalMemberHpMul(5, 2) > rivalMemberHpMul(1, 2));
  // Con cualquier valor del azar (también los extremos) sale un título y un nombre de las listas
  for (const r of [0, 0.5, 0.999999]) {
    const [title, name] = rivalTrainerName(() => r).split(' ');
    assert.ok(RIVAL_TITLES.includes(title));
    assert.ok(RIVAL_NAMES.includes(name));
  }
});

test('T59: el equipo del rival sale de las especies del piso, sin repetir mientras haya bastantes', async () => {
  const { pickRivalTeam } = await import('../src/level/roomEvents.ts');
  const pool = ['a', 'b', 'c', 'd'];
  for (let s = 0; s < 50; s++) {
    const team = pickRivalTeam(pool, 3, mulberry32(s));
    assert.equal(team.length, 3);
    assert.equal(new Set(team).size, 3);
    assert.ok(team.every((t) => pool.includes(t)));
    // Misma semilla, mismo equipo
    assert.deepEqual(pickRivalTeam(pool, 3, mulberry32(s)), team);
  }
  // Con menos especies que huecos se repiten, pero el equipo sale completo
  assert.deepEqual(pickRivalTeam(['x'], 3, () => 0.5), ['x', 'x', 'x']);
  assert.deepEqual(pickRivalTeam([], 3, () => 0.5), []);
  // rng() que devuelve 1 (o casi) no se sale de la lista
  assert.equal(pickRivalTeam(pool, 2, () => 0.9999999).length, 2);
});

// Tabla del diario tal y como era antes de T68 (copia literal, para que el test no dependa del código nuevo).
const OLD_KINDS = ['runaway', 'merchant', 'altar', 'trapChest', 'rival', 'fountain', 'timeTrial', 'egg'] as const;
function oldPickKind(floorNum: number, x: number): RoomEventKind {
  const f = Math.max(1, Math.floor(floorNum));
  const deep = Math.min(1, (f - 2) / 3);
  const w: Record<string, number> = {
    runaway: 1, merchant: 1.2 - 0.4 * deep, altar: 0.6 + 0.4 * deep, trapChest: 1, rival: 0.6 + 0.8 * deep,
    fountain: 1.2 - 0.4 * deep, timeTrial: f >= 3 ? 0.6 + 0.8 * deep : 0, egg: 1.2 - 0.6 * deep,
  };
  const total = OLD_KINDS.reduce((a, k) => a + w[k], 0);
  let r = Math.min(0.999999, Math.max(0, x)) * total;
  for (const k of OLD_KINDS) {
    if (r < w[k]) return k;
    r -= w[k];
  }
  return OLD_KINDS.filter((k) => w[k] > 0).pop()!;
}

test('desafío diario: tabla congelada con los ocho eventos de antes de T68', () => {
  assert.deepEqual([...DAILY_EVENTS], [...OLD_KINDS]);
});

test('desafío diario: el evento es el de siempre para cada semilla, aunque ROOM_EVENTS tenga eventos nuevos', () => {
  for (const biomes of [[], ['water'], ['water', 'ice']]) {
    for (let floorNum = 1; floorNum <= 8; floorNum++) {
      for (let i = 0; i < 200; i++) {
        const x = i / 200;
        assert.equal(pickEventKind(floorNum, x, biomes, DAILY_EVENTS), oldPickKind(floorNum, x));
      }
    }
  }
  for (let seed = 1; seed <= 60; seed++) {
    const floor = floorFor(seed);
    for (const fl of [2, 4, 6]) {
      const ev = pickRoomEvent(floor, fl, mulberry32(seed * 31), new Set(), ['water'], DAILY_EVENTS);
      const ref = mulberry32(seed * 31);
      const roll = ref();
      const which = ref();
      if (ev) {
        assert.ok(roll < EVENT_CHANCE);
        assert.equal(ev.kind, oldPickKind(fl, which));
      }
    }
  }
});

test('desafío diario: slots, thief y fishing nunca salen; en partidas normales sí', () => {
  const nuevos = ['slots', 'thief', 'fishing'];
  for (let fl = 1; fl <= 8; fl++) {
    for (let i = 0; i < 300; i++) {
      assert.ok(!nuevos.includes(pickEventKind(fl, i / 300, ['water'], DAILY_EVENTS)));
    }
  }
  const vistos = new Set<string>();
  for (let i = 0; i < 400; i++) vistos.add(pickEventKind(5, i / 400, ['water']));
  for (const k of nuevos) assert.ok(vistos.has(k), k);
  assert.ok(eventWeights(5, ['water']).fishing > 0);
});

// --- Santuario de la Mega Piedra ---

test('Mega Piedra: el santuario es un evento con nombre, descripción y color distinto, y nunca sale al sortear', () => {
  assert.ok(ROOM_EVENTS.includes('megaStone'));
  assert.equal(ROOM_EVENT_LABEL.megaStone, 'Santuario de la Mega Piedra');
  assert.ok(ROOM_EVENT_DESC.megaStone);
  for (const k of ROOM_EVENTS) if (k !== 'megaStone') assert.notEqual(ROOM_EVENT_COLOR[k], ROOM_EVENT_COLOR.megaStone, k);
  for (const fl of [1, 2, 3, 5, 9]) {
    assert.equal(eventWeights(fl, ['water']).megaStone, 0);
    for (let i = 0; i < 400; i++) assert.notEqual(pickEventKind(fl, i / 400, ['water']), 'megaStone');
  }
  assert.ok(!DAILY_EVENTS.includes('megaStone'));
  for (let seed = 1; seed <= 200; seed++) {
    const ev = pickRoomEvent(floorFor(seed), 4, mulberry32(seed));
    assert.notEqual(ev?.kind, 'megaStone');
  }
});

test('Mega Piedra: cada piso tiene exactamente una sala, determinista, nunca la de inicio ni la del jefe', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const make = () => [floorFor(seed), generateFloor({ seed, roomCount: 6 }), generateFloor({ seed, roomCount: 9, special: true })];
    const again = make();
    for (const [k, f] of make().entries()) {
      const a = pickMegaStoneRoom(f, seed);
      const b = pickMegaStoneRoom(again[k], seed);
      assert.notEqual(a, null, `semilla ${seed}`);
      assert.equal(a, b);
      const room = f.rooms[a!];
      assert.ok(room);
      assert.notEqual(room.id, f.startId);
      assert.notEqual(room.id, f.bossId);
      assert.notEqual(room.kind, 'start');
      assert.notEqual(room.kind, 'boss');
      assert.notEqual(room.kind, 'secret');
    }
  }
});

test('Mega Piedra: respeta las salas excluidas (minijefe, evento, reglas) cuando hay otras libres', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const f = floorFor(seed);
    const first = pickMegaStoneRoom(f, seed)!;
    const second = pickMegaStoneRoom(f, seed, new Set([first]))!;
    assert.notEqual(second, first);
    assert.notEqual(second, f.startId);
    assert.notEqual(second, f.bossId);
  }
});

test('Mega Piedra: distintas semillas de piso la ponen en salas distintas (no siempre la misma)', () => {
  const ids = new Set<number>();
  for (let seed = 1; seed <= 100; seed++) ids.add(pickMegaStoneRoom(floorFor(seed), seed)!);
  assert.ok(ids.size > 2);
});

test('Mega Piedra: la marca de «ya cogida» no choca con la de otros eventos de la misma sala (forja de la Torre)', () => {
  for (const id of [0, 1, 7, 20]) assert.notEqual(megaStoneDoneKey(id), id);
  assert.equal(new Set([0, 1, 2, 3].map(megaStoneDoneKey)).size, 4);
});

test('Mega Piedra: el desafío diario sigue estable (el santuario no toca las tiradas del evento al azar)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const floor = floorFor(seed);
    const antes = pickRoomEvent(floor, 4, mulberry32(seed * 31), new Set(), ['water'], DAILY_EVENTS);
    pickMegaStoneRoom(floor, seed); // función pura: no consume nada del generador del evento
    const despues = pickRoomEvent(floor, 4, mulberry32(seed * 31), new Set(), ['water'], DAILY_EVENTS);
    assert.deepEqual(antes, despues);
    assert.notEqual(despues?.kind, 'megaStone');
  }
});

// --- Santuario de la Mega Piedra: nunca en una sala especial ---

/** Todo lo que hace especial a una sala del piso (exhaustivo: tipos de sala y funciones añadidas por encima). */
function specialRoomIds(f: Floor, extra: { miniboss?: number; eventRoom?: number; rules?: Iterable<number> }): Map<number, string> {
  const m = new Map<number, string>();
  const mark = (id: number | undefined, why: string) => { if (id !== undefined) m.set(id, why); };
  mark(f.startId, 'inicio'); mark(f.bossId, 'jefe'); mark(f.itemId, 'objeto'); mark(f.centerId, 'centro');
  mark(f.shopId, 'tienda'); mark(f.secretId, 'secreta'); mark(f.challengeId, 'desafío');
  for (const id of f.chestRooms ?? []) mark(id, 'cofre');
  for (const g of f.groups ?? []) for (const id of g) mark(id, 'grande');
  for (const r of f.rooms) if (r.kind !== 'combat') mark(r.id, `tipo ${r.kind}`);
  mark(extra.miniboss, 'minijefe'); mark(extra.eventRoom, 'evento');
  for (const id of extra.rules ?? []) mark(id, 'regla');
  return m;
}

/** Reproduce el orden de GameScene: minijefe, evento, reglas y, al final, el santuario. */
function buildFloorLike(f: Floor, floorNum: number, seed: number) {
  const st = f.rooms[f.startId];
  const far = f.rooms
    .filter((rm) => rm.kind === 'combat' && rm.group === undefined)
    .sort((a, b) => Math.abs(b.gx - st.gx) + Math.abs(b.gy - st.gy) - (Math.abs(a.gx - st.gx) + Math.abs(a.gy - st.gy)) || a.id - b.id)[0];
  const miniboss = far?.id;
  const grouped = f.rooms.filter((rm) => rm.group !== undefined).map((rm) => rm.id);
  let event = pickRoomEvent(f, floorNum, mulberry32(seed ^ 0x2545f491), new Set([...(miniboss !== undefined ? [miniboss] : []), ...grouped]), ['water']);
  const rules = pickRoomRules(f, floorNum, mulberry32(seed ^ 0x6c8e9cf5), new Set([...(miniboss !== undefined ? [miniboss] : []), ...(event ? [event.roomId] : []), ...grouped]));
  const plan = planMegaStoneRoom(f, seed, { miniboss, eventRoom: event?.roomId, ruleRooms: rules.keys() });
  if (plan?.dropRule) rules.delete(plan.roomId);
  if (plan?.dropEvent) event = null;
  return { miniboss, event, rules, plan };
}

test('Mega Piedra: en muchas semillas, pisos y tamaños nunca cae en ninguna sala especial', () => {
  let planes = 0;
  for (const roomCount of [8, 10, 12, 16, 24]) {
    for (let seed = 1; seed <= 150; seed++) {
      let f = generateFloor({ seed, roomCount, special: true, extra: true });
      if (seed % 2 === 0) f = addBigRooms(f);
      f = reserveSanctuaryRoom(f);
      for (const floorNum of [2, 3, 5, 8, 12]) {
        const { miniboss, event, rules, plan } = buildFloorLike(f, floorNum, seed * 7 + floorNum);
        if (!plan) {
          assert.ok(roomCount <= 10, `solo los pisos de 8-10 salas pueden quedarse sin santuario; piso de ${roomCount} salas sin santuario (semilla ${seed})`);
          continue;
        }
        planes++;
        const room = f.rooms[plan.roomId];
        const special = specialRoomIds(f, { miniboss, eventRoom: event?.roomId, rules: rules.keys() });
        assert.equal(room.kind, 'combat', `sala ${room.id} es ${room.kind}`);
        assert.equal(special.get(plan.roomId), undefined, `semilla ${seed}/${roomCount}/${floorNum}: sala especial (${special.get(plan.roomId)})`);
        assert.equal(rules.has(plan.roomId), false);
        assert.notEqual(event?.roomId, plan.roomId);
      }
    }
  }
  assert.equal(planes, 5 * 150 * 5);
});

test('Mega Piedra: sin salas normales libres convierte la menos especial (primero regla, luego evento) y nunca una especial', () => {
  const f = generateFloor({ seed: 5, roomCount: 11, special: true, extra: true });
  const plain = f.rooms.filter((r) => isPlainCombatRoom(f, r));
  assert.ok(plain.length >= 2);
  // Todas con regla: se le quita la regla a una
  const todasRegla = planMegaStoneRoom(f, 5, { ruleRooms: plain.map((r) => r.id) })!;
  assert.ok(todasRegla.dropRule && !todasRegla.dropEvent);
  assert.ok(plain.some((r) => r.id === todasRegla.roomId));
  // Todas con regla menos una con el evento: la preferida es la que solo tiene regla
  const [ev, ...resto] = plain;
  const conEvento = planMegaStoneRoom(f, 5, { eventRoom: ev.id, ruleRooms: resto.map((r) => r.id) })!;
  assert.notEqual(conEvento.roomId, ev.id);
  assert.equal(conEvento.dropEvent, false);
  // Solo queda la del evento (el resto, minijefe): se le quita el evento
  const [unica, ...otras] = plain;
  const soloEvento = planMegaStoneRoom(f, 5, { miniboss: otras[0].id, eventRoom: unica.id, ruleRooms: otras.slice(1).map((r) => r.id) });
  assert.ok(soloEvento);
  assert.ok(soloEvento!.dropRule || soloEvento!.dropEvent || plain.some((r) => r.id === soloEvento!.roomId));
  // Con todas ocupadas por minijefe no hay santuario antes que usar una sala especial
  const minimal: Floor = { ...f, rooms: f.rooms.filter((r) => r.kind !== 'combat' || r.id === plain[0].id) };
  const sin = planMegaStoneRoom(minimal, 5, { miniboss: plain[0].id });
  assert.equal(sin, null);
  assert.equal(pickMegaStoneRoom(minimal, 5, new Set([plain[0].id])), null);
});

test('Mega Piedra: un piso sin salas de combate no lo coloca en inicio, jefe, tienda, centro, objeto, secreta, desafío ni cofre', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const f = floorFor(seed);
    const soloEspeciales: Floor = { ...f, rooms: f.rooms.filter((r) => r.kind !== 'combat') };
    assert.equal(pickMegaStoneRoom(soloEspeciales, seed), null);
    assert.equal(planMegaStoneRoom(soloEspeciales, seed), null);
    const soloCofres: Floor = { ...f, rooms: f.rooms.filter((r) => r.kind !== 'combat' || (f.chestRooms ?? []).includes(r.id)) };
    assert.equal(pickMegaStoneRoom(soloCofres, seed), null);
  }
});

test('Mega Piedra obligatoria: TODO piso de 8, 10, 12, 16 y 24 salas (150 semillas, con y sin salas grandes) tiene santuario sin tocar la generación base', () => {
  for (const roomCount of [8, 10, 12, 16, 24]) {
    for (let seed = 1; seed <= 150; seed++) {
      for (const big of [false, true]) {
        const base = generateFloor({ seed, roomCount, special: true, extra: true, big });
        const f = reserveSanctuaryRoom(base);
        assert.equal(f.rooms.length, base.rooms.length);
        assert.deepEqual(f.rooms.map((r) => [r.id, r.kind, r.doors]), base.rooms.map((r) => [r.id, r.kind, r.doors]), 'misma estructura');
        assert.deepEqual(f, reserveSanctuaryRoom(base)); // determinista
        assert.ok(f.rooms.filter((r) => isPlainCombatRoom(f, r)).length >= 1, `sin sala normal (${roomCount}/${seed}/${big})`);
        for (const id of f.chestRooms ?? []) assert.ok((base.chestRooms ?? []).includes(id)); // solo se quitan cofres
        const plan = planMegaStoneRoom(f, seed);
        assert.ok(plan, `sin santuario (${roomCount}/${seed}/${big})`);
        assert.ok(isPlainCombatRoom(f, f.rooms[plan!.roomId]));
      }
    }
  }
});
