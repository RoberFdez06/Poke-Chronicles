// Pantalla de error (T43): un fallo dentro de una escena no deja el juego colgado.
import { test, expect, type Page } from '@playwright/test';
import { activeScenes, mockPokeApi, press, waitScene } from './helpers';

/** Hace que la escena falle en su próximo fotograma (y quita el fallo, para que vuelva a funcionar luego). */
const breakScene = (page: Page, key: string) =>
  page.evaluate((k) => {
    type S = { sys: { sceneUpdate: (...a: unknown[]) => void } };
    const s = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): S } } }).__POKEISAAC__.scene.getScene(k);
    // Phaser llama a sys.sceneUpdate (el update de la escena) en cada fotograma
    const original = s.sys.sceneUpdate;
    s.sys.sceneUpdate = () => {
      s.sys.sceneUpdate = original;
      throw new Error('Fallo de prueba en ' + k);
    };
  }, key);

test('un error saca "Algo ha fallado" y se vuelve al menú (teclado y ratón)', async ({ page }) => {
  test.setTimeout(90_000);
  await mockPokeApi(page);
  await page.goto('/');
  await waitScene(page, 'Title', 2500);
  await press(page, 'Enter');
  await waitScene(page, 'Menu', 1200);
  await press(page, 'Enter');
  await waitScene(page, 'Slots');

  // Teclado: Enter sobre "Volver al menú"
  await breakScene(page, 'Slots');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Algo ha fallado');
  await expect(dialog).toContainText('Fallo de prueba en Slots');
  await page.screenshot({ path: 'test-results/screens/19-error.png' });
  await press(page, 'Enter');
  await expect(dialog).toHaveCount(0);
  await waitScene(page, 'Menu');
  // El juego sigue vivo: el menú responde
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  expect(await activeScenes(page)).toContain('Slots');

  // Ratón: clic en "Volver al menú"
  await breakScene(page, 'Slots');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(dialog).toHaveCount(0);
  await waitScene(page, 'Menu');
});
