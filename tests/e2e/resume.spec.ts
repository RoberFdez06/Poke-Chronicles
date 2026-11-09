// Continuar una partida guardada con el jefe del piso ya vencido: la trampilla se pone al cargar y antes el juego se
// colgaba con «Cannot read properties of undefined (reading 'group')», porque aún no había sala actual.
import { test, expect } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, press, runSaved, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('continuar con el jefe vencido carga la partida y deja la trampilla', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await mockPokeApi(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  // La primera vez se ofrece el tutorial: «Jugar ya» es la segunda opción
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
  await expect.poll(() => runSaved(page, 0), { timeout: 15_000 }).not.toBeNull();

  // Jefe del piso vencido en el guardado y vuelta a empezar desde el título
  // (en el guardado, bossId es la especie del jefe; la sala del jefe es floor.bossId)
  await page.evaluate(() => {
    const key = 'pokeisaac.run.0';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bossRoom = (window as any).__POKEISAAC__.scene.getScene('Game').floor.bossId as number;
    const run = JSON.parse(localStorage.getItem(key)!);
    run.cleared = [...new Set([...run.cleared, bossRoom])];
    localStorage.setItem(key, JSON.stringify(run));
  });
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await page.waitForTimeout(400);
  await press(page, 'Enter'); // «Continuar esta»
  await waitScene(page, 'Game', 2500);

  expect(await activeScenes(page)).toContain('Game');
  const state = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).__POKEISAAC__.scene.getScene('Game');
    return { trapdoor: !!g.trapdoor, room: g.current?.id, bossId: g.floor?.bossId, cleared: [...(g.cleared ?? [])], resumed: !!g.resume };
  });
  expect(errors).toEqual([]);
  expect(state.cleared, 'se ha cargado la partida con el jefe vencido').toContain(state.bossId);
  expect(state.trapdoor, 'la trampilla sigue ahí').toBe(true);
  expect(state.room).toBeDefined();
});
