/* Cookie consent.
 *
 * Shown on a visitor's first visit, and again on any visit where no choice has
 * been saved yet. The choice lives in localStorage under lb-consent, stamped
 * with a version: bump VERSION whenever the site starts storing something new
 * (analytics, a pixel), and everyone is asked again.
 *
 * Today the site only stores what it needs to run — the sign-in session and
 * interface preferences — so "Essential only" and "Accept all" behave the
 * same. Anything non-essential added later must check LBConsent.allows() (or
 * listen for lb:consent) before it loads.
 *
 * The copy is English in here and goes through i18n.js like the rest of the
 * page, so the Serbian lives in i18n-sr.js.
 */
(function () {
  var STORE_KEY = "lb-consent";
  var VERSION = 1;

  function read() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return saved && saved.v === VERSION ? saved : null;
    } catch (e) { return null; }
  }

  function save(choice) {
    var record = { v: VERSION, choice: choice, at: new Date().toISOString() };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(record)); } catch (e) {}
    return record;
  }

  var consent = read();

  /* --- The card ------------------------------------------------------------
     Bottom-left, clear of the language switch (bottom-right) and the approvals
     toast (bottom centre). On a phone it spans the width and sits above the
     language switch. */
  var STYLE = [
    ".lb-consent{position:fixed;left:18px;bottom:18px;z-index:90;width:min(400px,calc(100% - 36px));",
    "padding:18px 18px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.09);",
    "background:rgba(12,13,16,.94);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);",
    "box-shadow:0 24px 60px rgba(0,0,0,.6);color:#d0d6e0;",
    "font-family:'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif;",
    "opacity:0;transform:translateY(12px);transition:opacity .28s ease,transform .36s cubic-bezier(.22,1,.36,1)}",
    ".lb-consent.is-in{opacity:1;transform:none}",
    ".lb-consent-title{margin:0 0 6px;font-size:14.5px;font-weight:500;letter-spacing:-.01em;color:#fff}",
    ".lb-consent-text{margin:0;font-size:13px;line-height:1.55;color:#8a8f98}",
    ".lb-consent-text a{color:var(--acc,#a8c6f0);text-decoration:underline;text-underline-offset:2px}",
    ".lb-consent-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}",
    ".lb-consent-btn{flex:1 1 auto;padding:10px 16px;border-radius:9999px;cursor:pointer;",
    "font-family:inherit;font-size:13px;font-weight:600;letter-spacing:-.01em;",
    "transition:background .18s ease,border-color .18s ease,color .18s ease}",
    ".lb-consent-accept{border:none;background:var(--acc,#a8c6f0);color:#07080a}",
    ".lb-consent-accept:hover{background:#cbdff9}",
    ".lb-consent-essential{border:1px solid #2a2d33;background:rgba(255,255,255,.02);color:#d0d6e0;font-weight:500}",
    ".lb-consent-essential:hover{border-color:#4a4d54;color:#fff}",
    ".lb-consent-btn:focus-visible{outline:2px solid var(--acc,#a8c6f0);outline-offset:2px}",
    "@media (max-width:860px){.lb-consent{left:12px;right:12px;bottom:58px;width:auto}}",
    "@media (prefers-reduced-motion:reduce){.lb-consent{transition:none;transform:none}}",
    "@media print{.lb-consent{display:none}}"
  ].join("");

  function mountStyle() {
    if (document.getElementById("lb-consent-style")) return;
    var style = document.createElement("style");
    style.id = "lb-consent-style";
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    var card = el("div", "lb-consent");
    card.id = "lb-consent";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-live", "polite");
    card.setAttribute("aria-labelledby", "lb-consent-title");

    var title = el("p", "lb-consent-title", "Cookies on this site");
    title.id = "lb-consent-title";

    var text = el("p", "lb-consent-text");
    text.appendChild(document.createTextNode(
      "We use cookies and local storage to keep you signed in and remember your preferences. No ads, no trackers."
    ));
    text.appendChild(document.createTextNode(" "));
    var link = el("a", "", "Privacy policy");
    link.href = "privacy.html#cookies";
    text.appendChild(link);

    var actions = el("div", "lb-consent-actions");
    var essential = el("button", "lb-consent-btn lb-consent-essential", "Essential only");
    essential.type = "button";
    essential.addEventListener("click", function () { decide("essential"); });
    var accept = el("button", "lb-consent-btn lb-consent-accept", "Accept all");
    accept.type = "button";
    accept.addEventListener("click", function () { decide("all"); });
    actions.appendChild(essential);
    actions.appendChild(accept);

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    return card;
  }

  var open = false;
  var observer = null;

  // Hangs off <body>, like the language switch, so the home page's runtime can
  // re-render underneath it; put back if a re-render ever drops it.
  function mount() {
    if (!open || !document.body) return;
    if (document.getElementById("lb-consent")) return;
    mountStyle();
    var card = build();
    document.body.appendChild(card);
    setTimeout(function () { card.classList.add("is-in"); }, 30);
  }

  function show() {
    open = true;
    mount();
    if (!observer && window.MutationObserver) {
      observer = new MutationObserver(mount);
      observer.observe(document.body, { childList: true });
    }
  }

  function hide() {
    open = false;
    if (observer) { observer.disconnect(); observer = null; }
    var card = document.getElementById("lb-consent");
    if (card) card.parentNode.removeChild(card);
  }

  function decide(choice) {
    consent = save(choice);
    hide();
    document.dispatchEvent(new CustomEvent("lb:consent", { detail: consent }));
  }

  window.LBConsent = {
    get: function () { return consent; },
    // True once the visitor has accepted everything. Essential storage never
    // needs to ask.
    allows: function () { return !!consent && consent.choice === "all"; },
    // For a "Cookie settings" link: shows the card again.
    open: show
  };

  function start() {
    if (!consent) show();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
