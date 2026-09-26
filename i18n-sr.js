/* Serbian copy for the site, keyed by the English original.
 *
 * i18n.js looks every visible string up in here by its English text, with
 * whitespace collapsed. A string that is missing from this file stays in
 * English rather than breaking, so a new paragraph on a page is a one-line
 * addition here whenever someone gets to it.
 *
 * Rules of thumb when adding to this file:
 *   - Key on the exact English wording, collapsed to single spaces.
 *   - Leave the brand name, plan names, channel names and anything inside
 *     {{ }} template braces alone.
 *   - A string that is identical in both languages does not need an entry.
 */
window.LB_I18N_SR = {
  strings: {

    /* --- Navigation, footer, shared chrome ------------------------------- */
    "The drop": "Drop",
    "Engine": "Mašina",
    "Control room": "Kontrolna soba",
    "Approvals": "Odobravanja",
    "Pricing": "Cene",
    "Log in": "Prijava",
    "Log in or sign up": "Prijava ili registracija",
    "Sign up": "Registracija",
    "Start free drop": "Pokreni besplatan drop",
    "Account": "Nalog",
    "Menu": "Meni",

    /* --- Cookie consent card (cookies.js) -------------------------------- */
    "Cookies on this site": "Kolačići na ovom sajtu",
    "We use cookies and local storage to keep you signed in and remember your preferences. No ads, no trackers.":
      "Koristimo kolačiće i lokalno skladište da ostaneš prijavljen i da zapamtimo tvoja podešavanja. Bez oglasa, bez praćenja.",
    "Privacy policy": "Politika privatnosti",
    "Essential only": "Samo neophodni",
    "Accept all": "Prihvati sve",
    "Weekly ad drops for businesses with no marketing department.":
      "Nedeljni dropovi oglasa za biznise bez marketing odeljenja.",
    "PRODUCT": "PROIZVOD",
    "The weekly drop": "Nedeljni drop",
    "COMPANY": "KOMPANIJA",
    "About": "O nama",
    "Contact": "Kontakt",
    "Message us": "Piši nam",
    "LEGAL": "PRAVNO",
    "Terms": "Uslovi",
    "Privacy": "Privatnost",
    "AI disclosure": "AI obaveštenje",
    "Company details": "Podaci o firmi",
    "ALL CREATIVES AI-GENERATED AND HUMAN-APPROVED":
      "SVI KREATIVI SU AI-GENERISANI I LJUDSKI ODOBRENI",
    "EMAIL": "EMAIL",
    "BUSINESS NAME": "NAZIV BIZNISA",
    "NAME": "IME",
    "PASSWORD": "LOZINKA",
    "MESSAGE": "PORUKA",
    "Full name": "Ime i prezime",
    "Your name": "Tvoje ime",
    "Your password": "Tvoja lozinka",
    "Create a password": "Napravi lozinku",
    "e.g. Milena's Bakery": "npr. Milenina pekara",
    "you@example.com": "ti@primer.com",
    "you@business.com": "ti@biznis.com",
    "Company (leave empty)": "Firma (ostavi prazno)",

    /* --- 404 ------------------------------------------------------------- */
    "Page not found — Adronis": "Stranica nije pronađena — Adronis",
    "This page never made it into": "Ova stranica nikad nije ušla u",
    "the drop": "drop",
    "Whatever you're looking for isn't here — might be a broken link, might be a page that moved. Everything that matters is still one click away.":
      "Ono što tražiš nije ovde — možda je link pokvaren, možda se stranica premestila. Sve što je važno je i dalje na jedan klik.",
    "Back to Adronis": "Nazad na Adronis",
    "Tell us it's broken": "Javi nam da je pokvareno",
    "Priced per drop, not per meeting.": "Plaća se po dropu, ne po sastanku.",
    "Approve this week's creatives.": "Odobri ovonedeljne kreative.",
    "Login, channels and billing.": "Prijava, kanali i naplata.",

    /* --- About ----------------------------------------------------------- */
    "About Adronis — AI Ad Drops for Local Businesses":
      "O Adronisu — AI dropovi oglasa za lokalne biznise",
    "ABOUT": "O NAMA",
    "ABOUT ADRONIS": "O ADRONISU",
    "We built the marketing department most local businesses can't afford to hire.":
      "Napravili smo marketing odeljenje koje većina lokalnih biznisa ne može sebi da priušti.",
    "Adronis renders, approves and publishes a fresh batch of ads every week for owners who are too busy running the shop to run a feed.":
      "Adronis svake nedelje renderuje, propušta kroz odobravanje i objavljuje novu turu oglasa za vlasnike koji su previše zauzeti vođenjem radnje da bi vodili i profil.",
    "The problem we kept seeing": "Problem koji smo stalno viđali",
    "Every operator we talked to had the same story: they knew they should be posting, they had no time to shoot, write or schedule anything, and the one week they skipped turned into a quiet quarter. Not because the coffee got worse — because nobody was telling anyone it existed.":
      "Svaki vlasnik sa kojim smo razgovarali imao je istu priču: znali su da bi trebalo da objavljuju, nisu imali vremena da bilo šta snime, napišu ili zakažu, a jedna preskočena nedelja pretvorila se u tih kvartal. Ne zato što je kafa postala lošija — nego zato što niko nikome nije govorio da postoji.",
    "Agencies wanted retainers built for brands with a marketing budget line item. Freelancers needed briefs, and writing a good brief takes almost as long as making the ad yourself. So the shop went quiet, and stayed quiet.":
      "Agencije su tražile mesečne paušale skrojene za brendove koji u budžetu imaju stavku za marketing. Frilenserima je trebao brif, a pisanje dobrog brifa traje skoro koliko i da sam napraviš oglas. Tako je radnja utihnula, i ostala tiha.",
    "What Adronis does instead": "Šta Adronis radi umesto toga",
    "We brief the engine once — your voice, your palette, your street — and it renders a full week of photoreal, on-brand creative every Monday morning. You spend two minutes swiping to approve. Everything that survives gets resized, captioned and published to the channels where your customers already are.":
      "Mašinu brifujemo jednom — tvoj ton, tvoja paleta, tvoja ulica — i ona svakog ponedeljka ujutru renderuje celu nedelju fotorealističnih kreativa u duhu tvog brenda. Ti potrošiš dva minuta na prevlačenje i odobravanje. Sve što prođe dobija formate, opise i objavu na kanalima gde su tvoje mušterije ionako već tu.",
    "Why it's built this way": "Zašto je napravljen baš ovako",
    "Adronis is built on one assumption: you will never reliably have time to make the ads yourself. So the product never asks you to. No brief queue, no revision calls, no monthly strategy meeting — just a drop that lands whether or not you had a good week.":
      "Adronis počiva na jednoj pretpostavci: nikad nećeš pouzdano imati vremena da sam praviš oglase. Zato proizvod to od tebe nikad i ne traži. Bez reda brifova, bez poziva za korekcije, bez mesečnog sastanka o strategiji — samo drop koji stiže bez obzira na to kakvu si nedelju imao.",
    "DROPS PER YEAR": "DROPOVA GODIŠNJE",
    "Who's behind it": "Ko stoji iza toga",
    "Adronis is built by a small team of engineers and former agency creative directors who got tired of watching good local businesses lose to silence, not competition. We'd rather ship a better engine than a bigger sales team.":
      "Adronis gradi mali tim inženjera i bivših kreativnih direktora iz agencija, kojima je dosadilo da gledaju kako dobri lokalni biznisi gube od tišine, a ne od konkurencije. Radije ćemo isporučiti bolju mašinu nego veći prodajni tim.",
    "Talk to us": "Razgovarajmo",

    /* --- Contact --------------------------------------------------------- */
    "Contact Adronis — Talk to Sales": "Kontakt — razgovor sa prodajom",
    "CONTACT": "KONTAKT",
    "TALK TO US": "RAZGOVARAJMO",
    "Tell us about the shop. We'll tell you what the first drop looks like.":
      "Ispričaj nam o radnji. Mi ćemo ti reći kako izgleda prvi drop.",
    "Franchise and multi-location accounts get a human on the other end before the engine ever renders a frame.":
      "Nalozi za franšize i više lokacija dobijaju živog čoveka sa druge strane pre nego što mašina renderuje i jedan kadar.",
    "YOUR NAME": "TVOJE IME",
    "PLAN INTEREST": "PLAN KOJI TE ZANIMA",
    "Not sure yet": "Još nisam siguran",
    "Number of locations, verticals, channels you're on today...":
      "Broj lokacija, tipovi biznisa, kanali na kojima si danas...",
    "Send message": "Pošalji poruku",
    "We use what you send here only to answer you, and we keep it for up to 24 months. We do not sell it and we do not add you to a marketing list without your consent. See the":
      "Ono što pošalješ ovde koristimo samo da ti odgovorimo i čuvamo do 24 meseca. Ne prodajemo te podatke i ne dodajemo te na marketinšku listu bez tvoje saglasnosti. Pogledaj",
    ", or ask us to delete your message at": ", ili nam piši da obrišemo tvoju poruku na",
    ". Please do not send sensitive personal data through this form.":
      ". Molimo te da kroz ovu formu ne šalješ osetljive lične podatke.",
    "Thanks — a real person reads every message here and replies within one business day.":
      "Hvala — svaku poruku ovde čita živ čovek i odgovara u roku od jednog radnog dana.",

    /* --- Message us ------------------------------------------------------ */
    "Message us — Adronis": "Piši nam — Adronis",
    "MESSAGE US": "PIŠI NAM",
    "SAY HELLO": "JAVI SE",
    "Got something on your mind? Send it over.": "Imaš nešto na umu? Pošalji.",
    "No plan question, no sales pitch needed — feedback, a bug, a random idea, or just a hello all land in the same inbox.":
      "Nije potrebno pitanje o planu ni prodajni razgovor — utisak, bag, usputna ideja ili samo pozdrav stižu u isto sanduče.",
    "Whatever you'd like to tell us...": "Šta god želiš da nam kažeš...",
    "Sent — thanks for reaching out. We read every message here, no auto-replies.":
      "Poslato — hvala što si se javio. Čitamo svaku poruku, bez automatskih odgovora.",
    "Looking to talk about a plan or a franchise rollout instead?":
      "Ipak želiš da razgovaramo o planu ili uvođenju franšize?",
    "Talk to us here": "Piši nam ovde",

    /* --- Log in ---------------------------------------------------------- */
    "Log in — Adronis": "Prijava — Adronis",
    "LOG IN": "PRIJAVA",
    "Log in to Adronis.": "Prijavi se na Adronis.",
    "Forgot your password?": "Zaboravio si lozinku?",
    "Reset your password.": "Resetuj lozinku.",
    "Enter the email you log in with and we'll send you a link to choose a new password.":
      "Upiši email kojim se prijavljuješ i poslaćemo ti link za novu lozinku.",
    "Send reset link": "Pošalji link",
    "Back to log in": "Nazad na prijavu",
    "If an account uses that email, a reset link is on its way. The link works once.":
      "Ako postoji nalog sa tim emailom, link za novu lozinku stiže za koji trenutak. Link radi samo jednom.",
    "That link has expired or was already used. Ask for a new one below.":
      "Taj link je istekao ili je već iskorišćen. Zatraži novi ispod.",
    "Choose a new password.": "Izaberi novu lozinku.",
    "Set a new password to get back into your account. If you leave this page without one, you stay logged out.":
      "Postavi novu lozinku da se vratiš u nalog. Ako napustiš ovu stranicu bez nove lozinke, ostaješ odjavljen.",
    "Save new password": "Sačuvaj novu lozinku",
    "Those two passwords don't match.": "Te dve lozinke se ne poklapaju.",
    "Password changed — taking you to your control room...":
      "Lozinka je promenjena — vodim te u kontrolnu sobu...",
    "This reset link has run out. Ask for a new one.":
      "Ovaj link za novu lozinku više ne važi. Zatraži novi.",
    "Access your control room, or create a quick account to hold your spot.":
      "Uđi u svoju kontrolnu sobu ili brzo napravi nalog da rezervišeš mesto.",
    "Email:": "Email:",
    "Free trial started:": "Besplatni period počeo:",
    "Free trial ends:": "Besplatni period ističe:",
    "Review this week's drop": "Pregledaj ovonedeljni drop",

    /* --- Control room ---------------------------------------------------- */
    "Control room — Adronis": "Kontrolna soba — Adronis",
    "What's scheduled, what's live.": "Šta je zakazano, šta je objavljeno.",
    "Pulled straight from your account — every approved creative and when it posts, every creative that's already out.":
      "Povučeno direktno sa tvog naloga — svaki odobreni kreativ i kad izlazi, i svaki koji je već napolju.",
    "Log in to see your control room.": "Prijavi se da vidiš svoju kontrolnu sobu.",
    "Your schedule is tied to your account — sign in and it loads here.":
      "Tvoj raspored je vezan za nalog — prijavi se i učitaće se ovde.",
    "LOADING YOUR CONTROL ROOM": "UČITAVAM TVOJU KONTROLNU SOBU",
    "SCHEDULED TO POST": "ZAKAZANO ZA OBJAVU",
    "LIVE SO FAR": "DO SADA OBJAVLJENO",
    "WAITING ON YOU": "ČEKA TEBE",
    "Review approvals →": "Pregledaj odobravanja →",
    "NOTHING SLOTTED YET": "JOŠ NIŠTA NIJE ZAKAZANO",
    "Nothing scheduled right now.": "Trenutno ništa nije zakazano.",
    "Approve a creative and, once the engine slots it into a posting window, it'll show up here with a day and time.":
      "Odobri kreativ i, čim ga mašina smesti u termin za objavu, pojaviće se ovde sa danom i vremenom.",
    "ALREADY LIVE": "VEĆ OBJAVLJENO",
    "NOTHING PUBLISHED YET": "JOŠ NIŠTA NIJE OBJAVLJENO",
    "Nothing has posted yet.": "Još ništa nije objavljeno.",
    "Once a scheduled creative goes out, it lands here with the exact time it posted.":
      "Čim zakazani kreativ izađe, sleće ovde sa tačnim vremenom objave.",
    "Nothing to show yet.": "Još nema šta da se prikaže.",
    "Once your first drop renders and you approve a few creatives, this is where you'll see exactly what's posting and when.":
      "Kad se tvoj prvi drop izrenderuje i odobriš par kreativa, ovde ćeš videti tačno šta izlazi i kada.",

    /* --- Home page: hero and proof --------------------------------------- */
    "Adronis — weekly ad drops for local business":
      "Adronis — nedeljni dropovi oglasa za lokalni biznis",
    "DROP 34 RENDERING — MON 09:00": "DROP 34 SE RENDERUJE — PON 09:00",
    "Your next forty ads are": "Narednih 40 oglasa je",
    "already": "već",
    "in production.": "u produkciji.",
    "Adronis renders a fresh batch of photoreal ads for your business every week — shot in your voice, set in your city — then publishes them to your channels while you run the shop.":
      "Adronis svake nedelje renderuje novu turu fotorealističnih oglasa za tvoj biznis — snimljenih tvojim tonom, u tvom gradu — i objavljuje ih na tvojim kanalima dok ti vodiš radnju.",
    "Claim your first drop": "Uzmi svoj prvi drop",
    "Open the engine": "Otvori mašinu",
    "Ads per week": "Oglasa nedeljno",
    "ADS, UP TO": "OGLASA, DO",
    "CHANNELS SUPPORTED": "PODRŽANIH KANALA",
    "BRIEFS YOU WRITE": "BRIFOVA KOJE TI PIŠEŠ",
    "CREATIVE 34-01 · REEL 9:16": "KREATIV 34-01 · REEL 9:16",
    "Saturday tasting, 4pm.": "Subotnja degustacija, 16h.",
    "\"Saturday tasting, 4pm.\"": "„Subotnja degustacija, 16h.“",
    "Autoposted · Instagram, TikTok": "Automatski objavljeno · Instagram, TikTok",
    "QUEUE": "RED ČEKANJA",
    "Mon 18:30 · Story": "Pon 18:30 · Story",
    "Wed 12:00 · Feed": "Sre 12:00 · Feed",
    "Fri 17:15 · Reel": "Pet 17:15 · Reel",
    "+9 CREATIVES APPROVED": "+9 KREATIVA ODOBRENO",
    "Built for operators with no marketing department.":
      "Napravljeno za vlasnike bez marketing odeljenja.",
    "NINE VERTICALS": "DEVET TIPOVA BIZNISA",
    "ONE ENGINE": "JEDNA MAŠINA",
    "Bakeries": "Pekare",
    "Barbershops": "Berbernice",
    "Dental clinics": "Stomatološke ordinacije",
    "Gyms & studios": "Teretane i studiji",
    "Wine bars": "Vinski barovi",
    "Florists": "Cvećare",
    "Auto detailers": "Auto-detailing",
    "Physiotherapy": "Fizioterapija",
    "Nail studios": "Nail studiji",

    /* --- Home page: the argument ----------------------------------------- */
    "01 — THE COST OF GOING QUIET": "01 — CENA TIŠINE",
    "A great local business dies of": "Odličan lokalni biznis umire od",
    "silence": "tišine",
    ", not of bad coffee.": ", a ne od loše kafe.",
    "You are the product, the staff, the bookkeeper and the marketing department. The marketing department is the one that gets cut. Two weeks of no posts becomes two months, and the feed forgets you exist.":
      "Ti si i proizvod, i osoblje, i knjigovodstvo, i marketing odeljenje. Marketing odeljenje je ono koje prvo otpada. Dve nedelje bez objava postanu dva meseca, i feed zaboravi da postojiš.",
    "Adronis is built on one assumption: you will never have time to make the ads. So the ads arrive made.":
      "Adronis počiva na jednoj pretpostavci: nikad nećeš imati vremena da praviš oglase. Zato oglasi stižu gotovi.",
    "A batch every Monday, all year — whether or not you had a good week.":
      "Tura svakog ponedeljka, cele godine — bez obzira na to kakvu si nedelju imao.",
    "9:16, 4:5, 1:1 and 16:9 rendered from the same scene, not cropped from one.":
      "9:16, 4:5, 1:1 i 16:9 renderovani iz iste scene, a ne isečeni iz jedne.",
    "Spent on an agency retainer, a photographer, or a Monday-morning idea.":
      "Potrošeno na agencijski paušal, fotografa ili ideju u ponedeljak ujutru.",
    "02 — THE WEEKLY DROP": "02 — NEDELJNI DROP",
    "Four moves. You are involved in one of them.":
      "Četiri koraka. Ti učestvuješ u jednom.",
    "03 — THE ENGINE": "03 — MAŠINA",
    "One drop, rendered every way your channels want it.":
      "Jedan drop, renderovan na svaki način koji tvoji kanali traže.",
    "DRAG TO ROTATE THE DRUM": "PREVUCI DA OKRENEŠ DOBOŠ",
    "Brand fingerprint": "Otisak brenda",
    "Palette, tone, props, the way your shop actually looks. Locked once, reused forever.":
      "Paleta, ton, rekviziti, način na koji tvoja radnja stvarno izgleda. Zaključa se jednom, koristi zauvek.",
    "Seasonal hooks": "Sezonske kuke",
    "Local holidays, weather, school terms, match days. The engine knows what week it is.":
      "Lokalni praznici, vreme, školski raspusti, dani utakmica. Mašina zna koja je nedelja.",
    "Native formats": "Nativni formati",
    "9:16, 4:5, 1:1 and 16:9 rendered from the same scene — never a cropped afterthought.":
      "9:16, 4:5, 1:1 i 16:9 renderovani iz iste scene — nikad naknadno isečeni.",
    "Realism guardrails": "Zaštita od promašaja",
    "Automated checks for distorted hands, invented prices and borrowed trade marks. Low-confidence output is re-rendered, not queued — see the":
      "Automatske provere za izobličene ruke, izmišljene cene i tuđe zaštitne znakove. Ono u šta mašina nije sigurna se ponovo renderuje umesto da čeka u redu — pogledaj",
    "for what they catch and what they miss.":
      "da vidiš šta te provere hvataju, a šta im promakne.",
    "CONTROL ROOM": "KONTROLNA SOBA",
    "04 — YOUR SIDE OF THE GLASS": "04 — TVOJA STRANA STAKLA",
    "Two minutes on Monday. Everything else is already handled.":
      "Dva minuta u ponedeljak. Sve ostalo je već odrađeno.",
    "DROP 34 READY": "DROP 34 SPREMAN",
    "REACH · LAST 8 WEEKS": "DOSEG · POSLEDNJIH 8 NEDELJA",
    "BEST PERFORMER": "NAJBOLJI REZULTAT",
    "14.2k reach · 61 saves · 9 DMs": "14,2k dosega · 61 čuvanje · 9 poruka",
    "ENGINE LEARNED": "MAŠINA NAUČILA",
    "Which slots your audience responds to, fed back into the next drop.":
      "Na koje termine tvoja publika reaguje — vraća se u sledeći drop.",
    "SAMPLE INTERFACE · ILLUSTRATIVE FIGURES, NOT A FORECAST":
      "PRIMER INTERFEJSA · ILUSTRATIVNI BROJEVI, NISU PROGNOZA",
    "05 — DISTRIBUTION": "05 — DISTRIBUCIJA",
    "Approved at 09:02.": "Odobreno u 09:02.",
    "Live": "Objavljeno",
    "at 09:03.": "u 09:03.",
    "Connect a channel once. Every approved creative is resized, captioned, hashtagged and slotted into the window where your audience is actually awake.":
      "Kanal povežeš jednom. Svaki odobreni kreativ dobija format, opis, heštegove i termin u kom je tvoja publika zaista budna.",
    "Your drop": "Tvoj drop",
    "FEED + LOCAL GROUPS": "FEED + LOKALNE GRUPE",
    "9:16 NATIVE": "9:16 NATIVNO",
    "OFFER POSTS": "OBJAVE SA PONUDOM",
    "SEASONAL PINS": "SEZONSKI PINOVI",
    "APPROVED 09:02 · LIVE 09:03": "ODOBRENO 09:02 · OBJAVLJENO 09:03",
    "06 — WHAT MONDAY LOOKS LIKE": "06 — KAKO IZGLEDA PONEDELJAK",
    "A batch of creatives is waiting in your queue when the week starts — built from the brief you wrote once.":
      "Kad nedelja počne, u tvom redu već čeka tura kreativa — napravljena po brifu koji si napisao jednom.",
    "You swipe through them and keep what fits. Nothing publishes until you approve it.":
      "Prelistaš ih i zadržiš ono što ti odgovara. Ništa se ne objavljuje dok ti ne odobriš.",
    "What survives is resized, captioned and posted to every channel you connected, at the slot you set.":
      "Ono što prođe dobija pravu veličinu i opis i objavljuje se na svakom kanalu koji si povezao, u terminu koji si podesio.",

    /* --- Home page: FAQ -------------------------------------------------- */
    "FAQ": "Pitanja",
    "07 — QUESTIONS": "07 — PITANJA",
    "What owners ask before they sign up.": "Šta vlasnici pitaju pre prijave.",
    "Didn't find yours? Write to us and we'll get back to you.":
      "Nema tvog pitanja? Piši nam i javićemo ti se.",
    "What exactly do I get each week?": "Šta tačno dobijam svake nedelje?",
    "A drop of finished ads — image, headline and caption — already sized for every channel you picked. How many depends on your plan, from 4 a week on Counter to 30 on Franchise.":
      "Drop gotovih reklama — slika, naslov i tekst objave — već prilagođenih svakom kanalu koji si izabrao. Koliko ih je zavisi od paketa: od 4 nedeljno na Counter do 30 na Franchise.",
    "Do I need to take photos or write anything?": "Moram li ja nešto da slikam ili pišem?",
    "No. You tell us about your business once when you sign up, which takes about ten minutes. The engine takes it from there. You can add more detail later in your control room, but none of it is required.":
      "Ne. Jednom nam pri registraciji opišeš svoj biznis, za to treba desetak minuta. Dalje radi mašina. Kasnije možeš dodati još detalja u kontrolnoj sobi, ali ništa od toga nije obavezno.",
    "How much of my time does it take?": "Koliko mi vremena treba?",
    "A couple of minutes a week. Open your approvals, keep the ads you like and turn down the rest. That is the only step that needs you.":
      "Par minuta nedeljno. Otvoriš odobravanja, zadržiš reklame koje ti se sviđaju i odbiješ ostale. To je jedini korak za koji si potreban.",
    "What if I don't like an ad?": "Šta ako mi se neka reklama ne sviđa?",
    "Reject it and pick a reason, like wrong tone or too dark. The reasons shape what the engine makes for you next. You can also fix a headline or caption yourself before you approve.":
      "Odbiješ je i izabereš razlog, na primer pogrešan ton ili previše tamno. Razlozi oblikuju ono što ti mašina pravi sledeće. Naslov ili tekst možeš i sam da ispraviš pre odobravanja.",
    "Does anything get posted without my approval?": "Da li se nešto objavljuje bez mog odobrenja?",
    "Never. Only ads you approve are scheduled and published. Anything you reject or leave waiting stays with you.":
      "Nikad. Zakazuju se i objavljuju samo reklame koje odobriš. Sve što odbiješ ili ostaviš da čeka ostaje kod tebe.",
    "Which channels do you post to?": "Na koje kanale objavljujete?",
    "Instagram, Facebook, TikTok, Google Business, Pinterest and LinkedIn. You pick yours when you sign up and can change them any time in your account. The Free plan covers one channel.":
      "Instagram, Facebook, TikTok, Google Business, Pinterest i LinkedIn. Svoje biraš pri registraciji i možeš ih promeniti bilo kad u nalogu. Besplatni paket pokriva jedan kanal.",
    "How does the free trial work?": "Kako radi besplatni probni period?",
    "Paid plans start with a 7-day free trial, one per account. A card is required, nothing is charged during the trial, and the plan renews automatically unless you cancel. The Free plan needs no card at all.":
      "Plaćeni paketi počinju sa 7 dana besplatne probe, jednom po nalogu. Potrebna je kartica, tokom probe se ništa ne naplaćuje, a paket se posle automatski obnavlja dok ga ne otkažeš. Za besplatni paket kartica uopšte nije potrebna.",
    "Can I cancel any time?": "Mogu li da otkažem bilo kad?",
    "Yes, from your account page, in one click. Cancelling takes effect at the end of the period you have already paid for. Annual plans are billed 12 months upfront and unused months are not refunded.":
      "Da, jednim klikom na strani naloga. Otkazivanje važi od kraja perioda koji si već platio. Godišnji paketi se naplaćuju 12 meseci unapred, a neiskorišćeni meseci se ne vraćaju.",
    "Is VAT included in the price?": "Da li je PDV uračunat u cenu?",
    "Yes. Every price on this site includes VAT. What you see is what you pay — nothing is added at checkout.":
      "Da. Svaka cena na ovom sajtu uključuje PDV. Plaćaš tačno ono što vidiš — ništa se ne dodaje pri plaćanju.",
    "Are the ads made with AI?": "Da li reklame pravi veštačka inteligencija?",
    "Yes. Every creative is generated by AI and approved by you before it goes anywhere. Where a platform offers an AI-content label, we set it automatically.":
      "Da. Svaku kreativu pravi veštačka inteligencija, a ti je odobravaš pre nego što bilo gde ode. Gde platforma nudi oznaku za AI sadržaj, postavljamo je automatski.",
    "What happens to my business information?": "Šta se dešava sa podacima o mom biznisu?",
    "It is used to make your ads and nothing else. We do not sell it, and we do not use your brand material to train models for other customers. You can export or delete all of it from your account at any time.":
      "Koriste se samo za pravljenje tvojih reklama. Ne prodajemo ih i ne koristimo tvoj brend materijal za treniranje modela za druge klijente. Sve možeš preuzeti ili obrisati iz svog naloga bilo kad.",

    /* --- Home page: pricing ---------------------------------------------- */
    "08 — PRICING": "08 — CENE",
    "Monthly": "Mesečno",
    "Annual · −20%": "Godišnje · −20%",
    "20% off any paid plan — enter it at checkout.": "20% popusta na bilo koji plaćeni plan — unesi ga pri plaćanju.",
    "Copy": "Kopiraj",
    "Copied": "Kopirano",
    "All prices are per month and": "Sve cene su mesečne i",
    "include VAT": "uključuju PDV",
    "— what you see here is what you pay, nothing is added at checkout. Paid plans start with a 7-day free trial, one per account: a card is required, nothing is charged during the trial, and the plan then renews automatically until you cancel. Cancelling takes effect at the end of the period you have paid for. Annual plans are billed 12 months upfront and unused months are not refunded.":
      "— koliko ovde vidiš, toliko plaćaš, ništa se ne dodaje na naplati. Plaćeni planovi počinju besplatnim periodom od 7 dana, jednim po nalogu: kartica je obavezna, tokom probnog perioda se ništa ne naplaćuje, a plan se zatim automatski obnavlja dok ga ne otkažeš. Otkazivanje stupa na snagu na kraju perioda koji si platio. Godišnji planovi se naplaćuju za 12 meseci unapred, a neiskorišćeni meseci se ne refundiraju.",
    "RECOMMENDED": "PREPORUČENO",
    "/ MONTH · INCL. VAT": "/ MESEČNO · SA PDV-om",
    "/ MONTH": "/ MESEČNO",
    "Free": "Besplatno",
    "3 ads / month · 1 channel · swipe approval · no card needed":
      "3 oglasa / mesečno · 1 kanal · odobravanje prevlačenjem · bez kartice",
    "SIZE YOUR DROP": "ODMERI SVOJ DROP",
    "EST. MONTHLY · INCL. VAT": "PROC. MESEČNO · SA PDV-om",
    "ADS / YEAR": "OGLASA / GODIŠNJE",
    "The next drop leaves Monday at 09:00.":
      "Sledeći drop kreće u ponedeljak u 09:00.",
    "Onboard in ten minutes and your first twelve ads are waiting for approval before the week is out. No contract, no retainer, no meeting.":
      "Postavi nalog za deset minuta i tvojih prvih dvanaest oglasa čeka odobrenje pre kraja nedelje. Bez ugovora, bez paušala, bez sastanka.",
    "7-DAY FREE TRIAL · CANCEL ANY TIME": "7 DANA BESPLATNO · OTKAŽI KAD HOĆEŠ",
    "Paid plans start with a 7-day free trial, one per account. A card is required to start it, nothing is charged during it, and the plan renews automatically at the price shown until you cancel. Prices include VAT.":
      "Plaćeni planovi počinju besplatnim periodom od 7 dana, jednim po nalogu. Za početak je potrebna kartica, tokom probnog perioda se ništa ne naplaćuje, a plan se automatski obnavlja po prikazanoj ceni dok ga ne otkažeš. Cene uključuju PDV.",
    "Contact us": "Kontaktiraj nas",

    /* --- Sign up: the brief ----------------------------------------------- */
    "Start your drop — Adronis": "Pokreni svoj drop — Adronis",
    "SIGN UP": "REGISTRACIJA",
    "Set up your": "Postavi svoj",
    "drop.": "drop.",
    "Onboard in ten minutes. Your first batch is waiting for approval before the week is out.":
      "Postavljanje traje deset minuta. Tvoja prva tura čeka odobrenje pre kraja nedelje.",
    "PLAN ACTIVE": "PLAN AKTIVAN",
    "The Storefront plan is live on your account.":
      "Storefront plan je aktivan na tvom nalogu.",
    "Your next drop renders Monday at 09:00. Nothing else to do here.":
      "Tvoj sledeći drop se renderuje u ponedeljak u 09:00. Ovde nemaš više šta da radiš.",
    "Back to home": "Nazad na početnu",
    "ACCOUNT": "NALOG",
    "YOUR BUSINESS": "TVOJ BIZNIS",
    "ABOUT YOUR BUSINESS": "O TVOM BIZNISU",
    "CITY": "GRAD",
    "Choose your country": "Izaberi državu",
    "Where's the shop?": "Gde je radnja?",
    "BUSINESS TYPE": "TIP BIZNISA",
    "Bakery": "Pekara",
    "Barbershop": "Berbernica",
    "Dental clinic": "Stomatološka ordinacija",
    "Gym / studio": "Teretana / studio",
    "Wine bar": "Vinski bar",
    "Florist": "Cvećara",
    "Auto detailer": "Auto-detailing",
    "Nail studio": "Nail studio",
    "Other": "Drugo",
    "WHAT KIND OF BUSINESS IS IT?": "KOJI JE TO TIP BIZNISA?",
    "e.g. Record shop, tailor, dog groomer":
      "npr. Prodavnica ploča, krojač, salon za pse",
    "WEBSITE OR INSTAGRAM HANDLE (OPTIONAL)":
      "SAJT ILI INSTAGRAM NALOG (OPCIONO)",
    "@yourbusiness or yourbusiness.com": "@tvojbiznis ili tvojbiznis.com",
    "WHAT DO YOU SELL OR DO, IN ONE LINE?":
      "ŠTA PRODAJEŠ ILI RADIŠ, U JEDNOJ REČENICI?",
    "e.g. Sourdough and pastries, baked fresh every morning":
      "npr. Kiseli hleb i peciva, pečeno sveže svako jutro",
    "WHO'S YOUR TYPICAL CUSTOMER?": "KO TI JE TIPIČNA MUŠTERIJA?",
    "e.g. Neighborhood regulars, 30-55, coffee-first crowd":
      "npr. Redovni iz kraja, 30-55, ekipa koja prvo traži kafu",
    "WHAT MAKES YOU DIFFERENT FROM THE PLACE DOWN THE STREET?":
      "PO ČEMU SE RAZLIKUJEŠ OD RADNJE NIZ ULICU?",
    "e.g. Everything's made from scratch, we source local, third generation family recipe...":
      "npr. Sve pravimo od nule, nabavljamo lokalno, porodični recept treće generacije...",
    "WHAT MADE YOU COME TO US?": "ŠTA TE JE DOVELO KOD NAS?",
    "e.g. We post once a month and it goes nowhere, nobody here has time for marketing, foot traffic has dropped since spring...":
      "npr. Objavimo jednom mesečno i ne donese ništa, niko kod nas nema vremena za marketing, od proleća ima manje ljudi u radnji...",
    "BRAND & VOICE": "BREND I TON",
    "BRAND VIBE": "ATMOSFERA BRENDA",
    "Warm & cozy": "Toplo i prijatno",
    "Bold & energetic": "Odvažno i energično",
    "Minimal & modern": "Minimalno i moderno",
    "Playful & fun": "Razigrano i zabavno",
    "Premium & elegant": "Premium i elegantno",
    "Local & authentic": "Lokalno i autentično",
    "BRAND COLORS OR PALETTE (OPTIONAL)": "BOJE ILI PALETA BRENDA (OPCIONO)",
    "e.g. Warm oak, matte black, morning light":
      "npr. Topli hrast, mat crna, jutarnje svetlo",
    "ANYTHING THE ENGINE SHOULD AVOID? (OPTIONAL)":
      "IMA LI NEČEGA ŠTO MAŠINA TREBA DA IZBEGAVA? (OPCIONO)",
    "e.g. No humor about pricing, never show the back kitchen...":
      "npr. Bez šala o cenama, nikad ne prikazuj zadnju kuhinju...",
    "WHERE SHOULD WE PUBLISH?": "GDE DA OBJAVLJUJEMO?",
    "BEFORE YOU START": "PRE NEGO ŠTO POČNEŠ",
    "I have read and accept the": "Pročitao sam i prihvatam dokumente:",
    ", and I am opening this account for a business.":
      ", i ovaj nalog otvaram za potrebe biznisa.",
    "We use what you enter here to render your drops, run your account and support you. We do not sell it and we do not use your brand material to train models for other customers. You can request a copy or deletion at any time at":
      "Ono što ovde uneseš koristimo da renderujemo tvoje dropove, vodimo tvoj nalog i pružimo ti podršku. Te podatke ne prodajemo i ne koristimo materijal tvog brenda za treniranje modela za druge klijente. Kopiju ili brisanje možeš tražiti u svakom trenutku na",
    ". Creatives are AI-generated and publish only after you approve them — you remain the advertiser responsible for every ad you approve.":
      ". Kreativi su AI-generisani i objavljuju se tek nakon tvog odobrenja — ti ostaješ oglašivač odgovoran za svaki oglas koji odobriš.",
    "YOUR PLAN": "TVOJ PLAN",
    "Incl. VAT. The price you see is the price you pay.":
      "Sa PDV-om. Cena koju vidiš je cena koju plaćaš.",
    "Not the right plan? Compare plans →": "Nije pravi plan? Uporedi planove →",
    "Brief the engine for your": "Brifuj mašinu za svoj",
    "Tell us about the business and your free ads start rendering. No card, nothing to pay.":
      "Ispričaj nam o biznisu i tvoji besplatni oglasi kreću u render. Bez kartice, bez plaćanja.",
    "STEP 1 OF 2 · FIRST DROP FREE": "KORAK 1 OD 2 · PRVI DROP BESPLATNO",
    "Tell us about the business first. Card details come on the next step — nothing is charged until the free trial ends.":
      "Prvo nam ispričaj o biznisu. Podaci o kartici dolaze u sledećem koraku — ništa se ne naplaćuje dok ne istekne besplatni period.",
    "Start free": "Počni besplatno",
    "Continue to checkout": "Nastavi na naplatu",
    "ONE LAST STEP": "JOŠ JEDAN KORAK",
    "ALMOST THERE": "SKORO PA GOTOVO",
    "Confirm your email.": "Potvrdi svoj email.",
    "Confirm your email, then log back in — your answers are still here, so it's one click to finish.":
      "Potvrdi email pa se ponovo prijavi — tvoji odgovori su i dalje ovde, pa je do kraja jedan klik.",
    "Brief saved — taking you to your approvals...":
      "Brif sačuvan — vodim te na odobravanja...",
    "Brief saved — taking you to checkout...":
      "Brif sačuvan — vodim te na naplatu...",

    /* --- Checkout --------------------------------------------------------- */
    "Checkout — Adronis": "Naplata — Adronis",
    "CHECKOUT": "NAPLATA",
    "STEP 2 OF 2 · FIRST DROP FREE": "KORAK 2 OD 2 · PRVI DROP BESPLATNO",
    "Confirm your": "Potvrdi svoj",
    "Nothing is charged today. Your first drop lands Monday — billing starts a week later, and you can cancel before it does.":
      "Danas se ništa ne naplaćuje. Tvoj prvi drop stiže u ponedeljak — naplata počinje nedelju dana kasnije, a možeš otkazati pre toga.",
    "Your plan": "Tvoj plan",
    "Annual": "Godišnje",
    "SAVE 20%": "UŠTEDA 20%",
    "Billed every month and renews automatically. Cancel any time — access runs to the end of the paid month, with no notice period.":
      "Naplaćuje se svakog meseca i automatski se obnavlja. Otkaži kad hoćeš — pristup traje do kraja plaćenog meseca, bez otkaznog roka.",
    "Billing details": "Podaci za naplatu",
    "BILLING EMAIL": "EMAIL ZA NAPLATU",
    "COUNTRY": "DRŽAVA",
    "Serbia": "Srbija",
    "Germany": "Nemačka",
    "Austria": "Austrija",
    "Netherlands": "Holandija",
    "France": "Francuska",
    "Italy": "Italija",
    "Spain": "Španija",
    "Ireland": "Irska",
    "United States": "Sjedinjene Države",
    "United Kingdom": "Ujedinjeno Kraljevstvo",
    "Somewhere else": "Negde drugde",
    "VAT ID (OPTIONAL)": "PIB / VAT ID (OPCIONO)",
    "For reverse charge, if your business has one":
      "Za obrnuto obračunavanje, ako tvoj biznis ima taj broj",
    "PROMO CODE": "PROMO KOD",
    "Have a code?": "Imaš kod?",
    "Apply": "Primeni",
    "Continue to secure payment": "Nastavi na sigurno plaćanje",
    "PAYMENT HANDLED BY PADDLE · CARD DETAILS NEVER TOUCH OUR SERVERS":
      "PLAĆANJE VODI PADDLE · PODACI O KARTICI NIKAD NE DOLAZE DO NAŠIH SERVERA",
    "Our order process is conducted by our online reseller Paddle.com, who is the Merchant of Record for all our orders and handles billing, tax and invoices.":
      "Porudžbinu obrađuje naš online preprodavac Paddle.com, koji je prodavac (Merchant of Record) za sve naše porudžbine i vodi naplatu, porez i račune.",
    "Not ready to add a card?": "Nisi spreman da dodaš karticu?",
    "Start on the Free plan instead →": "Počni na besplatnom planu →",
    "3 ads a month, no card. Upgrade whenever you like.":
      "3 oglasa mesečno, bez kartice. Nadogradi kad god poželiš.",
    "By continuing you confirm you are subscribing for business purposes and you accept the":
      "Nastavkom potvrđuješ da se pretplaćuješ za potrebe biznisa i prihvataš dokumente:",
    "Terms of Service": "Uslovi korišćenja",
    ", the": ", ",
    "and the": "i",
    "AI Disclosure": "AI obaveštenje",
    ". You agree that the subscription renews automatically at the amount and date shown in the summary until you cancel, that cancelling takes effect at the end of the period you have paid for, and that part-periods are not refunded. Prices include VAT where it applies; nothing is added on top of the amount shown. Creatives are AI-generated and publish only after you approve them — you remain the advertiser responsible for every ad you approve.":
      ". Saglasan si da se pretplata automatski obnavlja po iznosu i datumu prikazanim u pregledu dok je ne otkažeš, da otkazivanje stupa na snagu na kraju perioda koji si platio i da se započeti periodi ne refundiraju. Cene uključuju PDV tamo gde se plaća; ništa se ne dodaje na prikazani iznos. Kreativi su AI-generisani i objavljuju se tek nakon tvog odobrenja — ti ostaješ oglašivač odgovoran za svaki oglas koji odobriš.",
    "ORDER SUMMARY": "PREGLED PORUDŽBINE",
    "Compare plans →": "Uporedi planove →",
    "12 ads / week · 4 channels": "12 oglasa / nedeljno · 4 kanala",
    "Due today": "Za naplatu danas",
    "FREE TRIAL ACTIVE · NO CHARGE TODAY":
      "BESPLATNI PERIOD AKTIVAN · DANAS BEZ NAPLATE",
    "Your Storefront drop is live.": "Tvoj Storefront drop je aktivan.",
    "The engine is already rendering. Your first batch hits the approvals queue Monday at 09:00 — you'll get an email the moment it's ready.":
      "Mašina već renderuje. Tvoja prva tura stiže u red za odobravanje u ponedeljak u 09:00 — dobićeš email čim bude spremna.",
    "Go to approvals": "Idi na odobravanja",
    "Your card is saved for after the trial. Nothing has been charged.":
      "Tvoja kartica je sačuvana za period posle probe. Ništa nije naplaćeno.",
    "PAYMENT NOT COMPLETED": "PLAĆANJE NIJE ZAVRŠENO",
    "Nothing was charged.": "Ništa nije naplaćeno.",
    "You stepped out before the payment went through. Your account and onboarding answers are saved exactly as you left them.":
      "Izašao si pre nego što je plaćanje prošlo. Tvoj nalog i odgovori iz registracije sačuvani su tačno onako kako si ih ostavio.",
    "Pick up where you left off": "Nastavi gde si stao",
    "Something went wrong? Talk to us →": "Nešto nije u redu? Piši nam →",

    /* --- Approvals -------------------------------------------------------- */
    "Approvals — Adronis": "Odobravanja — Adronis",
    "APPROVALS": "ODOBRAVANJA",
    "This week's drop, waiting on your": "Ovonedeljni drop čeka tvoje",
    "yes": "da",
    "Every creative the engine rendered for you. Keep what fits, kill what doesn't — only what you approve gets published.":
      "Svaki kreativ koji je mašina napravila za tebe. Zadrži ono što ti odgovara, odbaci ostalo — objavljuje se samo ono što odobriš.",
    "Log in to see your drop.": "Prijavi se da vidiš svoj drop.",
    "Your creatives are tied to your account — sign in and this week's batch loads here.":
      "Tvoji kreativi su vezani za nalog — prijavi se i ovonedeljna tura se učitava ovde.",
    "LOADING YOUR DROP": "UČITAVAM TVOJ DROP",
    "FREE PLAN": "BESPLATNI PLAN",
    "Get a full drop every week →": "Uzmi pun drop svake nedelje →",
    "Your creatives": "Tvoji kreativi",
    "Approve all waiting": "Odobri sve na čekanju",
    "Reject all waiting": "Odbaci sve na čekanju",
    "Waiting on you": "Čeka tebe",
    "Approved": "Odobreno",
    "Rejected": "Odbačeno",
    "Everything": "Sve",
    "Y approve · N reject · 1–5 say why · ←→ navigate":
      "Y odobri · N odbaci · 1–5 razlog · ←→ kretanje",
    "NOTHING HERE": "OVDE NEMA NIČEGA",
    "All caught up.": "Sve je rešeno.",
    "Nothing in this view right now.": "Trenutno ništa u ovom prikazu.",
    "NO DROP YET": "JOŠ NEMA DROPA",
    "Your first batch is still rendering.": "Tvoja prva tura se još renderuje.",
    "Drops land Monday morning. As soon as the engine finishes your week, every creative shows up here for approval.":
      "Dropovi stižu u ponedeljak ujutru. Čim mašina završi tvoju nedelju, svaki kreativ se pojavljuje ovde na odobravanje.",
    "See a sample drop": "Pogledaj primer dropa",
    "Account settings": "Podešavanja naloga",
    "Undo": "Poništi",
    "Every image on this page is AI-generated and published only after you approve it. Read the":
      "Svaka slika na ovoj stranici je AI-generisana i objavljuje se tek nakon tvog odobrenja. Pročitaj",

    /* --- Account ---------------------------------------------------------- */
    "Account — Adronis": "Nalog — Adronis",
    "YOUR ACCOUNT": "TVOJ NALOG",
    "Account settings.": "Podešavanja naloga.",
    "Your login, your connected channels, and every drop you've been billed for — all in one place.":
      "Tvoja prijava, povezani kanali i svaki drop za koji ti je naplaćeno — sve na jednom mestu.",
    "Your business details, your login, your connected channels, and every drop you've been billed for — all in one place.":
      "Podaci o biznisu, tvoja prijava, povezani kanali i svaki drop za koji ti je naplaćeno — sve na jednom mestu.",
    "Your business": "Tvoj biznis",
    "Edit →": "Izmeni →",
    "What the engine builds every drop from. Keep it current when something changes.":
      "Od ovoga mašina pravi svaki drop. Ažuriraj kad se nešto promeni.",
    "Business name": "Naziv biznisa",
    "Location": "Lokacija",
    "Business type": "Tip biznisa",
    "Website or Instagram": "Sajt ili Instagram",
    "What you sell": "Šta prodaješ",
    "Typical customer": "Tipična mušterija",
    "Brand vibe": "Atmosfera brenda",
    "Save changes": "Sačuvaj izmene",
    "Saved — the next drop renders from these details.":
      "Sačuvano — sledeći drop se pravi od ovih podataka.",
    "Changes apply from the next drop that renders. Brand colors, what sets you apart and anything to avoid live in the":
      "Izmene važe od sledećeg dropa koji se renderuje. Boje brenda, ono po čemu se izdvajaš i šta treba izbegavati nalaze se u",
    "control room": "kontrolnoj sobi",
    "NOT SIGNED IN": "NISI PRIJAVLJEN",
    "Log in to manage your account.": "Prijavi se da upravljaš nalogom.",
    "Password, connected channels and billing all live behind your login.":
      "Lozinka, povezani kanali i naplata stoje iza tvoje prijave.",
    "Create account": "Napravi nalog",
    "LOADING YOUR ACCOUNT": "UČITAVAM TVOJ NALOG",
    "SIGNED IN AS": "PRIJAVLJEN KAO",
    "NO PLAN": "BEZ PLANA",
    "Log out": "Odjava",
    "LOGIN & SECURITY": "PRIJAVA I BEZBEDNOST",
    "Email address": "Email adresa",
    "Change the email you log in with. Takes effect after you confirm it.":
      "Promeni email kojim se prijavljuješ. Važi čim ga potvrdiš.",
    "EMAIL ADDRESS": "EMAIL ADRESA",
    "Update email": "Sačuvaj email",
    "Password": "Lozinka",
    "CURRENT PASSWORD": "TRENUTNA LOZINKA",
    "NEW PASSWORD": "NOVA LOZINKA",
    "CONFIRM PASSWORD": "POTVRDI LOZINKU",
    "Your current password": "Tvoja trenutna lozinka",
    "At least 8 characters": "Najmanje 8 znakova",
    "Type it again": "Unesi je ponovo",
    "Update password": "Sačuvaj lozinku",
    "Forgot it? Email me a reset link": "Zaboravio si je? Pošalji mi link za novu",
    "Cancel": "Otkaži",
    "Connected channels": "Povezani kanali",
    "The channels your weekly drop publishes to. Untick anything you don't want creatives rendered for.":
      "Kanali na kojima se objavljuje tvoj nedeljni drop. Odčekiraj sve za šta ne želiš da se renderuju kreativi.",
    "Save channels": "Sačuvaj kanale",
    "PLAN & BILLING": "PLAN I NAPLATA",
    "Plan": "Plan",
    "Change plan →": "Promeni plan →",
    "What you're on and how it's billed.": "Šta koristiš i kako se naplaćuje.",
    "NO PLAN YET": "JOŠ NEMA PLANA",
    "You haven't picked a plan.": "Još nisi izabrao plan.",
    "Choose a plan to start your first drop — billing details show up here once you do.":
      "Izaberi plan da pokreneš prvi drop — podaci o naplati se pojavljuju ovde čim to uradiš.",
    "See plans": "Pogledaj planove",
    "Rate": "Obim",
    "Billing cycle": "Ciklus naplate",
    "Status": "Status",
    "Discount": "Popust",
    "agreed with Adronis": "dogovoreno sa Adronisom",
    "applied by Adronis": "odobrio Adronis",
    "Trial ends": "Proba ističe",
    "NEW PLAN": "NOVI PLAN",
    "BILLING CYCLE": "CIKLUS NAPLATE",
    "Confirm change": "Potvrdi promenu",
    "Cancel subscription": "Otkaži pretplatu",
    "You'll keep full access until": "Pun pristup ti ostaje do",
    ". After that your plan stops and nothing more is charged.":
      ". Posle toga plan prestaje i ništa se više ne naplaćuje.",
    "Yes, cancel": "Da, otkaži",
    "Never mind": "Ipak ne",
    "Payments": "Plaćanja",
    "Every charge on your account, past and upcoming.":
      "Svaka naplata na tvom nalogu, prošla i predstojeća.",
    "NO BILLING YET": "JOŠ NEMA NAPLATE",
    "Nothing charged so far.": "Do sada ništa nije naplaćeno.",
    "Once your trial converts to a paid plan, every charge will show up here.":
      "Čim proba pređe u plaćeni plan, svaka naplata se pojavljuje ovde.",
    "Date": "Datum",
    "Description": "Opis",
    "Amount": "Iznos",
    "Paid amounts are what Paddle, our reseller and Merchant of Record, actually charged; Paddle emails the invoice for each one. All prices include VAT where it applies; the VAT share is shown on the invoice.":
      "Plaćeni iznosi su ono što je Paddle, naš preprodavac i prodavac (Merchant of Record), stvarno naplatio; Paddle za svaki šalje račun mejlom. Sve cene uključuju PDV tamo gde se plaća; iznos PDV-a se prikazuje na računu.",
    "Your data": "Tvoji podaci",
    "What we hold on this account, and how to get it out or removed.":
      "Šta držimo na ovom nalogu i kako to da izvučeš ili obrišeš.",
    "Kept while active": "Čuva se dok je nalog aktivan",
    "Account, brief, brand material, creatives":
      "Nalog, brif, materijal brenda, kreativi",
    "After cancellation": "Posle otkazivanja",
    "Deleted 90 days later": "Briše se nakon 90 dana",
    "Invoices": "Računi",
    "Kept as long as tax law requires": "Čuvaju se koliko poreski propisi nalažu",
    "The download is one file with your account, brief and every creative. For a correction, or anything else, write to":
      "Preuzimanje je jedan fajl sa tvojim nalogom, opisom posla i svim kreativima. Za ispravku ili bilo šta drugo piši na",
    "from the address on this account — we answer within one month. Full detail is in the":
      "sa adrese sa ovog naloga — odgovaramo u roku od mesec dana. Sve pojedinosti su u dokumentu",
    "Privacy Policy": "Politika privatnosti",

    /* --- AI disclosure ---------------------------------------------------- */
    "AI Disclosure — How Adronis Creatives Are Made":
      "AI obaveštenje — kako nastaju Adronis kreativi",
    "AI DISCLOSURE": "AI OBAVEŠTENJE",
    "Every creative is AI-generated. Nothing publishes until":
      "Svaki kreativ je AI-generisan. Ništa se ne objavljuje dok ga",
    "you": "ti",
    "approve it.": "ne odobriš.",
    "Last updated September 21, 2026. Here is how the engine works, what the guardrails are built to catch, where they fall short, and which parts stay your call as the advertiser.":
      "Poslednja izmena 21. septembra 2026. Evo kako mašina radi, šta provere treba da uhvate, gde su im granice i koji delovi ostaju tvoja odluka kao oglašivača.",
    "How creatives are made": "Kako nastaju kreativi",
    "Each drop is rendered by generative image and video models, conditioned on the brand brief you set during onboarding — your palette, your props, your storefront, your tone. Scenes are generated for your business rather than taken from a stock library or a fixed template with your logo dropped on top.":
      "Svaki drop renderuju generativni modeli za sliku i video, vođeni brifom brenda koji si postavio pri registraciji — tvoja paleta, tvoji rekviziti, tvoj izlog, tvoj ton. Scene se generišu za tvoj biznis, a ne uzimaju iz stok biblioteke ili fiksnog šablona sa tvojim logom nalepljenim odozgo.",
    "Generative models are probabilistic. Two runs on the same brief produce different images, and output can contain artefacts, odd details or text that is subtly wrong. That is the nature of the technology, not a fault we can fully engineer away.":
      "Generativni modeli su verovatnosni. Dva prolaza po istom brifu daju različite slike, a rezultat može da sadrži artefakte, čudne detalje ili tekst koji je suptilno pogrešan. To je priroda tehnologije, a ne greška koju možemo u potpunosti inženjerski ukloniti.",
    "What \"you approve it\" means": "Šta znači „ti odobriš“",
    "No creative reaches your channels until someone on your side clicks approve in the control room. Adronis does not auto-publish creatives you have not seen. Approving is the moment the creative becomes your ad — so read it, including any price, offer, date or claim rendered into the image, before you approve.":
      "Nijedan kreativ ne stiže na tvoje kanale dok neko sa tvoje strane ne klikne odobri u kontrolnoj sobi. Adronis ne objavljuje automatski kreative koje nisi video. Odobravanje je trenutak u kom kreativ postaje tvoj oglas — zato ga pročitaj, uključujući svaku cenu, ponudu, datum ili tvrdnju urenderovanu u sliku, pre nego što ga odobriš.",
    "Guardrails: what they are built to catch": "Provere: šta treba da uhvate",
    "Before a creative reaches your approval queue it passes automated checks aimed at the known failure modes of generative models. They are designed to filter out:":
      "Pre nego što stigne u tvoj red za odobravanje, kreativ prolazi automatske provere usmerene na poznate načine na koje generativni modeli greše. One treba da odseku:",
    "Prices, offers or claims that were not in your brief.":
      "Cene, ponude ili tvrdnje kojih nije bilo u tvom brifu.",
    "Distorted hands, faces and storefront signage — output below a confidence threshold is discarded and re-rendered rather than queued.":
      "Izobličene ruke, lica i natpise na izlogu — rezultat ispod praga sigurnosti se odbacuje i ponovo renderuje umesto da ide u red.",
    "Invented reviews, testimonials and star ratings.":
      "Izmišljene recenzije, preporuke i ocene zvezdicama.",
    "Competitor names, logos and trade marks.":
      "Imena konkurencije, logotipe i zaštitne znakove.",
    "Creatives that fail a check are regenerated before the drop is finalised.":
      "Kreativi koji padnu na proveri ponovo se generišu pre nego što se drop zaključi.",
    "Where the guardrails fall short": "Gde su granice tih provera",
    "These checks are automated and statistical. They reduce the failure rate; they do not eliminate it.":
      "Te provere su automatske i statističke. One smanjuju stopu grešaka, ali je ne uklanjaju.",
    "We do not guarantee that every creative reaching your queue is free of errors, invented detail or third-party material.":
      "Ne garantujemo da je svaki kreativ koji stigne u tvoj red bez grešaka, izmišljenih detalja ili tuđeg materijala.",
    "Things that can get through include rendered text that reads correctly to a classifier but wrongly to a customer, an unintended resemblance to an existing image or mark, or a detail that is fine in general but wrong for your business.":
      "Kroz mrežu mogu da prođu urenderovan tekst koji klasifikator čita ispravno a mušterija pogrešno, nenamerna sličnost sa postojećom slikom ili znakom, ili detalj koji je uopšteno u redu ali pogrešan za tvoj biznis.",
    "That is why approval sits with you, and why": "Zato odobravanje stoji na tebi, i zato",
    "our terms": "naši uslovi",
    "make clear that you remain the advertiser and the party legally responsible for what you publish.":
      "jasno kažu da ti ostaješ oglašivač i strana pravno odgovorna za ono što objaviš.",
    "AI labelling on the platforms": "Označavanje AI sadržaja na platformama",
    "Where a connected platform offers an AI-content label through its publishing interface and supports it for the format we are posting, Adronis sets that label automatically when it publishes on your behalf.":
      "Kad povezana platforma nudi oznaku za AI sadržaj kroz svoj interfejs za objavljivanje i podržava je za format koji objavljujemo, Adronis tu oznaku postavlja automatski pri objavi u tvoje ime.",
    "Two limits worth knowing. First, platform labelling is only as good as the platform's own interface — where a platform does not offer a label, or changes how it works, we cannot apply one. Second, disclosure rules differ by country, sector and ad type, and they change.":
      "Dva ograničenja vredi znati. Prvo, označavanje vredi onoliko koliko vredi interfejs same platforme — gde platforma ne nudi oznaku ili promeni kako ona radi, mi je ne možemo postaviti. Drugo, pravila o obaveštavanju razlikuju se po zemlji, delatnosti i vrsti oglasa, i menjaju se.",
    "We do not monitor which rules apply to your business, and applying a platform label does not by itself make an ad compliant.":
      "Mi ne pratimo koja pravila važe za tvoj biznis, a postavljanje oznake na platformi samo po sebi ne čini oglas usklađenim.",
    "If you are unsure what disclosure your market or sector requires, take advice before you approve.":
      "Ako nisi siguran kakvo obaveštavanje traži tvoje tržište ili delatnost, potraži savet pre nego što odobriš.",
    "Your material, and people in it": "Tvoj materijal i ljudi na njemu",
    "Reference photos and brand assets you upload condition the output. Only upload material you have the rights to, including permission from anyone who appears in a photo. The engine is not intended to generate images of real, identifiable people other than from material you have supplied and cleared.":
      "Referentne fotografije i materijali brenda koje otpremiš usmeravaju rezultat. Otpremaj isključivo materijal na koji imaš prava, uključujući dozvolu svakoga ko se pojavljuje na fotografiji. Mašina nije namenjena generisanju slika stvarnih, prepoznatljivih osoba osim iz materijala koji si dostavio i za koji imaš saglasnost.",
    "What we do not do with your material": "Šta ne radimo sa tvojim materijalom",
    "We do not use your brand material to train generative models for other customers, and we do not sell it. What we keep, for how long, and who processes it is set out in the":
      "Materijal tvog brenda ne koristimo za treniranje generativnih modela za druge klijente i ne prodajemo ga. Šta čuvamo, koliko dugo i ko to obrađuje, opisano je u dokumentu",
    "Illustrations on this site": "Ilustracije na ovom sajtu",
    "Creatives, dashboards, metrics and figures shown across this site are illustrative examples of how the product works. They are not a forecast or a promise of results for your business.":
      "Kreativi, table, metrike i brojevi prikazani na ovom sajtu su ilustrativni primeri načina na koji proizvod radi. Oni nisu prognoza ni obećanje rezultata za tvoj biznis.",
    "Something looks wrong": "Nešto izgleda pogrešno",
    "Kill it in the queue rather than approving it, and flag it from the control room or through our":
      "Odbaci ga u redu umesto da ga odobriš, a prijavu pošalji iz kontrolne sobe ili ovde:",
    "contact page": "kontakt stranica",
    ". If you believe a creative infringes someone's rights, write to":
      ". Ako smatraš da kreativ krši nečija prava, piši na",
    "and we will investigate.": "i mi ćemo to ispitati.",

    /* --- Terms of Service -------------------------------------------------
       Clause 21 says the English version governs and a translation is for
       convenience, so this copy is a reading aid and not a second contract. */
    "Terms of Service — Adronis": "Uslovi korišćenja — Adronis",
    "TERMS": "USLOVI",
    "Last updated September 23, 2026. These terms form a binding agreement between you and Adronis. Headings are for readability — the wording of each clause governs.":
      "Poslednja izmena 23. septembra 2026. Ovi uslovi čine obavezujući ugovor između tebe i Adronisa. Naslovi služe radi preglednosti — merodavan je tekst svake klauzule.",
    "1. Who you are contracting with": "1. Sa kim zaključuješ ugovor",
    "Adronis (\"Adronis\", \"we\", \"us\") is a software service operated by":
      "Adronis („Adronis“, „mi“, „nas“) je softverska usluga koju pruža",
    ", a company registered in [COUNTRY] under company registration number [REGISTRATION NUMBER], VAT identification number [VAT NUMBER], with its registered office at [REGISTERED ADDRESS].":
      ", privredno društvo registrovano u [COUNTRY] pod matičnim brojem [REGISTRATION NUMBER], PIB [VAT NUMBER], sa sedištem na adresi [REGISTERED ADDRESS].",
    "Contractual and general legal questions:": "Ugovorna i opšta pravna pitanja:",
    "Privacy and data requests:": "Privatnost i zahtevi za podatke:",
    "Copyright and IP complaints:": "Prijave zbog autorskih prava i intelektualne svojine:",
    "Everything else: our": "Sve ostalo: naša",
    "or": "ili",
    "message us": "piši nam",
    "\"You\" means the business that opens the account. These terms apply together with our":
      "„Ti“ označava biznis koji otvara nalog. Ovi uslovi važe zajedno sa dokumentima:",
    "and": "i",
    ", which form part of this agreement.": ", koji čine deo ovog ugovora.",
    "2. Business use only": "2. Samo poslovna upotreba",
    "Adronis is sold to businesses, sole traders and other professionals for purposes related to their trade. It is not offered to consumers. By opening an account you confirm you are acting in a business capacity and are authorised to bind that business, and that you are at least 18 years old. If mandatory consumer law applies to you regardless, nothing in these terms limits a right you cannot waive under that law.":
      "Adronis se prodaje privrednim društvima, preduzetnicima i drugim profesionalcima za potrebe njihove delatnosti. Ne nudi se potrošačima. Otvaranjem naloga potvrđuješ da nastupaš u poslovnom svojstvu, da si ovlašćen da obavežeš taj biznis i da imaš najmanje 18 godina. Ako se na tebe ipak primenjuju prinudni propisi o zaštiti potrošača, ništa u ovim uslovima ne ograničava pravo kojeg se po tim propisima ne možeš odreći.",
    "3. What Adronis does": "3. Šta Adronis radi",
    "Adronis generates advertising creative using generative AI models on a recurring schedule (\"a drop\"), based on the brand brief and reference material you provide, and — where you connect a channel and approve a creative — publishes that creative to the channel on your behalf. Output volume, formats and channel count depend on your plan.":
      "Adronis generiše oglasne kreative pomoću generativnih AI modela po ponavljajućem rasporedu („drop“), na osnovu brifa brenda i referentnog materijala koji dostaviš, i — kada povežeš kanal i odobriš kreativ — objavljuje taj kreativ na kanalu u tvoje ime. Količina, formati i broj kanala zavise od tvog plana.",
    "Adronis is a creative production and publishing tool. It is not an advertising agency, a legal adviser or a media buyer, and it does not buy paid placement on your behalf.":
      "Adronis je alat za produkciju i objavljivanje kreativa. Nije oglasna agencija, pravni savetnik ni medija baer, i ne kupuje plaćeni prostor u tvoje ime.",
    "4. Your account": "4. Tvoj nalog",
    "You must give accurate business information and keep it current. You are responsible for keeping your login credentials secure and for everything done under your account — approvals, rejections, briefs and channel connections — including by anyone you give access to. Tell us promptly at":
      "Dužan si da daš tačne podatke o biznisu i da ih održavaš ažurnim. Odgovoran si za bezbednost svojih pristupnih podataka i za sve što se uradi sa tvog naloga — odobrenja, odbijanja, brifove i povezivanje kanala — uključujući i ono što uradi bilo ko kome daš pristup. Javi nam bez odlaganja na",
    "if you believe your account has been compromised.":
      "ako sumnjaš da je tvoj nalog kompromitovan.",
    "5. Plans, prices and taxes": "5. Planovi, cene i porezi",
    "All prices shown on this site and in the app are in euro and":
      "Sve cene prikazane na ovom sajtu i u aplikaciji su u evrima i",
    "include VAT where it applies": "uključuju PDV tamo gde se plaća",
    ". The price shown is the total you pay; the VAT share for the country you select is shown at checkout and on the invoice.":
      ". Prikazana cena je ukupan iznos koji plaćaš; deo koji otpada na PDV za zemlju koju izabereš prikazuje se na naplati i na računu.",
    "If you supply a valid VAT identification number for an EU business outside our country of establishment, the invoice is issued under the reverse-charge mechanism, shows no VAT and you account for the VAT. The price you pay does not change. You are responsible for the accuracy of the VAT number you enter.":
      "Ako dostaviš važeći PDV identifikacioni broj za biznis iz EU izvan zemlje našeg sedišta, račun se izdaje po mehanizmu obrnutog obračunavanja, bez PDV-a, i PDV obračunavaš ti. Cena koju plaćaš se ne menja. Odgovoran si za tačnost PDV broja koji uneseš.",
    "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders: it takes the payment, issues the invoice and handles VAT, returns and billing questions, under its own buyer terms. Card details are entered on Paddle's systems; we never receive or store full card numbers.":
      "Porudžbinu obrađuje naš online preprodavac Paddle.com. Paddle.com je prodavac (Merchant of Record) za sve naše porudžbine: naplaćuje, izdaje račun i vodi PDV, povraćaje i pitanja o naplati, po sopstvenim uslovima za kupce. Podaci o kartici unose se u Paddle sisteme; mi nikada ne primamo niti čuvamo pune brojeve kartica.",
    "We may change plan prices on at least 30 days' notice by email. A change takes effect at your next renewal, and you may cancel before that renewal if you do not accept it.":
      "Cene planova možemo menjati uz obaveštenje emailom najmanje 30 dana unapred. Promena stupa na snagu na tvoje sledeće obnavljanje, a ako je ne prihvataš, možeš otkazati pre tog obnavljanja.",
    "6. Free plan and free trial": "6. Besplatni plan i besplatni probni period",
    "The Free plan needs no card and gives the monthly allowance described on the pricing page. We may change or withdraw the Free plan on 30 days' notice.":
      "Besplatni plan ne traži karticu i daje mesečnu kvotu opisanu na stranici sa cenama. Besplatni plan možemo izmeniti ili povući uz obaveštenje 30 dana unapred.",
    "Paid plans include a": "Plaćeni planovi uključuju",
    "7-day free trial, limited to one trial per account and per business":
      "besplatni probni period od 7 dana, ograničen na jednu probu po nalogu i po biznisu",
    ". If a trial has already been used on your account, billing starts on the day you subscribe, and this is shown to you before you pay.":
      ". Ako je proba već iskorišćena na tvom nalogu, naplata počinje na dan pretplate, i to ti se prikazuje pre plaćanja.",
    "Starting a trial requires a payment method.": "Za početak probe potreban je način plaćanja.",
    "Nothing is charged during the trial.": "Tokom probe se ništa ne naplaćuje.",
    "Unless you cancel before the trial ends, the subscription converts automatically to a paid subscription and the first invoice is charged on the trial end date, at the plan, cycle and amount shown to you at checkout.":
      "Ako ne otkažeš pre isteka probe, pretplata automatski prelazi u plaćenu, a prvi račun se naplaćuje na dan isteka probe, po planu, ciklusu i iznosu koji su ti prikazani na naplati.",
    "Your trial end date and next charge date are shown at checkout and in your account at all times. You can cancel during the trial from your account page at no cost.":
      "Datum isteka probe i datum sledeće naplate prikazani su na naplati i u svakom trenutku na tvom nalogu. Tokom probe možeš otkazati sa stranice naloga, bez troška.",
    "7. Renewal, cancellation and refunds": "7. Obnavljanje, otkazivanje i povraćaj",
    "Subscriptions renew automatically — monthly plans every month, annual plans every 12 months — until you cancel.":
      "Pretplate se obnavljaju automatski — mesečni planovi svakog meseca, godišnji na svakih 12 meseci — dok ne otkažeš.",
    "You can cancel at any time from your account page. No notice period, no minimum term, no cancellation fee.":
      "Otkazati možeš u svakom trenutku sa stranice naloga. Bez otkaznog roka, bez minimalnog trajanja, bez naknade za otkazivanje.",
    "Cancellation takes effect at the end of the billing period you have already paid for":
      "Otkazivanje stupa na snagu na kraju obračunskog perioda koji si već platio",
    ", and you keep full access until then.": ", a do tada zadržavaš pun pristup.",
    "Because cancellation runs to the end of a paid period, part-periods are not refunded. Annual plans are billed upfront at the discounted rate and are not refundable for unused months. This does not affect any refund we are required to give under applicable law, or one we agree to in an individual case.":
      "Pošto otkazivanje teče do kraja plaćenog perioda, započeti periodi se ne refundiraju. Godišnji planovi naplaćuju se unapred po umanjenoj ceni i ne refundiraju se za neiskorišćene mesece. Ovo ne utiče na povraćaj koji smo dužni da izvršimo po važećim propisima, niti na onaj koji prihvatimo u pojedinačnom slučaju.",
    "If you think you were billed in error, write to":
      "Ako misliš da ti je naplaćeno greškom, piši na",
    "within 60 days of the invoice; we investigate and correct genuine billing errors.":
      "u roku od 60 dana od računa; stvarne greške u naplati ispitujemo i ispravljamo.",
    "8. Material you give us, and the licence you grant":
      "8. Materijal koji nam daješ i licenca koju odobravaš",
    "You keep ownership of everything you upload or enter — reference photos, logos, brand assets, copy, notes and briefs (\"Your Material\").":
      "Zadržavaš vlasništvo nad svime što otpremiš ili uneseš — referentnim fotografijama, logotipima, materijalima brenda, tekstovima, beleškama i brifovima („Tvoj materijal“).",
    "You warrant that you own Your Material or hold all rights and permissions needed to use it in advertising, including permission from any person who appears in a photograph and from any photographer or other rightsholder, and that Your Material infringes nobody's rights and breaks no law.":
      "Garantuješ da si vlasnik Tvog materijala ili da imaš sva prava i dozvole potrebne za njegovu upotrebu u oglašavanju, uključujući dozvolu svake osobe koja se pojavljuje na fotografiji i svakog fotografa ili drugog nosioca prava, kao i da Tvoj materijal ne krši ničija prava ni bilo koji propis.",
    "You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, adapt and process Your Material while your account is active, strictly to operate the service for you: producing your creatives, publishing approved creatives to channels you connect, providing support and keeping backups. We do not use Your Material to train generative models for other customers, and we do not sell it. The licence ends when the material is deleted, subject to the backup cycle described in the":
      "Odobravaš nam svetsku, neisključivu licencu bez naknade da Tvoj materijal hostujemo, čuvamo, umnožavamo, prilagođavamo i obrađujemo dok je tvoj nalog aktivan, isključivo radi pružanja usluge tebi: izrade tvojih kreativa, objavljivanja odobrenih kreativa na kanalima koje povežeš, pružanja podrške i čuvanja rezervnih kopija. Tvoj materijal ne koristimo za treniranje generativnih modela za druge klijente i ne prodajemo ga. Licenca prestaje brisanjem materijala, uz ciklus rezervnih kopija opisan u dokumentu",
    "9. Creatives we deliver": "9. Kreativi koje isporučujemo",
    "Once you approve a creative, we assign to you all rights we hold in that rendered output, to the extent such rights exist and can be transferred, for use in your own advertising and marketing.":
      "Kada odobriš kreativ, prenosimo ti sva prava koja imamo na tom renderovanom rezultatu, u meri u kojoj takva prava postoje i mogu se preneti, radi upotrebe u tvom oglašavanju i marketingu.",
    "AI-generated output may not attract copyright protection":
      "AI-generisani rezultat možda ne uživa autorskopravnu zaštitu",
    "in some jurisdictions, including the United States, where purely machine-generated material is generally not registrable. We therefore do not warrant that a creative is protected by copyright, that it is unique, or that similar output has not been and will not be generated for someone else.":
      "u nekim jurisdikcijama, uključujući Sjedinjene Države, gde se isključivo mašinski generisan materijal po pravilu ne može registrovati. Zato ne garantujemo da je kreativ zaštićen autorskim pravom, da je jedinstven, niti da sličan rezultat nije i neće biti generisan za nekog drugog.",
    "We do not warrant that a creative is free of third-party rights. In a high-stakes or heavily regulated context, review a creative — or have it reviewed — before approving it.":
      "Ne garantujemo da je kreativ oslobođen prava trećih lica. U kontekstu sa velikim ulogom ili u strogo regulisanoj delatnosti, pregledaj kreativ — ili ga daj na pregled — pre nego što ga odobriš.",
    "You may use creatives in your own advertising, including paid placement. You may not resell or license rendered creatives as a standalone product, or supply them to third parties as a creative service.":
      "Kreative možeš koristiti u sopstvenom oglašavanju, uključujući plaćeni zakup prostora. Ne smeš preprodavati niti licencirati renderovane kreative kao samostalan proizvod, niti ih trećim licima isporučivati kao kreativnu uslugu.",
    "We may use anonymised, aggregated technical data about engine performance to improve the service. We do not publish your creatives as case studies or reference work without your written permission.":
      "Anonimizovane, zbirne tehničke podatke o radu mašine možemo koristiti za unapređenje usluge. Tvoje kreative ne objavljujemo kao studije slučaja ni kao referentni rad bez tvoje pisane dozvole.",
    "10. You are the advertiser": "10. Ti si oglašivač",
    "This clause matters more than any other here. Adronis produces creative and publishes what you approve;":
      "Ova klauzula je važnija od svih ostalih ovde. Adronis proizvodi kreative i objavljuje ono što odobriš;",
    "you remain the advertiser and the party legally responsible for every ad published from your account.":
      "ti ostaješ oglašivač i strana pravno odgovorna za svaki oglas objavljen sa tvog naloga.",
    "You are responsible for:": "Odgovoran si za:",
    "Reviewing each creative before approving it — prices, offers, opening hours, claims, imagery and any text shown on screen.":
      "Pregled svakog kreativa pre odobravanja — cene, ponude, radno vreme, tvrdnje, slike i svaki tekst prikazan na ekranu.",
    "Being able to substantiate every claim an ad makes about your business, products or results.":
      "Sposobnost da dokažeš svaku tvrdnju koju oglas iznosi o tvom biznisu, proizvodima ili rezultatima.",
    "Complying with advertising law and with rules specific to your sector, for example health, dental, medical, financial, alcohol, tobacco or gambling advertising rules.":
      "Poštovanje propisa o oglašavanju i pravila specifičnih za tvoju delatnost, na primer pravila o oglašavanju u zdravstvu, stomatologiji, medicini, finansijama, kao i za alkohol, duvan ili igre na sreću.",
    "Any disclosure required where you advertise, including disclosure that an ad contains AI-generated or synthetic imagery. The":
      "Svako obaveštavanje koje se traži tamo gde se oglašavaš, uključujući obaveštenje da oglas sadrži AI-generisanu ili sintetičku sliku. Dokument",
    "explains what labelling the engine applies automatically and where its limits are; that does not move your legal responsibility to us.":
      "objašnjava koje oznake mašina postavlja automatski i gde su njene granice; to ne prenosi tvoju pravnu odgovornost na nas.",
    "Complying with the terms and advertising policies of every platform you connect.":
      "Poštovanje uslova i oglasnih politika svake platforme koju povežeš.",
    "11. Acceptable use": "11. Prihvatljiva upotreba",
    "No briefs describing illegal goods or services, or claims you cannot substantiate.":
      "Bez brifova koji opisuju nedozvoljenu robu ili usluge, i bez tvrdnji koje ne možeš dokazati.",
    "No impersonation of another business, brand or person, and no use of someone else's trade marks, likeness or content without permission.":
      "Bez lažnog predstavljanja kao drugi biznis, brend ili osoba, i bez upotrebe tuđih zaštitnih znakova, lika ili sadržaja bez dozvole.",
    "No content that is deceptive, defamatory, hateful or sexually explicit, and none that targets or depicts minors.":
      "Bez sadržaja koji je obmanjujući, klevetnički, mrzilački ili seksualno eksplicitan, i bez sadržaja koji cilja ili prikazuje maloletnike.",
    "No deliberate attempts to defeat the guardrails described in the":
      "Bez namernih pokušaja da se zaobiđu provere opisane u dokumentu",
    ", and no attempt to generate output depicting a real, identifiable person without their permission.":
      ", i bez pokušaja da se generiše sadržaj koji prikazuje stvarnu, prepoznatljivu osobu bez njene dozvole.",
    "No reverse engineering, scraping, automated bulk access, resale of the service, or use of the service to build a competing product.":
      "Bez obrnutog inženjeringa, skrejpovanja, automatizovanog masovnog pristupa, preprodaje usluge ili korišćenja usluge za izgradnju konkurentskog proizvoda.",
    "No use that overloads or endangers the security or integrity of the service.":
      "Bez upotrebe koja preopterećuje ili ugrožava bezbednost ili integritet usluge.",
    "12. Connected channels and third-party platforms":
      "12. Povezani kanali i platforme trećih lica",
    "When you connect a social, search or ad channel, you authorise us to publish approved creatives on your behalf through that platform's interfaces, under that platform's own terms. Those platforms are independent of Adronis. We are not responsible for their availability, their policy decisions, their rate limits, or any suspension or restriction they impose on your account. Disconnecting a channel in the control room stops further publishing to it.":
      "Kada povežeš društveni, pretraživački ili oglasni kanal, ovlašćuješ nas da odobrene kreative objavljujemo u tvoje ime kroz interfejse te platforme, pod uslovima same platforme. Te platforme su nezavisne od Adronisa. Ne odgovaramo za njihovu dostupnost, njihove odluke o politikama, njihova ograničenja učestalosti, niti za suspenziju ili ograničenje koje nametnu tvom nalogu. Odspajanjem kanala u kontrolnoj sobi prestaje dalje objavljivanje na njemu.",
    "13. Changes, suspension and termination": "13. Izmene, suspenzija i raskid",
    "We improve and change the service over time. We will not materially reduce the core functionality of a plan you are paying for without at least 30 days' notice and a right to cancel.":
      "Uslugu vremenom unapređujemo i menjamo. Nećemo bitno umanjiti osnovnu funkcionalnost plana koji plaćaš bez obaveštenja najmanje 30 dana unapred i prava na otkazivanje.",
    "We may suspend or terminate an account immediately for non-payment, for a serious or repeated breach of clause 11, for illegal use, or where required by law or by a platform we depend on. Where practical we warn you first and give you a chance to fix the problem.":
      "Nalog možemo odmah suspendovati ili ugasiti zbog neplaćanja, teške ili ponovljene povrede klauzule 11, nedozvoljene upotrebe, ili kada to nalaže propis ili platforma od koje zavisimo. Kada je izvodljivo, prvo te upozorimo i damo ti priliku da problem otkloniš.",
    "You can stop using the service at any time. Clauses 8 (your warranty), 9, 10, 14, 15, 16, 17, 20 and 21 survive termination.":
      "Uslugu možeš prestati da koristiš u svakom trenutku. Klauzule 8 (tvoja garancija), 9, 10, 14, 15, 16, 17, 20 i 21 ostaju na snazi i posle raskida.",
    "After termination we keep and delete your data as set out in the":
      "Posle raskida tvoje podatke čuvamo i brišemo kako je navedeno u dokumentu",
    ". Export anything you want to keep before you cancel.":
      ". Izvezi sve što želiš da sačuvaš pre nego što otkažeš.",
    "14. Disclaimers": "14. Ograničenja garancija",
    "The service is provided \"as is\" and \"as available\". To the fullest extent permitted by law we exclude all implied warranties, including fitness for a particular purpose, merchantability, non-infringement and uninterrupted operation.":
      "Usluga se pruža „takva kakva jeste“ i „prema dostupnosti“. U najvećoj meri dozvoljenoj propisima isključujemo sve podrazumevane garancije, uključujući podobnost za određenu svrhu, utrživost, nepovredivost tuđih prava i neprekidan rad.",
    "We do not guarantee any advertising outcome.": "Ne garantujemo nikakav oglasni rezultat.",
    "Nothing on this site — including examples, illustrations, sample figures or estimates — is a promise of reach, engagement, leads, bookings, sales or revenue. Results depend on your business, your market, your offer and decisions made by third-party platforms.":
      "Ništa na ovom sajtu — uključujući primere, ilustracije, okvirne brojeve ili procene — nije obećanje dosega, angažovanja, kontakata, rezervacija, prodaje ili prihoda. Rezultati zavise od tvog biznisa, tvog tržišta, tvoje ponude i odluka platformi trećih lica.",
    "Automated guardrails reduce, but do not eliminate, the known failure modes of generative models. Review every creative before you approve it.":
      "Automatske provere smanjuju, ali ne uklanjaju, poznate načine na koje generativni modeli greše. Pregledaj svaki kreativ pre nego što ga odobriš.",
    "15. Limitation of liability": "15. Ograničenje odgovornosti",
    "Neither party excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be excluded.":
      "Nijedna strana ne isključuje odgovornost za smrt ili telesnu povredu prouzrokovanu nepažnjom, za prevaru ili prevarno lažno prikazivanje, niti za bilo šta drugo što se po propisima ne može isključiti.",
    "Subject to that, we are not liable for indirect or consequential loss, or for loss of profit, revenue, business, goodwill, anticipated savings or data, or for missed posting windows and outages caused by third-party platforms.":
      "Uz to ograničenje, ne odgovaramo za posrednu ili posledičnu štetu, za izgubljenu dobit, prihod, posao, ugled, očekivanu uštedu ili podatke, niti za propuštene termine objave i prekide izazvane platformama trećih lica.",
    "Subject to the paragraph above, our total aggregate liability arising out of or in connection with this agreement — in contract, tort (including negligence) or otherwise — is limited to the greater of (a) the total fees you paid us in the 12 months immediately before the event giving rise to the claim, and (b) EUR 100.":
      "Uz prethodni stav, naša ukupna odgovornost koja proizlazi iz ovog ugovora ili je s njim povezana — ugovorna, vanugovorna (uključujući nepažnju) ili druga — ograničena je na veći od sledeća dva iznosa: (a) ukupne naknade koje si nam platio u 12 meseci neposredno pre događaja koji je doveo do zahteva i (b) 100 EUR.",
    "16. Your indemnity": "16. Tvoja obaveza naknade",
    "You will defend and indemnify us against claims, damages, fines and reasonable costs arising from Your Material, from a brief you submitted, from an ad you approved or published, from your breach of clause 10 or 11, or from your breach of a platform's terms. We will tell you promptly about any such claim and will not settle it without your consent, which you will not unreasonably withhold.":
      "Branićeš nas i obeštetiti za zahteve, štetu, kazne i razumne troškove koji proizlaze iz Tvog materijala, iz brifa koji si dostavio, iz oglasa koji si odobrio ili objavio, iz tvoje povrede klauzule 10 ili 11, ili iz tvoje povrede uslova neke platforme. O svakom takvom zahtevu obavestićemo te bez odlaganja i nećemo ga poravnati bez tvoje saglasnosti, koju nećeš uskratiti bez opravdanog razloga.",
    "17. Data protection": "17. Zaštita podataka",
    "How we handle personal data is set out in the":
      "Kako postupamo sa ličnim podacima opisano je u dokumentu",
    ". Where we process personal data on your behalf — for example personal data in reference photos or briefs you upload — we act as processor and you act as controller. A data processing agreement on our standard terms is available at":
      ". Kada lične podatke obrađujemo u tvoje ime — na primer lične podatke u referentnim fotografijama ili brifovima koje otpremiš — mi nastupamo kao obrađivač, a ti kao rukovalac. Ugovor o obradi podataka po našim standardnim uslovima dostupan je na",
    "and applies to that processing.": "i primenjuje se na tu obradu.",
    "18. Intellectual property, and complaints": "18. Intelektualna svojina i prijave",
    "We keep our platform, engine, models, templates, prompts, software, brand and documentation. Nothing here transfers them to you.":
      "Zadržavamo svoju platformu, mašinu, modele, šablone, promptove, softver, brend i dokumentaciju. Ništa ovde ti ih ne prenosi.",
    "If you believe material produced or published through Adronis infringes your rights, write to":
      "Ako smatraš da materijal napravljen ili objavljen preko Adronisa krši tvoja prava, piši na",
    "with your contact details, identification of the work concerned, the creative or URL in question, a statement of your good-faith belief that the use is unauthorised, and a statement that your information is accurate. We investigate every notice, act on valid ones — including removal — and terminate repeat infringers.":
      "uz svoje kontakt podatke, oznaku dela o kom je reč, sporni kreativ ili URL, izjavu da u dobroj veri smatraš da je upotreba neovlašćena i izjavu da su tvoji podaci tačni. Svaku prijavu ispitujemo, po osnovanim postupamo — uključujući uklanjanje — i gasimo naloge onima koji ponavljaju povrede.",
    "19. Changes to these terms": "19. Izmene ovih uslova",
    "We email active accounts at least 14 days before a material change takes effect and update the date at the top of this page. If you do not accept a change, cancel before it takes effect; continued use afterwards means you accept the updated terms.":
      "Aktivnim nalozima šaljemo email najmanje 14 dana pre nego što bitna izmena stupi na snagu i ažuriramo datum na vrhu ove stranice. Ako izmenu ne prihvataš, otkaži pre nego što stupi na snagu; nastavak korišćenja posle toga znači da prihvataš ažurirane uslove.",
    "20. Governing law and disputes": "20. Merodavno pravo i sporovi",
    "This agreement and any dispute arising out of it are governed by the law of [GOVERNING LAW COUNTRY], excluding its conflict-of-law rules and the UN Convention on Contracts for the International Sale of Goods. The courts of [COMPETENT COURT / CITY] have exclusive jurisdiction, except that either party may seek injunctive relief in any competent court. Where mandatory law in your country gives you the right to bring proceedings elsewhere, that right is unaffected.":
      "Na ovaj ugovor i svaki spor koji iz njega proizlazi primenjuje se pravo [GOVERNING LAW COUNTRY], uz isključenje njegovih kolizionih pravila i Konvencije UN o ugovorima o međunarodnoj prodaji robe. Isključivo su nadležni sudovi u [COMPETENT COURT / CITY], s tim što svaka strana može tražiti privremenu meru pred bilo kojim nadležnim sudom. Ako ti prinudni propisi tvoje zemlje daju pravo da postupak pokreneš drugde, to pravo ostaje netaknuto.",
    "Before starting proceedings, please write to": "Pre pokretanja postupka, piši na",
    "so we can try to resolve the matter directly.":
      "kako bismo pokušali da stvar rešimo neposredno.",
    "21. General": "21. Opšte odredbe",
    "Entire agreement.": "Celina ugovora.",
    "These terms, the Privacy Policy and the AI Disclosure are the whole agreement between us and replace any earlier statement about the service, including marketing copy.":
      "Ovi uslovi, Politika privatnosti i AI obaveštenje čine celokupan ugovor između nas i zamenjuju svaku raniju izjavu o usluzi, uključujući marketinške tekstove.",
    "Force majeure.": "Viša sila.",
    "Neither party is liable for failure caused by events beyond its reasonable control, including platform or infrastructure outages, network failure, government action or natural events.":
      "Nijedna strana ne odgovara za neizvršenje izazvano događajima izvan njene razumne kontrole, uključujući prekide platformi ili infrastrukture, otkaz mreže, akte državnih organa ili prirodne događaje.",
    "Assignment.": "Ustupanje.",
    "You may not assign this agreement without our written consent. We may assign it to an affiliate, or in connection with a merger, reorganisation or sale of the business, on notice to you.":
      "Ovaj ugovor ne možeš ustupiti bez naše pisane saglasnosti. Mi ga možemo ustupiti povezanom društvu, ili u vezi sa pripajanjem, reorganizacijom ili prodajom poslovanja, uz obaveštenje tebi.",
    "Severability.": "Delimična ništavost.",
    "If a clause is held invalid, the rest stays in force and that clause is read down to the minimum extent needed to make it enforceable.":
      "Ako se neka klauzula oglasi ništavom, ostatak ostaje na snazi, a ta klauzula se tumači u najužem obimu potrebnom da bi bila izvršiva.",
    "No waiver.": "Bez odricanja.",
    "Not enforcing a right does not waive it.":
      "Neostvarivanje nekog prava ne znači odricanje od njega.",
    "No partnership.": "Bez ortakluka.",
    "Nothing here creates a partnership, agency or employment relationship beyond the publishing authority you grant in clause 12.":
      "Ništa ovde ne zasniva ortakluk, zastupništvo ni radni odnos izvan ovlašćenja za objavljivanje koje daješ u klauzuli 12.",
    "Notices.": "Obaveštenja.",
    "We give notice by email to the address on your account. You give notice to":
      "Mi obaveštenja šaljemo emailom na adresu sa tvog naloga. Ti obaveštenja šalješ na",
    "Language.": "Jezik.",
    "The English version of these terms governs; any translation is for convenience.":
      "Merodavna je engleska verzija ovih uslova; svaki prevod služi radi lakšeg razumevanja.",
    "22. Contact": "22. Kontakt",
    "Questions about these terms:": "Pitanja o ovim uslovima:",

    /* --- Privacy policy --------------------------------------------------- */
    "Privacy Policy — Adronis": "Politika privatnosti — Adronis",
    "PRIVACY": "PRIVATNOST",
    "Last updated September 21, 2026. What we collect, why we are allowed to, who else sees it, how long we keep it, and how you get it back or deleted.":
      "Poslednja izmena 21. septembra 2026. Šta prikupljamo, po kom osnovu smemo, ko to još vidi, koliko dugo čuvamo i kako to možeš dobiti nazad ili obrisati.",
    "1. Who is responsible for your data": "1. Ko je odgovoran za tvoje podatke",
    "The controller of the personal data described here is":
      "Rukovalac ličnim podacima opisanim ovde je",
    ", registered in [COUNTRY] under company registration number [REGISTRATION NUMBER], registered office [REGISTERED ADDRESS] — the company that operates Adronis. Full company details are on our":
      ", registrovano u [COUNTRY] pod matičnim brojem [REGISTRATION NUMBER], sa sedištem na adresi [REGISTERED ADDRESS] — društvo koje upravlja Adronisom. Potpuni podaci o firmi su ovde:",
    "terms page": "stranica sa uslovima",
    "Data protection contact:": "Kontakt za zaštitu podataka:",
    ". [If required, name your EU / UK representative here.]":
      ". [Ako je potrebno, ovde navedi svog predstavnika za EU / UK.]",
    "2. Two different roles": "2. Dve različite uloge",
    "For your account, your billing data and your use of the product, we are the":
      "Za tvoj nalog, podatke o naplati i korišćenje proizvoda mi smo",
    "controller": "rukovalac",
    "— we decide why and how that data is processed, and this policy describes it.":
      "— mi odlučujemo zašto se i kako ti podaci obrađuju, a ova politika to opisuje.",
    "For personal data inside the material you upload — a face in a reference photo, a name in a brief, a customer detail in a note — we act as your":
      "Za lične podatke unutar materijala koji otpremiš — lice na referentnoj fotografiji, ime u brifu, podatak o mušteriji u belešci — nastupamo kao tvoj",
    "processor": "obrađivač",
    ": you decide what goes in, we process it to run the service for you. A data processing agreement on our standard terms covers that processing and is available at":
      ": ti odlučuješ šta ulazi, mi to obrađujemo da bismo ti pružili uslugu. Tu obradu pokriva ugovor o obradi podataka po našim standardnim uslovima, dostupan na",
    "3. What we collect": "3. Šta prikupljamo",
    "Account details:": "Podaci o nalogu:",
    "business name, owner name, email address, password (stored hashed by our authentication provider), city, vertical, website or social handle.":
      "naziv biznisa, ime vlasnika, email adresa, lozinka (čuva je heširanu naš provajder autentifikacije), grad, tip biznisa, sajt ili nalog na mreži.",
    "Business brief:": "Brif biznisa:",
    "what you sell, your typical customer, what makes you different, brand vibe, palette, things the engine should avoid.":
      "šta prodaješ, ko ti je tipična mušterija, po čemu se razlikuješ, atmosfera brenda, paleta, stvari koje mašina treba da izbegava.",
    "Brand material you upload:": "Materijal brenda koji otpremiš:",
    "reference photos, logos and other assets, which may contain images of people.":
      "referentne fotografije, logotipi i drugi materijali, koji mogu sadržati slike ljudi.",
    "Channel connections:": "Povezani kanali:",
    "the access tokens needed to publish to the platforms you connect, and the account identifiers those platforms return.":
      "tokeni pristupa potrebni za objavljivanje na platformama koje povežeš i identifikatori naloga koje te platforme vraćaju.",
    "Billing data:": "Podaci o naplati:",
    "billing email, country, VAT identification number if you give one, plan, billing cycle, invoice history and payment status.":
      "email za naplatu, država, PDV identifikacioni broj ako ga daš, plan, ciklus naplate, istorija računa i status plaćanja.",
    "Card numbers are handled entirely by Paddle": "Brojeve kartica u potpunosti obrađuje Paddle",
    "— they are entered on Paddle's systems and we never receive or store them.":
      "— unose se u Paddle sisteme i mi ih nikada ne primamo niti čuvamo.",
    "Product usage:": "Korišćenje proizvoda:",
    "which creatives you approve or kill, when, and the engagement metrics connected platforms report back.":
      "koje kreative odobriš ili odbaciš, kada, i metrike angažovanja koje povezane platforme vraćaju.",
    "Messages you send us:": "Poruke koje nam pošalješ:",
    "contact and support forms, including anything you choose to write in them.":
      "forme za kontakt i podršku, uključujući sve što odlučiš da u njima napišeš.",
    "Technical data:": "Tehnički podaci:",
    "IP address, browser and device information, and server and security logs generated when you use the site.":
      "IP adresa, podaci o pregledaču i uređaju, kao i serverski i bezbednosni logovi koji nastaju dok koristiš sajt.",
    "4. Why we process it, and on what legal basis":
      "4. Zašto to obrađujemo i po kom pravnom osnovu",
    "To provide the service": "Da pružimo uslugu",
    "— creating your account, rendering drops from your brief, publishing approved creatives, showing performance. Basis: performance of our contract with you.":
      "— otvaranje naloga, renderovanje dropova iz tvog brifa, objavljivanje odobrenih kreativa, prikaz rezultata. Osnov: izvršenje ugovora sa tobom.",
    "To bill you and keep accounts": "Da naplatimo i vodimo knjige",
    "— subscriptions, invoices, tax. Basis: performance of the contract, and legal obligation for tax and accounting records.":
      "— pretplate, računi, porez. Osnov: izvršenje ugovora i zakonska obaveza za poresku i računovodstvenu evidenciju.",
    "To support you": "Da ti pružimo podršku",
    "— answering messages, investigating problems. Basis: performance of the contract, and our legitimate interest in running a supportable product.":
      "— odgovaranje na poruke, ispitivanje problema. Osnov: izvršenje ugovora i naš legitimni interes da vodimo proizvod koji se može podržati.",
    "To keep the service secure and working": "Da usluga bude bezbedna i da radi",
    "— logging, abuse prevention, debugging, backups. Basis: our legitimate interest in the security and integrity of the service.":
      "— logovanje, sprečavanje zloupotreba, otklanjanje grešaka, rezervne kopije. Osnov: naš legitimni interes za bezbednost i integritet usluge.",
    "To improve the engine": "Da unapredimo mašinu",
    "— using aggregated, anonymised signals about output quality and performance. Basis: our legitimate interest in improving the product. We do not use your brand material to train generative models for other customers.":
      "— korišćenjem zbirnih, anonimizovanih signala o kvalitetu i rezultatima. Osnov: naš legitimni interes za unapređenje proizvoda. Materijal tvog brenda ne koristimo za treniranje generativnih modela za druge klijente.",
    "To send service emails": "Da šaljemo servisne emailove",
    "— drop ready, approval reminders, billing and trial notices, changes to these documents. Basis: performance of the contract. Any purely promotional email is sent only with your consent and can be switched off at any time.":
      "— drop je spreman, podsetnici za odobravanje, obaveštenja o naplati i probi, izmene ovih dokumenata. Osnov: izvršenje ugovora. Čisto promotivni email šalje se samo uz tvoju saglasnost i može se isključiti u svakom trenutku.",
    "To meet legal obligations and defend legal claims.":
      "Da ispunimo zakonske obaveze i branimo pravne zahteve.",
    "Basis: legal obligation, and our legitimate interest in establishing or defending claims.":
      "Osnov: zakonska obaveza i naš legitimni interes za postavljanje ili odbranu zahteva.",
    "We do not sell personal data, and we do not use it for automated decisions that produce legal or similarly significant effects for you.":
      "Lične podatke ne prodajemo i ne koristimo ih za automatizovane odluke koje na tebe proizvode pravno ili slično značajno dejstvo.",
    "5. Cookies and local storage": "5. Kolačići i lokalno skladište",
    "We use only what is strictly necessary to run the product: a session stored in your browser to keep you signed in, and storage for basic interface preferences.":
      "Koristimo samo ono što je neophodno za rad proizvoda: sesiju sačuvanu u tvom pregledaču da ostaneš prijavljen i skladište za osnovna podešavanja interfejsa.",
    "We do not use analytics, advertising or tracking cookies, and there are no third-party trackers on this site.":
      "Ne koristimo analitičke, oglasne ni prateće kolačiće, i na ovom sajtu nema pratilaca trećih lica.",
    "On your first visit we ask you to confirm your choice, and we remember it in your browser. If we ever introduce analytics or any non-essential cookie, we will ask for your consent again and update this section before it is switched on.":
      "Pri prvoj poseti tražimo da potvrdiš svoj izbor i pamtimo ga u tvom pregledaču. Ako ikada uvedemo analitiku ili bilo koji kolačić koji nije neophodan, ponovo ćemo tražiti tvoju saglasnost i ažurirati ovaj odeljak pre nego što se uključi.",
    "Cookie settings": "Podešavanja kolačića",
    "6. Who else processes your data": "6. Ko još obrađuje tvoje podatke",
    "We share personal data only with providers that help us run the service, under contracts that oblige them to protect it and to process it only on our instructions:":
      "Lične podatke delimo samo sa provajderima koji nam pomažu da vodimo uslugu, po ugovorima koji ih obavezuju da ih štite i obrađuju isključivo po našim uputstvima:",
    "— database, authentication and file storage for the product.":
      "— baza podataka, autentifikacija i skladištenje fajlova za proizvod.",
    "— our online reseller and Merchant of Record: payment processing, subscriptions, invoicing and tax. Paddle acts as an independent controller for payment, tax and fraud-prevention purposes under its own privacy policy.":
      "— naš online preprodavac i prodavac (Merchant of Record): obrada plaćanja, pretplate, izdavanje računa i porez. Paddle nastupa kao samostalan rukovalac za potrebe plaćanja, poreza i sprečavanja prevara, po sopstvenoj politici privatnosti.",
    "— website and application hosting, including request and security logs.":
      "— hosting sajta i aplikacije, uključujući logove zahteva i bezbednosne logove.",
    "Generative model providers": "Provajderi generativnih modela",
    "— the AI services that render creatives from your brief and reference material. A current list of the providers in use is available on request.":
      "— AI usluge koje renderuju kreative iz tvog brifa i referentnog materijala. Aktuelan spisak provajdera u upotrebi dostupan je na zahtev.",
    "Email delivery provider": "Provajder za isporuku emaila",
    "— for service and account emails.": "— za servisne emailove i emailove o nalogu.",
    "Platforms you connect yourself": "Platforme koje sam povežeš",
    "— Instagram, Facebook, TikTok, Google Business, LinkedIn, Pinterest. We exchange data with them to publish creatives you approved and to read back performance metrics. They handle that data under their own privacy policies, as independent controllers.":
      "— Instagram, Facebook, TikTok, Google Business, LinkedIn, Pinterest. Sa njima razmenjujemo podatke da bismo objavili kreative koje si odobrio i očitali metrike rezultata. Oni tim podacima rukuju po sopstvenim politikama privatnosti, kao samostalni rukovaoci.",
    "We may also disclose data where we are legally required to, or to establish or defend legal claims. If the business is ever sold or reorganised, data may transfer to the acquirer, and we will tell you before that happens.":
      "Podatke možemo otkriti i kada smo na to zakonski obavezni, ili radi postavljanja i odbrane pravnih zahteva. Ako poslovanje ikada bude prodato ili reorganizovano, podaci mogu preći na sticaoca, a mi ćemo te obavestiti pre nego što se to dogodi.",
    "An up-to-date list of subprocessors is available at":
      "Ažuran spisak podobrađivača dostupan je na",
    ". Business customers with a signed data processing agreement receive notice of new subprocessors before they start.":
      ". Poslovni klijenti sa potpisanim ugovorom o obradi podataka dobijaju obaveštenje o novim podobrađivačima pre nego što počnu sa radom.",
    "7. International transfers": "7. Međunarodni prenosi",
    "Some of the providers above are based outside the European Economic Area, including in the United States. Where data is transferred outside the EEA, we rely on the European Commission's Standard Contractual Clauses, on an adequacy decision where one applies, or on another lawful transfer mechanism, together with the additional safeguards our providers commit to. You can ask us for details of the mechanism used for a particular transfer.":
      "Neki od navedenih provajdera imaju sedište izvan Evropskog ekonomskog prostora, uključujući Sjedinjene Države. Kada se podaci prenose izvan EEP, oslanjamo se na Standardne ugovorne klauzule Evropske komisije, na odluku o adekvatnosti gde postoji, ili na drugi zakonit mehanizam prenosa, uz dodatne mere zaštite na koje se naši provajderi obavezuju. Možeš nas pitati za pojedinosti o mehanizmu korišćenom za određeni prenos.",
    "8. How long we keep it": "8. Koliko dugo čuvamo",
    "Account data, brand material and rendered creatives:":
      "Podaci o nalogu, materijal brenda i renderovani kreativi:",
    "while your account is active, plus 90 days after cancellation so you can reactivate. Deleted after that, or sooner if you ask.":
      "dok je tvoj nalog aktivan, plus 90 dana nakon otkazivanja da bi mogao da ga reaktiviraš. Posle toga se brišu, ili ranije ako tako zatražiš.",
    "Channel tokens:": "Tokeni kanala:",
    "deleted when you disconnect the channel or close the account, whichever comes first.":
      "brišu se kada odspojiš kanal ili zatvoriš nalog, šta god nastupi pre.",
    "Invoices and accounting records:": "Računi i računovodstvena dokumentacija:",
    "kept for the period tax law requires, typically up to 10 years. These cannot be deleted on request while that obligation runs.":
      "čuvaju se koliko poreski propisi nalažu, po pravilu do 10 godina. Dok ta obaveza traje, ne mogu se obrisati na zahtev.",
    "Contact and support messages:": "Poruke za kontakt i podršku:",
    "24 months from the last message in the thread.":
      "24 meseca od poslednje poruke u prepisci.",
    "Server and security logs:": "Serverski i bezbednosni logovi:",
    "up to 12 months.": "do 12 meseci.",
    "Backups:": "Rezervne kopije:",
    "deleted data can persist in encrypted backups for up to 35 days before those backups expire.":
      "obrisani podaci mogu ostati u šifrovanim rezervnim kopijama do 35 dana, dok te kopije ne isteknu.",
    "9. Your rights": "9. Tvoja prava",
    "Subject to the conditions in applicable data protection law, you have the right to: get a copy of your data; correct it; delete it; restrict or object to processing, including processing based on our legitimate interests; receive it in a portable format; and withdraw a consent you gave, without affecting processing carried out before you withdrew it.":
      "Pod uslovima iz važećih propisa o zaštiti podataka, imaš pravo da: dobiješ kopiju svojih podataka; ispraviš ih; obrišeš ih; ograničiš obradu ili joj prigovoriš, uključujući obradu zasnovanu na našim legitimnim interesima; dobiješ ih u prenosivom formatu; i povučeš datu saglasnost, bez uticaja na obradu izvršenu pre povlačenja.",
    "To exercise any of these, email": "Da ostvariš bilo koje od njih, piši na",
    "from the address on your account, or write through our":
      "sa adrese sa tvog naloga, ili nam piši ovde:",
    ". We respond within one month, and will tell you if we need longer because a request is complex. We may ask you to confirm your identity before acting.":
      ". Odgovaramo u roku od mesec dana i javićemo ti ako nam treba duže jer je zahtev složen. Možemo tražiti da potvrdiš identitet pre nego što postupimo.",
    "If you are unhappy with how we handled a request, you can complain to your data protection supervisory authority — in the EU, the authority of the country where you live or work, and in Serbia, the Commissioner for Information of Public Importance and Personal Data Protection. We would rather hear from you first.":
      "Ako nisi zadovoljan načinom na koji smo postupili po zahtevu, možeš se obratiti nadzornom organu za zaštitu podataka — u EU organu zemlje u kojoj živiš ili radiš, a u Srbiji Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti. Ipak bismo voleli da se prvo javiš nama.",
    "10. Security": "10. Bezbednost",
    "Data is encrypted in transit with TLS and at rest by our infrastructure providers. Channel tokens and credentials are stored in restricted-access storage. Access to production data is limited to the people who need it to operate the rendering and publishing pipeline, and access is logged. We keep backups, use row-level access rules so that one account cannot read another's data, and review this as the product changes.":
      "Podaci su šifrovani u prenosu putem TLS-a i u mirovanju kod naših infrastrukturnih provajdera. Tokeni kanala i pristupni podaci čuvaju se u skladištu sa ograničenim pristupom. Pristup produkcionim podacima imaju samo ljudi kojima je potreban za rad renderovanja i objavljivanja, i taj pristup se evidentira. Držimo rezervne kopije, koristimo pravila pristupa na nivou reda tako da jedan nalog ne može čitati podatke drugog, i to preispitujemo kako se proizvod menja.",
    "No system is perfectly secure. If a personal data breach occurs that is likely to present a risk, we notify the competent supervisory authority within 72 hours of becoming aware of it, and notify affected customers without undue delay where the law requires.":
      "Nijedan sistem nije savršeno bezbedan. Ako dođe do povrede ličnih podataka koja verovatno nosi rizik, obaveštavamo nadležni nadzorni organ u roku od 72 sata od saznanja, a pogođene klijente bez nepotrebnog odlaganja kada to propis nalaže.",
    "11. Children": "11. Deca",
    "Adronis is a business product and is not directed at children. We do not knowingly collect data from anyone under 18. Do not upload reference material depicting children unless you hold the permission of their parent or guardian for advertising use.":
      "Adronis je poslovni proizvod i nije namenjen deci. Svesno ne prikupljamo podatke od osoba mlađih od 18 godina. Ne otpremaj referentni materijal na kom su deca, osim ako imaš dozvolu roditelja ili staratelja za oglasnu upotrebu.",
    "12. Changes to this policy": "12. Izmene ove politike",
    "We email active accounts at least 14 days before a material change takes effect, and always update the date at the top of this page.":
      "Aktivnim nalozima šaljemo email najmanje 14 dana pre nego što bitna izmena stupi na snagu i uvek ažuriramo datum na vrhu ove stranice.",
    "13. Contact": "13. Kontakt",
    "Privacy questions and data requests:": "Pitanja o privatnosti i zahtevi za podatke:",
    ", or our": ", ili naša",

    /* --- Strings the scripts write into the page -------------------------- */
    "4 ads / week · 2 channels": "4 oglasa / nedeljno · 2 kanala",
    "30 ads / week · unlimited": "30 oglasa / nedeljno · neograničeno",
    "3 ads / month · 1 channel": "3 oglasa / mesečno · 1 kanal",
    "4 photoreal creatives every Monday": "4 fotorealistična kreativa svakog ponedeljka",
    "12 creatives across all native formats": "12 kreativa u svim nativnim formatima",
    "30 creatives, multi-location aware": "30 kreativa, svesnih više lokacija",
    "3 photoreal creatives every month": "3 fotorealistična kreativa svakog meseca",
    "One connected channel": "Jedan povezan kanal",
    "Two connected channels": "Dva povezana kanala",
    "Four connected channels": "Četiri povezana kanala",
    "Unlimited channels and locations": "Neograničeno kanala i lokacija",
    "Best-time auto-publishing": "Automatska objava u najbolje vreme",
    "Swipe approval in the app": "Odobravanje prevlačenjem u aplikaciji",
    "Seasonal & local hook engine": "Mašina za sezonske i lokalne kuke",
    "Performance feedback into next drop": "Rezultati se vraćaju u sledeći drop",
    "Caption variants and A/B slotting": "Varijante opisa i A/B raspoređivanje",
    "Human creative director review": "Pregled ljudskog kreativnog direktora",
    "Brand-safety approvals workflow": "Tok odobravanja za bezbednost brenda",
    "Dedicated drop slot and support": "Namenski termin za drop i podrška",
    "No card needed — upgrade whenever you like":
      "Bez kartice — nadogradi kad god poželiš",
    "FREE PLAN · NO CARD NEEDED": "BESPLATNI PLAN · BEZ KARTICE",
    "Annual discount (20%)": "Godišnji popust (20%)",
    "1 month": "1 mesec",
    "12 months": "12 meseci",
    "monthly": "mesečno",
    "annual": "godišnje",
    "TRIAL": "PROBA",
    "PAST DUE": "DOSPELO",
    "CANCELED": "OTKAZANO",
    "Free trial": "Besplatna proba",
    "Active": "Aktivno",
    "Past due — update your card": "Dospelo — ažuriraj karticu",
    "Canceled — you're on the Free plan": "Otkazano — na besplatnom si planu",
    "No active plan": "Nema aktivnog plana",
    "Started": "Počelo",
    "Free trial started": "Besplatna proba počela",
    "You're on the Free plan.": "Na besplatnom si planu.",
    "A few free ads every month, no card on file. Pick a plan for a full drop every week.":
      "Nekoliko besplatnih oglasa svakog meseca, bez kartice. Izaberi plan za pun drop svake nedelje.",
    "Keep my subscription": "Zadrži moju pretplatu",
    "Check both your old and new inbox — confirm the change to finish.":
      "Proveri i staro i novo sanduče — potvrdi promenu da završiš.",
    "Those two new passwords don't match.": "Te dve nove lozinke se ne poklapaju.",
    "Current password is incorrect.": "Trenutna lozinka nije tačna.",
    "Password updated.": "Lozinka je promenjena.",
    "Channels saved — next week's drop renders for these only.":
      "Kanali sačuvani — sledeći drop se renderuje samo za njih.",
    "Could not save your profile — please try again.":
      "Nismo uspeli da sačuvamo tvoj profil — pokušaj ponovo.",
    "Log out failed — try again.": "Odjava nije uspela — pokušaj ponovo.",
    "Not signed in.": "Nisi prijavljen.",
    "You need to be signed in to check out.":
      "Moraš biti prijavljen da bi prešao na naplatu.",
    "We need a billing email before we can hand you to Paddle.":
      "Treba nam email za naplatu pre nego što te prosledimo Paddle-u.",
    "That code isn't valid — check it and try again.":
      "Taj kod nije važeći — proveri ga i pokušaj ponovo.",
    "ALREADY RUNNING": "VEĆ TEČE",
    "Nothing to pay here — your plan is already on the account.":
      "Ovde nema šta da se plati — tvoj plan je već na nalogu.",
    "YOU'RE ALL SET": "SVE JE SPREMNO",
    "CHECKOUT CANCELLED": "NAPLATA PREKINUTA",
    "No charge was made.": "Naplate nije bilo.",
    "Your plan is still waiting — pick up where you left off whenever you're ready.":
      "Tvoj plan i dalje čeka — nastavi gde si stao kad god budeš spreman.",
    "Payment received — your plan is running again.":
      "Uplata primljena — tvoj plan ponovo radi.",
    "PLAN ACTIVE · FIRST MONTH PAID": "PLAN AKTIVAN · PRVI MESEC PLAĆEN",
    "PLAN ACTIVE · FIRST YEAR PAID": "PLAN AKTIVAN · PRVA GODINA PLAĆENA",
    "Your card was charged today for the first month.":
      "Tvoja kartica je danas naplaćena za prvi mesec.",
    "Your card was charged today for the first year.":
      "Tvoja kartica je danas naplaćena za prvu godinu.",
    "Welcome back.": "Dobro došao nazad.",
    "Finish signing up": "Završi registraciju",
    "All weeks": "Sve nedelje",
    "ALL WEEKS": "SVE NEDELJE",
    "NO IMAGE YET": "JOŠ NEMA SLIKE",
    "IMAGE UNAVAILABLE": "SLIKA NIJE DOSTUPNA",
    "PREVIEW ONLY — NOT SAVED": "SAMO PREGLED — NIJE SAČUVANO",
    "PUBLISHED": "OBJAVLJENO",
    "Put back in the queue": "Vrati u red",
    "Nothing is waiting on you here. Fresh creatives land with next Monday's drop.":
      "Ovde ništa ne čeka na tebe. Novi kreativi stižu sa dropom u ponedeljak.",
    "Nothing is waiting on you here. New free ads show up the moment they're rendered.":
      "Ovde ništa ne čeka na tebe. Novi besplatni oglasi se pojavljuju čim se izrenderuju.",
    "NOT YET SLOTTED": "JOŠ BEZ TERMINA",
    "Your time": "Tvoje vreme",
    "Change time": "Promeni vreme",
    "Pick a time": "Izaberi vreme",
    "DAY": "DAN",
    "TIME": "VREME",
    "Save time": "Sačuvaj vreme",
    "Let Adronis pick": "Neka Adronis izabere",
    "Any time from 10 minutes to 90 days from now, in your device's time zone.":
      "Bilo koje vreme od 10 minuta do 90 dana od sada, po vremenskoj zoni tvog uređaja.",
    "Pick a day and a time.": "Izaberi dan i vreme.",
    "Pick a time at least 10 minutes from now.": "Izaberi vreme najmanje 10 minuta od sada.",
    "Pick a time within the next 90 days.": "Izaberi vreme u narednih 90 dana.",
    "Couldn't save the new time — try again.": "Novo vreme nije sačuvano — pokušaj ponovo.",
    "This creative is about to go out - its time can't change now.":
      "Ovaj oglas upravo izlazi — vreme mu se sada ne može promeniti.",
    "Only an approved creative that hasn't gone out can be rescheduled.":
      "Vreme se može promeniti samo odobrenom oglasu koji još nije izašao.",
    "Baked at 5am. Gone by noon.": "Pečeno u 5 ujutru. Nestane do podne.",

    /* --- Home page: copy the template runtime holds as data ---------------
       The four steps, the panels behind them, the sample creatives and the
       dashboard live in the page's own script rather than in its markup, so
       they only reach the DOM once the runtime renders. Keyed the same way. */
    "Brief once": "Brifuj jednom",
    "Ten minutes. Your offer, your voice, your street. We build a brand fingerprint and never ask you again.":
      "Deset minuta. Tvoja ponuda, tvoj ton, tvoja ulica. Napravimo otisak brenda i više te ne pitamo.",
    "The studio runs": "Studio radi",
    "Every Monday at 09:00 the engine renders a fresh batch — photoreal scenes, seasonal hooks, local references, one per channel format.":
      "Svakog ponedeljka u 09:00 mašina renderuje novu turu — fotorealistične scene, sezonske kuke, lokalne reference, po jedna za svaki format kanala.",
    "You approve, or you don't": "Ti odobriš, ili ne odobriš",
    "Swipe the drop in under two minutes. Kill anything off-brand. What survives enters the queue.":
      "Prođi kroz drop za manje od dva minuta. Odbaci sve što nije u duhu brenda. Šta preživi, ulazi u red.",
    "It publishes itself": "Samo se objavljuje",
    "Best-time slotting, caption variants, hashtags, cross-posting. You find out it happened from the customers.":
      "Termini u najbolje vreme, varijante opisa, heštegovi, objava na više mreža. Da se desilo, saznaš od mušterija.",

    "BRAND FINGERPRINT": "OTISAK BRENDA",
    "LOCKED": "ZAKLJUČANO",
    "REFERENCE SET · 24 IMAGES": "REFERENTNI SET · 24 SLIKE",
    "Warm oak, matte black, morning light. Never neon, never stock-smiling.":
      "Topli hrast, mat crna, jutarnje svetlo. Nikad neon, nikad osmeh sa stok fotografije.",
    "RENDER QUEUE": "RED ZA RENDER",
    "SCENE 34-07 · REEL 9:16": "SCENA 34-07 · REEL 9:16",
    "Twelve creatives rendered in 41 minutes, formatted per channel.":
      "Dvanaest kreativa izrenderovano za 41 minut, formatirano po kanalu.",
    "APPROVAL": "ODOBRAVANJE",
    "9 KEPT": "9 ZADRŽANO",
    "SWIPE TO KEEP OR KILL": "PREVUCI DA ZADRŽIŠ ILI ODBACIŠ",
    "Three killed. The engine notes why and adjusts next Monday.":
      "Tri odbačena. Mašina beleži zašto i prilagođava se sledećeg ponedeljka.",
    "LIVE": "UŽIVO",
    "MON 18:30 · INSTAGRAM STORY": "PON 18:30 · INSTAGRAM STORY",
    "Nine creatives slotted across four channels for the next seven days.":
      "Devet kreativa raspoređeno na četiri kanala za narednih sedam dana.",

    "Two chairs free today.": "Dve stolice slobodne danas.",
    "Rain outside. Soup inside.": "Napolju kiša. Unutra supa.",
    "The 6am crowd knows.": "Ekipa od 6 ujutru zna.",
    "New in: local pears.": "Novo: domaće kruške.",
    "Parking, finally, out back.": "Parking, konačno, iza zgrade.",
    "Booked out by Thursday.": "Popunjeno do četvrtka.",
    "Ten minutes, no appointment.": "Deset minuta, bez zakazivanja.",
    "Same recipe since 1998.": "Isti recept od 1998.",

    "Content calendar": "Kalendar sadržaja",
    "Creatives": "Kreativi",
    "Performance": "Rezultati",
    "MON": "PON",
    "TUE": "UTO",
    "WED": "SRE",
    "THU": "ČET",
    "FRI": "PET",
    "SAT": "SUB",
    "SUN": "NED",
    "APPROVED": "ODOBRENO",
    "PENDING": "NA ČEKANJU",
    "KILLED": "ODBAČENO",
    "ALMOST SET UP": "SKORO POSTAVLJENO",
    "Start with Counter": "Počni sa Counter planom",
    "Start with Storefront": "Počni sa Storefront planom",
    "Enough to stay visible.": "Dovoljno da ostaneš vidljiv.",
    "The sweet spot for a single location.": "Idealna mera za jednu lokaciju.",
    "Multi-location or multi-offer volume.": "Obim za više lokacija ili više ponuda.",
    // The drop sizer writes the count and this label as two separate text nodes.
    "ads per week": "oglasa nedeljno",
    "THE DROP": "DROP",
    "YOUR CALL": "TVOJA ODLUKA",
    "DISTRIBUTION": "DISTRIBUCIJA",
    "billed yearly": "naplata godišnje",
    "Pick a plan below and brief the engine. The Free plan needs no card.":
      "Izaberi plan ispod i napravi brif za mašinu. Za besplatni plan ne treba kartica.",
    "You're on the Free plan. Want a full drop every week? Pick a plan below.":
      "Koristiš besplatni plan. Želiš pun drop svake nedelje? Izaberi plan ispod.",
    "Open approvals": "Otvori odobravanja",

    /* --- Checkout: what the script writes -------------------------------- */
    "VAT — reverse charge": "PDV — obrnuto obračunavanje",
    "per month": "mesečno",
    "per year": "godišnje",
    "yearly": "godišnje",
    "Welcome back. Your free trial was already used, so your first month is billed today. Cancel any time before the next renewal.":
      "Dobro došao nazad. Besplatnu probu si već iskoristio, pa se prvi mesec naplaćuje danas. Otkazati možeš bilo kad pre sledeće obnove.",
    "Welcome back. Your free trial was already used, so your first year is billed today. Cancel any time before the next renewal.":
      "Dobro došao nazad. Besplatnu probu si već iskoristio, pa se prva godina naplaćuje danas. Otkazati možeš bilo kad pre sledeće obnove.",
    "Billed once a year at 20% off, then renews every 12 months. Cancel any time — access runs to the end of the paid year, and unused months are not refunded.":
      "Naplaćuje se jednom godišnje uz 20% popusta, a zatim se obnavlja na svakih 12 meseci. Otkazati možeš bilo kad — pristup traje do kraja plaćene godine, a neiskorišćeni meseci se ne vraćaju.",
    // Headlines built around an <em> plan name arrive as separate text nodes.
    "Your": "Tvoj",
    "drop is live.": "drop je aktivan.",
    "drop is booked.": "drop je rezervisan.",
    "drop is active.": "drop je aktivan.",
    "Set up your": "Podesi svoj",
    "free": "besplatni",
    "Brief the engine for your": "Napravi brif za svoj",
    "PLAN ACTIVE": "PLAN AKTIVAN",
    "20% off every drop, for as long as you stay.": "20% popusta na svaki drop, dok god si sa nama.",
    "10% off every drop, for as long as you stay.": "10% popusta na svaki drop, dok god si sa nama.",
    "25% off your first year.": "25% popusta na prvu godinu.",
    "Couldn't load your account system. Refresh the page and try again.":
      "Nismo uspeli da učitamo sistem naloga. Osveži stranicu i pokušaj ponovo.",
    "Fill in your business brief first — it takes a minute.":
      "Prvo popuni brif o svom biznisu — traje minut.",
    "Start over →": "Kreni ispočetka →",
    "Sign up or log in →": "Registruj se ili se prijavi →",
    "Go to the brief →": "Idi na brif →",

    /* --- Account: what the script writes --------------------------------- */
    "Active — nothing to pay": "Aktivan — nema plaćanja",
    "PAID": "PLAĆENO",
    "UPCOMING": "PREDSTOJI",

    /* --- Control room and approvals: what the scripts write -------------- */
    "Untitled creative": "Kreativ bez naslova",
    "Couldn't load your control room.": "Nismo uspeli da učitamo tvoju kontrolnu sobu.",
    "Your brief didn't save — the database is missing the onboarding columns. Run supabase/schema.sql in the SQL editor and try again.":
      "Tvoj brif nije sačuvan — u bazi nedostaju kolone za onboarding. Pokreni supabase/schema.sql u SQL editoru i pokušaj ponovo.",
    "Sample drop": "Primer dropa",
    "Every creative": "Svi kreativi",
    "This week's drop": "Ovonedeljni drop",
    "AI-generated creative": "AI-generisan kreativ",
    "Approve": "Odobri",
    "Reject": "Odbaci",
    "Undo approval": "Poništi odobrenje",
    "Creative, full size": "Kreativ, puna veličina",
    "This is a sample drop so you can see how approvals work. Nothing here is saved.":
      "Ovo je primer dropa da vidiš kako odobravanje radi. Ništa se ovde ne čuva.",
    "Nothing approved yet.": "Još ništa nije odobreno.",
    "Approve a creative and it moves here, then gets scheduled and published.":
      "Odobri kreativ i on prelazi ovde, a zatim se zakazuje i objavljuje.",
    "Nothing rejected.": "Ništa nije odbačeno.",
    "Anything you kill shows up here — you can always put it back in the queue.":
      "Sve što odbaciš pojavljuje se ovde — uvek možeš da ga vratiš u red.",
    "Nothing in this drop.": "U ovom dropu nema ničega.",
    "This drop has no creatives attached to it yet.": "Ovaj drop još nema nijedan kreativ.",
    "Your free ads are on the way.": "Tvoji besplatni oglasi su na putu.",
    "As soon as the engine renders them, they show up here for approval.":
      "Čim ih mašina napravi, pojavljuju se ovde na odobravanje.",
    "Brief the engine first.": "Prvo napravi brif za mašinu.",
    "Tell us about your business and your free ads start rendering.":
      "Reci nam nešto o svom biznisu i tvoji besplatni oglasi počinju da se renderuju.",
    "Fill in the brief →": "Popuni brif →",
    "Couldn't load your drop.": "Nismo uspeli da učitamo tvoj drop.",
    "WAITING": "NA ČEKANJU",
    "REJECTED": "ODBAČENO",
    "LOADING": "UČITAVANJE",
    "waiting": "na čekanju",
    "approved": "odobreno",
    "rejected": "odbačeno",
    "published": "objavljeno",
    // The sample drop's ads.
    "Morning rush, sorted.": "Jutarnja gužva, rešena.",
    "Two blocks from the office and open at 6:30. First coffee is on the house this week.":
      "Dva bloka od kancelarije i otvoreno od 6:30. Ove nedelje prva kafa je na račun kuće.",
    "The corner table is free.": "Sto u ćošku je slobodan.",
    "Quiet hours, fast wifi, no queue. Weekdays between 2 and 5.":
      "Mirni sati, brz wifi, bez čekanja. Radnim danima između 14 i 17h.",
    "Fresh trays out of the oven every morning — get there early.":
      "Sveže ture iz rerne svako jutro — dođi ranije.",
    "Same-day repairs, no appointment.": "Popravka istog dana, bez zakazivanja.",
    "Walk in before 3pm and it's ready the same day.":
      "Svrati pre 15h i gotovo je istog dana.",

    /* --- Log in, sign up, contact: what the scripts write ---------------- */
    "Create your account.": "Napravi svoj nalog.",
    "Just enough to hold your spot — you'll pick a plan and brief the engine next.":
      "Tek toliko da rezervišeš mesto — plan biraš i brif praviš u sledećem koraku.",
    "Logged in — taking you to your control room...": "Prijavljen si — vodimo te u kontrolnu sobu...",
    "Confirm your email first — check your inbox for the link we sent.":
      "Prvo potvrdi email — u sandučetu te čeka link koji smo poslali.",
    "Check your inbox — confirm your email, then log in to brief the engine.":
      "Proveri sanduče — potvrdi email, pa se prijavi da napraviš brif za mašinu.",
    "Account created — let's brief the engine...": "Nalog je napravljen — idemo na brif za mašinu...",
    "You're already signed in.": "Već si prijavljen.",
    "Not started": "Nije počeo",
    "You're on the Free plan — pick a paid plan to start one":
      "Koristiš besplatni plan — izaberi plaćeni plan da ga pokreneš",
    "Finish your business brief to start it": "Završi brif o biznisu da ga pokreneš",
    "Onboard in ten minutes. Your free ads land in Approvals as soon as the engine renders them.":
      "Podešavanje traje deset minuta. Tvoji besplatni oglasi stižu u Odobravanja čim ih mašina napravi.",
    "No need to sign up again — your account already has this covered.":
      "Ne moraš ponovo da se registruješ — tvoj nalog ovo već pokriva.",
    "Couldn't load the site's messaging system. Refresh the page and try again.":
      "Nismo uspeli da učitamo sistem za poruke. Osveži stranicu i pokušaj ponovo.",
    "Could not send:": "Slanje nije uspelo:",

    /* --- Approvals: text edits and reject reasons ------------------------ */
    "EDITED BY YOU": "TVOJA IZMENA",
    "Edit text": "Izmeni tekst",
    "Restore original": "Vrati original",
    "HEADLINE": "NASLOV",
    "CAPTION": "OPIS",
    "Only the text posted with the ad changes — the image stays as it is.":
      "Menja se samo tekst koji ide uz oglas — slika ostaje ista.",
    "Save text": "Sačuvaj tekst",
    "WHY IT WAS REJECTED": "ZAŠTO JE ODBAČENO",
    "Image doesn't fit": "Slika ne odgovara",
    "Wrong tone": "Pogrešan ton",
    "Wrong facts or price": "Netačni podaci ili cena",
    "Wrong timing": "Nije pravo vreme",
    "Something else": "Nešto drugo",
    "Add a note for the engine (optional)": "Dodaj napomenu za mašinu (nije obavezno)",
    "Save note": "Sačuvaj napomenu",
    "Rejected. Why?": "Odbačeno. Zašto?",
    "Skip": "Preskoči",
    "Thanks — the engine will take that into the next drop.":
      "Hvala — mašina će to uzeti u obzir za sledeći drop.",
    "Couldn't save that — please try again.": "Nismo uspeli da sačuvamo — pokušaj ponovo.",

    /* --- Account: your data ---------------------------------------------- */
    "Download my data": "Preuzmi moje podatke",
    "Delete my account": "Obriši moj nalog",
    "This removes your login, brief and every creative for good — it can't be undone. Anything already posted stays on your own channels. Download your data first if you want a copy.":
      "Ovo trajno briše tvoju prijavu, opis posla i sve kreative — ne može da se vrati. Ono što je već objavljeno ostaje na tvojim kanalima. Ako želiš kopiju, prvo preuzmi svoje podatke.",
    "TYPE YOUR PASSWORD TO CONFIRM": "UNESI LOZINKU ZA POTVRDU",
    "Delete for good": "Obriši zauvek",
    "ACCOUNT DELETED": "NALOG OBRISAN",
    "Your account is gone.": "Tvoj nalog je obrisan.",
    "Your login, brief and creatives have been removed. Thanks for trying Adronis.":
      "Tvoja prijava, opis posla i kreativi su uklonjeni. Hvala što si probao Adronis.",
    "Back to the home page": "Nazad na početnu",

    /* --- Control room: posting calendar ---------------------------------- */
    "POSTING CALENDAR": "KALENDAR OBJAVA",
    "Previous week": "Prethodna nedelja",
    "Next week": "Sledeća nedelja",
    "This week": "Ova nedelja",
    "Scheduled": "Zakazano",
    "SCHEDULED": "ZAKAZANO",
    "SAMPLE": "PRIMER",
    "See a sample week": "Pogledaj primer nedelje",
    "This is a made-up week so you can see how the control room looks. Your real schedule shows up here once you approve creatives.":
      "Ovo je izmišljena nedelja da vidiš kako kontrolna soba izgleda. Tvoj pravi raspored se pojavljuje ovde čim odobriš kreative.",
    "Friday, but make it pastry.": "Petak, ali uz pecivo.",
    "Weekend hours: 8 to 2.": "Vikendom radimo od 8 do 14.",

    /* --- Control room: optional extras for the engine -------------------- */
    "OPTIONAL · HELP THE ENGINE KNOW YOU": "NIJE OBAVEZNO · POMOZI MAŠINI DA TE UPOZNA",
    "PROFILE STRENGTH · OPTIONAL": "SNAGA PROFILA · NIJE OBAVEZNO",
    "BASIC": "OSNOVNI",
    "GOOD": "DOBAR",
    "EXCELLENT": "ODLIČAN",
    "NEXT STEP": "SLEDEĆI KORAK",
    "Refresh your note for next week": "Osveži belešku za sledeću nedelju",
    "Your profile is complete — the engine has everything it needs for your next drop.":
      "Profil je kompletan — mašina ima sve što joj treba za tvoj sledeći drop.",
    "Review answers": "Pogledaj odgovore",
    "Hide answers": "Sakrij odgovore",
    "Where your ads go": "Gde idu tvoji oglasi",
    "Pick at least one channel so every drop has somewhere to publish.":
      "Izaberi bar jedan kanal, da svaki drop ima gde da se objavi.",
    "Change in account": "Promeni u nalogu",
    "Update": "Osveži",
    "Out of date. A fresh note keeps next week's ads current.":
      "Zastarelo. Sveža beleška drži oglase za sledeću nedelju aktuelnim.",
    "Make every ad look like": "Neka svaki oglas izgleda kao",
    "your": "tvoj",
    "business.": "posao.",
    "None of this is required — your ads render either way. But the engine only knows what you tell it, and everything you add here goes straight into your next drop: your colors, your offers, what sets you apart. The more it knows, the less your ads look like anyone else's.":
      "Ništa od ovoga nije obavezno — oglasi se prave i bez toga. Ali mašina zna samo ono što joj kažeš, a sve što ovde dodaš ide pravo u tvoj sledeći drop: tvoje boje, tvoje ponude, ono po čemu se razlikuješ. Što više zna, to manje tvoji oglasi liče na tuđe.",
    "What's happening next week?": "Šta se dešava sledeće nedelje?",
    "A sale, a new product, holiday hours, an event — the engine builds next week's ads around it.":
      "Akcija, novi proizvod, praznično radno vreme, događaj — mašina pravi oglase za sledeću nedelju oko toga.",
    "e.g. 20% off all coffee Mon–Wed, closed Friday for the holiday, new pumpkin pastry from Tuesday":
      "npr. 20% popusta na svu kafu pon–sre, u petak ne radimo zbog praznika, novo pecivo od bundeve od utorka",
    "What makes you different": "Po čemu se razlikuješ",
    "Gives every ad a reason to pick you over the place down the street.":
      "Daje svakom oglasu razlog da ljudi izaberu tebe, a ne lokal niz ulicu.",
    "e.g. Everything's made from scratch, third-generation family recipes, open from 6am":
      "npr. Sve pravimo sami, porodični recepti treće generacije, radimo od 6 ujutru",
    "Your brand colors": "Boje tvog brenda",
    "Keeps the images in your colors, so people recognise you before they read a word.":
      "Drži slike u tvojim bojama, da te ljudi prepoznaju pre nego što pročitaju ijednu reč.",
    "e.g. Deep green and cream, with gold accents": "npr. Tamnozelena i krem, sa zlatnim detaljima",
    "Website or Instagram": "Sajt ili Instagram",
    "Shows the engine how you already present yourself, so new ads match it.":
      "Pokazuje mašini kako se već predstavljaš, da novi oglasi to prate.",
    "e.g. @milenasbakery or milenas.rs": "npr. @milenasbakery ili milenas.rs",
    "Anything to avoid": "Šta treba izbegavati",
    "Things that should never show up in your ads — the engine steers clear of them.":
      "Stvari koje nikad ne treba da se pojave u tvojim oglasima — mašina ih zaobilazi.",
    "e.g. No jokes about prices, never show the back kitchen":
      "npr. Bez šala o cenama, nikad ne prikazuj kuhinju",
    "Add": "Dodaj",
    "Edit": "Izmeni",
    "Close": "Zatvori",
    "Save": "Sačuvaj",
    "Clear": "Obriši",

    /* --- Short home page (Adronis.dc.html) ---------------------------------
       The long original lives on in Adronis-full.html and keeps using the
       entries above. */
    "How it works": "Kako radi",
    "Examples": "Primeri",
    "Try it free": "Probaj besplatno",
    "Ready-made ads for your business, every week.": "Gotovi oglasi za tvoj biznis, svake nedelje.",
    "We make the posts for your Instagram and Facebook. You approve them in two minutes, and we publish them.":
      "Mi pravimo objave za tvoj Instagram i Facebook. Ti ih odobriš za dva minuta, a mi ih objavimo.",
    "See how it works": "Pogledaj kako radi",
    "Posted to Instagram and TikTok": "Objavljeno na Instagramu i TikToku",
    "THIS WEEK": "OVE NEDELJE",
    "3 POSTS": "3 OBJAVE",
    "Made for local businesses with no time for marketing.": "Za lokalne biznise koji nemaju vremena za marketing.",
    "You do two things: tell us about your business once, and approve the ads. We do the rest.":
      "Ti radiš dve stvari: jednom nam opišeš svoj biznis i odobravaš oglase. Ostalo radimo mi.",
    "Tell us about your business": "Opiši nam svoj biznis",
    "About ten minutes, once. What you sell, how you talk to customers, where you are.":
      "Oko deset minuta, samo jednom. Šta prodaješ, kako pričaš sa mušterijama, gde se nalaziš.",
    "Get new ads every Monday": "Svakog ponedeljka stižu novi oglasi",
    "Finished pictures with text, made for your business and sized for each network.":
      "Gotove slike sa tekstom, napravljene za tvoj biznis i prilagođene svakoj mreži.",
    "Approve, and we post them": "Odobri, a mi ih objavimo",
    "Keep the ones you like and turn down the rest. Nothing is posted without your OK.":
      "Zadrži one koji ti se sviđaju, ostale odbij. Ništa se ne objavljuje bez tvog odobrenja.",
    "Examples of what you get": "Primeri onoga što dobijaš",
    "Sample ads for a neighbourhood café. Yours are made for your business, in your style.":
      "Primeri oglasa za kafić iz kraja. Tvoji se prave za tvoj biznis, u tvom stilu.",
    "A week of posts for a neighbourhood café, the way they show up on each network. Yours are made for your business.":
      "Nedelja objava za kafić iz kraja, onako kako izgledaju na svakoj mreži. Tvoje se prave za tvoj biznis.",
    "Corner Café": "Kafić na uglu",
    "Posts for a few local businesses, the way they show up on each network. Yours are made for your business.":
      "Objave za nekoliko lokalnih biznisa, onako kako izgledaju na svakoj mreži. Tvoje se prave za tvoj biznis.",
    "No ideas for dinner?": "Nemaš ideju za večeru?",
    "Posted to Instagram and Facebook": "Objavljeno na Instagramu i Facebooku",
    "Fresh out of the oven at 7am. Grab one on your way to work.": "Sveže iz rerne u 7h. Uzmi jedno usput do posla.",
    "Book a quick trim this week and walk out feeling new.": "Zakaži brzo šišanje ove nedelje i izađi kao nov.",
    "Personal plans and expert guidance. Your first session is on us.": "Lični planovi i stručno vođenje. Prvi trening je na nama.",
    "Fast, detailed cleaning and polishing. Drive in, shine out.": "Brzo i detaljno pranje i poliranje. Uđeš prljav, izađeš sjajan.",
    "Five new coffees, free to try. Just come in.": "Pet novih kafa, degustacija je besplatna. Samo svrati.",
    "See you Saturday": "Vidimo se u subotu",
    "From a farm ten minutes away. Only this week, while they last.": "Sa farme deset minuta od nas. Samo ove nedelje, dok ih ima.",
    "Soup of the day with fresh bread, served until 3pm.": "Supa dana uz sveži hleb, služimo do 15h.",
    "Free parking behind the building for all our guests.": "Besplatan parking iza zgrade za sve naše goste.",
    "Our cinnamon rolls, made by hand every morning at six.": "Naše rolnice sa cimetom, ručno pravljene svakog jutra u šest.",
    "Instagram and TikTok": "Instagram i TikTok",
    "Instagram and Facebook": "Instagram i Facebook",
    "Google and Facebook": "Google i Facebook",
    "Simple prices, no contract.": "Jednostavne cene, bez ugovora.",
    "Start free, or try any paid plan free for 7 days.": "Počni besplatno ili probaj bilo koji plaćeni plan 7 dana bez naplate.",
    "3 ads a month": "3 oglasa mesečno",
    "1 network": "1 mreža",
    "No card needed": "Bez kartice",
    "4 ads every Monday": "4 oglasa svakog ponedeljka",
    "2 networks, for example Instagram and Facebook": "2 mreže, na primer Instagram i Facebook",
    "Posted for you at the best time": "Objavljujemo ih u najbolje vreme",
    "Choose Counter": "Izaberi Counter",
    "12 ads every Monday": "12 oglasa svakog ponedeljka",
    "Up to 4 networks": "Do 4 mreže",
    "Ads for holidays and local events": "Oglasi za praznike i lokalne događaje",
    "Learns which ads work best for you": "Uči koji oglasi ti najbolje prolaze",
    "Choose Storefront": "Izaberi Storefront",
    "30 ads every Monday": "30 oglasa svakog ponedeljka",
    "Any number of networks and locations": "Neograničen broj mreža i lokacija",
    "Checked by a real designer": "Proverava ih pravi dizajner",
    "Personal support": "Lična podrška",
    "Your first ads can be ready this week.": "Tvoji prvi oglasi mogu biti spremni ove nedelje.",
    "Sign up in about ten minutes. No contract, no meeting, cancel any time.":
      "Prijava traje oko deset minuta. Bez ugovora, bez sastanka, otkazuješ kad hoćeš.",
    "The Free plan needs no card.": "Za besplatni plan ne treba kartica.",
    "Ready-made ads every week for businesses with no time for marketing.":
      "Gotovi oglasi svake nedelje za biznise koji nemaju vremena za marketing.",

    /* --- First-visit guided tours (tour.js) ------------------------------ */
    "SHOW ME AROUND": "PROVEDI ME KROZ STRANICU",
    "Show me around": "Kreni u obilazak",
    "WELCOME": "DOBRODOŠLICA",
    "Welcome,": "Dobro došli,",
    "Welcome to your": "Dobro došli u svoju",
    "control room": "kontrolnu sobu",
    "Skip tour": "Preskoči",
    "Back": "Nazad",
    "Next": "Dalje",
    "Done": "Gotovo",
    "Four quick stops: what's going out, what's already live, what's waiting on you, and how to make every ad more yours.":
      "Četiri kratka koraka: šta izlazi, šta je već objavljeno, šta čeka tebe i kako da svaki oglas bude više tvoj.",
    "Your week at a glance": "Tvoja nedelja na prvi pogled",
    "How many ads are scheduled to post, how many are already out, and how many are waiting for your yes.":
      "Koliko oglasa je zakazano za objavu, koliko ih je već izašlo i koliko čeka tvoje odobrenje.",
    "Nothing goes out without you": "Ništa ne izlazi bez tebe",
    "Every ad the engine makes lands in Approvals first. When something is waiting, this number tells you — one click takes you there.":
      "Svaki oglas koji mašina napravi prvo stiže u Odobravanja. Kad nešto čeka, ovaj broj ti to kaže — jedan klik i tamo si.",
    "Your posting calendar": "Tvoj kalendar objava",
    "Each ad sits on the day and time it posts — blue is scheduled, green is already live. Click a blue one to change when it posts.":
      "Svaki oglas stoji na danu i u vreme kada se objavljuje — plavo je zakazano, zeleno je već objavljeno. Klikni na plavi da mu promeniš vreme objave.",
    "Make every ad look like you": "Neka svaki oglas liči na tebe",
    "All optional, but everything you add here goes straight into your next drop — your colors, your offers, what sets you apart. Start with the step worth the most.":
      "Ništa nije obavezno, ali sve što ovde dodaš ide pravo u tvoj sledeći drop — tvoje boje, tvoje ponude, ono što te izdvaja. Kreni od koraka koji najviše vredi.",
    "Approve or reject": "Odobri ili odbaci",
    "Every ad waits here for your yes. Approve it and it gets a posting slot; reject it and say why, so next week's drop gets it right. You can also edit the text first.":
      "Svaki oglas ovde čeka tvoje odobrenje. Odobri ga i dobija termin za objavu; odbaci ga i reci zašto, da sledeći drop bude pogođen. Tekst možeš i da izmeniš pre toga.",
    "Keep track of every ad": "Prati svaki oglas",
    "Switch between what's waiting, what you approved and what you rejected. Only approved ads are ever published.":
      "Prebacuj između onoga što čeka, što si odobrio i što si odbacio. Objavljuju se samo odobreni oglasi."

  },

  /* --- Strings a script assembles around a value -------------------------
     Matched only when the exact lookup misses. Each captured group is run
     through the dictionary above before it is put back, so a word like
     "monthly" is translated while a date or a plan name passes through. */
  patterns: [
    [/^Reset link sent to (.+?)\. Open it to choose a new password\.$/,
      "Link za novu lozinku je poslat na $1. Otvori ga da izabereš novu lozinku."],
    [/^(\d+) OF (\d+) ADDED$/, "DODATO: $1 OD $2"],
    [/^Out of date — last changed (.+?)\. A fresh note keeps next week's ads current\.$/,
      "Zastarelo — poslednja izmena $1. Sveža beleška drži oglase za sledeću nedelju aktuelnim."],
    [/^Updated (.+)$/, "Ažurirano $1"],
    [/^Your plan cancels on (.+?)\. You'll keep full access until then\.$/,
      "Tvoj plan se otkazuje $1. Do tada zadržavaš pun pristup."],
    [/^Switching to (.+?) \((monthly|annual)\) on (.+?)\.$/,
      "Prelazak na $1 ($2) — $3."],
    [/^The (.+?) plan is live on your account\.$/,
      "$1 plan je aktivan na tvom nalogu."],
    [/^Your (.+?) drop is live\.$/, "Tvoj $1 drop je aktivan."],
    [/^Your (.+?) drop is booked\.$/, "Tvoj $1 drop je rezervisan."],
    [/^(.+?) plan — (monthly|annual) billing$/, "$1 plan — naplata $2"],
    [/^(.+?) off every charge$/, "$1 popusta na svaku naplatu"],
    [/^(.+?) off every charge from (.+)$/, "$1 popusta na svaku naplatu od $2"],
    [/^(.+?) off every charge until (.+)$/, "$1 popusta na svaku naplatu do $2"],
    [/^promo code ([A-Za-z0-9]+)$/, "promo kod $1"],
    [/^(.+?) — (.+?) — (.+?) \/ month, billed (monthly|annual)$/,
      "$1 — $2 — $3 / mesečno, naplata $4"],
    [/^Next invoice on (.+?), and you can cancel any time before then\.$/,
      "Sledeći račun $1, a otkazati možeš bilo kad pre toga."],
    [/^First invoice on (.+?), and you can cancel before then\.$/,
      "Prvi račun $1, a otkazati možeš pre toga."],
    [/^Your card is on file and the free trial has started — nothing was charged today\.$/,
      "Tvoja kartica je sačuvana i besplatna proba je počela — danas nije ništa naplaćeno."],
    [/^CREATIVE (.+)$/, "KREATIV $1"],
    // The home page's counters animate, writing a new value every frame.
    [/^(\d+) \/ WK$/, "$1 / NED"],
    [/^(\d+) drops$/, "$1 dropova"],
    [/^(\d+) formats$/, "$1 formata"],
    // Ahead of the bare "WEEK OF" rule, which would otherwise swallow the count.
    [/^WEEK OF (.+?) · (\d+) CREATIVES?$/, "NEDELJA OD $1 · KREATIVA: $2"],
    [/^Week of (.+)$/, "Nedelja od $1"],
    [/^WEEK OF (.+)$/, "NEDELJA OD $1"],
    [/^(\d+) CREATIVES?$/, "KREATIVA: $1"],
    [/^Approve all waiting \((\d+)\)$/, "Odobri sve na čekanju ($1)"],
    [/^Reject all waiting \((\d+)\)$/, "Odbaci sve na čekanju ($1)"],
    [/^Review (\d+) waiting →$/, "Pregledaj $1 na čekanju →"],
    [/^PUBLISHED (.+)$/, "OBJAVLJENO $1"],
    [/^SAMPLE (\d+)$/, "PRIMER $1"],
    [/^Couldn't save that — (.+)$/, "Nismo uspeli to da sačuvamo — $1"],
    [/^Couldn't undo — (.+)$/, "Nismo uspeli da poništimo — $1"],
    [/^(.+?) — (.+?) — (.+?) \/ month, billed (monthly|yearly)\. Takes effect on your next billing date, (.+?) — this period is already paid for\.$/,
      "$1 — $2 — $3 / mesečno, naplata $4. Stupa na snagu na sledeći datum naplate, $5 — ovaj period je već plaćen."],
    // Checkout summary lines and the fine print under the total.
    [/^(.+?) · (1 month|12 months)$/, "$1 · $2"],
    [/^Your card is on file and the free trial has started — nothing was charged today\. First invoice on (.+?), and you can cancel before then\.$/,
      "Tvoja kartica je sačuvana i besplatna proba je počela — danas nije ništa naplaćeno. Prvi račun $1, a otkazati možeš pre toga."],
    [/^Payment received — your plan is running again\. Next invoice on (.+?), and you can cancel any time before then\.$/,
      "Uplata je primljena — tvoj plan ponovo radi. Sledeći račun $1, a otkazati možeš bilo kad pre toga."],
    [/^Promo (\S+) \((\d+)%\)$/, "Promo kod $1 ($2%)"],
    [/^Incl\. VAT \((\d+)%\)$/, "Uključen PDV ($1%)"],
    [/^First drop \((\d+)-day trial\)$/, "Prvi drop ($1 dana probe)"],
    [/^(\S+) applied — (.+)$/, "$1 primenjen — $2"],
    [/^Couldn't load your account: (.+)$/, "Nismo uspeli da učitamo tvoj nalog: $1"],
    [/^Your free trial was already used on this account, so billing starts today\. Then (.+?) (per month|per year) including tax, renewing automatically, next charged (.+?)\. Cancel any time from your account — access runs to the end of the period you paid for\.$/,
      "Besplatna proba je već iskorišćena na ovom nalogu, pa naplata počinje danas. Zatim $1 $2 sa porezom, uz automatsku obnovu, sledeća naplata $3. Otkazati možeš bilo kad sa svog naloga — pristup traje do kraja plaćenog perioda."],
    [/^After the 7-day free trial this becomes a paid subscription automatically: (.+?) (per month|per year) including tax, first charged (.+?) and renewing until you cancel\. Cancel before that date from your account and you pay nothing\.$/,
      "Posle 7 dana besplatne probe ovo automatski postaje plaćena pretplata: $1 $2 sa porezom, prva naplata $3, uz obnovu dok ne otkažeš. Otkaži pre tog datuma sa svog naloga i ne plaćaš ništa."],
    [/^Check your inbox — confirm your email to carry on with the (.+?) plan\.$/,
      "Proveri sanduče — potvrdi email da nastaviš sa planom $1."],
    [/^You're reaching out about the (.+?) plan\.$/, "Pišeš nam povodom plana $1."],
    [/^Could not send: (.+)$/, "Slanje nije uspelo: $1"],
    // Approvals: the lightbox, and a creative's channel and format badge.
    [/^View full size: (.+)$/, "Prikaži u punoj veličini: $1"],
    [/^(.+?) · (\d+) CREATIVES?$/, "$1 · KREATIVA: $2"],
    [/^(Waiting on you|Approved|Rejected|Everything) \((\d+)\)$/, "$1 ($2)"],
    [/^(.+) — (waiting|approved|rejected|published)$/, "$1 — $2"],
    [/^(.+) — full size$/, "$1 — puna veličina"],
    [/^(.+?) · (\d+:\d+) POST$/, "$1 · $2 OBJAVA"],
    [/^(.+?) · (\d+:\d+) post$/, "$1 · $2 objava"],
    [/^(.+?) · SEARCH AD$/, "$1 · OGLAS U PRETRAZI"],
    [/^(.+?) · Search ad$/, "$1 · Oglas u pretrazi"],
    // What's left of the Free plan's monthly allowance.
    [/^All (\d+) free ads used this month — the next ones arrive from (.+?)\.$/,
      "Iskoristio si sve besplatne oglase za ovaj mesec ($1) — sledeći stižu od $2."],
    [/^(\d+) of (\d+) free ads used this month\.$/,
      "Besplatni oglasi ovog meseca: iskorišćeno $1 od $2."],
    [/^You've used all (\d+) free ads for (.+?)\. The next (\d+) arrive from (.+?) — or get a full drop every week\.$/,
      "Iskoristio si sve besplatne oglase za $2 ($1). Sledeći ($3) stižu od $4 — ili uzmi pun drop svake nedelje."],
    [/^(\d+) of (\d+) free ads left this month — they land in Approvals as soon as they're rendered\. Want a full drop every week\?$/,
      "Besplatni oglasi ovog meseca: ostalo $1 od $2 — stižu u Odobravanja čim se naprave. Želiš pun drop svake nedelje?"]
  ]
};
