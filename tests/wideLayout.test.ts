import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_W, MAX_W, MENU_SPREAD_MAX, centerOffset, menuSpread, hudSlices, logicalWidth, screenToHudX } from '../src/data/wideLayout.ts';

test('16:9 y ventanas estrechas se quedan en 1920', () => {
  assert.equal(logicalWidth(1600, 900, false), BASE_W);
  assert.equal(logicalWidth(1920, 1080, false), BASE_W);
  assert.equal(logicalWidth(800, 900, false), BASE_W);
  assert.equal(logicalWidth(1000, 400, true), BASE_W, 'en táctil nunca se ensancha');
  assert.equal(logicalWidth(0, 0, false), BASE_W);
  assert.equal(logicalWidth(1940, 1080, false), BASE_W, 'un sobrante mínimo no cuenta');
});

test('21:9 ensancha y respeta el tope de 2,4:1', () => {
  assert.equal(logicalWidth(2560, 1080, false), 2560);
  assert.equal(logicalWidth(3440, 1440, false), 2580);
  assert.equal(logicalWidth(5120, 1080, false), MAX_W);
  assert.equal(MAX_W, 2592);
  assert.equal(logicalWidth(2561, 1080, false) % 2, 0, 'siempre par para centrar sin medios píxeles');
});

test('el centro queda centrado', () => {
  assert.equal(centerOffset(1920), 0);
  assert.equal(centerOffset(2560), 320);
});

test('las tres cámaras del HUD: sin solapes y paneles pegados a los bordes', () => {
  for (const lw of [1920, 2200, 2560, 2592]) {
    const s = hudSlices(lw, 240, 240);
    assert.equal(s.left.dst.x, 0);
    assert.equal(s.right.dst.x + s.right.dst.w, lw);
    assert.ok(s.left.dst.x + s.left.dst.w <= s.center.dst.x);
    assert.ok(s.center.dst.x + s.center.dst.w <= s.right.dst.x);
    assert.equal(s.center.dst.x + s.center.dst.w / 2, lw / 2, 'la sala sigue en el centro');
    // los trozos del diseño cubren 0..1920 sin huecos
    assert.equal(s.left.src.w + s.center.src.w + s.right.src.w, BASE_W);
    assert.equal(s.center.src.x, s.left.src.x + s.left.src.w);
    assert.equal(s.right.src.x, s.center.src.x + s.center.src.w);
  }
  const s = hudSlices(1920, 240, 240);
  assert.deepEqual(s.center.dst, s.center.src, 'en 16:9 es el reparto de siempre');
});

test('pantalla → diseño según el trozo', () => {
  assert.equal(screenToHudX(100, 2560, 240, 240), 100);
  assert.equal(screenToHudX(2560 - 10, 2560, 240, 240), 1910);
  assert.equal(screenToHudX(1280, 2560, 240, 240), 960);
  assert.equal(screenToHudX(960, 1920, 240, 240), 960);
});

test('separación de columnas de menú: 0 en 16:9, con tope en 21:9', () => {
  const band = (lw: number) => (lw / (1080 / 640) - 960) / 2;
  assert.equal(menuSpread(band(1920)), 0);
  const wide = menuSpread(band(2560));
  assert.ok(wide > 0 && wide <= MENU_SPREAD_MAX);
  assert.equal(menuSpread(band(2592)), MENU_SPREAD_MAX);
  // las columnas de la Pausa (40..560 y 615..905) no salen de lo visible
  const b = band(2592);
  assert.ok(40 - MENU_SPREAD_MAX >= -b && 905 + MENU_SPREAD_MAX <= 960 + b);
});

// Paneles laterales más grandes en pantalla ancha
import { HUD_LEFT_SEGS, HUD_RIGHT_SEGS, HUD_SCALE_MAX, hudBandScale, hudPanelSlices, logicalWidth as lwOf, screenToHud } from '../src/data/wideLayout.ts';

test('escala de los paneles: 1 en 16:9 y nunca menos de 1 ni más del tope', () => {
  assert.equal(hudBandScale(1920, 240, HUD_LEFT_SEGS), 1);
  assert.equal(hudBandScale(1920, 240, HUD_RIGHT_SEGS), 1);
  for (const [w, h] of [[1600, 900], [1920, 950], [2160, 1080], [2560, 1080], [3440, 1440], [5120, 1080]]) {
    const lw = lwOf(w, h, false);
    for (const segs of [HUD_LEFT_SEGS, HUD_RIGHT_SEGS]) {
      const s = hudBandScale(lw, 240, segs);
      assert.ok(s >= 1 && s <= HUD_SCALE_MAX, `${w}×${h}: ${s}`);
    }
  }
  assert.ok(hudBandScale(2160, 240, HUD_LEFT_SEGS) > 1.3, '2:1 se agranda de verdad');
});

test('cámaras de los paneles: dentro de la pantalla, sin pisar la sala ni entre sí, y todo el contenido fijo entero', () => {
  for (const lw of [1920, 2160, 2182, 2520, 2560, 2592]) {
    const off = (lw - 1920) / 2;
    for (const [side, segs] of [['left', HUD_LEFT_SEGS], ['right', HUD_RIGHT_SEGS]] as const) {
      const cams = hudPanelSlices(lw, side, 240, segs);
      let y = 0;
      for (const c of cams) {
        assert.ok(c.dst.x >= -1e-9 && c.dst.x + c.dst.w <= lw + 1e-9, 'dentro a lo ancho');
        if (side === 'left') assert.ok(c.dst.x + c.dst.w <= off + 240 + 1e-9, 'no pisa la sala');
        else assert.ok(c.dst.x >= off + 1680 - 1e-9, 'no pisa la sala');
        assert.ok(Math.abs(c.dst.y - y) < 1e-9, 'tramos seguidos, sin solapes');
        assert.ok(Math.abs(c.dst.w - c.src.w * c.zoom) < 1e-6 && Math.abs(c.dst.h - c.src.h * c.zoom) < 1e-6, 'sin deformar');
        y = c.dst.y + c.dst.h;
      }
      assert.ok(Math.abs(y - 1080) < 1e-6, 'llena el alto justo');
      for (const g of segs.filter((g) => !g.crop)) {
        const c = cams.find((c) => Math.abs(c.src.y - g.y0) < 1e-9);
        assert.ok(c && Math.abs(c.src.h - (g.y1 - g.y0)) < 1e-6, 'tramo fijo entero');
      }
      for (const g of segs.filter((g) => g.crop && g.minSrc)) {
        const c = cams.find((c) => Math.abs(c.src.y - g.y0) < 1e-9);
        assert.ok(c && c.src.h >= (g.minSrc ?? 0) - 1e-6, 'se ve lo mínimo del recortable');
      }
      if (lw > 1920) assert.ok(Math.abs((side === 'left' ? cams[0].dst.x + cams[0].dst.w : cams[0].dst.x) - (side === 'left' ? off + 240 : off + 1680)) < 1e-6, 'pegado a la sala');
    }
  }
  // 16:9: el reparto de siempre
  const l = hudPanelSlices(1920, 'left', 240, HUD_LEFT_SEGS);
  assert.deepEqual(l.map((c) => [c.dst.x, c.dst.w, c.zoom]), l.map(() => [0, 240, 1]));
});

test('pantalla → diseño con los paneles escalados (ratón y botones del HUD)', () => {
  for (const lw of [1920, 2182, 2560]) {
    for (const [side, segs] of [['left', HUD_LEFT_SEGS], ['right', HUD_RIGHT_SEGS]] as const) {
      for (const c of hudPanelSlices(lw, side, 240, segs)) {
        // el centro de cada cámara cae en el centro de su trozo de diseño
        const p = screenToHud(c.dst.x + c.dst.w / 2, c.dst.y + c.dst.h / 2, lw, 240, 240, HUD_LEFT_SEGS, HUD_RIGHT_SEGS);
        assert.ok(Math.abs(p.x - (c.src.x + c.src.w / 2)) < 1e-6 && Math.abs(p.y - (c.src.y + c.src.h / 2)) < 1e-6);
      }
    }
    // la sala y el HUD del centro no cambian
    assert.deepEqual(screenToHud(lw / 2, 500, lw, 240, 240, HUD_LEFT_SEGS, HUD_RIGHT_SEGS), { x: 960, y: 500 });
  }
  // el botón de pausa (diseño 16..80 × 16..80) sigue donde se ve
  const lw = 2560;
  const c = hudPanelSlices(lw, 'left', 240, HUD_LEFT_SEGS)[0];
  const p = screenToHud(c.dst.x + 48 * c.zoom, 48 * c.zoom, lw, 240, 240, HUD_LEFT_SEGS, HUD_RIGHT_SEGS);
  assert.ok(Math.abs(p.x - 48) < 1e-6 && Math.abs(p.y - 48) < 1e-6);
});
