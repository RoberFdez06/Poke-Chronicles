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

  // Menú → Modos, y Esc vuelve
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Escape');
  await waitScene(page, 'Menu');

  // Retroceso también vuelve
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Backspace');
  await waitScene(page, 'Menu');

  // Primera partida: modo Normal → hueco vacío → región e inicial; Esc vuelve a los huecos y otro Esc a los modos
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter'); // Normal
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Escape');
  await waitScene(page, 'Slots');
  await press(page, 'Escape');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter'); // Kanto
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter'); // inicial del medio: entra directo en la partida
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

  // Huecos: el 1 está ocupado → diálogo; Esc cierra el diálogo, otro Esc vuelve a los modos y otro al menú
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  await press(page, 'Escape');
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toContain('Slots');
  await press(page, 'Escape');
  await waitScene(page, 'Mode');
  await press(page, 'Escape');
  await waitScene(page, 'Menu');

  // Continuar
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await page.waitForTimeout(300);
  await press(page, 'Enter'); // Continuar
  await waitScene(page, 'Game', 2500);
  expect(await activeScenes(page)).not.toContain('Slots');

  expect(errors, errors.join('\n')).toEqual([]);
});
