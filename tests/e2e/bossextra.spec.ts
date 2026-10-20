// T50: los cuatro ataques extra del jefe en el navegador (y el minijefe), sin errores en consola.
import { test, expect, type Page } from '@playwright/test';
import { activeScenes, collectErrors, mockPokeApi, press, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, code: string) =>
  page.evaluate((c) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', c)(g);
  }, code);

test('espiral, onda expansiva, láser giratorio y zona de peligro', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitScene(page, 'Title', 1500);
  await toMenu(page);
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
  await page.waitForTimeout(1200);
  await game(page, 'g.spawnBoss();');
  await waitScene(page, 'BossIntro', 600);
  await press(page, 'Enter');
  await expect.poll(() => activeScenes(page)).not.toContain('BossIntro');
  const boss = 'const b = g.enemies.getChildren().find((e) => e.active && e.getData("ai")?.boss); const ai = b.getData("ai");';
  // El jefe tiene sus 2 extra del bioma
  expect((await game(page, `${boss} return ai.attacks.filter((a) => ["spiral","shockwave","laser","hazard"].includes(a)).length`)) as number).toBe(2);
  // Que no ataque solo durante la prueba
  await game(page, `${boss} ai.nextAttack = 1e12; g.hp = 1e6; g.stats.maxHp = 1e6;`);

  // Espiral: salen disparos enemigos
  await game(page, `${boss} g.foeShots.clear(true, true); g.bossExtra(b, ai, "spiral", 2);`);
  await expect.poll(() => game(page, 'return g.foeShots.countActive(true)'), { timeout: 5000 }).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: 'test-results/screens/36-espiral.png' });

  // Zona de peligro: una cae donde estás y estalla
  await game(page, 'g.invulnUntil = 0; window.__hp0 = g.hp;');
  await game(page, `${boss} g.bossExtra(b, ai, "hazard", 1);`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/screens/37-zonas.png' });
  await expect.poll(() => game(page, 'return g.hp < window.__hp0'), { timeout: 20000 }).toBe(true);

  // Láser: el jugador al lado del jefe, en la línea del rayo
  await game(page, `${boss} g.invulnUntil = 0; window.__hp0 = g.hp; g.bossExtra(b, ai, "laser", 1);`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/screens/38-laser.png' });
  await game(page, `${boss} g.player.body.reset(b.x + 120, b.y); g.invulnUntil = 0;`);
  await expect.poll(() => game(page, `${boss} g.player.body.reset(b.x + 60, b.y + 4); g.invulnUntil = 0; return g.hp < window.__hp0`), { timeout: 20000, intervals: [100] }).toBe(true);

  // Onda expansiva
  await game(page, `${boss} g.invulnUntil = 0; g.bossExtra(b, ai, "shockwave", 2);`);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'test-results/screens/39-onda.png' });

  // Minijefe con un ataque extra (sin errores)
  await game(page, 'g.spawnMiniboss();');
  await page.waitForTimeout(400);
  await game(page, 'const m = g.enemies.getChildren().find((e) => e.active && e.getData("miniboss")); if (m) g.bossExtra(m, m.getData("ai"), "hazard", 1);');
  await page.waitForTimeout(2500);

  expect(errors, errors.join('\n')).toEqual([]);
});
