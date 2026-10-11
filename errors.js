/* Tells us when a page breaks in someone's browser.

   A JavaScript error on a tester's phone otherwise goes unnoticed: they don't
   report it, they just give up. Every uncaught error and every rejected
   promise nobody handled is sent to the client_errors table (schema.sql,
   section 12), and the Adronis Portal's Errors tab shows them grouped.

   What is sent: the page (no query string, so no codes or tokens), the error
   and where in our code it happened, the browser's user agent and language,
   and a random id for this tab. The database adds the account when a
   signed-in customer hit it, and the time.

   Kept quiet on purpose: at most five reports per page load, the same error
   once, nothing from browser extensions, nothing from a dropped connection,
   and nothing while working on the site locally.

   Load it in <head>, straight after boot-gate.js, so it is listening before
   any other script runs:
     <script src="errors.js"></script>

   From a page script, an error that was caught but still matters:
     LBErrors.report(err) */
(function () {
  var MAX_PER_PAGE = 5;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";

  var sent = 0;
  var seen = {};
  var waiting = [];
  var visit = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 24);

  // Errors thrown inside a browser extension's own code, and the useless
  // "Script error." a script from another site gives when it fails.
  var EXTENSION = /(chrome|moz|safari(-web)?|ms-browser)-extension:\/\/|webkit-masked-url:/i;
  // A phone losing signal mid-request: nothing we can fix, and plentiful.
  var NETWORK = /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The Internet connection appears to be offline\.?|cancelled|Network request failed)$/i;

  function page() {
    return location.pathname + (/[?&]demo=1(&|$)/.test(location.search) ? "?demo=1" : "");
  }

  function short(url) {
    return String(url || "").replace(location.origin, "");
  }

  function lang() {
    try { if (window.LBLang) return LBLang.get(); } catch (e) {}
    return document.documentElement.lang || "";
  }

  function send(row) {
    if (window.LBAuth && LBAuth.db) {
      // Signed in, the request carries the session, so the database can say
      // whose account it was.
      Promise.resolve(LBAuth.db.from("client_errors").insert(row)).catch(function () {});
      return true;
    }
    if (!window.LB_SUPABASE_URL || !window.LB_SUPABASE_ANON_KEY || !window.fetch) return false;
    fetch(window.LB_SUPABASE_URL + "/rest/v1/client_errors", {
      method: "POST",
      keepalive: true,
      headers: {
        "apikey": window.LB_SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + window.LB_SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    }).catch(function () {});
    return true;
  }

  // An error from a script that ran before the Supabase settings loaded waits
  // until the page has finished loading.
  function flush() {
    var rows = waiting;
    waiting = [];
    rows.forEach(function (row) { if (!send(row)) waiting.push(row); });
  }
  window.addEventListener("load", function () { setTimeout(flush, 0); });

  function report(message, source, line, col, stack) {
    if (LOCAL) return;
    message = String(message || "").trim();
    stack = String(stack || "");
    if (!message) return;
    if (message === "Script error." && !source) return;
    if (EXTENSION.test(source || "") || EXTENSION.test(stack)) return;
    if (NETWORK.test(message) || navigator.onLine === false) return;

    var key = message + "|" + (source || "") + "|" + (line || "");
    if (seen[key] || sent >= MAX_PER_PAGE) return;
    seen[key] = true;
    sent++;

    var row = {
      page: page(),
      message: message.slice(0, 1000),
      source: short(source).slice(0, 500) || null,
      line: line || null,
      col: col || null,
      stack: stack.split(location.origin).join("").slice(0, 4000) || null,
      user_agent: (navigator.userAgent || "").slice(0, 400),
      lang: lang(),
      visit: visit
    };
    if (!send(row)) waiting.push(row);
  }

  function fromError(err, fallback) {
    if (err && typeof err === "object") {
      var name = err.name && err.name !== "Error" ? err.name + ": " : "";
      return { message: name + (err.message || String(err)), stack: err.stack || "" };
    }
    return { message: String(err === undefined ? fallback : err), stack: "" };
  }

  window.addEventListener("error", function (event) {
    // A picture or script that failed to load fires here too, on the element
    // rather than the window. The pages handle missing pictures themselves.
    if (event.target && event.target !== window) return;
    var e = fromError(event.error, event.message);
    report(event.error ? e.message : event.message, event.filename, event.lineno, event.colno, e.stack);
  });

  window.addEventListener("unhandledrejection", function (event) {
    var e = fromError(event.reason, "Unhandled promise rejection");
    report(e.message, "", null, null, e.stack);
  });

  window.LBErrors = {
    report: function (err) {
      var e = fromError(err, "Reported error");
      report(e.message, "", null, null, e.stack);
    }
  };
})();
