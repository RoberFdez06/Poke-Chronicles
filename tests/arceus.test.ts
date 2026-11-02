// Ejecutar con `npm test`. Arceus adaptable y Arceus Supremo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptScore, adaptType, ALL_TYPES, ARCEUS_HELPER_POOL, ARCEUS_ID, ARCEUS_SUPREME, arceusAttacks, arceusCanSummon, arceusHelperIds,
  arceusHp, COMPANION_IDS, dominantAttackType, killSeconds, pickArceusCompanions, recordAttack, supremePhaseBar,
} from '../src/data/arceus.ts';
import { rawEffectiveness } from '../src/data/typeChart.ts';
import { ULTRA_IDS, PSEUDO_LEGENDARY_IDS } from '../src/data/guardians.ts';
import { GIANT_HP_MUL } from '../src/data/finale.ts';
import { mulberry32 } from '../src/level/floorGen.ts';


const describe = (name: string, fn: () => void) => { prefix = name; fn(); };
let prefix = '';
const it = (name: string, fn: () => void) => test(`${prefix}: ${name}`, fn);
const expect = (v: any) => ({
  toBe: (w: unknown) => assert.equal(v, w),
  toEqual: (w: unknown) => assert.deepEqual(v, w),
  toContain: (w: unknown) => assert.ok(v.includes(w), `${w} no está`),
  toBeLessThan: (w: number) => assert.ok(v < w, `${v} >= ${w}`),
  toBeGreaterThan: (w: number) => assert.ok(v > w, `${v} <= ${w}`),
  toBeLessThanOrEqual: (w: number) => assert.ok(v <= w, `${v} > ${w}`),
  toBeCloseTo: (w: number) => assert.ok(Math.abs(v - w) < 1e-3, `${v} != ${w}`),
  toBeUndefined: () => assert.equal(v, undefined),
  not: { toBe: (w: unknown) => assert.notEqual(v, w), toContain: (w: unknown) => assert.ok(!v.includes(w), `${w} está`) },
});

const seq = (seed: number) => mulberry32(seed);

describe('adaptación de tipo', () => {
  it('historial y tipo dominante', () => {
    let h = recordAttack({}, 'fire', 10);
    h = recordAttack(h, 'water', 3);
    h = recordAttack(h, 'nope', 99);
    expect(dominantAttackType(h)).toBe('fire');
    expect(dominantAttackType({})).toBeUndefined();
  });
  it('elige un tipo que resiste o es inmune a tu tipo dominante', () => {
    for (const t of ALL_TYPES) {
      const chosen = adaptType({ [t]: 100 }, undefined, seq(7));
      expect(rawEffectiveness(t, [chosen])).toBeLessThan(1);
    }
  });
  it('usa inmunidad cuando existe (Normal → Fantasma, Tierra → Volador)', () => {
    expect(adaptType({ normal: 5 }, undefined, seq(1))).toBe('ghost');
    expect(adaptType({ ground: 5 }, undefined, seq(1))).toBe('flying');
    expect(adaptType({ dragon: 5 }, undefined, seq(1))).toBe('fairy');
  });
  it('pondera varios tipos y nunca queda peor que neutro', () => {
    const h = { fire: 50, electric: 50 };
    const t = adaptType(h, undefined, seq(3));
    expect(adaptScore(h, t)).toBeLessThan(1);
  });
  it('sin historial cambia a otro tipo distinto del actual', () => {
    for (let s = 0; s < 30; s++) expect(adaptType({}, 'normal', seq(s))).not.toBe('normal');
  });
});

describe('ataques de cualquier tipo', () => {
  it('cada tipo da una lista con invocación y sin repetidos', () => {
    for (const t of ALL_TYPES) {
      const a = arceusAttacks(t, ['grass'], false);
      expect(a).toContain('summon');
      expect(new Set(a).size).toBe(a.length);
    }
    expect(arceusAttacks('fire', [], true)).toContain('cascade');
  });
  it('cambiar de tipo cambia los ataques', () => {
    const sets = new Set(ALL_TYPES.map((t) => arceusAttacks(t, [], false).join()));
    expect(sets.size).toBeGreaterThan(4);
  });
});

describe('invocaciones', () => {
  it('solo legendarios/singulares y ultraentes, nunca Arceus ni pseudolegendarios', () => {
    expect(ARCEUS_HELPER_POOL).not.toContain(ARCEUS_ID);
    for (const id of ULTRA_IDS) expect(ARCEUS_HELPER_POOL).toContain(id);
    for (const id of PSEUDO_LEGENDARY_IDS) expect(ARCEUS_HELPER_POOL).not.toContain(id);
  });
  it('ids distintos y respeta el filtro', () => {
    const ids = arceusHelperIds(seq(5), 4, (id) => id > 700);
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => expect(id).toBeGreaterThan(700));
  });
  it('tope de ayudantes simultáneos', () => {
    expect(arceusCanSummon(0, false)).toBe(2);
    expect(arceusCanSummon(3, false)).toBe(0);
    expect(arceusCanSummon(3, true)).toBe(1);
    expect(arceusCanSummon(9, true)).toBe(0);
  });
});

describe('acompañantes del reto final de Normal', () => {
  it('siempre 2, distintos y de la lista de legendarios típicos', () => {
    for (let s = 0; s < 200; s++) {
      const [a, b] = pickArceusCompanions(seq(s));
      expect(a).not.toBe(b);
      expect(COMPANION_IDS).toContain(a);
      expect(COMPANION_IDS).toContain(b);
      expect(ARCEUS_HELPER_POOL).toContain(a);
    }
  });
  it('determinista con la misma semilla', () => {
    expect(pickArceusCompanions(seq(42))).toEqual(pickArceusCompanions(seq(42)));
  });
  it('con filtro (sin conexión) sigue dando 2 distintos', () => {
    const [a, b] = pickArceusCompanions(seq(1), (id) => id === 150 || id === 151 || id === 144);
    expect(a).not.toBe(b);
  });
});

describe('balance de Arceus Supremo', () => {
  it('mucho más duro que el gigante normal, pero acotado', () => {
    expect(ARCEUS_SUPREME.hpMul).toBeGreaterThan(GIANT_HP_MUL);
    expect(ARCEUS_SUPREME.hpMul).toBeLessThanOrEqual(GIANT_HP_MUL * 2);
    expect(ARCEUS_SUPREME.damageMul).toBeGreaterThan(1);
    expect(ARCEUS_SUPREME.damageMul).toBeLessThanOrEqual(1.8);
  });
  it('con una build fuerte (jefe normal en ~40 s) se vence en 3-7 minutos', () => {
    const bossHp = 10000;
    const dps = bossHp / 40;
    const t = killSeconds(arceusHp(bossHp, true), dps, true);
    expect(t).toBeGreaterThan(180);
    expect(t).toBeLessThan(420);
    expect(killSeconds(arceusHp(bossHp, true), dps, false)).toBeLessThan(600);
  });
  it('barra por fases', () => {
    expect(supremePhaseBar(1)).toEqual({ phase: 1, inPhase: 1 });
    expect(supremePhaseBar(0.6).phase).toBe(2);
    expect(supremePhaseBar(0.1).phase).toBe(4);
    expect(supremePhaseBar(0.625).inPhase).toBeCloseTo(0.5);
  });
});
