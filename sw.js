/* Adronis service worker - push notifications only.
 *
 * It caches nothing: every page is still fetched fresh (vercel.json sends
 * no-cache for HTML), so there is no offline copy to go stale. Its one job
 * is to show what the push Edge Function sends (supabase/functions/push) and
 * open the right page when the notification is tapped. Registered by push.js.
 */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || "Adronis";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icon-256.png",
    badge: "/icon-256.png",
    tag: data.tag || "adronis",
    data: { url: data.url || "/approvals.html" }
  }));
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
