// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forcedEventRng, hasRoutes, isRouteOption, ROUTE_EVENT, routeLabel, routeMul, routeOptions } from '../src/level/routes.ts';
import { biomeFor } from '../src/level/biomes.ts';
import { isFinalFloor } from '../src/data/finale.ts';
import { dailyFloorSeed } from '../src/data/daily.ts';
import { generateFloor, mulberry32 } from '../src/level/floorGen.ts';
import { pickRoomEvent } from '../src/level/roomEvents.ts';

test('siempre hay 2 o 3 rutas, una tranquila con el bioma de siempre, sin premios repetidos', () => {
  for (const mode of ['normal', 'endless'] as const) {
    for (let seed = 0; seed < 300; seed++) {
      const floor = 2 + (seed % 9);
      const opts = routeOptions(floor, seed * 7919, mode);
      assert.ok(opts.length === 2 || opts.length === 3);
      const calm = opts.filter((o) => o.diffPct === 0);
      assert.equal(calm.length, 1);
      assert.equal(calm[0].biomeId, biomeFor(mode, floor).id);
      assert.equal(new Set(opts.map((o) => o.reward)).size, opts.length);
      assert.equal(new Set(opts.map((o) => o.biomeId)).size, opts.length);
      assert.ok(opts.every(isRouteOption));
    }
  }
});

test('es determinista por piso y semilla (el desafío diario da las mismas rutas a todos)', () => {
  const day = 20000;
  assert.deepEqual(routeOptions(3, dailyFloorSeed(day, 3)), routeOptions(3, dailyFloorSeed(day, 3)));
  const differ = Array.from({ length: 50 }, (_, s) => JSON.stringify(routeOptions(3, s))).filter((x, _, a) => x !== a[0]);
  assert.ok(differ.length > 0);
});

test('hay rutas solo en Normal e Infinito y nunca antes del reto final', () => {
  const fin = (m: 'normal' | 'endless' | 'tower' | 'waves' | 'bossrush') => (n: number) => isFinalFloor(m, n);
  assert.equal(hasRoutes('normal', 2, fin('normal')), true);
  assert.equal(hasRoutes('endless', 12, fin('endless')), true);
  assert.equal(hasRoutes('tower', 2, fin('tower')), false);
  assert.equal(hasRoutes('waves', 2, fin('waves')), false);
  assert.equal(hasRoutes('bossrush', 2, fin('bossrush')), false);
  for (let n = 2; n < 10; n++) if (isFinalFloor('normal', n)) assert.equal(hasRoutes('normal', n, fin('normal')), false);
});

test('dificultad y texto', () => {
  assert.equal(routeMul(null), 1);
  assert.equal(routeMul({ biomeId: 'cueva', diffPct: 20, reward: 'loot' }), 1.2);
  assert.equal(routeLabel({ biomeId: 'cueva', diffPct: 20, reward: 'shop' }), 'Cueva · +20 % · Tienda extra');
  assert.equal(routeLabel({ biomeId: 'bosque', diffPct: 0, reward: 'rest' }), 'Bosque · Tranquila · Descanso con fuente');
});

test('el premio de sala sorpresa siempre sale en el piso', () => {
  for (let seed = 1; seed < 60; seed++) {
    const floor = generateFloor({ seed, roomCount: 9, special: true, extra: true, big: true });
    for (const kind of Object.values(ROUTE_EVENT)) {
      const ev = pickRoomEvent(floor, 3, forcedEventRng(mulberry32(seed)), new Set(), [], [kind!]);
      assert.ok(ev);
      assert.equal(ev.kind, kind);
    }
  }
});
