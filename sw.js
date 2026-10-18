/* Adronis service worker - push notifications and the offline page.
 *
 * Pages are never cached: every one is still fetched fresh (vercel.json sends
 * no-cache for HTML), so there is no offline copy to go stale. The only things
 * kept are offline.html and the logo it shows, served in place of a page when
 * the device has no connection - the installed app would otherwise show the
 * browser's own error. Everything other than page loads goes straight to the
 * network, untouched.
 *
 * Its other job is to show what the push Edge Function sends
 * (supabase/functions/push) and open the right page when the notification is
 * tapped. Registered by auth.js on every app page, and by push.js.
 *
 * Changing offline.html or the logo? Bump CACHE so phones fetch the new copy.
 */
var CACHE = "adronis-offline-v1";
var OFFLINE_URL = "/offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE)
    .then(function (cache) { return cache.addAll([OFFLINE_URL, "/logo-128.png"]); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }),
    // Lets a page load start on the network while the worker is still waking
    // up, so the offline fallback costs nothing when there is a connection.
    self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null
  ]).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async function () {
      try {
        var preloaded = await event.preloadResponse;
        return preloaded || await fetch(request);
      } catch (e) {
        var cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  // The offline page's logo, when the network is gone too.
  if (url.pathname === "/logo-128.png") {
    event.respondWith(fetch(request).catch(function () {
      return caches.match("/logo-128.png").then(function (hit) { return hit || Response.error(); });
    }));
  }
});

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || "Adronis";
  var shown = self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icon-256.png",
    badge: "/icon-256.png",
    tag: data.tag || "adronis",
    data: { url: data.url || "/approvals.html" }
  });
  // The red number on the home-screen icon: how many ads are waiting.
  // Approvals clears it as they're reviewed.
  var count = Number(data.count) || 0;
  var badged = count > 0 && self.navigator.setAppBadge
    ? self.navigator.setAppBadge(count).catch(function () {})
    : Promise.resolve();
  event.waitUntil(Promise.all([shown, badged]));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = new URL((event.notification.data && event.notification.data.url) || "/approvals.html", self.location.origin);
  // Only ever a page of this site.
  if (target.origin !== self.location.origin) target = new URL("/approvals.html", self.location.origin);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if (new URL(client.url).origin === target.origin && "focus" in client) {
        return client.focus().then(function (c) {
          return c && c.navigate ? c.navigate(target.href).catch(function () {}) : null;
        });
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
