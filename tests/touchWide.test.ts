import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandLayout, touchLogicalWidth, touchScreen, touchBandNeed, touchWideWidth, touchCanvasWide, touchHudSegs, MIN_BAND_CSS, TOUCH_MAX_W } from '../src/data/touchLayout.ts';
import { touchHitR } from '../src/data/touchPointers.ts';
import { padButtons } from '../src/data/touchPad.ts';
import { hudLayout } from '../src/data/hudLayout.ts';
import { HUD_LEFT_SEGS, HUD_RIGHT_SEGS_TOUCH, centerOffset, hudBandScale, hudPanelSlices, hudToScreen, screenToHud } from '../src/data/wideLayout.ts';

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

// --- HUD táctil escalado sin bandas (rama `movilhud`) -------------------------------------------------------------
// Medidas del HUD de la partida (ui/layout.ts: HUD, GameScene.slotY): paneles de 240 a cada lado de la sala de 1440.
const PANEL = 240;
const PAD = 16;
const SLOTS_TOP = 1080 - PAD - 4 * 74;
const slotY = (i: number) => 1080 - PAD - (4 - i) * 74;
/** Cajas más anchas que 16:9: sin bandas, el lienzo llena la caja y los controles van dentro (TOUCH_BANDS_ENABLED). */
const IMPROVED = new Set(DEVICES.filter(([, w, h]) => w / h > 1.79).map(([n]) => n));
/** Letra más pequeña del panel izquierdo (ficha, progreso: data/hudLayout.ts). */
const MIN_FONT = 14;

/** Puntos del HUD (diseño) que se tocan: pausa, barra de parry, bomba, poción, objeto activo y las 4 ranuras. */
function hudTargets(): [string, number, number][] {
  const HL = hudLayout(PANEL - PAD * 2);
  const cx = (k: 'bomb' | 'potion') => PAD + HL.counterX[k];
  const out: [string, number, number][] = [
    ['pausa', PAD + HL.pause.x + HL.pause.w / 2, HL.pause.y + HL.pause.h / 2],
    ['barra de parry', PAD + HL.parry.x + HL.parry.w / 2, HL.parry.y + HL.parry.h / 2],
    ['bomba', cx('bomb'), HL.counterIconY],
    ['poción', cx('potion'), HL.counterIconY],
    ['objeto activo', PANEL / 2, 1080 - 71],
  ];
  for (let i = 0; i < 4; i++) out.push([`ranura ${i + 1}`, 1680 + PANEL / 2, slotY(i) + 32]);
  return out;
}

for (const [name, w, h] of DEVICES) {
  for (const ui of UIS) {
    test(`HUD táctil escalado: ${name} ${w}×${h} interfaz ${ui * 100} %`, () => {
      const old = touchLogicalWidth(w, h, ui);
      const lw = touchWideWidth(w, h, ui);
      // Interruptor apagado: exactamente lo de antes
      assert.equal(touchWideWidth(w, h, ui, false), old);
      if (!IMPROVED.has(name)) {
        // 16:9 o más estrecho (tablets, iPhone SE): idéntico
        assert.equal(lw, old, 'sin mejora debe quedar igual');
        assert.equal(touchCanvasWide(w, h, lw), false);
        return;
      }
      assert.ok(lw > 1920 && lw <= TOUCH_MAX_W && lw % 2 === 0);
      const before = touchScreen(w, h, 1920);
      const after = touchScreen(w, h, lw);
      assert.equal(after.mode, 'canvas');
      assert.ok(touchCanvasWide(w, h, lw));
      // Sala igual (manda el alto), todo dentro y sin franjas muertas (< 1 px CSS por lado)
      assert.ok(Math.abs(after.room - before.room) < 1e-6, 'sala');
      assert.ok(after.canvas <= w + EPS && after.scale * 1080 <= h + EPS);
      if (w / h <= TOUCH_MAX_W / 1080) assert.ok(after.band < 1, `franja ${after.band}`);
      // Los menús (diseño de 1920 centrado) se ven en el mismo sitio y tamaño
      assert.ok(Math.abs((before.band) - (after.band + centerOffset(lw) * after.scale)) < 1e-6, 'menús en su sitio');
      const segs = touchHudSegs(true);
      const off = centerOffset(lw);
      const left = hudPanelSlices(lw, 'left', PANEL, segs.left);
      const right = hudPanelSlices(lw, 'right', PANEL, segs.right);
      // Paneles: dentro del lienzo, sin pisar la sala ni salirse por arriba/abajo
      for (const c of left) assert.ok(c.dst.x >= -EPS && c.dst.x + c.dst.w <= off + PANEL + EPS && c.dst.y >= -EPS && c.dst.y + c.dst.h <= 1080 + EPS);
      for (const c of right) assert.ok(c.dst.x >= off + 1680 - EPS && c.dst.x + c.dst.w <= lw + EPS && c.dst.y >= -EPS && c.dst.y + c.dst.h <= 1080 + EPS);
      // Nada con contenido se corta: izquierda 0..600 y 828..1080 enteros; derecha entera (minimapa, avisos, ranuras)
      const covered = (cams: typeof left, y0: number, y1: number) => {
        let y = y0;
        for (const c of cams) if (c.src.y <= y + EPS && c.src.y + c.src.h > y) y = c.src.y + c.src.h;
        return y >= y1 - EPS;
      };
      assert.ok(covered(left, 0, 600) && covered(left, 828, 1080), 'panel izquierdo cortado');
      assert.ok(covered(right, 0, 1080), 'panel derecho cortado');
      // Legible: la letra mínima del panel izquierdo crece al menos un 25 % (en px CSS)
      const sL = hudBandScale(lw, PANEL, segs.left);
      assert.ok((MIN_FONT * sL * after.scale) / (MIN_FONT * before.scale) >= 1.25 - 1e-9, `letra ×${sL}`);
      assert.ok(hudBandScale(lw, PANEL, segs.right) >= 1 - EPS);
      // Botones táctiles del lienzo: visibles, dentro de su panel, sin solapes, no más pequeños y zona ≥ 56 px CSS
      const pads = padButtons({ x: 0, w: PANEL }, { x: 1680, w: PANEL }, 1080, PAD, SLOTS_TOP, ui);
      const rects: (R & { id: string })[] = [];
      for (const [id, b] of Object.entries(pads)) {
        const sc = hudToScreen(b.x, b.y, lw, PANEL, PANEL, segs.left, segs.right);
        assert.ok(sc.visible, `${id} oculto`);
        const size = b.size * sc.zoom;
        assert.ok(size >= b.size - EPS, `${id} más pequeño`);
        const r = { id, x: sc.x - size / 2, y: sc.y - size / 2, w: size, h: size };
        const cams = sc.x < lw / 2 ? left : right;
        assert.ok(cams.some((c) => r.x >= c.dst.x - EPS && r.x + r.w <= c.dst.x + c.dst.w + EPS && r.y >= c.dst.y - EPS && r.y + r.h <= c.dst.y + c.dst.h + EPS), `${id} fuera de su tramo`);
        assert.ok(r.x + r.w <= off + 240 + EPS || r.x >= off + 1680 - EPS, `${id} pisa la sala`);
        assert.ok(touchHitR(size * after.scale) * 2 >= 56, `${id} zona de toque`);
        rects.push(r);
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!overlap(rects[i], rects[j]), `${rects[i].id} pisa ${rects[j].id}`);
      // Toques: cada punto del HUD se ve y el toque vuelve a su punto del diseño
      for (const [id, x, y] of [...hudTargets(), ...Object.entries(pads).map(([k, b]) => [k, b.x, b.y] as [string, number, number])]) {
        const sc = hudToScreen(x, y, lw, PANEL, PANEL, segs.left, segs.right);
        assert.ok(sc.visible, `${id} no se ve`);
        assert.ok(sc.x >= 0 && sc.x <= lw && sc.y >= 0 && sc.y <= 1080, `${id} fuera de pantalla`);
        const back = screenToHud(sc.x, sc.y, lw, PANEL, PANEL, segs.left, segs.right);
        assert.ok(Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6, `${id}: toque en ${back.x},${back.y} y no en ${x},${y}`);
      }
    });
  }
}

test('HUD táctil escalado: sin escalar (1920), hudToScreen y screenToHud son la identidad', () => {
  for (const [id, x, y] of hudTargets()) {
    const sc = hudToScreen(x, y, 1920, PANEL, PANEL, HUD_LEFT_SEGS, HUD_RIGHT_SEGS_TOUCH);
    assert.deepEqual([sc.x, sc.y, sc.zoom, sc.visible], [x, y, 1, true], id);
    assert.deepEqual(screenToHud(x, y, 1920, PANEL, PANEL, HUD_LEFT_SEGS, HUD_RIGHT_SEGS_TOUCH), { x, y });
  }
});

test('HUD táctil escalado: iPhone 14 Pro sin barras (734×372) gana HUD y 667×258 (Safari con barras) llena la caja', () => {
  const lw = touchWideWidth(734, 372);
  assert.equal(lw, 2130);
  assert.ok(Math.abs(hudBandScale(lw, PANEL, touchHudSegs(true).left) - 1080 / 852) < 1e-9);
  // Franja muerta de 36 px CSS por lado → 0; panel izquierdo de 83 a 105 px CSS
  assert.ok(touchScreen(734, 372, lw).band < 1);
  // 667×258 (Safari con barras): ya sin bandas DOM, el lienzo llena la caja y los controles van dentro
  for (const ui of UIS) assert.equal(touchWideWidth(667, 258, ui), 2792);
  assert.ok(touchScreen(667, 258, touchWideWidth(667, 258)).band < 1);
});
