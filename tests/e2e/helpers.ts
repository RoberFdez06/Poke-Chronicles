// Ayudas de las pruebas en navegador: PokeAPI falsa, saber qué pantalla está activa y recoger errores de consola.
import { expect, type Page } from '@playwright/test';

/** PNG de 1 × 1 transparente: vale para todos los sprites. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const SPRITE = 'https://pokeapi.test/sprite.png';

const idOf = (url: string) => Number(url.replace(/\/$/, '').split('/').pop());

const pokemon = (id: number) => ({
  id,
  name: `poke${id}`,
  types: [{ type: { name: id % 2 ? 'fire' : 'water' } }],
  sprites: { front_default: SPRITE, back_default: SPRITE, front_shiny: SPRITE, back_shiny: SPRITE, other: { 'official-artwork': { front_default: SPRITE } } },
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((name) => ({ base_stat: 70, stat: { name } })),
  cries: { latest: null },
  abilities: [{ ability: { name: id % 2 ? 'blaze' : 'torrent' }, is_hidden: false, slot: 1 }, { ability: { name: 'solar-power' }, is_hidden: true, slot: 3 }],
  moves: [],
});

/** Responde a PokeAPI y a los sprites con datos falsos (las pruebas no dependen de internet). */
/**
 * Modo local de pruebas (T45): el progreso va al localStorage del navegador como antes de las cuentas, así las
 * pruebas pueden leerlo y no se conecta a Firebase.
 */
export const useLocalSave = (page: Page) => page.addInitScript(() => localStorage.setItem('pokeisaac.dev.local', '1'));

export async function mockPokeApi(page: Page) {
  await useLocalSave(page);
  await page.route('https://pokeapi.co/**', async (route) => {
    const url = route.request().url();
    let body: unknown = {};
    if (/\/pokemon\/\d+/.test(url)) body = pokemon(idOf(url));
    else if (/\/pokemon-species\/\d+/.test(url)) {
      const id = idOf(url);
      body = {
        name: `poke${id}`,
        names: [{ name: `Poke${id}`, language: { name: 'es' } }],
        evolution_chain: { url: 'https://pokeapi.co/api/v2/evolution-chain/1/' },
      };
    } else if (url.includes('/evolution-chain/')) {
      body = { chain: { species: { name: 'x', url: 'https://pokeapi.co/api/v2/pokemon-species/99999/' }, evolves_to: [] } };
    } else if (url.includes('/type/')) body = { moves: [{ name: 'ember', url: 'https://pokeapi.co/api/v2/move/52/' }] };
    else if (url.includes('/move/')) {
      body = { id: 52, name: 'ember', names: [{ name: 'Ascuas', language: { name: 'es' } }], type: { name: 'fire' }, power: 40 };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://pokeapi.test/**', 'https://raw.githubusercontent.com/**']) {
    await page.route(pattern, (route) => {
      // Con REAL_SPRITES=1 se descargan de verdad los sprites de SpriteCollab (para revisar capturas)
      if (process.env.REAL_SPRITES && route.request().url().includes('/PMDCollab/')) return route.continue();
      // Sin sprite de SpriteCollab: el juego usa el de PokeAPI (aquí, un PNG de 1 px)
      if (route.request().url().endsWith('.xml')) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
    });
  }
}

/** Errores de consola y de página: las pruebas fallan si hay alguno. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    // Un 404 de recurso es normal: los Pokémon sin sprite en SpriteCollab usan el de PokeAPI
    if (m.type() === 'error' && !m.text().includes('status of 404')) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Pantallas (escenas) activas ahora mismo. */
export function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const g = (window as unknown as { __POKEISAAC__?: { scene: { getScenes(active: boolean): { scene: { key: string } }[] } } }).__POKEISAAC__;
    return g ? g.scene.getScenes(true).map((s) => s.scene.key) : [];
  });
}

/** Espera a que una pantalla esté activa (y deja pasar el fundido y el margen de entrada). */
export async function waitScene(page: Page, key: string, settleMs = 500) {
  await expect.poll(() => activeScenes(page), { timeout: 20_000, message: `pantalla ${key}` }).toContain(key);
  await page.waitForTimeout(settleMs);
}

/** Pulsa una tecla y deja un respiro para que el juego la lea en su update(). */
export async function press(page: Page, key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
}

/** Clic en coordenadas del juego (960 × 640). */
export async function clickAt(page: Page, x: number, y: number) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('sin canvas');
  await page.mouse.click(box.x + (x * box.width) / 960, box.y + (y * box.height) / 640);
  await page.waitForTimeout(150);
}

export const runSaved = (page: Page, slot: number) =>
  page.evaluate((s) => {
    const raw = localStorage.getItem(`pokeisaac.run.${s}`);
    return raw ? (JSON.parse(raw) as { version: number; floor: number }) : null;
  }, slot);

/** Espera a que una propiedad de una escena tenga un valor (p. ej. el paso de FirstStarter). */
export async function waitSceneProp(page: Page, key: string, prop: string, value: unknown, settleMs = 400) {
  await expect
    .poll(
      () =>
        page.evaluate(
          ([k, pr]) => {
            const g = (window as unknown as { __POKEISAAC__?: { scene: { getScene(k: string): Record<string, unknown> } } }).__POKEISAAC__;
            return g?.scene.getScene(k)?.[pr];
          },
          [key, prop] as const,
        ),
      { timeout: 20_000, message: `${key}.${prop}` },
    )
    .toBe(value);
  await page.waitForTimeout(settleMs);
}

// --- Mando simulado (T29): Playwright no tiene mando, así que se cambia navigator.getGamepads por uno falso ---

/** Botones del mando estándar (como en Phaser): A, B, X, Y, LB, RB, LT, RT, Select, Start y la cruceta. */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

/** Antes de cargar la página: un mando conectado que las pruebas mueven con padPress / padAxes. */
export const useFakePad = (page: Page) =>
  page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'Mando de prueba (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons, vibrationActuator: null };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
    window.addEventListener('load', () => {
      const ev = new Event('gamepadconnected') as Event & { gamepad: typeof pad };
      ev.gamepad = pad;
      window.dispatchEvent(ev);
    });
  });

/** Espera a que el juego dibuje `n` fotogramas más (el mando se lee por sondeo, una vez por fotograma). */
export async function waitFrames(page: Page, n = 2) {
  const frame = () => page.evaluate(() => (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__.loop.frame);
  const start = await frame();
  await expect.poll(frame, { timeout: 5000, intervals: [30] }).toBeGreaterThanOrEqual(start + n);
}

/** Pulsa y suelta un botón del mando simulado (pulsado un fotograma, suelto dos). */
export async function padPress(page: Page, button: number, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((b) => {
      const p = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[]; timestamp: number } }).__pad;
      p.buttons[b].pressed = true;
      p.buttons[b].value = 1;
      p.timestamp = performance.now();
    }, button);
    // Pulsado un solo fotograma (como un toque rápido): si no, la pantalla siguiente lo vería aún pulsado
    await waitFrames(page, 1);
    await page.evaluate((b) => {
      const p = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[]; timestamp: number } }).__pad;
      p.buttons[b].pressed = false;
      p.buttons[b].value = 0;
      p.timestamp = performance.now();
    }, button);
    await waitFrames(page);
  }
}

/** Mueve los sticks del mando simulado: [izq. x, izq. y, der. x, der. y]. */
export const padAxes = (page: Page, axes: [number, number, number, number]) =>
  page.evaluate((a) => {
    const p = (window as unknown as { __pad: { axes: number[]; timestamp: number } }).__pad;
    p.axes.splice(0, 4, ...a);
    p.timestamp = performance.now();
  }, axes);

// --- Ratón (T29): clic sobre un texto de la pantalla, esté donde esté (cámaras con zoom y bandas incluidas) ---

/**
 * Hace clic en el centro del primer texto de la escena `key` que contiene `label` (también dentro de contenedores).
 * `cam`: nombre de la cámara que lo pinta (en la partida, el HUD va en la cámara 'hud').
 */
export async function clickText(page: Page, key: string, label: string, cam = '') {
  const pos = await page.evaluate(
    ([k, l, cn]) => {
      const g = (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__;
      const sc = g.scene.getScene(k);
      const all: Phaser.GameObjects.GameObject[] = [];
      const walk = (list: Phaser.GameObjects.GameObject[]) =>
        list.forEach((o) => {
          all.push(o);
          if ((o as Phaser.GameObjects.Container).list) walk((o as Phaser.GameObjects.Container).list);
        });
      walk(sc.children.list);
      const t = all.find((o) => o.type === 'Text' && (o as Phaser.GameObjects.Text).visible && (o as Phaser.GameObjects.Text).text.includes(l)) as Phaser.GameObjects.Text | undefined;
      if (!t) return null;
      const b = t.getBounds();
      const cam = (cn && sc.cameras.getCamera(cn)) || sc.cameras.main;
      const sx = (b.centerX - cam.worldView.x) * cam.zoom + cam.x;
      const sy = (b.centerY - cam.worldView.y) * cam.zoom + cam.y;
      return { x: sx / g.scale.width, y: sy / g.scale.height };
    },
    [key, label, cam] as const,
  );
  if (!pos) throw new Error(`No hay texto "${label}" en ${key}`);
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('sin canvas');
  await page.mouse.click(box.x + pos.x * box.width, box.y + pos.y * box.height);
  await page.waitForTimeout(200);
}

/** Textos visibles de una pantalla (para escribir las pruebas). */
export const sceneTexts = (page: Page, key: string) =>
  page.evaluate((k) => {
    const sc = (window as unknown as { __POKEISAAC__: Phaser.Game }).__POKEISAAC__.scene.getScene(k);
    const out: string[] = [];
    const walk = (list: Phaser.GameObjects.GameObject[]) =>
      list.forEach((o) => {
        if (o.type === 'Text' && (o as Phaser.GameObjects.Text).visible) out.push((o as Phaser.GameObjects.Text).text);
        if ((o as Phaser.GameObjects.Container).list) walk((o as Phaser.GameObjects.Container).list);
      });
    walk(sc.children.list);
    return out;
  }, key);

/**
 * Del título al menú. El título tiene portada (para activar el sonido), intro y "pulsa para empezar": se repite la
 * entrada (`act`: tecla, clic o botón) hasta que sale el menú.
 */
export async function toMenu(page: Page, act: () => Promise<void> = () => press(page, 'Enter')) {
  for (let i = 0; i < 8 && !(await activeScenes(page)).includes('Menu'); i++) {
    await act();
    await page.waitForTimeout(500);
  }
  await waitScene(page, 'Menu', 1200);
}
