// Recorrido completo solo con ratón (T29): título → menú → huecos → primer inicial → modo → partida → moverse y
// disparar → pausa → salir y guardar → continuar, y "← Volver" en cada pantalla. Sin tocar el teclado.
// Falla si hay errores en consola.
import { test, expect, type Page } from '@playwright/test';
import { activeScenes, clickText, collectErrors, mockPokeApi, runSaved, waitScene, waitSceneProp, toMenu } from './helpers';

test.use({ viewport: { width: 1280, height: 720 } });

type G = { player: { x: number; y: number; body: { velocity: { x: number; y: number } } }; shots: { countActive(a: boolean): number }; cameras: { main: { worldView: { x: number; y: number }; zoom: number; x: number; y: number } } };
const game = <T>(page: Page, f: (g: G) => T): Promise<T> =>
  page.evaluate((src) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', `return (${src})(g)`)(g);
  }, f.toString()) as Promise<T>;

/** Punto de la pantalla (en la página) donde se ve el jugador, desplazado (dx, dy) en el mundo. */
async function nearPlayer(page: Page, dx: number, dy: number) {
  const p = await page.evaluate(
    ([ddx, ddy]) => {
      const gm = (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__;
      const sc = gm.scene.getScene('Game') as Phaser.Scene & { player: Phaser.GameObjects.Sprite };
      const cam = sc.cameras.main;
      return {
        x: ((sc.player.x + ddx - cam.worldView.x) * cam.zoom + cam.x) / gm.scale.width,
        y: ((sc.player.y + ddy - cam.worldView.y) * cam.zoom + cam.y) / gm.scale.height,
      };
    },
    [dx, dy] as const,
  );
  const box = (await page.locator('canvas').boundingBox())!;
  return { x: box.x + p.x * box.width, y: box.y + p.y * box.height };
}

test('con ratón: se juega, se guarda, se continúa y "Volver" vuelve atrás', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  const box = (await page.locator('canvas').boundingBox())!;
  await toMenu(page, () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2));

  // Menú → Modos y "Volver"
  await clickText(page, 'Menu', 'Jugar');
  await waitScene(page, 'Mode');
  await clickText(page, 'Mode', '← Volver');
  await waitScene(page, 'Menu');

  // Primera partida: modo Normal → hueco vacío → región ("Volver" a los huecos) → inicial → partida
  await clickText(page, 'Menu', 'Jugar');
  await waitScene(page, 'Mode');
  await clickText(page, 'Mode', 'Normal');
  await waitScene(page, 'Slots');
  await clickText(page, 'Slots', 'Hueco 1');
  await waitScene(page, 'FirstStarter');
  await clickText(page, 'FirstStarter', '← Volver');
  await waitScene(page, 'Slots');
  await clickText(page, 'Slots', 'Hueco 1');
  await waitScene(page, 'FirstStarter');
  await clickText(page, 'FirstStarter', 'Kanto');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await clickText(page, 'FirstStarter', 'Charmander');
  await waitScene(page, 'Game', 3000);

  // Mantener el clic derecho lleva al Pokémon hacia el cursor
  const right = await nearPlayer(page, 200, 0);
  await page.mouse.move(right.x, right.y);
  await page.mouse.down({ button: 'right' });
  await expect.poll(() => game(page, (g) => g.player.body.velocity.x), { timeout: 3000 }).toBeGreaterThan(50);
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => game(page, (g) => Math.abs(g.player.body.velocity.x)), { timeout: 3000 }).toBeLessThan(1);
  // Mantener el clic izquierdo dispara hacia el cursor
  const up = await nearPlayer(page, 0, -150);
  await page.mouse.move(up.x, up.y);
  await page.mouse.down();
  await expect.poll(() => game(page, (g) => g.shots.countActive(true)), { timeout: 3000 }).toBeGreaterThan(0);
  await page.mouse.up();
  expect(await runSaved(page, 0)).not.toBeNull();

  // Pausa con el botón ❚❚ del HUD → "Salir y guardar"
  await clickText(page, 'Game', '❚❚', 'hud');
  await waitScene(page, 'Pause');
  await clickText(page, 'Pause', 'Reanudar');
  await expect.poll(() => activeScenes(page)).not.toContain('Pause');
  await page.waitForTimeout(300);
  await clickText(page, 'Game', '❚❚', 'hud');
  await waitScene(page, 'Pause');
  await clickText(page, 'Pause', 'Salir y guardar');
  await waitScene(page, 'Menu');
  expect(await runSaved(page, 0)).not.toBeNull();

  // Continuar desde el hueco (diálogo: Cancelar primero, luego Continuar)
  await clickText(page, 'Menu', 'Jugar');
  await waitScene(page, 'Mode');
  await clickText(page, 'Mode', 'Normal');
  await waitScene(page, 'Slots');
  await clickText(page, 'Slots', 'Hueco 1');
  await page.waitForTimeout(300);
  await clickText(page, 'Slots', 'Cancelar');
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toContain('Slots');
  await clickText(page, 'Slots', 'Hueco 1');
  await page.waitForTimeout(300);
  await clickText(page, 'Slots', 'Continuar esta');
  await waitScene(page, 'Game', 2500);
  expect(await activeScenes(page)).not.toContain('Slots');

  expect(errors, errors.join('\n')).toEqual([]);
});
