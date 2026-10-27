// T51: comportamientos nuevos de enemigos en el navegador (tirador en círculo, mina, escudado y curandero).
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, press, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, code: string) =>
  page.evaluate((c) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', c)(g);
  }, code);

test('tirador, mina, escudado y curandero', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
  await press(page, 'Enter');
  await waitScene(page, 'Mode');
  await press(page, 'Enter');
  await waitScene(page, 'Slots');
  await press(page, 'Enter');
  await waitScene(page, 'FirstStarter');
  await press(page, 'Enter');
  await waitSceneProp(page, 'FirstStarter', 'step', 'starter');
  await press(page, 'Enter');
  await waitScene(page, 'Game', 3500);
  await page.waitForTimeout(1200);
  await game(page, 'g.hp = 1e6; g.stats.maxHp = 1e6;');
  const spawn = (b: string) => game(page, `const e = g.spawnEnemy(g.foeKinds[0], "${b}"); e.setData("t51", "${b}"); return true;`);
  for (const b of ['orbitShooter', 'mine', 'shielded', 'healer']) await spawn(b);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/screens/40-comportamientos.png' });

  // Escudado: de frente casi no le hace daño; por la espalda, entero
  const r = (await game(
    page,
    `const e = g.enemies.getChildren().find((o) => o.active && o.getData("t51") === "shielded"); const ai = e.getData("ai"); ai.facing = 0;
     e.setData("hp", 1000); g.hitEnemy(e, 100, undefined, e.x + 30, e.y, 0xffffff); const front = 1000 - e.getData("hp");
     e.setData("hp", 1000); g.hitEnemy(e, 100, undefined, e.x - 30, e.y, 0xffffff); const back = 1000 - e.getData("hp");
     return [front, back];`,
  )) as [number, number];
  expect(r[0]).toBeLessThan(r[1] * 0.3);

  // Curandero: cura a un herido cercano
  await game(page, 'const h = g.enemies.getChildren().find((o) => o.active && o.getData("t51") === "healer"); const o = g.enemies.getChildren().find((x) => x.active && x !== h && x.getData("t51") !== "mine"); o.body.reset(h.x + 40, h.y); o.setData("hp", 1); window.__healed = o; h.getData("ai").until = 0;');
  await expect.poll(() => game(page, 'return window.__healed.active ? window.__healed.getData("hp") : 999'), { timeout: 15000 }).toBeGreaterThan(1);

  // Mina: junto al jugador se arma y estalla
  await game(page, 'const m = g.enemies.getChildren().find((o) => o.active && o.getData("t51") === "mine"); m.body.reset(g.player.x + 50, g.player.y); window.__mine = m;');
  await expect.poll(() => game(page, 'return window.__mine.active'), { timeout: 20000 }).toBe(false);

  // Tirador en círculo: dispara
  await expect.poll(() => game(page, 'return g.foeShots.countActive(true)'), { timeout: 15000 }).toBeGreaterThan(0);

  expect(errors, errors.join('\n')).toEqual([]);
});
