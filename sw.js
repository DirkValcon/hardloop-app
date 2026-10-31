// Service worker: de app werkt ook zonder internet (bijvoorbeeld in de sportschool).
// Eerst van internet (altijd de nieuwste versie, nooit oude en nieuwe bestanden door elkaar),
// zonder of met traag internet uit de cache. Verhoog VERSIE bij een nieuwe release.
const VERSIE = 'loopschema-v10';
const WACHTTIJD_MS = 4000;
const BESTANDEN = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/supabase.js',
  'js/app.js', 'js/account.js', 'js/afronden.js', 'js/aanpassingen.js', 'js/calorieen.js', 'js/config.js', 'js/datum.js', 'js/generator.js', 'js/instellingen.js',
  'js/loopscherm.js', 'js/melding.js', 'js/onboarding.js', 'js/opgeslagen.js', 'js/opmaak.js', 'js/overzicht.js', 'js/plan.js', 'js/profiel.js',
  'js/resultaten.js', 'js/schema.js', 'js/schemaweergave.js', 'js/speler.js', 'js/sync.js', 'js/tijd.js', 'js/vandaag.js',
  'js/voortgang.js', 'js/voortgangweergave.js', 'js/zones.js', 'js/zonesweergave.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIE).then((c) => c.addAll(BESTANDEN.map((b) => new Request(b, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((sleutels) => Promise.all(sleutels.filter((k) => k !== VERSIE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSIE).then(async (cache) => {
    const vers = fetch(e.request, { cache: 'no-cache' }).then((antwoord) => {
      if (antwoord.ok) cache.put(e.request, antwoord.clone());
      return antwoord;
    });
    const bewaard = await cache.match(e.request, { ignoreSearch: true });
    if (!bewaard) return vers;
    const traag = new Promise((ok) => setTimeout(() => ok(bewaard), WACHTTIJD_MS));
    return Promise.race([vers.catch(() => bewaard), traag]);
  }));
});
