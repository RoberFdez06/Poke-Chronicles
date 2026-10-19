// Teclas configurables (T44): se cambia la bomba a Q en Ajustes > Controles y la partida la usa.
import { test, expect } from '@playwright/test';
import { collectErrors, mockPokeApi, press, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('cambiar una tecla en Ajustes y usarla en la partida', async ({ page }) => {
  test.setTimeout(120_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 2500);
  await press(page, 'Enter');
  await waitScene(page, 'Menu', 1200);
  // Menú: Jugar, Gacha, Pokédex, Mejoras, Controles, Ajustes
  await press(page, 'ArrowDown', 5);
  await press(page, 'Enter');
  await waitScene(page, 'Settings');
  // Ajustes: Música, Efectos, Pantalla completa, Controles y teclas
  await press(page, 'ArrowDown', 3);
  await press(page, 'Enter');
  await waitScene(page, 'Keys');

  // Bomba es la 14.ª acción: a la derecha (Poder 2) y 4 abajo
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown', 4);
  await press(page, 'Enter');
  await page.waitForTimeout(150);
  // W ya es "Moverse arriba": avisa y no cambia
  await press(page, 'w');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('pokeisaac.keys') ?? '{}'));
  expect((await stored()).bomb).toBeUndefined();
  await page.screenshot({ path: 'test-results/screens/20-teclas.png' });
  await press(page, 'q');
  expect((await stored()).bomb).toBe('Q');
  await press(page, 'Escape');
  await waitScene(page, 'Settings');
  await press(page, 'Escape');
  await waitScene(page, 'Menu');

  // Partida: Q suelta la bomba (empiezas con una)
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
  await waitSceneProp(page, 'Game', 'bombs', 1, 1500);
  await press(page, 'e');
  expect(await page.evaluate(() => (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): { bombs: number } } } }).__POKEISAAC__.scene.getScene('Game').bombs)).toBe(1);
  await press(page, 'q');
  await waitSceneProp(page, 'Game', 'bombs', 0);
  expect(errors).toEqual([]);
});
