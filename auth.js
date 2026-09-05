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
      profile = res.data;
      return profile;
    },

    resetPassword: async function (email) {
      var res = await db.auth.resetPasswordForEmail(email, {
        redirectTo: siteOrigin() + "login.html"
      });
      if (res.error) throw res.error;
    }
  };
})();
