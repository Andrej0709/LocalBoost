/* "Put Adronis on your home screen", for a customer with a plan on, on a
 * phone, in the browser rather than the installed app. Approving is a
 * job for the phone, and an icon on the home screen is what brings people
 * back to it. Android's own Install prompt is used when the browser offers
 * it; otherwise the hint says where the browser keeps it. Dismissed once,
 * it stays away on this device.
 *
 * Load it after auth.js (and demo.js) on approvals.html and control-room.html.
 */
(function () {
  var KEY = "lb-install-hint-dismissed";
  var prompt = null;

  function dismissed() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function installed() {
    return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }

  function phone() {
    return window.matchMedia && matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;
  }

  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  // Chrome on Android offers its own install sheet; keep it for the button.
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    prompt = e;
    var button = document.querySelector("#install-hint [data-install]");
    if (button) button.hidden = false;
  });

  function show() {
    var host = document.querySelector(".section-tight .wrap-wide");
    if (!host || document.getElementById("install-hint")) return;

    var box = document.createElement("div");
    box.id = "install-hint";
    box.className = "notice install-hint";
    box.setAttribute("role", "status");

    var text = document.createElement("div");
    text.className = "install-text";
    var tag = document.createElement("span");
    tag.className = "mono install-tag";
    tag.textContent = "TIP";
    var lead = document.createElement("span");
    lead.textContent = "Put Adronis on your home screen — it opens like an app, straight to your ads.";
    var how = document.createElement("span");
    how.className = "install-how";
    how.textContent = ios
      ? "Tap the Share button, then “Add to Home Screen”."
      : "Open the browser menu (⋮), then “Add to Home screen” or “Install app”.";
    text.appendChild(tag);
    text.appendChild(lead);
    text.appendChild(how);

    var install = document.createElement("button");
    install.type = "button";
    install.className = "btn-ghost";
    install.setAttribute("data-install", "");
    install.textContent = "Install";
    install.hidden = !prompt;
    install.addEventListener("click", function () {
      if (!prompt) return;
      prompt.prompt();
      prompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === "accepted") close();
      }, function () {});
      prompt = null;
    });

    var x = document.createElement("button");
    x.type = "button";
    x.className = "install-x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "✕";
    x.addEventListener("click", close);

    function close() {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
      box.remove();
    }

    box.appendChild(text);
    box.appendChild(install);
    box.appendChild(x);
    host.insertBefore(box, host.firstChild);
  }

  if (!window.LBAuth) return;
  LBAuth.ready.then(function () {
    if (window.LBDemo && LBDemo.on) return;
    if (!LBAuth.hasActivePlan() || installed() || dismissed() || !phone()) return;
    show();
  });
})();
