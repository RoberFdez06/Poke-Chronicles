// Defensa de torres en táctil (rama `tdmovil`): disposición, casilla más cercana, zoom, lupa, gestos y menús.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MapGesture, TD_TOUCH_CSS, canvasToDesign, clampCenter, cssPerUnit, designToCanvas, designView, fitZoom, infoSide, inside, layoutButtons, loupeRect, maxZoom,
  nearestCell, overlaps, ringRadius, sheetSlots, snapRadius, tdTouchLayout, tdTouchWidth, tdWidthStillNeeded, zoomAbout, type GestureOut, type Rect,
} from '../src/data/towerDefense/touchTd.ts';
import { fitGrid, gridCell, levelsLayout, mapsLayout, menuFrame, teamLayout } from '../src/data/towerDefense/touchMenu.ts';

/** Cajas (px CSS, ya sin zonas seguras) de móviles y tabletas en apaisado. */
const BOXES: [string, number, number][] = [
  ['360×640 (Android pequeño)', 640, 360],
  ['iPhone SE 667×375', 667, 375],
  ['iPhone 14 Pro 734×372', 734, 372],
  ['iPhone 14 750×369', 750, 369],
  ['Galaxy S23 780×360', 780, 360],
  ['14 Pro Max 814×409', 814, 409],
  ['Pixel 7 915×412', 915, 412],
  ['430×932 (Pro Max sin barras)', 932, 430],
  ['14 Pro Safari con barras 667×258', 667, 258],
  ['Pixel 7 con Chrome 915×356', 915, 356],
  ['Fold plegado 882×344', 882, 344],
  ['Fold abierto 884×768', 884, 768],
  ['iPad mini 1133×744', 1133, 744],
  ['iPad Pro 12,9 1366×1024', 1366, 1024],
];

const setup = (w: number, h: number) => {
  const lw = tdTouchWidth(w, h);
  const k = cssPerUnit(w, h, lw);
  return { lw, k, view: designView(lw) };
};

test('tdTouchWidth: llena la caja hasta 3:1, par y nunca menos de 1920', () => {
  assert.equal(tdTouchWidth(667, 375), 1920);
  assert.equal(tdTouchWidth(1133, 744), 1920);
  const w = tdTouchWidth(667, 258);
  assert.equal(w % 2, 0);
  assert.ok(w > 2700 && w <= 2792, String(w));
  assert.equal(tdTouchWidth(840, 240), 3240);
  assert.equal(tdTouchWidth(0, 0), 1920);
  for (const [, bw, bh] of BOXES) {
    const lw = tdTouchWidth(bw, bh);
    // El lienzo nunca se sale de la caja (Scale.FIT): su ancho en CSS ≤ caja
    assert.ok((lw * Math.min(bw / lw, bh / 1080)) <= bw + 0.01);
  }
});

test('diseño ↔ lienzo: ida y vuelta', () => {
  for (const lw of [1920, 2400, 3240]) {
    const r = designToCanvas({ x: 100, y: 50, w: 10, h: 10 }, lw);
    const p = canvasToDesign(r.x, r.y, lw);
    assert.ok(Math.abs(p.x - 100) < 1e-9 && Math.abs(p.y - 50) < 1e-9);
  }
  // La vista de 1920 deja 1137,8 × 640 unidades
  assert.ok(Math.abs(designView(1920).w - 1137.78) < 0.01);
});

for (const [name, bw, bh] of BOXES) {
  test(`partida táctil ${name}: botones ≥ 56 px CSS, dentro, sin solapes y el mapa libre`, () => {
    const { k, view } = setup(bw, bh);
    const L = tdTouchLayout(view, k, 6);
    assert.ok(L.ok, `botón ${(L.btn * k).toFixed(1)} px CSS`);
    const all = layoutButtons(L);
    for (const r of all) {
      assert.ok(r.w * k >= TD_TOUCH_CSS - 0.5 && r.h * k >= TD_TOUCH_CSS - 0.5, `${name}: ${(r.w * k).toFixed(0)}×${(r.h * k).toFixed(0)}`);
      assert.ok(inside(r, view), `${name}: fuera de la vista`);
      assert.ok(!overlaps(r, L.map) && !overlaps(r, L.strip), `${name}: pisa el mapa`);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlaps(all[i], all[j]), `${name}: solape ${i}/${j}`);
    // Letra ≥ 12 px CSS y mapa con hueco de sobra
    assert.ok(L.font * k >= 12 - 0.01);
    assert.ok(L.map.w > 0 && L.map.h * k >= 150, `${name}: mapa de ${(L.map.h * k).toFixed(0)} px CSS de alto`);
    // Hoja de torre más larga (dos ramas, objetivo, mover, vender, cerrar) y de camino: cabe en la columna
    const tower = sheetSlots(L.right, L.btn, L.gap, L.rows, [2, 2, 1, 1, 1, 1]);
    const road = sheetSlots(L.right, L.btn, L.gap, L.rows, [1, 1, 2, 1]);
    for (const s of [...tower, ...road]) {
      assert.ok(s, `${name}: no cabe una acción`);
      assert.ok(inside(s!, L.right) && s!.h * k >= TD_TOUCH_CSS - 0.5);
    }
  });
}

test('caja extrema 840×240: los botones encogen lo justo (y lo dice)', () => {
  const { k, view } = setup(840, 240);
  const L = tdTouchLayout(view, k, 6);
  for (const r of layoutButtons(L)) assert.ok(inside(r, view));
  assert.ok(L.btn * k >= 50, String(L.btn * k));
});

test('sheetSlots: medias en pareja, enteras solas y null si no caben', () => {
  const col = { x: 0, y: 0, w: 210, h: 1000 };
  const s = sheetSlots(col, 100, 10, 3, [2, 1, 1, 1, 2, 1]);
  assert.deepEqual(s[0], { x: 0, y: 0, w: 210, h: 100 });
  assert.deepEqual(s[1], { x: 0, y: 110, w: 100, h: 100 });
  assert.deepEqual(s[2], { x: 110, y: 110, w: 100, h: 100 });
  assert.deepEqual(s[3], { x: 0, y: 220, w: 100, h: 100 });
  // La entera no cabe junto a la media: pasa a la fila siguiente, que ya no existe
  assert.equal(s[4], null);
  assert.equal(s[5], null);
});

test('nearestCell: la de debajo del dedo gana; si no, la más cercana dentro del radio', () => {
  const cells = [{ x: 2, y: 2 }, { x: 5, y: 2 }];
  assert.deepEqual(nearestCell(2 * 48 + 10, 2 * 48 + 10, cells, 0, 0, 48, 10), { x: 2, y: 2 });
  // Dedo en (3,2), a 1 casilla de (2,2) y a 2 de (5,2)
  assert.deepEqual(nearestCell(3.5 * 48, 2.5 * 48, cells, 0, 0, 48, 60), { x: 2, y: 2 });
  assert.equal(nearestCell(3.5 * 48, 2.5 * 48, cells, 0, 0, 48, 40), null);
  assert.equal(nearestCell(0, 0, [], 0, 0, 48, 1000), null);
});

test('anillo y radio de pegado: zona efectiva ≥ 56 px CSS aunque la casilla se vea pequeña', () => {
  for (const [, bw, bh] of BOXES) {
    const { lw, k, view } = setup(bw, bh);
    const L = tdTouchLayout(view, k, 6);
    const vp = designToCanvas(L.map, lw);
    const z = fitZoom(vp, { w: 16 * 48 + 12, h: 11 * 48 + 12 });
    const cssPerCanvas = k / (1080 / 640);
    const ring = ringRadius(48 * z, cssPerCanvas);
    assert.ok(ring * 2 * cssPerCanvas >= TD_TOUCH_CSS - 0.01);
    const snap = snapRadius(z, cssPerCanvas, 48);
    assert.ok(snap * 2 * z * cssPerCanvas >= TD_TOUCH_CSS - 0.01);
    // El zoom máximo deja la casilla en 64 px CSS
    const zm = maxZoom(z, 48, 64, cssPerCanvas);
    assert.ok(zm >= z && Math.abs(48 * zm * cssPerCanvas - Math.max(64, 48 * z * cssPerCanvas)) < 0.01);
  }
});

test('clampCenter y zoomAbout: la vista no se sale del mapa y el punto del pellizco no se mueve', () => {
  const b = { x: 0, y: 0, w: 800, h: 600 };
  assert.deepEqual(clampCenter(-100, 900, 200, 100, b), { x: 100, y: 550 });
  assert.deepEqual(clampCenter(10, 10, 1000, 1000, b), { x: 400, y: 300 });
  const c = zoomAbout(400, 300, 1, 2, 100, -50);
  // El punto del mundo bajo el foco: antes 500,250 → después igual
  assert.ok(Math.abs(c.x + 100 / 2 - 500) < 1e-9 && Math.abs(c.y - 50 / 2 - 250) < 1e-9);
});

test('loupeRect: encima del dedo si cabe, si no al lado; siempre dentro', () => {
  const b: Rect = { x: 0, y: 0, w: 1000, h: 600 };
  const a = loupeRect(500, 400, 200, 40, b);
  assert.deepEqual(a, { x: 400, y: 160, w: 200, h: 200 });
  const s = loupeRect(100, 100, 200, 40, b);
  assert.ok(s.x >= 140 && inside(s, b));
  const r = loupeRect(950, 50, 200, 40, b);
  assert.ok(r.x + r.w <= 950 - 40 + 0.01 && inside(r, b));
  assert.equal(infoSide(100, { x: 0, y: 0, w: 1000, h: 10 }), 'right');
  assert.equal(infoSide(900, { x: 0, y: 0, w: 1000, h: 10 }), 'left');
});

// --- Gestos ---

const kinds = (o: GestureOut[]) => o.map((q) => q.kind);

test('gesto: toque, arrastre, lupa y pellizco', () => {
  const g = new MapGesture(10, 300);
  g.down(1, 100, 100, 0);
  assert.deepEqual(g.up(1, 103, 102), [{ kind: 'tap', x: 103, y: 102 }]);
  // Arrastre: nunca es toque
  g.down(1, 100, 100, 0);
  assert.deepEqual(kinds(g.move(1, 130, 100)), ['pan']);
  assert.deepEqual(g.up(1, 130, 100), []);
  // Lupa: quieto 300 ms; al soltar elige
  g.down(2, 50, 50, 1000);
  assert.deepEqual(g.tick(1200), []);
  assert.deepEqual(kinds(g.tick(1301)), ['hold']);
  assert.deepEqual(kinds(g.move(2, 60, 55)), ['hold']);
  assert.deepEqual(g.up(2, 60, 55), [{ kind: 'holdEnd', x: 60, y: 55, commit: true }]);
  // Pellizco: el factor es la razón de distancias; al levantar uno, el otro arrastra (sin toque)
  g.down(3, 0, 0, 2000);
  g.down(4, 100, 0, 2010);
  const p = g.move(4, 200, 0);
  assert.equal(p[0].kind, 'pinch');
  assert.ok(p[0].kind === 'pinch' && Math.abs(p[0].factor - 2) < 1e-9);
  assert.deepEqual(g.up(3, 0, 0), []);
  assert.deepEqual(kinds(g.move(4, 250, 0)), ['pan']);
  assert.deepEqual(g.up(4, 250, 0), []);
  assert.equal(g.active.length, 0);
});

test('gesto: up cancelado nunca es toque; el tercer dedo se ignora; la lupa se cierra sin elegir', () => {
  const g = new MapGesture(10, 300);
  g.down(1, 10, 10, 0);
  assert.deepEqual(g.up(1, 10, 10, true), []);
  g.down(1, 10, 10, 0);
  g.down(2, 50, 10, 0);
  g.down(3, 90, 10, 0);
  assert.deepEqual([...g.active], [1, 2]);
  g.releaseAll();
  g.down(5, 10, 10, 0);
  g.tick(400);
  assert.deepEqual(g.up(5, 10, 10, true), [{ kind: 'holdEnd', x: 10, y: 10, commit: false }]);
});

test('gesto: sync suelta dedos perdidos y releaseAll lo suelta todo (cambio de escena)', () => {
  const g = new MapGesture(10, 300);
  g.down(1, 0, 0, 0);
  g.down(2, 10, 0, 0);
  assert.deepEqual(g.sync((id) => id === 2), []);
  assert.deepEqual([...g.active], [2]);
  g.releaseAll();
  assert.equal(g.active.length, 0);
  assert.equal(g.state, 'idle');
});

test('gesto: 5000 pasos al azar con dedos perdidos: nunca queda un dedo que no está pulsado', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const g = new MapGesture(10, 300);
  const live = new Set<number>();
  let t = 0;
  for (let i = 0; i < 5000; i++) {
    t += 16;
    const id = 1 + Math.floor(rnd() * 4);
    const r = rnd();
    if (r < 0.3 && !live.has(id)) {
      live.add(id);
      g.down(id, rnd() * 500, rnd() * 300, t);
    } else if (r < 0.6) g.move(id, rnd() * 500, rnd() * 300);
    else if (r < 0.8 && live.has(id)) {
      live.delete(id);
      // 10 % de los up se pierden (el navegador no los manda)
      if (rnd() > 0.1) g.up(id, 0, 0, rnd() < 0.2);
    }
    g.tick(t);
    g.sync((q) => live.has(q));
    for (const a of g.active) assert.ok(live.has(a));
    assert.ok(g.active.length <= 2);
  }
  g.releaseAll();
  assert.equal(g.active.length, 0);
});

// --- Menús ---

test('fitGrid: elige la rejilla de fichas más grandes y pagina si no caben', () => {
  const a = fitGrid(18, { x: 0, y: 0, w: 1200, h: 600 }, 200, 100, 10, 2);
  assert.ok(a.pages === 1 && a.cols * a.rows >= 18 && a.w >= 200 && a.h >= 100);
  const b = fitGrid(18, { x: 0, y: 0, w: 420, h: 220 }, 200, 100, 10);
  assert.equal(b.perPage, 4);
  assert.equal(b.pages, 5);
  assert.deepEqual(gridCell(b, 5), { x: 215, y: 0, w: 205, h: 105 });
});

for (const [name, bw, bh] of BOXES) {
  test(`menús táctiles ${name}: fichas y botones ≥ 56 px CSS, dentro y sin solapes`, () => {
    const { k, view } = setup(bw, bh);
    const big = (r: Rect, what: string) => {
      assert.ok(r.w * k >= TD_TOUCH_CSS - 0.5 && r.h * k >= TD_TOUCH_CSS - 0.5, `${name} ${what}: ${(r.w * k).toFixed(0)}×${(r.h * k).toFixed(0)}`);
      assert.ok(inside(r, view), `${name} ${what}: fuera`);
    };
    const f = menuFrame(view, k);
    big(f.back, 'Volver');
    big(f.help, 'Ayuda');
    assert.ok(!overlaps(f.back, f.help));
    // 18 mapas
    const m = mapsLayout(18, view, k);
    const cards = Array.from({ length: Math.min(18, m.grid.perPage) }, (_, i) => gridCell(m.grid, i));
    for (const c of cards) big(c, 'mapa');
    if (m.prev) big(m.prev, '◀');
    for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) assert.ok(!overlaps(cards[i], cards[j]));
    // 15 niveles + infinito, en una sola página
    const l = levelsLayout(16, view, k);
    assert.equal(l.grid.pages, 1, `${name}: niveles en ${l.grid.pages} páginas`);
    for (let i = 0; i < 16; i++) {
      const c = gridCell(l.grid, i);
      big(c, 'nivel');
      assert.ok(!overlaps(c, l.info));
    }
    assert.ok(l.info.w * k >= 140, `${name}: texto del nivel de ${(l.info.w * k).toFixed(0)} px CSS`);
    // Elige tu equipo
    const t = teamLayout(view, k, 6);
    const btns = [...t.slots, t.start, t.trial, t.prev, t.next, ...t.bars, t.frame.back, t.frame.help];
    for (const r of btns) big(r, 'equipo');
    for (let i = 0; i < t.grid.perPage; i++) big(gridCell(t.grid, i), 'colección');
    assert.ok(t.grid.perPage >= 6, `${name}: ${t.grid.perPage} por página`);
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) assert.ok(!overlaps(btns[i], btns[j]), `${name}: solape ${i}/${j}`);
    assert.ok(t.warn.h * k >= 40, `${name}: aviso de ${(t.warn.h * k).toFixed(0)} px CSS`);
  });
}

test('cambio de escena: el lienzo ancho se suelta solo cuando no queda ninguna pantalla de torres', () => {
  // PENDING 0, INIT 1, … RUNNING 5, PAUSED 6, SLEEPING 7, SHUTDOWN 8
  assert.equal(tdWidthStillNeeded([8, 0]), false);
  assert.equal(tdWidthStillNeeded([8, 1]), true);
  assert.equal(tdWidthStillNeeded([5, 8]), true);
  assert.equal(tdWidthStillNeeded([6]), true);
  assert.equal(tdWidthStillNeeded([]), false);
});
