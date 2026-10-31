import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitPadButton, padButtons, padRect, stickVector, stickZone, STICK_R, type PadRect } from '../src/data/touchPad.ts';

// Igual que ui/layout.ts: 1920×1080, franjas laterales de 240 px, pad 16; las ranuras de poder empiezan en
// H − 16 − 4·74 = 768
const W = 1920;
const H = 1080;
const LEFT = { x: 0, w: 240 };
const RIGHT = { x: 1680, w: 240 };
const SLOTS_TOP = H - 16 - 4 * 74;
const SLOTS: PadRect = { x: 1696, y: SLOTS_TOP, w: 208, h: 4 * 74 };
const hits = (a: PadRect, b: PadRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: PadRect, b: PadRect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

test('joystick: zona muerta, dirección y tope', () => {
  const o = { x: 500, y: 500 };
  assert.deepEqual({ ...stickVector(o, { x: 505, y: 500 }) }.x, 0);
  const full = stickVector(o, { x: 500 + STICK_R, y: 500 });
  assert.ok(Math.abs(full.x - 1) < 1e-9 && full.y === 0);
  assert.equal(full.knobX, 500 + STICK_R);
  const half = stickVector(o, { x: 500, y: 500 - STICK_R * 0.575 });
  assert.ok(half.y < -0.45 && half.y > -0.55, String(half.y));
  // Más allá del radio: largo 1 y el pomo se queda en el borde
  const far = stickVector(o, { x: 500 + STICK_R * 1.2, y: 500 });
  assert.equal(far.x, 1);
  assert.equal(far.knobX, 500 + STICK_R);
  assert.equal(far.baseX, 500);
});

test('joystick: si el dedo se va muy lejos la base lo sigue', () => {
  const v = stickVector({ x: 0, y: 0 }, { x: STICK_R * 3, y: 0 });
  assert.equal(v.x, 1);
  assert.ok(v.baseX > 0);
  assert.ok(Math.abs(STICK_R * 3 - v.baseX - STICK_R * 1.35) < 1e-6);
});

test('joystick: el dedo justo en el centro no da NaN', () => {
  const v = stickVector({ x: 10, y: 10 }, { x: 10, y: 10 });
  assert.deepEqual([v.x, v.y, v.knobX, v.knobY], [0, 0, 10, 10]);
});

test('zonas: izquierda mueve, derecha apunta, las reservadas no', () => {
  assert.equal(stickZone(300, 800, W), 'move');
  assert.equal(stickZone(1500, 300, W), 'aim');
  assert.equal(stickZone(1800, 900, W, [SLOTS]), null);
  assert.equal(stickZone(NaN, 1, W), null);
});

for (const k of [1, 1.25, 1.5])
test(`botones (interfaz ×${k}): dentro de sus franjas, sin pisarse ni tapar las ranuras de poder`, () => {
  const b = padButtons(LEFT, RIGHT, H, 16, SLOTS_TOP, k);
  const rects = Object.entries(b).map(([k, v]) => [k, padRect(v)] as const);
  for (const [k, r] of rects) {
    assert.ok(inside(r, { x: 0, y: 0, w: W, h: H }), k);
    const strip = r.x < W / 2 ? { x: LEFT.x, y: 0, w: LEFT.w, h: H } : { x: RIGHT.x, y: 0, w: RIGHT.w, h: H };
    assert.ok(inside(r, strip), `${k} se sale de su franja`);
    assert.ok(!hits(r, SLOTS), `${k} tapa las ranuras`);
  }
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) assert.ok(!hits(rects[i][1], rects[j][1]), `${rects[i][0]} pisa ${rects[j][0]}`);
  // Parry y Esquiva a la derecha; el resto a la izquierda
  assert.ok(b.parry.x > W / 2 && b.dash.x > W / 2);
  for (const k of ['active', 'bomb', 'potion', 'use'] as const) assert.ok(b[k].x < W / 2);
});

test('toque: gana el botón más cercano y los ocultos no cuentan', () => {
  const bs = [
    { id: 'a', x: 0, y: 0, size: 100, visible: true },
    { id: 'b', x: 110, y: 0, size: 100, visible: true },
    { id: 'c', x: 50, y: 0, size: 100, visible: false },
  ];
  const r = (s: number) => s / 2 + 40;
  assert.equal(hitPadButton(70, 0, bs, r)?.id, 'b');
  assert.equal(hitPadButton(40, 0, bs, r)?.id, 'a');
  assert.equal(hitPadButton(500, 0, bs, r), null);
});
