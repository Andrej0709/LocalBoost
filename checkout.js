/* Adronis checkout.
   The page only shows the order. Payment happens in Paddle's overlay: the
   paddle Edge Function creates the transaction (it picks the price, so the
   trial rule can't be skipped from the browser), Paddle.js opens it, and
   Paddle's webhook is what actually starts the trial or subscription. */
(function () {

  // ---------------------------------------------------------------- plan data
  // Mirrors the `plans` array in Adronis.dc.html — keep the two in sync.
  var PLANS = {
    counter: {
      key: "counter", name: "Counter", base: 59,
      rate: "4 ads / week · 2 channels",
      features: [
        "4 photoreal creatives every Monday",
        "Two connected channels",
        "Best-time auto-publishing",
        "Swipe approval in the app"
      ]
    },
    storefront: {
      key: "storefront", name: "Storefront", base: 149,
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
      key: "franchise", name: "Franchise", base: 490,
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

  // Codes the summary can price. Each one must also exist as a discount in
  // Paddle (Catalog > Discounts) — Paddle checks it again at payment.
  // ADRONIS20 is the public one, shown to everyone in the pricing section of
  // Adronis.dc.html and Adronis-full.html — keep the three in sync.
  var PROMO_CODES = {
    ADRONIS20: { label: "ADRONIS20", percent: 20, note: "20% off every drop, for as long as you stay." }
  };

  // ------------------------------------------------------------------- state
  var params = new URLSearchParams(location.search);
  var state = {
    plan: PLANS[params.get("plan")] ? params.get("plan") : "storefront",
    cycle: params.get("cycle") === "annual" ? "annual" : "monthly",
    country: "RS",
    promo: null,
    // One trial per account — an account that already had one pays today.
    // Set once auth loads; the success view reads it back from the URL.
    paidNow: params.get("paid") === "1"
  };

  // ------------------------------------------------------------------- utils
  var $ = function (id) { return document.getElementById(id); };

  function euro(n) {
    return "€" + Math.round(n).toLocaleString((window.LBLang ? LBLang.locale() : "en-US"));
  }

  // For the VAT share, which is rarely a whole euro.
  function euroCents(n) {
    return "€" + n.toLocaleString((window.LBLang ? LBLang.locale() : "en-US"), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Monthly rate for a plan under the current cycle.
  function monthlyRate(plan, cycle) {
    return cycle === "annual" ? plan.base * (1 - ANNUAL_DISCOUNT) : plan.base;
  }

  // What Paddle actually charges per invoice: 12 months up front on annual.
  function invoiceAmount(plan, cycle) {
    return cycle === "annual" ? monthlyRate(plan, cycle) * 12 : monthlyRate(plan, cycle);
  }

  // An estimate for the summary only — Paddle works out the exact tax (and a
  // business's VAT number, if they give one) in its own checkout.
  function vatRate() {
    var opt = $("co-country").selectedOptions[0];
    var pct = opt ? Number(opt.getAttribute("data-vat")) : 0;
    return pct / 100;
  }

  function fmtDay(d) {
    return d.toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), { day: "numeric", month: "short", year: "numeric" });
  }

  function trialEndsOn() {
    var d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return fmtDay(d);
  }

  // Next invoice for a customer who pays today: one cycle from now.
  function renewsOn(cycle) {
    var d = new Date();
    d.setMonth(d.getMonth() + (cycle === "annual" ? 12 : 1));
    return fmtDay(d);
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

    // Prices are VAT-inclusive: what the customer saw on the site is what they
    // pay. VAT is carved out of that amount for the summary, never added on top.
    var discount = state.promo ? subtotal * (state.promo.percent / 100) : 0;
    var recurring = subtotal - discount;
    var vat = recurring - recurring / (1 + vatRate());

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
      lines.push({ label: "Incl. VAT (" + Math.round(vatRate() * 100) + "%)", value: euroCents(vat), note: true });
    }
    if (!state.paidNow) {
      lines.push({ label: "First drop (" + TRIAL_DAYS + "-day trial)", value: "Free", credit: true });
    }

    $("co-lines").innerHTML = lines.map(function (l) {
      return '<div class="co-line' + (l.credit ? " is-credit" : "") + (l.note ? " is-note" : "") + '"><span>' +
        l.label + '</span><span>' + l.value + '</span></div>';
    }).join("");

    var per = state.cycle === "annual" ? "per year" : "per month";
    if (state.paidNow) {
      $("co-due").textContent = euro(recurring);
      $("co-then").textContent =
        "Your free trial was already used on this account, so billing starts today. Then " +
        euro(recurring) + " " + per + " including tax, renewing automatically, next charged " +
        renewsOn(state.cycle) + ". Cancel any time from your account — access runs to the end of the period you paid for.";
      $("co-sub").textContent =
        "Welcome back. Your free trial was already used, so your first " +
        (state.cycle === "annual" ? "year" : "month") + " is billed today. Cancel any time before the next renewal.";
    } else {
      $("co-due").textContent = "€0";
      $("co-then").textContent =
        "After the 7-day free trial this becomes a paid subscription automatically: " +
        euro(recurring) + " " + per + " including tax, first charged " + trialEndsOn() +
        " and renewing until you cancel. Cancel before that date from your account and you pay nothing.";
    }

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
    // Must say exactly what terms.html clause 7 says. A refund promise made here
    // and denied there is the kind of contradiction a customer wins.
    $("co-cycle-note").textContent = state.cycle === "annual"
      ? "Billed once a year at 20% off, then renews every 12 months. Cancel any time — access runs to the end of the paid year, and unused months are not refunded."
      : "Billed every month and renews automatically. Cancel any time — access runs to the end of the paid month, with no notice period.";
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
    $("co-success-tag").textContent = "PLAN ACTIVE";
    $("co-success-text").textContent = "The " + plan.name + " plan is live on your account.";
    $("co-success-foot").hidden = true;
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

  if (!params.get("state")) {
    if (!window.LBAuth) {
      // auth.js failed to load (network hiccup, CDN down, ...). Never let a
      // checkout page with no way to verify identity sit open and usable.
      block("Couldn't load your account system. Refresh the page and try again.", "Start over");
    } else {
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

        state.paidNow = LBAuth.hadTrial();
        renderSummary();
        $("co-free").hidden = false;
        var user = LBAuth.getUser();
        if (user && user.email && !$("co-email").value) $("co-email").value = user.email;
      }).catch(function (err) {
        block("Couldn't load your account: " + err.message, "Start over");
      });
    }
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
      notice.textContent = "We need a billing email before we can hand you to Paddle.";
      $("co-email").focus();
      return;
    }

    function fail(message) {
      button.disabled = false;
      button.style.opacity = "";
      button.innerHTML = 'Continue to secure payment<span class="mono" style="font-size:13px">→</span>';
      notice.hidden = false;
      notice.style.borderColor = "rgba(240,168,168,.3)";
      notice.style.background = "rgba(240,168,168,.08)";
      notice.style.color = "#f0a8a8";
      notice.textContent = message;
    }

    if (!paddleReady) {
      fail("Payments couldn't load. Refresh the page and try again.");
      return;
    }

    button.disabled = true;
    button.style.opacity = ".6";
    button.innerHTML = 'Opening secure payment<span class="mono" style="font-size:13px">…</span>';
    notice.hidden = true;

    // The server picks the price: with a trial (card saved, nothing charged
    // until the trial ends) only if this account never had one. Paddle's
    // webhook then starts the trial or subscription — nothing here does.
    var checkout;
    try {
      checkout = await LBAuth.createCheckout(state.plan, state.cycle, state.promo ? state.promo.label : null);
    } catch (err) {
      fail(err.message);
      return;
    }
    state.paidNow = !checkout.trial;

    var country = $("co-country").value;
    var open = {
      transactionId: checkout.transaction_id,
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        theme: "dark",
        successUrl: location.origin + location.pathname + "?state=success&plan=" + state.plan +
          "&cycle=" + state.cycle + (state.paidNow ? "&paid=1" : "")
      }
    };
    // A returning Paddle customer is already on the transaction.
    if (!checkout.has_customer) {
      open.customer = { email: email };
      if (country !== "OTHER") open.customer.address = { countryCode: country };
    }
    Paddle.Checkout.open(open);
  });

  // ------------------------------------------------------------ Paddle.js
  var paddleReady = false;
  var paddleCompleted = false;
  if (window.Paddle && window.LB_PADDLE_CLIENT_TOKEN) {
    if (window.LB_PADDLE_ENV !== "production") Paddle.Environment.set("sandbox");
    Paddle.Initialize({
      token: window.LB_PADDLE_CLIENT_TOKEN,
      eventCallback: function (event) {
        if (event.name === "checkout.completed") paddleCompleted = true;
        // Closed without paying: give the button back.
        if (event.name === "checkout.closed" && !paddleCompleted) {
          var button = $("co-submit");
          button.disabled = false;
          button.style.opacity = "";
          button.innerHTML = 'Continue to secure payment<span class="mono" style="font-size:13px">→</span>';
        }
      }
    });
    paddleReady = true;
  }

  // Skip the card entirely: record the free-plan choice (so login/signup stop
  // steering back to checkout) and go straight into the app.
  $("co-free-btn").addEventListener("click", async function () {
    var button = this;
    button.disabled = true;
    try {
      await LBAuth.updateProfile({ plan: "free" });
      location.href = "approvals.html";
    } catch (err) {
      button.disabled = false;
      var notice = $("co-notice");
      notice.hidden = false;
      notice.style.borderColor = "rgba(240,168,168,.3)";
      notice.style.background = "rgba(240,168,168,.08)";
      notice.style.color = "#f0a8a8";
      notice.textContent = err.message;
    }
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
      if (state.paidNow) {
        $("co-sub").textContent =
          "Payment received — your plan is running again. " +
          "Next invoice on " + renewsOn(state.cycle) + ", and you can cancel any time before then.";
        $("co-success-tag").textContent = "PLAN ACTIVE · FIRST " + (state.cycle === "annual" ? "YEAR" : "MONTH") + " PAID";
        $("co-success-foot").textContent = "Your card was charged today for the first " + (state.cycle === "annual" ? "year" : "month") + ".";
      } else {
        $("co-sub").textContent =
          "Your card is on file and the free trial has started — nothing was charged today. " +
          "First invoice on " + trialEndsOn() + ", and you can cancel before then.";
      }
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
