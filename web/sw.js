// Service worker : met en cache la coquille statique (same-origin) pour la lecture hors-ligne.
// Les données Supabase (cross-origin) sont gérées au niveau de app.js (localStorage), pas ici.
const CACHE = 'biblio-v8';
const COQUILLE = [
  './', './index.html', './config.js', './app.js', './shelf.js', './isbn.js', './shelf-logic.mjs',
  './scan.js', './scan-logic.mjs',
  './book3d.js', './shelf.css', './manifest.webmanifest', './icon.svg',
  './vendor/supabase.js', './vendor/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // cache:'reload' force le réseau : sans lui, addAll passe par le cache HTTP du
    // navigateur et un nouveau SW peut précacher d'anciens fichiers (max-age Pages).
    caches.open(CACHE)
      .then(c => c.addAll(COQUILLE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // On ne gère que la coquille : GET same-origin. Le reste (Supabase, Open Library) va au réseau.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(req);
      const reseau = fetch(req)
        .then(rep => { if (rep && rep.ok) cache.put(req, rep.clone()); return rep; })
        .catch(() => enCache);
      if (enCache) {
        e.waitUntil(reseau);   // garde le SW vivant pour la MAJ en arrière-plan
        return enCache;
      }
      return reseau;
    })
  );
});
