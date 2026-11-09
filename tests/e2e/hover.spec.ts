// El paso del ratón llega al botón que se ve debajo (rama `hover`): malla de puntos (centro, esquinas, bordes y
// cuartos, a 2 y 3 px dentro del borde) sobre cada botón con cursor de mano de cada menú, en dos tamaños de ventana.
// Antes las tarjetas de «¿A qué quieres jugar?» tenían la zona corrida medio tamaño (contenedor de Phaser dibujado desde
// la esquina) y el ratón en su mitad derecha o de abajo seleccionaba la vecina. También: pulsaciones de teclado breves
// (keydown y keyup en el mismo fotograma) que se perdían en los menús.
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, waitScene } from './helpers';

const MENUS: [string, unknown?][] = [
  ['Menu'], ['Mode'], ['Settings'], ['Pokedex'], ['Upgrades'], ['Gacha'], ['TowerDefenseMenu'], ['Slots'], ['Keys'],
  ['Missions'], ['Garden'], ['Controls', { from: 'Menu' }], ['History', { from: 'Menu' }], ['RunDex'],
  ['SynergyBook', { from: 'Menu' }], ['Legal', { from: 'Menu', tab: 0 }],
];

/* eslint-disable @typescript-eslint/no-explicit-any */
/** En la página: huella visible de cada botón y malla de mousemove sobre el lienzo (Phaser los procesa al momento). */
function installProbe() {
  const w = window as any;
  w.__buttons = (key: string) => {
    const g = w.__POKEISAAC__; const s = g.scene.getScene(key); const cam = s.cameras.main;
    const res: any[] = [];
    s.input._list.forEach((o: any, idx: number) => {
      if (!o.input?.enabled || !o.input.cursor || !o.visible || o.alpha === 0) return;
      for (let p = o.parentContainer; p; p = p.parentContainer) if (!p.visible) return;
      const m = o.getWorldTransformMatrix();
      let a: any, b: any;
      if (o.type === 'Container') {
        // Huella de setSize: dibujada desde la esquina (0..w) o centrada (−w/2..w/2), según dónde caen sus hijos
        let cx = 0, cy = 0, n = 0;
        for (const c of o.list) if (c.getBounds && c.visible) { const r = c.getBounds(); cx += r.centerX; cy += r.centerY; n++; }
        const tl = [m.transformPoint(0, 0, {}), m.transformPoint(o.width, o.height, {})];
        const ce = [m.transformPoint(-o.width / 2, -o.height / 2, {}), m.transformPoint(o.width / 2, o.height / 2, {})];
        const mid = (q: any[]) => [(q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2];
        let use = ce;
        if (n) { cx /= n; cy /= n; const t = mid(tl), c = mid(ce); if (Math.hypot(t[0] - cx, t[1] - cy) < Math.hypot(c[0] - cx, c[1] - cy)) use = tl; }
        [a, b] = use;
      } else {
        const ha = o.input.hitArea;
        a = m.transformPoint(ha.x - o.displayOriginX, ha.y - o.displayOriginY, {});
        b = m.transformPoint(ha.x + ha.width - o.displayOriginX, ha.y + ha.height - o.displayOriginY, {});
      }
      const sx = (x: number) => (x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2 + cam.x;
      const sy = (y: number) => (y - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2 + cam.y;
      const x1 = sx(Math.min(a.x, b.x)), y1 = sy(Math.min(a.y, b.y)), x2 = sx(Math.max(a.x, b.x)), y2 = sy(Math.max(a.y, b.y));
      const label = String(o.text || o.list?.find((c: any) => c.text)?.text || `${o.type}#${idx}`).replace(/\n/g, ' ').slice(0, 24);
      o.__probeId = idx;
      res.push({ id: idx, label, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    });
    return res;
  };
  w.__mesh = (key: string) => {
    const g = w.__POKEISAAC__; const cv = g.canvas; const s = g.scene.getScene(key);
    const btns = w.__buttons(key); const fails: string[] = []; let n = 0;
    const r = cv.getBoundingClientRect(); const d = g.scale.displayScale;
    const pts: [number, number, string][] = [[0.5, 0.5, 'centro'], [0, 0, 'esq-si'], [1, 0, 'esq-sd'], [0, 1, 'esq-ii'], [1, 1, 'esq-id'],
      [0.5, 0, 'borde-s'], [0.5, 1, 'borde-i'], [0, 0.5, 'borde-izq'], [1, 0.5, 'borde-der'], [0.25, 0.25, 'cuarto-si'], [0.75, 0.75, 'cuarto-id']];
    for (const bt of btns) {
      if (bt.w < 8 || bt.h < 8) continue;
      for (const [fx, fy, lab] of pts) for (const inset of [2, 3]) {
        const x = bt.x + fx * bt.w + (fx === 0 ? inset : fx === 1 ? -inset : 0);
        const y = bt.y + fy * bt.h + (fy === 0 ? inset : fy === 1 ? -inset : 0);
        // Un punto que tapa otro botón (huellas solapadas a propósito) no cuenta
        if (btns.some((o: any) => o.id !== bt.id && x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h)) continue;
        cv.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + x / d.x, clientY: r.top + y / d.y, bubbles: true, cancelable: true, view: window }));
        n++;
        const top = (s.input._over[0] || [])[0];
        if (top?.__probeId !== bt.id) fails.push(`${key} · ${bt.label} · ${lab} (${inset} px): le llega a ${top ? (btns.find((o: any) => o.id === top.__probeId)?.label ?? 'otro') : 'nadie'}`);
      }
    }
    return { n, fails };
  };
}

async function openScene(page: Page, key: string, data?: unknown) {
  await page.evaluate(([k, d]) => {
    const g = (window as any).__POKEISAAC__;
    g.scene.getScenes(true).forEach((s: any) => s.scene.key !== 'PadLegend' && s.scene.stop());
    g.scene.start(k, d);
  }, [key, data] as const);
  await waitScene(page, key, 1200);
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
  test(`ratón: el paso del ratón llega al botón que se ve debajo en todos los menús (${vp.width}×${vp.height})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(vp);
    await mockPokeApi(page);
    await page.addInitScript(installProbe);
    const errors = collectErrors(page);
    await page.goto('/');
    await waitScene(page, 'Title', 1000);
    const fails: string[] = [];
    let total = 0;
    for (const [key, data] of MENUS) {
      await openScene(page, key, data);
      const r = await page.evaluate((k) => (window as any).__mesh(k), key);
      total += r.n;
      fails.push(...r.fails);
    }
    expect(total).toBeGreaterThan(1500);
    expect(fails, fails.slice(0, 20).join('\n')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('ratón real en «¿A qué quieres jugar?»: la tarjeta seleccionada sigue al ratón por centro y esquinas', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockPokeApi(page);
  await page.addInitScript(installProbe);
  await page.goto('/');
  await waitScene(page, 'Title', 1000);
  await openScene(page, 'Mode');
  const cards = await page.evaluate(() => {
    const s = (window as any).__POKEISAAC__.scene.getScene('Mode');
    const ids = s.cards.map((c: any) => s.input._list.indexOf(c.box));
    return (window as any).__buttons('Mode').filter((b: any) => ids.includes(b.id)).map((b: any) => ({ ...b, k: ids.indexOf(b.id) }));
  });
  expect(cards.length).toBe(8);
  const toPage = (x: number, y: number) => page.evaluate(([x, y]) => {
    const g = (window as any).__POKEISAAC__; const r = g.canvas.getBoundingClientRect(); const d = g.scale.displayScale;
    return [r.left + x / d.x, r.top + y / d.y];
  }, [x, y] as const);
  const wrong: string[] = [];
  for (const c of cards) {
    for (const [fx, fy] of [[0.5, 0.5], [0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) {
      const [px, py] = await toPage(c.x + fx * c.w, c.y + fy * c.h);
      await page.mouse.move(px, py, { steps: 2 });
      const sel = await page.evaluate(() => (window as any).__POKEISAAC__.scene.getScene('Mode').selected);
      if (sel !== c.k) wrong.push(`${c.label} (${fx}, ${fy}): seleccionada ${sel}`);
    }
  }
  expect(wrong, wrong.join('\n')).toEqual([]);
});

test('teclado: pulsaciones breves (keydown y keyup en el mismo fotograma) cuentan en los menús', async ({ page }) => {
  await mockPokeApi(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1000);
  await openScene(page, 'Mode');
  const sel = () => page.evaluate(() => (window as any).__POKEISAAC__.scene.getScene('Mode').selected as number);
  const quick = (key: string, code: string, keyCode: number) => page.evaluate(([key, code, keyCode]) => {
    for (const type of ['keydown', 'keyup']) {
      const e = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
      Object.defineProperty(e, 'keyCode', { get: () => keyCode });
      Object.defineProperty(e, 'which', { get: () => keyCode });
      window.dispatchEvent(e);
    }
  }, [key, code, keyCode] as const);
  const before = await sel();
  for (let i = 0; i < 3; i++) {
    await quick('ArrowRight', 'ArrowRight', 39);
    await page.waitForTimeout(150);
  }
  expect(await sel()).toBe((before + 3) % 8);
  // Enter breve: la tarjeta elegida abre su pantalla (cambian las escenas activas)
  const scenes = () => page.evaluate(() => (window as any).__POKEISAAC__.scene.getScenes(true).map((s: any) => s.scene.key).join());
  const now = await scenes();
  await quick('Enter', 'Enter', 13);
  await expect.poll(scenes, { timeout: 5000 }).not.toBe(now);
});
