const CACHE_VERSION = "yiqi-aa-v1";
const SCOPE_URL = new URL(self.registration.scope);
const shellUrl = (path) => new URL(path, SCOPE_URL).toString();
const APP_SHELL = [
  shellUrl("./"),
  shellUrl("index.html"),
  shellUrl("manifest.webmanifest"),
  shellUrl("icons/icon.svg"),
  shellUrl("icons/icon-192.png"),
  shellUrl("icons/icon-512.png")
];

async function cacheBuiltAssets(cache) {
  const indexUrl = shellUrl("index.html");
  const response = await fetch(indexUrl, { cache: "no-store" });
  if (!response.ok) return;

  const html = await response.clone().text();
  await cache.put(indexUrl, response);

  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.includes("assets/"))
    .map((url) => new URL(url, SCOPE_URL).toString());

  await Promise.all(assetUrls.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => caches.open(CACHE_VERSION))
      .then((cache) => cacheBuiltAssets(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(shellUrl("index.html"), copy));
          return response;
        })
        .catch(() => caches.match(shellUrl("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
