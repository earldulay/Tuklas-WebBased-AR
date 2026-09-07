const CACHE_NAME = "tuklas-webar-v11";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/camera_para.dat",
  "/assets/tuklas-marker.patt",
  "/assets/tuklas-marker.png",
  "/assets/tuklas-marker.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Navigations (loading the app shell) always go to the network first, so
  // a fresh index.html - pointing at the current build's hashed JS/CSS - is
  // used whenever the device is online. Only offline falls back to cache.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Everything else (hashed build assets, marker images, the manifest):
  // stale-while-revalidate. Serve instantly from cache if present, but
  // always refetch in the background and update the cache, so the next
  // load - even without a full reload - has the latest version. Hashed
  // filenames change per build, so this never serves an old build's asset
  // under a new build's URL.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_NOW") {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  }
});
