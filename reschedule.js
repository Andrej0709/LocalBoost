/* Changing when an approved creative posts, shared by the control room
   (control-room.js) and approvals (approvals.html).

   The database checks the same limits (protect_creative_fields in
   supabase/schema.sql): only an approved creative that hasn't gone out, never
   within 10 minutes of its slot, and a new time 10 minutes to 90 days ahead.
   The messages below match the database's, so either one reads the same. */
(function () {
  var LEAD_MS = 10 * 60 * 1000;
  var LOCK_AFTER_MS = 15 * 60 * 1000;
  var MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

  // A slot about to go out (or going out right now) stays put.
  function canReschedule(c) {
    if (!c || !c.id || c.status !== "approved") return false;
    if (!c.scheduled_at) return true;
    var until = new Date(c.scheduled_at).getTime() - Date.now();
    return !(until > -LOCK_AFTER_MS && until < LEAD_MS);
  }

  function problem(date) {
    if (isNaN(date.getTime())) return "Pick a day and a time.";
    if (date.getTime() < Date.now() + LEAD_MS) return "Pick a time at least 10 minutes from now.";
    if (date.getTime() > Date.now() + MAX_AHEAD_MS) return "Pick a time within the next 90 days.";
    return null;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateValue(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function timeValue(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }

  // The editor. opts.onSave(date or null) resolves to null once saved (the
  // caller re-renders) or to a message to show; opts.onCancel closes it.
  // null hands the slot back to the engine's own best time.
  function form(c, opts) {
    var el = document.createElement("form");
    el.className = "time-editor";

    // No time yet: start from tomorrow morning.
    var start = c.scheduled_at ? new Date(c.scheduled_at) : (function () {
      var d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    })();

    var dayLabel = document.createElement("label");
    dayLabel.appendChild(document.createTextNode("DAY"));
    var day = document.createElement("input");
    day.type = "date";
    day.required = true;
    day.value = dateValue(start);
    day.min = dateValue(new Date());
    day.max = dateValue(new Date(Date.now() + MAX_AHEAD_MS));
    dayLabel.appendChild(day);

    var timeLabel = document.createElement("label");
    timeLabel.appendChild(document.createTextNode("TIME"));
    var time = document.createElement("input");
    time.type = "time";
    time.required = true;
    time.step = 300;
    time.value = timeValue(start);
    timeLabel.appendChild(time);

    var row = document.createElement("div");
    row.className = "time-editor-row";
    var save = document.createElement("button");
    save.type = "submit";
    save.className = "btn-ghost";
    save.textContent = "Save time";
    row.appendChild(save);
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "time-editor-plain";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", function () { opts.onCancel(); });
    row.appendChild(cancel);

    if (c.rescheduled_at) {
      var auto = document.createElement("button");
      auto.type = "button";
      auto.className = "time-editor-plain";
      auto.textContent = "Let Adronis pick";
      auto.addEventListener("click", function () { submit(null); });
      row.appendChild(auto);
    }

    var hint = document.createElement("p");
    hint.className = "time-editor-hint";
    hint.textContent = "Any time from 10 minutes to 90 days from now, in your device's time zone.";

    var notice = document.createElement("div");
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.hidden = true;

    el.appendChild(dayLabel);
    el.appendChild(timeLabel);
    el.appendChild(row);
    el.appendChild(hint);
    el.appendChild(notice);

    function show(message) {
      notice.hidden = false;
      notice.textContent = message;
      notice.style.color = "#f0a8a8";
    }

    function setBusy(busy) {
      Array.prototype.forEach.call(el.querySelectorAll("button"), function (b) { b.disabled = busy; });
    }

    async function submit(when) {
      setBusy(true);
      var message = await opts.onSave(when);
      if (message) { setBusy(false); show(message); }
    }

    el.addEventListener("submit", function (e) {
      e.preventDefault();
      var parts = day.value.split("-").map(Number);
      var hm = time.value.split(":").map(Number);
      var when = new Date(parts[0], parts[1] - 1, parts[2], hm[0], hm[1]);
      var wrong = problem(when);
      if (wrong) { show(wrong); return; }
      submit(when);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape") opts.onCancel();
    });
    setTimeout(function () { day.focus(); }, 0);
    return el;
  }

  window.LBReschedule = { canReschedule: canReschedule, form: form };
})();
