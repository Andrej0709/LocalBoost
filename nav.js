(function () {
  function init() {
    var nav = document.querySelector("nav.nav");
    if (!nav) return;
    var links = nav.querySelector(".nav-links");
    if (!links) return;

    var burger = document.createElement("button");
    burger.type = "button";
    burger.className = "nav-burger";
    burger.setAttribute("aria-label", "Menu");
    burger.setAttribute("aria-expanded", "false");
    burger.textContent = "≡";

    var sheet = document.createElement("div");
    sheet.className = "nav-sheet";
    Array.prototype.forEach.call(links.querySelectorAll("a"), function (a) {
      sheet.appendChild(a.cloneNode(true));
    });
    var login = document.createElement("a");
    login.href = "login.html";
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
      if (window.innerWidth > 860) setOpen(false);
    });

    if (window.LBAuth) {
      LBAuth.ready.then(function () {
        if (!LBAuth.isLoggedIn()) return;
        var profile = LBAuth.getProfile() || {};
        var user = LBAuth.getUser() || {};
        var label = profile.business_name || user.email || "Account";
        Array.prototype.forEach.call(
          document.querySelectorAll('a[href="login.html"]'),
          function (a) {
            a.textContent = label;
            a.href = "control-room.html";
          }
        );
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
