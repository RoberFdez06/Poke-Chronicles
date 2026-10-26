// Recorrido completo con teclado: menú → huecos → primer inicial → modo → partida → pausa → salir y guardar,
// continuar, y Esc / Retroceso para volver en cada pantalla. Falla si hay errores en consola.
import { test, expect } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, press, runSaved, waitScene, waitSceneProp, toMenu } from './helpers';
import { RUN_VERSION } from '../../src/data/runSave';

test.beforeEach(async ({ page }) => {
  await mockPokeApi(page);
});

test('con teclado: se juega, se guarda, se continúa y Esc vuelve atrás', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  // Pantalla de título: cualquier tecla pasa al menú
  await waitScene(page, 'Title', 1500);
  await toMenu(page);

  // Menú → Huecos, y Esc vuelve
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Escape');
  await waitScene(page, 'Menu');

  // Retroceso también vuelve
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Backspace');
  await waitScene(page, 'Menu');

  // Primera partida: hueco vacío → región e inicial; Esc vuelve a los huecos
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Escape');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter'); // Kanto
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter'); // inicial del medio
  await waitScene(page, 'Mode');

  // Modo: Esc vuelve a la colección y de ahí a los huecos
  await press(page, 'Escape');
  await waitScene(page, 'Starter');
  await press(page, 'Escape');
  await waitScene(page, 'Slots');

  // Ahora ya hay un Pokémon: hueco → colección → modo → partida
  await press(page, 'Enter');
  await waitScene(page, 'Starter', 1200);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter'); // Normal
  await waitScene(page, 'Game', 2500);

  // Se guarda al entrar en la sala
  const saved = await runSaved(page, 0);
  expect(saved, 'partida guardada al empezar').not.toBeNull();
  expect(saved!.version).toBe(RUN_VERSION);

  // Pausa → Salir y guardar (la sexta opción)
  await press(page, 'Escape');
  await waitScene(page, 'Pause');
  await press(page, 'ArrowDown', 5);
  await press(page, 'Enter');
  await waitScene(page, 'Menu');
  expect(await runSaved(page, 0)).not.toBeNull();

  // Huecos: el 1 está ocupado → diálogo; Esc cierra el diálogo y otro Esc vuelve al menú
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  await press(page, 'Escape');
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toContain('Slots');
  await press(page, 'Escape');
  await waitScene(page, 'Menu');

  // Continuar
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  await press(page, 'Enter'); // Continuar
  await waitScene(page, 'Game', 2500);
  expect(await activeScenes(page)).not.toContain('Slots');

  expect(errors, errors.join('\n')).toEqual([]);
});
