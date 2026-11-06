// App instalable en móvil: manifest con iconos que existen, apaisado y metaetiquetas de index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
  id?: string;
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  orientation: string;
  icons: { src: string; sizes: string; purpose?: string }[];
};

test('manifest: nombre, inicio relativo, pantalla completa y apaisado', () => {
  assert.ok(m.name && m.short_name.length <= 16);
  assert.equal(m.start_url, './');
  assert.equal(m.id, './');
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.orientation, 'landscape');
});

test('manifest: iconos 192 y 512 «any» que existen y uno «maskable» aparte (no «any maskable» en la misma entrada)', () => {
  for (const size of ['192x192', '512x512']) {
    const i = m.icons.find((x) => x.sizes === size && (x.purpose ?? 'any') === 'any');
    assert.ok(i, size);
    assert.ok(existsSync(`public/${i.src}`), i.src);
  }
  assert.ok(m.icons.some((x) => x.purpose === 'maskable' && existsSync(`public/${x.src}`)));
  for (const i of m.icons) assert.ok(!(i.purpose ?? '').includes(' '), 'un propósito por entrada');
});

test('index.html: manifest, icono de Apple, viewport con notch y metas de app', () => {
  const h = readFileSync('index.html', 'utf8');
  assert.match(h, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(h, /apple-touch-icon/);
  assert.ok(existsSync('public/apple-touch-icon.png'));
  assert.match(h, /viewport-fit=cover/);
  assert.match(h, /name="mobile-web-app-capable"/);
  assert.match(h, /name="apple-mobile-web-app-capable"/);
});
