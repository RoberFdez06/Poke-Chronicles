import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLITZ_ATTACKS, BLITZ_LABEL, BLITZ_MIN_WARN, blitzAttacksFor, bounceAngles, bounceSpec, bounceStep, crossArms, crossHits, crossMinePlaces, crossSpec,
  dashEnd, dashHits, dashSpec, gridBeams, gridHits, gridSpec, helixAngles, helixSpec, isBlitzAttack, meteorSpec, meteorSpots, miasmaSpec,
  wallHits, wallPlan, wallPos, wallSpec, wallTravelMs,
} from '../src/data/bossBlitz.ts';
import { BOSS_ATTACK_LABEL } from '../src/data/bossPatterns.ts';
import { mulberry32 } from '../src/level/floorGen.ts';

const B = { x0: 100, y0: 50, x1: 1300, y1: 850 };
const inside = (p: { x: number; y: number }, m = 0) => p.x >= B.x0 + m - 1e-6 && p.x <= B.x1 - m + 1e-6 && p.y >= B.y0 + m - 1e-6 && p.y <= B.y1 - m + 1e-6;

test('8 asaltos nuevos con nombre en español, distintos de los que ya había', () => {
  assert.ok(BLITZ_ATTACKS.length >= 6);
  for (const a of BLITZ_ATTACKS) {
    assert.ok(BLITZ_LABEL[a].length > 3);
    const old = ['ring', 'charge', 'rain', 'summon', 'spiral', 'shockwave', 'laser', 'hazard', 'star8', 'cross', 'fan', 'sweep'] as const;
    assert.ok(!(old as readonly string[]).includes(a), `${a} no repite un ataque existente`);
    assert.ok(!old.map((o) => BOSS_ATTACK_LABEL[o]).includes(BLITZ_LABEL[a]));
    assert.equal(BOSS_ATTACK_LABEL[a], BLITZ_LABEL[a], 'el jefe lo anuncia con su nombre');
    assert.ok(isBlitzAttack(a));
  }
  assert.equal(isBlitzAttack('ring'), false);
});

test('cada tipo da 2-3 asaltos y entre todos los tipos salen todos', () => {
  const types = ['fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy', 'normal'];
  const seen = new Set<string>();
  for (const t of types) {
    const l = blitzAttacksFor([t]);
    assert.equal(l.length, 2);
    l.forEach((a) => seen.add(a));
  }
  assert.equal(seen.size, BLITZ_ATTACKS.length);
  const two = blitzAttacksFor(['fire', 'water']);
  assert.ok(two.length === 3 && new Set(two).size === 3);
  assert.equal(blitzAttacksFor(['???']).length, 2);
});

test('los avisos nunca bajan del mínimo (en todos los pisos y fases)', () => {
  for (let f = 1; f <= 20; f++) for (const ph of [1, 2] as const) {
    assert.ok(meteorSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(wallSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(crossSpec(f, ph).fuseMs >= BLITZ_MIN_WARN);
    assert.ok(gridSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(bounceSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(miasmaSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(dashSpec(f, ph).warnMs >= BLITZ_MIN_WARN);
    assert.ok(helixSpec(f, ph).everyMs >= 110);
    assert.ok(wallSpec(f, ph).speed <= 260 && wallSpec(f, ph).gap >= 120);
  }
});

test('meteoros: dentro de la arena y el primero sobre el jugador', () => {
  const rng = mulberry32(3);
  const s = meteorSpots(B, 6, 64, { x: 5000, y: -40 }, rng);
  assert.equal(s.length, 6);
  s.forEach((p) => assert.ok(inside(p, 64)));
  const s2 = meteorSpots(B, 3, 64, { x: 600, y: 400 }, rng);
  assert.deepEqual(s2[0], { x: 600, y: 400 });
});

test('doble hélice: dos sentidos de giro', () => {
  const sp = helixSpec(1, 1);
  const a0 = helixAngles(sp, 0, 0);
  const a1 = helixAngles(sp, 0, 1);
  assert.equal(a0.length, sp.arms * 2);
  assert.ok(a1[0] - a0[0] > 0 && a1[1] - a0[1] < 0);
});

test('muro: cruza la arena entera, deja un hueco y no golpea dentro de él', () => {
  const sp = wallSpec(3, 2);
  const rng = mulberry32(9);
  for (let k = 0; k < 30; k++) {
    const plan = wallPlan(B, sp, rng);
    const [lo, hi] = plan.axis === 'x' ? [B.y0, B.y1] : [B.x0, B.x1];
    assert.ok(plan.gapStart >= lo && plan.gapEnd <= hi && plan.gapEnd - plan.gapStart >= 120);
    const pos = wallPos(B, plan, sp.speed, 0.5)!;
    const mid = (plan.gapStart + plan.gapEnd) / 2;
    const [hx, hy] = plan.axis === 'x' ? [pos, mid] : [mid, pos];
    assert.equal(wallHits(plan, pos, sp.thick, hx, hy), false, 'en el hueco no');
    const out = plan.gapStart - lo > 20 ? lo + 5 : hi - 5;
    const [ox, oy] = plan.axis === 'x' ? [pos, out] : [out, pos];
    assert.equal(wallHits(plan, pos, sp.thick, ox, oy), true, 'fuera del hueco sí');
    assert.equal(wallPos(B, plan, sp.speed, wallTravelMs(B, plan, sp.speed) / 1000 + 0.1), null);
  }
});

test('minas en cruz: los brazos no salen de la arena', () => {
  const rng = mulberry32(5);
  for (const m of crossMinePlaces(B, 10, rng)) {
    assert.ok(inside(m, 60));
    for (const [a, l] of crossArms(m, 2000, B)) assert.ok(inside({ x: m.x + Math.cos(a) * l, y: m.y + Math.sin(a) * l }));
  }
  const m = { x: 600, y: 400 };
  assert.equal(crossHits(m, 340, 26, B, 600, 600), true);
  assert.equal(crossHits(m, 340, 26, B, 700, 500), false);
});

test('rejilla: nunca dos franjas seguidas (siempre hay calle al lado) y dentro de la arena', () => {
  const sp = gridSpec(8, 2);
  const rng = mulberry32(11);
  for (let k = 0; k < 40; k++) {
    const axis = k % 2 ? 'x' : 'y';
    const beams = gridBeams(B, sp, axis, rng);
    assert.ok(beams.length >= 2 && beams.length <= sp.lit);
    const size = ((axis === 'x' ? B.x1 - B.x0 : B.y1 - B.y0)) / sp.slots;
    for (let i = 1; i < beams.length; i++) assert.ok(beams[i].at - beams[i - 1].at >= size * 2 - 1e-6);
    beams.forEach((b) => assert.ok(b.at > (axis === 'x' ? B.x0 : B.y0) && b.at < (axis === 'x' ? B.x1 : B.y1)));
  }
  assert.equal(gridHits({ axis: 'x', at: 300 }, 30, 310, 0), true);
  assert.equal(gridHits({ axis: 'x', at: 300 }, 30, 340, 0), false);
});

test('orbes: rebotan dentro de la arena y se apagan tras sus rebotes', () => {
  const sp = bounceSpec(1, 1);
  let o = { x: 1250, y: 800, vx: 300, vy: 300, left: sp.bounces };
  for (let i = 0; i < 400 && o.left >= 0; i++) {
    o = bounceStep(o, 1 / 60, B, sp.radius);
    assert.ok(inside(o, sp.radius));
  }
  assert.ok(o.left < 0, 'se apaga');
  assert.equal(bounceAngles(1, 1).length, 1);
  assert.equal(bounceAngles(5, 0).length, 5);
});

test('embestida marcada: llega hasta la pared sin salir y golpea en su franja', () => {
  const end = dashEnd({ x: 600, y: 400 }, { x: 700, y: 400 }, B, 70);
  assert.ok(Math.abs(end.x - (B.x1 - 70)) < 1e-6 && Math.abs(end.y - 400) < 1e-6);
  const diag = dashEnd({ x: 600, y: 400 }, { x: 0, y: 0 }, B, 70);
  assert.ok(inside(diag, 70));
  assert.equal(dashHits({ x: 0, y: 0 }, { x: 100, y: 0 }, 60, 50, 20), true);
  assert.equal(dashHits({ x: 0, y: 0 }, { x: 100, y: 0 }, 60, 50, 40), false);
});
