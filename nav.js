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
        if (/(^|\/)signup\.html$/.test(a.getAttribute("href") || "")) a.textContent = "Request a place";
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

    // After the page's own scripts, so one that loads whats-new.js isn't sent it twice.
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", newsStamp);
    else newsStamp();
  }

  // The ways to whats-new.html, for someone signed in on this device (the
  // page has nothing for anyone else):
  //  - on the app pages, a pill beside the heading's eyebrow: the newest
  //    change this device hasn't seen, with how many more, or a quiet
  //    "What's new" once it's caught up;
  //  - "Beta · updated Oct 12" in the footer's bottom line, between the
  //    copyright and the credit, with a dot while there's news.
  // whats-new.js is fetched here on the pages that don't load it themselves.
  function newsStamp() {
    if (!hasStoredSession()) return;
    var onPage = /(^|\/)whats-new\.html$/.test(location.pathname);

    var bottom = document.querySelector(".foot-bottom");
    var stamp = null;
    if (bottom) {
      stamp = document.createElement("a");
      stamp.href = "/whats-new.html";
      stamp.className = "foot-news";
      stamp.hidden = true;
      bottom.insertBefore(stamp, bottom.children[1] || null);
    }

    var eyebrow = onPage ? null : document.querySelector(".page-hero.is-app .eyebrow");
    var pill = null;
    if (eyebrow) {
      pill = document.createElement("a");
      pill.href = "/whats-new.html";
      pill.className = "hero-news";
      pill.hidden = true;
      eyebrow.insertAdjacentElement("afterend", pill);
    }
    if (!stamp && !pill) return;

    function render() {
      var sr = window.LBLang && LBLang.get() === "sr";
      var fresh = onPage ? [] : LBWhatsNew.fresh();
      if (stamp) {
        var day = new Date(LBWhatsNew.entries[0].date + "T00:00:00")
          .toLocaleDateString(window.LBLang ? LBLang.locale() : "en-US", { month: "short", day: "numeric" });
        stamp.textContent = (sr ? "BETA · AŽURIRANO " : "BETA · UPDATED ") + day.toUpperCase();
        stamp.classList.toggle("is-fresh", fresh.length > 0);
        stamp.title = fresh.length ? (sr ? "Ima novosti — pogledaj šta je novo" : "There's news — see what's new")
          : (sr ? "Šta je novo u Adronisu" : "What's new in Adronis");
        stamp.hidden = false;
      }
      if (pill) {
        pill.textContent = "";
        pill.classList.toggle("is-fresh", fresh.length > 0);
        if (fresh.length) {
          var tag = document.createElement("b");
          tag.textContent = sr ? "Novo" : "New";
          pill.appendChild(tag);
          var title = document.createElement("span");
          title.className = "hero-news-title";
          title.textContent = LBWhatsNew.text(fresh[0]).title;
          pill.appendChild(title);
          if (fresh.length > 1) {
            var more = document.createElement("span");
            more.className = "hero-news-more";
            more.textContent = "+" + (fresh.length - 1);
            pill.appendChild(more);
          }
        } else {
          pill.appendChild(document.createTextNode(sr ? "Šta je novo" : "What's new"));
        }
        pill.appendChild(document.createTextNode(" →"));
        pill.hidden = false;
      }
    }

    function start() {
      // fresh() counts from the day the account was made, which needs the profile.
      (window.LBAuth ? LBAuth.ready : Promise.resolve()).then(render, render);
      document.addEventListener("lb:langchange", render);
      document.addEventListener("lb:newsseen", render);
    }

    if (window.LBWhatsNew) return start();
    var script = document.createElement("script");
    script.src = "/whats-new.js";
    script.onload = start;
    document.body.appendChild(script);
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

  // A "Skip to content" link, first in the page, for keyboard and screen
  // reader users: it lands on whatever comes straight after the nav. Hidden
  // until it has focus (adronis.css, .skip-link).
  function skipLink() {
    var nav = document.querySelector("nav.nav");
    if (!nav || document.querySelector(".skip-link")) return;
    var target = nav.nextElementSibling;
    while (target && /^(SCRIPT|STYLE|TEMPLATE)$/.test(target.tagName)) target = target.nextElementSibling;
    if (!target) return;
    if (!target.id) target.id = "main";
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.classList.add("skip-target");
    var a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#" + target.id;
    a.textContent = "Skip to content";
    document.body.insertBefore(a, document.body.firstChild);
  }

  // Loaded after the nav and the footer (the end of <body>, on every page), so
  // the menu is built straight away: it copies the nav links, and must copy
  // them before i18n.js, which loads next, translates them.
  if (document.querySelector("nav.nav")) { skipLink(); init(); }
  else document.addEventListener("DOMContentLoaded", function () { skipLink(); init(); });
})();
