/* Dates worth an ad in Serbia, for cafés, restaurants, bakeries and shops.
 * The public calendar (calendar.html) lists them; the control room's
 * "coming up" card offers the next one for the weekly note.
 *
 * Each date has a name, an idea for the ad, and lead: how many days ahead
 * it is worth posting about. Fixed dates are a month and a day; the moving
 * ones (both Easters, Lent, the Sundays before Christmas, Black Friday) are
 * worked out for whichever year is asked. Names and ideas are written in
 * both languages here rather than in i18n-sr.js, so a page can re-render
 * them when the reader switches language.
 */
(function () {
  function sr() {
    return !!(window.LBLang && LBLang.get() === "sr");
  }

  // Orthodox Easter (Meeus): a Julian-calendar date, 13 days behind the
  // Gregorian one until 2100.
  function orthodoxEaster(y) {
    var a = y % 4, b = y % 7, c = y % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var month = Math.floor((d + e + 114) / 31);
    var day = ((d + e + 114) % 31) + 1;
    return new Date(y, month - 1, day + 13);
  }

  // Western Easter (the anonymous Gregorian algorithm).
  function westernEaster(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100;
    var d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var n = h + l - 7 * m + 114;
    return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  }

  function shift(date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  // The Sundays before Orthodox Christmas (7 January of the next year):
  // Oci is the last one, Materice the one before.
  function sundayBeforeChristmas(y, weeksBack) {
    var d = new Date(y + 1, 0, 6);
    while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
    return shift(d, -7 * (weeksBack - 1));
  }

  // The Friday after the fourth Thursday of November.
  function blackFriday(y) {
    var first = new Date(y, 10, 1).getDay();
    return new Date(y, 10, 1 + ((4 - first + 7) % 7) + 21 + 1);
  }

  function fixed(month, day) {
    return function (y) { return new Date(y, month - 1, day); };
  }

  var DATES = [
    { key: "christmas", when: fixed(1, 7), lead: 14,
      en: ["Orthodox Christmas", "Your hours for Christmas Eve and Christmas Day, and something festive on the menu."],
      sr: ["Božić", "Radno vreme za Badnji dan i Božić, i nešto praznično u ponudi."] },
    { key: "orthodox-new-year", when: fixed(1, 14), lead: 14,
      en: ["Orthodox New Year", "A second New Year's party on the night of the 13th: music, a set menu or a late opening."],
      sr: ["Srpska Nova godina", "Drugi doček 13. uveče: muzika, set meni ili rad do kasno."] },
    { key: "st-sava", when: fixed(1, 27), lead: 10,
      en: ["St. Sava's Day", "A school holiday: something for families and kids — cakes, hot chocolate, a kids' menu."],
      sr: ["Sveti Sava", "Školska slava: nešto za porodice i decu — kolači, topla čokolada, dečji meni."] },
    { key: "valentines", when: fixed(2, 14), lead: 14,
      en: ["Valentine's Day", "A dinner or a dessert for two, a table worth booking, or a gift voucher."],
      sr: ["Dan zaljubljenih", "Večera ili desert za dvoje, sto vredan rezervacije ili poklon-vaučer."] },
    { key: "statehood", when: fixed(2, 15), lead: 10,
      en: ["Statehood Day (days off)", "Most people are off work: say when you're open and give them a reason to come by."],
      sr: ["Sretenje (neradni dani)", "Većina ne radi: reci kada si otvoren i daj im razlog da svrate."] },
    { key: "womens-day", when: fixed(3, 8), lead: 14,
      en: ["Women's Day", "A flower with every coffee, an offer for groups of friends, bookings for dinner."],
      sr: ["Dan žena", "Cvet uz kafu, ponuda za društvo, rezervacije za večeru."] },
    { key: "lent", when: function (y) { return shift(orthodoxEaster(y), -48); }, lead: 7,
      en: ["Lent begins", "Many guests fast for seven weeks: put your fasting (vegan) dishes and cakes up front."],
      sr: ["Počinje Uskršnji post", "Mnogi gosti poste sedam nedelja: istakni posna jela i kolače."] },
    { key: "catholic-easter", when: westernEaster, lead: 10,
      en: ["Catholic Easter", "Especially in Vojvodina: a holiday breakfast and your opening hours."],
      sr: ["Katolički Uskrs", "Posebno u Vojvodini: praznični doručak i radno vreme za praznike."] },
    { key: "terraces", when: fixed(4, 15), lead: 10,
      en: ["Terrace season starts", "Say the garden or the terrace is open — one sunny photo of it does the work."],
      sr: ["Počinje sezona bašti", "Najavi da je bašta otvorena — jedna fotografija bašte na suncu radi posao."] },
    { key: "orthodox-easter", when: orthodoxEaster, lead: 14,
      en: ["Orthodox Easter", "Easter breakfast, your hours from Good Friday to Monday, painted eggs on the table."],
      sr: ["Vaskrs", "Uskršnji doručak, radno vreme od Velikog petka do ponedeljka, šarena jaja na stolu."] },
    { key: "may-day", when: fixed(5, 1), lead: 14,
      en: ["May Day (long weekend)", "Your hours, food to take on a trip out, or a reason to stay in town."],
      sr: ["Prvi maj (produženi vikend)", "Radno vreme, hrana za poneti na izlet ili razlog da se ostane u gradu."] },
    { key: "djurdjevdan", when: fixed(5, 6), lead: 14,
      en: ["St. George's Day (Đurđevdan)", "One of the most common slavas: bookings for celebrations, cakes to order."],
      sr: ["Đurđevdan", "Jedna od najčešćih slava: rezervacije za proslave, torte i kolači po porudžbini."] },
    { key: "proms", when: fixed(5, 25), lead: 14,
      en: ["Prom season", "Graduates and their families: bookings for groups, a spot for photos, cakes."],
      sr: ["Maturske večeri", "Maturanti i njihove porodice: rezervacije za grupe, mesto za slikanje, torte."] },
    { key: "summer", when: fixed(6, 15), lead: 7,
      en: ["Summer starts", "Iced coffee, lemonade, ice cream — whatever cools people down, with a photo of it."],
      sr: ["Počinje leto", "Ledena kafa, limunada, sladoled — šta god rashlađuje, sa fotografijom."] },
    { key: "school", when: fixed(9, 1), lead: 10,
      en: ["Back to school", "Parents in a hurry: coffee to go, breakfast for school kids, an early opening."],
      sr: ["Početak škole", "Roditelji u žurbi: kafa za poneti, doručak za đake, rano otvaranje."] },
    { key: "coffee-day", when: fixed(10, 1), lead: 7,
      en: ["International Coffee Day", "A coffee of the day, the second one at half price, or a cookie with every cup."],
      sr: ["Međunarodni dan kafe", "Kafa dana, druga upola cene ili kolačić uz svaku šoljicu."] },
    { key: "halloween", when: fixed(10, 31), lead: 10,
      en: ["Halloween", "For a younger crowd: a themed night, a discount in costume, a spooky dessert."],
      sr: ["Noć veštica", "Za mlađu publiku: tematsko veče, popust u kostimu, „strašan“ desert."] },
    { key: "armistice", when: fixed(11, 11), lead: 7,
      en: ["Armistice Day (day off)", "A day off in the middle of the week for many: say you're open and what's on."],
      sr: ["Dan primirja (neradni dan)", "Neradni dan usred nedelje za mnoge: reci da radiš i šta je u ponudi."] },
    { key: "arandjelovdan", when: fixed(11, 21), lead: 14,
      en: ["St. Michael's Day (Aranđelovdan)", "A slava for many families: bookings and catering for the day."],
      sr: ["Aranđelovdan", "Slava mnogih porodica: rezervacije i ketering za taj dan."] },
    { key: "black-friday", when: blackFriday, lead: 10,
      en: ["Black Friday", "A one-day offer, or gift vouchers people buy now and use later."],
      sr: ["Crni petak", "Ponuda za jedan dan ili poklon-vaučeri koji se kupe sada, a iskoriste kasnije."] },
    { key: "christmas-fast", when: fixed(11, 28), lead: 7,
      en: ["Christmas fast begins", "Six weeks of fasting for many guests: put your fasting (vegan) dishes up front."],
      sr: ["Počinje Božićni post", "Šest nedelja posta za mnoge goste: istakni posna jela."] },
    { key: "gifts", when: fixed(12, 1), lead: 7,
      en: ["Holiday gift season", "Gift vouchers and holiday boxes — easy to buy, easy to give."],
      sr: ["Sezona prazničnih poklona", "Poklon-vaučeri i praznični paketi — lako se kupuju, lako se poklanjaju."] },
    { key: "materice", when: function (y) { return sundayBeforeChristmas(y, 2); }, lead: 10,
      en: ["Mothers' Day (Materice)", "An offer for mums: a dessert, a flower or a discount for mothers."],
      sr: ["Materice", "Ponuda za mame: desert, cvet ili popust za majke."] },
    { key: "nikoljdan", when: fixed(12, 19), lead: 21,
      en: ["St. Nicholas Day (Nikoljdan)", "The most common slava: bookings for celebrations, fasting dishes, cakes to order."],
      sr: ["Nikoljdan", "Najčešća slava: rezervacije za proslave, posni meni, torte i kolači po porudžbini."] },
    { key: "oci", when: function (y) { return sundayBeforeChristmas(y, 1); }, lead: 7,
      en: ["Fathers' Day (Oci)", "An offer for dads, on the Sunday before Christmas."],
      sr: ["Oci", "Ponuda za očeve, poslednje nedelje pred Božić."] },
    { key: "new-years-eve", when: fixed(12, 31), lead: 28,
      en: ["New Year's Eve", "Bookings for the night: the menu, the price and how many seats are left. People plan this one weeks ahead."],
      sr: ["Doček Nove godine", "Rezervacije za doček: meni, cena i koliko je mesta ostalo. Ljudi ovo planiraju nedeljama unapred."] }
  ];

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Every date from `from` for the next `days` days, soonest first, in the
  // reader's language. id is unique per occurrence ("valentines-2027").
  function between(from, days) {
    var start = startOfDay(from);
    var end = shift(start, days);
    var out = [];
    for (var y = start.getFullYear() - 1; y <= end.getFullYear(); y++) {
      DATES.forEach(function (x) {
        var date = x.when(y);
        if (date < start || date >= end) return;
        var text = sr() ? x.sr : x.en;
        out.push({
          id: x.key + "-" + date.getFullYear(),
          key: x.key,
          date: date,
          name: text[0],
          idea: text[1],
          lead: x.lead,
          postFrom: shift(date, -x.lead),
          names: [x.en[0], x.sr[0]]
        });
      });
    }
    return out.sort(function (a, b) { return a.date - b.date; });
  }

  function daysUntil(date) {
    return Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  }

  window.LBDates = { between: between, daysUntil: daysUntil };
})();
