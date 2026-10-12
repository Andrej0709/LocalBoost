// Adronis ad engine. pg_cron calls this every 2 minutes (section 13 of
// supabase/schema.sql); each call moves every drop in the making one step on
// and stops after about a minute and a half:
//
//   1. plan     every account whose week is due (engine_due) gets a drop in
//               'rendering' and an engine_runs row. A week the business is
//               closed from end to end gets a 'skipped' drop and no ads.
//   2. copy     Claude writes the week's ads, a few per call: text, channel,
//               format, posting time and a prompt for the image. It reads the
//               brief, the uploaded logo, photos and menu, the forecast, the
//               town's dates and what the owner approved, loved, edited and
//               turned down in the last weeks. One engine_jobs row per ad.
//   3. images   Higgsfield makes each image; it is copied into the public
//               "creatives" bucket, and Claude looks at it. One that falls
//               short is made again from a better prompt, up to three times;
//               the best one so far is kept.
//   4. deliver  once every image is done, engine_deliver() puts all the ads
//               in Approvals at once and the drop becomes awaiting_approval
//               (which sends the "new ads" notification).
//
// Practice mode: without ANTHROPIC_API_KEY the ads are written from simple
// templates instead of by Claude, and nothing is checked; without the
// Higgsfield key each image is a plain placeholder card. The whole path -
// drop, Approvals, notification, cost rows - runs the same either way, so it
// can be tried before the keys are bought. Adding a key switches that step
// over on the next run; nothing else changes.
//
// Who gets ads: only the accounts in ENGINE_TEST_EMAILS, until ENGINE_LIVE is
// "true" - and even then only while both keys are set, so practice ads never
// reach a real tester.
//
// Deploy with "Verify JWT" OFF: pg_cron sends no Supabase JWT. The call is
// checked against ENGINE_CRON_SECRET instead.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   ENGINE_CRON_SECRET        the same value as the Vault secret 'engine_cron_secret'
//   ENGINE_TEST_EMAILS        comma-separated emails that get ads while testing
//   ENGINE_LIVE               "true" to make ads for every account with a running plan
//   ANTHROPIC_API_KEY         Claude; missing = practice texts
//   HIGGSFIELD_API_KEY_ID     Higgsfield key id     } missing = practice images
//   HIGGSFIELD_API_KEY_SECRET Higgsfield key secret }
// Optional:
//   CLAUDE_MODEL              default claude-opus-5-5
//   CLAUDE_EFFORT             default high (the copy); the image check runs at low
//   HIGGSFIELD_MODEL          default higgsfield-ai/soul/standard
//   HIGGSFIELD_USD_PER_IMAGE  what one image costs, for generation_costs; Higgsfield's
//                             answer doesn't say, so without it images are logged at 0
//   WEATHER                   "off" to stop asking Open-Meteo for the forecast
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";

const TZ = "Europe/Belgrade";
const BUCKET = "creatives";
const BRAND_BUCKET = "brand-assets";
const HF_API = "https://api.higgsfield.ai";

// How long one call may keep working, and the latest point at which it still
// starts a slow step (a Claude call that writes ads takes up to a minute).
const RUN_MS = 95_000;
const LAST_COPY_MS = 35_000;
const LAST_CHECK_MS = 80_000;

const ADS_PER_CALL = 4;
const COPY_ATTEMPTS = 3;
const IMAGE_ATTEMPTS = 3;
const PASS_SCORE = 7;
// Claude refuses pictures over 5 MB; a bigger one goes out unchecked.
const CHECK_MAX_BYTES = 5 * 1024 * 1024;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Secrets pasted into the dashboard often pick up quotes or spaces.
function secret(name: string) {
  return (Deno.env.get(name) || "").trim().replace(/^["']+|["']+$/g, "").trim();
}

const CLAUDE_KEY = secret("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = secret("CLAUDE_MODEL") || "claude-opus-5-5";
const CLAUDE_EFFORT = (secret("CLAUDE_EFFORT") || "high") as "low" | "medium" | "high" | "xhigh" | "max";
const HF_ID = secret("HIGGSFIELD_API_KEY_ID");
const HF_SECRET = secret("HIGGSFIELD_API_KEY_SECRET");
const HF_MODEL = (secret("HIGGSFIELD_MODEL") || "higgsfield-ai/soul/standard").replace(/^\/+/, "");
const HF_PRICE = Number(secret("HIGGSFIELD_USD_PER_IMAGE")) || 0;
const WEATHER = secret("WEATHER").toLowerCase() !== "off";

const claude = CLAUDE_KEY ? new Anthropic({ apiKey: CLAUDE_KEY, maxRetries: 2 }) : null;
const higgsfield = !!(HF_ID && HF_SECRET);
const practice = !claude || !higgsfield;

// USD per million tokens. Cache writes are the 5-minute kind.
const CLAUDE_PRICES: Record<string, { input: number; output: number; read: number; write: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, read: 0.2, write: 5 },
  "claude-opus-5": { input: 5, output: 25, read: 0.5, write: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, read: 0.5, write: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, read: 0.2, write: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, read: 0.01, write: 0.125 },
};

// The formats each channel takes, the first being the usual one. The ratio
// goes to Higgsfield; the format is what Approvals and the previews show.
const FORMATS: Record<string, { format: string; ratio: string }[]> = {
  "Instagram": [{ format: "4:5 post", ratio: "4:5" }, { format: "9:16 story", ratio: "9:16" }, { format: "1:1 post", ratio: "1:1" }],
  "Facebook": [{ format: "4:5 post", ratio: "4:5" }, { format: "1:1 post", ratio: "1:1" }, { format: "9:16 story", ratio: "9:16" }],
  "TikTok": [{ format: "9:16 post", ratio: "9:16" }],
  "Google Business": [{ format: "4:3 post", ratio: "4:3" }],
  "LinkedIn": [{ format: "1:1 post", ratio: "1:1" }, { format: "4:5 post", ratio: "4:5" }],
  "Pinterest": [{ format: "2:3 pin", ratio: "2:3" }],
};

// The quick "never in my ads" picks (profiles.avoid_tags), as rules.
const AVOID: Record<string, string> = {
  no_emoji: "No emojis anywhere.",
  no_prices: "Never show or mention prices.",
  no_discounts: "No sales talk: no \"% off\", no \"cheapest\", no discounts.",
  no_faces: "No people's faces in the images.",
  no_alcohol: "No alcohol in the images or the text.",
  no_jokes: "No jokes or puns - keep it straight.",
  no_slang: "No slang or street talk.",
  no_english: "No English words in Serbian ads.",
  no_competitors: "Never name or hint at another business.",
  no_urgency: "No pressure lines like \"last chance\" or \"hurry\".",
};

const SERBIAN_COUNTRIES = ["Serbia", "Bosnia & Herzegovina", "Montenegro"];

type Profile = Record<string, any>;
type Job = Record<string, any>;
type Run = Record<string, any>;
type Log = { planned: number; skipped: number; written: number; submitted: number; checked: number; delivered: number; errors: string[] };

/* ------------------------------------------------------------------ */
/* Dates and times, in the business's own time (Belgrade for now).     */
/* ------------------------------------------------------------------ */

function localParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

// Minutes Belgrade is ahead of UTC at that moment (60 or 120).
function offsetMinutes(at: Date) {
  const p = localParts(at);
  const [y, m, d] = p.date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d, p.hour, p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

// "2026-10-14" + "18:30" in Belgrade -> the moment, in UTC.
function localToUtc(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let at = guess - offsetMinutes(new Date(guess)) * 60000;
  at = guess - offsetMinutes(new Date(at)) * 60000;
  return new Date(at);
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function mondayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

function isClosed(date: string, closed: any[]) {
  return (closed || []).some((c) => c && c.from <= date && date <= c.to);
}

// The days of the week a drop's ads may post on: after today, not closed.
function postingDays(week: string, closed: any[]) {
  const today = localParts(new Date()).date;
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(week, i);
    if (day > today && !isClosed(day, closed)) out.push(day);
  }
  return out;
}

// The dates worth an ad in Serbia - the same list as dates-rs.js on the site
// (keep the two in step); the town's own ones come from local_events.
function orthodoxEaster(y: number) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day + 13)).toISOString().slice(0, 10);
}

function westernEaster(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(Date.UTC(y, Math.floor(n / 31) - 1, (n % 31) + 1)).toISOString().slice(0, 10);
}

function fixedDates(y: number, city: string) {
  const md = (m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const firstNov = new Date(Date.UTC(y, 10, 1)).getUTCDay();
  const blackFriday = md(11, 1 + ((4 - firstNov + 7) % 7) + 22);
  let sunday = new Date(Date.UTC(y, 0, 6));
  while (sunday.getUTCDay() !== 0) sunday = new Date(sunday.getTime() - 86400000);
  const oci = sunday.toISOString().slice(0, 10);
  const easter = orthodoxEaster(y);
  const list: [string, string, number][] = [
    [md(1, 7), "Orthodox Christmas", 14],
    [md(1, 14), "Orthodox New Year (the party is on the night of the 13th)", 14],
    [md(1, 27), "St. Sava's Day - a school holiday, families and kids", 10],
    [md(2, 14), "Valentine's Day", 14],
    [md(2, 15), "Statehood Day - days off work", 10],
    [md(3, 8), "Women's Day", 14],
    [addDays(easter, -48), "Orthodox Lent begins - seven weeks of fasting for many", 7],
    [westernEaster(y), "Catholic Easter (big in Vojvodina)", 10],
    [md(4, 15), "Terrace season starts", 10],
    [easter, "Orthodox Easter (Good Friday to Monday off)", 14],
    [md(5, 1), "May Day long weekend", 14],
    [md(5, 6), "St. George's Day (Đurđevdan), a common slava", 14],
    [md(5, 25), "Prom season", 14],
    [md(6, 15), "Summer starts", 7],
    [md(9, 1), "Back to school", 10],
    [md(10, 1), "International Coffee Day", 7],
    [md(10, 31), "Halloween", 10],
    [md(11, 11), "Armistice Day - a day off", 7],
    [md(11, 21), "St. Michael's Day (Aranđelovdan), a common slava", 14],
    [blackFriday, "Black Friday", 10],
    [md(11, 28), "Christmas fast begins - six weeks of fasting for many", 7],
    [md(12, 1), "Holiday gift season", 7],
    [addDays(oci, -7), "Mothers' Day (Materice)", 10],
    [md(12, 19), "St. Nicholas Day (Nikoljdan), the most common slava", 21],
    [oci, "Fathers' Day (Oci)", 7],
    [md(12, 31), "New Year's Eve - people book weeks ahead", 28],
  ];
  if (city === "novi sad") list.push([md(2, 1), "Novi Sad City Day", 10]);
  if (city === "beograd") list.push([addDays(easter, 39), "Ascension Day, Belgrade's city slava", 10]);
  if (city === "nis") list.push([md(6, 3), "Sts. Constantine and Helena, Niš's city slava", 10]);
  return list;
}

const CYRILLIC: Record<string, string> = {
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ђ": "dj", "е": "e", "ж": "z", "з": "z",
  "и": "i", "ј": "j", "к": "k", "л": "l", "љ": "lj", "м": "m", "н": "n", "њ": "nj", "о": "o",
  "п": "p", "р": "r", "с": "s", "т": "t", "ћ": "c", "у": "u", "ф": "f", "х": "h", "ц": "c",
  "ч": "c", "џ": "dz", "ш": "s",
};
const CITY_ALIAS: Record<string, string> = { "belgrade": "beograd", "novi beograd": "beograd", "zemun": "beograd", "nish": "nis" };

// The same loose match as cityKey() in dates-rs.js: "Niš", "nis" and "Ниш" agree.
function cityKey(name: string) {
  let s = String(name || "").toLowerCase().replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] || c).replace(/đ/g, "dj");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return CITY_ALIAS[s] || s;
}

/* ------------------------------------------------------------------ */
/* What the week's ads are written from.                               */
/* ------------------------------------------------------------------ */

const WEATHER_WORDS: [number, string][] = [
  [0, "clear sky"], [3, "partly cloudy"], [48, "fog"], [57, "drizzle"], [67, "rain"],
  [77, "snow"], [82, "rain showers"], [86, "snow showers"], [99, "thunderstorms"],
];

function weatherWord(code: number) {
  for (const [max, word] of WEATHER_WORDS) if (code <= max) return word;
  return "mixed";
}

const COUNTRY_CODES: Record<string, string> = {
  "Serbia": "RS", "Bosnia & Herzegovina": "BA", "Montenegro": "ME",
  "Croatia": "HR", "North Macedonia": "MK", "Slovenia": "SI",
};

// One line per posting day, or null when the forecast isn't wanted or can't be had.
async function forecast(p: Profile, days: string[]) {
  if (!WEATHER || p.weather_ads === false || !p.city || !days.length) return null;
  try {
    const geo = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=1&language=sr&name=" +
      encodeURIComponent(p.city) + (COUNTRY_CODES[p.country] ? "&countryCode=" + COUNTRY_CODES[p.country] : ""));
    const top = geo.ok ? ((await geo.json()).results || [])[0] : null;
    if (!top) return null;
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${top.latitude}&longitude=${top.longitude}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16");
    if (!res.ok) return null;
    const d = (await res.json()).daily || {};
    const lines: string[] = [];
    (d.time || []).forEach((t: string, i: number) => {
      if (!days.includes(t)) return;
      lines.push(`${t} (${weekday(t)}): ${weatherWord(d.weather_code[i])}, ${Math.round(d.temperature_2m_min[i])}-${Math.round(d.temperature_2m_max[i])}°C` +
        (d.precipitation_probability_max[i] == null ? "" : `, ${d.precipitation_probability_max[i]}% chance of rain`));
    });
    return lines.length ? lines : null;
  } catch {
    return null;
  }
}

// The dates worth posting about this week: the fixed list plus the portal's
// local_events, each while its lead time covers one of the posting days.
async function datesAhead(p: Profile, days: string[]) {
  if (!days.length) return [];
  const first = days[0], last = days[days.length - 1];
  const here = cityKey(p.city || "");
  const out: string[] = [];
  const near = (date: string, lead: number) => date >= first && addDays(date, -lead) <= last;
  if (!p.country || p.country === "Serbia") {
    const y = Number(first.slice(0, 4));
    for (const year of [y, y + 1]) {
      for (const [date, name, lead] of fixedDates(year, here)) {
        if (near(date, lead)) out.push(`${date} (${weekday(date)}): ${name}`);
      }
    }
  }
  const ev = await db.from("local_events").select("*")
    .gte("starts_on", first).lte("starts_on", addDays(last, 60));
  for (const r of ev.data || []) {
    if (r.country && p.country && r.country !== p.country) continue;
    if (r.city && cityKey(r.city) !== here) continue;
    if (!near(r.starts_on, r.lead_days || 14)) continue;
    out.push(`${r.starts_on}${r.ends_on ? " to " + r.ends_on : ""}: ${r.name_en || r.name_sr}` +
      (r.idea_en || r.idea_sr ? ` - idea: ${r.idea_en || r.idea_sr}` : ""));
  }
  return out.sort();
}

// What the owner made of the last weeks' ads - the strongest steer there is.
async function feedback(userId: string, dropId: string) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const res = await db.from("creatives").select("*")
    .eq("user_id", userId).neq("drop_id", dropId).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(60);
  const lines: string[] = [];
  for (const c of res.data || []) {
    const ad = `"${c.headline || ""}" - ${String(c.caption || "").slice(0, 160)}`;
    if (c.loved) lines.push(`LOVED (make more like this): ${ad}`);
    if (c.status === "rejected") {
      lines.push(`TURNED DOWN${c.reject_reason ? " (" + c.reject_reason + ")" : ""}${c.reject_note ? ": \"" + c.reject_note + "\"" : ""}: ${ad}`);
    } else if (c.edited_at) {
      lines.push(`REWROTE "${c.original_headline || ""}" / "${String(c.original_caption || "").slice(0, 120)}" INTO ${ad}`);
    } else if (!c.loved && (c.status === "approved" || c.status === "published") && !c.auto_approved_at) {
      lines.push(`approved: ${ad}`);
    }
    if (c.outcome === "yes") lines.push(`BROUGHT PEOPLE IN: ${ad}`);
    if (c.outcome === "no") lines.push(`brought nobody in: ${ad}`);
  }
  return lines.slice(0, 30);
}

// Signed links to the logo, photos and menu, for Claude to look at.
async function brandFiles(userId: string) {
  const files: { kind: string; url: string; pdf: boolean }[] = [];
  for (const [kind, max] of [["logo", 1], ["photos", 6], ["menu", 2]] as [string, number][]) {
    const list = await db.storage.from(BRAND_BUCKET).list(`${userId}/${kind}`, { limit: 20, sortBy: { column: "created_at", order: "desc" } });
    for (const f of (list.data || []).filter((x) => x.id).slice(0, max)) {
      const signed = await db.storage.from(BRAND_BUCKET).createSignedUrl(`${userId}/${kind}/${f.name}`, 3600);
      if (signed.data?.signedUrl) files.push({ kind, url: signed.data.signedUrl, pdf: /\.pdf$/i.test(f.name) });
    }
  }
  return files;
}

function serbian(p: Profile) {
  return !p.country || SERBIAN_COUNTRIES.includes(p.country);
}

// The channels to spread this many ads over, as evenly as they go.
function channelPlan(p: Profile, count: number, offset: number) {
  const channels = (p.channels || []).filter((c: string) => FORMATS[c]);
  const list = channels.length ? channels : ["Instagram"];
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(list[(offset + i) % list.length]);
  return out;
}

function briefText(p: Profile, week: string, days: string[], weather: string[] | null, dates: string[], liked: string[]) {
  const note = p.next_week_note && p.next_week_note_at &&
      Date.now() - new Date(p.next_week_note_at).getTime() < 14 * 86400000
    ? p.next_week_note : null;
  const avoid = (p.avoid_tags || []).map((t: string) => AVOID[t]).filter(Boolean);
  const language = serbian(p)
    ? `Serbian, in the ${p.ad_script === "cyrillic" ? "Cyrillic" : "Latin"} alphabet`
    : p.country === "Croatia" ? "Croatian"
    : p.country === "Slovenia" ? "Slovenian"
    : p.country === "North Macedonia" ? "Macedonian"
    : "English";
  const section = (title: string, lines: (string | null | undefined)[]) => {
    const kept = lines.filter((l) => l && String(l).trim());
    return kept.length ? `## ${title}\n${kept.join("\n")}` : "";
  };
  return [
    section("The business", [
      `Name: ${p.business_name || "(not given)"}`,
      `Type: ${p.vertical || "(not given)"}`,
      `Where: ${[p.address, p.city, p.country].filter(Boolean).join(", ") || "(not given)"}`,
      p.opening_hours && `Opening hours: ${p.opening_hours}`,
      p.phone && `Phone: ${p.phone}`,
      p.website && `Website / Instagram: ${p.website}`,
      `What they sell: ${p.what_you_sell || "(not given)"}`,
      `Typical customer: ${p.typical_customer || "(not given)"}`,
      p.differentiator && `What makes them different: ${p.differentiator}`,
      p.why_us && `Why they came to us: ${p.why_us}`,
    ]),
    section("Brand and voice", [
      p.brand_vibe && `Vibe: ${p.brand_vibe}`,
      p.brand_colors && `Colours: ${p.brand_colors}`,
      `Language of the ads: ${language}`,
    ]),
    section("Never in these ads", [...avoid, p.avoid_notes && `In the owner's own words (wins over the rest): ${p.avoid_notes}`]),
    section("This week", [
      `Week starting Monday ${week}.`,
      `Days the ads may post on: ${days.map((d) => `${d} (${weekday(d)})`).join(", ")}.`,
      (p.closed_days || []).length ? `Closed: ${(p.closed_days || []).map((c: any) => `${c.from} to ${c.to}${c.note ? " (" + c.note + ")" : ""}`).join("; ")}. Never tell people to come by on a closed day.` : null,
      note && `What the owner wants this week built around: ${note}`,
    ]),
    weather ? section("Forecast for the posting days", [...weather, "Fit each ad to the weather of the day it posts."]) : "",
    dates.length ? section("Dates worth an ad around now", dates) : "",
    liked.length ? section("What the owner made of earlier ads (newest first)", liked) : "",
  ].filter(Boolean).join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Claude.                                                              */
/* ------------------------------------------------------------------ */

const COPY_SYSTEM = `You write the weekly social media ads for one small local business - a café, a bakery, a restaurant, a shop - in the Balkans. The owner has no time for marketing: you are their marketer. Every Monday they get a handful of ads, swipe through them, and the ones they approve are posted for them.

What makes an ad work here:
- It is about this business and this week, never generic. Use the real products, the real street, the real opening hours, the weather on the day it posts, and the dates people care about.
- One idea per ad, said plainly, the way the owner would say it to a regular. Warm, specific, local. No marketing clichés, no hashtag walls, no "Discover", "Elevate", "Unleash".
- The headline is short (at most 6-8 words) and could stand on its own. The caption is 1-4 short sentences and ends with something to do: come by, book, order, call - when it fits. At most 3 hashtags, only when they help locally (the town, the street).
- The ads of one week differ from each other: a product up close, the place itself, a reason to come today, a date coming up, the people behind it, a habit worth starting.
- Respect every rule under "Never in these ads". The owner's own words there win.
- What the owner loved, approved, rewrote and turned down before is the best guide to what they want. Do more of what they loved, write the way they rewrote, avoid what they turned down and why.
- Never invent facts that matter: no prices, offers, discounts, awards or events the brief doesn't give. If the brief has no offer, the ad needs none.
- Write in the language the brief names. Serbian ads in the alphabet it names, with correct diacritics.

The image prompt is for a photo generator, in English. Describe one photorealistic photo that would make this ad stop a thumb: the subject, the setting, the light, the angle, the mood, and the brand colours as accents where they fit naturally. If photos of the place or products were attached, describe what is really there so the picture looks like this business. Never ask for text, letters, words, logos, signs with writing or watermarks in the picture - the words go in the caption. Avoid hands holding things up close and crowds of faces; they come out wrong.

Pick a posting time on one of the given days that suits the ad and the channel: breakfast and coffee in the morning, lunch around noon, evenings for dinner and going out, weekends for families - always inside the opening hours, never on a closed day. Spread the ads over the week.`;

function copySchema(channels: string[], days: string[]) {
  const formats = [...new Set(channels.flatMap((c) => FORMATS[c].map((f) => f.format)))];
  return {
    type: "object",
    additionalProperties: false,
    required: ["theme", "ads"],
    properties: {
      theme: { type: "string", description: "The week's idea in a few words, in the language of the ads." },
      ads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["channel", "format", "post_on", "post_time", "idea", "headline", "caption", "image_prompt"],
          properties: {
            channel: { type: "string", enum: [...new Set(channels)] },
            format: { type: "string", enum: formats },
            post_on: { type: "string", enum: days },
            post_time: { type: "string", description: "HH:MM, 24-hour, local time." },
            idea: { type: "string", description: "Why this ad, this day - one line in English, for the team." },
            headline: { type: "string" },
            caption: { type: "string" },
            image_prompt: { type: "string" },
          },
        },
      },
    },
  };
}

function claudeCost(model: string, usage: any) {
  const price = CLAUDE_PRICES[model] || CLAUDE_PRICES["claude-opus-5-5"];
  const input = usage?.input_tokens || 0;
  const write = usage?.cache_creation_input_tokens || 0;
  const read = usage?.cache_read_input_tokens || 0;
  const output = usage?.output_tokens || 0;
  return {
    input_tokens: input + write,
    output_tokens: output,
    cached_tokens: read,
    cost_usd: (input * price.input + write * price.write + read * price.read + output * price.output) / 1e6,
  };
}

async function logCost(row: Record<string, unknown>) {
  const res = await db.from("generation_costs").insert(row);
  if (res.error) console.error("cost not logged", res.error.message);
}

// The models that take fallbacks: "default" (Haiku has no server-side fallback).
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"];

// One call to Claude for JSON that matches the schema. Refusals fall back
// server-side to the model Anthropic picks for that kind of refusal.
async function askClaude(opts: {
  system: string; content: any[]; schema: object; effort: string; maxTokens: number;
  cost: Record<string, unknown>; step: string;
}) {
  const res: any = await (claude as any).beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens,
    ...(FALLBACK_MODELS.includes(CLAUDE_MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.content }],
    output_config: { effort: opts.effort, format: { type: "json_schema", schema: opts.schema } },
  });
  const model = res.model || CLAUDE_MODEL;
  await logCost({ ...opts.cost, provider: "claude", model, step: opts.step, ...claudeCost(model, res.usage) });
  if (res.stop_reason === "refusal") throw new Error("Claude declined: " + (res.stop_details?.category || "no reason given"));
  if (res.stop_reason === "max_tokens") throw new Error("Claude ran out of room for the answer.");
  const text = (res.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return JSON.parse(text);
}

/* ------------------------------------------------------------------ */
/* Practice texts, used until there is a Claude key.                    */
/* ------------------------------------------------------------------ */

function practiceAds(p: Profile, channels: string[], days: string[], offset: number) {
  const sr = serbian(p);
  const name = p.business_name || (sr ? "Naše mesto" : "Our place");
  const sells = String(p.what_you_sell || (sr ? "ono što volite" : "what you love")).split(/[,.;\n]/)[0].trim();
  const city = p.city || "";
  const ideas = sr
    ? [
      ["Jutro počinje kod nas", `Svratite na ${sells.toLowerCase()} pre posla. ${name} vas čeka${city ? " u " + city : ""}.`],
      ["Napravljeno danas, za vas", `Sve što nudimo pravimo sveže, svaki dan. Dođite da probate ${sells.toLowerCase()}.`],
      ["Vaše mesto u kraju", `Kad vam treba pauza od dana, tu smo. ${p.opening_hours ? "Radimo " + p.opening_hours + "." : "Vidimo se!"}`],
      ["Vikend je za male radosti", `Povedite društvo i uživajte u ${sells.toLowerCase()}. ${name}${city ? ", " + city : ""}.`],
      ["Probajte nešto novo", `Pitajte nas šta je danas najbolje - rado ćemo vam preporučiti.`],
      ["Hvala što ste uz nas", `Svaki gost nam znači. Dođite opet, ${name} je tu za vas.`],
    ]
    : [
      ["Your morning starts here", `Stop by for ${sells.toLowerCase()} before work. ${name} is waiting${city ? " in " + city : ""}.`],
      ["Made today, for you", `Everything we offer is made fresh, every day. Come and try ${sells.toLowerCase()}.`],
      ["Your spot in the neighbourhood", `When you need a break from the day, we're here. ${p.opening_hours ? "Open " + p.opening_hours + "." : "See you soon!"}`],
      ["Weekends are for small joys", `Bring your friends and enjoy ${sells.toLowerCase()}. ${name}${city ? ", " + city : ""}.`],
      ["Try something new", "Ask us what's best today - we'd love to recommend something."],
      ["Thanks for being with us", `Every guest matters to us. Come again - ${name} is here for you.`],
    ];
  return channels.map((channel, i) => {
    const [headline, caption] = ideas[(offset + i) % ideas.length];
    return {
      channel,
      format: FORMATS[channel][0].format,
      post_on: days[(offset + i) % days.length],
      post_time: ["08:30", "12:00", "17:30", "19:00"][(offset + i) % 4],
      idea: "Practice ad - written from a template, not by Claude.",
      headline,
      caption,
      image_prompt: `A warm, photorealistic photo for ${name}, a ${p.vertical || "local business"}: ${sells}, natural light, inviting, no text.`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 1. plan                                                               */
/* ------------------------------------------------------------------ */

function testEmails() {
  return secret("ENGINE_TEST_EMAILS").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
}

// null = every account; [] = nobody.
function audience(): string[] | null {
  if (secret("ENGINE_LIVE").toLowerCase() === "true" && !practice) return null;
  return testEmails();
}

async function startDrop(userId: string, week: string, ads: number, log: Log) {
  const prof = await db.from("profiles").select("*").eq("id", userId).single();
  if (prof.error) throw new Error(prof.error.message);
  const days = postingDays(week, prof.data.closed_days);
  if (!days.length) {
    // Closed all week (or nothing left of it): nobody pays for ads nobody can use.
    const res = await db.from("drops").insert({ user_id: userId, week_starting: week, status: "skipped", notes: "Closed all week - no ads." });
    if (res.error && res.error.code !== "23505") throw new Error(res.error.message);
    log.skipped++;
    return null;
  }
  const drop = await db.from("drops").insert({ user_id: userId, week_starting: week, status: "rendering" }).select().single();
  if (drop.error) {
    if (drop.error.code === "23505") return null; // another run got there first
    throw new Error(drop.error.message);
  }
  const run = await db.from("engine_runs").insert({ drop_id: drop.data.id, user_id: userId, planned: ads, practice });
  if (run.error) throw new Error(run.error.message);
  log.planned++;
  return drop.data.id as string;
}

async function plan(log: Log) {
  const only = audience();
  if (only && !only.length) return;
  const due = await db.rpc("engine_due", { p_only: only, p_limit: 5 });
  if (due.error) throw new Error(due.error.message);
  for (const row of due.data || []) {
    try {
      await startDrop(row.user_id, row.week_starting, row.ads, log);
    } catch (err) {
      log.errors.push("plan " + row.user_id + ": " + (err as Error).message);
    }
  }
}

// {"make": "someone@example.com"}: a drop for that account now, for the next
// week it has none for - whatever the day, in practice mode or not.
async function makeFor(email: string, log: Log) {
  const who = await db.from("profiles").select("id, plan, subscription_status, onboarded_at, engine_paused_at").ilike("email", email.trim()).maybeSingle();
  if (who.error || !who.data) return "No account with that email.";
  if (who.data.engine_paused_at) return "That account is paused in the portal's Costs view - resume it first.";
  if (!who.data.onboarded_at) return "That account hasn't filled in its business brief yet.";
  if (!["trialing", "active"].includes(who.data.subscription_status)) {
    return "That account has no running plan - switch the Beta plan on for it in the portal first.";
  }
  const today = localParts(new Date()).date;
  let week = mondayOf(today);
  if (postingDays(week, []).length < 2) week = addDays(week, 7);
  for (let i = 0; i < 8; i++, week = addDays(week, 7)) {
    const taken = await db.from("drops").select("id").eq("user_id", who.data.id).eq("week_starting", week).maybeSingle();
    if (taken.data) continue;
    const ads = who.data.plan === "storefront" ? 12 : who.data.plan === "franchise" ? 30 : 4;
    const id = await startDrop(who.data.id, week, ads, log);
    return id ? `Making ${ads} ads for the week of ${week}.` : `Nothing to make for the week of ${week} - the business is closed.`;
  }
  return "That account already has drops for the next eight weeks.";
}

// {"retry": "<drop id>"}: a failed drop goes on from where it stopped.
async function retry(dropId: string) {
  const jobs = await db.from("engine_jobs").select("id", { count: "exact", head: true }).eq("drop_id", dropId);
  const run = await db.from("engine_runs").select("*").eq("drop_id", dropId).maybeSingle();
  if (!run.data) return "No drop in the making with that id.";
  await db.from("engine_jobs").update({ status: "queued", attempts: 0, locked_until: null, last_error: null })
    .eq("drop_id", dropId).eq("status", "failed").is("best_url", null);
  await db.from("engine_runs").update({
    stage: (jobs.count || 0) < run.data.planned ? "copy" : "images", attempts: 0, locked_until: null, last_error: null,
  }).eq("drop_id", dropId);
  return "Trying that drop again.";
}

/* ------------------------------------------------------------------ */
/* 2. copy                                                               */
/* ------------------------------------------------------------------ */

async function writeCopy(run: Run, log: Log) {
  const [prof, drop, done] = await Promise.all([
    db.from("profiles").select("*").eq("id", run.user_id).single(),
    db.from("drops").select("*").eq("id", run.drop_id).single(),
    db.from("engine_jobs").select("position, channel, headline, idea").eq("drop_id", run.drop_id).order("position"),
  ]);
  if (prof.error || drop.error) throw new Error((prof.error || drop.error)!.message);
  const p = prof.data, written = done.data || [];
  // Paused from the portal while this drop was being written: nothing more
  // is spent on it. It stays claimed until the hold runs out, then waits.
  if (p.engine_paused_at) return;
  const count = Math.min(ADS_PER_CALL, run.planned - written.length);
  if (count <= 0) {
    await db.from("engine_runs").update({ stage: "images", locked_until: null }).eq("drop_id", run.drop_id);
    return;
  }
  const days = postingDays(drop.data.week_starting, p.closed_days);
  if (!days.length) throw new Error("No days left to post on this week.");
  const channels = channelPlan(p, count, written.length);
  const cost = { user_id: run.user_id, drop_id: run.drop_id };

  let theme: string | null = null;
  let ads: any[];
  if (claude) {
    const [weather, dates, liked, files] = await Promise.all([
      forecast(p, days), datesAhead(p, days), feedback(run.user_id, run.drop_id), brandFiles(run.user_id),
    ]);
    const content: any[] = [];
    for (const f of files) {
      content.push(f.pdf
        ? { type: "document", source: { type: "url", url: f.url }, title: "Menu" }
        : { type: "image", source: { type: "url", url: f.url } });
    }
    if (files.length) {
      content.push({ type: "text", text: `Above: the business's own ${[...new Set(files.map((f) => f.kind))].join(", ")} - look at what is really there.` });
    }
    content.push({ type: "text", text: briefText(p, drop.data.week_starting, days, weather, dates, liked), cache_control: { type: "ephemeral" } });
    const tally: Record<string, number> = {};
    channels.forEach((c) => { tally[c] = (tally[c] || 0) + 1; });
    content.push({
      type: "text",
      text: `Write ${count} ad${count === 1 ? "" : "s"}: ${Object.entries(tally).map(([c, n]) => `${n} for ${c}`).join(", ")}.` +
        (written.length
          ? `\nThis week already has these - make the new ones different:\n${written.map((w: any) => `- ${w.channel}: "${w.headline}" (${w.idea || ""})`).join("\n")}`
          : ""),
    });
    const out = await askClaude({
      system: COPY_SYSTEM, content, schema: copySchema(channels, days), effort: CLAUDE_EFFORT,
      maxTokens: 16000, cost, step: "copy",
    });
    theme = out.theme || null;
    ads = (out.ads || []).slice(0, count);
  } else {
    ads = practiceAds(p, channels, days, written.length);
    theme = serbian(p) ? "Probna nedelja" : "Practice week";
  }
  if (!ads.length) throw new Error("No ads came back.");

  const rows = ads.map((a, i) => {
    const channel = FORMATS[a.channel] ? a.channel : channels[i];
    const format = FORMATS[channel].find((f) => f.format === a.format) || FORMATS[channel][0];
    const day = days.includes(a.post_on) ? a.post_on : days[i % days.length];
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(a.post_time || "") ? a.post_time : "12:00";
    return {
      drop_id: run.drop_id,
      user_id: run.user_id,
      position: written.length + i,
      channel,
      format: format.format,
      aspect_ratio: format.ratio,
      headline: String(a.headline || "").slice(0, 200),
      caption: String(a.caption || "").slice(0, 2200),
      idea: String(a.idea || "").slice(0, 500),
      image_prompt: String(a.image_prompt || "").slice(0, 2000) || `A photorealistic photo for a ${p.vertical || "local business"}, no text.`,
      scheduled_at: localToUtc(day, time).toISOString(),
    };
  });
  const ins = await db.from("engine_jobs").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  if (theme && !written.length) await db.from("drops").update({ theme: theme.slice(0, 200) }).eq("id", run.drop_id);
  log.written += rows.length;

  const stage = written.length + rows.length >= run.planned ? "images" : "copy";
  await db.from("engine_runs").update({ stage, attempts: 0, locked_until: null, last_error: null }).eq("drop_id", run.drop_id);
}

async function copyStep(log: Log) {
  const claimed = await db.rpc("engine_claim_runs", { p_stage: "copy", p_limit: 1, p_hold: 240 });
  if (claimed.error) throw new Error(claimed.error.message);
  const run = (claimed.data || [])[0];
  if (!run) return false;
  try {
    await writeCopy(run, log);
  } catch (err) {
    const msg = (err as Error).message;
    log.errors.push("copy " + run.drop_id + ": " + msg);
    const attempts = run.attempts + 1;
    await db.from("engine_runs").update({
      attempts, last_error: msg.slice(0, 1000), locked_until: null,
      stage: attempts >= COPY_ATTEMPTS ? "failed" : "copy",
    }).eq("drop_id", run.drop_id);
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 3. images                                                             */
/* ------------------------------------------------------------------ */

async function hf(path: string, init: RequestInit = {}) {
  const res = await fetch(HF_API + "/" + path.replace(/^\/+/, ""), {
    ...init,
    headers: {
      "Authorization": `Key ${HF_ID}:${HF_SECRET}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`Higgsfield ${res.status}: ${body?.detail || text.slice(0, 200)}`);
  return body;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[c]!));
}

// The placeholder card that stands in for a picture until there is a Higgsfield key.
function practiceImage(job: Job) {
  const [w, h] = job.aspect_ratio.split(":").map(Number);
  const width = 1080, height = Math.round((1080 * h) / w);
  const words = String(job.headline || "").split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + word).length <= 18) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  const top = height / 2 - (lines.length * 92) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2432"/><stop offset="1" stop-color="#57405f"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="64" y="104" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="4" fill="#ffffff" fill-opacity="0.6">${escapeXml(job.channel.toUpperCase())} · ${escapeXml(job.format.toUpperCase())}</text>
${lines.map((l, i) => `<text x="64" y="${Math.round(top + i * 92)}" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700" fill="#ffffff">${escapeXml(l)}</text>`).join("\n")}
<text x="64" y="${height - 72}" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.55">PROBNA SLIKA · PRACTICE IMAGE</text>
</svg>`;
  return new TextEncoder().encode(svg);
}

async function store(job: Job, bytes: Uint8Array, type: string) {
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg" }[type] || "png";
  const path = `${job.user_id}/${job.drop_id}/${job.creative_id}-${job.attempts}.${ext}`;
  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
  if (up.error) throw new Error("storing the image: " + up.error.message);
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function updateJob(job: Job, fields: Record<string, unknown>) {
  const res = await db.from("engine_jobs").update({ ...fields, locked_until: null }).eq("id", job.id);
  if (res.error) throw new Error(res.error.message);
}

// A picture that didn't come out: another go, or the end with the best so far.
async function imageFailed(job: Job, reason: string) {
  if (job.attempts >= IMAGE_ATTEMPTS) {
    await updateJob(job, { status: job.best_url ? "ready" : "failed", image_url: job.best_url, hf_request_id: null, last_error: reason });
  } else {
    await updateJob(job, { status: "queued", hf_request_id: null, last_error: reason });
  }
}

async function submit(job: Job, log: Log) {
  const attempts = job.attempts + 1;
  if (!higgsfield) {
    const url = await store({ ...job, attempts }, practiceImage(job), "image/svg+xml");
    await updateJob(job, { attempts, image_url: url, status: claude ? "checking" : "ready" });
    log.submitted++;
    return;
  }
  const out = await hf(HF_MODEL, {
    method: "POST",
    headers: { "Idempotency-Key": `${job.id}-${attempts}` },
    body: JSON.stringify({ prompt: job.image_prompt, aspect_ratio: job.aspect_ratio, resolution: "2K", num_images: 1 }),
  });
  if (!out?.request_id) throw new Error("Higgsfield gave no request id.");
  await updateJob(job, {
    attempts, hf_request_id: out.request_id, submitted_at: new Date().toISOString(),
    status: "running", image_url: null, last_error: null,
  });
  log.submitted++;
}

async function poll(job: Job) {
  const out = await hf(`requests/${job.hf_request_id}/status`);
  if (out.status === "queued" || out.status === "in_progress") {
    // Stuck for more than 15 minutes: start again.
    if (Date.now() - new Date(job.submitted_at || job.updated_at).getTime() > 15 * 60000) {
      await hf(`requests/${job.hf_request_id}/cancel`, { method: "POST" }).catch(() => {});
      await imageFailed(job, "Higgsfield took too long.");
    } else {
      await db.from("engine_jobs").update({ locked_until: null }).eq("id", job.id);
    }
    return "waiting";
  }
  if (out.status !== "completed") {
    // failed and nsfw aren't charged.
    await imageFailed(job, `Higgsfield: ${out.status}${out.error ? " - " + out.error : ""}`);
    return "done";
  }
  const src = out.images?.[0]?.url;
  if (!src) {
    await imageFailed(job, "Higgsfield finished with no image.");
    return "done";
  }
  const img = await fetch(src);
  if (!img.ok) throw new Error(`fetching the image: ${img.status}`);
  const type = (img.headers.get("content-type") || "image/png").split(";")[0].trim();
  const url = await store(job, new Uint8Array(await img.arrayBuffer()), type);
  // Logged once the picture is safely ours, so a retried fetch isn't counted twice.
  await logCost({
    user_id: job.user_id, drop_id: job.drop_id, job_id: job.id, provider: "higgsfield", model: HF_MODEL,
    step: "image", units: 1, cost_usd: HF_PRICE,
    note: HF_PRICE ? `request ${job.hf_request_id}` : `request ${job.hf_request_id}; price not set (HIGGSFIELD_USD_PER_IMAGE)`,
  });
  await updateJob(job, { image_url: url, status: claude ? "checking" : "ready", hf_request_id: null });
  return "done";
}

const CHECK_SYSTEM = `You check the pictures made for a small local business's social media ads before the owner sees them. Be the owner's critical eye: would they be glad to post this?

Score 1-10. Below ${PASS_SCORE} means it should be made again. Mark it down hard for: any text, letters, logos or watermarks in the picture; warped hands, faces, food or objects; anything that breaks the business's rules; a picture that doesn't fit the business or the ad; a cheap stock-photo look; anything unappetising or unsafe. When it falls short, write a better prompt for the photo generator that fixes what's wrong while keeping the idea.`;

const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "problems", "better_prompt"],
  properties: {
    score: { type: "integer" },
    problems: { type: "string", description: "What's wrong, in a sentence or two; empty when nothing is." },
    better_prompt: { type: "string", description: "A better prompt when the score is below the bar; empty otherwise." },
  },
};

async function check(job: Job, p: Profile, log: Log) {
  const head = await fetch(job.image_url, { method: "HEAD" });
  const size = Number(head.headers.get("content-length") || 0);
  let score = 10, problems = "", better = "";
  if (size > CHECK_MAX_BYTES || /\.svg$/.test(job.image_url)) {
    problems = size > CHECK_MAX_BYTES ? "Not checked: the picture is over 5 MB." : "";
  } else {
    const rules = [...(p.avoid_tags || []).map((t: string) => AVOID[t]).filter(Boolean), p.avoid_notes].filter(Boolean);
    const out = await askClaude({
      system: CHECK_SYSTEM,
      content: [
        { type: "image", source: { type: "url", url: job.image_url } },
        {
          type: "text",
          text: `Business: ${p.business_name || ""}, a ${p.vertical || "local business"} in ${p.city || "town"}. Sells: ${p.what_you_sell || ""}.` +
            `\nAd for ${job.channel} (${job.format}): "${job.headline}" - ${job.caption}` +
            `\nThe idea: ${job.idea || ""}\nThe prompt that made it: ${job.image_prompt}` +
            (rules.length ? `\nThe business's rules: ${rules.join(" ")}` : ""),
        },
      ],
      schema: CHECK_SCHEMA, effort: "low", maxTokens: 4000,
      cost: { user_id: job.user_id, drop_id: job.drop_id, job_id: job.id }, step: "check",
    });
    score = Math.max(1, Math.min(10, Number(out.score) || 1));
    problems = String(out.problems || "");
    better = String(out.better_prompt || "");
  }
  log.checked++;
  const best = job.best_score == null || score > job.best_score
    ? { best_url: job.image_url, best_score: score }
    : { best_url: job.best_url, best_score: job.best_score };
  const note = problems.slice(0, 1000) || null;
  if (score >= PASS_SCORE) {
    await updateJob(job, { status: "ready", check_score: score, check_note: note, ...best });
  } else if (job.attempts >= IMAGE_ATTEMPTS) {
    await updateJob(job, { status: "ready", image_url: best.best_url, check_score: best.best_score, check_note: note, ...best });
  } else {
    await updateJob(job, {
      status: "queued", check_score: score, check_note: note, image_url: null,
      image_prompt: (better || job.image_prompt).slice(0, 2000), ...best,
    });
  }
}

// Returns whether anything is still waiting on Higgsfield.
async function imageStep(log: Log, started: number) {
  // Too late in this call for a check: those wait for the next one.
  const statuses = Date.now() - started > LAST_CHECK_MS ? ["queued", "running"] : ["queued", "running", "checking"];
  const claimed = await db.rpc("engine_claim_jobs", { p_statuses: statuses, p_limit: 8, p_hold: 180 });
  if (claimed.error) throw new Error(claimed.error.message);
  const jobs: Job[] = claimed.data || [];
  const profiles = new Map<string, Profile>();
  let waiting = false;
  await Promise.all(jobs.map(async (job) => {
    try {
      if (job.status === "queued") {
        await submit(job, log);
        waiting = waiting || higgsfield;
      } else if (job.status === "running") {
        if (!higgsfield) return await updateJob(job, { status: "queued", hf_request_id: null });
        if ((await poll(job)) === "waiting") waiting = true;
      } else if (job.status === "checking") {
        if (!claude) return await updateJob(job, { status: "ready" });
        if (!profiles.has(job.user_id)) {
          const prof = await db.from("profiles").select("*").eq("id", job.user_id).single();
          profiles.set(job.user_id, prof.data || {});
        }
        await check(job, profiles.get(job.user_id)!, log);
      }
    } catch (err) {
      const msg = (err as Error).message;
      log.errors.push(`image ${job.id}: ${msg}`);
      const stale = Date.now() - new Date(job.submitted_at || job.updated_at).getTime() > 30 * 60000;
      if (job.status === "queued") {
        // A submit that failed outright counts as a go.
        await imageFailed({ ...job, attempts: job.attempts + 1 }, msg).catch(() => {});
      } else if (job.status === "checking") {
        // The picture is there; a check that can't run doesn't hold the drop back.
        await updateJob(job, { status: "ready", check_note: ("Not checked: " + msg).slice(0, 1000) }).catch(() => {});
      } else if (stale) {
        // Higgsfield hasn't answered for half an hour: try again.
        await imageFailed(job, msg).catch(() => {});
      } else {
        await db.from("engine_jobs").update({ locked_until: null, last_error: msg.slice(0, 1000) }).eq("id", job.id);
      }
    }
  }));
  return { worked: jobs.length > 0, waiting };
}

/* ------------------------------------------------------------------ */
/* 4. deliver                                                            */
/* ------------------------------------------------------------------ */

async function deliverStep(log: Log) {
  const runs = await db.from("engine_runs").select("*").eq("stage", "images").limit(20);
  for (const run of runs.data || []) {
    const jobs = await db.from("engine_jobs").select("status, image_url, best_url").eq("drop_id", run.drop_id);
    const list = jobs.data || [];
    if (list.length < run.planned || list.some((j) => !["ready", "failed"].includes(j.status))) continue;
    if (!list.some((j) => j.image_url || j.best_url)) {
      await db.from("engine_runs").update({ stage: "failed", last_error: "No image came out for any ad." }).eq("drop_id", run.drop_id);
      log.errors.push("deliver " + run.drop_id + ": no images");
      continue;
    }
    const res = await db.rpc("engine_deliver", { p_drop: run.drop_id, p_theme: null });
    if (res.error) {
      log.errors.push("deliver " + run.drop_id + ": " + res.error.message);
      await db.from("engine_runs").update({ last_error: res.error.message.slice(0, 1000) }).eq("drop_id", run.drop_id);
      continue;
    }
    log.delivered++;
    // The pictures that lost to a better one aren't needed any more.
    const keep = new Set(list.map((j) => String(j.image_url || j.best_url || "").split("/").pop()));
    const folder = `${run.user_id}/${run.drop_id}`;
    const files = await db.storage.from(BUCKET).list(folder, { limit: 200 });
    const extra = (files.data || []).filter((f) => !keep.has(f.name)).map((f) => `${folder}/${f.name}`);
    if (extra.length) await db.storage.from(BUCKET).remove(extra);
  }
}

// Once a night: the pictures of accounts that no longer exist.
async function cleanUp() {
  const now = localParts(new Date());
  if (now.hour !== 4 || now.minute >= 2) return;
  const top = await db.storage.from(BUCKET).list("", { limit: 1000 });
  const ids = (top.data || []).filter((f) => !f.id).map((f) => f.name);
  if (!ids.length) return;
  const alive = await db.from("profiles").select("id").in("id", ids);
  const keep = new Set((alive.data || []).map((r) => r.id));
  for (const id of ids.filter((x) => !keep.has(x))) {
    const drops = await db.storage.from(BUCKET).list(id, { limit: 1000 });
    for (const d of drops.data || []) {
      const files = await db.storage.from(BUCKET).list(`${id}/${d.name}`, { limit: 1000 });
      const paths = (files.data || []).map((f) => `${id}/${d.name}/${f.name}`);
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
    }
  }
}

/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  const expected = secret("ENGINE_CRON_SECRET");
  const given = (req.headers.get("x-cron-secret") || "").trim();
  if (!expected || given !== expected) return new Response("Forbidden", { status: 403 });

  const started = Date.now();
  const log: Log = { planned: 0, skipped: 0, written: 0, submitted: 0, checked: 0, delivered: 0, errors: [] };
  const body = await req.json().catch(() => ({}));
  let message: string | undefined;

  try {
    if (body && typeof body.make === "string" && body.make.includes("@")) message = await makeFor(body.make, log);
    else if (body && typeof body.retry === "string") message = await retry(body.retry);
    await plan(log);
  } catch (err) {
    log.errors.push("plan: " + (err as Error).message);
  }

  // Errors piling up (a service down, a bad key) end the call early.
  while (Date.now() - started < RUN_MS && log.errors.length < 10) {
    let worked = false, waiting = false;
    try {
      if (Date.now() - started < LAST_COPY_MS) worked = await copyStep(log);
      const images = await imageStep(log, started);
      worked = worked || images.worked;
      waiting = images.waiting;
      await deliverStep(log);
    } catch (err) {
      log.errors.push((err as Error).message);
      break;
    }
    if (!worked && !waiting) break;
    // Only pictures still being made: give Higgsfield a moment.
    if (waiting) await new Promise((r) => setTimeout(r, 5000));
  }

  await cleanUp().catch((err) => log.errors.push("clean-up: " + (err as Error).message));
  return Response.json({
    ...(message ? { message } : {}),
    mode: { copy: claude ? CLAUDE_MODEL : "practice", images: higgsfield ? HF_MODEL : "practice", live: audience() === null },
    ...log,
    ms: Date.now() - started,
  });
});
