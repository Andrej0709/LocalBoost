/* LocalBoost checkout — front end only.
   No payment is taken here. The submit handler builds the exact payload that a
   future `create-checkout-session` endpoint will consume, then stops. Wire the
   backend at the one marked spot below and nothing else on this page changes. */
(function () {

  // ---------------------------------------------------------------- plan data
  // Mirrors the `plans` array in LocalBoost.dc.html — keep the two in sync.
  var PLANS = {
    counter: {
      key: "counter", name: "Counter", base: 89,
      rate: "4 ads / week · 1 channel",
      features: [
        "4 photoreal creatives every Monday",
        "One connected channel",
        "Best-time auto-publishing",
        "Swipe approval in the app"
      ]
    },
    storefront: {
      key: "storefront", name: "Storefront", base: 249,
      rate: "12 ads / week · 4 channels",
      features: [
        "12 creatives across all native formats",
        "Four connected channels",
        "Seasonal & local hook engine",
        "Performance feedback into next drop",
        "Caption variants and A/B slotting"
      ]
    },
    franchise: {
      key: "franchise", name: "Franchise", base: 690,
      rate: "30 ads / week · unlimited",
      features: [
        "30 creatives, multi-location aware",
        "Unlimited channels and locations",
        "Human creative director review",
        "Brand-safety approvals workflow",
        "Dedicated drop slot and support"
      ]
    }
  };

  var ANNUAL_DISCOUNT = 0.2;   // 20% off, matches the pricing section
  var TRIAL_DAYS = 7;          // "first drop free"

  // Demo codes so the promo field is testable before Stripe coupons exist.
  var PROMO_CODES = {
    LOCAL10: { label: "LOCAL10", percent: 10, note: "10% off every drop, for as long as you stay." },
    FIRSTSHOP: { label: "FIRSTSHOP", percent: 25, note: "25% off your first year." }
  };

  // ------------------------------------------------------------------- state
  var params = new URLSearchParams(location.search);
  var state = {
    plan: PLANS[params.get("plan")] ? params.get("plan") : "storefront",
    cycle: params.get("cycle") === "annual" ? "annual" : "monthly",
    country: "RS",
    promo: null
  };

  // ------------------------------------------------------------------- utils
  var $ = function (id) { return document.getElementById(id); };

  function euro(n) {
    return "€" + Math.round(n).toLocaleString("en-US");
  }

  // Monthly rate for a plan under the current cycle.
  function monthlyRate(plan, cycle) {
    return cycle === "annual" ? plan.base * (1 - ANNUAL_DISCOUNT) : plan.base;
  }

  // What Stripe would actually charge per invoice: 12 months up front on annual.
  function invoiceAmount(plan, cycle) {
    return cycle === "annual" ? monthlyRate(plan, cycle) * 12 : monthlyRate(plan, cycle);
  }

  function vatRate() {
    var opt = $("co-country").selectedOptions[0];
    var pct = opt ? Number(opt.getAttribute("data-vat")) : 0;
    // A valid VAT ID in the EU means reverse charge — no VAT on the invoice.
    if ($("co-vatid").value.trim().length > 3 && state.country !== "RS") return 0;
    return pct / 100;
  }

  function trialEndsOn() {
    var d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  // -------------------------------------------------------------- plan cards
  function renderPlans() {
    var host = $("co-plans");
    host.innerHTML = "";

    Object.keys(PLANS).forEach(function (key) {
      var plan = PLANS[key];
      var card = document.createElement("div");
      card.className = "co-plan" + (key === state.plan ? " selected" : "");
      card.setAttribute("role", "radio");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-checked", key === state.plan ? "true" : "false");
      card.innerHTML =
        '<div class="co-radio"></div>' +
        '<div><div class="co-plan-name">' + plan.name + '</div>' +
        '<div class="co-plan-rate">' + plan.rate + '</div></div>' +
        '<div class="co-plan-price">' + euro(monthlyRate(plan, state.cycle)) +
        '<span class="co-plan-per">/ MONTH</span></div>';

      function pick() {
        state.plan = key;
        render();
      }
      card.addEventListener("click", pick);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });

      host.appendChild(card);
    });
  }

  // ----------------------------------------------------------------- summary
  function renderSummary() {
    var plan = PLANS[state.plan];
    var perMonth = monthlyRate(plan, state.cycle);
    var listTotal = state.cycle === "annual" ? plan.base * 12 : plan.base;  // before the annual discount
    var subtotal = invoiceAmount(plan, state.cycle);                        // after it

    var discount = state.promo ? subtotal * (state.promo.percent / 100) : 0;
    var net = subtotal - discount;
    var vat = net * vatRate();
    var recurring = net + vat;

    $("co-sum-name").textContent = plan.name;
    $("co-sum-price").textContent = euro(perMonth);
    $("co-sum-per").textContent = " / MONTH";
    $("co-sum-rate").textContent = plan.rate;

    var lines = [];
    lines.push({
      label: plan.name + " · " + (state.cycle === "annual" ? "12 months" : "1 month"),
      value: euro(listTotal)
    });
    if (state.cycle === "annual") {
      lines.push({ label: "Annual discount (20%)", value: "−" + euro(plan.base * 12 * ANNUAL_DISCOUNT), credit: true });
    }
    if (state.promo) {
      lines.push({ label: "Promo " + state.promo.label + " (" + state.promo.percent + "%)", value: "−" + euro(discount), credit: true });
    }
    if (vat > 0) {
      lines.push({ label: "VAT (" + Math.round(vatRate() * 100) + "%)", value: euro(vat) });
    } else if ($("co-vatid").value.trim().length > 3) {
      lines.push({ label: "VAT — reverse charge", value: "€0" });
    }
    lines.push({ label: "First drop (" + TRIAL_DAYS + "-day trial)", value: "Free", credit: true });

    $("co-lines").innerHTML = lines.map(function (l) {
      return '<div class="co-line' + (l.credit ? " is-credit" : "") + '"><span>' +
        l.label + '</span><span>' + l.value + '</span></div>';
    }).join("");

    $("co-due").textContent = "€0";
    $("co-then").textContent =
      "Then " + euro(recurring) + " " + (state.cycle === "annual" ? "per year" : "per month") +
      ", first charged " + trialEndsOn() + ". Cancel before then and you pay nothing.";

    $("co-features").innerHTML = plan.features.map(function (f) {
      return '<li style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;color:#8a8f98">' +
        '<span style="color:var(--acc);font-family:\'Geist Mono\',monospace;font-size:11px">▪</span>' + f + '</li>';
    }).join("");

    $("co-headline").innerHTML = 'Confirm your <em>' + plan.name + '</em> drop.';
  }

  function renderCycle() {
    Array.prototype.forEach.call($("co-cycle").children, function (b) {
      b.classList.toggle("active", b.getAttribute("data-cycle") === state.cycle);
    });
    $("co-cycle-note").textContent = state.cycle === "annual"
      ? "Billed once a year at 20% off. Cancel any time — unused months are refunded pro rata."
      : "Billed every month. Cancel any week, no notice period.";
  }

  function render() {
    renderCycle();
    renderPlans();
    renderSummary();
    var url = "?plan=" + state.plan + "&cycle=" + state.cycle;
    history.replaceState(null, "", url);
  }

  // ------------------------------------------------------------------ events
  $("co-cycle").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-cycle]");
    if (!btn) return;
    state.cycle = btn.getAttribute("data-cycle");
    render();
  });

  $("co-country").addEventListener("change", function () {
    state.country = $("co-country").value;
    renderSummary();
  });

  $("co-vatid").addEventListener("input", renderSummary);

  $("co-promo-apply").addEventListener("click", function () {
    var code = $("co-promo").value.trim().toUpperCase();
    var note = $("co-promo-note");

    if (!code) { state.promo = null; note.hidden = true; renderSummary(); return; }

    if (PROMO_CODES[code]) {
      state.promo = PROMO_CODES[code];
      note.hidden = false;
      note.style.borderColor = "rgba(159,215,176,.3)";
      note.style.background = "rgba(159,215,176,.08)";
      note.style.color = "#9fd7b0";
      note.textContent = code + " applied — " + PROMO_CODES[code].note;
    } else {
      state.promo = null;
      note.hidden = false;
      note.style.borderColor = "rgba(240,168,168,.3)";
      note.style.background = "rgba(240,168,168,.08)";
      note.style.color = "#f0a8a8";
      note.textContent = "That code isn't valid — check it and try again.";
    }
    renderSummary();
  });

  // ------------------------------------------------------- access gate
  // Checkout is step 2. You may only be here signed in and with the business
  // brief already saved — otherwise back to signup.html for the brief.
  function signupUrl() {
    return "signup.html?plan=" + state.plan;
  }

  function showActive() {
    $("co-view").hidden = true;
    $("co-success").hidden = false;
    var plan = PLANS[state.plan];
    $("co-eyebrow").textContent = "ALREADY RUNNING";
    $("co-headline").innerHTML = 'Your <em>' + plan.name + '</em> drop is live.';
    $("co-sub").textContent = "Nothing to pay here — your plan is already on the account.";
    $("co-success-text").textContent = "The " + plan.name + " plan is live on your account.";
  }

  // A blocked visitor gets told why, with a link. Never a silent bounce back to
  // signup — that reads as "the checkout button does nothing".
  function block(message, linkText) {
    var notice = $("co-notice");
    var button = $("co-submit");
    button.disabled = true;
    button.style.opacity = ".6";
    notice.hidden = false;
    notice.style.borderColor = "rgba(240,168,168,.3)";
    notice.style.background = "rgba(240,168,168,.08)";
    notice.style.color = "#f0a8a8";
    notice.innerHTML = message +
      ' <a href="' + signupUrl() + '" style="color:var(--acc)">' + linkText + ' →</a>';
  }

  if (window.LBAuth && !params.get("state")) {
    LBAuth.ready.then(function () {
      if (!LBAuth.isLoggedIn()) {
        block("You need to be signed in to check out.", "Sign up or log in");
        return;
      }
      if (!LBAuth.hasBrief()) {
        block("Fill in your business brief first — it takes a minute.", "Go to the brief");
        return;
      }
      if (LBAuth.hasActivePlan()) { showActive(); return; }

      var user = LBAuth.getUser();
      if (user && user.email && !$("co-email").value) $("co-email").value = user.email;
    }).catch(function (err) {
      block("Couldn't load your account: " + err.message, "Start over");
    });
  }

  $("co-submit").addEventListener("click", async function () {
    var email = $("co-email").value.trim();
    var notice = $("co-notice");
    var button = $("co-submit");

    if (!email || email.indexOf("@") < 1) {
      notice.hidden = false;
      notice.style.borderColor = "rgba(240,168,168,.3)";
      notice.style.background = "rgba(240,168,168,.08)";
      notice.style.color = "#f0a8a8";
      notice.textContent = "We need a billing email before we can hand you to Stripe.";
      $("co-email").focus();
      return;
    }

    // This is the payload the backend session endpoint will receive.
    var payload = {
      plan: state.plan,
      cycle: state.cycle,
      email: email,
      country: $("co-country").value,
      vat_id: $("co-vatid").value.trim() || null,
      promo_code: state.promo ? state.promo.label : null,
      trial_days: TRIAL_DAYS,
      success_url: location.origin + "/checkout.html?state=success&plan=" + state.plan,
      cancel_url: location.origin + "/checkout.html?state=cancelled&plan=" + state.plan
    };

    button.disabled = true;
    button.style.opacity = ".6";
    button.innerHTML = 'Opening secure payment<span class="mono" style="font-size:13px">…</span>';

    // ---- BACKEND GOES HERE -------------------------------------------------
    // Stripe collects the card in setup mode — no money moves today, the card
    // is only stored so the first invoice can be charged when the trial ends.
    // const res = await fetch("/functions/v1/create-checkout-session", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload)
    // });
    // const { url } = await res.json();
    // location.href = url;   // Stripe hosted Checkout
    // The webhook then calls start_trial() — drop the client-side call below.
    // ------------------------------------------------------------------------

    console.log("[checkout] payload for create-checkout-session:", payload);

    // Until Stripe is wired, treat reaching this point as "card captured" and
    // start the trial here. This is the ONLY place a trial ever begins.
    try {
      await LBAuth.startTrial(state.plan, state.cycle);
    } catch (err) {
      button.disabled = false;
      button.style.opacity = "";
      button.innerHTML = 'Continue to secure payment<span class="mono" style="font-size:13px">→</span>';
      notice.hidden = false;
      notice.style.borderColor = "rgba(240,168,168,.3)";
      notice.style.background = "rgba(240,168,168,.08)";
      notice.style.color = "#f0a8a8";
      notice.textContent = err.message;
      return;
    }

    location.href = "checkout.html?state=success&plan=" + state.plan + "&cycle=" + state.cycle;
  });

  // --------------------------------------------------------- returning views
  var view = params.get("state");
  if (view === "success" || view === "cancelled") {
    $("co-view").hidden = true;
    var plan = PLANS[state.plan];

    if (view === "success") {
      $("co-success").hidden = false;
      $("co-eyebrow").textContent = "YOU'RE ALL SET";
      $("co-headline").innerHTML = 'Your <em>' + plan.name + '</em> drop is booked.';
      $("co-sub").textContent =
        "Your card is on file and the free trial has started — nothing was charged today. " +
        "First invoice on " + trialEndsOn() + ", and you can cancel before then.";
      $("co-success-text").textContent = "Your " + plan.name + " drop is live.";
    } else {
      $("co-cancelled").hidden = false;
      $("co-eyebrow").textContent = "CHECKOUT CANCELLED";
      $("co-headline").innerHTML = 'No charge was made.';
      $("co-sub").textContent = "Your plan is still waiting — pick up where you left off whenever you're ready.";
      $("co-retry").href = "checkout.html?plan=" + state.plan + "&cycle=" + state.cycle;
    }
  } else {
    render();
  }

})();
