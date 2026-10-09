// Phone PWA static app shell only: never cache photos or user JSON.
const NAME = "gro-field-scout-shell-v1";
const ASSETS = [
  "./", "./index.html", "./style.css", "./app.mjs",
  "./scout-core.mjs", "./gro-hold.mjs", "./stable.mjs",
  "./manifest.webmanifest", "./gro-mark.svg",
  "./glean.html", "./glean-ui.mjs", "./glean-quest.mjs", "./glean-example.json"
];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith("gro-field-scout-shell-") && key !== NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" ||
      !urls.has(new URL(event.request.url).href)) return;
  event.respondWith(caches.open(NAME).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    // Only fixed first-party app source files may be retrieved this way.
    return fetch(event.request);
  }));
});
