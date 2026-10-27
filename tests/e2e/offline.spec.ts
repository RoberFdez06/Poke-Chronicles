// Sin conexión (T42): PokeAPI, sprites y SpriteCollab cortados. El juego tiene que poder empezar una partida con
// los datos de public/data/offline/ y avisar con una tarjeta, sin quedarse en "Cargando…".
import { test, expect } from '@playwright/test';
import { press, useLocalSave, waitScene, waitSceneProp, toMenu } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('sin conexión: se juega con los datos guardados y se avisa', async ({ page }) => {
  test.setTimeout(120_000);
  await useLocalSave(page);
  await page.route(/pokeapi\.co|raw\.githubusercontent\.com/, (route) => route.abort('internetdisconnected'));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Los recursos que no cargan son lo esperado aquí
    if (m.type() === 'error' && !/Failed to load resource|ERR_|status of 404/.test(m.text())) errors.push(m.text());
  });

  await page.goto('/');
  await waitScene(page, 'Title', 2500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter');
  await waitScene(page, 'Game', 3500);

  type G = { player?: { active: boolean }; bossName: string; toasts?: { cards: { leaving: boolean }[] } };
  const game = () => page.evaluate(() => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): G } } }).__POKEISAAC__.scene.getScene('Game');
    return { playing: !!g.player?.active, boss: g.bossName, toasts: g.toasts?.cards.length ?? 0 };
  });
  await expect.poll(async () => (await game()).playing, { timeout: 20_000 }).toBe(true);
  const st = await game();
  expect(st.boss).toBeTruthy();
  expect(st.toasts).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/screens/18-sin-conexion.png' });
  expect(errors).toEqual([]);
});
