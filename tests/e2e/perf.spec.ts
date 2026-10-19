// T41: medida de rendimiento. Sala con muchos enemigos y disparando sin parar, con la CPU frenada (×4, como un PC
// flojo). Apunta FPS medio y milisegundos de trabajo por fotograma (de prestep a postrender) en la consola de la prueba.
import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mockPokeApi, press, waitScene, waitSceneProp } from './helpers';

test.use({ viewport: { width: 1920, height: 1080 } });

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

test('rendimiento: 30 enemigos y disparo continuo con la CPU ×4', async ({ page }) => {
  test.setTimeout(150_000);
  await mockPokeApi(page);
  const errors = collectErrors(page);
  // PERF_LOW=1: con Ajustes > Efectos visuales: Bajos
  if (process.env.PERF_LOW) await page.addInitScript(() => localStorage.setItem('pokeisaac.fx', JSON.stringify({ low: true, showFps: true })));
  await toGame(page);
  // Mide el trabajo de cada fotograma: de 'prestep' a 'postrender' del juego
  await page.evaluate(() => {
    const g = (window as unknown as { __POKEISAAC__: Phaser.Game & { __perf?: number[] } }).__POKEISAAC__;
    g.__perf = [];
    let t0 = 0;
    g.events.on('prestep', () => (t0 = performance.now()));
    g.events.on('postrender', () => g.__perf!.push(performance.now() - t0));
    const s = g.scene.getScene('Game') as unknown as { spawnEnemies(n: number): void; invulnUntil: number; hp: number };
    // Que no se muera durante la medida
    s.invulnUntil = Number.POSITIVE_INFINITY;
    s.spawnEnemies(30);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.evaluate(() => ((window as unknown as { __POKEISAAC__: { __perf: number[] } }).__POKEISAAC__.__perf.length = 0));
  // Perfil de CPU (PERF_PROFILE=1): las funciones que más tiempo propio gastan
  const profile = !!process.env.PERF_PROFILE;
  if (profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
  }
  const t0 = Date.now();
  await page.waitForTimeout(6000);
  if (profile) {
    const { profile: prof } = (await cdp.send('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number }[] } };
    const self = new Map<string, number>();
    let total = 0;
    for (const n of prof.nodes) {
      const k = `${n.callFrame.functionName || '(anónima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
      self.set(k, (self.get(k) ?? 0) + (n.hitCount ?? 0));
      total += n.hitCount ?? 0;
    }
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25);
    console.log('PERFIL\n' + top.map(([k, v]) => `${((v / total) * 100).toFixed(1)}% ${k}`).join('\n'));
  }
  const secs = (Date.now() - t0) / 1000;
  const work = await page.evaluate(() => (window as unknown as { __POKEISAAC__: { __perf: number[] } }).__POKEISAAC__.__perf.slice());
  await page.keyboard.up('ArrowRight');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const fps = work.length / secs;
  const avg = work.reduce((a, b) => a + b, 0) / Math.max(1, work.length);
  const p95 = [...work].sort((a, b) => a - b)[Math.floor(work.length * 0.95)] ?? 0;
  const objects = await page.evaluate(() => (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__.scene.getScene('Game').children.length);
  const byType = await page.evaluate(() => {
    const sc = (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__.scene.getScene('Game');
    const cam = sc.cameras.main;
    const out: Record<string, number> = {};
    for (const o of sc.children.list) {
      const k = o.type + ((o as unknown as { willRender(c: Phaser.Cameras.Scene2D.Camera): boolean }).willRender(cam) ? '' : ' (no se pinta)');
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  });
  console.log('OBJETOS ' + JSON.stringify(byType));
  console.log(`RENDIMIENTO fps=${fps.toFixed(1)} trabajo_medio=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms objetos=${objects}`);
  // Antes de la T41 daba ~3,5; con solo la sala actual en cámara, ~6,5 (WebGL por software en Chromium sin pantalla)
  expect(fps).toBeGreaterThan(4);
  expect(errors).toEqual([]);
});
