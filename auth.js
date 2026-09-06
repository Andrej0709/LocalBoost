// LocalBoost auth, backed by Supabase.
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
    return profile;
  }

  var ready = (async function () {
    var res = await db.auth.getSession();
    session = res.data.session;
    await loadProfile();
  })();

  db.auth.onAuthStateChange(function (_event, newSession) {
    session = newSession;
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

    // The profiles row: business_name, city, vertical, plan, trial dates, etc.
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

    // Where a logged-in user should go after clicking a plan:
    // brief first, then checkout, and only then is the plan live.
    nextStep: function (planKey) {
      var q = planKey ? "?plan=" + planKey : "";
      if (!this.hasBrief()) return "signup.html" + q;
      if (!this.hasActivePlan()) return "checkout.html" + q;
      return null; // nothing owed — the plan is already running
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

    // meta: business_name, city, vertical, website, what_you_sell,
    // typical_customer, differentiator, brand_vibe, brand_colors,
    // avoid_notes, channels (array), plan ('counter'|'storefront'|'franchise').
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

    // Changes the password directly — no re-entry of the old one, matching
    // Supabase's updateUser behavior for an already-authenticated session.
    updatePassword: async function (newPassword) {
      if (!session) throw new Error("Not signed in.");
      var res = await db.auth.updateUser({ password: newPassword });
      if (res.error) throw res.error;
      return res.data.user;
    }
  };
})();
