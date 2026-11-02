import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandLayout, touchLogicalWidth, touchScreen, touchBandNeed, MIN_BAND_CSS, TOUCH_MAX_W } from '../src/data/touchLayout.ts';
import { touchHitR } from '../src/data/touchPointers.ts';
import { HUD_LEFT_SEGS, HUD_RIGHT_SEGS_TOUCH, centerOffset, hudPanelSlices } from '../src/data/wideLayout.ts';

/** Caja útil en apaisado (px CSS, ya sin zonas seguras: notch/isla, esquinas, barra de gestos). */
export const DEVICES: [string, number, number][] = [
  ['iPhone SE', 667, 375],
  ['iPhone 14 (sin barras)', 750, 369],
  ['iPhone 14 Pro (sin barras)', 734, 372],
  ['iPhone 14 Pro Safari con barras (≈3,2:1)', 667, 206],
  ['iPhone 14 Pro Max (sin barras)', 814, 409],
  ['Pixel 7', 915, 412],
  ['Pixel 7 Chrome con barra', 915, 356],
  ['Galaxy S23', 780, 360],
  ['Galaxy Z Fold plegado', 882, 344],
  ['Galaxy Z Fold abierto', 884, 768],
  ['iPad mini', 1133, 744],
  ['iPad Pro 12,9', 1366, 1024],
  ['4:3 (1,33)', 1024, 768],
  ['16:9', 800, 450],
  ['2,17:1', 868, 400],
  ['2,4:1', 960, 400],
  ['3,2:1', 960, 300],
  ['3,5:1', 840, 240],
];
const UIS = [1, 1.25, 1.5];
const EPS = 1e-6;

type R = { x: number; y: number; w: number; h: number };
const overlap = (a: R, b: R) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;

for (const [name, w, h] of DEVICES) {
  for (const ui of UIS) {
    test(`${name} ${w}×${h} interfaz ${ui * 100} %`, () => {
      const lw = touchLogicalWidth(w, h, ui);
      assert.ok(lw >= 1920 && lw <= TOUCH_MAX_W && lw % 2 === 0);
      const before = touchScreen(w, h, 1920);
      const after = touchScreen(w, h, lw);
      // La sala nunca se ve más pequeña
      assert.ok(after.room >= before.room - EPS, `sala ${after.room} < ${before.room}`);
      // Todo dentro de la pantalla
      assert.ok(after.canvas + 2 * after.band <= w + EPS);
      assert.ok(after.scale * 1080 <= h + EPS);
      // Sin bandas antes: nada cambia (16:9, tablets, móviles con notch a ≈2,17:1)
      if (before.mode === 'canvas') {
        assert.equal(lw, 1920);
        return;
      }
      assert.equal(after.mode, 'bands');
      assert.ok(after.band >= MIN_BAND_CSS - EPS && after.band <= before.band + EPS);
      assert.ok(after.band >= Math.min(touchBandNeed(ui), before.band) - EPS, 'la banda deja sitio a los botones');
      // Botones: dentro de la banda, sin solapes y cómodos
      const l = bandLayout(after.band, h, ui);
      for (const side of [l.left, l.right]) {
        const rects: R[] = Object.values(side).map((b) => ({ x: b.x - b.size / 2, y: b.y - b.size / 2, w: b.size, h: b.size }));
        rects.push({ x: l.move.x - l.stickR, y: l.move.y - l.stickR, w: l.stickR * 2, h: l.stickR * 2 });
        for (const r of rects) assert.ok(r.x >= -EPS && r.x + r.w <= after.band + EPS && r.y >= -EPS && r.y + r.h <= h + EPS, 'fuera de la banda');
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), 'solape de botones');
        for (const b of Object.values(side)) assert.ok(touchHitR(b.size) * 2 >= 48, 'zona de toque');
      }
      // Botón grande dibujado ≥ 44 px CSS salvo en cajas muy bajas (Safari con barras a interfaz 150 %)
      if (h >= 300 || ui === 1) assert.ok(l.left.active.size >= 44 && l.right.parry.size >= 44, `botón grande ${l.left.active.size}`);
      // HUD: dentro del lienzo y sin pisar la sala
      const off = centerOffset(lw);
      for (const s of hudPanelSlices(lw, 'left', 240, HUD_LEFT_SEGS)) assert.ok(s.dst.x >= -EPS && s.dst.x + s.dst.w <= off + 240 + EPS);
      for (const s of hudPanelSlices(lw, 'right', 240, HUD_RIGHT_SEGS_TOUCH)) assert.ok(s.dst.x >= off + 1680 - EPS && s.dst.x + s.dst.w <= lw + EPS);
    });
  }
}

test('táctil: la zona del minimapa de móvil (16 + 380 px) se ve entera con el panel escalado', () => {
  for (const [, w, h] of DEVICES) {
    const lw = touchLogicalWidth(w, h);
    const top = hudPanelSlices(lw, 'right', 240, HUD_RIGHT_SEGS_TOUCH)[0];
    assert.ok(top.src.h >= 396 - EPS, `${w}×${h}: ${top.src.h}`);
  }
});
test('3,2:1 (Safari con barras): el lienzo se ensancha y las bandas encogen', () => {
  const lw = touchLogicalWidth(667, 206);
  assert.ok(lw > 2200);
  assert.ok(touchScreen(667, 206, lw).band < touchScreen(667, 206, 1920).band);
});
