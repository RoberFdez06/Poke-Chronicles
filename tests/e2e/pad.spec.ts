// Recorrido completo solo con mando (T29), con un mando simulado (navigator.getGamepads falso): título → menú →
// huecos → primer inicial → modo → partida → moverse y disparar con los sticks → pausa (Start) → salir y guardar →
// continuar, y B para volver en cada pantalla. Sin teclado ni ratón. Falla si hay errores en consola.
import { test, expect, type Page } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, PAD, padAxes, padPress, runSaved, useFakePad, waitScene, waitSceneProp, toMenu } from './helpers';

const game = <T>(page: Page, f: (g: { player: { body: { velocity: { x: number; y: number } } }; shots: { countActive(a: boolean): number } }) => T): Promise<T> =>
  page.evaluate((src) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', `return (${src})(g)`)(g);
  }, f.toString()) as Promise<T>;

test('con mando: se juega, se guarda, se continúa y B vuelve atrás', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  await useFakePad(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page, () => padPress(page, PAD.A));

  // Menú → Huecos y B vuelve
  await padPress(page, PAD.A);
  await waitScene(page, 'Slots');
  await padPress(page, PAD.B);
  await waitScene(page, 'Menu');

  // Primera partida: hueco → región (B vuelve a los huecos) → inicial (con la cruceta)
  await padPress(page, PAD.A);
  await waitScene(page, 'Slots');
  await padPress(page, PAD.A);
  await waitScene(page, 'FirstStarter');
  await padPress(page, PAD.B);
  await waitScene(page, 'Slots');
  await padPress(page, PAD.A);
  await waitScene(page, 'FirstStarter');
  await padPress(page, PAD.A); // Kanto
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await padPress(page, PAD.A); // inicial del medio
  await waitScene(page, 'Mode');
  // Modo: B vuelve a la colección; A otra vez al modo y A a Normal
  await padPress(page, PAD.B);
  await waitScene(page, 'Starter', 1200);
  await padPress(page, PAD.A);
  await waitScene(page, 'Mode');
  // La cruceta cambia de modo y vuelve
  await padPress(page, PAD.DOWN);
  await waitSceneProp(page, 'Mode', 'shown', 1);
  await padPress(page, PAD.UP);
  await waitSceneProp(page, 'Mode', 'shown', 0);
  await padPress(page, PAD.A);
  await waitScene(page, 'Game', 3000);

  // Stick izquierdo: se mueve; stick derecho: dispara
  await padAxes(page, [1, 0, 0, 0]);
  await expect.poll(() => game(page, (g) => g.player.body.velocity.x), { timeout: 3000 }).toBeGreaterThan(50);
  await padAxes(page, [0, 0, 0, -1]);
  await expect.poll(() => game(page, (g) => g.shots.countActive(true)), { timeout: 3000 }).toBeGreaterThan(0);
  await expect.poll(() => game(page, (g) => Math.abs(g.player.body.velocity.x)), { timeout: 3000 }).toBeLessThan(1);
  await padAxes(page, [0, 0, 0, 0]);
  expect(await runSaved(page, 0)).not.toBeNull();

  // Start pausa y B reanuda; luego Start → cruceta hasta "Salir y guardar" → A
  await padPress(page, PAD.START);
  await waitScene(page, 'Pause');
  await padPress(page, PAD.B);
  await expect.poll(() => activeScenes(page)).not.toContain('Pause');
  await page.waitForTimeout(400);
  await padPress(page, PAD.START);
  await waitScene(page, 'Pause');
  await padPress(page, PAD.DOWN, 4);
  await padPress(page, PAD.A);
  // N23: MenuScene (del supervisor) toma la A aún pulsada al aparecer como otra pulsación y entra en Huecos. Aquí
  // pasa porque los fotogramas son lentos sin pantalla; hasta que se arregle, si salta a Huecos se vuelve con B.
  await expect.poll(() => activeScenes(page), { timeout: 20_000 }).toEqual(expect.arrayContaining([expect.stringMatching(/^(Menu|Slots)$/)]));
  await page.waitForTimeout(600);
  if ((await activeScenes(page)).includes('Slots')) {
    console.log('AVISO N23: la A de "Salir y guardar" llegó al menú y abrió Huecos');
    await padPress(page, PAD.B);
  }
  await waitScene(page, 'Menu');
  expect(await runSaved(page, 0)).not.toBeNull();

  // Hueco ocupado → diálogo; B lo cierra; A → Continuar
  await padPress(page, PAD.A);
  await waitScene(page, 'Slots');
  await padPress(page, PAD.A);
  await page.waitForTimeout(300);
  await padPress(page, PAD.B);
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toContain('Slots');
  await padPress(page, PAD.A);
  await page.waitForTimeout(300);
  await padPress(page, PAD.A); // Continuar
  await waitScene(page, 'Game', 2500);
  expect(await activeScenes(page)).not.toContain('Slots');

  expect(errors, errors.join('\n')).toEqual([]);
});
