// Control room — what's scheduled and what's already live. Approvals happen
// on approvals.html; the one thing changed here is when an approved creative
// posts (reschedule.js; the database checks the same limits).
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
    row.className = "cr-row" + (opts.action ? " has-action" : "");

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
    // Its own node, so the Serbian copy can match it whole.
    if (creative.rescheduled_at && creative.status === "approved") {
      var mine = document.createElement("div");
      mine.className = "cr-mine";
      mine.textContent = "Your time";
      main.appendChild(mine);
    }
    row.appendChild(main);

    var chip = document.createElement("div");
    chip.className = "cr-chip " + opts.chipClass;
    chip.textContent = opts.chipLabel;
    row.appendChild(chip);

    if (opts.action) {
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "cr-edit";
      edit.textContent = opts.action;
      edit.setAttribute("aria-expanded", editingId === creative.id ? "true" : "false");
      edit.addEventListener("click", function () {
        editingId = editingId === creative.id ? null : creative.id;
        renderScheduled(allCreatives);
      });
      row.appendChild(edit);
    }

    return row;
  }

  // --- Rescheduling an approved creative (reschedule.js) ---
  // Sample creatives have no id, so they never get the button: nothing to
  // save them to.
  var allCreatives = [];
  var editingId = null;

  function canReschedule(c) { return LBReschedule.canReschedule(c); }

  function closeEditor() {
    editingId = null;
    renderScheduled(allCreatives);
  }

  function buildEditor(c) {
    var form = LBReschedule.form(c, {
      onCancel: closeEditor,
      onSave: function (when) { return saveTime(c, when); }
    });
    form.classList.add("cr-editor");
    return form;
  }

  // Resolves to null once saved, or to a message for the editor to show.
  async function saveTime(c, when) {
    var res = await LBAuth.db
      .from("creatives")
      .update({ scheduled_at: when ? when.toISOString() : null })
      .eq("id", c.id)
      .select()
      .maybeSingle();
    if (res.error || !res.data) {
      return res.error ? LBAuth.friendlyError(res.error).message : "Couldn't save the new time — try again.";
    }
    allCreatives = allCreatives.map(function (x) { return x.id === c.id ? res.data : x; });
    editingId = null;
    // Show the week the creative now sits in.
    if (res.data.scheduled_at) calStart = startOfWeek(new Date(res.data.scheduled_at));
    renderBoard(allCreatives);
    return null;
  }

  function renderBoard(creatives) {
    renderStats(creatives);
    renderScheduled(creatives);
    renderLive(creatives);
    calCreatives = creatives;
    renderCalendar();
  }

  function openEditor(c) {
    editingId = c.id;
    renderScheduled(allCreatives);
    var slot = document.querySelector('[data-creative="' + c.id + '"]');
    if (slot) slot.scrollIntoView({ block: "center", behavior: "smooth" });
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
        list.appendChild(buildSlot(c, { time: "—", muted: true, chipClass: "slot", chipLabel: "APPROVED",
          action: canReschedule(c) ? "Pick a time" : null }));
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
      list.appendChild(buildSlot(c, { time: fmtTime(c.scheduled_at), chipClass: "slot", chipLabel: "SCHEDULED",
        action: canReschedule(c) ? "Change time" : null }));
    });
  }

  // A scheduled row, with the time editor under it while it's open.
  function buildSlot(c, opts) {
    var slot = document.createElement("div");
    slot.className = "cr-slot";
    if (c.id) slot.setAttribute("data-creative", c.id);
    slot.appendChild(buildRow(c, opts));
    if (opts.action && editingId === c.id) slot.appendChild(buildEditor(c));
    return slot;
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
        var editable = canReschedule(c);
        // A scheduled item opens its time editor in the list below.
        var item = document.createElement(editable ? "button" : "div");
        item.className = "cal-item" + (c.status === "published" ? " is-live" : "") + (editable ? " is-editable" : "");
        item.title = c.headline || "";
        if (editable) {
          item.type = "button";
          item.addEventListener("click", function () { openEditor(c); });
        }
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

  function showSample() {
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
  }

  document.getElementById("sample-btn").addEventListener("click", showSample);

  // --- First-visit tour (tour.js) ---
  // A new account has nothing scheduled yet, so the tour borrows the sample
  // week to have something to point at, and puts the empty page back after.
  var tourSample = false;
  var TOUR = {
    id: "control_room",
    setup: function () {
      tourSample = board.hidden;
      if (tourSample) showSample();
    },
    teardown: function () {
      if (!tourSample) return;
      tourSample = false;
      board.hidden = true;
      document.getElementById("sample-notice").hidden = true;
      noDrops.hidden = false;
    },
    steps: [
      { welcome: true, next: "Show me around",
        title: function () {
          var name = (LBAuth.getProfile() || {}).business_name;
          return name ? ["Welcome, ", { em: name }, "."] : ["Welcome to your ", { em: "control room" }, "."];
        },
        body: "Four quick stops: what's going out, what's already live, what's waiting on you, and how to make every ad more yours." },
      { target: ".cr-stats",
        title: "Your ads at a glance",
        body: "How many ads are scheduled to post, how many are already out, and how many are waiting for your yes." },
      { target: function () { return document.querySelectorAll(".cr-stat")[2]; },
        title: "Nothing goes out without you",
        body: "Every ad the engine makes lands in Approvals first. When something is waiting, this number tells you — one click takes you there." },
      { target: "#calendar-wrap",
        title: "Your posting calendar",
        body: "Each ad sits on the day and time it posts — blue is scheduled, green is already live. Click a blue one to change when it posts." },
      { target: "#engine-help",
        title: "Make every ad look like you",
        body: "All optional, but everything you add here goes straight into your next drop — your photos, your colors, your offers, what sets you apart. Start with the step worth the most." }
    ]
  };

  // --- Profile strength: things the customer can tell the engine ---
  // None of them gate anything. Each one is a profile column the customer may
  // edit; the database stamps next_week_note_at whenever that note changes.
  // Weights add up to 100 and follow how much each answer changes the ads.
  // Channels are edited on the account page, so that row links there instead
  // of opening a form. The rows with an asset are files the customer uploads
  // (brand-assets.js) rather than a profile column.
  var EXTRAS = [
    { key: "differentiator", weight: 20, title: "What makes you different", max: 1000, multiline: true,
      why: "Gives every ad a reason to pick you over the place down the street.",
      placeholder: "e.g. Everything's made from scratch, third-generation family recipes, open from 6am" },
    { key: "photos", asset: "photos", weight: 20, title: "Photos of your place and what you sell",
      why: "Ads built from your real food, shelves and team, so customers find what they saw when they walk in.",
      hint: "Phone photos are fine. Only upload photos you own, and ask before showing a customer's face." },
    { key: "next_week_note", weight: 15, title: "What's happening next week?", max: 1000, multiline: true,
      why: "A sale, a new product, holiday hours, an event — the engine builds next week's ads around it.",
      placeholder: "e.g. 20% off all coffee Mon–Wed, closed Friday for the holiday, new pumpkin pastry from Tuesday" },
    { key: "logo", asset: "logo", weight: 10, title: "Your logo",
      why: "Goes on your ads, so people know straight away who they're from.",
      hint: "A PNG with a transparent background works best." },
    { key: "brand_colors", weight: 10, title: "Your brand colors", max: 200,
      why: "Keeps the images in your colors, so people recognise you before they read a word.",
      placeholder: "e.g. Deep green and cream, with gold accents" },
    { key: "avoid_notes", weight: 10, title: "Anything to avoid", max: 1000, multiline: true,
      why: "Things that should never show up in your ads — the engine steers clear of them.",
      placeholder: "e.g. No jokes about prices, never show the back kitchen" },
    { key: "website", weight: 5, title: "Website or Instagram", max: 300,
      why: "Shows the engine how you already present yourself, so new ads match it.",
      placeholder: "e.g. @milenasbakery or milenas.rs" },
    { key: "menu", asset: "menu", weight: 5, title: "Your menu or price list",
      why: "Real products and prices, so an ad never offers something you don't sell.",
      hint: "A photo of the menu or a PDF, up to three pages." },
    { key: "channels", weight: 5, title: "Where your ads go", link: "account.html",
      why: "Pick at least one channel so every drop has somewhere to publish." }
  ];
  // Uploaded files by kind, filled in at boot. Until then (or if Storage can't
  // be reached) every kind reads as empty.
  var assets = { logo: [], photos: [], menu: [] };
  var thumbUrls = {};
  // A message to show in an upload form once it re-renders: { key, text, bad }.
  var assetMessage = null;
  // A weekly note only counts while it is about the week ahead.
  var NOTE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
  var openExtra = null;
  var completeOpen = false;

  function extraValue(x, profile) {
    if (x.asset) {
      var files = assets[x.asset];
      if (!files.length) return "";
      if (x.asset === "photos") return files.length === 1 ? "1 photo" : files.length + " photos";
      return files.map(function (f) { return f.name; }).join(", ");
    }
    var v = profile[x.key];
    if (Array.isArray(v)) return v.join(", ");
    return v || "";
  }

  // "done", "stale" (a weekly note that has gone out of date) or "missing".
  function extraState(x, profile) {
    if (!extraValue(x, profile)) return "missing";
    if (x.key === "next_week_note") {
      var at = profile.next_week_note_at ? new Date(profile.next_week_note_at).getTime() : 0;
      if (!at || Date.now() - at > NOTE_FRESH_MS) return "stale";
    }
    return "done";
  }

  function shortDate(iso) {
    return new Date(iso).toLocaleDateString((window.LBLang ? LBLang.locale() : "en-US"), { month: "short", day: "numeric" });
  }

  function renderScore(profile) {
    var card = document.getElementById("engine-help");
    var score = 0;
    var next = null;
    EXTRAS.forEach(function (x) {
      if (extraState(x, profile) === "done") score += x.weight;
      else if (!next || x.weight > next.weight) next = x;
    });
    var complete = score >= 100;

    document.getElementById("eh-pct").textContent = score + "%";
    document.getElementById("eh-level").textContent =
      score >= 80 ? "EXCELLENT" : score >= 40 ? "GOOD" : "BASIC";
    document.getElementById("eh-ring").style.strokeDashoffset = (169.65 * (1 - score / 100)).toFixed(2);
    card.classList.toggle("is-complete", complete);

    var nextBtn = document.getElementById("eh-next");
    nextBtn.hidden = !next;
    if (next) {
      document.getElementById("eh-next-title").textContent =
        extraState(next, profile) === "stale" ? "Refresh your note for next week" : next.title;
      document.getElementById("eh-next-gain").textContent = "+" + next.weight + "%";
      nextBtn.onclick = function () {
        if (next.link) { location.href = next.link; return; }
        openExtra = next.key;
        renderExtras();
        var row = document.querySelector('[data-extra="' + next.key + '"]');
        if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
    }

    // At 100% the list folds away behind one line, so a finished profile
    // doesn't keep taking up the top of the page.
    document.getElementById("eh-complete").hidden = !complete;
    var toggle = document.getElementById("eh-complete-toggle");
    toggle.textContent = completeOpen ? "Hide answers" : "Review answers";
    toggle.setAttribute("aria-expanded", completeOpen ? "true" : "false");
    document.getElementById("eh-list").hidden = complete && !completeOpen;
  }

  document.getElementById("eh-complete-toggle").addEventListener("click", function () {
    completeOpen = !completeOpen;
    renderExtras();
  });

  function renderExtras() {
    var profile = LBAuth.getProfile() || {};
    var list = document.getElementById("eh-list");
    list.innerHTML = "";
    renderScore(profile);

    EXTRAS.forEach(function (x) {
      var value = extraValue(x, profile);
      var state = extraState(x, profile);
      var open = openExtra === x.key;
      var item = document.createElement("div");
      item.className = "eh-item" + (state === "done" ? " is-done" : state === "stale" ? " is-stale" : "");
      item.setAttribute("data-extra", x.key);

      var toggle;
      if (x.link) {
        toggle = document.createElement("a");
        toggle.href = x.link;
      } else {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      }
      toggle.className = "eh-toggle";

      var dot = document.createElement("span");
      dot.className = "eh-dot";
      dot.setAttribute("aria-hidden", "true");
      dot.textContent = state === "stale" ? "!" : "✓";

      var text = document.createElement("span");
      text.className = "eh-text";
      var title = document.createElement("span");
      title.className = "eh-title";
      title.textContent = x.title;
      var why = document.createElement("span");
      why.className = "eh-why";
      why.textContent = state === "stale"
        ? (profile.next_week_note_at
            ? "Out of date — last changed " + shortDate(profile.next_week_note_at) + ". A fresh note keeps next week's ads current."
            : "Out of date. A fresh note keeps next week's ads current.")
        : x.why;
      text.appendChild(title);
      text.appendChild(why);
      if (value && !open) {
        var shown = document.createElement("span");
        shown.className = "eh-value";
        shown.textContent = value;
        text.appendChild(shown);
      }

      toggle.appendChild(dot);
      toggle.appendChild(text);

      if (state !== "done") {
        var weight = document.createElement("span");
        weight.className = "eh-weight";
        weight.textContent = "+" + x.weight + "%";
        toggle.appendChild(weight);
      }

      var action = document.createElement("span");
      action.className = "eh-action";
      action.textContent = x.link ? "Change in account"
        : open ? "Close" : state === "stale" ? "Update" : value ? "Edit" : "Add";
      toggle.appendChild(action);

      if (!x.link) {
        toggle.addEventListener("click", function () {
          openExtra = open ? null : x.key;
          renderExtras();
        });
      }
      item.appendChild(toggle);

      if (open) item.appendChild(x.asset ? buildAssetForm(x) : buildExtraForm(x, value, profile));
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

  // The open row for an upload: what's there already, with a way to remove
  // each one, and a button to add more up to the kind's limit.
  function buildAssetForm(x) {
    var spec = LBBrand.KINDS[x.asset];
    var files = assets[x.asset];
    var box = document.createElement("div");
    box.className = "eh-form";

    if (files.length) {
      var grid = document.createElement("div");
      grid.className = "eh-thumbs";
      files.forEach(function (f) {
        var tile = document.createElement("div");
        tile.className = "eh-thumb" + (f.isPdf ? " is-doc" : "");
        if (f.isPdf) {
          var doc = document.createElement("span");
          doc.className = "eh-doc";
          var tag = document.createElement("b");
          tag.textContent = "PDF";
          var name = document.createElement("span");
          name.textContent = f.name;
          doc.appendChild(tag);
          doc.appendChild(name);
          tile.appendChild(doc);
        } else {
          var img = document.createElement("img");
          img.alt = f.name;
          img.dataset.path = f.path;
          if (thumbUrls[f.path]) img.src = thumbUrls[f.path];
          tile.appendChild(img);
        }
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "eh-thumb-rm";
        rm.textContent = "✕";
        rm.title = "Remove";
        rm.setAttribute("aria-label", "Remove " + f.name);
        rm.addEventListener("click", function () { removeAsset(x, f, box); });
        tile.appendChild(rm);
        grid.appendChild(tile);
      });
      box.appendChild(grid);
      loadThumbs(grid, files);
    }

    var row = document.createElement("div");
    row.className = "eh-form-row";
    var input = document.createElement("input");
    input.type = "file";
    input.accept = LBBrand.accept(x.asset);
    input.multiple = spec.max > 1;
    input.hidden = true;
    input.addEventListener("change", function () {
      var picked = Array.prototype.slice.call(input.files || []);
      input.value = "";
      if (picked.length) uploadAssets(x, picked, box);
    });
    row.appendChild(input);

    // A full logo slot is swapped rather than added to.
    var replacing = spec.max === 1 && files.length === 1;
    if (files.length < spec.max || replacing) {
      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "btn-ghost";
      pick.textContent = replacing ? "Replace" : files.length ? "Add more" : "Upload";
      pick.addEventListener("click", function () { input.click(); });
      row.appendChild(pick);
      setTimeout(function () { pick.focus(); }, 0);
    }
    if (spec.max > 1) {
      var meta = document.createElement("span");
      meta.className = "eh-meta";
      meta.textContent = files.length + " of " + spec.max;
      row.appendChild(meta);
    }
    box.appendChild(row);

    var hint = document.createElement("p");
    hint.className = "eh-hint";
    hint.textContent = x.hint;
    box.appendChild(hint);

    var notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    if (assetMessage && assetMessage.key === x.key) {
      notice.hidden = false;
      notice.textContent = assetMessage.text;
      notice.style.color = assetMessage.bad ? "#f0a8a8" : "";
      assetMessage = null;
    }
    box.appendChild(notice);

    box.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { openExtra = null; renderExtras(); }
    });
    return box;
  }

  // Private files need signed links; fetch the ones not seen yet, then fill
  // in every thumbnail still waiting for its picture.
  async function loadThumbs(grid, files) {
    var missing = files.filter(function (f) { return !f.isPdf && !thumbUrls[f.path]; })
      .map(function (f) { return f.path; });
    if (missing.length) {
      try {
        var urls = await LBBrand.signedUrls(missing);
        Object.keys(urls).forEach(function (p) { thumbUrls[p] = urls[p]; });
      } catch (e) { return; }
    }
    Array.prototype.forEach.call(grid.querySelectorAll("img[data-path]"), function (img) {
      if (!img.src && thumbUrls[img.dataset.path]) img.src = thumbUrls[img.dataset.path];
    });
  }

  function setBusy(box, text) {
    Array.prototype.forEach.call(box.querySelectorAll("button"), function (b) { b.disabled = true; });
    var notice = box.querySelector(".notice");
    notice.hidden = false;
    notice.style.color = "";
    notice.textContent = text;
  }

  async function refreshAssets(kind) {
    try { assets[kind] = await LBBrand.list(kind); } catch (e) {}
  }

  async function uploadAssets(x, picked, box) {
    var spec = LBBrand.KINDS[x.asset];
    var replacing = spec.max === 1 ? assets[x.asset].slice() : [];
    var held = assets[x.asset].length - replacing.length;
    // More than fit: send what fits and say what was left out.
    var toSend = picked.slice(0, spec.max - held);
    var skipped = picked.length - toSend.length;
    var done = 0;
    var failure = null;
    setBusy(box, "Uploading…");
    try {
      toSend.forEach(function (file, i) { LBBrand.check(x.asset, file, held + i); });
      // The old logo goes first: the bucket only ever holds one.
      if (replacing.length) await LBBrand.remove(replacing.map(function (f) { return f.path; }));
      for (var i = 0; i < toSend.length; i++) {
        await LBBrand.upload(x.asset, toSend[i]);
        done++;
      }
    } catch (err) {
      failure = done ? "Uploaded " + done + " of " + toSend.length + ". " + err.message : err.message;
    }
    if (!failure && skipped) {
      failure = "You can keep up to " + spec.max + " here, so " + skipped + " weren't uploaded.";
    }
    await refreshAssets(x.asset);
    openExtra = x.key;
    assetMessage = failure ? { key: x.key, bad: true, text: failure } : null;
    renderExtras();
  }

  async function removeAsset(x, file, box) {
    setBusy(box, "Removing…");
    try {
      await LBBrand.remove([file.path]);
    } catch (err) {
      assetMessage = { key: x.key, bad: true, text: err.message };
    }
    delete thumbUrls[file.path];
    await refreshAssets(x.asset);
    openExtra = x.key;
    renderExtras();
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

    // Signed in but signup stopped halfway — say what's missing and link
    // straight to it, instead of leaving an empty control room to guess at.
    var step = LBAuth.unfinishedStep();
    if ((LBAuth.getProfile() || {}).subscription_status === "past_due") {
      var tag = document.getElementById("finish-notice-tag");
      tag.textContent = "PAYMENT FAILED";
      tag.style.color = "#f0a8a8";
      document.getElementById("finish-notice-text").textContent =
        "Your last payment didn't go through — update your card to keep your weekly drop.";
      var fix = document.getElementById("finish-notice-link");
      fix.href = "account.html#billing";
      fix.textContent = "Update card →";
      document.getElementById("finish-notice").hidden = false;
    } else if (step) {
      var planName = { counter: "Counter", storefront: "Storefront", franchise: "Franchise" }[(LBAuth.getProfile() || {}).plan];
      document.getElementById("finish-notice-text").textContent = LBAuth.hasBrief() && planName
        ? "Your " + planName + " plan hasn't started yet — add a card to start it."
        : "Your business brief isn't done yet — the engine needs it before it can make your ads.";
      document.getElementById("finish-notice-link").href = step;
      document.getElementById("finish-notice").hidden = false;
    }

    document.getElementById("engine-help").hidden = false;
    renderExtras();

    // Uploaded files only add to the score, so the board doesn't wait on them.
    // Rebuilding the list would wipe an answer someone is typing, so with a
    // row open only the score catches up.
    LBBrand.listAll().then(function (all) {
      assets = all;
      if (openExtra) renderScore(LBAuth.getProfile() || {});
      else renderExtras();
    }, function () {});

    var res = await LBAuth.db
      .from("creatives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    loading.hidden = true;

    if (res.error) {
      noDrops.hidden = false;
      noDrops.querySelector("h3").textContent = "Couldn't load your control room.";
      noDrops.querySelector("p").textContent = LBAuth.friendlyError(res.error).message;
      return;
    }

    var creatives = res.data || [];
    if (!creatives.length) {
      noDrops.hidden = false;
    } else {
      board.hidden = false;
      allCreatives = creatives;
      renderBoard(creatives);
    }

    LBTour.replayButton(TOUR);
    LBTour.auto(TOUR);
  });
})();
