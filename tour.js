/* First-visit guided tours.
 *
 * A page hands LBTour a tour: an id, a list of steps, and optional setup /
 * teardown hooks. Each step points at an element (or at nothing, for a
 * centred welcome card) and says what it is in a sentence or two. The rest of
 * the page dims, the step's element stays lit, and the light glides from one
 * element to the next as the page scrolls to it.
 *
 * Which tours a customer has already seen lives on their profile (tours_seen),
 * so a tour never repeats on another phone or computer. localStorage keeps a
 * copy too, which covers the database until schema.sql has been re-run.
 *
 * Every string goes through LBLang.t, so the Serbian copy lives in
 * i18n-sr.js next to the rest of the site's.
 *
 * Load order: after i18n.js and auth.js, before the page's own script.
 */
(function () {
  var NAV_SPACE = 84;   // the fixed nav's height plus its gap from the top
  var GUTTER = 16;
  var GAP = 14;         // between the lit element and the card
  var PAD = 8;          // how far the light reaches past the element's edges
  var MOBILE = 640;

  var STYLE = [
    ".lbt-block{position:fixed;inset:0;z-index:1000;background:transparent}",
    // The cookie card floats over the page and would show through the lit
    // hole on top of whatever the tour is pointing at. It comes back after.
    "html.lbt-on .lb-consent{visibility:hidden}",
    ".lbt-spot{position:absolute;z-index:1001;pointer-events:none;border-radius:14px;",
    "box-shadow:0 0 0 1px rgba(168,198,240,.55),0 0 28px 4px rgba(168,198,240,.16),0 0 0 200vmax rgba(3,4,6,.74);",
    "transition:top .5s cubic-bezier(.22,1,.36,1),left .5s cubic-bezier(.22,1,.36,1),",
    "width .5s cubic-bezier(.22,1,.36,1),height .5s cubic-bezier(.22,1,.36,1),box-shadow .4s ease,opacity .3s ease}",
    ".lbt-spot.is-blank{box-shadow:0 0 0 0 rgba(168,198,240,0),0 0 0 0 rgba(168,198,240,0),0 0 0 200vmax rgba(3,4,6,.8)}",
    ".lbt-spot.is-entering{opacity:0}",
    ".lbt-card{position:fixed;z-index:1002;width:min(380px,calc(100vw - 32px));box-sizing:border-box;padding:20px 20px 16px;",
    "border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(14,15,18,.97);",
    "-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 24px 60px rgba(0,0,0,.55);",
    "font-family:'Geist',ui-sans-serif,system-ui,sans-serif;color:#d0d6e0;",
    "opacity:0;transform:translateY(6px);transition:opacity .22s ease,transform .22s cubic-bezier(.22,1,.36,1)}",
    ".lbt-card.is-shown{opacity:1;transform:none}",
    ".lbt-card:focus{outline:none}",
    ".lbt-card.is-welcome{width:min(440px,calc(100vw - 32px));padding:28px 26px 20px}",
    ".lbt-top{display:flex;align-items:center;justify-content:space-between;gap:12px}",
    ".lbt-count{font-family:'Geist Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.12em;color:var(--acc,#a8c6f0)}",
    ".lbt-skip{padding:4px 2px;border:none;background:none;color:#7b8089;font-size:12.5px;font-family:inherit;cursor:pointer}",
    ".lbt-skip:hover{color:#d0d6e0}",
    ".lbt-bar{height:2px;margin:12px 0 16px;border-radius:2px;background:#1b1e22;overflow:hidden}",
    ".lbt-bar span{display:block;height:100%;background:var(--acc,#a8c6f0);border-radius:2px;transition:width .45s cubic-bezier(.22,1,.36,1)}",
    ".lbt-title{margin:0;font-size:18px;line-height:1.3;letter-spacing:-.015em;font-weight:500;color:#fff}",
    ".lbt-card.is-welcome .lbt-title{margin-top:14px;font-size:clamp(24px,5vw,30px);line-height:1.15;letter-spacing:-.03em}",
    ".lbt-body{margin:8px 0 0;font-size:14px;line-height:1.6;color:#8a8f98}",
    ".lbt-card.is-welcome .lbt-body{margin-top:12px;font-size:15px}",
    ".lbt-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:18px}",
    ".lbt-actions button{padding:9px 16px;border-radius:9999px;font-size:13.5px;font-family:inherit;cursor:pointer;white-space:nowrap}",
    ".lbt-back{border:1px solid #23252a;background:none;color:#9aa0a8}",
    ".lbt-back:hover{border-color:#4a4d54;color:#d0d6e0}",
    ".lbt-next{border:none;background:var(--acc,#a8c6f0);color:#07080a;font-weight:600}",
    ".lbt-next:hover{background:#cbdff9}",
    ".lbt-card button:focus-visible{outline:2px solid var(--acc,#a8c6f0);outline-offset:2px}",
    ".lbt-replay{position:relative;z-index:1;display:inline-flex;align-items:center;gap:8px;margin-top:22px;padding:7px 14px;",
    "border-radius:9999px;border:1px solid #23252a;background:rgba(255,255,255,.02);color:#9aa0a8;",
    "font-family:'Geist Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;cursor:pointer;",
    "transition:border-color .2s ease,color .2s ease}",
    ".lbt-replay:hover{border-color:rgba(168,198,240,.45);color:var(--acc,#a8c6f0)}",
    "@media (max-width:" + MOBILE + "px){",
    ".lbt-card{left:12px !important;right:12px;top:auto !important;bottom:12px;width:auto !important;transform:translateY(12px)}",
    ".lbt-card.is-shown{transform:none}}",
    "@media (prefers-reduced-motion:reduce){.lbt-spot,.lbt-card,.lbt-bar span{transition:none}}"
  ].join("");

  function t(text) {
    return window.LBLang ? LBLang.t(text) : text;
  }

  function reducedMotion() {
    return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isMobile() {
    return window.innerWidth <= MOBILE;
  }

  function mountStyle() {
    if (document.getElementById("lbt-style")) return;
    var style = document.createElement("style");
    style.id = "lbt-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  /* --- Who has seen what ---------------------------------------------------- */
  function localKey(id) {
    var user = window.LBAuth && LBAuth.getUser();
    return "lb-tour-" + id + (user ? "-" + user.id : "");
  }

  function hasSeen(id) {
    var profile = window.LBAuth && LBAuth.getProfile();
    if (profile && Array.isArray(profile.tours_seen) && profile.tours_seen.indexOf(id) !== -1) return true;
    try { return !!localStorage.getItem(localKey(id)); } catch (e) { return false; }
  }

  function markSeen(id) {
    try { localStorage.setItem(localKey(id), new Date().toISOString()); } catch (e) {}
    var profile = window.LBAuth && LBAuth.getProfile();
    // No tours_seen on the row means schema.sql hasn't been re-run yet —
    // localStorage above is all there is until it has.
    if (!profile || !Array.isArray(profile.tours_seen)) return;
    if (profile.tours_seen.indexOf(id) !== -1) return;
    LBAuth.updateProfile({ tours_seen: profile.tours_seen.concat(id) }).catch(function () {});
  }

  /* --- The running tour ----------------------------------------------------- */
  var tour = null;    // the config passed to start()
  var index = 0;
  var els = null;     // { block, spot, card, ... }
  var opener = null;  // what had focus before the tour opened
  var targetEl = null;
  var watcher = null; // ResizeObserver on the lit element
  var moveId = 0;     // bumps on every step change, so a stale scroll wait gives up
  var frame = 0;

  function build() {
    var block = document.createElement("div");
    block.className = "lbt-block";

    var spot = document.createElement("div");
    spot.className = "lbt-spot is-blank is-entering";
    spot.setAttribute("aria-hidden", "true");

    var card = document.createElement("div");
    card.className = "lbt-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "lbt-title");
    card.setAttribute("aria-describedby", "lbt-body");
    card.tabIndex = -1;
    card.innerHTML =
      '<div class="lbt-top"><span class="lbt-count"></span><button type="button" class="lbt-skip"></button></div>' +
      '<div class="lbt-bar"><span></span></div>' +
      '<h2 class="lbt-title" id="lbt-title"></h2>' +
      '<p class="lbt-body" id="lbt-body"></p>' +
      '<div class="lbt-actions"><button type="button" class="lbt-back"></button><button type="button" class="lbt-next"></button></div>';

    document.body.appendChild(block);
    document.body.appendChild(spot);
    document.body.appendChild(card);

    var parts = {
      block: block, spot: spot, card: card,
      count: card.querySelector(".lbt-count"),
      skip: card.querySelector(".lbt-skip"),
      bar: card.querySelector(".lbt-bar"),
      fill: card.querySelector(".lbt-bar span"),
      title: card.querySelector(".lbt-title"),
      body: card.querySelector(".lbt-body"),
      back: card.querySelector(".lbt-back"),
      next: card.querySelector(".lbt-next")
    };
    parts.skip.addEventListener("click", function () { close(); });
    parts.back.addEventListener("click", function () { go(index - 1); });
    parts.next.addEventListener("click", function () { go(index + 1); });
    return parts;
  }

  // Steps are numbered without the welcome card, so "01 / 04" counts the
  // stops on the page, not the greeting.
  function numbered() {
    return tour.steps.filter(function (s) { return !s.welcome; });
  }

  function fillCard(step) {
    var stops = numbered();
    var n = stops.indexOf(step) + 1;
    var last = index === tour.steps.length - 1;

    els.card.classList.toggle("is-welcome", !!step.welcome);
    els.count.textContent = step.welcome
      ? t(step.eyebrow || "WELCOME")
      : pad(n) + " / " + pad(stops.length);
    els.bar.hidden = !!step.welcome;
    els.fill.style.width = (n / stops.length * 100) + "%";

    els.title.textContent = "";
    var title = typeof step.title === "function" ? step.title() : step.title;
    (Array.isArray(title) ? title : [title]).forEach(function (piece) {
      // A piece written as { em: "..." } is set in the site's serif accent,
      // the way the page headlines highlight a word.
      if (piece && piece.em) {
        var em = document.createElement("em");
        em.textContent = t(piece.em);
        els.title.appendChild(em);
      } else {
        // The dictionary is keyed on trimmed text; keep the spaces that join
        // this piece to the accented one next to it.
        var lead = /^\s*/.exec(piece)[0], tail = /\s*$/.exec(piece)[0];
        els.title.appendChild(document.createTextNode(lead + t(piece.trim()) + tail));
      }
    });
    els.body.textContent = t(step.body);

    els.skip.textContent = t(last ? "Close" : "Skip tour");
    els.skip.hidden = last;
    els.back.textContent = t("Back");
    els.back.hidden = index === 0 || !!step.welcome || !!tour.steps[index - 1].welcome;
    els.next.textContent = t(step.next || (last ? "Done" : "Next"));
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function resolveTarget(step) {
    if (!step.target) return null;
    var el = typeof step.target === "function" ? step.target() : document.querySelector(step.target);
    if (!el || !el.getClientRects().length) return null;
    return el;
  }

  // Lights up the element: the spot sits on the page itself (not the screen),
  // so it scrolls along with what it is lighting.
  function placeSpot() {
    if (!els) return;
    var spot = els.spot;
    if (!targetEl) {
      spot.classList.add("is-blank");
      spot.style.left = (window.scrollX + window.innerWidth / 2) + "px";
      spot.style.top = (window.scrollY + window.innerHeight / 2) + "px";
      spot.style.width = "0px";
      spot.style.height = "0px";
      return;
    }
    var r = targetEl.getBoundingClientRect();
    spot.classList.remove("is-blank");
    spot.style.left = (r.left + window.scrollX - PAD) + "px";
    spot.style.top = (r.top + window.scrollY - PAD) + "px";
    spot.style.width = (r.width + PAD * 2) + "px";
    spot.style.height = (r.height + PAD * 2) + "px";
  }

  // The card is fixed to the screen. Below the element if it fits, then above,
  // then beside it; on a phone it is always a sheet along the bottom (CSS).
  function placeCard() {
    if (!els) return;
    var card = els.card;
    if (isMobile()) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = card.offsetWidth;
    var ch = card.offsetHeight;

    if (!targetEl) {
      card.style.left = Math.round((vw - cw) / 2) + "px";
      card.style.top = Math.round(Math.max(NAV_SPACE, (vh - ch) / 2)) + "px";
      return;
    }

    var r = targetEl.getBoundingClientRect();
    var top = r.top - PAD, bottom = r.bottom + PAD, left = r.left - PAD, right = r.right + PAD;
    var x, y;
    if (bottom + GAP + ch <= vh - GUTTER) {
      y = bottom + GAP; x = left;
    } else if (top - GAP - ch >= NAV_SPACE) {
      y = top - GAP - ch; x = left;
    } else if (right + GAP + cw <= vw - GUTTER) {
      x = right + GAP; y = Math.max(NAV_SPACE, Math.min(top, vh - GUTTER - ch));
    } else if (left - GAP - cw >= GUTTER) {
      x = left - GAP - cw; y = Math.max(NAV_SPACE, Math.min(top, vh - GUTTER - ch));
    } else {
      // Bigger than the screen: the card sits over its lower edge.
      x = left; y = vh - GUTTER - ch;
    }
    card.style.left = Math.round(Math.max(GUTTER, Math.min(x, vw - cw - GUTTER))) + "px";
    card.style.top = Math.round(Math.max(GUTTER, y)) + "px";
  }

  // Where the page should scroll so the element and its card both show.
  // A step with align: "end" keeps the element's bottom in view when it is
  // taller than the screen — where a creative's approve and reject buttons are.
  function scrollGoal(step) {
    if (!targetEl) return window.scrollY;
    var r = targetEl.getBoundingClientRect();
    var vh = window.innerHeight;
    var ch = els.card.offsetHeight;
    var areaTop = NAV_SPACE;
    var areaBottom = isMobile() ? vh - ch - 24 : vh - GUTTER;
    var block = r.height + PAD * 2 + (isMobile() ? 0 : GAP + ch);
    var want;
    if (block <= areaBottom - areaTop) want = areaTop + (areaBottom - areaTop - block) / 2;
    else if (step.align === "end") want = areaBottom - r.height - PAD;
    else want = areaTop;
    var y = window.scrollY + r.top - PAD - want;
    var max = document.documentElement.scrollHeight - vh;
    return Math.max(0, Math.min(y, max));
  }

  // Resolves once the page has stopped scrolling (or after a second at most).
  function scrollThere(y, id) {
    return new Promise(function (resolve) {
      if (Math.abs(window.scrollY - y) < 2) { resolve(); return; }
      window.scrollTo({ top: y, behavior: reducedMotion() ? "auto" : "smooth" });
      var last = -1, still = 0, started = Date.now();
      (function check() {
        if (id !== moveId) { resolve(); return; }
        var now = window.scrollY;
        still = Math.abs(now - last) < 1 ? still + 1 : 0;
        last = now;
        if (still >= 5 || Date.now() - started > 1000) { resolve(); return; }
        requestAnimationFrame(check);
      })();
    });
  }

  function watch(el) {
    if (watcher) { watcher.disconnect(); watcher = null; }
    if (!el || !window.ResizeObserver) return;
    watcher = new ResizeObserver(function () { schedulePlace(); });
    watcher.observe(el);
  }

  function schedulePlace() {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      placeSpot();
      placeCard();
    });
  }

  async function go(next) {
    if (!tour) return;
    if (next >= tour.steps.length) { close(); return; }
    if (next < 0) return;

    var step = tour.steps[next];
    if (step.target && !resolveTarget(step)) {
      // An element that isn't on the page this time (a section the customer
      // doesn't have) is stepped over rather than lit as an empty spot.
      go(next + (next > index ? 1 : -1));
      return;
    }

    index = next;
    var id = ++moveId;
    els.card.classList.remove("is-shown");
    targetEl = resolveTarget(step);
    watch(targetEl);
    fillCard(step);

    await scrollThere(scrollGoal(step), id);
    if (id !== moveId || !els) return;
    els.spot.classList.remove("is-entering");
    placeSpot();
    placeCard();
    // Let the light start its glide before the card lands next to it.
    setTimeout(function () {
      if (id !== moveId || !els) return;
      placeCard();
      els.card.classList.add("is-shown");
      els.next.focus({ preventScroll: true });
    }, reducedMotion() ? 0 : 180);
  }

  function onKey(event) {
    if (!tour) return;
    // While a tour is open, the page's own shortcuts (approve, reject, move
    // between cards) must not fire behind it.
    event.stopImmediatePropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); }
    else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!els.back.hidden) go(index - 1);
    } else if (event.key === "Tab") {
      var buttons = Array.prototype.filter.call(
        els.card.querySelectorAll("button"), function (b) { return !b.hidden; });
      if (!buttons.length) return;
      var first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!els.card.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    }
  }

  function onLang() {
    if (tour && els) { fillCard(tour.steps[index]); schedulePlace(); }
  }

  async function start(config) {
    if (tour) return;
    mountStyle();
    tour = config;
    index = 0;
    opener = document.activeElement;
    markSeen(config.id);
    try { if (config.setup) await config.setup(); } catch (e) {}

    els = build();
    document.documentElement.classList.add("lbt-on");
    placeSpot();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", schedulePlace);
    window.addEventListener("scroll", schedulePlace, { passive: true });
    document.addEventListener("lb:langchange", onLang);
    go(0);
  }

  function close() {
    if (!tour) return;
    var done = tour;
    moveId++;
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", schedulePlace);
    window.removeEventListener("scroll", schedulePlace);
    document.removeEventListener("lb:langchange", onLang);
    if (watcher) { watcher.disconnect(); watcher = null; }

    var parts = els;
    els = null;
    tour = null;
    targetEl = null;
    document.documentElement.classList.remove("lbt-on");
    parts.card.classList.remove("is-shown");
    parts.spot.style.opacity = "0";
    parts.block.remove();
    setTimeout(function () {
      parts.card.remove();
      parts.spot.remove();
    }, reducedMotion() ? 0 : 300);

    try { if (done.teardown) done.teardown(); } catch (e) {}
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  window.LBTour = {
    // Opens the tour the first time this customer lands here, signed in.
    auto: function (config) {
      if (!window.LBAuth || !LBAuth.isLoggedIn() || hasSeen(config.id)) return;
      start(config);
    },
    start: start,
    // A small "Show me around" button under the page's headline, so the tour
    // can be opened again whenever the customer wants it.
    replayButton: function (config) {
      if (!window.LBAuth || !LBAuth.isLoggedIn()) return;
      mountStyle();
      var anchor = document.querySelector(".page-hero");
      if (!anchor || anchor.querySelector(".lbt-replay")) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "lbt-replay";
      button.innerHTML = '<span aria-hidden="true">&#8634;</span><span>SHOW ME AROUND</span>';
      button.addEventListener("click", function () { start(config); });
      anchor.appendChild(button);
    }
  };
})();
