import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePmd, encodePmd, hueRotatePixels, pmdAvailable, pmdFolder, pmdMega, pmdPlain, pmdShiny, shinyHue, REGIONAL_PMD_FORM } from '../src/data/pmdForms.ts';
import { animDataUrl, animSheetUrl } from '../src/data/pmdAnim.ts';
import { REGIONAL_FORMS } from '../src/data/regionalForms.ts';

test('codificar y descodificar ids de hoja', () => {
  const r = { species: 10091, form: 0, shiny: true };
  assert.deepEqual(decodePmd(encodePmd(r)), r);
  assert.deepEqual(decodePmd(encodePmd({ species: 6, form: 1, shiny: false })), { species: 6, form: 1, shiny: false });
  assert.equal(pmdPlain(pmdShiny(25)), 25);
  assert.equal(pmdShiny(pmdShiny(25)), pmdShiny(25));
});

test('carpetas de SpriteCollab: normal, shiny, regional y mega', () => {
  assert.equal(pmdFolder(25), '0025');
  assert.equal(pmdFolder(pmdShiny(25)), '0025/0000/0001');
  assert.equal(pmdFolder(10091), '0019/0001');
  assert.equal(pmdFolder(10161), '0052/0002'); // Meowth de Galar (la 0001 es Alola)
  assert.equal(pmdFolder(pmdShiny(10091)), '0019/0001/0001');
  assert.equal(pmdFolder(pmdMega(6)!), '0006/0001');
  assert.equal(pmdFolder(pmdMega(718)!), '0718/0005');
  assert.equal(pmdMega(3), null); // sin hoja de la mega
  assert.equal(pmdFolder(10180), null); // Stunfisk de Galar: no hay
  assert.equal(pmdFolder(1025), null);
  assert.equal(pmdAvailable(9999 + 2), false);
});

test('las URL siguen igual para especies normales y usan la carpeta de forma si toca', () => {
  assert.ok(animDataUrl(25).endsWith('/sprite/0025/AnimData.xml'));
  assert.ok(animDataUrl(10091).endsWith('/sprite/0019/0001/AnimData.xml'));
  assert.ok(animSheetUrl(pmdShiny(4), 'Walk').endsWith('/sprite/0004/0000/0001/Walk-Anim.png'));
});

test('todas las formas regionales del juego tienen carpeta o están marcadas sin hoja', () => {
  for (const f of REGIONAL_FORMS) assert.ok(REGIONAL_PMD_FORM.has(f.id) || !pmdAvailable(f.id), f.name);
});

test('el giro de tono del shiny cambia el color y respeta la transparencia', () => {
  const px = [200, 40, 40, 255, 10, 20, 30, 0];
  hueRotatePixels(px, 120);
  assert.ok(px[1] > px[0], 'el rojo pasa a verde');
  assert.deepEqual(px.slice(4), [10, 20, 30, 0]);
  const gray = [100, 100, 100, 255];
  hueRotatePixels(gray, 200);
  for (const c of gray.slice(0, 3)) assert.ok(Math.abs(c - 100) <= 1, 'el gris no cambia');
  for (let i = 1; i < 300; i++) assert.ok(shinyHue(i) >= 60 && shinyHue(i) < 300);
});
