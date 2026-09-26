/* Past drops: every weekly drop on the account, newest first, with what the
   customer kept, what went live and why the rest was turned down. Read-only;
   "Open this week" hands a drop to approvals.html for the full cards. Nothing
   new is stored for this page - it reads the drops and creatives rows the
   account already has. */
(function () {
  var PAGE = 8; // weeks shown at a time

  // Mirrors REASONS in approvals.html - keep the labels in sync.
  var REASON_LABELS = {
    image: "Image doesn't fit",
    tone: "Wrong tone",
    facts: "Wrong facts or price",
    timing: "Wrong timing",
    other: "Something else"
  };

  var $ = function (id) { return document.getElementById(id); };
  var weeks = [];
  var shown = 0;

  function locale() { return window.LBLang ? LBLang.locale() : "en-US"; }

  function fmtWeek(value) {
    return new Date(value + "T00:00:00").toLocaleDateString(locale(), {
      month: "short", day: "numeric", year: "numeric"
    });
  }

  function count(list, test) { return list.filter(test).length; }
  function isApproved(c) { return c.status === "approved" || c.status === "published"; }

  // How often each reject reason came up, most common first.
  function reasonTally(list) {
    var tally = {};
    list.forEach(function (c) {
      if (c.status === "rejected" && c.reject_reason) tally[c.reject_reason] = (tally[c.reject_reason] || 0) + 1;
    });
    return Object.keys(tally)
      .map(function (key) { return { key: key, n: tally[key] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function countsLine(parts) {
    var line = document.createElement("div");
    line.className = "counts";
    parts.forEach(function (p) {
      var span = document.createElement("span");
      // Label and number are separate nodes, so the label translates on its own.
      span.appendChild(document.createTextNode(p[0]));
      span.appendChild(document.createTextNode(" "));
      var b = document.createElement("b");
      b.textContent = p[1];
      span.appendChild(b);
      line.appendChild(span);
    });
    return line;
  }

  function buildWeek(week, isLatest) {
    var list = week.creatives;
    var card = document.createElement("article");
    card.className = "hs-week";

    var head = document.createElement("div");
    head.className = "hs-week-head";
    var date = document.createElement("div");
    date.className = "hs-week-date";
    date.textContent = "WEEK OF " + fmtWeek(week.drop.week_starting).toUpperCase();
    head.appendChild(date);
    var chipText = week.drop.status === "skipped" ? "SKIPPED"
      : week.drop.status === "rendering" ? "RENDERING"
      : count(list, function (c) { return c.status === "pending"; }) ? "WAITING ON YOU"
      : isLatest ? "LATEST" : null;
    if (chipText) {
      var chip = document.createElement("span");
      chip.className = "hs-week-chip" + (chipText === "SKIPPED" || chipText === "RENDERING" ? " muted" : "");
      chip.textContent = chipText;
      head.appendChild(chip);
    }
    card.appendChild(head);

    if (week.drop.theme) {
      var title = document.createElement("h3");
      title.className = "hs-week-title";
      title.textContent = week.drop.theme;
      card.appendChild(title);
    }

    if (!list.length) {
      var none = document.createElement("p");
      none.className = "hs-note";
      none.textContent = week.drop.status === "skipped" ? "No drop this week." : "No ads in this drop yet.";
      card.appendChild(none);
      return card;
    }

    // Kept ads first, then what's waiting, then what was turned down.
    var order = { published: 0, approved: 1, pending: 2, rejected: 3 };
    var sorted = list.slice().sort(function (a, b) { return (order[a.status] || 0) - (order[b.status] || 0); });
    var MAX_THUMBS = 7;
    var thumbs = document.createElement("div");
    thumbs.className = "hs-thumbs";
    sorted.slice(0, MAX_THUMBS).forEach(function (c) {
      var t = document.createElement("div");
      t.className = "hs-thumb" + (c.status === "rejected" ? " is-rejected" : c.status === "published" ? " is-live" : "");
      t.title = c.headline || "";
      if (c.image_url) {
        var img = new Image();
        img.src = c.image_url;
        img.alt = "";
        img.loading = "lazy";
        t.appendChild(img);
      }
      thumbs.appendChild(t);
    });
    if (sorted.length > MAX_THUMBS) {
      var more = document.createElement("div");
      more.className = "hs-thumb-more";
      more.textContent = "+" + (sorted.length - MAX_THUMBS);
      thumbs.appendChild(more);
    }
    card.appendChild(thumbs);

    var parts = [
      ["ADS", list.length],
      ["APPROVED", count(list, isApproved)],
      ["LIVE", count(list, function (c) { return c.status === "published"; })],
      ["REJECTED", count(list, function (c) { return c.status === "rejected"; })]
    ];
    var waiting = count(list, function (c) { return c.status === "pending"; });
    if (waiting) parts.push(["WAITING", waiting]);
    card.appendChild(countsLine(parts));

    var reasons = reasonTally(list);
    if (reasons.length) {
      var row = document.createElement("div");
      row.className = "hs-reasons";
      var label = document.createElement("span");
      label.className = "hs-reasons-label";
      label.textContent = "WHY YOU REJECTED";
      row.appendChild(label);
      reasons.forEach(function (r) {
        var pill = document.createElement("span");
        pill.className = "hs-reason";
        pill.appendChild(document.createTextNode(REASON_LABELS[r.key] || r.key));
        var n = document.createElement("b");
        n.textContent = "×" + r.n;
        pill.appendChild(n);
        row.appendChild(pill);
      });
      card.appendChild(row);
    }

    if (week.drop.notes) {
      var note = document.createElement("p");
      note.className = "hs-note";
      note.textContent = week.drop.notes;
      card.appendChild(note);
    }

    var open = document.createElement("a");
    open.className = "hs-open";
    open.href = "approvals.html?drop=" + encodeURIComponent(week.drop.id) + "&filter=all";
    open.textContent = "Open this week →";
    card.appendChild(open);

    return card;
  }

  function renderMore() {
    var listEl = $("hs-weeks-list");
    weeks.slice(shown, shown + PAGE).forEach(function (week, i) {
      listEl.appendChild(buildWeek(week, shown + i === 0));
    });
    shown = Math.min(weeks.length, shown + PAGE);
    $("hs-more-btn").hidden = shown >= weeks.length;
  }

  function renderTotals(all) {
    $("hs-weeks").textContent = weeks.length;
    $("hs-approved").textContent = count(all, isApproved);
    $("hs-live").textContent = count(all, function (c) { return c.status === "published"; });
    $("hs-rejected").textContent = count(all, function (c) { return c.status === "rejected"; });

    var top = reasonTally(all)[0];
    var line = $("hs-top-reason");
    line.hidden = !top;
    if (top) {
      line.innerHTML = "";
      line.appendChild(document.createTextNode("Most common reason you turned an ad down:"));
      line.appendChild(document.createTextNode(" "));
      var b = document.createElement("b");
      b.textContent = REASON_LABELS[top.key] || top.key;
      line.appendChild(b);
      line.appendChild(document.createTextNode(" "));
      var n = document.createElement("span");
      n.textContent = "×" + top.n;
      line.appendChild(n);
    }
  }

  $("hs-more-btn").addEventListener("click", renderMore);

  // Dates follow the reader's language.
  document.addEventListener("lb:langchange", function () {
    if (!weeks.length) return;
    $("hs-weeks-list").innerHTML = "";
    var had = shown;
    shown = 0;
    while (shown < had) renderMore();
  });

  LBAuth.ready.then(async function () {
    if (!LBAuth.isLoggedIn()) {
      $("loading").hidden = true;
      $("signed-out").hidden = false;
      return;
    }

    var user = LBAuth.getUser();
    var cta = $("nav-cta");
    cta.textContent = "Approvals";
    cta.href = "approvals.html";

    var loaded = await Promise.all([
      LBAuth.db.from("drops")
        .select("id, week_starting, status, theme, notes")
        .eq("user_id", user.id)
        .order("week_starting", { ascending: false }),
      LBAuth.db.from("creatives")
        .select("id, drop_id, status, image_url, headline, reject_reason, published_at")
        .eq("user_id", user.id)
    ]);
    $("loading").hidden = true;

    var err = loaded[0].error || loaded[1].error;
    if (err) {
      $("no-drops").hidden = false;
      $("no-drops").querySelector("h3").textContent = "Couldn't load your drops.";
      $("no-drops").querySelector("p").textContent = err.message;
      return;
    }

    var drops = loaded[0].data || [];
    var creatives = loaded[1].data || [];
    if (!drops.length) { $("no-drops").hidden = false; return; }

    var byDrop = {};
    creatives.forEach(function (c) { (byDrop[c.drop_id] = byDrop[c.drop_id] || []).push(c); });
    weeks = drops.map(function (d) { return { drop: d, creatives: byDrop[d.id] || [] }; });

    $("history").hidden = false;
    renderTotals(creatives);
    renderMore();
  });
})();
