/* LocalBoost account settings page.
   Everything here reads/writes through LBAuth (auth.js) — no direct Supabase
   calls except the ones LBAuth already exposes on window.LBAuth.db. */
(function () {

  // Mirrors the `plans` array in LocalBoost.dc.html and checkout.js — keep in sync.
  var PLANS = {
    counter:    { name: "Counter",    base: 89,  rate: "4 ads / week · 1 channel" },
    storefront: { name: "Storefront", base: 249, rate: "12 ads / week · 4 channels" },
    franchise:  { name: "Franchise",  base: 690, rate: "30 ads / week · unlimited" }
  };
  var ANNUAL_DISCOUNT = 0.2;

  var $ = function (id) { return document.getElementById(id); };

  function euro(n) {
    return "€" + Math.round(n).toLocaleString("en-US");
  }

  function fmtDate(value) {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  function renderBilling(profile) {
    var plan = PLANS[profile.plan];

    // profile.plan is set the moment the business brief is saved — before
    // checkout ever runs. subscription_status only becomes non-null once
    // start_trial() fires (checkout.js, after a card is on file), so that's
    // the real signal for "has a plan running", not the plan column alone.
    if (!plan || !profile.subscription_status) {
      $("billing-rows").hidden = true;
      $("billing-empty").hidden = false;
      $("bill-plan-link").hidden = true;
      return;
    }
    $("billing-rows").hidden = false;
    $("billing-empty").hidden = true;
    $("bill-plan-link").hidden = false;

    var cycle = profile.billing_cycle || "monthly";
    $("bill-plan").textContent = plan.name;
    $("bill-rate").textContent = plan.rate;
    $("bill-cycle").textContent = cycle === "annual" ? "Annual" : "Monthly";

    var statusText = {
      trialing: "Free trial",
      active: "Active",
      past_due: "Past due — update your card",
      canceled: "Canceled"
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

    var cycle = profile.billing_cycle || "monthly";
    var amount = invoiceAmount(plan, cycle);
    var periodMonths = cycle === "annual" ? 12 : 1;
    var now = new Date();

    var rows = [{
      date: new Date(profile.trial_started_at),
      desc: "Free trial started",
      amount: 0,
      tag: "trial"
    }];

    if (profile.trial_ends_at) {
      var cursor = new Date(profile.trial_ends_at);
      var lastPastIndex = -1;
      while (cursor <= now && profile.subscription_status !== "canceled") {
        rows.push({
          date: new Date(cursor),
          desc: plan.name + " plan — " + (cycle === "annual" ? "annual" : "monthly") + " billing",
          amount: amount,
          tag: "paid"
        });
        lastPastIndex = rows.length - 1;
        cursor.setMonth(cursor.getMonth() + periodMonths);
      }
      if (lastPastIndex > -1 && profile.subscription_status === "past_due") {
        rows[lastPastIndex].tag = "past_due";
      }
      if (profile.subscription_status === "trialing" || profile.subscription_status === "active") {
        rows.push({
          date: new Date(cursor),
          desc: plan.name + " plan — " + (cycle === "annual" ? "annual" : "monthly") + " billing",
          amount: amount,
          tag: "upcoming"
        });
      }
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
    var cta = $("nav-cta");
    var logout = $("nav-logout");
    if (loggedIn) {
      cta.textContent = "Control room";
      cta.href = "LocalBoost.dc.html#control";
      logout.hidden = false;
      logout.addEventListener("click", async function () {
        await LBAuth.logOut();
        location.href = "login.html";
      });
    }
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
    renderHeader(user, profile);
    renderChannels(profile);
    renderBilling(profile);
    renderPayments(profile);

    loading.hidden = true;
    $("account-content").hidden = false;
  });
})();
