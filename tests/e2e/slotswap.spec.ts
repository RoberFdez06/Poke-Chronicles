// Poder nuevo con las 4 ranuras llenas: se elige ranura en SlotSwap y se recoge en el acto (antes tardaba ~1,2 s y
// se volvía a abrir la pantalla, porque pickItem miraba el enfriamiento que la propia elección acababa de poner).
import { test, expect } from '@playwright/test';
import { activeScenes, mockPokeApi, press, waitScene, waitSceneProp, toMenu } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

test('con las ranuras llenas, el poder elegido se recoge al momento', async ({ page }) => {
  test.setTimeout(120_000);
  await mockPokeApi(page);
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
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = (window as any).__POKEISAAC__.scene.getScene('Game');
    const mv = (n: string) => ({ id: 1, name: n, type: 'fire', power: 40, shape: 'bolt', cooldown: 900 });
    g.slots = [mv('a'), mv('b'), mv('c'), mv('d')];
    g.spawnPickup(g.current.id, g.player.x + 200, g.player.y, { kind: 'move', move: mv('nuevo') });
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = (window as any).__POKEISAAC__.scene.getScene('Game');
    const s = g.pickups.getChildren().find((c: any) => c.active && c.getData('item')?.move?.name === 'nuevo');
    g.player.body.reset(s.x, s.y);
    (window as any).__opens = [];
    const ask = g.askSlot.bind(g);
    g.askSlot = (...a: unknown[]) => { const v = ask(...a); (window as any).__opens.push([Math.round(g.time.now), v]); return v; };
  });
  await waitScene(page, 'SlotSwap', 900);
  const t0 = Date.now();
  await press(page, 'Enter'); // ranura 1
  let picked = -1;
  for (let i = 0; i < 60; i++) {
    const r = await page.evaluate(() => {
      const g = (window as any).__POKEISAAC__.scene.getScene('Game');
      return { left: g.pickups.getChildren().some((c: any) => c.active && c.getData('item')?.move?.name === 'nuevo'), slot0: g.slots[0]?.name };
    });
    if (!r.left) { picked = Date.now() - t0; break; }
    await page.waitForTimeout(100);
  }
  expect(picked, 'se recoge enseguida').toBeGreaterThanOrEqual(0);
  expect(picked).toBeLessThan(1000);
  expect(await page.evaluate(() => (window as any).__opens.length), 'la pantalla de cambio se abre una vez').toBe(1);
  expect(await page.evaluate(() => (window as any).__POKEISAAC__.scene.getScene('Game').slots[0].name)).toBe('nuevo');
  expect(await activeScenes(page)).not.toContain('SlotSwap');
});
