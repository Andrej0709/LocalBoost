/* The public demo: approvals.html?demo=1 and control-room.html?demo=1 (and
 * /demo, which vercel.json sends to the first). The app as a made-up café
 * sees it, for showing a business owner on the spot - on a phone, in their
 * own venue - before they have an account. No sign-in, nothing is read from
 * or written to the database, and nobody is sent away to the beta page.
 *
 * Load it before nav.js, so the phone menu copies the nav as the demo
 * changes it. auth.js and boot-gate.js check LBDemo.on / ?demo themselves.
 */
(function () {
  var on = /[?&]demo(=|&|$)/.test(location.search);
  var page = location.pathname.split("/").pop();

  function sr() {
    return !!(window.LBLang && LBLang.get() === "sr");
  }

  // A text-only ad (a Google Business post, a story with no photo): the
  // words on a coloured card, drawn here so the demo needs no files of its own.
  function textCard(lines, from, to) {
    var size = lines.length > 3 ? 64 : 76;
    var top = 500 - (lines.length - 1) * size * 0.6;
    var text = lines.map(function (line, i) {
      return '<text x="80" y="' + Math.round(top + i * size * 1.2) + '" fill="#fff" ' +
        'font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="' + size + '">' +
        line.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</text>";
    }).join("");
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/>' +
      '</linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/>' + text +
      '<text x="80" y="900" fill="rgba(255,255,255,.6)" font-family="Helvetica,Arial,sans-serif" ' +
      'font-size="30" letter-spacing="4">KAFETERIJA KUTAK</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  window.LBDemo = {
    on: on,

    // This week's drop for the made-up café, waiting on approval: the
    // approvals page's creatives, in the reader's language.
    drop: function () {
      var s = sr();
      return [
        { id: "demo-1", drop_id: "demo", channel: "Instagram", format: "4:5 post", status: "pending",
          headline: s ? "Jutarnja gužva, rešena." : "Morning rush, sorted.",
          caption: s ? "Kafa za poneti za 90 sekundi, i to prava. Svrati pre posla — otvoreno od 7h. ☕"
                     : "Proper coffee to go in 90 seconds. Drop by before work — open from 7am. ☕",
          image_url: "examples/cafe.jpg" },
        { id: "demo-2", drop_id: "demo", channel: "Instagram", format: "9:16 story", status: "pending",
          headline: s ? "Krofne iz peći u 7:30" : "Donuts out of the oven at 7:30",
          caption: s ? "Tople svako jutro, dok traju. 🍩" : "Warm every morning, while they last. 🍩",
          image_url: "examples/bakery.jpg" },
        { id: "demo-3", drop_id: "demo", channel: "Facebook", format: "1:1 post", status: "pending",
          headline: s ? "Vikend doručak, 9–13h" : "Weekend breakfast, 9am–1pm",
          caption: s ? "Subotom i nedeljom: jaja, sveži hleb i kafa po izboru. Sto za dvoje bez rezervacije."
                     : "Saturdays and Sundays: eggs, fresh bread and any coffee. A table for two, no booking needed.",
          image_url: textCard(s ? ["Vikend", "doručak", "9–13h"] : ["Weekend", "breakfast", "9am–1pm"], "#2a2233", "#6b4a73") },
        { id: "demo-4", drop_id: "demo", channel: "Google Business", format: "Post", status: "approved",
          headline: s ? "Najbolja kafa u kraju? Proveri sam." : "Best coffee around? See for yourself.",
          caption: s ? "Prva kafa je na nas ove nedelje — samo pokaži ovaj post." : "First coffee's on us this week — just show this post.",
          image_url: textCard(s ? ["Prva kafa", "je na nas"] : ["First coffee's", "on us"], "#1b2432", "#3a5a83") },
        { id: "demo-5", drop_id: "demo", channel: "Instagram", format: "4:5 post", status: "rejected", reject_reason: "tone",
          headline: s ? "NAJJAČA KAFA U GRADU!!!" : "THE STRONGEST COFFEE IN TOWN!!!",
          caption: s ? "Ne propusti!!! Samo danas!!!" : "Don't miss it!!! Today only!!!",
          image_url: textCard(s ? ["NAJJAČA", "KAFA!!!"] : ["STRONGEST", "COFFEE!!!"], "#3a1f1f", "#8a3a2f") }
      ];
    },

    // The same café's approved ads around today, three already out and three
    // still to go, whatever day the demo is opened: the control room's
    // calendar, schedule and live list.
    week: function () {
      var s = sr();
      var now = Date.now();
      // Days from today at a set hour, so the times read like real slots.
      function at(day, hour, minute) {
        var d = new Date();
        d.setDate(d.getDate() + day);
        d.setHours(hour, minute, 0, 0);
        return d.toISOString();
      }
      var slots = [
        [-2, 8, 30, "Instagram", "4:5 post", s ? "Jutro bez žurbe" : "A morning with no rush", "examples/cafe.jpg"],
        [-1, 7, 15, "Instagram", "9:16 story", s ? "Krofne iz peći u 7:30" : "Donuts out at 7:30", "examples/bakery.jpg"],
        [-1, 12, 0, "Google Business", "Post", s ? "Prva kafa je na nas" : "First coffee's on us",
          textCard(s ? ["Prva kafa", "je na nas"] : ["First coffee's", "on us"], "#1b2432", "#3a5a83")],
        [1, 17, 30, "Facebook", "1:1 post", s ? "Vikend doručak, 9–13h" : "Weekend breakfast, 9am–1pm",
          textCard(s ? ["Vikend", "doručak", "9–13h"] : ["Weekend", "breakfast", "9am–1pm"], "#2a2233", "#6b4a73")],
        [2, 8, 0, "Instagram", "4:5 post", s ? "Krofna uz prvu kafu" : "A donut with your first coffee", "examples/bakery.jpg"],
        [3, 10, 0, "Instagram", "4:5 post", s ? "Vreme je za dugu kafu" : "Time for a long coffee", "examples/cafe.jpg"]
      ];
      return slots.map(function (x) {
        var when = at(x[0], x[1], x[2]);
        var live = new Date(when).getTime() < now;
        return {
          status: live ? "published" : "approved",
          scheduled_at: when,
          published_at: live ? when : null,
          post_url: live ? "https://www.instagram.com/" : null,
          channel: x[3], format: x[4], headline: x[5], image_url: x[6]
        };
      });
    },

    // The strip at the top of a demo page: what this is, the other half of
    // the app, and the way in.
    bar: function () {
      var host = document.querySelector(".section-tight .wrap-wide");
      if (!host || document.getElementById("demo-bar")) return;
      var other = page === "control-room.html"
        ? { href: "approvals.html?demo=1", label: "← Back to approvals" }
        : { href: "control-room.html?demo=1", label: "See the control room →" };

      var bar = document.createElement("div");
      bar.id = "demo-bar";
      bar.className = "demo-bar";
      bar.setAttribute("role", "status");
      bar.innerHTML =
        '<div class="demo-bar-text"><span class="demo-bar-tag">DEMO</span>' +
        "<span>A made-up café, to show how Adronis works. Try anything — nothing here is saved.</span></div>" +
        '<div class="demo-bar-links">' +
          '<a class="btn-ghost" href="' + other.href + '">' + other.label + "</a>" +
          '<a class="btn" href="signup.html">Join the beta<span class="mono">&rarr;</span></a>' +
        "</div>";
      host.insertBefore(bar, host.firstChild);
    }
  };

  if (!on) return;

  // The nav keeps the visitor inside the demo, and offers the way in.
  var links = document.querySelectorAll(".nav-links a");
  Array.prototype.forEach.call(links, function (a) {
    var href = a.getAttribute("href");
    if (href === "approvals.html" || href === "control-room.html") a.setAttribute("href", href + "?demo=1");
    if (href === "history.html") a.remove();
  });
  var account = document.getElementById("nav-account");
  if (account) account.remove();
  var cta = document.getElementById("nav-cta");
  if (cta) {
    cta.textContent = "Join the beta";
    cta.setAttribute("href", "signup.html");
  }
})();
