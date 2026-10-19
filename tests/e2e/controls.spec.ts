// T35: pantalla de Controles por secciones desde la pausa, y controles táctiles solo en móvil.
import { test, expect, type Page } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, press, waitScene, waitSceneProp } from './helpers';

type Game = { touch?: { move: { x: number; y: number } }; player: { body: { velocity: { x: number; y: number } } } };
const gameProp = <T>(page: Page, f: (g: Game) => T) =>
  page.evaluate(
    (src) => {
      const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
      return new Function('g', `return (${src})(g)`)(g);
    },
    f.toString(),
  ) as Promise<T>;

/** Del título a la partida, todo con teclado. */
async function toGame(page: Page) {
  await page.goto('/');
  await waitScene(page, 'Title', 2500);
  await press(page, 'Enter');
  await waitScene(page, 'Menu', 1200);
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
}

test.describe('PC', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('Controles por secciones desde la pausa, con teclado; sin controles táctiles', async ({ page }) => {
    test.setTimeout(120_000);
    await mockPokeApi(page);
    const errors = collectErrors(page);
    await toGame(page);
    expect(await gameProp(page, (g) => g.touch === undefined)).toBe(true);
    await press(page, 'Escape');
    await waitScene(page, 'Pause');
    // Pausa: Continuar, Ajustes, Controles…
    await press(page, 'ArrowDown', 2);
    await press(page, 'Enter');
    await waitScene(page, 'Controls');
    // Teclado, Ratón y Mando (sin Táctil en PC)
    await waitSceneProp(page, 'Controls', 'tab', 0);
    expect(await page.evaluate(() => (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): { modes: string[] } } } }).__POKEISAAC__.scene.getScene('Controls').modes)).toEqual(['keyboard', 'mouse', 'gamepad']);
    await press(page, 'ArrowRight');
    await waitSceneProp(page, 'Controls', 'tab', 1);
    await page.screenshot({ path: 'test-results/screens/21-controles.png' });
    await press(page, 'ArrowLeft', 2);
    await waitSceneProp(page, 'Controls', 'tab', 2);
    // Esc cierra solo los Controles: la pausa sigue
    await press(page, 'Escape');
    await expect.poll(() => activeScenes(page)).not.toContain('Controls');
    expect(await activeScenes(page)).toContain('Pause');
    await press(page, 'Escape');
    await expect.poll(() => activeScenes(page)).not.toContain('Pause');
    expect(errors).toEqual([]);
  });
});

test.describe('Móvil', () => {
  test.use({ viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true });

  test('joysticks táctiles: el izquierdo mueve al Pokémon', async ({ page }) => {
    test.setTimeout(120_000);
    await mockPokeApi(page);
    const errors = collectErrors(page);
    await toGame(page);
    expect(await gameProp(page, (g) => g.touch !== undefined)).toBe(true);
    await page.screenshot({ path: 'test-results/screens/22-tactil.png' });
    // Joystick izquierdo: centro en (120, 968) de 1920×1080; se arrastra hacia la derecha
    const box = (await page.locator('canvas').boundingBox())!;
    const at = (x: number, y: number) => [box.x + (x * box.width) / 1920, box.y + (y * box.height) / 1080] as const;
    const [sx, sy] = at(120, 968);
    const [ex, ey] = at(200, 968);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 4 });
    await expect.poll(() => gameProp(page, (g) => g.player.body.velocity.x), { timeout: 3000 }).toBeGreaterThan(50);
    await page.mouse.up();
    await expect.poll(() => gameProp(page, (g) => Math.abs(g.player.body.velocity.x)), { timeout: 3000 }).toBeLessThan(1);
    expect(errors).toEqual([]);
  });
});
