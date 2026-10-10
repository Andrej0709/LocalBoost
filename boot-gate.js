// Keeps a page from showing itself for a split second before it sends the
// visitor somewhere else.
//
// Pages decide where a signed-in customer belongs only once auth.js has loaded
// the session and profile from Supabase, which takes a network round trip. By
// then the browser has already painted the page, so a redirect read as "the
// wrong page flashes, then the right one". This script runs first, in <head>,
// before anything is painted:
//
//   - Redirects that need no account at all (checkout during the beta, the
//     beta page after launch, the Franchise plan) happen right here.
//   - On a page that might redirect a signed-in customer, the page stays
//     hidden until auth.js and the page's own script have decided. It is only
//     hidden when a redirect is likely - judged from what the account looked
//     like on its last visit - so a customer going between pages they belong
//     on never waits on a blank screen.
//   - For a reader who gets the Serbian copy, the page stays hidden until
//     i18n.js has translated it, so the English markup never shows first.
//
// Load it in <head>, straight after <meta charset>, on every page that loads
// auth.js:
//   <script src="boot-gate.js"></script>
//
// Then, from page scripts:
//   LBGate.go(url)      leave for url, keeping the page hidden until it's gone
//   var done = LBGate.hold()   keep the page hidden while deciding something
//   done()                     ...and show it if nothing was decided after all

(function () {
  // Beta: until the public launch in Q1 2027 only beta testers use Adronis.
  // auth.js reads this; set to false at launch.
  var BETA = true;

  var HINT_KEY = "lb-route-hint";
  var SAFETY_MS = 6000;

  var root = document.documentElement;
  var page = location.pathname.split("/").pop() || "Adronis.dc.html";
  var params = new URLSearchParams(location.search);

  var styled = false;
  function addStyle() {
    if (styled) return;
    styled = true;
    var style = document.createElement("style");
    style.textContent =
      "html.lb-gate,html.lb-lang-wait{background:#050608}" +
      "html.lb-gate body>*:not(#lb-boot),html.lb-lang-wait body>*:not(#lb-boot){visibility:hidden}";
    document.head.appendChild(style);
  }

  function hide() {
    addStyle();
    root.classList.add("lb-gate");
  }

  function go(url) {
    leaving = true;
    hide();
    location.replace(url);
  }

  // --- Redirects that need no account ---------------------------------------
  var leaving = false;
  if (page === "checkout.html" && BETA) go("beta.html");
  else if (page === "beta.html" && !BETA) go("/#pricing");
  else if ((page === "checkout.html" || page === "signup.html") && params.get("plan") === "franchise") {
    go("contact.html?plan=franchise");
  }

  // --- Hide the page while a signed-in redirect is likely --------------------
  function storedUserId() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(key)) {
          var token = JSON.parse(localStorage.getItem(key));
          return (token && token.user && token.user.id) || "?";
        }
      }
    } catch (e) {}
    return null;
  }

  function readHint(userId) {
    try {
      var hint = JSON.parse(localStorage.getItem(HINT_KEY));
      return hint && hint.u === userId ? hint : null;
    } catch (e) { return null; }
  }

  // Whether this page is likely to send the account elsewhere once it loads.
  // Mirrors the redirects in auth.js (closedInBeta) and on each page. With no
  // hint (first visit on this device) any page that can redirect is hidden.
  function likelyRedirect(hint) {
    var tester = hint && hint.t, brief = hint && hint.b;
    switch (page) {
      case "approvals.html":
      case "control-room.html":
      case "history.html":
      case "login.html":
        return !hint || (BETA && !tester);
      case "signup.html":
        return !hint || tester || brief;
      case "beta.html":
        return !hint || tester || !brief;
      default:
        return false;
    }
  }

  // Links from Supabase's emails (reset, confirmation, an expired one) can be
  // sent on to the login page from any page.
  var authLink = /(^|[#&])type=recovery(&|$)/.test(location.hash) ||
    /[?&]code=/.test(location.search) ||
    /(^|[#&?])error_description=/.test(location.hash + location.search);

  var userId = storedUserId();
  var gated = leaving || authLink || (!!userId && likelyRedirect(readHint(userId)));

  // auth.js holds the page until it has the session and profile; pages add
  // their own holds for decisions made after that.
  var holds = 0;
  var safety = null;

  function reveal() {
    clearTimeout(safety);
    root.classList.remove("lb-gate");
  }

  function hold() {
    if (!gated) return function () {};
    holds++;
    var released = false;
    return function () {
      if (released) return;
      released = true;
      // Wait out the rest of this turn: a page script reacting to the same
      // event may still be about to call go() or hold().
      setTimeout(function () {
        if (--holds === 0 && !leaving) reveal();
      }, 0);
    };
  }

  if (gated) {
    hide();
    // Never leave anyone on a blank page if Supabase is slow or unreachable.
    safety = setTimeout(reveal, SAFETY_MS);
  }

  // --- Hide the page until it reads in Serbian -------------------------------
  // The copy is English in the markup, and i18n.js only translates it once its
  // dictionary has loaded at the end of <body>. Until then a Serbian reader
  // would see the English page. Same choice of language as i18n.js: ?lang=,
  // then the remembered choice, then the browser's languages and time zone.
  var SR_ZONES = ["Europe/Belgrade", "Europe/Zagreb", "Europe/Sarajevo", "Europe/Podgorica"];
  var LANG_SAFETY_MS = 3000;

  function readsSerbian() {
    var query = /[?&]lang=([a-z-]+)/i.exec(location.search);
    var asked = query && query[1].toLowerCase().slice(0, 2);
    if (asked === "sr" || asked === "en") return asked === "sr";
    try {
      var saved = localStorage.getItem("lb-lang");
      if (saved === "sr" || saved === "en") return saved === "sr";
    } catch (e) {}
    var list = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      if (/^(sr|hr|bs|me|sh)\b/.test(String(list[i] || "").toLowerCase())) return true;
    }
    try {
      return SR_ZONES.indexOf(Intl.DateTimeFormat().resolvedOptions().timeZone) > -1;
    } catch (e) { return false; }
  }

  function translated() {
    root.classList.remove("lb-lang-wait");
  }

  if (readsSerbian()) {
    addStyle();
    root.classList.add("lb-lang-wait");
    setTimeout(translated, LANG_SAFETY_MS);
    // A page without i18n.js (404.html) has nothing to wait for.
    document.addEventListener("DOMContentLoaded", function () {
      if (!window.LBLang) translated();
    });
  }

  window.LBGate = {
    beta: BETA,
    go: go,
    hold: hold,

    // i18n.js has put the page into the reader's language: show it.
    translated: translated,

    // What the account looked like, for the next page's guess. auth.js calls
    // this whenever it loads the profile.
    remember: function (userId, tester, brief) {
      try {
        if (!userId) localStorage.removeItem(HINT_KEY);
        else localStorage.setItem(HINT_KEY, JSON.stringify({ u: userId, t: !!tester, b: !!brief }));
      } catch (e) {}
    }
  };
})();
