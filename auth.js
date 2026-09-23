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

  var ready = (async function () {
    var res = await db.auth.getSession();
    session = res.data.session;
    await loadProfile();
    ready_ = true;
  })();

  db.auth.onAuthStateChange(function (_event, newSession) {
    var hadSession = !!session;
    session = newSession;
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

    // Starts the trial. Called by checkout.js once a card is on file — never
    // anywhere else. The DB function refuses if the brief is missing.
    startTrial: async function (planKey, cycle) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.rpc("start_trial", {
        p_plan: planKey || null,
        p_cycle: cycle || "monthly"
      });
      if (res.error) throw res.error;
      await loadProfile();
      return profile;
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

    resetPassword: async function (email) {
      var res = await db.auth.resetPasswordForEmail(email, {
        redirectTo: siteOrigin() + "login.html"
      });
      if (res.error) throw res.error;
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
      var res = await db.rpc("delete_my_account");
      if (res.error) throw res.error;
      // The session's user no longer exists — drop it locally, ignore the
      // server's answer to signing out a deleted user.
      try { await db.auth.signOut({ scope: "local" }); } catch (e) {}
      session = null;
      profile = null;
    },

    // Cancels at the end of the current paid period — access continues until
    // current_period_end, finalize_billing_period() ends it when that arrives.
    cancelAtPeriodEnd: async function () {
      if (!session) throw new Error("Not signed in.");
      var res = await db.rpc("cancel_at_period_end");
      if (res.error) throw res.error;
      profile = res.data;
      return profile;
    },

    // Undoes a pending cancellation before the period runs out.
    resumeSubscription: async function () {
      if (!session) throw new Error("Not signed in.");
      var res = await db.rpc("resume_subscription");
      if (res.error) throw res.error;
      profile = res.data;
      return profile;
    },

    // Schedules a plan/cycle switch for the next renewal — never applied on
    // the spot, since this period is already paid for at the old plan.
    schedulePlanChange: async function (planKey, cycle) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.rpc("schedule_plan_change", { p_plan: planKey, p_cycle: cycle || null });
      if (res.error) throw res.error;
      profile = res.data;
      return profile;
    },

    // Undoes a scheduled plan switch before it takes effect.
    cancelPlanChange: async function () {
      if (!session) throw new Error("Not signed in.");
      var res = await db.rpc("cancel_plan_change");
      if (res.error) throw res.error;
      profile = res.data;
      return profile;
    }
  };
})();
