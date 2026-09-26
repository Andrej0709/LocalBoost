// Adronis auth, backed by Supabase.
//
// Load order on every page that uses it:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-config.js"></script>
//   <script src="auth.js"></script>
//
// Everything here is async. Wait for LBAuth.ready before reading session state:
//   LBAuth.ready.then(function () { if (LBAuth.isLoggedIn()) { ... } });

(function () {
  // Links from Supabase's emails (password reset, email confirmation) come
  // back with their result in the URL. Read it before the client below
  // consumes it and tidies the address bar.
  var RECOVERY_KEY = "lb-password-recovery";
  var LINK_ERROR_KEY = "lb-auth-link-error";
  var cameFromResetLink = /(^|[#&])type=recovery(&|$)/.test(location.hash);
  var cameWithAuthCode = /[?&]code=/.test(location.search);
  var linkError = /(^|[#&?])error_description=/.test(location.hash + location.search);

  function remember(key, on) {
    try { on ? sessionStorage.setItem(key, "1") : sessionStorage.removeItem(key); } catch (e) {}
  }
  function remembered(key) {
    try { return sessionStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  function onLoginPage() {
    return /\/login\.html$/.test(location.pathname);
  }

  // The "new password" form is only for the page the reset link opened. A
  // customer who clicks away without setting one stays signed in, and every
  // later page is ordinary again. Reloading the form keeps it, and so does the
  // hop from whichever page Supabase landed on to the login page (#reset).
  var navigation = (window.performance && performance.getEntriesByType &&
                    performance.getEntriesByType("navigation")[0]) || {};
  if (!cameFromResetLink && location.hash !== "#reset" && navigation.type !== "reload") {
    remember(RECOVERY_KEY, false);
  }

  // A reset link signs the customer in so they can choose a new password.
  // That happens on the login page, whichever page Supabase sent them to.
  // The flag lives in this tab only, so nobody gets the "new password" form
  // without having opened the link.
  function startRecovery() {
    remember(RECOVERY_KEY, true);
    if (onLoginPage()) document.dispatchEvent(new Event("lb:recovery"));
    else location.replace(siteOrigin() + "login.html#reset");
  }

  var db = window.supabase.createClient(
    window.LB_SUPABASE_URL,
    window.LB_SUPABASE_ANON_KEY
  );

  var session = null;
  var profile = null;
  var ready_ = false;

  function siteOrigin() {
    return location.origin + location.pathname.replace(/[^/]*$/, "");
  }

  async function loadProfile() {
    if (!session) {
      profile = null;
      return null;
    }
    var res = await db
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    profile = res.data || null;

    // A renewal date may have passed since the last time this account was
    // loaded (a cancellation taking effect, a scheduled plan switch kicking
    // in). Catch it up here so every page sees the current state, not a
    // stale one from before the renewal.
    if (
      profile &&
      profile.current_period_end &&
      (profile.subscription_status === "trialing" || profile.subscription_status === "active") &&
      new Date(profile.current_period_end) <= new Date()
    ) {
      var fin = await db.rpc("finalize_billing_period");
      if (!fin.error && fin.data) profile = fin.data;
    }

    return profile;
  }

  // Billing goes through the paddle Edge Function (supabase/functions/paddle),
  // which talks to Paddle with the secret API key. Its errors carry a message
  // meant for the customer.
  async function billing(action, body) {
    if (!session) throw new Error("Not signed in.");
    var payload = { action: action };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    var res = await db.functions.invoke("paddle", { body: payload });
    if (res.error) {
      var message = "Payments are having a problem right now. Please try again in a minute.";
      try {
        var detail = await res.error.context.json();
        if (detail && detail.error) message = detail.error;
      } catch (e) {}
      throw new Error(message);
    }
    if (res.data && res.data.profile) profile = res.data.profile;
    return res.data;
  }

  // The page is on its way elsewhere: never resolve, so it doesn't render
  // itself for the split second before it goes.
  function leaving() { return new Promise(function () {}); }

  var ready = (async function () {
    var res = await db.auth.getSession();
    session = res.data.session;

    // An expired or already-used link, or one opened in a different browser
    // than the one that asked for it: the login page explains and offers a
    // fresh one.
    if (linkError || (cameWithAuthCode && !session)) {
      remember(LINK_ERROR_KEY, true);
      if (!onLoginPage()) { location.replace(siteOrigin() + "login.html"); return leaving(); }
    }
    if (cameFromResetLink && session) { startRecovery(); if (!onLoginPage()) return leaving(); }

    await loadProfile();
    ready_ = true;
  })();

  db.auth.onAuthStateChange(function (_event, newSession) {
    var hadSession = !!session;
    session = newSession;
    if (_event === "PASSWORD_RECOVERY" && !remembered(RECOVERY_KEY)) startRecovery();
    // Supabase fires this in every open tab, including ones that didn't cause
    // the change. A tab that goes from signed-in to signed-out (logged out in
    // another tab, session expired, etc.) reloads so its page re-runs the
    // normal boot flow instead of sitting there stale with the old profile
    // still rendered and every action failing with "Not signed in."
    if (ready_ && hadSession && !session) location.reload();
  });

  window.LBAuth = {
    db: db,
    ready: ready,

    isLoggedIn: function () {
      return !!session;
    },

    // The auth user (id, email). Synchronous, valid after ready.
    getUser: function () {
      return session ? session.user : null;
    },

    // The profiles row: business_name, country, city, vertical, plan, trial dates, etc.
    getProfile: function () {
      return profile;
    },

    refreshProfile: loadProfile,

    // The business brief is filled in — signup.html stamps onboarded_at.
    hasBrief: function () {
      return !!(profile && profile.onboarded_at);
    },

    // A trial or a paid subscription is actually running. Nothing on the site
    // may claim a plan is live unless this is true.
    hasActivePlan: function () {
      return !!(
        profile &&
        (profile.subscription_status === "trialing" ||
          profile.subscription_status === "active")
      );
    },

    // One trial per account: once a trial has ever started, checkout for this
    // account is paid from day one (start_trial enforces the same rule).
    hadTrial: function () {
      return !!(profile && profile.trial_started_at);
    },

    // No trial or subscription running — never paid, or canceled. These
    // accounts get the free monthly allowance (see freeQuota).
    isOnFreePlan: function () {
      return !!session && !this.hasActivePlan();
    },

    // Where a logged-in user should go after clicking a plan:
    // brief first, then checkout, and only then is the plan live.
    // The free plan skips checkout — there's no card to take.
    nextStep: function (planKey) {
      var key = planKey || (profile && profile.plan) || "";
      var q = key ? "?plan=" + key : "";
      if (!this.hasBrief()) return "signup.html" + q;
      if (this.hasActivePlan() || key === "free") return null; // nothing owed
      return "checkout.html" + q;
    },

    // How many creatives are waiting on this account's approval.
    pendingCount: async function () {
      if (!session) return 0;
      var res = await db
        .from("creatives")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "pending");
      return res.error ? 0 : res.count || 0;
    },

    // This calendar month's free allowance: { used, limit, resets_at }.
    // null if it can't be read (signed out, or schema.sql not run yet).
    freeQuota: async function () {
      if (!session) return null;
      var res = await db.rpc("free_quota");
      return res.error ? null : res.data;
    },

    // Where a signed-in customer belongs when they open the site:
    //   "approvals" — a paid plan is running, or they're on the free plan
    //                 with a creative waiting on their approval
    //   "pricing"   — free plan with nothing waiting
    // null when signed out (they stay on the landing page).
    homeRoute: async function () {
      if (!session) return null;
      if (this.hasActivePlan()) return "approvals";
      return (await this.pendingCount()) > 0 ? "approvals" : "pricing";
    },

    // Marks the brief as done. Does NOT start the trial.
    saveBrief: async function (brief) {
      var patch = {};
      Object.keys(brief).forEach(function (k) { patch[k] = brief[k]; });
      patch.onboarded_at = new Date().toISOString();

      var saved = await window.LBAuth.updateProfile(patch);

      // Checkout refuses to open without this, so fail loudly here rather than
      // sending the user into a redirect loop.
      if (!saved || !saved.onboarded_at) {
        throw new Error(
          "Your brief didn't save — the database is missing the onboarding " +
          "columns. Run supabase/schema.sql in the SQL editor and try again."
        );
      }
      return saved;
    },

    // Prepares a Paddle checkout: { transaction_id, trial, has_customer }.
    // The server picks the price (trial only if this account never had one)
    // and refuses if the brief is missing. The trial or subscription itself
    // only starts when Paddle's webhook confirms the card.
    createCheckout: function (planKey, cycle, promoCode) {
      return billing("checkout", { plan: planKey, cycle: cycle, promo_code: promoCode || null });
    },


    // meta: business_name, country, city, vertical, website, what_you_sell,
    // typical_customer, differentiator, why_us, brand_vibe, brand_colors,
    // avoid_notes, channels (array), plan ('counter'|'storefront'|'franchise'|'free').
    // The on_auth_user_created trigger copies these into public.profiles.
    signUp: async function (email, password, meta) {
      var res = await db.auth.signUp({
        email: email,
        password: password,
        options: {
          data: meta || {},
          emailRedirectTo: siteOrigin() + "login.html"
        }
      });
      if (res.error) throw res.error;
      session = res.data.session; // null while email confirmation is pending
      if (session) await loadProfile();
      return {
        // Email confirmation is on, so a fresh signup returns no session.
        needsEmailConfirmation: !res.data.session,
        user: res.data.user
      };
    },

    logIn: async function (email, password) {
      var res = await db.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (res.error) throw res.error;
      session = res.data.session;
      await loadProfile();
      return session;
    },

    logOut: async function () {
      remember(RECOVERY_KEY, false);
      await db.auth.signOut();
      session = null;
      profile = null;
    },

    updateProfile: async function (patch) {
      if (!session) throw new Error("Not signed in.");

      var res = await db
        .from("profiles")
        .update(patch)
        .eq("id", session.user.id)
        .select()
        .maybeSingle();
      if (res.error) throw res.error;

      // An UPDATE that matches no row is not an error in PostgREST, it just
      // writes nothing. That happens when the on_auth_user_created trigger
      // never made the row (accounts created before it existed, or a failed
      // confirmation). Insert it instead of silently losing the data.
      if (!res.data) {
        var row = { id: session.user.id, email: session.user.email };
        Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
        res = await db.from("profiles").upsert(row).select().maybeSingle();
        if (res.error) throw res.error;
        if (!res.data) throw new Error("Could not save your profile — please try again.");
      }

      profile = res.data;
      return profile;
    },

    // Emails a link that signs the customer in and brings them back to the
    // login page to choose a new password (see startRecovery above).
    resetPassword: async function (email) {
      var res = await db.auth.resetPasswordForEmail(email, {
        redirectTo: siteOrigin() + "login.html"
      });
      if (res.error) throw res.error;
    },

    // Signed in through a reset link in this tab, new password not set yet.
    isRecovering: function () {
      return !!session && remembered(RECOVERY_KEY);
    },

    // Sets the new password at the end of a reset. No current password to
    // check - opening the emailed link is the proof.
    finishRecovery: async function (newPassword) {
      if (!this.isRecovering()) throw new Error("This reset link has run out. Ask for a new one.");
      var res = await db.auth.updateUser({ password: newPassword });
      if (res.error) throw res.error;
      remember(RECOVERY_KEY, false);
      return res.data.user;
    },

    // True once after an emailed link failed (expired, already used, or
    // opened in another browser), so the login page can say so.
    takeLinkError: function () {
      var had = remembered(LINK_ERROR_KEY);
      remember(LINK_ERROR_KEY, false);
      return had;
    },

    // Changes the login email. Supabase sends a confirmation link before the
    // change takes effect — session.user.email stays the old address until then.
    updateEmail: async function (newEmail) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.auth.updateUser({ email: newEmail });
      if (res.error) throw res.error;
      return res.data.user;
    },

    // Confirms the current password is correct before a password change is
    // allowed. Supabase's updateUser has no built-in re-auth check, so this
    // re-runs signInWithPassword against the current email as that check.
    verifyPassword: async function (currentPassword) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword
      });
      if (res.error) throw new Error("Current password is incorrect.");
      session = res.data.session;
      return true;
    },

    // Changes the password directly — call verifyPassword first if the old
    // one needs confirming; Supabase's updateUser itself doesn't ask for it.
    updatePassword: async function (newPassword) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.auth.updateUser({ password: newPassword });
      if (res.error) throw res.error;
      return res.data.user;
    },

    // Deletes the login and, through the database's cascades, the profile,
    // drops and creatives with it. The caller checks the password first.
    deleteAccount: async function () {
      if (!session) throw new Error("Not signed in.");
      // Stop Paddle billing first - a deleted account must never be charged.
      if (profile && profile.paddle_subscription_id) await billing("cancel_now");
      var res = await db.rpc("delete_my_account");
      if (res.error) throw res.error;
      // The session's user no longer exists — drop it locally, ignore the
      // server's answer to signing out a deleted user.
      try { await db.auth.signOut({ scope: "local" }); } catch (e) {}
      session = null;
      profile = null;
    },

    // Cancels at the end of the current paid period in Paddle — access
    // continues until current_period_end, then Paddle's webhook ends the plan.
    cancelAtPeriodEnd: async function () {
      return (await billing("cancel")).profile;
    },

    // Undoes a pending cancellation before the period runs out.
    resumeSubscription: async function () {
      return (await billing("resume")).profile;
    },

    // Switches the plan/cycle from the next renewal — this period is already
    // paid for at the old plan, so nothing is charged now.
    schedulePlanChange: async function (planKey, cycle) {
      return (await billing("change_plan", { plan: planKey, cycle: cycle || null })).profile;
    },

    // Undoes a scheduled plan switch before it takes effect.
    cancelPlanChange: async function () {
      return (await billing("undo_change")).profile;
    }
  };
})();
