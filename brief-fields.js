/* The business-brief fields that need more than a plain input, shared by the
   signup brief (signup.html) and the "Your business" card (account.js).

   COUNTRY and CITY. Every country is listed under its name in the reader's
   language, but the option's value is the English name, so the database keeps
   one spelling per country. Picking a country loads its towns from
   cities/<code>.json as suggestions for the CITY box — the customer can still
   type a place that isn't on the list.

   BUSINESS TYPE: picking "Other" opens a free-text box, and whatever the
   customer types there is the business type we store. */
(function () {

  var COUNTRY_CODES = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP " +
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS " +
    "MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS " +
    "RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW " +
    "TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").split(" ");

  function regionNames(locale) {
    try { return new Intl.DisplayNames([locale], { type: "region" }); }
    catch (e) { return { of: function (code) { return code; } }; }
  }
  var englishNames = regionNames("en");

  function uiLocale() {
    return window.LBLang ? LBLang.locale() : "en-US";
  }

  // The two-letter code behind a stored English country name, or "".
  function codeOf(englishName) {
    for (var i = 0; i < COUNTRY_CODES.length; i++) {
      if (englishNames.of(COUNTRY_CODES[i]) === englishName) return COUNTRY_CODES[i];
    }
    return "";
  }

  // A stored country, named in the reader's language.
  function countryLabel(englishName) {
    var code = codeOf(englishName);
    return code ? regionNames(uiLocale()).of(code) : (englishName || "");
  }

  // The country the browser says the reader is in, if it says.
  function guessCountry() {
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      var m = /-([A-Z]{2})$/i.exec(langs[i] || "");
      if (m && COUNTRY_CODES.indexOf(m[1].toUpperCase()) > -1) return englishNames.of(m[1].toUpperCase());
    }
    return "";
  }

  var cityCache = {};

  function countryField(select, datalist) {
    function fill() {
      var local = regionNames(uiLocale());
      var picked = select.value;
      var rows = COUNTRY_CODES.map(function (code) {
        return { code: code, value: englishNames.of(code), label: local.of(code) };
      });
      rows.sort(function (a, b) { return a.label.localeCompare(b.label, uiLocale()); });
      while (select.options.length > 1) select.remove(1);
      rows.forEach(function (row) {
        var opt = new Option(row.label, row.value);
        opt.dataset.code = row.code;
        select.add(opt);
      });
      select.value = picked;
    }

    function selectedCode() {
      var opt = select.selectedOptions[0];
      return opt && opt.dataset.code || "";
    }

    function loadCities() {
      var code = selectedCode();
      datalist.innerHTML = "";
      if (!code) return;
      var pending = cityCache[code] || (cityCache[code] = fetch("cities/" + code + ".json")
        .then(function (res) { return res.ok ? res.json() : []; })
        .catch(function () { delete cityCache[code]; return []; }));
      pending.then(function (names) {
        if (selectedCode() !== code) return; // the customer moved on
        var frag = document.createDocumentFragment();
        names.forEach(function (name) {
          var opt = document.createElement("option");
          opt.value = name;
          frag.appendChild(opt);
        });
        datalist.innerHTML = "";
        datalist.appendChild(frag);
      });
    }

    // A saved country is stored by its English name.
    function set(value) {
      select.value = value || "";
      if (select.value !== (value || "")) select.value = "";
      loadCities();
    }

    fill();
    select.addEventListener("change", loadCities);
    document.addEventListener("lb:langchange", fill);

    return { set: set };
  }

  function verticalField(select, otherField, otherInput) {
    function sync() {
      var isOther = select.value === "Other";
      otherField.hidden = !isOther;
      otherInput.required = isOther;
      if (!isOther) otherInput.value = "";
    }
    select.addEventListener("change", sync);
    sync();

    return {
      value: function () {
        if (select.value !== "Other") return select.value;
        return otherInput.value.trim() || "Other";
      },
      // A saved business type that isn't one of the listed options came from
      // the "Other" box, so put it back there.
      set: function (value) {
        var listed = Array.prototype.some.call(select.options, function (opt) {
          return opt.value === value && opt.value !== "Other";
        });
        if (listed) {
          select.value = value;
        } else {
          select.value = "Other";
          otherInput.value = value === "Other" ? "" : value;
        }
        sync();
      }
    };
  }

  /* CHANNELS: each plan publishes to a set number of channels — one on Free,
     two on Counter, four on Storefront and Beta, every one on Franchise (null). Mirrors
     channel_limit() in supabase/schema.sql and the pricing section; keep them
     in sync. Once the plan's number is ticked the other boxes lock. An account
     already over it (its plan just got smaller) is told how many to untick and
     can't save until it has. */
  var CHANNEL_LIMITS = { free: 1, counter: 2, storefront: 4, beta: 4, franchise: null };
  var PLAN_NAMES = { free: "Free", counter: "Counter", storefront: "Storefront", beta: "Beta", franchise: "Franchise" };

  function channelsField(group, hint, submit) {
    var plan = "free";

    function boxes() {
      return Array.prototype.slice.call(group.querySelectorAll('input[name="channels"]'));
    }
    function limit() { return CHANNEL_LIMITS[plan]; }

    function sync() {
      var max = limit();
      var list = boxes();
      var on = list.filter(function (box) { return box.checked; }).length;
      list.forEach(function (box) {
        box.disabled = max !== null && !box.checked && on >= max;
      });
      var over = max !== null && on > max;
      if (submit) submit.disabled = over;
      // Each case is a whole sentence of its own, so the Serbian copy can
      // match it.
      var name = PLAN_NAMES[plan];
      hint.textContent = max === null
        ? "Your " + name + " plan publishes to every channel."
        : over
          ? "Your " + name + " plan includes " + max + (max === 1 ? " channel" : " channels") +
            " — untick " + (on - max) + " to save."
          : "Your " + name + " plan includes " + max + (max === 1 ? " channel." : " channels.");
      hint.classList.toggle("is-over", over);
    }

    group.addEventListener("change", sync);

    return {
      // The plan whose number applies; anything unknown counts as Free.
      setPlan: function (key) {
        plan = CHANNEL_LIMITS.hasOwnProperty(key) ? key : "free";
        sync();
      },
      // Ticks the given channels, keeping only as many as the plan allows —
      // for defaults, never for what an account already saved.
      preselect: function (names) {
        var max = limit();
        var left = max === null ? Infinity : max;
        boxes().forEach(function (box) {
          box.checked = names.indexOf(box.value) > -1 && left-- > 0;
        });
        sync();
      },
      sync: sync
    };
  }

  window.LBBriefFields = {
    countryField: countryField,
    verticalField: verticalField,
    channelsField: channelsField,
    countryCode: codeOf,
    countryLabel: countryLabel,
    guessCountry: guessCountry
  };
})();
