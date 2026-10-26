// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_ALPHABET, SEED_BESTS_MAX, cycleChar, decodeSeed, encodeSeed, newSeed, normalizeCode, parseSeedBests, seedBest, seedBestText,
  withSeedBest, type SeedInfo,
} from '../src/data/seedCode.ts';
import { MODES } from '../src/data/modes.ts';
import { DIFFICULTIES } from '../src/data/difficulty.ts';
import { dailyFloorSeed, dailyRng, dailySeed, seedFloorSeed, seedRng } from '../src/data/daily.ts';
import { loadSeedBest, submitSeedBest, type StorageLike } from '../src/data/save.ts';

const info: SeedInfo = { seed: 0x5eed1234, mode: 'normal', difficulty: 'hard', starterId: 258 };

test('ida y vuelta con todos los modos, dificultades y semillas de los extremos', () => {
  for (const mode of MODES) for (const difficulty of DIFFICULTIES) for (const seed of [0, 1, 777, 0x7fffffff]) for (const starterId of [1, 25, 1025, 2047]) {
    const i = { seed, mode, difficulty, starterId };
    const code = encodeSeed(i);
    assert.match(code, /^PKI-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.deepEqual(decodeSeed(code), { ok: true, info: i });
  }
});

test('mayúsculas y minúsculas, espacios, sin guiones o sin prefijo y letras parecidas valen igual', () => {
  const code = encodeSeed(info);
  const bare = code.slice(4).replace(/-/g, '');
  for (const v of [code.toLowerCase(), ` ${code} `, bare, bare.toLowerCase(), `pki ${bare.slice(0, 6)} ${bare.slice(6)}`]) assert.deepEqual(decodeSeed(v), { ok: true, info });
  assert.equal(normalizeCode('o0 il-1'), '00111');
});

test('códigos mal escritos se rechazan: letra cambiada, letras cambiadas de sitio, de más o de menos', () => {
  const bare = normalizeCode(encodeSeed(info));
  for (let i = 0; i < bare.length; i++) {
    for (const c of SEED_ALPHABET) {
      if (c === bare[i]) continue;
      const typo = bare.slice(0, i) + c + bare.slice(i + 1);
      assert.equal(decodeSeed(typo).ok, false, typo);
    }
    if (i + 1 < bare.length && bare[i] !== bare[i + 1]) {
      const swap = bare.slice(0, i) + bare[i + 1] + bare[i] + bare.slice(i + 2);
      assert.deepEqual(decodeSeed(swap), { ok: false, error: 'suma' });
    }
  }
  assert.deepEqual(decodeSeed(bare.slice(1)), { ok: false, error: 'formato' });
  assert.deepEqual(decodeSeed(bare + '0'), { ok: false, error: 'formato' });
  assert.deepEqual(decodeSeed('PKI-ÑÑÑÑ-ÑÑÑÑ-ÑÑÑÑ'), { ok: false, error: 'formato' });
  assert.deepEqual(decodeSeed('  - '), { ok: false, error: 'vacio' });
});

/** Código con otra versión pero la suma bien hecha (como lo haría otra versión del juego). */
function withVersion(code: string, version: number): string {
  const digits = [...normalizeCode(code)].map((c) => SEED_ALPHABET.indexOf(c));
  // La versión son los 3 primeros bits del primer carácter
  digits[0] = (version << 2) | (digits[0] & 0b11);
  let h = 0;
  for (const d of digits.slice(0, 10)) h = (h * 31 + d + 7) % 1021;
  digits[10] = Math.floor(h / 32);
  digits[11] = h % 32;
  return digits.map((d) => SEED_ALPHABET[d]).join('');
}

test('códigos de otra versión se rechazan', () => {
  const code = encodeSeed(info);
  assert.deepEqual(decodeSeed(withVersion(code, 1)), { ok: true, info });
  for (const v of [0, 2, 7]) assert.deepEqual(decodeSeed(withVersion(code, v)), { ok: false, error: 'version' });
});

test('datos fuera de rango no se codifican', () => {
  assert.throws(() => encodeSeed({ ...info, starterId: 0 }));
  assert.throws(() => encodeSeed({ ...info, starterId: 4000 }));
  assert.throws(() => encodeSeed({ ...info, seed: -3 }));
  assert.throws(() => encodeSeed({ ...info, mode: 'nada' as never }));
});

test('la semilla genérica da lo mismo que el desafío diario y la misma semilla repite los pisos', () => {
  for (const floor of [1, 2, 5]) {
    assert.equal(dailyFloorSeed(20380, floor), seedFloorSeed(dailySeed(20380), floor));
    const a = dailyRng(20380, floor, 2);
    const b = seedRng(dailySeed(20380), floor, 2);
    for (let k = 0; k < 5; k++) assert.equal(a(), b());
  }
  assert.equal(seedFloorSeed(99, 3), seedFloorSeed(99, 3));
  assert.notEqual(seedFloorSeed(99, 3), seedFloorSeed(100, 3));
  for (const r of [0, 0.5, 0.999999]) {
    const s = newSeed(() => r);
    assert.ok(s >= 1 && s <= 0x7fffffff);
  }
});

test('selector de letras del mando: da la vuelta y empieza desde el hueco vacío', () => {
  assert.equal(cycleChar(undefined, 1), '0');
  assert.equal(cycleChar(undefined, -1), 'Z');
  assert.equal(cycleChar('Z', 1), '0');
  assert.equal(cycleChar('0', -1), 'Z');
  assert.equal(cycleChar('h', 1), 'J');
});

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('mejor resultado por código: solo sube, da igual cómo se escriba y se olvidan los más viejos', () => {
  const code = encodeSeed(info);
  let b = parseSeedBests(null);
  b = withSeedBest(b, code, 3).bests;
  assert.equal(seedBest(b, code.toLowerCase()), 3);
  assert.equal(withSeedBest(b, code, 2).improved, false);
  assert.equal(withSeedBest(b, 'PKI-XXXX', 9).improved, false);
  assert.deepEqual(parseSeedBests(JSON.stringify({ ...b, malo: 4, [normalizeCode(code)]: 3 })), b);
  assert.deepEqual(parseSeedBests('{roto'), {});
  for (let i = 0; i < SEED_BESTS_MAX + 5; i++) b = withSeedBest(b, encodeSeed({ ...info, seed: i }), 1).bests;
  assert.equal(Object.keys(b).length, SEED_BESTS_MAX);
  assert.equal(seedBest(b, code), 0);
  const st = fakeStorage();
  assert.equal(loadSeedBest(code, st), 0);
  assert.equal(submitSeedBest(code, 4, st), true);
  assert.equal(submitSeedBest(code, 4, st), false);
  assert.equal(loadSeedBest(code, st), 4);
  assert.equal(seedBestText('normal', 0), 'Aún no has jugado este código');
  assert.match(seedBestText('waves', 4), /Tu mejor resultado: 4 rondas/);
});
