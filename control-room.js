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
    // Saved by whoever posted it (the portal's Ads tab).
    if (creative.status === "published" && /^https?:\/\//i.test(creative.post_url || "")) {
      var post = document.createElement("a");
      post.className = "cr-post-link";
      post.href = creative.post_url;
      post.target = "_blank";
      post.rel = "noopener noreferrer";
      post.textContent = "See the post →";
      main.appendChild(post);
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
  // The closed-days card (closed-days.js), once mounted.
  var closedCard = null;

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
    if (closedCard) closedCard.render();
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

      // A day the customer marked closed (closed-days.js). Not in the demo:
      // the made-up café is open all week.
      var closed = !LBDemo.on && window.LBClosed ? LBClosed.closedOn(day) : null;
      var cell = document.createElement("div");
      cell.className = "cal-day" +
        (sameDay(day, today) ? " is-today" : day < startOfDay(today) ? " is-past" : "") +
        (closed ? " is-closed" : "");
      var label = document.createElement("div");
      label.className = "cal-date";
      label.textContent = day.toLocaleDateString(locale, { weekday: "short", day: "numeric" }).toUpperCase();
      cell.appendChild(label);
      if (closed) {
        var shut = document.createElement("div");
        shut.className = "cal-closed";
        shut.textContent = closed.note || "Closed";
        cell.appendChild(shut);
      }

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

      if (!items.length && !closed) {
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

  // --- "Add to my calendar": the ads still to post as an .ics file ---
  // Opens in Google, Apple or Outlook calendar on any phone or computer. Each
  // ad is a 15-minute event at its posting time, with a link to the control
  // room; the closed days go in as all-day events. A file is a snapshot: a
  // time changed later means downloading it again.
  function icsEscape(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  function icsStamp(d) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  function icsDay(s) { return s.replace(/-/g, ""); }
  // Lines over 75 octets fold onto the next with a leading space.
  function icsFold(line) {
    var out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); }
    out.push(line);
    return out.join("\r\n");
  }

  function calendarFile(creatives) {
    var t = window.LBLang ? LBLang.t : function (x) { return x; };
    var now = icsStamp(new Date());
    var link = location.origin + "/control-room.html";
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Adronis//Posting calendar//EN", "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Adronis"];
    var ads = creatives.filter(function (c) {
      return c.id && c.status === "approved" && c.scheduled_at && new Date(c.scheduled_at) > new Date();
    });
    ads.forEach(function (c) {
      var start = new Date(c.scheduled_at);
      lines.push("BEGIN:VEVENT", "UID:" + c.id + "@adronis", "DTSTAMP:" + now,
        "DTSTART:" + icsStamp(start), "DTEND:" + icsStamp(new Date(start.getTime() + 15 * 60000)),
        icsFold("SUMMARY:" + icsEscape(t("Ad goes out") + " · " + (c.channel || "Adronis"))),
        icsFold("DESCRIPTION:" + icsEscape((c.headline || "") + "\n" + link)),
        "URL:" + link, "END:VEVENT");
    });
    (window.LBClosed ? LBClosed.list() : []).forEach(function (r, i) {
      var end = new Date(r.to.replace(/-/g, "/"));
      end.setDate(end.getDate() + 1);
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      lines.push("BEGIN:VEVENT", "UID:closed-" + r.from + "-" + i + "@adronis", "DTSTAMP:" + now,
        "DTSTART;VALUE=DATE:" + icsDay(r.from),
        "DTEND;VALUE=DATE:" + end.getFullYear() + pad(end.getMonth() + 1) + pad(end.getDate()),
        icsFold("SUMMARY:" + icsEscape(t("Closed — no ads") + (r.note ? " · " + r.note : ""))),
        "TRANSP:TRANSPARENT", "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return { text: lines.join("\r\n") + "\r\n", count: ads.length };
  }

  document.getElementById("cal-export").addEventListener("click", function () {
    var msg = document.getElementById("cal-export-msg");
    var file = calendarFile(allCreatives);
    msg.hidden = false;
    if (!file.count) {
      msg.textContent = "Nothing is scheduled to post yet. Approve some ads, then come back.";
      return;
    }
    var url = URL.createObjectURL(new Blob([file.text], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "adronis-posts.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    msg.textContent = file.count === 1
      ? "Downloaded 1 ad. Open the file to add it to your calendar."
      : "Downloaded " + file.count + " ads. Open the file to add them to your calendar.";
  });

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

  // --- What we've learned from you ---
  // The customer's own feedback, given back to them: why they rejected ads,
  // the text they rewrote, what they asked us to avoid. It is what the engine
  // reads for their next drops, and seeing it is what keeps them giving it.
  // Shown once they've rejected an ad with a reason or rewritten one.
  // Mirrors REASONS in approvals.html - the same labels.
  var REASON_LABELS = {
    image: "Image doesn't fit",
    tone: "Wrong tone",
    facts: "Wrong facts or price",
    timing: "Wrong timing",
    other: "Something else"
  };

  function learnedItem(label) {
    var item = document.createElement("div");
    item.className = "learned-item";
    var head = document.createElement("div");
    head.className = "learned-label";
    head.textContent = label;
    item.appendChild(head);
    return item;
  }

  function renderLearned(creatives, profile) {
    var rejected = creatives.filter(function (c) { return c.status === "rejected" && c.reject_reason; });
    var edited = creatives.filter(function (c) { return c.edited_at; })
      .sort(function (a, b) { return new Date(b.edited_at) - new Date(a.edited_at); });
    var answered = creatives.filter(function (c) { return c.outcome; });
    var loved = creatives.filter(function (c) { return c.loved; })
      .sort(function (a, b) { return new Date(b.loved_at || 0) - new Date(a.loved_at || 0); });
    var box = document.getElementById("learned");
    var grid = document.getElementById("learned-grid");
    grid.innerHTML = "";
    box.hidden = !rejected.length && !edited.length && !answered.length && !loved.length;
    if (box.hidden) return;

    // The ads they put a heart on in Approvals: what the engine leans towards.
    if (loved.length) {
      var hearts = learnedItem("ADS YOU LOVED");
      var lovedCount = document.createElement("p");
      lovedCount.className = "learned-text";
      lovedCount.textContent = loved.length === 1
        ? "1 ad — your next ones lean towards it."
        : loved.length + " ads — your next ones lean towards them.";
      hearts.appendChild(lovedCount);
      loved.slice(0, 3).forEach(function (c) {
        if (!c.headline) return;
        var line = document.createElement("p");
        line.className = "learned-quote";
        line.textContent = "“" + c.headline + "”";
        hearts.appendChild(line);
      });
      grid.appendChild(hearts);
    }

    // Their answers to "did it bring anyone in?" (the card at the top).
    if (answered.length) {
      var brought = learnedItem("WHAT BROUGHT PEOPLE IN");
      var told = document.createElement("p");
      told.className = "learned-text";
      told.textContent = answered.filter(function (c) { return c.outcome === "yes"; }).length + " of " +
        answered.length + " ads you answered about brought people in.";
      brought.appendChild(told);
      grid.appendChild(brought);
    }

    if (rejected.length) {
      var item = learnedItem("WHY YOU TURNED ADS DOWN");
      var chips = document.createElement("div");
      chips.className = "learned-chips";
      var counts = {};
      rejected.forEach(function (c) { counts[c.reject_reason] = (counts[c.reject_reason] || 0) + 1; });
      Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (key) {
        var chip = document.createElement("span");
        chip.className = "learned-chip";
        var label = document.createElement("span");
        label.textContent = REASON_LABELS[key] || key;
        var n = document.createElement("b");
        n.textContent = counts[key];
        chip.appendChild(label);
        chip.appendChild(n);
        chips.appendChild(chip);
      });
      item.appendChild(chips);
      // The last thing they wrote in their own words, if anything.
      var said = rejected.filter(function (c) { return c.reject_note; })
        .sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); })[0];
      if (said) {
        var quote = document.createElement("p");
        quote.className = "learned-quote";
        quote.textContent = "“" + said.reject_note + "”";
        item.appendChild(quote);
      }
      grid.appendChild(item);
    }

    if (edited.length) {
      var ed = learnedItem("TEXT YOU REWROTE");
      edited.filter(function (c) {
        return c.original_headline && c.headline && c.original_headline !== c.headline;
      }).slice(0, 2).forEach(function (c) {
        var line = document.createElement("p");
        line.className = "learned-edit";
        var was = document.createElement("s");
        was.textContent = c.original_headline;
        var now = document.createElement("span");
        now.textContent = c.headline;
        line.appendChild(was);
        line.appendChild(now);
        ed.appendChild(line);
      });
      if (ed.children.length === 1) {
        // Only captions changed: say how many, rather than quote a whole caption.
        var count = document.createElement("p");
        count.className = "learned-text";
        count.textContent = edited.length === 1 ? "1 ad" : edited.length + " ads";
        ed.appendChild(count);
      }
      grid.appendChild(ed);
    }

    var avoidTags = avoidTagLabels(profile);
    if (profile.avoid_notes || avoidTags.length) {
      var avoid = learnedItem("WHAT TO STAY AWAY FROM");
      if (avoidTags.length) {
        var tagChips = document.createElement("div");
        tagChips.className = "learned-chips";
        avoidTags.forEach(function (label) {
          var chip = document.createElement("span");
          chip.className = "learned-chip";
          chip.textContent = label;
          tagChips.appendChild(chip);
        });
        avoid.appendChild(tagChips);
      }
      if (profile.avoid_notes) {
        var text = document.createElement("p");
        text.className = "learned-text";
        if (avoidTags.length) text.style.marginTop = "10px";
        text.textContent = profile.avoid_notes;
        avoid.appendChild(text);
      }
      grid.appendChild(avoid);
    }
  }

  // --- Cards at the top of the page ---
  // One thing each to answer or close: a note from the Adronis team (the
  // updates table, written from the portal), "did this ad bring anyone in?"
  // for an ad that went out a couple of days ago (creatives.outcome), and a
  // date coming up that's worth an ad (dates-rs.js), offered for the weekly
  // note. Their words are in both languages here, so a language switch just
  // draws them again. In the public demo they work on the made-up week and
  // save nothing.
  var cards = {
    on: false,
    demo: false,
    creatives: [],     // the demo's week; a real account reads allCreatives
    updates: [],
    answered: {},      // outcome answers given on this visit, by ad
    thanks: null,      // the answer just given, while its thank-you shows
    dateAdded: null,   // a date just put in the weekly note
    rating: undefined, // their stars (ratings table): undefined until loaded, null for none
    draft: { stars: 0, comment: "", publish: false },
    rated: false,      // the thank-you after rating, until the page is left
    referrals: null,   // { signed_up, in_beta } through their invite link
    events: []         // local_events rows from the portal, upcoming ones
  };
  var DISMISSED_KEY = "lb-cr-dismissed";

  function T(en, srText) {
    return window.LBLang && LBLang.get() === "sr" ? srText : en;
  }

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(cls, text, onClick) {
    var b = make("button", cls, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  // The demo's cards are closed for this visit only: the same phone shows
  // the demo to the next owner too.
  var demoClosed = [];

  function dismissed() {
    if (cards.demo) return demoClosed;
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch (e) { return []; }
  }

  function dismiss(id) {
    if (cards.demo) { demoClosed.push(id); return; }
    try {
      var list = dismissed();
      if (list.indexOf(id) === -1) list.push(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(list.slice(-200)));
    } catch (e) {}
  }

  function card(tag, accent) {
    var box = make("section", "crc" + (accent ? " is-acc" : ""));
    var body = make("div", "crc-body");
    body.appendChild(make("div", "crc-tag", tag));
    box.appendChild(body);
    return { box: box, body: body };
  }

  function renderCards() {
    if (!cards.on) return;
    var host = document.getElementById("cr-cards");
    host.innerHTML = "";
    [noteCard(), newsCard(), outcomeCard(), ratingCard(), reportCard(), dateCard(), inviteCard()]
      .forEach(function (c) { if (c) host.appendChild(c); });
  }

  // "Later" on a card hides it for a while rather than for good.
  function snoozed(key, days) {
    try { return Date.now() - Number(localStorage.getItem("lb-cr-later-" + key) || 0) < days * 86400000; }
    catch (e) { return false; }
  }

  function snooze(key) {
    try { localStorage.setItem("lb-cr-later-" + key, String(Date.now())); } catch (e) {}
    renderCards();
  }

  // How long ago their first ad arrived, in days (0 with none yet).
  function daysWithAds() {
    var first = allCreatives.reduce(function (min, c) {
      var t = new Date(c.created_at).getTime();
      return !min || t < min ? t : min;
    }, 0);
    return first ? Math.floor((Date.now() - first) / 86400000) : 0;
  }

  // --- "Would you recommend Adronis?" (the ratings table) ---
  // Asked after three weeks of ads, and again six months after the last
  // answer - in the beta and after it: stars, a sentence, and whether we
  // may publish it with the business's name. "Later" asks again in a week.
  var RATE_AGAIN_DAYS = 182;

  function ratingDue() {
    if (cards.rating === undefined || daysWithAds() < 21 || snoozed("rate", 7)) return false;
    return !cards.rating || Date.now() - new Date(cards.rating.created_at) > RATE_AGAIN_DAYS * 86400000;
  }

  function ratingCard() {
    if (cards.demo) return null;
    if (cards.rated) {
      var done = card(T("THANK YOU", "HVALA"), true);
      done.body.appendChild(make("p", "crc-done", cards.rating && cards.rating.stars >= 4
        ? T("Thank you — that means a lot to a small team. If you know an owner it would help, your invite link is just below.",
            "Hvala ti — malom timu to puno znači. Ako znaš vlasnika kome bi ovo koristilo, tvoj link za preporuku je odmah ispod.")
        : T("Thank you for being straight with us. We read every answer, and we'll get in touch about what to fix.",
            "Hvala što si iskren. Čitamo svaki odgovor i javićemo ti se oko toga šta da popravimo.")));
      return done.box;
    }
    if (!ratingDue()) return null;

    var d = cards.draft;
    var c = card(cards.rating ? T("HOW ARE WE DOING?", "KAKO NAM IDE?") : T("THREE WEEKS IN", "TRI NEDELJE KASNIJE"), true);
    c.body.appendChild(make("div", "crc-title", T("Would you recommend Adronis to another owner?",
      "Da li bi preporučio Adronis drugom vlasniku?")));
    var stars = make("div", "crc-stars");
    stars.setAttribute("role", "radiogroup");
    stars.setAttribute("aria-label", T("Your rating", "Tvoja ocena"));
    [1, 2, 3, 4, 5].forEach(function (n) {
      var s = button("crc-star" + (n <= d.stars ? " is-on" : ""), "", function () {
        d.stars = n;
        renderCards();
      });
      s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.9l2.8 5.7 6.3.9-4.55 4.45 1.07 6.27L12 17.25l-5.62 2.97 1.07-6.27L2.9 9.5l6.3-.9z"/></svg>';
      s.setAttribute("role", "radio");
      s.setAttribute("aria-checked", n === d.stars ? "true" : "false");
      s.setAttribute("aria-label", n + " / 5");
      stars.appendChild(s);
    });
    c.body.appendChild(stars);

    var text = make("textarea", "crc-field");
    text.rows = 2;
    text.maxLength = 500;
    text.value = d.comment;
    text.placeholder = T("One sentence you'd say to another owner (optional)",
      "Jedna rečenica koju bi rekao drugom vlasniku (nije obavezno)");
    text.setAttribute("aria-label", T("Your words", "Tvoje reči"));
    text.addEventListener("input", function () { d.comment = text.value; });
    c.body.appendChild(text);

    var ok = make("label", "crc-check");
    var box = make("input");
    box.type = "checkbox";
    box.checked = d.publish;
    box.addEventListener("change", function () { d.publish = box.checked; });
    ok.appendChild(box);
    ok.appendChild(document.createTextNode(T(" You may publish this with my business's name.",
      " Smete da ovo objavite sa imenom mog lokala.")));
    c.body.appendChild(ok);

    var actions = make("div", "crc-actions");
    var msg = make("div", "crc-msg");
    var send = button("btn-ghost", T("Send", "Pošalji"), function () { sendRating(send, msg); });
    send.disabled = !d.stars;
    actions.appendChild(send);
    actions.appendChild(button("eh-plain", T("Later", "Kasnije"), function () { snooze("rate"); }));
    c.body.appendChild(actions);
    c.body.appendChild(msg);
    return c.box;
  }

  async function sendRating(btn, msg) {
    var d = cards.draft;
    if (!d.stars) return;
    btn.disabled = true;
    var res = await LBAuth.db.from("ratings").insert({
      user_id: LBAuth.getUser().id,
      stars: d.stars,
      comment: d.comment.trim() || null,
      may_publish: d.publish
    }).select().maybeSingle();
    if (res.error || !res.data) {
      btn.disabled = false;
      msg.textContent = res.error ? LBAuth.friendlyError(res.error).message
        : T("Couldn't send that — try again.", "Nismo uspeli da pošaljemo — pokušaj ponovo.");
      return;
    }
    cards.rating = res.data;
    cards.rated = true;
    renderCards();
  }

  // --- The monthly report (report.html) ---
  // In the first week of a month, for an account that had ads the month
  // before. The demo always offers the sample.
  function lastMonthKey() {
    var d = new Date();
    d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function reportCard() {
    var locale = window.LBLang ? LBLang.locale() : "en-US";
    if (cards.demo) {
      var demo = card(T("MONTHLY REPORT", "MESEČNI IZVEŠTAJ"));
      demo.body.appendChild(make("div", "crc-title", T("Every month, one page with the results", "Svakog meseca, jedna stranica sa rezultatima")));
      demo.body.appendChild(make("p", "crc-text", T(
        "What arrived, what was approved, what went out and what brought people in — ready to print or show a partner.",
        "Šta je stiglo, šta je odobreno, šta je objavljeno i šta je dovelo ljude — spremno za štampu ili da pokažeš partneru.")));
      var da = make("div", "crc-actions");
      var open = make("a", "btn-ghost", T("See a sample report", "Pogledaj primer izveštaja"));
      open.href = "report.html?demo=1" + (LBDemo.code ? "&p=" + LBDemo.code : "");
      da.appendChild(open);
      demo.body.appendChild(da);
      return demo.box;
    }
    var key = lastMonthKey();
    if (new Date().getDate() > 7 || dismissed().indexOf("report-" + key) > -1) return null;
    var start = new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1);
    var end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    var had = allCreatives.some(function (c) { var t = new Date(c.created_at); return t >= start && t < end; });
    if (!had) return null;
    var month = start.toLocaleDateString(locale, { month: "long" });
    var c = card(T("MONTHLY REPORT", "MESEČNI IZVEŠTAJ"), true);
    c.body.appendChild(make("div", "crc-title", T("Your " + month + " report is ready", "Tvoj izveštaj za " + month + " je spreman")));
    c.body.appendChild(make("p", "crc-text", T(
      "What arrived, what you approved, what went out and what brought people in — on one page, ready to print.",
      "Šta je stiglo, šta si odobrio, šta je objavljeno i šta je dovelo ljude — na jednoj stranici, spremno za štampu.")));
    var actions = make("div", "crc-actions");
    var go = make("a", "btn-ghost", T("Open the report", "Otvori izveštaj"));
    go.href = "report.html?m=" + key;
    actions.appendChild(go);
    actions.appendChild(button("eh-plain", T("Close", "Zatvori"), function () {
      dismiss("report-" + key);
      renderCards();
    }));
    c.body.appendChild(actions);
    return c.box;
  }

  // --- Invite another owner (referral.js, invite.html) ---
  // For a tester two weeks in, or right after a good rating. "Later" hides it
  // for a month.
  function inviteCard() {
    if (cards.demo || !LBAuth.hasActivePlan() || snoozed("invite", 30)) return null;
    var happy = cards.rating && cards.rating.stars >= 4;
    if (daysWithAds() < 14 && !happy) return null;
    var link = LBReferral.link(LBAuth.getUser().id);
    var c = card(T("INVITE AN OWNER YOU KNOW", "PREPORUČI NEKOG VLASNIKA"));
    c.body.appendChild(make("p", "crc-text", T(
      "Know an owner it would help? Send them your link — they'll see it's from you, and can try the demo straight away.",
      "Znaš vlasnika kome bi ovo koristilo? Pošalji mu svoj link — videće da je od tebe i odmah može da proba demo.")));
    var perk = LBReferral.perk("referrer");
    if (perk) c.body.appendChild(make("p", "crc-done", perk));
    var field = make("input", "crc-field crc-link");
    field.type = "text";
    field.readOnly = true;
    field.value = link;
    field.setAttribute("aria-label", T("Your invite link", "Tvoj link za preporuku"));
    field.addEventListener("focus", function () { field.select(); });
    c.body.appendChild(field);
    var actions = make("div", "crc-actions");
    var msg = make("div", "crc-msg crc-ok");
    if (navigator.share) {
      actions.appendChild(button("btn-ghost", T("Share", "Podeli"), function () {
        navigator.share({
          title: "Adronis",
          text: T("This is what I use for our ads — have a look:", "Ovo koristim za naše oglase — pogledaj:"),
          url: link
        }).catch(function () {});
      }));
    }
    actions.appendChild(button("btn-ghost", T("Copy link", "Kopiraj link"), function () {
      try {
        navigator.clipboard.writeText(link).then(function () {
          msg.textContent = T("Copied.", "Kopirano.");
        }, function () { field.select(); });
      } catch (e) { field.select(); }
    }));
    actions.appendChild(button("eh-plain", T("Later", "Kasnije"), function () { snooze("invite"); }));
    c.body.appendChild(actions);
    var r = cards.referrals;
    if (r && r.signed_up) {
      c.body.appendChild(make("p", "crc-hint", T(
        "Through your link so far: " + r.signed_up + " signed up, " + r.in_beta + " in the beta.",
        "Preko tvog linka do sada: prijavljenih " + r.signed_up + ", u beti " + r.in_beta + ".")));
    }
    c.body.appendChild(msg);
    return c.box;
  }

  async function loadCardData() {
    var uid = LBAuth.getUser().id;
    // Town festivals and matches the team added in the portal, from today.
    var today = new Date();
    var events = await LBAuth.db.from("local_events").select("*")
      .gte("starts_on", today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0"))
      .order("starts_on").limit(200);
    if (!events.error) cards.events = events.data || [];   // the table isn't there until schema.sql runs
    var rating = await LBAuth.db.from("ratings").select("*").eq("user_id", uid)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!rating.error) cards.rating = rating.data || null;   // the table isn't there until schema.sql runs
    var refs = await LBAuth.db.rpc("my_referrals");
    if (!refs.error) cards.referrals = refs.data;
    renderCards();
  }

  document.addEventListener("lb:langchange", renderCards);

  // A note from the team: the newest one this account hasn't closed, for a
  // month and a half.
  function noteCard() {
    var gone = dismissed();
    var u = cards.updates.filter(function (x) {
      return gone.indexOf("update-" + x.id) === -1 && Date.now() - new Date(x.created_at) < 45 * 86400000;
    })[0];
    if (!u) return null;
    var c = card(u.user_id ? T("ON YOUR SUGGESTION", "NA TVOJ PREDLOG") : T("NEW IN ADRONIS", "NOVO U ADRONISU"), true);
    c.body.appendChild(make("p", "crc-text", u.body));
    c.body.appendChild(make("div", "crc-sign", "— " + (u.created_by || "Adronis") + ", " + shortDate(u.created_at)));
    var actions = make("div", "crc-actions");
    actions.appendChild(button("btn-ghost", T("Got it", "Važi"), function () {
      dismiss("update-" + u.id);
      renderCards();
    }));
    c.body.appendChild(actions);
    return c.box;
  }

  // What changed in Adronis since this device last caught up (whats-new.js):
  // the three newest, and the page with the rest. Opening the page or "Got
  // it" counts as caught up.
  function newsCard() {
    if (cards.demo || !window.LBWhatsNew) return null;
    var fresh = LBWhatsNew.fresh();
    if (!fresh.length) return null;
    var c = card(T("NEW IN ADRONIS", "NOVO U ADRONISU"));
    c.body.appendChild(make("div", "crc-title", fresh.length === 1
      ? T("One change since your last visit", "Jedna promena od tvoje poslednje posete")
      : T(fresh.length + " changes since your last visit", "Promena od tvoje poslednje posete: " + fresh.length)));
    var list = make("ul", "crc-news");
    fresh.slice(0, 3).forEach(function (e) {
      list.appendChild(make("li", null, LBWhatsNew.text(e).title));
    });
    c.body.appendChild(list);
    var actions = make("div", "crc-actions");
    var go = make("a", "btn-ghost", T("See what's new", "Pogledaj šta je novo"));
    go.href = "whats-new.html";
    actions.appendChild(go);
    actions.appendChild(button("eh-plain", T("Got it", "Važi"), function () {
      LBWhatsNew.markSeen();
      renderCards();
    }));
    c.body.appendChild(actions);
    return c.box;
  }

  async function loadUpdates() {
    var res = await LBAuth.db.from("updates").select("*").order("created_at", { ascending: false }).limit(20);
    if (res.error) return;   // the table isn't there until schema.sql is re-run
    cards.updates = res.data || [];
    renderCards();
  }

  // Ads that went out two to thirty days ago and haven't been answered for,
  // oldest first. An account whose database has no outcome column yet is
  // never asked.
  function adKey(c) {
    return c.id || c.headline + "|" + c.published_at;
  }

  function outcomeQueue() {
    var list = cards.demo ? cards.creatives : allCreatives;
    return list.filter(function (c) {
      if (c.status !== "published" || !c.published_at || !("outcome" in c) || c.outcome) return false;
      if (cards.answered[adKey(c)]) return false;
      var ago = -LBDates.daysUntil(new Date(c.published_at));
      return ago >= 2 && ago <= 30;
    }).sort(function (a, b) { return new Date(a.published_at) - new Date(b.published_at); });
  }

  var THANKS = {
    yes: ["Great — that's the kind of ad we'll make more of.", "Odlično — takvih oglasa ćemo praviti još."],
    unsure: ["Fair enough — it's often hard to tell. Thanks for answering.", "Razumljivo — često se ne zna. Hvala na odgovoru."],
    no: ["Thanks for the honest answer — we'll try something different.", "Hvala na iskrenom odgovoru — probaćemo nešto drugačije."]
  };

  function outcomeCard() {
    if (cards.thanks) {
      var t = card(T("DID IT BRING ANYONE IN?", "DA LI JE DOVEO LJUDE?"));
      t.body.appendChild(make("p", "crc-done", T(THANKS[cards.thanks][0], THANKS[cards.thanks][1])));
      return t.box;
    }
    var queue = outcomeQueue();
    if (!queue.length) return null;
    var ad = queue[0];
    var c = card(T("DID IT BRING ANYONE IN?", "DA LI JE DOVEO LJUDE?") +
      (queue.length > 1 ? " · 1 / " + queue.length : ""));
    if (ad.image_url) {
      var img = make("img", "crc-thumb");
      img.src = ad.image_url;
      img.alt = "";
      c.box.insertBefore(img, c.body);
    }
    c.body.appendChild(make("div", "crc-title", ad.headline || T("Your ad", "Tvoj oglas")));
    c.body.appendChild(make("div", "crc-meta", [ad.channel, shortDate(ad.published_at)].filter(Boolean).join(" · ")));
    c.body.appendChild(make("p", "crc-text", T(
      "Since it went out, has anyone come in because of it, or mentioned it?",
      "Od kad je objavljen, da li je neko došao zbog njega ili ga pomenuo?")));
    var actions = make("div", "crc-actions");
    var msg = make("div", "crc-msg");
    [["yes", "Yes", "Da"], ["unsure", "Can't tell", "Ne znam"], ["no", "No", "Ne"]].forEach(function (o) {
      actions.appendChild(button("btn-ghost", T(o[1], o[2]), function () { answer(ad, o[0], actions, msg); }));
    });
    c.body.appendChild(actions);
    c.body.appendChild(make("p", "crc-hint", cards.demo
      ? T("In a real account, your answer shows us which ads to make more of.",
          "U pravom nalogu, tvoj odgovor nam pokazuje kakvih oglasa da pravimo više.")
      : T("Your answer shows us which ads to make more of.",
          "Tvoj odgovor nam pokazuje kakvih oglasa da pravimo više.")));
    c.body.appendChild(msg);
    return c.box;
  }

  async function answer(ad, value, actions, msg) {
    Array.prototype.forEach.call(actions.querySelectorAll("button"), function (b) { b.disabled = true; });
    if (!cards.demo) {
      var res = await LBAuth.db.from("creatives").update({ outcome: value }).eq("id", ad.id).select().maybeSingle();
      if (res.error || !res.data) {
        Array.prototype.forEach.call(actions.querySelectorAll("button"), function (b) { b.disabled = false; });
        msg.textContent = res.error ? LBAuth.friendlyError(res.error).message
          : T("Couldn't save that — try again.", "Nismo uspeli da sačuvamo — pokušaj ponovo.");
        return;
      }
      allCreatives = allCreatives.map(function (x) { return x.id === ad.id ? res.data : x; });
      renderLearned(allCreatives, LBAuth.getProfile() || {});
    }
    cards.answered[adKey(ad)] = value;
    cards.thanks = value;
    renderCards();
    setTimeout(function () {
      cards.thanks = null;
      renderCards();
    }, 2800);
  }

  // The next date worth an ad, once it's close enough to get into a Monday
  // drop and still far enough to post ahead of it: the fixed ones and the
  // business's own town's days (dates-rs.js), and the events the team added
  // for its town or country (local_events). The demo shows the next one
  // whatever the day, so there's always one to try.
  function comingUp() {
    var gone = dismissed();
    var p = cards.demo ? {} : (LBAuth.getProfile() || {});
    var all = LBDates.between(new Date(), 60, p.city)
      .concat(LBDates.fromEvents(cards.events, p.country, p.city))
      .sort(function (a, b) { return a.date - b.date; });
    return all.filter(function (d) {
      var days = LBDates.daysUntil(d.date);
      return days >= 2 && (cards.demo || days <= d.lead + 7) && gone.indexOf("date-" + d.id) === -1;
    })[0] || null;
  }

  function inNote(d) {
    var note = String((LBAuth.getProfile() || {}).next_week_note || "").toLowerCase();
    return d.names.some(function (n) { return note.indexOf(n.toLowerCase()) > -1; });
  }

  function srDays(n) {
    return n % 10 === 1 && n % 100 !== 11 ? "dan" : "dana";
  }

  function dateCard() {
    var d = comingUp();
    if (!d) return null;
    var locale = window.LBLang ? LBLang.locale() : "en-US";
    var n = LBDates.daysUntil(d.date);
    var c = card(d.local
      ? T("IN YOUR TOWN · IN " + n + " DAYS", "U TVOM GRADU · ZA " + n + " " + srDays(n).toUpperCase())
      : T("COMING UP · IN " + n + " DAYS", "USKORO · ZA " + n + " " + srDays(n).toUpperCase()));
    var when = d.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    if (d.end) when += " – " + d.end.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    c.body.appendChild(make("div", "crc-title", d.name + " — " + when));
    c.body.appendChild(make("p", "crc-text", d.idea));

    var actions = make("div", "crc-actions");
    var msg = make("div", "crc-msg");
    var added = cards.dateAdded === d.id || (!cards.demo && inNote(d));
    if (added) {
      c.body.appendChild(make("p", "crc-done", "✓ " + T(
        "It's in your note for next week — your next drop plans an ad for it.",
        "Upisano je u belešku za sledeću nedelju — sledeći drop planira oglas za to.")));
      actions.appendChild(button("eh-plain", T("Close", "Zatvori"), function () {
        dismiss("date-" + d.id);
        renderCards();
      }));
    } else {
      actions.appendChild(button("btn-ghost", T("Add to my note for next week", "Dodaj u belešku za sledeću nedelju"),
        function (e) { addDate(d, e.currentTarget, msg); }));
      actions.appendChild(button("eh-plain", T("Not for us", "Ne treba nam"), function () {
        dismiss("date-" + d.id);
        renderCards();
      }));
    }
    c.body.appendChild(actions);
    if (!added) {
      c.body.appendChild(make("p", "crc-hint", cards.demo
        ? T("In a real account this adds a line to your note for next week.",
            "U pravom nalogu ovo dodaje red u belešku za sledeću nedelju.")
        : T("Adds one line to your note for next week — you can change it under Profile strength.",
            "Dodaje jedan red u belešku za sledeću nedelju — možeš da je izmeniš pod Snaga profila.")));
    }
    c.body.appendChild(msg);
    return c.box;
  }

  async function addDate(d, btn, msg) {
    if (cards.demo) {
      cards.dateAdded = d.id;
      renderCards();
      return;
    }
    var profile = LBAuth.getProfile() || {};
    var when = d.date.toLocaleDateString(window.LBLang ? LBLang.locale() : "en-US",
      window.LBLang && LBLang.get() === "sr" ? { day: "numeric", month: "numeric" } : { month: "short", day: "numeric" });
    var line = d.name + " (" + when + "): " + T("I'd like an ad for it.", "hoću oglas za to.");
    // A note gone out of date is about a week that's over: start a new one.
    var at = profile.next_week_note_at ? new Date(profile.next_week_note_at).getTime() : 0;
    var old = at && Date.now() - at <= NOTE_FRESH_MS ? String(profile.next_week_note || "").trim() : "";
    var next = (old ? old + "\n" : "") + line;
    if (next.length > 1000) {
      msg.textContent = T("Your note is full — make some room under Profile strength first.",
        "Beleška je puna — prvo napravi mesta pod Snaga profila.");
      return;
    }
    btn.disabled = true;
    try {
      await LBAuth.updateProfile({ next_week_note: next });
      cards.dateAdded = d.id;
      renderExtras();
      renderCards();
    } catch (err) {
      btn.disabled = false;
      msg.textContent = err.message;
    }
  }

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
    // The public demo (demo.js) has its own café's week, with real pictures,
    // and its own strip saying what it is.
    var creatives = LBDemo.on ? LBDemo.week() : sampleCreatives();
    noDrops.hidden = true;
    board.hidden = false;
    document.getElementById("sample-notice").hidden = LBDemo.on;
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
    { key: "differentiator", weight: 15, title: "What makes you different", max: 1000, multiline: true,
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
    { key: "opening_hours", weight: 10, title: "Your opening hours", max: 300,
      why: "Ads can say when to come by — open late, open on Sunday — and never send anyone to a closed door.",
      placeholder: "e.g. Mon–Fri 7–22, Sat 8–23, closed Sunday" },
    { key: "brand_colors", weight: 5, title: "Your brand colors", max: 200,
      why: "Keeps the images in your colors, so people recognise you before they read a word.",
      placeholder: "e.g. Deep green and cream, with gold accents" },
    { key: "avoid_notes", weight: 5, title: "Anything to avoid", max: 1000, multiline: true,
      why: "Things that should never show up in your ads — the engine steers clear of them.",
      placeholder: "e.g. No jokes about prices, never show the back kitchen" },
    { key: "website", weight: 5, title: "Website or Instagram", max: 300,
      why: "Shows the engine how you already present yourself, so new ads match it.",
      placeholder: "e.g. @milenasbakery or milenas.rs" },
    { key: "address", weight: 5, title: "Your street address", max: 200,
      why: "So an ad can tell people exactly where to find you.",
      placeholder: "e.g. Bulevar oslobođenja 12" },
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

  // The quick picks under "Anything to avoid" (profiles.avoid_tags). The keys
  // are fixed in schema.sql, where each one's meaning for the engine is set.
  var AVOID_TAGS = [
    { key: "no_emoji", label: "No emojis" },
    { key: "no_prices", label: "No prices" },
    { key: "no_discounts", label: "No sales or discounts" },
    { key: "no_faces", label: "No people's faces" },
    { key: "no_alcohol", label: "No alcohol" },
    { key: "no_jokes", label: "No jokes or puns" },
    { key: "no_slang", label: "No slang" },
    { key: "no_english", label: "No English words" },
    { key: "no_competitors", label: "No other businesses" },
    { key: "no_urgency", label: "No “last chance” pressure" }
  ];

  function avoidTagLabels(profile) {
    var on = profile.avoid_tags || [];
    return AVOID_TAGS.filter(function (x) { return on.indexOf(x.key) > -1; })
      .map(function (x) { return window.LBLang ? LBLang.t(x.label) : x.label; });
  }

  function extraValue(x, profile) {
    if (x.key === "avoid_notes") {
      return avoidTagLabels(profile).concat(profile.avoid_notes ? [profile.avoid_notes] : []).join(" · ");
    }
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

    // "Anything to avoid" starts with one-tap picks, saved with the words.
    var avoid = x.key === "avoid_notes";
    var tags = avoid ? (profile.avoid_tags || []).slice() : null;
    if (avoid) {
      var tagsLabel = document.createElement("div");
      tagsLabel.className = "eh-tags-label";
      tagsLabel.textContent = "TAP ANY THAT APPLY";
      form.appendChild(tagsLabel);
      var picks = document.createElement("div");
      picks.className = "eh-tags";
      AVOID_TAGS.forEach(function (tag) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = tag.label;
        b.setAttribute("aria-pressed", tags.indexOf(tag.key) > -1 ? "true" : "false");
        b.addEventListener("click", function () {
          var i = tags.indexOf(tag.key);
          if (i > -1) tags.splice(i, 1); else tags.push(tag.key);
          b.setAttribute("aria-pressed", i > -1 ? "false" : "true");
        });
        picks.appendChild(b);
      });
      form.appendChild(picks);
    }

    var field = document.createElement(x.multiline ? "textarea" : "input");
    if (x.multiline) field.rows = 3; else field.type = "text";
    field.maxLength = x.max;
    field.placeholder = avoid ? "Anything else, in your own words — e.g. never show the back kitchen" : x.placeholder;
    field.setAttribute("aria-label", x.title);
    field.value = avoid ? (profile.avoid_notes || "") : value;
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
      clear.addEventListener("click", function () {
        saveExtra(x.key, null, form, avoid ? { avoid_tags: [] } : null);
      });
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
      saveExtra(x.key, field.value.trim() || null, form, avoid ? { avoid_tags: tags } : null);
    });
    form.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { openExtra = null; renderExtras(); }
    });
    setTimeout(function () { field.focus(); }, 0);
    return form;
  }

  async function saveExtra(key, value, form, also) {
    var buttons = form.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    try {
      var patch = Object.assign({}, also || {});
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
    // The public demo: the sample week for everyone, signed in or not.
    if (LBDemo.on) {
      await LBDemo.ready();
      loading.hidden = true;
      LBDemo.bar();
      document.getElementById("page-sub").textContent =
        "A café's week of approved ads: what goes out and when, and what's already live.";
      document.getElementById("history-link").hidden = true;
      document.getElementById("cal-export").hidden = true;
      document.getElementById("report-link").href = "report.html?demo=1" + (LBDemo.code ? "&p=" + LBDemo.code : "");
      showSample();
      cards.on = true;
      cards.demo = true;
      cards.creatives = LBDemo.week().map(function (c) { return Object.assign({ outcome: null }, c); });
      renderCards();
      return;
    }

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

    // The days they're closed, for an account the engine makes ads for.
    if (LBAuth.hasBrief()) {
      closedCard = LBClosed.mount(document.getElementById("closed-days"), {
        creatives: function () { return allCreatives; },
        onChange: function () { renderCalendar(); }
      });
      LBWeather.mount(document.getElementById("weather"));
    }

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
      if (LBAuth.hasActivePlan()) {
        LBFirstWeek.show(noDrops, "Here's how your first week goes. Until then, everything you add under " +
          "Profile strength above goes into your first ads.");
      }
      noDrops.hidden = false;
    } else {
      board.hidden = false;
      allCreatives = creatives;
      renderBoard(creatives);
      renderLearned(creatives, LBAuth.getProfile() || {});
      // Now it can tell which approved ads land on a closed day.
      if (closedCard) closedCard.render();
    }

    cards.on = true;
    renderCards();
    loadUpdates();
    loadCardData();

    LBTour.replayButton(TOUR);
    LBTour.auto(TOUR);
  });
})();
