// Control room — read-only view of what's scheduled and what's already live.
// Approvals happen on approvals.html; this page only displays the result.
(function () {
  var loading    = document.getElementById("loading");
  var board      = document.getElementById("board");
  var signedOut  = document.getElementById("signed-out");
  var noDrops    = document.getElementById("no-drops");

  function fmtDay(value) {
    return new Date(value).toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), {
      weekday: "short", month: "short", day: "numeric"
    }).toUpperCase();
  }

  function fmtTime(value) {
    return new Date(value).toLocaleTimeString((window.LBLang ? LBLang.locale() : "en-US"), {
      hour: "numeric", minute: "2-digit"
    });
  }

  function fmtLiveMeta(value) {
    return new Date(value).toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), {
      month: "short", day: "numeric"
    }) + " · " + fmtTime(value);
  }

  function buildRow(creative, opts) {
    var row = document.createElement("div");
    row.className = "cr-row";

    if (creative.image_url) {
      var img = new Image();
      img.className = "cr-thumb";
      img.alt = creative.headline || "";
      img.src = creative.image_url;
      row.appendChild(img);
    } else {
      var ph = document.createElement("div");
      ph.className = "cr-thumb-ph";
      row.appendChild(ph);
    }

    var time = document.createElement("div");
    time.className = "cr-time" + (opts.muted ? " is-muted" : "");
    time.textContent = opts.time;
    row.appendChild(time);

    var main = document.createElement("div");
    main.className = "cr-main";
    var headline = document.createElement("div");
    headline.className = "cr-headline";
    headline.textContent = creative.headline || "Untitled creative";
    var meta = document.createElement("div");
    meta.className = "cr-meta";
    meta.textContent = [creative.channel, creative.format].filter(Boolean).join(" · ");
    main.appendChild(headline);
    main.appendChild(meta);
    row.appendChild(main);

    var chip = document.createElement("div");
    chip.className = "cr-chip " + opts.chipClass;
    chip.textContent = opts.chipLabel;
    row.appendChild(chip);

    return row;
  }

  function renderScheduled(creatives) {
    var list = document.getElementById("scheduled-list");
    var empty = document.getElementById("scheduled-empty");
    list.innerHTML = "";

    var approved = creatives.filter(function (c) { return c.status === "approved"; });
    if (!approved.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    var unslotted = approved.filter(function (c) { return !c.scheduled_at; });
    var slotted = approved.filter(function (c) { return !!c.scheduled_at; })
      .sort(function (a, b) { return new Date(a.scheduled_at) - new Date(b.scheduled_at); });

    if (unslotted.length) {
      var head = document.createElement("div");
      head.className = "cr-day";
      head.textContent = "NOT YET SLOTTED";
      list.appendChild(head);
      unslotted.forEach(function (c) {
        list.appendChild(buildRow(c, { time: "—", muted: true, chipClass: "slot", chipLabel: "APPROVED" }));
      });
    }

    var lastDay = null;
    slotted.forEach(function (c) {
      var day = fmtDay(c.scheduled_at);
      if (day !== lastDay) {
        var head = document.createElement("div");
        head.className = "cr-day";
        head.textContent = day;
        list.appendChild(head);
        lastDay = day;
      }
      list.appendChild(buildRow(c, { time: fmtTime(c.scheduled_at), chipClass: "slot", chipLabel: "SCHEDULED" }));
    });
  }

  function renderLive(creatives) {
    var list = document.getElementById("live-list");
    var empty = document.getElementById("live-empty");
    list.innerHTML = "";

    var published = creatives.filter(function (c) { return c.status === "published"; })
      .sort(function (a, b) {
        return new Date(b.published_at || 0) - new Date(a.published_at || 0);
      });

    if (!published.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    published.forEach(function (c) {
      var time = c.published_at ? fmtLiveMeta(c.published_at) : "—";
      list.appendChild(buildRow(c, { time: time, chipClass: "live", chipLabel: "LIVE" }));
    });
  }

  function renderStats(creatives) {
    var scheduled = creatives.filter(function (c) { return c.status === "approved"; }).length;
    var live = creatives.filter(function (c) { return c.status === "published"; }).length;
    var waiting = creatives.filter(function (c) { return c.status === "pending"; }).length;

    document.getElementById("stat-scheduled").textContent = scheduled;
    document.getElementById("stat-live").textContent = live;
    document.getElementById("stat-waiting").textContent = waiting;

    var link = document.getElementById("stat-waiting-link");
    link.hidden = waiting === 0;
    if (waiting > 0) link.textContent = "Review " + waiting + " waiting →";
  }

  // --- Posting calendar: one week, Monday first ---
  var calStart = startOfWeek(new Date());
  var calCreatives = [];

  function startOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // A published creative sits on the day it went out; an approved one on the
  // day it's slotted for. Approved but not yet slotted has no day to sit on.
  function calendarDate(c) {
    if (c.status === "published") return c.published_at || c.scheduled_at;
    if (c.status === "approved") return c.scheduled_at;
    return null;
  }

  function renderCalendar() {
    var locale = window.LBLang ? LBLang.locale() : "en-US";
    var grid = document.getElementById("cal-grid");
    grid.innerHTML = "";

    var end = new Date(calStart);
    end.setDate(end.getDate() + 6);
    document.getElementById("cal-range").textContent =
      calStart.toLocaleDateString(locale, { month: "short", day: "numeric" }).toUpperCase() + " – " +
      end.toLocaleDateString(locale, { month: "short", day: "numeric" }).toUpperCase();

    var today = new Date();
    for (var i = 0; i < 7; i++) {
      var day = new Date(calStart);
      day.setDate(day.getDate() + i);

      var cell = document.createElement("div");
      cell.className = "cal-day" +
        (sameDay(day, today) ? " is-today" : day < startOfDay(today) ? " is-past" : "");
      var label = document.createElement("div");
      label.className = "cal-date";
      label.textContent = day.toLocaleDateString(locale, { weekday: "short", day: "numeric" }).toUpperCase();
      cell.appendChild(label);

      var items = calCreatives
        .filter(function (c) { var at = calendarDate(c); return at && sameDay(new Date(at), day); })
        .sort(function (a, b) { return new Date(calendarDate(a)) - new Date(calendarDate(b)); });

      items.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "cal-item" + (c.status === "published" ? " is-live" : "");
        item.title = c.headline || "";
        if (c.image_url) {
          var img = new Image();
          img.src = c.image_url;
          img.alt = "";
          img.loading = "lazy";
          item.appendChild(img);
        } else {
          var ph = document.createElement("div");
          ph.className = "cal-ph";
          item.appendChild(ph);
        }
        var text = document.createElement("div");
        text.className = "cal-item-text";
        var time = document.createElement("span");
        time.className = "cal-item-time";
        time.textContent = fmtTime(calendarDate(c));
        var ch = document.createElement("span");
        ch.className = "cal-item-ch";
        ch.textContent = c.channel || c.headline || "";
        text.appendChild(time);
        text.appendChild(ch);
        item.appendChild(text);
        cell.appendChild(item);
      });

      if (!items.length) {
        var none = document.createElement("div");
        none.className = "cal-none";
        none.textContent = "—";
        cell.appendChild(none);
      }
      grid.appendChild(cell);
    }
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function shiftWeek(weeks) {
    calStart.setDate(calStart.getDate() + weeks * 7);
    renderCalendar();
  }

  document.getElementById("cal-prev").addEventListener("click", function () { shiftWeek(-1); });
  document.getElementById("cal-next").addEventListener("click", function () { shiftWeek(1); });
  document.getElementById("cal-today").addEventListener("click", function () {
    calStart = startOfWeek(new Date());
    renderCalendar();
  });

  // A made-up week so the page can be seen before anything is approved.
  // Nothing here touches the database.
  function sampleImage(from, to) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/>' +
      '</linearGradient></defs><rect width="80" height="80" fill="url(#g)"/></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function sampleCreatives() {
    var monday = startOfWeek(new Date());
    function at(dayOffset, hour, minute) {
      var d = new Date(monday);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    }
    var now = Date.now();
    var slots = [
      [0, 8, 30, "Instagram", "4:5 post", "Morning rush, sorted.", "#1b2432", "#3a4a63"],
      [1, 12, 15, "Facebook", "1:1 post", "The corner table is free.", "#2a2233", "#57405f"],
      [2, 18, 0, "Instagram", "9:16 story", "Baked at 5am. Gone by noon.", "#20291f", "#3f5a3c"],
      [3, 9, 45, "Google Business", "1:1 post", "Same-day repairs, no appointment.", "#33261f", "#63432f"],
      [4, 17, 30, "Instagram", "4:5 post", "Friday, but make it pastry.", "#1b2432", "#3a4a63"],
      [5, 10, 0, "Facebook", "1:1 post", "Weekend hours: 8 to 2.", "#2a2233", "#57405f"]
    ];
    return slots.map(function (s) {
      var when = at(s[0], s[1], s[2]);
      var live = new Date(when).getTime() < now;
      return {
        status: live ? "published" : "approved",
        scheduled_at: when,
        published_at: live ? when : null,
        channel: s[3],
        format: s[4],
        headline: s[5],
        image_url: sampleImage(s[6], s[7])
      };
    });
  }

  document.getElementById("sample-btn").addEventListener("click", function () {
    var creatives = sampleCreatives();
    noDrops.hidden = true;
    board.hidden = false;
    document.getElementById("sample-notice").hidden = false;
    renderStats(creatives);
    renderScheduled(creatives);
    renderLive(creatives);
    calStart = startOfWeek(new Date());
    calCreatives = creatives;
    renderCalendar();
  });

  LBAuth.ready.then(async function () {
    if (!LBAuth.isLoggedIn()) {
      loading.hidden = true;
      signedOut.hidden = false;
      return;
    }

    var user = LBAuth.getUser();
    var cta = document.getElementById("nav-cta");
    cta.textContent = "Approvals";
    cta.href = "approvals.html";

    var res = await LBAuth.db
      .from("creatives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    loading.hidden = true;

    if (res.error) {
      noDrops.hidden = false;
      noDrops.querySelector("h3").textContent = "Couldn't load your control room.";
      noDrops.querySelector("p").textContent = res.error.message;
      return;
    }

    var creatives = res.data || [];
    if (!creatives.length) {
      noDrops.hidden = false;
      return;
    }

    board.hidden = false;
    renderStats(creatives);
    renderScheduled(creatives);
    renderLive(creatives);
    calCreatives = creatives;
    renderCalendar();
  });
})();
