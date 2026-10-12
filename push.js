/* "Get a ping when your ads arrive" - push notifications for a customer with
 * a plan on, in the control room and Approvals. Turning them on registers
 * sw.js, asks the browser's permission and hands the device's address to
 * save_push_subscription (schema.sql, section 12c); the push Edge Function
 * then sends one notification when the week's ads land and one reminder a
 * day later if some are still waiting.
 *
 * Asked once per device: "Not now" or a browser that refused keeps it away.
 * On an iPhone, notifications only work from the home-screen app, so there
 * the card waits until Adronis is opened from the home screen (install-hint.js
 * says how to put it there).
 *
 * Load it after auth.js (and demo.js) on approvals.html, control-room.html
 * and account.html.
 */
(function () {
  // The public half of the VAPID key pair. The private half is the push Edge
  // Function's VAPID_PRIVATE_KEY secret and never comes near the browser.
  var PUBLIC_KEY = "BMTI2s98ftv2SBWRjOEXqJjcIDFxhVONxaxYixJIDjnWJHN3ebYOkile1NYxrxdZZIXuLbUZsnP_Hb7SUgPOrB0";
  var KEY = "lb-push-asked";

  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function asked() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function remember() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }

  function keyBytes(base64url) {
    var pad = "=".repeat((4 - (base64url.length % 4)) % 4);
    var raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function lang() {
    return window.LBLang && LBLang.get() === "sr" ? "sr" : "en";
  }

  async function save(sub) {
    var json = sub.toJSON();
    var res = await LBAuth.db.rpc("save_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys && json.keys.p256dh,
      p_auth: json.keys && json.keys.auth,
      p_lang: lang(),
      p_ua: navigator.userAgent
    });
    if (res.error) throw LBAuth.friendlyError(res.error);
  }

  async function turnOn() {
    var reg = await navigator.serviceWorker.register("/sw.js");
    var permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    var sub = await reg.pushManager.getSubscription() ||
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
    await save(sub);
    return true;
  }

  function show() {
    var host = document.querySelector(".section-tight .wrap-wide, .section-tight .wrap");
    if (!host || document.getElementById("push-card")) return;

    var box = document.createElement("div");
    box.id = "push-card";
    box.className = "notice install-hint";
    box.setAttribute("role", "status");

    var text = document.createElement("div");
    text.className = "install-text";
    var tag = document.createElement("span");
    tag.className = "mono install-tag";
    tag.textContent = "NEW";
    var lead = document.createElement("span");
    lead.textContent = "Get a ping on this device when your new ads arrive.";
    var how = document.createElement("span");
    how.className = "install-how";
    how.textContent = "One when they land, one reminder a day later if some are still waiting. Nothing else.";
    text.appendChild(tag);
    text.appendChild(lead);
    text.appendChild(how);

    var on = document.createElement("button");
    on.type = "button";
    on.className = "btn-ghost";
    on.textContent = "Turn on";
    on.addEventListener("click", async function () {
      on.disabled = true;
      try {
        var done = await turnOn();
        remember();
        if (!done) { box.remove(); return; }
        document.addEventListener("lb:langchange", refresh);
        text.innerHTML = "";
        var ok = document.createElement("span");
        ok.textContent = "Done — you'll get a ping when your next ads arrive.";
        text.appendChild(ok);
        on.remove();
        setTimeout(function () { box.remove(); }, 5000);
      } catch (err) {
        on.disabled = false;
        how.textContent = (err && err.message) || "Couldn't turn notifications on. Try again in a minute.";
        how.style.color = "#f0a8a8";
      }
    });

    var x = document.createElement("button");
    x.type = "button";
    x.className = "install-x";
    x.setAttribute("aria-label", "Not now");
    x.title = "Not now";
    x.textContent = "✕";
    x.addEventListener("click", function () { remember(); box.remove(); });

    box.appendChild(text);
    box.appendChild(on);
    box.appendChild(x);
    host.insertBefore(box, host.firstChild);
  }

  // A device that already said yes keeps its address up to date: browsers
  // swap it now and then, and a reinstall starts a new one.
  async function refresh() {
    try {
      var reg = await navigator.serviceWorker.getRegistration("/");
      var sub = reg && await reg.pushManager.getSubscription();
      if (sub) await save(sub);
      else if (reg) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
        await save(sub);
      }
    } catch (e) {}
  }

  if (!window.LBAuth) return;
  LBAuth.ready.then(async function () {
    if (window.LBDemo && LBDemo.on) return;
    if (LBAuth.viewingAs && LBAuth.viewingAs()) return;
    if (!LBAuth.isLoggedIn() || !supported()) return;
    // A portal admin gets the card too (on the account page, which is open to
    // them), so they can try a notification on their own phone - the push
    // Edge Function's test send. Nothing else is ever sent to an admin: the
    // weekly ones go only to accounts with a plan on.
    var admin = false;
    if (!LBAuth.hasActivePlan()) {
      var res = await LBAuth.db.rpc("is_portal_admin");
      admin = !res.error && res.data === true;
      if (!admin) return;
    }
    if (Notification.permission === "granted") {
      refresh();
      // Notifications come in the language the site is shown in, so a switch
      // of language is handed over at once, not on the next visit.
      document.addEventListener("lb:langchange", refresh);
      return;
    }
    if (Notification.permission === "denied" || (asked() && !admin)) return;
    show();
  });
})();
