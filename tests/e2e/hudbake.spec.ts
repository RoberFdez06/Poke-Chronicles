// El fondo de los laterales y el minimapa van pintados en imágenes: antes eran Graphics con unas 80 000 órdenes que se
// repetían en cada fotograma y por cada cámara del HUD, y bajaban la partida a 30-40 FPS en una gráfica buena.
import { test, expect } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, press, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('el HUD no repinta miles de órdenes y el minimapa se ve en su imagen', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await mockPokeApi(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await page.waitForTimeout(600);
  if ((await activeScenes(page)).includes('ItemChoice')) {
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
  }
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter');
  await waitScene(page, 'Game', 3500);

  const state = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__POKEISAAC__.scene.getScene('Game');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawn = s.hudLayer.list.filter((o: any) => o.type === 'Graphics' && o.visible);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders = drawn.reduce((n: number, o: any) => n + o.commandBuffer.length, 0);
    const b = s.minimap.getData('layout');
    const r = s.mapBakeRect;
    return { orders, hasLayout: !!b, mapVisible: s.mapBake.visible, source: s.minimap.visible, inside: b.left >= r.x && b.left + b.w <= r.x + r.w };
  });
  expect(state.orders, 'órdenes de dibujo del HUD en cada cámara').toBeLessThan(15_000);
  expect(state.hasLayout).toBe(true);
  expect(state.mapVisible).toBe(true);
  expect(state.source, 'el Graphics del mapa no se pinta').toBe(false);
  expect(state.inside, 'el mapa cabe en su imagen').toBe(true);
  await page.screenshot({ path: 'test-results/hud-horneado.png' });
  expect(errors).toEqual([]);
});
