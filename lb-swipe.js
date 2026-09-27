/* <lb-swipe> — the "try it" deck in the home page hero.
 *
 * A short stack of sample ads the visitor approves or rejects the way a real
 * drop is triaged in approvals.html: drag or flick a card right to approve,
 * left to reject, use the two buttons, or the arrow / Y / N keys once the deck
 * has focus. Nothing here is saved or sent anywhere — it is a demo.
 *
 * Motion follows Apple's fluid-interface rules:
 *   - the card tracks the pointer 1:1 from where it was grabbed, and tilts the
 *     way a card on a table would for that grab point;
 *   - on release the pointer's velocity is projected forward (the same decay
 *     formula iOS uses for scrolling), and the projected point — not the
 *     release point — decides approve / reject / return;
 *   - every move is a spring (damping ratio + response) that starts from the
 *     card's on-screen position with the finger's velocity, so a throw carries
 *     on without a seam and a card can be caught again mid-flight;
 *   - bounce only when the gesture itself carried momentum.
 * With prefers-reduced-motion the deck still works, but cards fade instead of
 * flying and nothing springs.
 *
 * The copy is English here and goes through i18n.js with the rest of the page,
 * so the Serbian lives in i18n-sr.js.
 */
(function () {
  if (customElements.get("lb-swipe")) return;

  var CARDS = [
    { img: "examples/pizza.jpg", name: "Marko Pizza", initial: "M", tint: "#f2b27a", channel: "Instagram", day: "MON", time: "18:30",
      alt: "Example ad for a pizza place: No ideas for dinner?", caption: "No ideas for dinner? Fresh pizza, hot from the oven tonight." },
    { img: "examples/bakery.jpg", name: "The Corner Bakery", initial: "C", tint: "#e8d5b8", channel: "Facebook", day: "TUE", time: "07:00",
      alt: "Example ad for a bakery: Good morning! Freshly baked donuts and pastry.", caption: "Fresh out of the oven at 7am. Grab one on your way to work." },
    { img: "examples/salon.jpg", name: "Glow Hair Salon", initial: "G", tint: "#f0c9c9", channel: "Instagram", day: "WED", time: "12:30",
      alt: "Example ad for a hair salon: Time for a change?", caption: "Book a quick trim this week and walk out feeling new." },
    { img: "examples/cafe.jpg", name: "The Daily Grind Café", initial: "D", tint: "#e8d5b8", channel: "Instagram", day: "THU", time: "08:00",
      alt: "Example story for a café: Hard Monday? Get your perfect coffee fix.", caption: "Hard week? Your perfect coffee fix is two minutes away." },
    { img: "examples/fitness.jpg", name: "Strong Life Fitness", initial: "S", tint: "#e6c58f", channel: "TikTok", day: "FRI", time: "17:15",
      alt: "Example ad for a gym: Time to work out!", caption: "Personal plans and expert guidance. Your first session is on us." }
  ];

  // How far a flick carries: Apple's projection, a touch snappier than scroll.
  var DECEL = 0.99;
  function project(v) { return (v / 1000) * DECEL / (1 - DECEL); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* A spring in Apple's two designer-facing numbers. Response is roughly how
     long it takes to get there (seconds); damping 1 settles without overshoot,
     below 1 overshoots. Integrated in small fixed steps so it stays stable. */
  function Spring(value) {
    this.value = value; this.velocity = 0; this.target = value;
    this.response = 0.4; this.damping = 1;
  }
  Spring.prototype.to = function (target, response, damping, velocity) {
    this.target = target;
    if (response) this.response = response;
    if (damping) this.damping = damping;
    if (velocity !== undefined) this.velocity = velocity;
  };
  Spring.prototype.hold = function (value) { this.value = this.target = value; this.velocity = 0; };
  Spring.prototype.step = function (dt) {
    var w = 2 * Math.PI / this.response;
    var a = -w * w * (this.value - this.target) - 2 * this.damping * w * this.velocity;
    this.velocity += a * dt;
    this.value += this.velocity * dt;
  };
  Spring.prototype.settled = function () {
    return Math.abs(this.value - this.target) < 0.08 && Math.abs(this.velocity) < 0.6;
  };

  var STYLE = [
    // Its own stacking layer: thrown cards stay under the page's floating
    // chips and headline instead of fighting them for the top.
    "lb-swipe{display:block;position:relative;z-index:1;width:100%;max-width:372px;margin:0 auto;-webkit-tap-highlight-color:transparent}",
    ".sw-region{position:relative;outline:none;border-radius:28px}",
    ".sw-region:focus-visible{outline:2px solid var(--acc,#7cc6ff);outline-offset:8px}",
    ".sw-deck{display:grid;position:relative}",
    ".sw-card,.sw-done{grid-area:1/1}",
    ".sw-card{position:relative;display:flex;flex-direction:column;border-radius:26px;overflow:hidden;",
    "border:1px solid rgba(255,255,255,.1);background:#101217;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 30px 70px -24px rgba(0,0,0,.85),0 12px 24px -12px rgba(0,0,0,.6);",
    "touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform;transform-origin:50% 50%}",
    ".sw-card.is-grabbed{cursor:grabbing}",
    ".sw-card.sw-ghost{visibility:hidden;pointer-events:none;box-shadow:none}",
    ".sw-card.is-under{pointer-events:none}",
    ".sw-head{display:flex;align-items:center;gap:10px;padding:13px 14px}",
    ".sw-av{display:flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;border-radius:9999px;color:#16130f;font-size:13px;font-weight:700}",
    ".sw-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;letter-spacing:-.01em;color:#f2f4f7}",
    ".sw-ch{margin-left:auto;flex:none;padding:4px 10px;border-radius:9999px;border:1px solid rgba(255,255,255,.12);font-size:11.5px;color:#b3b9c4}",
    ".sw-media{position:relative;aspect-ratio:307/316;background:#15171b;overflow:hidden}",
    ".sw-media img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none}",
    ".sw-cap{margin:0;padding:12px 16px 4px;font-size:13.5px;line-height:1.5;color:#b3b9c4;min-height:52px}",
    ".sw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 16px 15px}",
    ".sw-slot{display:inline-flex;align-items:center;gap:7px;font-family:'Geist Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.08em;color:#878d98}",
    ".sw-slot::before{content:'';width:6px;height:6px;border-radius:9999px;background:var(--acc,#7cc6ff);box-shadow:0 0 10px rgba(124,198,255,.8)}",
    ".sw-wait{font-family:'Geist Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;color:#f0c878}",
    ".sw-stamp{position:absolute;top:66px;padding:7px 14px;border-radius:12px;border:2px solid;font-family:'Geist Mono',ui-monospace,monospace;font-size:14px;font-weight:600;letter-spacing:.14em;opacity:0;pointer-events:none;",
    "background:rgba(5,6,8,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}",
    ".sw-stamp.is-yes{left:16px;color:#9fd7b0;border-color:rgba(159,215,176,.8);transform:rotate(-10deg)}",
    ".sw-stamp.is-no{right:16px;color:#f0a8a8;border-color:rgba(240,168,168,.8);transform:rotate(10deg)}",
    ".sw-done{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 26px;border-radius:26px;",
    "border:1px solid rgba(124,198,255,.28);background:radial-gradient(120% 70% at 50% 0%,rgba(92,182,247,.18),rgba(92,182,247,0) 70%),#0d0f13;",
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 30px 70px -24px rgba(0,0,0,.85);opacity:0;transform:scale(.94);pointer-events:none;",
    "transition:opacity .35s ease,transform .5s cubic-bezier(.22,1,.36,1)}",
    ".sw-done.is-on{opacity:1;transform:none;pointer-events:auto}",
    ".sw-done-mark{display:flex;align-items:center;justify-content:center;width:58px;height:58px;border-radius:18px;background:rgba(159,215,176,.14);border:1px solid rgba(159,215,176,.4);color:#9fd7b0;font-size:26px}",
    ".sw-done-title{margin:20px 0 0;font-size:26px;font-weight:600;line-height:1.15;letter-spacing:-.03em;color:#f2f4f7;text-wrap:balance}",
    ".sw-done-tally{display:flex;gap:18px;margin:14px 0 0;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;letter-spacing:.06em;color:#878d98}",
    ".sw-done-tally b{margin-left:6px;font-family:'Geist',sans-serif;font-size:15px;color:#f2f4f7}",
    ".sw-done-text{margin:16px 0 0;max-width:30ch;font-size:15px;line-height:1.55;color:#b3b9c4}",
    ".sw-done .btn{margin-top:24px}",
    ".sw-replay{margin-top:14px;padding:8px 12px;border:none;background:none;color:#878d98;font-family:inherit;font-size:13.5px;cursor:pointer;border-radius:9999px}",
    ".sw-replay:hover{color:#f2f4f7}",
    ".sw-controls{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:22px}",
    ".sw-btn{display:flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:9999px;cursor:pointer;font-size:22px;line-height:1;",
    "border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);",
    "transition:background .2s ease,border-color .2s ease,color .2s ease,transform .12s ease,opacity .2s ease}",
    ".sw-btn:active{transform:scale(.92)}",
    ".sw-btn:disabled{opacity:.35;cursor:default}",
    ".sw-btn.is-no{color:#f0a8a8}",
    ".sw-btn.is-no:hover{background:rgba(240,168,168,.1);border-color:rgba(240,168,168,.4)}",
    ".sw-btn.is-yes{width:72px;height:72px;font-size:26px;color:#9fd7b0;border-color:rgba(159,215,176,.36);background:rgba(159,215,176,.1)}",
    ".sw-btn.is-yes:hover{background:rgba(159,215,176,.18);border-color:rgba(159,215,176,.6)}",
    ".sw-dots{display:flex;gap:6px}",
    ".sw-dots span{width:7px;height:7px;border-radius:9999px;background:rgba(255,255,255,.16);transition:background .3s ease,transform .3s cubic-bezier(.22,1,.36,1)}",
    ".sw-dots span.is-yes{background:#9fd7b0}",
    ".sw-dots span.is-no{background:#f0a8a8}",
    ".sw-dots span.is-now{background:#f2f4f7;transform:scale(1.3)}",
    ".sw-hint{margin:14px 0 0;text-align:center;font-size:13px;color:#878d98}",
    ".sw-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    "@media (max-width:520px){.sw-btn{width:56px;height:56px}.sw-btn.is-yes{width:64px;height:64px}.sw-done-title{font-size:23px}}",
    "@media (prefers-reduced-motion:reduce){.sw-done{transition:opacity .2s ease;transform:none}}"
  ].join("");

  function mountStyle() {
    if (document.getElementById("lb-swipe-style")) return;
    var style = document.createElement("style");
    style.id = "lb-swipe-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  class LBSwipe extends HTMLElement {
    connectedCallback() {
      // The page's raw template (inside <x-dc>) is live DOM before the runtime
      // reads it, and this script has already run by then. Building in there
      // would bake the deck's nodes into the template, and React would then
      // fight this element over them. Only the rendered copy builds.
      if (this._built || this.closest("x-dc")) return;
      this._built = true;
      mountStyle();
      this.reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.tick = this.tick.bind(this);
      this.build();
      this.watchFirstView();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this.io) this.io.disconnect();
    }

    /* ------------------------------------------------------------- markup */
    build() {
      this.innerHTML = "";
      this.cards = [];
      this.results = [];
      this.touched = false;

      var region = (this.region = el("div", "sw-region"));
      region.tabIndex = 0;
      region.setAttribute("role", "group");
      region.setAttribute("aria-label", "Try it: approve or reject this week's sample ads");

      var deck = (this.deck = el("div", "sw-deck"));
      region.appendChild(deck);

      // An invisible copy of a card holds the deck's height, so the stack
      // never collapses while cards fly off or when the last one is gone.
      var ghost = this.buildCard(CARDS[0]);
      ghost.className = "sw-card sw-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.querySelector("img").removeAttribute("src");
      deck.appendChild(ghost);

      // Built bottom-up so the first card sits on top of the stack.
      for (var i = CARDS.length - 1; i >= 0; i--) {
        var node = this.buildCard(CARDS[i]);
        deck.appendChild(node);
        this.cards.unshift({
          data: CARDS[i], node: node,
          x: new Spring(0), y: new Spring(0),
          level: new Spring(i), stamp: node.querySelectorAll(".sw-stamp")
        });
      }

      this.done = this.buildDone();
      deck.appendChild(this.done);

      var controls = el("div", "sw-controls");
      this.noBtn = el("button", "sw-btn is-no", "✕");
      this.noBtn.type = "button";
      this.noBtn.setAttribute("aria-label", "Reject this ad");
      this.yesBtn = el("button", "sw-btn is-yes", "✓");
      this.yesBtn.type = "button";
      this.yesBtn.setAttribute("aria-label", "Approve this ad");
      this.dots = el("div", "sw-dots");
      this.dots.setAttribute("aria-hidden", "true");
      CARDS.forEach(function () { this.dots.appendChild(el("span")); }, this);
      controls.appendChild(this.noBtn);
      controls.appendChild(this.dots);
      controls.appendChild(this.yesBtn);
      region.appendChild(controls);

      this.hint = el("p", "sw-hint", "Swipe right to approve, left to reject.");
      region.appendChild(this.hint);

      this.live = el("div", "sw-live");
      this.live.setAttribute("role", "status");
      region.appendChild(this.live);

      this.appendChild(region);

      var self = this;
      this.noBtn.addEventListener("click", function () { self.decide(-1); });
      this.yesBtn.addEventListener("click", function () { self.decide(1); });
      region.addEventListener("keydown", function (e) {
        if (e.target !== region) return;
        var k = e.key;
        if (k === "ArrowRight" || k === "y" || k === "Y") { e.preventDefault(); self.decide(1); }
        else if (k === "ArrowLeft" || k === "n" || k === "N") { e.preventDefault(); self.decide(-1); }
      });

      this.wireTop();
      this.render();
    }

    buildCard(d) {
      var card = el("article", "sw-card");
      var head = el("div", "sw-head");
      var av = el("span", "sw-av", d.initial);
      av.style.background = d.tint;
      av.setAttribute("aria-hidden", "true");
      head.appendChild(av);
      head.appendChild(el("span", "sw-name", d.name));
      head.appendChild(el("span", "sw-ch", d.channel));
      card.appendChild(head);

      var media = el("div", "sw-media");
      var img = el("img");
      img.src = d.img;
      img.alt = d.alt;
      img.width = 307;
      img.height = 316;
      img.draggable = false;
      img.decoding = "async";
      media.appendChild(img);
      card.appendChild(media);

      card.appendChild(el("p", "sw-cap", d.caption));

      var foot = el("div", "sw-foot");
      var slot = el("span", "sw-slot");
      slot.appendChild(el("span", "", d.day));
      slot.appendChild(el("span", "", d.time));
      foot.appendChild(slot);
      foot.appendChild(el("span", "sw-wait", "WAITING"));
      card.appendChild(foot);

      var yes = el("div", "sw-stamp is-yes", "APPROVE");
      var no = el("div", "sw-stamp is-no", "REJECT");
      yes.setAttribute("aria-hidden", "true");
      no.setAttribute("aria-hidden", "true");
      card.appendChild(yes);
      card.appendChild(no);
      return card;
    }

    buildDone() {
      var done = el("div", "sw-done");
      done.setAttribute("aria-hidden", "true");
      done.appendChild(el("div", "sw-done-mark", "✓"));
      done.appendChild(el("div", "sw-done-title", "That's your week, sorted."));

      var tally = el("div", "sw-done-tally");
      var a = el("span");
      a.appendChild(el("span", "", "Approved:"));
      this.nYes = el("b", "", "0");
      a.appendChild(this.nYes);
      var r = el("span");
      r.appendChild(el("span", "", "Rejected:"));
      this.nNo = el("b", "", "0");
      r.appendChild(this.nNo);
      tally.appendChild(a);
      tally.appendChild(r);
      done.appendChild(tally);

      done.appendChild(el("p", "sw-done-text", "That's the whole job. Every Monday, a fresh drop made for your business waits for you like this."));

      var cta = el("a", "btn");
      cta.href = "signup.html";
      cta.appendChild(el("span", "", "Get ads like these"));
      var arrow = el("span", "mono", "→");
      arrow.setAttribute("aria-hidden", "true");
      cta.appendChild(arrow);
      done.appendChild(cta);

      var replay = el("button", "sw-replay", "↺ Try it again");
      replay.type = "button";
      var self = this;
      replay.addEventListener("click", function () {
        self.build();
        self.region.focus({ preventScroll: true });
      });
      done.appendChild(replay);
      return done;
    }

    /* ------------------------------------------------------------ gestures */
    top() { return this.cards[0] || null; }

    wireTop() {
      var c = this.top();
      if (!c || c.wired) return;
      c.wired = true;
      var self = this;
      var node = c.node;
      var g = null; // the gesture in progress

      node.addEventListener("pointerdown", function (e) {
        if (c !== self.top()) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // Caught mid-throw: it stops being thrown and follows the hand again.
        c.leaving = 0;
        var box = node.getBoundingClientRect();
        g = {
          id: e.pointerId, sx: e.clientX, sy: e.clientY,
          // Interruptible: start from wherever the card is right now.
          bx: c.x.value, by: c.y.value,
          // Tilt follows the grab point: held near the top, it swings the
          // way the hand moves; held near the bottom, the other way.
          sign: (e.clientY - box.top) < box.height * 0.55 ? 1 : -1,
          moving: false,
          trail: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }]
        };
        c.x.hold(c.x.value);
        c.y.hold(c.y.value);
        c.sign = g.sign;
        try { node.setPointerCapture(e.pointerId); } catch (err) {}
      });

      node.addEventListener("pointermove", function (e) {
        if (!g || e.pointerId !== g.id) return;
        var dx = e.clientX - g.sx, dy = e.clientY - g.sy;
        if (!g.moving) {
          // A little hysteresis so a tap never nudges the card.
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          g.moving = true;
          self.touched = true;
          node.classList.add("is-grabbed");
        }
        c.x.hold(g.bx + dx);
        c.y.hold(g.by + dy * 0.55);
        g.trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
        if (g.trail.length > 8) g.trail.shift();
        self.render();
      });

      function release(e, cancelled) {
        if (!g || e.pointerId !== g.id) return;
        var gesture = g;
        g = null;
        node.classList.remove("is-grabbed");
        if (!gesture.moving) return;

        // Velocity over the last ~100ms of movement, in px/s.
        var trail = gesture.trail, last = trail[trail.length - 1], first = last;
        for (var i = trail.length - 1; i >= 0; i--) {
          if (last.t - trail[i].t > 100) break;
          first = trail[i];
        }
        var dt = Math.max(1, last.t - first.t) / 1000;
        var vx = first === last ? 0 : (last.x - first.x) / dt;
        var vy = first === last ? 0 : (last.y - first.y) / dt * 0.55;

        var width = self.deck.offsetWidth || 340;
        var landing = c.x.value + project(vx);
        if (!cancelled && landing > width * 0.42) self.send(c, 1, vx, vy);
        else if (!cancelled && landing < -width * 0.42) self.send(c, -1, vx, vy);
        else {
          // Back to the stack, carrying the release velocity. It was thrown,
          // so it may overshoot a touch.
          c.x.to(0, 0.42, 0.8, vx);
          c.y.to(0, 0.42, 0.8, vy);
          self.start();
        }
      }
      node.addEventListener("pointerup", function (e) { release(e, false); });
      node.addEventListener("pointercancel", function (e) { release(e, true); });
    }

    /* A button or key: throw the top card the same way a flick would. */
    decide(dir) {
      var c = this.top();
      if (!c || c.leaving) return;
      this.touched = true;
      this.send(c, dir, dir * 1500, -120);
    }

    send(c, dir, vx, vy) {
      c.leaving = dir;
      var width = this.deck.offsetWidth || 340;
      if (this.reduced) {
        this.finish(c);
        return;
      }
      // Always leave at least briskly, whatever speed the hand let go at.
      var speed = dir > 0 ? Math.max(vx, 1100) : Math.min(vx, -1100);
      c.x.to(dir * (width * 1.7 + 120), 0.5, 1, speed);
      c.y.to(c.y.value + clamp(vy * 0.18, -120, 120), 0.5, 1, vy);
      if (navigator.vibrate && matchMedia("(pointer:coarse)").matches) {
        try { navigator.vibrate(8); } catch (err) {}
      }
      this.start();
    }

    finish(c) {
      var index = this.cards.indexOf(c);
      if (index === -1) return;
      var dir = c.leaving;
      var progress = this.progress();
      this.cards.splice(index, 1);
      this.results.push(dir);
      var name = c.data.name;
      this.announce((dir > 0 ? "Approved:" : "Rejected:") + " " + name);

      if (this.reduced) {
        c.node.style.transition = "opacity .2s ease";
        c.node.style.opacity = "0";
        c.node.style.pointerEvents = "none";
        setTimeout(function () { c.node.remove(); }, 220);
      } else {
        c.node.remove();
      }

      // The rest of the stack moves up from exactly where it is on screen.
      this.cards.forEach(function (card, i) {
        card.level.value = card.level.value - progress;
        card.level.to(i, 0.45, 1);
        if (this.reduced) card.level.hold(i);
      }, this);

      this.wireTop();
      if (!this.cards.length) this.showDone();
      this.render();
      this.start();
    }

    showDone() {
      var yes = this.results.filter(function (r) { return r > 0; }).length;
      this.nYes.textContent = String(yes);
      this.nNo.textContent = String(this.results.length - yes);
      this.done.classList.add("is-on");
      this.done.removeAttribute("aria-hidden");
      this.noBtn.disabled = true;
      this.yesBtn.disabled = true;
      this.hint.style.visibility = "hidden";
    }

    announce(text) {
      this.live.textContent = text;
    }

    /* How far the top card has travelled toward leaving, 0..1. The cards
       underneath rise with it, hinting at what happens if you let go. */
    progress() {
      var c = this.top();
      if (!c) return 0;
      var width = this.deck.offsetWidth || 340;
      return clamp(Math.abs(c.x.value) / (width * 0.6), 0, 1);
    }

    /* ----------------------------------------------------------- the loop */
    start() {
      if (this.raf || this.reduced) { if (this.reduced) this.render(); return; }
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }

    tick(now) {
      var dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      var steps = Math.max(1, Math.round(dt / (1 / 240)));
      var h = dt / steps;
      var busy = false;
      var width = this.deck.offsetWidth || 340;

      this.cards.slice().forEach(function (c) {
        [c.x, c.y, c.level].forEach(function (s) {
          if (s.settled()) { s.value = s.target; s.velocity = 0; return; }
          for (var i = 0; i < steps; i++) s.step(h);
          busy = true;
        });
        if (c.leaving && Math.abs(c.x.value) > width * 1.25) this.finish(c);
      }, this);

      this.render();
      this.raf = busy ? requestAnimationFrame(this.tick) : 0;
    }

    render() {
      var p = this.progress();
      var width = this.deck.offsetWidth || 340;
      var dots = this.dots.children;
      var doneCount = this.results.length;
      for (var i = 0; i < dots.length; i++) {
        var r = this.results[i];
        dots[i].className = r > 0 ? "is-yes" : r < 0 ? "is-no" : i === doneCount ? "is-now" : "";
      }

      this.cards.forEach(function (c, i) {
        var node = c.node;
        node.style.zIndex = String(100 - i);
        if (i === 0) {
          node.classList.remove("is-under");
          node.removeAttribute("aria-hidden");
          var level = Math.max(0, c.level.value);
          var s = 1 - level * 0.055;
          var ty = level * 16;
          var rot = clamp(c.x.value * 0.055 * (c.sign || 1), -22, 22);
          node.style.transform = "translate3d(" + c.x.value.toFixed(2) + "px," + (c.y.value + ty).toFixed(2) + "px,0) rotate(" + rot.toFixed(2) + "deg) scale(" + s.toFixed(4) + ")";
          // A card on its way out thins as it travels, so a throw across the
          // headline reads as leaving rather than covering it.
          node.style.opacity = (1 - clamp((Math.abs(c.x.value) - width * 0.55) / (width * 0.7), 0, 1)).toFixed(3);
          c.stamp[0].style.opacity = clamp(c.x.value / 90, 0, 1).toFixed(3);
          c.stamp[1].style.opacity = clamp(-c.x.value / 90, 0, 1).toFixed(3);
        } else {
          node.classList.add("is-under");
          node.setAttribute("aria-hidden", "true");
          var lv = Math.max(0, c.level.value - p);
          node.style.transform = "translate3d(0," + (lv * 16).toFixed(2) + "px,0) scale(" + (1 - lv * 0.055).toFixed(4) + ")";
          node.style.opacity = lv > 2.6 ? "0" : String(clamp(1 - Math.max(0, lv - 1.6), 0, 1));
          c.stamp[0].style.opacity = "0";
          c.stamp[1].style.opacity = "0";
          node.style.filter = "brightness(" + (1 - Math.min(lv, 2) * 0.16).toFixed(3) + ")";
        }
        if (i === 0) node.style.filter = "";
      });
    }

    /* The first time the deck is properly on screen, the top card leans a
       little toward "approve" and settles back — a hint that it moves, in the
       direction it moves. Once only, and never if the visitor got there first. */
    watchFirstView() {
      if (this.reduced || !("IntersectionObserver" in window)) return;
      var self = this;
      this.io = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        self.io.disconnect();
        setTimeout(function () {
          var c = self.top();
          if (!c || self.touched || c.leaving) return;
          c.sign = 1;
          c.x.to(46, 0.5, 0.85, 0);
          self.start();
          setTimeout(function () {
            if (self.touched || c.leaving || c !== self.top()) return;
            c.x.to(0, 0.55, 0.78);
            self.start();
          }, 420);
        }, 700);
      }, { threshold: 0.6 });
      this.io.observe(this);
    }
  }

  customElements.define("lb-swipe", LBSwipe);
})();
