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
  // Misiones y logros: debajo de los huecos (dos veces arriba desde el hueco 1; una es Historial), y Esc vuelve
  await press(page, 'ArrowUp', 2);
  await press(page, 'Enter');
  await waitScene(page, 'Missions');
  await shot(page, '03b-misiones');
  await press(page, 'Escape');
  await waitScene(page, 'Slots');
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
  await page.waitForTimeout(1800); // que se vaya el cartel del piso
  await shot(page, '08-partida');
  // Primer consejo del tutorial (Moverse): T lo cierra y queda guardado como visto
  await press(page, 't');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokeisaac.tutorial') ?? '{}').seen)).toContain('move');
  expect(await page.evaluate(() => (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): { tipObjects: unknown[] } } } }).__POKEISAAC__.scene.getScene('Game').tipObjects.length)).toBe(0);
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  await shot(page, '08b-andando');
  await page.keyboard.up('d');
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
