// "Feedback" button for beta testers, on the app pages (control room,
// approvals, past drops, account). Load after auth.js.
//
// What they write lands in public.messages with the business name and login
// email, so it shows in the portal's inbox and sends the same notification as
// the Message us form (supabase/notify.sql).

(function () {
  if (!window.LBAuth) return;

  var PAGES = {
    "control-room.html": "Control room",
    "approvals.html": "Approvals",
    "history.html": "Past drops",
    "account.html": "Account"
  };

  function t(text) {
    return window.LBLang ? LBLang.t(text) : text;
  }

  function build() {
    var page = location.pathname.split("/").pop();

    var button = document.createElement("button");
    button.type = "button";
    button.className = "fb-btn";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "fb-panel");
    button.textContent = "Feedback";

    var panel = document.createElement("form");
    panel.className = "fb-panel";
    panel.id = "fb-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="fb-head"><b>Tell us what you think</b>' +
      '<button type="button" class="fb-close" aria-label="Close">✕</button></div>' +
      '<label class="fb-label" for="fb-text">What works, what doesn\'t, what\'s missing — anything helps.</label>' +
      '<textarea id="fb-text" required maxlength="4000" rows="5"></textarea>' +
      '<button type="submit" class="btn btn-block">Send</button>' +
      '<p class="fb-note" role="status" hidden></p>';

    var text = panel.querySelector("textarea");
    var send = panel.querySelector("button[type=submit]");
    var note = panel.querySelector(".fb-note");

    function setOpen(open) {
      panel.hidden = !open;
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) text.focus();
    }

    button.addEventListener("click", function () { setOpen(panel.hidden); });
    panel.querySelector(".fb-close").addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });

    panel.addEventListener("submit", async function (e) {
      e.preventDefault();
      var profile = LBAuth.getProfile() || {};
      var user = LBAuth.getUser() || {};
      send.disabled = true;
      note.hidden = true;
      var res = await LBAuth.db.from("messages").insert({
        full_name: profile.business_name || null,
        email: user.email,
        message: "Beta feedback · " + (PAGES[page] || page) + "\n\n" + text.value.trim()
      });
      send.disabled = false;
      note.hidden = false;
      if (res.error) {
        note.textContent = t("Could not send:") + " " + t(LBAuth.friendlyError(res.error).message);
        return;
      }
      text.value = "";
      note.textContent = t("Thanks — it's with us. We read every one.");
      setTimeout(function () { note.hidden = true; setOpen(false); }, 2200);
    });

    document.body.appendChild(panel);
    document.body.appendChild(button);
  }

  LBAuth.ready.then(function () {
    if (!LBAuth.isLoggedIn() || !LBAuth.hasActivePlan()) return;
    if ((LBAuth.getProfile() || {}).plan !== "beta") return;
    build();
  });
})();
