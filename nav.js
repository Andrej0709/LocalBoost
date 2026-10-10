(function () {
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if (/^sb-.+-auth-token$/.test(localStorage.key(i))) return true;
      }
    } catch (e) {}
    return false;
  }

  function init() {
    var nav = document.querySelector("nav.nav");
    if (!nav) return;
    var links = nav.querySelector(".nav-links");
    if (!links) return;

    // During the beta (BETA in boot-gate.js) signing up is applying for a
    // beta place, so the nav's "Try it free" says so.
    if (window.LBGate && LBGate.beta) {
      Array.prototype.forEach.call(nav.querySelectorAll(".nav-cta"), function (a) {
        if (/(^|\/)signup\.html$/.test(a.getAttribute("href") || "")) a.textContent = "Join the beta";
      });
    }

    // Approvals, the control room and past drops only show a "log in" card to
    // someone who isn't signed in, so their links, in the nav and the footer,
    // wait until this device has a session (the same check boot-gate.js makes).
    if (!hasStoredSession()) {
      Array.prototype.forEach.call(document.querySelectorAll(".nav-links a, footer a"), function (a) {
        if (/(^|\/)(approvals|control-room|history)\.html$/.test(a.getAttribute("href") || "")) a.remove();
      });
    }

    var burger = document.createElement("button");
    burger.type = "button";
    burger.className = "nav-burger";
    burger.setAttribute("aria-label", "Menu");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-controls", "nav-sheet");
    burger.textContent = "≡";

    var sheet = document.createElement("div");
    sheet.className = "nav-sheet";
    sheet.id = "nav-sheet";
    Array.prototype.forEach.call(links.querySelectorAll("a"), function (a) {
      sheet.appendChild(a.cloneNode(true));
    });
    var login = document.createElement("a");
    login.href = "/login.html";
    login.className = "nav-sheet-alt";
    login.textContent = "Log in";
    sheet.appendChild(login);

    nav.appendChild(burger);
    document.body.appendChild(sheet);

    function setOpen(open) {
      sheet.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.textContent = open ? "✕" : "≡";
    }
    burger.addEventListener("click", function () {
      setOpen(!sheet.classList.contains("open"));
    });
    sheet.addEventListener("click", function (e) {
      if (e.target.tagName === "A") setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (!sheet.contains(e.target) && !burger.contains(e.target)) setOpen(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) setOpen(false);
    });

    // auth.js loads after this file, so the account name waits for the page.
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showAccount);
    else showAccount();
  }

  function showAccount() {
    if (!window.LBAuth) return;
    LBAuth.ready.then(function () {
      if (!LBAuth.isLoggedIn()) return;
      var profile = LBAuth.getProfile() || {};
      var user = LBAuth.getUser() || {};
      var label = profile.business_name || user.email || "Account";
      Array.prototype.forEach.call(
        document.querySelectorAll('a[href="login.html"], a[href="/login.html"]'),
        function (a) {
          a.textContent = label;
        }
      );
    });
  }

  // Loaded after the nav and the footer (the end of <body>, on every page), so
  // the menu is built straight away: it copies the nav links, and must copy
  // them before i18n.js, which loads next, translates them.
  if (document.querySelector("nav.nav")) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
