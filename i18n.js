/* Serbian / English switch.
 *
 * The site's copy lives in the markup in English. This walks the rendered page
 * and swaps every string it recognises for the Serbian one in i18n-sr.js,
 * keyed by the English text itself — so a page never needs a parallel Serbian
 * copy, and an untranslated string simply stays English instead of breaking.
 *
 * The home page is rendered by the template runtime in support.js, which
 * replaces its own nodes whenever state changes, so the pass re-runs on every
 * mutation and re-inserts the switch if a re-render drops it.
 *
 * What is deliberately left alone: form values (an <option> keeps its English
 * value so the database stores one spelling per business type), URLs, the
 * brand name, and anything the dictionary has no entry for.
 */
(function () {
  var STORE_KEY = "lb-lang";
  var LANGS = { en: "EN", sr: "SR" };

  function dict() {
    return (window.LB_I18N_SR && window.LB_I18N_SR.strings) || {};
  }

  function norm(s) {
    return s.replace(/\s+/g, " ").trim();
  }

  /* --- Which language ------------------------------------------------------
     ?lang= wins and is remembered, then the remembered choice, then the
     browser's own languages. Serbian, Croatian, Bosnian and Montenegrin
     readers all get the Serbian copy — it reads the same to all of them. */
  function stored() {
    try {
      var v = localStorage.getItem(STORE_KEY);
      return LANGS[v] ? v : null;
    } catch (e) { return null; }
  }

  function remember(lang) {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
  }

  function fromQuery() {
    var m = /[?&]lang=([a-z-]+)/i.exec(location.search);
    if (!m) return null;
    var v = m[1].toLowerCase().slice(0, 2);
    return LANGS[v] ? v : null;
  }

  function fromBrowser() {
    var list = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i] || "").toLowerCase();
      if (/^(sr|hr|bs|me|sh)\b/.test(tag) || /^(sr|hr|bs|me|sh)-/.test(tag)) return "sr";
      if (/^en\b/.test(tag) || /^en-/.test(tag)) return "en";
    }
    return "en";
  }

  var queryLang = fromQuery();
  if (queryLang) remember(queryLang);
  var lang = queryLang || stored() || fromBrowser();

  /* --- Translating the page ------------------------------------------------
     Every node the pass touches keeps its English original on the node itself,
     so switching back is a restore and never a reverse lookup. */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, CODE: 1, "X-DC": 1 };
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function patterns() {
    return (window.LB_I18N_SR && window.LB_I18N_SR.patterns) || [];
  }

  // Strings a script builds around a date, a count or a plan name never match
  // the dictionary exactly, so each one has a pattern instead. A captured group
  // is itself looked up before it goes back in — "monthly" becomes the Serbian
  // word, a date or a plan name has no entry and passes through untouched.
  function lookupPattern(key) {
    var list = patterns();
    for (var i = 0; i < list.length; i++) {
      var rule = list[i];
      var m = rule[0].exec(key);
      if (!m) continue;
      return rule[1].replace(/\$(\d)/g, function (_, n) {
        var group = m[Number(n)];
        if (group === undefined) return "";
        var inner = dict()[norm(group)];
        return typeof inner === "string" && inner ? inner : group;
      });
    }
    return null;
  }

  function lookup(text) {
    var key = norm(text);
    if (!key) return null;
    var hit = dict()[key];
    if (typeof hit === "string" && hit) return hit;
    return lookupPattern(key);
  }

  // Keeps the original spacing around a translated string: text nodes in the
  // markup are usually padded with the indentation of the source file.
  function reskin(original, translated) {
    var lead = /^\s*/.exec(original)[0];
    var tail = /\s*$/.exec(original)[0];
    return lead + translated + tail;
  }

  function translateTextNode(node) {
    var parent = node.parentNode;
    if (!parent || SKIP_TAGS[parent.nodeName]) return;

    // A script may have rewritten this node since the last pass — the nav's
    // "Log in" becoming the business name, a counter ticking over. Whatever we
    // did not write ourselves is the new English original.
    if (node.__lbEn !== undefined && node.nodeValue !== node.__lbOut) {
      node.__lbEn = undefined;
    }
    if (node.__lbEn === undefined) {
      if (!norm(node.nodeValue)) return;
      if (!lookup(node.nodeValue)) return;
      node.__lbEn = node.nodeValue;
      // An <option> with no value attribute submits its label. Pin the English
      // one down before the label changes, so the form still posts English.
      if (parent.nodeName === "OPTION" && !parent.hasAttribute("value")) {
        parent.setAttribute("value", norm(node.__lbEn));
      }
    }
    var want = lang === "en"
      ? node.__lbEn
      : reskin(node.__lbEn, lookup(node.__lbEn) || norm(node.__lbEn));
    if (node.nodeValue !== want) node.nodeValue = want;
    node.__lbOut = want;
  }

  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      if (!el.hasAttribute(name)) continue;
      var mark = "__lbEn_" + name;
      var out = "__lbOut_" + name;
      var current = el.getAttribute(name);
      if (el[mark] !== undefined && current !== el[out]) el[mark] = undefined;
      if (el[mark] === undefined) {
        if (!lookup(current)) continue;
        el[mark] = current;
      }
      var want = lang === "en" ? el[mark] : (lookup(el[mark]) || el[mark]);
      if (current !== want) el.setAttribute(name, want);
      el[out] = want;
    }
  }

  function walk(root) {
    if (root.nodeType === 3) { translateTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && SKIP_TAGS[root.nodeName]) return;
    if (root.nodeType === 1) translateAttrs(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT + NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (node) {
        if (node.nodeType === 1 && SKIP_TAGS[node.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateTextNode(node);
      else translateAttrs(node);
    }
  }

  function translateTitle() {
    if (document.__lbEnTitle === undefined) {
      if (!lookup(document.title)) return;
      document.__lbEnTitle = document.title;
    }
    var want = lang === "en" ? document.__lbEnTitle : (lookup(document.__lbEnTitle) || document.__lbEnTitle);
    if (document.title !== want) document.title = want;
  }

  /* --- The switch ----------------------------------------------------------
     Two letters in the nav bar: the live one in full colour, the other dimmed
     until hovered. It is a real button with a label, so it works from the
     keyboard and announces itself to a screen reader. */
  var STYLE = [
    ".lb-lang{display:inline-flex;align-items:center;gap:5px;flex:none;",
    "font-family:'Geist Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em}",
    ".lb-lang-btn{padding:6px 2px;border:none;background:none;cursor:pointer;color:#5d626a;",
    "font:inherit;letter-spacing:inherit;line-height:1;transition:color .18s ease}",
    ".lb-lang-btn:hover{color:#d0d6e0}",
    ".lb-lang-btn.is-on{color:var(--acc,#a8c6f0)}",
    ".lb-lang-btn:focus-visible{outline:2px solid var(--acc,#a8c6f0);outline-offset:3px;border-radius:4px}",
    ".lb-lang-sep{color:#2b2e34}",
    ".lb-lang[data-lb-lang='sheet']{justify-content:center;margin-top:6px;padding:12px 0;",
    "border-top:1px solid rgba(255,255,255,.07);font-size:12px}",
    "@media (max-width:860px){.lb-lang[data-lb-lang='nav']{display:none}}"
  ].join("");

  function mountStyle() {
    if (document.getElementById("lb-lang-style")) return;
    var style = document.createElement("style");
    style.id = "lb-lang-style";
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildSwitch(variant) {
    var wrap = document.createElement("div");
    wrap.className = "lb-lang";
    wrap.setAttribute("data-lb-lang", variant || "nav");

    Object.keys(LANGS).forEach(function (code, i) {
      if (i) {
        var sep = document.createElement("span");
        sep.className = "lb-lang-sep";
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = "/";
        wrap.appendChild(sep);
      }
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lb-lang-btn";
      button.dataset.lang = code;
      button.textContent = LANGS[code];
      button.setAttribute(
        "aria-label",
        code === "sr" ? "Prikaži sajt na srpskom" : "Show this site in English"
      );
      button.addEventListener("click", function () { setLang(code); });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function markSwitches() {
    Array.prototype.forEach.call(document.querySelectorAll(".lb-lang-btn"), function (button) {
      var on = button.dataset.lang === lang;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // The nav on the home page is rebuilt by the runtime, so the switch is
  // re-inserted whenever it goes missing rather than mounted once.
  function mountSwitches() {
    var navs = document.querySelectorAll("nav.nav, nav[data-glass='nav']");
    Array.prototype.forEach.call(navs, function (nav) {
      if (nav.querySelector(".lb-lang")) return;
      var anchor = nav.querySelector("#nav-login, [data-loginlink], a[href='login.html']");
      var node = buildSwitch("nav");
      if (anchor) nav.insertBefore(node, anchor);
      else nav.appendChild(node);
    });

    // Mobile: the nav collapses into a sheet, so the switch goes in there too.
    var sheets = document.querySelectorAll(".nav-sheet, [data-navsheet]");
    Array.prototype.forEach.call(sheets, function (sheet) {
      if (sheet.querySelector(".lb-lang")) return;
      sheet.appendChild(buildSwitch("sheet"));
    });
  }

  var applying = false;
  var queued = false;

  function apply() {
    applying = true;
    try {
      mountStyle();
      mountSwitches();
      walk(document.body || document.documentElement);
      translateTitle();
      markSwitches();
      document.documentElement.lang = lang;
    } finally {
      applying = false;
    }
  }

  // A timer rather than an animation frame: a background or hidden tab never
  // paints, and the page still has to be in the right language when it does.
  function schedule() {
    if (applying || queued) return;
    queued = true;
    setTimeout(function () { queued = false; apply(); }, 16);
  }

  function setLang(next) {
    if (!LANGS[next] || next === lang) return;
    lang = next;
    remember(next);
    apply();
    document.dispatchEvent(new CustomEvent("lb:langchange", { detail: { lang: lang } }));
  }

  window.LBLang = {
    get: function () { return lang; },
    // For Intl: dates and amounts a script formats should read the same way as
    // the copy around them. Serbian is written in Latin script here.
    locale: function () { return lang === "sr" ? "sr-Latn-RS" : "en-US"; },
    set: setLang,
    // Anything rendered by a script after the fact can ask for a single string.
    t: function (text) {
      if (lang === "en") return text;
      return lookup(text) || text;
    },
    refresh: schedule
  };

  function start() {
    apply();
    var observer = new MutationObserver(function () { schedule(); });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
