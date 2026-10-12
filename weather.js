/* The weather card in the control room: the week's forecast for the
 * business's city, the day worth an ad because of it, and the switch for
 * profiles.weather_ads (schema.sql), which tells the engine to fit each ad
 * to the weather of the day it posts.
 *
 * The forecast comes from Open-Meteo (open-meteo.com, CC BY 4.0, credited
 * under the card): the town is looked up once and kept on this device, the
 * forecast is kept for three hours. Nothing here is saved to the account
 * but the switch. Words are in both languages here, like dates-rs.js, so a
 * language switch just draws the card again.
 *
 * Load it after auth.js; control-room.js mounts the card.
 */
(function () {
  var FORECAST_TTL = 3 * 60 * 60 * 1000;
  var GEO_PREFIX = "lb-wx-geo:";
  var FORECAST_PREFIX = "lb-wx:";

  // Countries we serve most, for the town lookup: "Kraljevo" alone could
  // be somewhere else.
  var COUNTRY_CODES = {
    "Serbia": "RS", "Bosnia & Herzegovina": "BA", "Montenegro": "ME",
    "Croatia": "HR", "North Macedonia": "MK", "Slovenia": "SI"
  };

  // Business types that sell food or drink get food-and-drink ideas.
  var FOOD = ["Café", "Restaurant", "Pizzeria", "Bakery", "Wine bar"];

  function sr() { return !!(window.LBLang && LBLang.get() === "sr"); }
  function T(en, srText) { return sr() ? srText : en; }
  function locale() { return window.LBLang ? LBLang.locale() : "en-US"; }

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function readCache(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function writeCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  // { lat, lon } for the business's town, or null when it can't be found.
  async function place(city, country) {
    var key = GEO_PREFIX + (window.LBDates ? LBDates.cityKey(city) : city) + "|" + (country || "");
    var hit = readCache(key);
    if (hit) return hit.lat === undefined ? null : hit;
    var url = "https://geocoding-api.open-meteo.com/v1/search?count=1&language=sr&name=" + encodeURIComponent(city) +
      (COUNTRY_CODES[country] ? "&countryCode=" + COUNTRY_CODES[country] : "");
    var res = await fetch(url);
    if (!res.ok) throw new Error("geocoding " + res.status);
    var top = ((await res.json()).results || [])[0];
    var found = top ? { lat: Math.round(top.latitude * 100) / 100, lon: Math.round(top.longitude * 100) / 100 } : {};
    writeCache(key, found);
    return top ? found : null;
  }

  // The next seven days: { date, code, max, min, rain } each.
  async function forecast(spot) {
    var key = FORECAST_PREFIX + spot.lat + "," + spot.lon;
    var hit = readCache(key);
    if (hit && Date.now() - hit.at < FORECAST_TTL) return hit.days;
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + spot.lat + "&longitude=" + spot.lon +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto&forecast_days=7";
    var res = await fetch(url);
    if (!res.ok) throw new Error("forecast " + res.status);
    var d = (await res.json()).daily || {};
    var days = (d.time || []).map(function (t, i) {
      return {
        date: t,
        code: d.weather_code[i],
        max: Math.round(d.temperature_2m_max[i]),
        min: Math.round(d.temperature_2m_min[i]),
        rain: d.precipitation_probability_max[i] == null ? null : d.precipitation_probability_max[i]
      };
    });
    writeCache(key, { at: Date.now(), days: days });
    return days;
  }

  // What kind of day it is, by WMO weather code and temperature. Only the
  // kinds an ad would change for; anything else is "plain".
  function kind(day) {
    var c = day.code;
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    if (c >= 95) return "storm";
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (day.rain != null && day.rain >= 70)) return "rain";
    if (day.max >= 30) return "hot";
    if (day.max <= 3) return "cold";
    if (day.max >= 18 && c <= 2 && (day.rain == null || day.rain < 30)) return "nice";
    return "plain";
  }

  // A text glyph per day (︎ keeps phones from swapping in emoji).
  function glyph(day) {
    var c = day.code;
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "❄︎";
    if (c >= 95) return "⚡︎";
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "☂︎";
    if (c <= 1) return "☀︎";
    if (c === 2) return "⛅︎";
    return "☁︎";
  }

  var LABEL = {
    snow:  ["Snow", "Sneg"],
    storm: ["Storms", "Nevreme"],
    rain:  ["Rain", "Kiša"],
    hot:   ["Heat", "Vrućina"],
    cold:  ["Cold", "Hladno"],
    nice:  ["Sunny and mild", "Sunčano i prijatno"]
  };

  var IDEA = {
    food: {
      snow:  ["hot chocolate, something warm from the oven and a cosy table inside.",
              "topla čokolada, nešto toplo iz rerne i ušuškan sto unutra."],
      storm: ["people stay in: delivery or takeaway, and something warm to come in to.",
              "ljudi ostaju unutra: dostava ili za poneti, i nešto toplo kad svrate."],
      rain:  ["warm drinks, comfort food and delivery — people look for somewhere dry.",
              "topli napici, nešto toplo za jelo i dostava — ljudi traže zaklon od kiše."],
      hot:   ["iced coffee, lemonade, ice cream and a table in the shade.",
              "ledena kafa, limunada, sladoled i sto u hladu."],
      cold:  ["soup, tea, mulled wine or hot chocolate — whatever warms people up.",
              "supa, čaj, kuvano vino ili topla čokolada — šta god greje."],
      nice:  ["the terrace or the garden — one sunny photo of it does the work.",
              "bašta ili terasa — jedna sunčana fotografija radi posao."]
    },
    other: {
      snow:  ["remind people you're open and warm inside, and that booking ahead saves the wait.",
              "podseti da radiš i da je unutra toplo, i da zakazivanje unapred štedi čekanje."],
      storm: ["a good day to get people to book for later in the week.",
              "dobar dan da ljudi zakažu termin za kasnije u nedelji."],
      rain:  ["people stay in and scroll: a good day to get them to book ahead.",
              "ljudi su unutra i listaju telefon: dobar dan da zakažu unapred."],
      hot:   ["a cool place inside, and early or late slots away from the heat.",
              "rashlađen prostor i termini rano ujutru ili uveče, van najveće vrućine."],
      cold:  ["a warm place inside and a hot drink while they wait.",
              "topao prostor i topao napitak dok čekaju."],
      nice:  ["people are out and about: a good day to be noticed on the way past.",
              "ljudi su napolju: dobar dan da te primete u prolazu."]
    }
  };

  function parseDay(s) {
    var p = String(s).split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function capital(s) {
    return s.replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function weekday(s, style) {
    return parseDay(s).toLocaleDateString(locale(), { weekday: style }).replace(/\.$/, "");
  }

  function mount(host) {
    host.hidden = false;
    var days = null;     // the forecast, once loaded
    var failed = null;   // "missing" (town not found) or "error"
    var message = null;

    function profile() { return LBAuth.getProfile() || {}; }

    function render() {
      var p = profile();
      var on = p.weather_ads !== false;
      host.innerHTML = "";

      host.appendChild(make("div", "eh-eyebrow", T("WEATHER & YOUR ADS", "VREME I TVOJI OGLASI")));
      host.appendChild(make("h3", null, T("Ads that fit the weather", "Oglasi koji prate vreme")));
      host.appendChild(make("p", "learned-intro", T(
        "When this is on, the engine checks the forecast for " + (p.city || "your town") + " before it makes your ads: " +
          "something warm on a cold, wet day, the terrace and cold drinks in a heat wave — and no ad invites people " +
          "to sit outside on a day it's set to pour.",
        "Kad je ovo uključeno, mašina pre pravljenja oglasa proveri prognozu za " + (p.city || "tvoj grad") + ": " +
          "nešto toplo za hladan, kišni dan, bašta i hladna pića po vrućini — i nijedan oglas ne zove ljude " +
          "da sednu napolju kad je najavljen pljusak.")));

      var label = make("label", "acc-switch wx-switch");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("role", "switch");
      box.checked = on;
      label.appendChild(box);
      var track = make("span", "acc-switch-track");
      track.setAttribute("aria-hidden", "true");
      label.appendChild(track);
      label.appendChild(make("span", "acc-switch-text", T("Fit my ads to the weather", "Prilagodi moje oglase vremenu")));
      box.addEventListener("change", function () { save(box); });
      host.appendChild(label);

      if (days && days.length) {
        var strip = make("ol", "wx-strip");
        strip.setAttribute("aria-label", T("Forecast for the next 7 days", "Prognoza za narednih 7 dana"));
        days.forEach(function (d, i) {
          var k = kind(d);
          var li = make("li", "wx-day" + (k !== "plain" ? " is-" + k : ""));
          li.appendChild(make("span", "wx-wd", i === 0 ? T("Today", "Danas") : weekday(d.date, "short")));
          var g = make("span", "wx-glyph", glyph(d));
          g.setAttribute("aria-hidden", "true");
          li.appendChild(g);
          li.appendChild(make("span", "wx-temp", d.max + "°"));
          li.appendChild(make("span", "wx-min", d.min + "°"));
          var label = LABEL[k] ? T(LABEL[k][0], LABEL[k][1]) : "";
          li.setAttribute("aria-label", weekday(d.date, "long") + ": " + (label ? label + ", " : "") +
            d.max + "° / " + d.min + "°" + (d.rain != null ? ", " + T("chance of rain ", "šansa za kišu ") + d.rain + "%" : ""));
          strip.appendChild(li);
        });
        host.appendChild(strip);

        // The first day from tomorrow that would change an ad.
        var food = FOOD.indexOf(p.vertical) > -1 ? "food" : "other";
        var pick = days.slice(1).filter(function (d) { return kind(d) !== "plain"; })[0];
        if (pick) {
          var k = kind(pick);
          var idea = IDEA[food][k];
          var tip = make("p", "wx-tip");
          tip.appendChild(make("b", null, capital(weekday(pick.date, "long")) +
            " · " + T(LABEL[k][0], LABEL[k][1]) + " · " + pick.max + "°"));
          tip.appendChild(document.createTextNode(" — " + capital(T(idea[0], idea[1]))));
          host.appendChild(tip);
          host.appendChild(make("p", "wx-hint", on
            ? T("Your ads for that day are fitted to it — nothing you need to do.",
                "Oglasi za taj dan se prilagođavaju tome — ne moraš ništa da radiš.")
            : T("The switch is off, so your ads won't change for it.",
                "Prekidač je isključen, pa se oglasi neće menjati zbog toga.")));
        } else {
          host.appendChild(make("p", "wx-hint", T(
            "An ordinary week ahead — nothing in the forecast that should change an ad.",
            "Obična nedelja pred nama — ništa u prognozi zbog čega bi oglas trebalo menjati.")));
        }
      } else if (failed === "missing") {
        host.appendChild(make("p", "wx-hint", T(
          "We couldn't find " + p.city + " on the weather map. Check the city under Account → Your business.",
          "Nismo našli " + p.city + " na meteorološkoj karti. Proveri grad pod Nalog → Tvoj biznis.")));
      } else if (failed === "error") {
        host.appendChild(make("p", "wx-hint", T(
          "The forecast didn't load just now. The switch still works.",
          "Prognoza se trenutno nije učitala. Prekidač i dalje radi.")));
      } else {
        host.appendChild(make("p", "wx-hint", T("Loading the forecast…", "Učitavam prognozu…")));
      }

      if (days && days.length) {
        var credit = make("p", "wx-credit");
        credit.appendChild(document.createTextNode(T("Forecast: ", "Prognoza: ")));
        var a = make("a", null, "Open-Meteo");
        a.href = "https://open-meteo.com/";
        a.target = "_blank";
        a.rel = "noopener";
        credit.appendChild(a);
        host.appendChild(credit);
      }

      if (message) {
        var m = make("div", "notice", message.text);
        m.setAttribute("role", "status");
        if (message.bad) m.style.color = "#f0a8a8";
        host.appendChild(m);
      }
    }

    async function save(box) {
      box.disabled = true;
      try {
        await LBAuth.updateProfile({ weather_ads: box.checked });
        message = { text: box.checked
          ? T("On — your ads follow the forecast.", "Uključeno — oglasi prate prognozu.")
          : T("Off — your ads ignore the weather.", "Isključeno — oglasi ne gledaju vreme.") };
      } catch (err) {
        box.checked = !box.checked;
        message = { bad: true, text: (err && err.message) || T("Couldn't save — try again.", "Čuvanje nije uspelo — pokušaj ponovo.") };
      }
      render();
    }

    async function load() {
      var p = profile();
      if (!p.city) { failed = "missing"; render(); return; }
      try {
        var spot = await place(p.city, p.country);
        if (!spot) { failed = "missing"; render(); return; }
        days = await forecast(spot);
      } catch (e) {
        failed = "error";
      }
      render();
    }

    render();
    load();
    document.addEventListener("lb:langchange", render);
    return { render: render };
  }

  window.LBWeather = { mount: mount };
})();
