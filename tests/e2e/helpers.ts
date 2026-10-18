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
  moves: [],
});

/** Responde a PokeAPI y a los sprites con datos falsos (las pruebas no dependen de internet). */
export async function mockPokeApi(page: Page) {
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
    await page.route(pattern, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } }),
    );
  }
}

/** Errores de consola y de página: las pruebas fallan si hay alguno. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
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
