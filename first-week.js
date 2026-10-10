/* The empty control room and approvals, for an account whose plan is on but
 * whose first drop hasn't landed yet (a beta tester the day they're let in):
 * when the first ads arrive and how the week goes from there, instead of a
 * bare "nothing yet". Both pages carry the same #first-week list inside their
 * #no-drops box; this fills in the date and swaps the copy.
 */
(function () {
  // Drops land on Mondays. On a Monday itself that week's drop has already
  // been made, so the first one is the Monday after.
  function nextMonday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d;
  }

  window.LBFirstWeek = {
    // intro: the line under the heading, which differs per page.
    show: function (box, intro) {
      var profile = (window.LBAuth && LBAuth.getProfile()) || {};
      box.querySelector(".mono").textContent =
        profile.plan === "beta" ? "YOU'RE IN THE BETA" : "YOUR PLAN IS ON";
      box.querySelector("h3").textContent = "Your first ads land on Monday.";
      box.querySelector("p").textContent = intro;

      var list = box.querySelector(".first-week");
      list.querySelector(".fw-when").textContent = nextMonday()
        .toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"),
          { weekday: "short", month: "short", day: "numeric" })
        .toUpperCase();
      list.hidden = false;
    }
  };
})();
