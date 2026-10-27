// T48: los eventos nuevos de sala funcionan en el navegador (rival, fuente, sala del tiempo y huevo con ayudante),
// sin errores en consola. Se lanzan a mano en la primera sala.
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, press, toMenu, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

const game = (page: Page, code: string) =>
  page.evaluate((c) => {
    const g = (window as unknown as { __POKEISAAC__: { scene: { getScene(k: string): unknown } } }).__POKEISAAC__.scene.getScene('Game');
    return new Function('g', c)(g);
  }, code);

test('eventos de la T48 en la partida', async ({ page }) => {
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
  await game(page, 'g.invulnUntil = 1e12;');

  // Fuente: pagar sin monedas avisa; beber gratis cura y cansa
  await game(page, 'g.hp = 10; g.coins = 0; g.startEvent(g.current, "fountain");');
  await page.screenshot({ path: 'test-results/screens/30-fuente.png' });
  await game(page, 'g.eventSpots[0].use();');
  expect(await game(page, 'return g.hp')).toBe(10);
  const speed = (await game(page, 'return g.stats.speed')) as number;
  await game(page, 'g.eventSpots[1].use();');
  expect(await game(page, 'return g.hp')).toBeGreaterThan(10);
  expect(await game(page, 'return g.tiredRooms')).toBe(2);
  expect((await game(page, 'return g.stats.speed')) as number).toBeLessThan(speed);

  // Huevo: se coge, y al limpiar 2 salas eclosiona
  await game(page, 'g.eventsDone.clear(); g.startEvent(g.current, "egg");');
  await page.screenshot({ path: 'test-results/screens/31-huevo.png' });
  await game(page, 'g.eventSpots[0].use();');
  expect(await game(page, 'return g.eggLeft')).toBe(2);
  await game(page, 'g.onRoomClearedT48(); g.onRoomClearedT48();');
  expect(await game(page, 'return g.eggLeft')).toBe(0);
  expect(await game(page, 'return g.tiredRooms')).toBe(0);
  // Si salió ayudante, ataca a un enemigo cercano
  await game(page, 'g.allyId = Number(g.foeKinds[0].key.replace("foe-", "")); g.spawnAlly(); g.spawnEnemies(1);');
  expect(await game(page, 'return !!g.ally')).toBe(true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/screens/32-ayudante.png' });

  // Sala del tiempo: el reloj se acaba y entran más
  await game(page, 'g.enemies.clear(true, true); g.eventsDone.clear(); g.cleared.delete(g.current.id); g.startEvent(g.current, "timeTrial");');
  const before = (await game(page, 'return g.enemies.getChildren().length')) as number;
  await game(page, 'g.timeTrial.until = g.time.now + 300;');
  await expect.poll(() => game(page, 'return g.timeTrial && g.timeTrial.failed'), { timeout: 5000 }).toBe(true);
  expect((await game(page, 'return g.enemies.getChildren().length')) as number).toBeGreaterThan(before);
  await page.screenshot({ path: 'test-results/screens/33-tiempo.png' });

  // Rival: tres oleadas y premio doble
  await game(page, 'g.enemies.clear(true, true); g.timeTrial.label.destroy(); g.timeTrial = undefined; g.cleared.delete(g.current.id); g.eventsDone.clear(); g.roomEvent = { roomId: g.current.id, kind: "rival" }; g.startEvent(g.current, "rival");');
  await expect.poll(() => game(page, 'return g.enemies.getChildren().length'), { timeout: 5000 }).toBeGreaterThan(0);
  const earned0 = (await game(page, 'return g.earned')) as number;
  for (let w = 1; w <= 3; w++) {
    await expect.poll(() => game(page, 'return g.enemies.getChildren().length'), { timeout: 5000 }).toBeGreaterThan(0);
    await game(page, 'for (const e of [...g.enemies.getChildren()]) { e.setActive(true); g.killEnemy(e); }');
    await page.waitForTimeout(300);
  }
  await expect.poll(() => game(page, 'return g.cleared.has(g.current.id)'), { timeout: 5000 }).toBe(true);
  expect(await game(page, 'return g.rivalWave')).toBe(0);
  expect((await game(page, 'return g.earned')) as number).toBeGreaterThan(earned0);

  expect(errors, errors.join('\n')).toEqual([]);
});
