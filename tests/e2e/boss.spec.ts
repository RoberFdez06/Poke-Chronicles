// Ataques del jefe en el navegador (T26): se saca al jefe en la sala inicial y se le hace invocar ayudantes.
// Comprueba que salen, que tienen menos vida, que no pasan del máximo y que se van al caer el jefe.
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, press, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

type Game = {
  spawnBoss(): void;
  bossSummon(b: unknown, ai: unknown): void;
  finish(won: boolean, msg: string): void;
  killEnemy(e: unknown): void;
  enemies: { getChildren(): { active: boolean; getData(k: string): unknown }[] };
};
const game = (page: Page, fn: string) =>
  page.evaluate((code) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): Game } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', code)(g);
  }, fn);

test('el jefe invoca ayudantes con aviso y se van con él', async ({ page }) => {
  test.setTimeout(120_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
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
  await page.waitForTimeout(1500);

  // T37: los avisos van en tarjetas en la franja derecha (como mucho 4 a la vez)
  await game(page, `for (let k = 1; k <= 5; k++) g.notify('Aviso ' + k + '\\nSegunda línea del aviso ' + k, { kind: k % 2 ? 'reward' : 'danger' });`);
  await page.waitForTimeout(500);
  expect(await game(page, 'return g.toasts.cards.filter((c) => !c.leaving).length;')).toBe(4);
  await page.screenshot({ path: 'test-results/screens/14b-avisos.png' });

  const helpers = 'return g.enemies.getChildren().filter((e) => e.active && e.getData("helper")).length;';
  // Que no muera mientras se prueba (el jefe y sus ayudantes le pegan)
  await game(page, 'g.invulnUntil = 1e12; g.spawnBoss();');
  const boss = 'const b = g.enemies.getChildren().find((e) => e.active && e.getData("ai")?.boss);';
  await game(page, `${boss} g.bossSummon(b, b.getData("ai"));`);
  // Antes de salir hay aviso; luego aparecen 2 (fase 1)
  expect(await game(page, helpers)).toBe(0);
  await expect.poll(() => game(page, helpers), { timeout: 3000 }).toBe(2);
  // Con menos vida que un enemigo normal (0,6×) y sin pasar del máximo de 4
  await game(page, `${boss} g.bossSummon(b, b.getData("ai"));`);
  await expect.poll(() => game(page, helpers), { timeout: 3000 }).toBe(4);
  await game(page, `${boss} g.bossSummon(b, b.getData("ai"));`);
  await page.waitForTimeout(1200);
  expect(await game(page, helpers)).toBe(4);
  await page.screenshot({ path: 'test-results/screens/15-invocacion.png' });
  // Al caer el jefe, se van
  await game(page, `${boss} g.killEnemy(b);`);
  expect(await game(page, helpers)).toBe(0);
  expect(errors).toEqual([]);
});

test('al acabar: resumen, historial y vuelta al menú (T28)', async ({ page }) => {
  test.setTimeout(120_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
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
  await page.waitForTimeout(1500);

  // Pierdes: se apunta en el historial y, con R, se ve el resumen
  await game(page, 'g.hp = 0; g.finish(false, "Has caído");');
  await page.waitForTimeout(800);
  await press(page, 'r');
  await waitScene(page, 'Summary', 1200);
  await page.screenshot({ path: 'test-results/screens/16-resumen.png' });
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('pokeisaac.history') ?? '[]'));
  expect(history).toHaveLength(1);
  expect(history[0].won).toBe(false);
  // Historial (segunda opción) y Esc vuelve al menú
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await waitScene(page, 'History', 1200);
  await page.screenshot({ path: 'test-results/screens/17-historial.png' });
  await press(page, 'Escape');
  await waitScene(page, 'Menu');
  // Desde Partidas: el botón Historial (opción 4: arriba dos veces desde el hueco 1) y Esc vuelve a Partidas
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'ArrowUp');
  await press(page, 'Enter');
  await waitScene(page, 'History');
  await press(page, 'Escape');
  await waitScene(page, 'Slots');
  expect(errors).toEqual([]);
});
