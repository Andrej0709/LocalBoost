/* The days a business is closed - a holiday, a week off, a renovation - kept
 * in profiles.closed_days (schema.sql, section 2) as
 * [{ from: "2026-12-30", to: "2027-01-02", note: "New Year" }, ...].
 *
 * The engine reads the list: nothing is slotted for a closed day and a week
 * closed from Monday to Sunday gets no drop at all. Here it is the card in the
 * control room where the customer adds and removes them, the shading on the
 * posting calendar, and the check that stops an ad being moved onto a closed
 * day (reschedule.js). Dates are the business's own calendar days, read in
 * the device's time zone - the same one the posting times are shown in.
 *
 * Load it after auth.js; control-room.js mounts the card.
 */
(function () {
  var MAX = 30;
  var MAX_DAYS = 92;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) {
    var p = String(s || "").split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function locale() { return window.LBLang ? LBLang.locale() : "en-US"; }
  function t(text) { return window.LBLang ? LBLang.t(text) : text; }

  // The stretches still to come or going on now, soonest first. Ones that
  // ended before today are of no use to anyone and are left out.
  function list(profile) {
    var today = ymd(new Date());
    var raw = (profile || (window.LBAuth && LBAuth.getProfile()) || {}).closed_days;
    return (Array.isArray(raw) ? raw : [])
      .filter(function (r) { return r && /^\d{4}-\d{2}-\d{2}$/.test(r.from) && /^\d{4}-\d{2}-\d{2}$/.test(r.to) && r.to >= today; })
      .sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
  }

  // The stretch a moment falls in, or null.
  function closedOn(date, profile) {
    if (!date) return null;
    var day = ymd(new Date(date));
    return list(profile).filter(function (r) { return r.from <= day && day <= r.to; })[0] || null;
  }

  function rangeText(r) {
    var a = parse(r.from), b = parse(r.to);
    var opts = { day: "numeric", month: "short" };
    if (a.getFullYear() !== b.getFullYear()) opts.year = "numeric";
    var from = a.toLocaleDateString(locale(), opts);
    return r.from === r.to ? from : from + " – " + b.toLocaleDateString(locale(), opts);
  }

  async function save(next) {
    return LBAuth.updateProfile({ closed_days: next });
  }

  // The card. opts.creatives() gives the ads loaded on the page, so it can
  // point out approved ones set to post on a closed day; opts.onChange runs
  // after every save, for the calendar to catch up.
  function mount(host, opts) {
    opts = opts || {};
    host.hidden = false;
    var message = null;

    function render() {
      host.innerHTML = "";
      var ranges = list();

      var eyebrow = document.createElement("div");
      eyebrow.className = "eh-eyebrow";
      eyebrow.textContent = "DAYS YOU'RE CLOSED";
      var h = document.createElement("h3");
      h.textContent = "Closed for a holiday or a break?";
      var intro = document.createElement("p");
      intro.className = "learned-intro";
      intro.textContent = "Tell us the days and no ad goes out while you're shut, and none tells people to come by. " +
        "A whole week closed means no ads that week. Your usual day off goes in your opening hours instead.";
      host.appendChild(eyebrow);
      host.appendChild(h);
      host.appendChild(intro);

      if (ranges.length) {
        var ul = document.createElement("ul");
        ul.className = "cd-list";
        ranges.forEach(function (r) {
          var li = document.createElement("li");
          var when = document.createElement("span");
          when.className = "cd-when";
          when.textContent = rangeText(r);
          li.appendChild(when);
          if (r.note) {
            var note = document.createElement("span");
            note.className = "cd-note";
            note.textContent = r.note;
            li.appendChild(note);
          }
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "eh-plain";
          rm.textContent = "Remove";
          rm.setAttribute("aria-label", t("Remove") + " " + rangeText(r));
          rm.addEventListener("click", function () {
            busy(true);
            save(ranges.filter(function (x) { return x !== r; })).then(function () {
              message = null;
              render();
              if (opts.onChange) opts.onChange();
            }, fail);
          });
          li.appendChild(rm);
          ul.appendChild(li);
        });
        host.appendChild(ul);
      }

      // Approved ads already slotted for a day that has since been marked
      // closed: say so, so they can be moved.
      var clash = (opts.creatives ? opts.creatives() : []).filter(function (c) {
        return c.status === "approved" && c.scheduled_at && closedOn(c.scheduled_at);
      });
      if (clash.length) {
        var warn = document.createElement("div");
        warn.className = "notice cd-clash";
        warn.setAttribute("role", "status");
        warn.textContent = clash.length === 1
          ? "1 approved ad is set to post while you're closed. Pick another time for it under Scheduled to post."
          : clash.length + " approved ads are set to post while you're closed. Pick another time for them under Scheduled to post.";
        host.appendChild(warn);
      }

      if (ranges.length < MAX) {
        var form = document.createElement("form");
        form.className = "cd-form";
        var today = ymd(new Date());
        var max = ymd(new Date(Date.now() + 365 * 86400000));

        function field(labelText, input) {
          var label = document.createElement("label");
          label.appendChild(document.createTextNode(labelText));
          label.appendChild(input);
          return label;
        }
        var from = document.createElement("input");
        from.type = "date";
        from.required = true;
        from.min = today;
        from.max = max;
        var to = document.createElement("input");
        to.type = "date";
        to.required = true;
        to.min = today;
        to.max = max;
        from.addEventListener("change", function () {
          to.min = from.value || today;
          if (!to.value || to.value < from.value) to.value = from.value;
        });
        var note = document.createElement("input");
        note.type = "text";
        note.maxLength = 120;
        note.placeholder = "e.g. New Year, family holiday";
        var add = document.createElement("button");
        add.type = "submit";
        add.className = "btn-ghost";
        add.textContent = "Add";

        form.appendChild(field("FIRST DAY", from));
        form.appendChild(field("LAST DAY", to));
        form.appendChild(field("NOTE (OPTIONAL)", note));
        form.appendChild(add);

        form.addEventListener("submit", function (e) {
          e.preventDefault();
          if (!from.value || !to.value) return;
          if (to.value < from.value) { message = { bad: true, text: "The last day can't be before the first." }; render(); return; }
          if ((parse(to.value) - parse(from.value)) / 86400000 > MAX_DAYS) {
            message = { bad: true, text: "Add up to three months at a time." };
            render();
            return;
          }
          busy(true);
          var next = ranges.concat([{ from: from.value, to: to.value, note: note.value.trim() || undefined }]);
          save(next).then(function () {
            message = { text: "Saved — no ads on those days." };
            render();
            if (opts.onChange) opts.onChange();
          }, fail);
        });
        host.appendChild(form);
      }

      if (message) {
        var m = document.createElement("div");
        m.className = "notice";
        m.setAttribute("role", "status");
        m.textContent = message.text;
        if (message.bad) m.style.color = "#f0a8a8";
        host.appendChild(m);
      }
    }

    function busy(on) {
      Array.prototype.forEach.call(host.querySelectorAll("button, input"), function (el) { el.disabled = on; });
    }

    function fail(err) {
      message = { bad: true, text: (err && err.message) || "Couldn't save — try again." };
      render();
    }

    render();
    return { render: render };
  }

  window.LBClosed = { list: list, closedOn: closedOn, rangeText: rangeText, mount: mount };
})();
