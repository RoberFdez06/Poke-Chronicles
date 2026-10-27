// Service worker de Poké Chronicles (T42): caché persistente de lo descargado de PokeAPI, sprites (PokeAPI y
// SpriteCollab) y gritos. Primero la caché: lo ya visto carga al instante y funciona sin conexión.
// Los 404 también se guardan (Pokémon sin sprite en SpriteCollab), para no volver a pedirlos.
const CACHE = 'pokeisaac-datos-v1';
const HOSTS = ['pokeapi.co', 'raw.githubusercontent.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  // Cachés de versiones anteriores fuera
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pokeisaac-datos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!HOSTS.includes(url.hostname)) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      // Sin red y sin copia: el fetch falla y el juego tira del paquete de public/data/offline/
      const res = await fetch(req);
      if (res.ok || res.status === 404) await cache.put(req, res.clone()).catch(() => undefined);
      return res;
    }),
  );
});
