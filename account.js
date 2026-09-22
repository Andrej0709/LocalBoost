/* Adronis account settings page.
   Everything here reads/writes through LBAuth (auth.js) — no direct Supabase
   calls except the ones LBAuth already exposes on window.LBAuth.db. */
(function () {

  // Mirrors the `plans` array in Adronis.dc.html and checkout.js — keep in sync.
  var PLANS = {
    counter:    { name: "Counter",    base: 89,  rate: "4 ads / week · 1 channel" },
    storefront: { name: "Storefront", base: 249, rate: "12 ads / week · 4 channels" },
    franchise:  { name: "Franchise",  base: 690, rate: "30 ads / week · unlimited" }
  };
  var ANNUAL_DISCOUNT = 0.2;

  // Kept in sync on every renderBilling() call so the plan-change and
  // cancel panels always read the latest profile, not the one from boot.
  var currentProfile = null;

  var $ = function (id) { return document.getElementById(id); };

  function euro(n) {
    return "€" + Math.round(n).toLocaleString((window.LBLang ? LBLang.locale() : "en-US"));
  }

  function fmtDate(value) {
    return new Date(value).toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), { month: "short", day: "numeric", year: "numeric" });
  }

  function say(el, message, isError) {
    el.hidden = false;
    el.textContent = message;
    el.style.borderColor = isError ? "rgba(240,168,168,.35)" : "";
    el.style.background = isError ? "rgba(240,168,168,.08)" : "";
    el.style.color = isError ? "#f0a8a8" : "";
  }

  // ---------------------------------------------------------------- header
  function renderHeader(user, profile) {
    $("acc-name").textContent = profile.business_name || user.email;
    $("acc-email-display").textContent = user.email;

    var chip = $("acc-status-chip");
    var status = profile.subscription_status;
    if (status === "trialing") { chip.className = "acc-chip acc"; chip.textContent = "TRIAL"; }
    else if (status === "active") { chip.className = "acc-chip ok"; chip.textContent = "ACTIVE"; }
    else if (status === "past_due") { chip.className = "acc-chip warn"; chip.textContent = "PAST DUE"; }
    else if (status === "canceled") { chip.className = "acc-chip muted"; chip.textContent = "CANCELED"; }
    else if (profile.onboarded_at) { chip.className = "acc-chip muted"; chip.textContent = "FREE"; }
    else { chip.className = "acc-chip muted"; chip.textContent = "NO PLAN"; }
  }

  // -------------------------------------------------------------- security
  function wireSecurity() {
    var emailNotice = $("email-notice");
    var passwordNotice = $("password-notice");

    $("email-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var button = e.target.querySelector("button[type=submit]");
      var newEmail = $("acc-new-email").value;
      button.disabled = true;
      try {
        await LBAuth.updateEmail(newEmail);
        say(emailNotice, "Check both your old and new inbox — confirm the change to finish.");
        e.target.reset();
      } catch (err) {
        say(emailNotice, err.message, true);
      } finally {
        button.disabled = false;
      }
    });

    var passwordForm = $("password-form");
    var passwordToggle = $("password-toggle");
    var passwordCancel = $("password-cancel");

    function setPasswordOpen(open) {
      passwordForm.hidden = !open;
      passwordToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) passwordForm.reset();
    }

    passwordToggle.addEventListener("click", function () {
      var isOpen = passwordToggle.getAttribute("aria-expanded") === "true";
      setPasswordOpen(!isOpen);
      if (!isOpen) $("acc-current-password").focus();
    });
    passwordCancel.addEventListener("click", function () {
      passwordNotice.hidden = true;
      setPasswordOpen(false);
    });

    passwordForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var button = e.target.querySelector("button[type=submit]");
      var current = $("acc-current-password").value;
      var pass = $("acc-new-password").value;
      var confirm = $("acc-confirm-password").value;
      if (pass !== confirm) {
        say(passwordNotice, "Those two new passwords don't match.", true);
        return;
      }
      button.disabled = true;
      try {
        await LBAuth.verifyPassword(current);
        await LBAuth.updatePassword(pass);
        say(passwordNotice, "Password updated.");
        setPasswordOpen(false);
      } catch (err) {
        say(passwordNotice, err.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------- channels
  function renderChannels(profile) {
    var form = $("channels-form");
    var selected = Array.isArray(profile.channels) ? profile.channels : [];
    Array.prototype.forEach.call(form.querySelectorAll('input[name="channels"]'), function (box) {
      box.checked = selected.indexOf(box.value) > -1;
    });
  }

  function wireChannels() {
    var notice = $("channels-notice");
    $("channels-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var button = e.target.querySelector("button[type=submit]");
      var checked = Array.prototype.map.call(
        e.target.querySelectorAll('input[name="channels"]:checked'),
        function (box) { return box.value; }
      );
      button.disabled = true;
      try {
        await LBAuth.updateProfile({ channels: checked });
        say(notice, "Channels saved — next week's drop renders for these only.");
      } catch (err) {
        say(notice, err.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------- plan & billing
  function monthlyRate(plan, cycle) {
    return cycle === "annual" ? plan.base * (1 - ANNUAL_DISCOUNT) : plan.base;
  }

  function invoiceAmount(plan, cycle) {
    return cycle === "annual" ? monthlyRate(plan, cycle) * 12 : monthlyRate(plan, cycle);
  }

  function periodEndDate(profile) {
    return profile.current_period_end || profile.trial_ends_at;
  }

  function renderBilling(profile) {
    currentProfile = profile;
    var plan = PLANS[profile.plan];

    // profile.plan is set the moment the business brief is saved — before
    // checkout ever runs. subscription_status only becomes non-null once
    // start_trial() fires (checkout.js, after a card is on file), so that's
    // the real signal for "has a plan running", not the plan column alone.
    if (!plan || !profile.subscription_status) {
      $("billing-rows").hidden = true;
      $("billing-empty").hidden = false;
      $("bill-plan-toggle").hidden = true;
      $("plan-change-panel").hidden = true;
      $("plan-pending-notice").hidden = true;
      $("plan-cancel-notice").hidden = true;
      $("cancel-plan-row").hidden = true;
      if (profile.onboarded_at) renderFreePlan();
      return;
    }
    $("billing-rows").hidden = false;
    $("billing-empty").hidden = true;

    var cycle = profile.billing_cycle || "monthly";
    $("bill-plan").textContent = plan.name;
    $("bill-rate").textContent = plan.rate;
    $("bill-cycle").textContent = cycle === "annual" ? "Annual" : "Monthly";

    // A plan with no period end on it never renews and is never charged — it
    // was granted outright. There is no date to show and nothing to cancel,
    // so the whole self-serve block below steps out of the way.
    var openEnded = profile.subscription_status === "active" && !periodEndDate(profile);

    var statusText = {
      trialing: "Free trial",
      active: openEnded ? "Active — nothing to pay" : "Active",
      past_due: "Past due — update your card",
      canceled: "Canceled — you're on the Free plan"
    }[profile.subscription_status] || "No active plan";
    $("bill-status").textContent = statusText;

    var dateLabel = $("bill-date-label");
    var dateValue = $("bill-date");
    if (profile.subscription_status === "trialing") {
      dateLabel.textContent = "Trial ends";
      dateValue.textContent = profile.trial_ends_at ? fmtDate(profile.trial_ends_at) : "—";
    } else if (profile.subscription_status === "active") {
      dateLabel.textContent = "Started";
      dateValue.textContent = profile.trial_started_at ? fmtDate(profile.trial_started_at) : "—";
    } else {
      dateLabel.textContent = "Trial ends";
      dateValue.textContent = "—";
    }

    // Managing a plan (switching or cancelling) only makes sense while it's
    // actually running — a trial that already lapsed into "canceled" has
    // nothing left to change.
    var manageable = (profile.subscription_status === "trialing" ||
                      profile.subscription_status === "active") && !openEnded;

    $("bill-plan-toggle").hidden = !manageable || !!profile.cancel_at_period_end;
    $("cancel-plan-row").hidden = !manageable || !!profile.cancel_at_period_end;
    // Cancelling while the change-plan panel happens to be open must close it —
    // otherwise "Confirm change" is still clickable and just fails against the
    // database instead of the control simply not being there.
    if (!manageable || profile.cancel_at_period_end) $("plan-change-panel").hidden = true;

    var cancelNotice = $("plan-cancel-notice");
    if (profile.cancel_at_period_end) {
      cancelNotice.hidden = false;
      cancelNotice.innerHTML = "Your plan cancels on " + fmtDate(periodEndDate(profile)) +
        ". You'll keep full access until then. " +
        '<button type="button" id="resume-sub-btn" style="margin-left:2px;background:none;border:none;padding:0;color:var(--acc);text-decoration:underline;cursor:pointer;font-family:\'Geist\',sans-serif;font-size:14px">Keep my subscription</button>';
      $("resume-sub-btn").addEventListener("click", async function () {
        var button = this;
        button.disabled = true;
        try {
          var updated = await LBAuth.resumeSubscription();
          renderBilling(updated);
          renderPayments(updated);
        } catch (err) {
          say($("plan-notice"), err.message, true);
          button.disabled = false;
        }
      });
    } else {
      cancelNotice.hidden = true;
    }

    var pendingNotice = $("plan-pending-notice");
    if (manageable && profile.pending_plan && !profile.cancel_at_period_end) {
      var pendingPlan = PLANS[profile.pending_plan];
      var pendingCycle = profile.pending_billing_cycle || cycle;
      pendingNotice.hidden = false;
      pendingNotice.innerHTML = "Switching to " + pendingPlan.name + " (" +
        (pendingCycle === "annual" ? "annual" : "monthly") + ") on " + fmtDate(periodEndDate(profile)) +
        '. <button type="button" id="undo-plan-change-btn" style="margin-left:2px;background:none;border:none;padding:0;color:var(--acc);text-decoration:underline;cursor:pointer;font-family:\'Geist\',sans-serif;font-size:14px">Undo</button>';
      $("undo-plan-change-btn").addEventListener("click", async function () {
        var button = this;
        button.disabled = true;
        try {
          var updated = await LBAuth.cancelPlanChange();
          renderBilling(updated);
        } catch (err) {
          say($("plan-notice"), err.message, true);
          button.disabled = false;
        }
      });
    } else {
      pendingNotice.hidden = true;
    }
  }

  // Brief done, no plan running: the account is on the free monthly allowance.
  async function renderFreePlan() {
    $("billing-empty-tag").textContent = "FREE PLAN";
    $("billing-empty-title").textContent = "You're on the Free plan.";
    $("billing-empty-text").textContent = "A few free ads every month, no card on file. Pick a plan for a full drop every week.";

    var q = await LBAuth.freeQuota();
    if (!q) return;
    var reset = new Date(q.resets_at).toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), { month: "short", day: "numeric", timeZone: "UTC" });
    $("billing-empty-text").textContent =
      q.used + " of " + q.limit + " free ads used this month, resets " + reset +
      ". No card on file. Pick a plan for a full drop every week.";
  }

  // ----------------------------------------------------- plan change / cancel
  function wirePlanChange(getProfile) {
    var toggle = $("bill-plan-toggle");
    var panel = $("plan-change-panel");
    var planGroup = $("pc-plan");
    var cycleGroup = $("pc-cycle");
    var note = $("pc-note");
    var notice = $("plan-notice");
    var picked = { plan: null, cycle: "monthly" };

    function sync() {
      Array.prototype.forEach.call(planGroup.children, function (b) {
        b.classList.toggle("active", b.getAttribute("data-plan") === picked.plan);
      });
      Array.prototype.forEach.call(cycleGroup.children, function (b) {
        b.classList.toggle("active", b.getAttribute("data-cycle") === picked.cycle);
      });
      var p = PLANS[picked.plan];
      note.textContent = p
        ? p.name + " — " + p.rate + " — " + euro(monthlyRate(p, picked.cycle)) + " / month, billed " +
          (picked.cycle === "annual" ? "yearly" : "monthly") + ". Takes effect on your next billing date, " +
          fmtDate(periodEndDate(getProfile())) + " — this period is already paid for."
        : "";
    }

    toggle.addEventListener("click", function () {
      var profile = getProfile();
      picked.plan = profile.pending_plan || profile.plan;
      picked.cycle = profile.pending_billing_cycle || profile.billing_cycle || "monthly";
      sync();
      notice.hidden = true;
      panel.hidden = false;
    });

    planGroup.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-plan]");
      if (!btn) return;
      picked.plan = btn.getAttribute("data-plan");
      sync();
    });
    cycleGroup.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-cycle]");
      if (!btn) return;
      picked.cycle = btn.getAttribute("data-cycle");
      sync();
    });

    $("pc-cancel").addEventListener("click", function () { panel.hidden = true; });

    $("pc-confirm").addEventListener("click", async function () {
      var button = this;
      button.disabled = true;
      try {
        var updated = await LBAuth.schedulePlanChange(picked.plan, picked.cycle);
        panel.hidden = true;
        renderBilling(updated);
        renderPayments(updated);
      } catch (err) {
        say(notice, err.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  function wireCancelSubscription(getProfile) {
    var toggle = $("cancel-sub-toggle");
    var panel = $("cancel-sub-panel");
    var until = $("cancel-sub-until");
    var confirmBtn = $("cancel-sub-confirm");
    var notice = $("plan-notice");

    toggle.addEventListener("click", function () {
      until.textContent = fmtDate(periodEndDate(getProfile()));
      notice.hidden = true;
      panel.hidden = false;
    });
    $("cancel-sub-back").addEventListener("click", function () { panel.hidden = true; });

    confirmBtn.addEventListener("click", async function () {
      confirmBtn.disabled = true;
      try {
        var updated = await LBAuth.cancelAtPeriodEnd();
        panel.hidden = true;
        renderBilling(updated);
        renderPayments(updated);
      } catch (err) {
        say(notice, err.message, true);
      } finally {
        confirmBtn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------- payments
  function chipFor(tag) {
    var map = {
      trial: ["acc-chip acc", "TRIAL"],
      paid: ["acc-chip ok", "PAID"],
      past_due: ["acc-chip warn", "PAST DUE"],
      upcoming: ["acc-chip muted", "UPCOMING"]
    };
    var m = map[tag] || map.upcoming;
    return '<span class="' + m[0] + '">' + m[1] + "</span>";
  }

  function buildPaymentRows(profile) {
    var plan = PLANS[profile.plan];
    if (!plan || !profile.subscription_status || !profile.trial_started_at) return [];

    var rows = [{
      date: new Date(profile.trial_started_at),
      desc: "Free trial started",
      amount: 0,
      tag: "trial"
    }];

    // Each entry is a snapshot finalize_billing_period() wrote at the plan/cycle
    // that period was actually charged at — never recomputed from the CURRENT
    // plan, so an earlier plan/cycle switch can't rewrite past invoices.
    var history = Array.isArray(profile.billing_history) ? profile.billing_history : [];
    history.forEach(function (entry, i) {
      var p = PLANS[entry.plan];
      if (!p) return;
      var cyc = entry.cycle || "monthly";
      var isLast = i === history.length - 1;
      rows.push({
        date: new Date(entry.period_start),
        desc: p.name + " plan — " + (cyc === "annual" ? "annual" : "monthly") + " billing",
        amount: invoiceAmount(p, cyc),
        tag: (isLast && profile.subscription_status === "past_due") ? "past_due" : "paid"
      });
    });

    // No period end means nothing is coming: the plan was granted outright.
    // Without this check the row below would print an invalid date and a
    // charge that will never happen.
    if ((profile.subscription_status === "trialing" || profile.subscription_status === "active") &&
        periodEndDate(profile)) {
      // What's actually charged next is the pending plan/cycle if a switch is
      // scheduled — not the plan running today.
      var upcomingPlan = PLANS[profile.pending_plan] || plan;
      var upcomingCycle = profile.pending_plan
        ? (profile.pending_billing_cycle || profile.billing_cycle || "monthly")
        : (profile.billing_cycle || "monthly");
      rows.push({
        date: new Date(periodEndDate(profile)),
        desc: upcomingPlan.name + " plan — " + (upcomingCycle === "annual" ? "annual" : "monthly") + " billing",
        amount: invoiceAmount(upcomingPlan, upcomingCycle),
        tag: "upcoming"
      });
    }

    rows.reverse();
    return rows;
  }

  function renderPayments(profile) {
    var rows = buildPaymentRows(profile);
    var tableWrap = $("payments-table-wrap");
    var empty = $("payments-empty");
    var tbody = $("payments-rows");

    if (!rows.length) {
      tableWrap.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    tableWrap.hidden = false;
    tbody.innerHTML = rows.map(function (r) {
      return "<tr>" +
        "<td>" + fmtDate(r.date) + "</td>" +
        "<td>" + r.desc + "</td>" +
        "<td>" + chipFor(r.tag) + "</td>" +
        "<td>" + (r.amount ? euro(r.amount) : "—") + "</td>" +
        "</tr>";
    }).join("");
  }

  // ---------------------------------------------------------------- nav
  function wireNav(loggedIn) {
    // "Control room" already lives in nav-links once logged in — the nav-cta
    // pill would just repeat it, so it's hidden rather than relabeled.
    if (loggedIn) $("nav-cta").hidden = true;
  }

  function wireLogout() {
    var btn = $("logout-btn");
    btn.addEventListener("click", async function () {
      btn.disabled = true;
      try {
        await LBAuth.logOut();
        location.href = "login.html";
      } catch (err) {
        btn.disabled = false;
        alert(err.message || "Log out failed — try again.");
      }
    });
  }

  // ---------------------------------------------------------------- boot
  wireSecurity();
  wireChannels();

  LBAuth.ready.then(function () {
    var loading = $("loading");
    if (!LBAuth.isLoggedIn()) {
      loading.hidden = true;
      $("signed-out").hidden = false;
      return;
    }

    var user = LBAuth.getUser();
    var profile = LBAuth.getProfile() || {};

    wireNav(true);
    wireLogout();
    renderHeader(user, profile);
    renderChannels(profile);
    renderBilling(profile);
    renderPayments(profile);
    wirePlanChange(function () { return currentProfile; });
    wireCancelSubscription(function () { return currentProfile; });

    loading.hidden = true;
    $("account-content").hidden = false;
  });
})();
