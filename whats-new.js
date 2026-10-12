/* What's new in Adronis: the changes a customer would notice, newest first.
 * whats-new.html lists them all, next to the team's notes from the portal
 * (the updates table); the control room's "new in Adronis" card offers the
 * ones this device hasn't seen yet.
 *
 * Add an entry at the top when something a customer can see ships. date is
 * the day it went live; asked: true marks the ones testers asked for, so they
 * see their feedback turn into changes. Like dates-rs.js, both languages are
 * written here rather than in i18n-sr.js, so a page can re-render them when
 * the reader switches language.
 *
 * What counts as "seen" is kept on this device only: the newest date the
 * reader has looked at. An account never counts what shipped before it was
 * made, so a new tester doesn't open to a pile of old news.
 */
(function () {
  var ENTRIES = [
    {
      date: "2026-10-12",
      en: ["Latin or Cyrillic",
        "Pick the alphabet your ads are written in, under Account → Your business. It changes the letters, never the words."],
      sr: ["Latinica ili ćirilica",
        "Izaberi pismo kojim se pišu tvoji oglasi, pod Nalog → Tvoj biznis. Menja slova, nikad reči."]
    },
    {
      date: "2026-10-12",
      en: ["Ads that fit the weather",
        "The control room shows the week's forecast for your town, and your ads follow it: something warm when it rains, cold drinks in a heat wave. One switch turns it off."],
      sr: ["Oglasi koji prate vreme",
        "Kontrolna soba pokazuje prognozu za tvoj grad za celu nedelju, a oglasi je prate: nešto toplo kad pada kiša, hladna pića po vrućini. Jedan prekidač to isključuje."]
    },
    {
      date: "2026-10-12",
      en: ["What's on in your town",
        "\"Coming up\" now includes your town's own days — its slava, its festivals, big matches — so you can plan an ad for them in time."],
      sr: ["Šta se dešava u tvom gradu",
        "\"Uskoro\" sada uključuje i dane tvog grada — gradsku slavu, festivale, velike utakmice — da na vreme isplaniraš oglas za njih."]
    },
    {
      date: "2026-10-12",
      en: ["Notifications on your phone",
        "Turn them on in the control room and your phone tells you when new ads arrive, the evening before unanswered ones expire, and when an ad goes live."],
      sr: ["Obaveštenja na telefonu",
        "Uključi ih u kontrolnoj sobi i telefon će ti javiti kad stignu novi oglasi, veče pre nego što neodgovoreni isteknu i kad oglas izađe."]
    },
    {
      date: "2026-10-12",
      en: ["Tell us the days you're closed",
        "Holidays, a week off, a private event — mark them in the control room and nothing posts on those days."],
      sr: ["Javi nam kad ne radiš",
        "Praznici, godišnji odmor, zatvoreno zbog proslave — označi dane u kontrolnoj sobi i tada se ništa ne objavljuje."]
    },
    {
      date: "2026-10-12",
      en: ["Your posting plan in your own calendar",
        "\"Add to my calendar\" in the control room downloads every ad still to post, so it shows in your phone's calendar."],
      sr: ["Raspored objava u tvom kalendaru",
        "\"Dodaj u moj kalendar\" u kontrolnoj sobi preuzima sve oglase koji tek treba da izađu, pa ih vidiš u kalendaru na telefonu."]
    },
    {
      date: "2026-10-12",
      en: ["Faster \"never in my ads\"",
        "The most common things owners rule out are now one tap each, under \"Anything to avoid\"."],
      sr: ["Brže \"nikad u mojim oglasima\"",
        "Ono što vlasnici najčešće isključuju sada je jedan dodir, ispod \"Šta treba izbegavati\"."]
    },
    {
      date: "2026-10-11",
      en: ["Auto-approve",
        "No time to look every week? Switch it on in Approvals and any ad you don't get to within 48 hours is approved for you. The ones you decide yourself stay your call."],
      sr: ["Automatsko odobravanje",
        "Nemaš vremena da gledaš svake nedelje? Uključi ga u Odobravanjima i svaki oglas na koji ne stigneš za 48 sati biće odobren umesto tebe. O onima koje pogledaš i dalje odlučuješ ti."]
    },
    {
      date: "2026-10-11",
      en: ["See an ad as a real post",
        "Before you approve, open any ad as it will look on Instagram or Facebook."],
      sr: ["Oglas kao prava objava",
        "Pre nego što odobriš, otvori oglas onako kako će izgledati na Instagramu ili Fejsbuku."]
    },
    {
      date: "2026-10-11",
      en: ["A monthly report",
        "In the first week of each month, one page with what arrived, what you approved, what went out and what brought people in — ready to print."],
      sr: ["Mesečni izveštaj",
        "U prvoj nedelji svakog meseca, jedna stranica sa onim što je stiglo, šta si odobrio, šta je objavljeno i šta je dovelo ljude — spremno za štampu."]
    },
    {
      date: "2026-10-11",
      en: ["Unanswered ads now expire",
        "Ads you didn't answer by the time next week's arrive are set aside, so the week you're looking at is always the current one. They never post, and you can still see them in Approvals."],
      sr: ["Neodgovoreni oglasi sada ističu",
        "Oglasi na koje nisi odgovorio do stizanja novih se sklanjaju, pa uvek gledaš tekuću nedelju. Nikad se ne objavljuju, a i dalje ih vidiš u Odobravanjima."]
    },
    {
      date: "2026-10-11",
      en: ["Open a live ad's post",
        "An ad that's already out links straight to its post."],
      sr: ["Otvori objavu oglasa",
        "Oglas koji je već izašao vodi pravo na svoju objavu."]
    },
    {
      date: "2026-10-11",
      en: ["Adronis on your home screen",
        "Add it to your phone's home screen and it opens like an app."],
      sr: ["Adronis na početnom ekranu",
        "Dodaj ga na početni ekran telefona i otvara se kao aplikacija."]
    },
    {
      date: "2026-10-10",
      en: ["Your first week, step by step",
        "Until your first ads arrive, the control room shows when they land and how the week goes from there."],
      sr: ["Tvoja prva nedelja, korak po korak",
        "Dok ne stignu prvi oglasi, kontrolna soba pokazuje kad stižu i kako nedelja ide dalje."]
    }
  ];

  var SEEN_KEY = "lb-whats-new-seen";

  function sr() {
    return !!(window.LBLang && LBLang.get() === "sr");
  }

  function stored() {
    try { return localStorage.getItem(SEEN_KEY) || ""; } catch (e) { return ""; }
  }

  // The newest day this reader has already caught up to: what they last saw
  // here, or the day their account was made, whichever is later.
  function baseline() {
    var profile = (window.LBAuth && LBAuth.getProfile()) || {};
    var made = profile.created_at ? String(profile.created_at).slice(0, 10) : "";
    var seen = stored();
    return seen > made ? seen : made;
  }

  window.LBWhatsNew = {
    entries: ENTRIES,

    // { title, body } in the reader's language.
    text: function (entry) {
      var t = sr() ? entry.sr : entry.en;
      return { title: t[0], body: t[1] };
    },

    // Entries shipped after this reader last caught up, newest first.
    fresh: function () {
      var since = baseline();
      return ENTRIES.filter(function (e) { return e.date > since; });
    },

    markSeen: function () {
      try { localStorage.setItem(SEEN_KEY, ENTRIES[0].date); } catch (e) {}
      document.dispatchEvent(new CustomEvent("lb:newsseen"));
    }
  };
})();
