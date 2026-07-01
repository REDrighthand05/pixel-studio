const CACHE = "pixel-studio-v2";
const URLS = ["./index.html", "./app.js", "./manifest.json", "./icon.svg", "./icon.png"];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(URLS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  if (e.request.url.indexOf("gif.js") >= 0 || e.request.url.indexOf("gif.worker") >= 0) {
    e.respondWith(fetch(e.request).catch(function() { return new Response("", {status: 408}); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(r) {
      var fetchPromise = fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function() { return r; });
      return r || fetchPromise;
    })
  );
});
