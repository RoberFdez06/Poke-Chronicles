// T49: objetos activos nuevos y pociones de suelo en el navegador, sin errores en consola.
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, press, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, code: string) =>
  page.evaluate((c) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', c)(g);
  }, code);

test('activos nuevos y pociones', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Game', 3500);
  await page.waitForTimeout(1200);

  // Poción de suelo: se coge (vuela al contador) y C la bebe
  await game(page, 'g.hp = 20; g.spawnLoot(g.current.id, g.player.x + 4, g.player.y, { kind: "potion" });');
  await expect.poll(() => game(page, 'return g.potions'), { timeout: 3000 }).toBe(1);
  expect(await game(page, 'return g.potionsHud.text')).toBe('1');
  await press(page, 'c');
  await expect.poll(() => game(page, 'return g.potions'), { timeout: 3000 }).toBe(0);
  expect((await game(page, 'return g.hp')) as number).toBeGreaterThan(20);
  await page.screenshot({ path: 'test-results/screens/34-pocion.png' });

  // Cada activo nuevo, cargado, con Espacio
  const use = async (id: string) => {
    await game(page, `g.active = { id: "${id}", charge: 9 };`);
    await press(page, 'Space');
    await page.waitForTimeout(300);
  };
  await game(page, 'g.hp = 20;');
  await use('pocion-activa');
  expect((await game(page, 'return g.hp')) as number).toBeGreaterThan(20);
  await use('caramelo-raro');
  expect(await game(page, 'return g.dmgMul()')).toBe(2);
  await use('silbato');
  expect((await game(page, 'return g.invulnUntil - g.time.now')) as number).toBeGreaterThan(1000);
  await game(page, 'g.spawnEnemies(3);');
  await page.waitForTimeout(800);
  await use('bomba-cebo');
  // En la sala de inicio el teletransporte no se gasta
  await use('teletransporte');
  expect(await game(page, 'return g.active.charge')).toBe(9);
  // Desde otra sala, vuelve a la de inicio
  await game(page, 'const d = Object.values(g.current.doors)[0]; g.enemies.clear(true, true); g.cleared.add(g.current.id); g.transition(Object.keys(g.current.doors)[0]);');
  await page.waitForTimeout(1500);
  await expect.poll(() => game(page, 'return g.current.id !== g.floor.startId && !g.transitioning'), { timeout: 4000 }).toBe(true);
  await page.waitForTimeout(500);
  await game(page, 'g.enemies.clear(true, true);');
  await use('teletransporte');
  await expect.poll(() => game(page, 'return g.current.id === g.floor.startId'), { timeout: 3000 }).toBe(true);
  await page.screenshot({ path: 'test-results/screens/35-activos.png' });

  expect(errors, errors.join('\n')).toEqual([]);
});
