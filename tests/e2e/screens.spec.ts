// Capturas de cada pantalla a 1920×1080 para revisarlas a ojo (se guardan en test-results/screens/).
// También comprueba que no hay errores en consola por el camino.
import { test, expect } from '@playwright/test';
import { collectErrors, mockPokeApi, press, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

const shot = (page: import('@playwright/test').Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png` });

test('capturas de todas las pantallas', async ({ page }) => {
  test.setTimeout(240_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 2500);
  await shot(page, '01-titulo');
  await press(page, 'Enter');
  await waitScene(page, 'Menu', 1200);
  await shot(page, '02-menu');

  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await shot(page, '03-huecos');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await shot(page, '04-region');
  await press(page, 'Enter');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await shot(page, '05-iniciales');
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await shot(page, '06-modo');
  await press(page, 'Escape');
  await waitScene(page, 'Starter', 1500);
  await shot(page, '07-coleccion');
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Game', 3500);
  await shot(page, '08-partida');
  await press(page, 'Escape');
  await waitScene(page, 'Pause');
  await shot(page, '09-pausa');
  await press(page, 'ArrowDown', 3);
  await press(page, 'Enter');
  await waitScene(page, 'Settings');
  await shot(page, '10-ajustes-pausa');
  await press(page, 'Escape');
  await waitScene(page, 'Pause');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await waitScene(page, 'Menu', 1000);

  // Resto de pantallas del menú (Gacha, Pokédex, Mejoras, Ajustes)
  for (const [i, name, scene] of [
    [1, '11-gacha', 'Gacha'],
    [2, '12-pokedex', 'Pokedex'],
    [3, '13-mejoras', 'Upgrades'],
    [5, '14-ajustes', 'Settings'],
  ] as const) {
    await press(page, 'ArrowDown', i);
    await press(page, 'Enter');
    await waitScene(page, scene, 1500);
    await shot(page, name);
    await press(page, 'Escape');
    await waitScene(page, 'Menu', 800);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});
