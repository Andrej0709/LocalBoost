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

  // --- Optional extras: things the customer can tell the engine ---
  // None of them gate anything. Each one is a profile column the customer may
  // edit; the database stamps next_week_note_at whenever that note changes.
  var EXTRAS = [
    { key: "next_week_note", title: "What's happening next week?", max: 1000, multiline: true,
      why: "A sale, a new product, holiday hours, an event — the engine builds next week's ads around it.",
      placeholder: "e.g. 20% off all coffee Mon–Wed, closed Friday for the holiday, new pumpkin pastry from Tuesday" },
    { key: "differentiator", title: "What makes you different", max: 1000, multiline: true,
      why: "Gives every ad a reason to pick you over the place down the street.",
      placeholder: "e.g. Everything's made from scratch, third-generation family recipes, open from 6am" },
    { key: "brand_colors", title: "Your brand colors", max: 200,
      why: "Keeps the images in your colors, so people recognise you before they read a word.",
      placeholder: "e.g. Deep green and cream, with gold accents" },
    { key: "website", title: "Website or Instagram", max: 300,
      why: "Shows the engine how you already present yourself, so new ads match it.",
      placeholder: "e.g. @milenasbakery or milenas.rs" },
    { key: "avoid_notes", title: "Anything to avoid", max: 1000, multiline: true,
      why: "Things that should never show up in your ads — the engine steers clear of them.",
      placeholder: "e.g. No jokes about prices, never show the back kitchen" }
  ];
  var openExtra = null;

  function renderExtras() {
    var profile = LBAuth.getProfile() || {};
    var list = document.getElementById("eh-list");
    list.innerHTML = "";

    var done = EXTRAS.filter(function (x) { return profile[x.key]; }).length;
    document.getElementById("eh-count").textContent = done + " OF " + EXTRAS.length + " ADDED";
    document.getElementById("eh-bar").style.width = Math.round(done / EXTRAS.length * 100) + "%";

    EXTRAS.forEach(function (x) {
      var value = profile[x.key] || "";
      var open = openExtra === x.key;
      var item = document.createElement("div");
      item.className = "eh-item" + (value ? " is-done" : "");

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "eh-toggle";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");

      var dot = document.createElement("span");
      dot.className = "eh-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.textContent = "✓";

      var text = document.createElement("span");
      text.className = "eh-text";
      var title = document.createElement("span");
      title.className = "eh-title";
      title.textContent = x.title;
      var why = document.createElement("span");
      why.className = "eh-why";
      why.textContent = x.why;
      text.appendChild(title);
      text.appendChild(why);
      if (value && !open) {
        var shown = document.createElement("span");
        shown.className = "eh-value";
        shown.textContent = value;
        text.appendChild(shown);
      }

      var action = document.createElement("span");
      action.className = "eh-action";
      action.textContent = open ? "Close" : value ? "Edit" : "Add";

      toggle.appendChild(dot);
      toggle.appendChild(text);
      toggle.appendChild(action);
      toggle.addEventListener("click", function () {
        openExtra = open ? null : x.key;
        renderExtras();
      });
      item.appendChild(toggle);

      if (open) item.appendChild(buildExtraForm(x, value, profile));
      list.appendChild(item);
    });
  }

  function buildExtraForm(x, value, profile) {
    var form = document.createElement("form");
    form.className = "eh-form";

    var field = document.createElement(x.multiline ? "textarea" : "input");
    if (x.multiline) field.rows = 3; else field.type = "text";
    field.maxLength = x.max;
    field.placeholder = x.placeholder;
    field.setAttribute("aria-label", x.title);
    field.value = value;
    form.appendChild(field);

    var row = document.createElement("div");
    row.className = "eh-form-row";
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "btn-ghost";
    save.textContent = "Save";
    row.appendChild(save);

    if (value) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "eh-plain";
      clear.textContent = "Clear";
      clear.addEventListener("click", function () { saveExtra(x.key, null, form); });
      row.appendChild(clear);
    }

    if (x.key === "next_week_note" && profile.next_week_note_at) {
      var meta = document.createElement("span");
      meta.className = "eh-meta";
      meta.textContent = "Updated " + new Date(profile.next_week_note_at)
        .toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), { month: "short", day: "numeric" });
      row.appendChild(meta);
    }
    form.appendChild(row);

    var notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    form.appendChild(notice);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveExtra(x.key, field.value.trim() || null, form);
    });
    form.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { openExtra = null; renderExtras(); }
    });
    setTimeout(function () { field.focus(); }, 0);
    return form;
  }

  async function saveExtra(key, value, form) {
    var buttons = form.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    try {
      var patch = {};
      patch[key] = value;
      await LBAuth.updateProfile(patch);
      openExtra = null;
      renderExtras();
    } catch (err) {
      Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
      var notice = form.querySelector(".notice");
      notice.hidden = false;
      notice.textContent = err.message;
      notice.style.color = "#f0a8a8";
    }
  }

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

    document.getElementById("engine-help").hidden = false;
    renderExtras();

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
