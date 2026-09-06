/* LocalBoost interaction layer.
 *
 * Everything a pointer touches gets real physics: a spring that compresses on
 * pointer-down (not on click), a ripple from the exact point of contact, a
 * release that overshoots slightly the way a physical key does, and a spring
 * that can be grabbed and reversed mid-flight because it always animates from
 * its current on-screen value.
 *
 * Constraints this file works under:
 *   - The landing page (LocalBoost.dc.html) is rendered by a React runtime, so
 *     nothing here creates or destroys nodes inside the managed tree. Ripples
 *     and ambient light live in a fixed overlay appended to <body>; press
 *     physics only writes the element's own inline `transform`, which React
 *     rewrites only if that element's own style actually changes.
 *   - Every effect degrades to nothing. No element is required to exist.
 */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqFine = window.matchMedia("(pointer: fine)");
  var reduced = mqReduce.matches;
  var fine = mqFine.matches;
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function (e) { reduced = e.matches; });
  if (mqFine.addEventListener) mqFine.addEventListener("change", function (e) { fine = e.matches; });

  // The design-canvas page swaps <x-dc> for #dc-root as soon as its runtime
  // mounts, so both spellings have to count as "this is the canvas page".
  var isCanvasPage = !!doc.querySelector("x-dc, #dc-root, script[data-dc-script]");

  /* ===================================================================== *
   * Spring engine
   *
   * Apple's two parameters, not the physics triplet: `response` is how fast
   * the value reaches the target in seconds, `damping` is the damping ratio
   * (1.0 settles without overshoot, below 1.0 bounces). Each element gets one
   * motion record with independent channels, integrated in a single rAF loop.
   * ===================================================================== */

  var running = [];
  var rafId = null;
  var lastT = 0;

  function springConst(response, ratio) {
    return {
      k: Math.pow((2 * Math.PI) / response, 2),
      c: (4 * Math.PI * ratio) / response
    };
  }

  function frame(t) {
    rafId = null;
    var dt = lastT ? Math.min((t - lastT) / 1000, 0.064) : 1 / 60;
    lastT = t;
    for (var i = running.length - 1; i >= 0; i--) {
      var m = running[i];
      if (!integrate(m, dt)) {
        running.splice(i, 1);
        m.live = false;
        settle(m);
      }
    }
    if (running.length) rafId = requestAnimationFrame(frame);
    else lastT = 0;
  }

  function start(m) {
    if (m.live) return;
    m.live = true;
    running.push(m);
    if (rafId === null) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  function integrate(m, dt) {
    var steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / steps;
    var k = m.k, c = m.c;
    for (var i = 0; i < steps; i++) {
      m.sv += (-k * (m.s - m.st) - c * m.sv) * h; m.s += m.sv * h;
      m.xv += (-k * (m.x - m.xt) - c * m.xv) * h; m.x += m.xv * h;
      m.yv += (-k * (m.y - m.yt) - c * m.yv) * h; m.y += m.yv * h;
    }
    var moving =
      Math.abs(m.s - m.st) > 0.0004 || Math.abs(m.sv) > 0.004 ||
      Math.abs(m.x - m.xt) > 0.04 || Math.abs(m.xv) > 0.4 ||
      Math.abs(m.y - m.yt) > 0.04 || Math.abs(m.yv) > 0.4;
    if (!moving) {
      m.s = m.st; m.sv = 0;
      m.x = m.xt; m.xv = 0;
      m.y = m.yt; m.yv = 0;
    }
    paint(m);
    return moving;
  }

  // A backgrounded tab stops calling rAF, which would freeze every element
  // mid-spring. Coming back, snap them home rather than resuming a stale frame.
  doc.addEventListener("visibilitychange", function () {
    if (!doc.hidden) return;
    while (running.length) {
      var m = running.pop();
      m.live = false;
      m.s = m.st; m.sv = 0; m.x = m.xt; m.xv = 0; m.y = m.yt; m.yv = 0;
      paint(m);
      settle(m);
    }
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    lastT = 0;
  });

  var MOTION = new WeakMap();

  function motion(el) {
    var m = MOTION.get(el);
    if (m) return m;
    var sc = springConst(0.4, 1);
    m = {
      el: el, base: "", captured: false,
      s: 1, sv: 0, st: 1,
      x: 0, xv: 0, xt: 0,
      y: 0, yv: 0, yt: 0,
      k: sc.k, c: sc.c, live: false
    };
    MOTION.set(el, m);
    return m;
  }

  function capture(m) {
    if (m.captured) return;
    m.captured = true;
    // The element's own inline transform (if the template set one) stays as
    // the base; everything we add is composed on top of it.
    m.base = m.el.style.transform || "";
    m.el.classList.add("lb-springing");
  }

  function paint(m) {
    var t = "";
    if (m.x || m.y) t += "translate3d(" + m.x.toFixed(2) + "px," + m.y.toFixed(2) + "px,0) ";
    if (m.s !== 1) t += "scale(" + m.s.toFixed(4) + ")";
    m.el.style.transform = t ? (m.base ? m.base + " " + t : t) : m.base;
  }

  function settle(m) {
    if (m.st === 1 && m.xt === 0 && m.yt === 0) {
      // Back at rest: hand the element back to the stylesheet completely, so
      // CSS hover lifts and template transforms behave as they normally would.
      if (m.base) m.el.style.transform = m.base;
      else m.el.style.removeProperty("transform");
      m.el.classList.remove("lb-springing");
      m.captured = false;
      m.base = "";
    }
  }

  function springTo(el, opts) {
    var m = motion(el);
    capture(m);
    var sc = springConst(opts.response || 0.4, opts.damping == null ? 1 : opts.damping);
    m.k = sc.k; m.c = sc.c;
    if (opts.scale != null) m.st = opts.scale;
    if (opts.x != null) m.xt = opts.x;
    if (opts.y != null) m.yt = opts.y;
    start(m);
    return m;
  }

  /* ===================================================================== *
   * FX overlay: ripples and ambient light live outside every managed tree
   * ===================================================================== */

  var fx = null;
  function fxLayer() {
    if (fx && fx.isConnected) return fx;
    fx = doc.createElement("div");
    fx.id = "lb-fx";
    doc.body.appendChild(fx);
    return fx;
  }

  function luminance(color) {
    var m = /rgba?\(([^)]+)\)/.exec(color || "");
    if (!m) return 0;
    var p = m[1].split(",").map(parseFloat);
    var a = p.length > 3 ? p[3] : 1;
    if (a < 0.25) return 0; // effectively transparent over a dark page
    return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
  }

  function ripple(el, rect, px, py, cs) {
    if (reduced) return;
    var layer = fxLayer();
    var clip = doc.createElement("div");
    clip.className = "lb-ripple-clip";
    clip.style.cssText =
      "left:" + rect.left + "px;top:" + rect.top + "px;" +
      "width:" + rect.width + "px;height:" + rect.height + "px;" +
      "border-radius:" + cs.borderRadius + ";";

    var dot = doc.createElement("span");
    var light = luminance(cs.backgroundColor) > 0.5;
    dot.className = "lb-ripple" + (light ? " dark" : "");
    var d = Math.max(rect.width, rect.height) * 2.2;
    dot.style.cssText =
      "width:" + d + "px;height:" + d + "px;" +
      "left:" + (px - rect.left) + "px;top:" + (py - rect.top) + "px;";
    clip.appendChild(dot);
    layer.appendChild(clip);

    var anim = dot.animate(
      [
        { transform: "translate(-50%,-50%) scale(0)", opacity: light ? 0.5 : 0.42 },
        { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }
      ],
      { duration: 620, easing: "cubic-bezier(.22,1,.36,1)" }
    );
    var done = function () { if (clip.parentNode) clip.parentNode.removeChild(clip); };
    if (anim && anim.finished && anim.finished.then) anim.finished.then(done, done);
    // Belt and braces: a tab that stops compositing mid-ripple must not leave
    // the overlay collecting orphans.
    setTimeout(done, 1200);
  }

  function haptic(ms) {
    if (reduced || fine) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  /* ===================================================================== *
   * Press physics
   *
   * A pressable is found by walking up from the pointer target looking for the
   * first element the browser already treats as clickable (cursor: pointer).
   * That works identically for <button>, for the landing page's inline-styled
   * anchors, and for the React runtime's clickable <div>s — no markup needed.
   * ===================================================================== */

  var TEXT_ENTRY = /^(TEXTAREA|SELECT|OPTION)$/;
  var CLICKY_INPUT = /^(checkbox|radio|submit|button)$/;

  function pressable(node) {
    for (var i = 0; node && node !== doc.body && i < 7; i++, node = node.parentElement) {
      if (node.nodeType !== 1) continue;
      if (TEXT_ENTRY.test(node.tagName)) return null;
      if (node.tagName === "INPUT" && !CLICKY_INPUT.test((node.type || "").toLowerCase())) return null;
      if (node.hasAttribute && node.hasAttribute("data-nopress")) return null;
      var cs = getComputedStyle(node);
      if (cs.cursor === "pointer" || node.tagName === "BUTTON") return { el: node, cs: cs };
    }
    return null;
  }

  function describe(hit) {
    var el = hit.el, cs = hit.cs;
    var rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    var bgAlpha = 0;
    var m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || "");
    if (m) { var p = m[1].split(",").map(parseFloat); bgAlpha = p.length > 3 ? p[3] : 1; }
    var radius = parseFloat(cs.borderTopLeftRadius) || 0;
    var bordered = (parseFloat(cs.borderTopWidth) || 0) > 0 || (parseFloat(cs.borderLeftWidth) || 0) > 0;
    var surface = bgAlpha > 0.02 || bordered || el.tagName === "BUTTON" || radius >= 8;
    if (!surface) return null; // a bare text link: the underline is its feedback

    var area = rect.width * rect.height;
    // Big surfaces move less: a card the size of a postcard that shrinks 4%
    // reads as broken, the same 4% on a pill button reads as a keypress.
    var scale = area > 90000 ? 0.992 : area > 26000 ? 0.978 : 0.955;

    return { el: el, cs: cs, rect: rect, scale: scale, ripple: bgAlpha > 0.03 || bordered || el.tagName === "BUTTON" };
  }

  var press = null;

  doc.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    var hit = pressable(e.target);
    if (!hit) return;
    var info = describe(hit);
    if (!info) return;

    if (press) release(press, true);
    press = info;
    press.pointerId = e.pointerId;
    press.down = true;

    // Feedback happens now, on contact — never on click.
    springTo(info.el, { scale: info.scale, response: 0.17, damping: 1 });
    if (info.ripple) ripple(info.el, info.rect, e.clientX, e.clientY, info.cs);
    haptic(7);
  }, { passive: true, capture: true });

  function release(p, cancelled) {
    if (!p) return;
    // A real key springs back past its resting point. Only a completed press
    // earns the overshoot; a cancelled one returns flat.
    springTo(p.el, cancelled
      ? { scale: 1, response: 0.34, damping: 1 }
      : { scale: 1, response: 0.42, damping: 0.62 });
    if (press === p) press = null;
  }

  // Capture phase throughout: a page handler that stops propagation must never
  // be able to strand a button in its pressed state.
  doc.addEventListener("pointerup", function (e) {
    if (press && press.pointerId === e.pointerId) release(press, !press.down);
  }, { passive: true, capture: true });

  doc.addEventListener("pointercancel", function () { release(press, true); }, { passive: true, capture: true });
  window.addEventListener("blur", function () { release(press, true); });

  // Cancel-by-dragging-away, and re-press by coming back: 12px of slop first,
  // so a press never dies from the tremor of a finger holding still.
  doc.addEventListener("pointermove", function (e) {
    if (!press || press.pointerId !== e.pointerId) return;
    var r = press.el.getBoundingClientRect();
    var pad = 12;
    var inside =
      e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
      e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    if (inside === press.down) return;
    press.down = inside;
    springTo(press.el, inside
      ? { scale: press.scale, response: 0.2, damping: 1 }
      : { scale: 1, response: 0.3, damping: 1 });
  }, { passive: true, capture: true });

  /* ===================================================================== *
   * Hover: specular light that tracks the pointer, and a magnetic pull on
   * the primary calls to action. Fine pointers only.
   * ===================================================================== */

  var MAGNETIC = ".btn,.lb-cta,.nav-cta";
  var hovering = null;
  var magnet = null;

  doc.addEventListener("pointerover", function (e) {
    if (!fine) return;
    var hit = pressable(e.target);
    hovering = hit ? hit.el : null;
    magnet = hovering && hovering.closest && hovering.closest(MAGNETIC);
    if (magnet && !reduced) springTo(magnet, { response: 0.35, damping: 1 });
  }, { passive: true });

  doc.addEventListener("pointerout", function (e) {
    if (!fine) return;
    if (magnet && (!e.relatedTarget || !magnet.contains(e.relatedTarget))) {
      springTo(magnet, { x: 0, y: 0, response: 0.5, damping: 0.6 });
      magnet = null;
    }
    if (hovering && (!e.relatedTarget || !hovering.contains(e.relatedTarget))) hovering = null;
  }, { passive: true });

  doc.addEventListener("pointermove", function (e) {
    if (!fine || !hovering) return;
    var r = hovering.getBoundingClientRect();
    // The ::after spotlight reads these two custom properties.
    hovering.style.setProperty("--lb-mx", (e.clientX - r.left).toFixed(0) + "px");
    hovering.style.setProperty("--lb-my", (e.clientY - r.top).toFixed(0) + "px");

    if (magnet && !reduced && !press) {
      var mr = magnet.getBoundingClientRect();
      var dx = e.clientX - (mr.left + mr.width / 2);
      var dy = e.clientY - (mr.top + mr.height / 2);
      var pull = 0.16, cap = 7;
      springTo(magnet, {
        x: Math.max(-cap, Math.min(cap, dx * pull)),
        y: Math.max(-cap, Math.min(cap, dy * pull)),
        response: 0.28, damping: 1
      });
    }
  }, { passive: true });

  /* ===================================================================== *
   * Ambient cursor light
   * ===================================================================== */

  function ambientLight() {
    if (!fine || reduced) return;
    var el = doc.createElement("div");
    el.id = "lb-cursor";
    fxLayer().appendChild(el);
    var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty, ticking = false;

    function run() {
      ticking = false;
      cx += (tx - cx) * 0.11;
      cy += (ty - cy) * 0.11;
      el.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) { ticking = true; requestAnimationFrame(run); }
    }
    doc.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      el.classList.add("on");
      if (!ticking) { ticking = true; requestAnimationFrame(run); }
    }, { passive: true });
    doc.addEventListener("pointerleave", function () { el.classList.remove("on"); }, { passive: true });
  }

  /* ===================================================================== *
   * Loading: a bar for navigation, a spinner for the button that started it
   * ===================================================================== */

  var bar = null, barFill = null, barTimer = null, barValue = 0;

  function barEl() {
    if (bar && bar.isConnected) return bar;
    bar = doc.createElement("div");
    bar.id = "lb-bar";
    barFill = doc.createElement("i");
    bar.appendChild(barFill);
    doc.body.appendChild(bar);
    return bar;
  }

  function barSet(v, ms) {
    barEl();
    barValue = v;
    barFill.style.transition = "transform " + (ms == null ? 260 : ms) + "ms cubic-bezier(.22,1,.36,1)";
    barFill.style.transform = "scaleX(" + v + ")";
  }

  function barStart() {
    if (reduced) return;
    barEl().classList.add("on");
    barSet(0, 0);
    requestAnimationFrame(function () { barSet(0.32, 220); });
    clearInterval(barTimer);
    // Creep toward, never reaching, the end — the honest shape of "still working".
    barTimer = setInterval(function () {
      barSet(barValue + (0.92 - barValue) * 0.18, 320);
    }, 340);
  }

  function barDone() {
    if (!bar) return;
    clearInterval(barTimer);
    barSet(1, 200);
    setTimeout(function () {
      bar.classList.remove("on");
      setTimeout(function () { barSet(0, 0); }, 320);
    }, 220);
  }

  var CHECK = '<svg class="lb-check" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9"/></svg>';

  function busy(btn) {
    if (!btn || btn.classList.contains("lb-busy")) return;
    var cs = getComputedStyle(btn);
    btn.dataset.lbW = btn.style.width;
    btn.dataset.lbH = btn.style.height;
    var r = btn.getBoundingClientRect();
    // Freeze the box so the label vanishing does not collapse the button.
    btn.style.width = r.width + "px";
    btn.style.height = r.height + "px";
    btn.classList.add("lb-busy");
    if (cs.position === "static") btn.style.position = "relative";
    // `.lb-busy` makes the label transparent, so the spinner carries the
    // button's real ink colour explicitly instead of inheriting it.
    btn.dataset.lbInk = cs.color;
    var spin = doc.createElement("span");
    spin.className = "lb-spin";
    spin.style.color = cs.color;
    spin.setAttribute("data-lb-fx", "1");
    btn.appendChild(spin);
  }

  function unbusy(btn, ok) {
    if (!btn || !btn.classList.contains("lb-busy")) return;
    var spin = btn.querySelector("[data-lb-fx]");
    if (spin) spin.parentNode.removeChild(spin);

    function restore() {
      btn.classList.remove("lb-busy");
      btn.style.width = btn.dataset.lbW || "";
      btn.style.height = btn.dataset.lbH || "";
      delete btn.dataset.lbW;
      delete btn.dataset.lbH;
    }

    if (ok && !reduced) {
      btn.insertAdjacentHTML("beforeend", CHECK);
      var check = btn.querySelector(".lb-check");
      if (check) {
        check.setAttribute("data-lb-fx", "1");
        check.style.color = btn.dataset.lbInk || "";
      }
      haptic([6, 40, 12]);
      setTimeout(function () {
        if (check && check.parentNode) check.parentNode.removeChild(check);
        restore();
      }, 900);
    } else {
      restore();
      if (ok === false) {
        btn.classList.remove("lb-shake");
        void btn.offsetWidth;
        btn.classList.add("lb-shake");
        setTimeout(function () { btn.classList.remove("lb-shake"); }, 600);
      }
    }
  }

  /* The existing page scripts already flip `disabled` on the submit button
   * around their async work, so that attribute is the truthful signal for
   * when the work starts and stops — no page script needs to change. */
  function wireForms() {
    doc.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      var btn = form.querySelector("button[type=submit],input[type=submit]");
      if (!btn) return;

      busy(btn);
      barStart();
      var settled = false;

      var stop = function (ok) {
        if (settled) return;
        settled = true;
        obs.disconnect();
        clearTimeout(fallback);
        barDone();
        unbusy(btn, ok);
      };

      var obs = new MutationObserver(function () {
        if (!btn.disabled && btn.isConnected) stop(false);        // re-enabled: it failed
        else if (form.hidden || !btn.isConnected) stop(true);      // form retired: it worked
      });
      obs.observe(form, { attributes: true, childList: true, subtree: true, attributeFilter: ["disabled", "hidden"] });

      var fallback = setTimeout(function () { stop(null); }, 15000);
    }, true);
  }

  /* ===================================================================== *
   * Page transitions: leave with the bar running, arrive with it finishing
   * ===================================================================== */

  function wireNavigation() {
    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(mailto:|tel:|javascript:)/i.test(href)) return;

      var url;
      try { url = new URL(a.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return; // same page, just an anchor

      e.preventDefault();
      barStart();
      root.classList.add("lb-leaving");
      setTimeout(function () { location.href = a.href; }, 190);
    });

    // Coming back through the bfcache must not leave the page dimmed.
    window.addEventListener("pageshow", function () {
      root.classList.remove("lb-leaving");
      barDone();
    });
  }

  /* ===================================================================== *
   * Scroll: progress, a nav that condenses, a way back to the top
   * ===================================================================== */

  function wireScroll() {
    var progress = null;
    if (!isCanvasPage) {
      // The canvas page already carries its own progress rail on the right.
      progress = doc.createElement("div");
      progress.id = "lb-scroll";
      doc.body.appendChild(progress);
    }

    var top = doc.createElement("button");
    top.id = "lb-top";
    top.type = "button";
    top.setAttribute("aria-label", "Back to top");
    top.innerHTML = "&uarr;";
    doc.body.appendChild(top);
    top.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });

    var nav = doc.querySelector("nav.nav, nav.lb-nav, nav");
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY || 0;
      var max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
      if (progress) progress.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
      if (nav) nav.classList.toggle("lb-scrolled", y > 24);
      top.classList.toggle("on", y > 700);
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ===================================================================== *
   * The tab switch gets a pill that slides between the tabs instead of two
   * backgrounds cutting to each other.
   * ===================================================================== */

  function wireTabs() {
    var groups = doc.querySelectorAll(".tabswitch");
    Array.prototype.forEach.call(groups, function (group) {
      var buttons = group.querySelectorAll("button");
      if (buttons.length < 2) return;

      var pill = doc.createElement("span");
      pill.className = "lb-pill";
      group.insertBefore(pill, group.firstChild);
      group.classList.add("lb-has-pill");

      var placed = false;
      function place(animated) {
        var active = group.querySelector("button.active") || buttons[0];
        var gr = group.getBoundingClientRect();
        var br = active.getBoundingClientRect();
        if (!br.width) return;
        pill.style.transition = (animated && !reduced)
          ? "transform .42s cubic-bezier(.22,1,.36,1),width .42s cubic-bezier(.22,1,.36,1)"
          : "none";
        pill.style.width = br.width + "px";
        pill.style.transform = "translateX(" + (br.left - gr.left) + "px)";
        placed = true;
      }

      place(false);
      // The page's own click handler flips `.active`; watch for it rather than
      // duplicating that logic here.
      new MutationObserver(function () { place(true); })
        .observe(group, { attributes: true, subtree: true, attributeFilter: ["class"] });
      window.addEventListener("resize", function () { place(false); }, { passive: true });
      if (!placed) setTimeout(function () { place(false); }, 60);
    });
  }

  /* ===================================================================== *
   * Boot
   * ===================================================================== */

  function init() {
    root.classList.add("lb-js");
    fxLayer();
    ambientLight();
    wireForms();
    wireNavigation();
    wireScroll();
    wireTabs();

    if (doc.readyState === "complete") barDone();
    else { barStart(); window.addEventListener("load", barDone); }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();

  // Small public surface so page scripts can drive the same states.
  window.LBFX = { busy: busy, unbusy: unbusy, barStart: barStart, barDone: barDone, ripple: ripple };
})();
