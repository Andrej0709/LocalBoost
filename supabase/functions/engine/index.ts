// Adronis ad engine. pg_cron calls this every 2 minutes (section 13 of
// supabase/schema.sql); each call moves every drop in the making one step on
// and stops after about a minute and a half:
//
//   1. plan     every account whose week is due (engine_due) gets a drop in
//               'rendering' and an engine_runs row. A week the business is
//               closed from end to end gets a 'skipped' drop and no ads.
//   2. copy     Claude writes the week's ads, a few per call: text, channel,
//               format, posting time and a prompt for the image. It reads the
//               brief, the uploaded logo, photos and menu, the product photos
//               read from the business's website, the forecast, the
//               town's dates and what the owner approved, loved, edited and
//               turned down in the last weeks. One engine_jobs row per ad.
//   3. images   Higgsfield makes each photo (with no text in it); the headline,
//               the call-to-action button and the business's name are written
//               onto it here, it is copied into the public "creatives" bucket,
//               and Claude looks at it. One that falls
//               short is made again from a better prompt, up to
//               IMAGE_ATTEMPTS times (one for now - every try is paid);
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
//   HIGGSFIELD_API_KEY        Higgsfield key (open.higgsfield.ai, one string)
//   HIGGSFIELD_API_KEY_ID     older keys: key id     } used when HIGGSFIELD_API_KEY
//   HIGGSFIELD_API_KEY_SECRET older keys: key secret } is not set; none = practice images
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
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

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
// One go per picture: every try is paid for, and a weak picture is still
// better than a second bill during the beta.
const IMAGE_ATTEMPTS = 1;
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
// The newer keys from open.higgsfield.ai are one string, sent as "Key <key>".
const HF_KEY = secret("HIGGSFIELD_API_KEY") || (HF_ID && HF_SECRET ? `${HF_ID}:${HF_SECRET}` : "");
const HF_MODEL = (secret("HIGGSFIELD_MODEL") || "higgsfield-ai/soul/standard").replace(/^\/+/, "");
const HF_PRICE = Number(secret("HIGGSFIELD_USD_PER_IMAGE")) || 0;
const WEATHER = secret("WEATHER").toLowerCase() !== "off";

const claude = CLAUDE_KEY ? new Anthropic({ apiKey: CLAUDE_KEY, maxRetries: 2 }) : null;
const higgsfield = !!HF_KEY;
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

// Signed links to the logo, photos and menu, for Claude to look at. "site" is
// the product photos read from the business's website (siteProducts).
async function brandFiles(userId: string) {
  const files: { kind: string; url: string; pdf: boolean; path: string }[] = [];
  for (const [kind, max] of [["logo", 1], ["photos", 6], ["site", SITE_MAX], ["menu", 2]] as [string, number][]) {
    const list = await db.storage.from(BRAND_BUCKET).list(`${userId}/${kind}`, { limit: 40, sortBy: { column: "created_at", order: "desc" } });
    for (const f of (list.data || []).filter((x) => x.id && /\.(jpe?g|png|webp|pdf)$/i.test(x.name)).slice(0, max)) {
      const path = `${userId}/${kind}/${f.name}`;
      const signed = await db.storage.from(BRAND_BUCKET).createSignedUrl(path, 3600);
      if (signed.data?.signedUrl) files.push({ kind, url: signed.data.signedUrl, pdf: /\.pdf$/i.test(f.name), path });
    }
  }
  return files;
}

/* The business's own product photos, read from the website they gave at   */
/* signup, so the ads show their real products as they really look. Read   */
/* at the start of each drop (at most once every SITE_DAYS) and kept in     */
/* brand-assets/<user>/site/, where Claude sees them with the uploads.      */
const SITE_MAX = 10;
const SITE_DAYS = 6;
const SITE_MS = 30_000;
const SOCIAL = /(^|\.)(instagram|facebook|fb|tiktok|linktr|wa|whatsapp|google|goo|maps\.app|youtube|x|twitter)\.[a-z.]+$/i;

function siteUrl(raw: string | null | undefined) {
  let t = String(raw || "").trim();
  if (!t || t.startsWith("@")) return null;
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (!u.hostname.includes(".") || SOCIAL.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}

async function fetchText(url: string, ms: number) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(Math.max(1000, ms)), redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AdronisBot/1.0)", "Accept": "text/html,*/*" },
  });
  if (!res.ok || !/html/i.test(res.headers.get("content-type") || "")) return "";
  return (await res.text()).slice(0, 1_500_000);
}

function tagAttr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3] ?? "") : "";
}

// Every picture a page shows, the biggest version where srcset gives a choice.
function pageImages(html: string, base: string) {
  const out: { url: string; alt: string }[] = [];
  const abs = (u: string) => { try { return new URL(u.replace(/&amp;/g, "&").trim(), base).href; } catch { return null; } };
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (/(property|name)\s*=\s*["'](og:image|og:image:url|twitter:image)["']/i.test(tag)) {
      const u = abs(tagAttr(tag, "content"));
      if (u) out.push({ url: u, alt: "" });
    }
  }
  for (const m of html.matchAll(/<(img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    const set = tagAttr(tag, "data-srcset") || tagAttr(tag, "srcset");
    let src = "";
    if (set) {
      const best = set.split(",").map((x) => x.trim().split(/\s+/)).filter((x) => x[0])
        .sort((a, b) => (parseFloat(b[1] || "0") || 0) - (parseFloat(a[1] || "0") || 0))[0];
      src = best?.[0] || "";
    }
    src = src || tagAttr(tag, "data-src") || tagAttr(tag, "data-lazy-src") || tagAttr(tag, "src");
    // Wide banners and tiny thumbnails aren't product photos.
    const w = parseInt(tagAttr(tag, "width")) || 0, h = parseInt(tagAttr(tag, "height")) || 0;
    if (w && h && (w / h > 2.2 || h / w > 2.2 || Math.max(w, h) < 300)) continue;
    const u = src && !src.startsWith("data:") ? abs(src) : null;
    if (u) out.push({ url: u, alt: tagAttr(tag, "alt").slice(0, 120) });
  }
  // Shop pages list their product photos in JSON-LD.
  for (const m of html.matchAll(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) {
    for (const x of m[1].matchAll(/"(https?:[^"]+)"/g)) {
      const u = abs(x[1].replace(/\\\//g, "/"));
      if (u) out.push({ url: u, alt: "" });
    }
  }
  return out.filter((i) => /^https?:/.test(i.url) && !/\.(svg|gif|ico)(\?|$)/i.test(i.url) &&
    !/logo|icon|favicon|sprite|avatar|placeholder|loader|payment|flag|badge|emoji|bann?er|slider|facebook\.com\/tr/i.test(i.url));
}

// Links on the page that probably lead to the products or the menu, the
// likeliest first.
function productLinks(html: string, base: URL, seen: Set<string> = new Set()) {
  const out = new Map<string, number>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const text = (m[1] + " " + m[2].replace(/<[^>]+>/g, " ")).toLowerCase();
    if (/akcij|aplikacij|kontakt|contact|karijer|career|login|prijav|korpa|cart|blog|vesti|news|privacy|politik|uslovi/.test(text)) continue;
    const score = /proizvod|product|asortiman|jelovnik|meni|menu|shop|prodavnic|ponud|производ|мени|понуд/.test(text) ? 2
      : /torte|kola[cč]|peciv|pit[ae]|hleb|sendvi|kafa|coffee|pizza|burek|sladoled|galerij|gallery/.test(text) ? 1 : 0;
    if (!score) continue;
    try {
      const u = new URL(m[1], base);
      const href = u.href.split("#")[0];
      if (u.hostname === base.hostname && /^https?:$/.test(u.protocol) && href !== base.href && !seen.has(href)) {
        out.set(href, Math.max(score, out.get(href) || 0));
      }
    } catch { /* not a link */ }
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 4);
}

// Reads the website and keeps up to SITE_MAX of its product photos. Takes at
// most SITE_MS; a site that can't be read just leaves last time's photos.
async function siteProducts(userId: string, website: string | null | undefined) {
  const base = siteUrl(website);
  if (!base) return;
  const folder = `${userId}/site`;
  const held = await db.storage.from(BRAND_BUCKET).list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const old = (held.data || []).filter((f) => f.id);
  const newest = old[0]?.created_at ? new Date(old[0].created_at).getTime() : 0;
  if (Date.now() - newest < SITE_DAYS * 86400000) return;

  const started = Date.now();
  const left = () => SITE_MS - (Date.now() - started);
  const found = new Map<string, string>();
  try {
    // The home page, the product pages it links to, and one level under the
    // first of those (a shop's categories). The deepest pages hold the
    // product photos, so their pictures come first.
    const home = await fetchText(base.href, 8000);
    const seen = new Set([base.href]);
    const pages: string[][] = [[home], [], []];
    const visit = async (link: string, level: number) => {
      if (!link || left() < 7000 || seen.has(link)) return "";
      seen.add(link);
      const html = await fetchText(link, Math.min(6000, left() - 6000)).catch(() => "");
      pages[level].push(html);
      return html;
    };
    const first = productLinks(home, base, seen);
    const top = await visit(first[0] || "", 1);
    if (top) for (const link of productLinks(top, base, seen).slice(0, 3)) await visit(link, 2);
    for (const link of first.slice(1, 3)) await visit(link, 1);
    for (const level of [2, 1, 0]) for (const html of pages[level]) {
      for (const i of pageImages(html, base.href)) if (!found.has(i.url)) found.set(i.url, i.alt);
    }
  } catch (err) {
    console.error("reading the website: " + (err as Error).message);
  }
  const kept: string[] = [];
  const tries = [...found.keys()].slice(0, 30);
  // A few at a time, so a slow site still gives something inside the budget.
  for (let i = 0; i < tries.length && kept.length < SITE_MAX && left() > 1500; i += 5) {
    await Promise.all(tries.slice(i, i + 5).map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, Math.min(6000, left()))) });
        const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ext = ({ "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[type];
        if (!res.ok || !ext) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Too small to be a product photo (icons, thumbnails), or too big to keep.
        if (bytes.length < 25_000 || bytes.length > 8 * 1024 * 1024 || kept.length >= SITE_MAX) return;
        // The site's own file name often names the product ("bakina-pita-visnja").
        const slug = decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
          .replace(/\.[a-z0-9]+$/i, "").replace(/-(min|scaled|\d+x\d+)$/i, "")
          .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "photo";
        const name = `${Date.now()}${kept.length}-${slug}.${ext}`;
        kept.push(name);
        const up = await db.storage.from(BRAND_BUCKET).upload(`${folder}/${name}`, bytes, { contentType: ext === "jpg" ? "image/jpeg" : type, upsert: true });
        if (up.error) kept.splice(kept.indexOf(name), 1);
      } catch { /* skip this one */ }
    }));
  }
  // Only a read that found something replaces last time's photos.
  if (kept.length && old.length) await db.storage.from(BRAND_BUCKET).remove(old.map((f) => `${folder}/${f.name}`));
  console.log(`website ${base.hostname}: ${found.size} pictures seen, ${kept.length} kept`);
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

function briefText(p: Profile, look: BrandLook, week: string, days: string[], weather: string[] | null, dates: string[], liked: string[]) {
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
    lookText(look, serbian(p)),
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
/* The brand look. Each business gets its own way its ads look - a      */
/* photo style, a font pair, its colours, a voice and the layouts that   */
/* suit it - chosen once from its logo, photos and brief and kept in     */
/* profiles.brand_look, so its ads look like its own week after week     */
/* and two businesses in the same town don't look like the same agency.  */
/* It is made again only when the logo, colours, vibe or type change.    */
/* ------------------------------------------------------------------ */

const PHOTO_STYLES: Record<string, { label: string; brief: string }> = {
  bright_airy: { label: "Svetlo i prozračno",
    brief: "Bright and airy: soft diffused daylight, white and pale surfaces (light marble, white linen, pale wood), lots of clean space, gentle pastel tones, light soft shadows." },
  warm_rustic: { label: "Toplo i rustično",
    brief: "Warm and rustic: warm wood, stone, linen and earthenware, golden late-afternoon window light from the side, rich earthy browns, creams and terracotta." },
  dark_moody: { label: "Tamno i dramatično",
    brief: "Dark and moody: deep dark backgrounds (slate, dark wood, charcoal), one low directional light, deep shadows and glowing highlights - chiaroscuro, like a fine-dining menu shoot." },
  clean_modern: { label: "Čisto i moderno",
    brief: "Clean and modern: a seamless solid backdrop in one of the brand's colours or a soft neutral, crisp hard light with graphic shadows, one or two props at most, a design-magazine look." },
  bold_color: { label: "Jake boje",
    brief: "Bold and colourful: saturated colour-blocked backdrops in the brand's colours, a complementary second colour, bright hard light, cheerful and graphic, pop-art energy." },
  documentary: { label: "Pravo mesto, prirodno",
    brief: "Real and documentary: the real place as it is - the counter, the terrace, the window, the street outside - natural available light, candid and lived-in but tidy, a little film grain, like a good photographer's own Instagram rather than a studio." },
  fresh_natural: { label: "Sveže i prirodno",
    brief: "Fresh and natural: by a window or outdoors with green plants, raw fresh ingredients around the product, dappled daylight, greens and natural tones, crisp and healthy." },
  quiet_luxury: { label: "Tihi luksuz",
    brief: "Quiet luxury: travertine, stone and neutral linen, a soft window shadow falling across the set, very few objects, a lot of empty space, a muted refined palette." },
};

const VOICES: Record<string, { label: string; brief: string }> = {
  neighbourly: { label: "Komšijski i topao", brief: "warm and neighbourly - like the owner talking to a regular across the counter" },
  witty: { label: "Duhovit", brief: "light and witty - a small wink or a play on words, never forced" },
  refined: { label: "Elegantan i miran", brief: "calm and refined - few words, well chosen, nothing loud" },
  direct: { label: "Direktan", brief: "short and direct - what, when, where, no fuss" },
  youthful: { label: "Mladalački", brief: "young and casual - the way their younger customers text each other" },
  homely: { label: "Domaćinski", brief: "homely and traditional - like grandma's kitchen, proud of how things were always made" },
};

type BrandLook = {
  key: string;            // what it was made from; a change makes a new one
  made: "claude" | "practice";
  photo_style: string;
  photo_direction: string; // this business's own set, surfaces, props and light
  fonts: string;
  palette: string[];      // the brand's colours, the strongest first
  accent: string;
  paper: string;          // the light card's background
  paper_ink: string;      // the text on it
  voice: string;
  voice_notes: string;
  address: "ti" | "vi";   // Serbian: speaks to people as "ti" or "Vi"
  layouts: string[];
  summary: string;        // one line for the team
  at: string;
  tried?: string;         // when Claude last failed to make it
};

// What the look is made from. When this changes, the look is made again.
function lookKey(p: Profile, files: { kind: string; path: string }[]) {
  const logo = files.find((f) => f.kind === "logo")?.path.split("/").pop() || "";
  return [p.vertical, p.brand_vibe, p.brand_colors, logo].map((x) => String(x || "").trim().toLowerCase()).join("|");
}

// The other businesses of the same kind in the same town, and their looks, so
// a new look can be told apart from them.
async function neighbourLooks(p: Profile, userId: string) {
  if (!p.city) return [];
  const res = await db.from("profiles").select("id, city, vertical, brand_look")
    .neq("id", userId).not("brand_look", "is", null).limit(400);
  const here = cityKey(p.city);
  return (res.data || [])
    .filter((r) => cityKey(r.city || "") === here && r.brand_look)
    .sort((a, b) => Number(b.vertical === p.vertical) - Number(a.vertical === p.vertical))
    .slice(0, 12)
    .map((r) => ({ vertical: r.vertical, ...(r.brand_look as BrandLook) }));
}

function hashOf(s: string) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Colours written in the brief: hex codes, or plain colour words in Serbian and English.
const COLOUR_WORDS: [RegExp, string][] = [
  [/bordo|burgund|maroon|wine/, "#7A1F2B"], [/crven|red\b/, "#C8372D"], [/narand|orang/, "#E8742A"],
  [/žut|zut|yellow/, "#E9B526"], [/zlat|gold/, "#C9A045"], [/maslin|olive/, "#6B7A3A"],
  [/tamnozelen|dark green|forest/, "#1F4D3A"], [/zelen|green/, "#3E8E5A"], [/tirkiz|teal|turquo/, "#1F8A8A"],
  [/teget|navy/, "#1D2B4F"], [/plav|blue/, "#2F6FDE"], [/ljubič|ljubic|purple|violet|lila/, "#6E4BA8"],
  [/roze|pink|rozi/, "#E58BA8"], [/braon|smeđ|smedj|brown|čokolad|cokolad|chocolate|kafen/, "#6B4430"],
  [/bež|bez\b|beige|krem|cream/, "#E8DCC6"], [/crn|black/, "#1A1A1A"], [/bel[aoi]?\b|white/, "#FFFFFF"],
  [/siv|grey|gray/, "#7C7C7C"],
];

function briefColours(text: string | null | undefined) {
  const s = String(text || "").toLowerCase();
  const out: string[] = [];
  for (const m of s.matchAll(/#[0-9a-f]{6}\b/g)) out.push(m[0].toUpperCase());
  for (const [re, hex] of COLOUR_WORDS) if (re.test(s) && !out.includes(hex)) out.push(hex);
  return out;
}

// The colour to draw small touches in: the strongest colour that isn't
// nearly white, black or grey.
function vividOnes(palette: string[]) {
  return palette.filter((c) => {
    const [r, g, b] = rgb(c);
    return Math.max(r, g, b) - Math.min(r, g, b) > 40 && luma(c) > 40 && luma(c) < 225;
  });
}
function pickAccent(palette: string[]) {
  return vividOnes(palette)[0] || "#C9822B";
}

// The light card: a soft tint of the brand colour, or a deep one for a dark brand.
function cardColours(palette: string[], style: string) {
  const accent = pickAccent(palette);
  if (style === "dark_moody" || (style === "quiet_luxury" && luma(palette[0] || "#fff") < 60)) {
    const paper = mix(palette.find((c) => luma(c) < 70) || "#1A1714", "#000000", 0.2);
    return { paper, paper_ink: "#F7F2EA" };
  }
  return { paper: mix(accent, "#FFFFFF", 0.9), paper_ink: mix(accent, "#000000", 0.78) };
}

// Without a Claude key: a look picked by rule from the type of business, the
// brief's colours and words, and a hash of the account, steering clear of
// the neighbours' combinations.
function practiceLook(p: Profile, key: string, taken: { photo_style: string; fonts: string }[]): BrandLook {
  const text = `${p.vertical || ""} ${p.brand_vibe || ""} ${p.what_you_sell || ""}`.toLowerCase();
  const pick = (rules: [RegExp, string[]][], fallback: string[]) => {
    for (const [re, list] of rules) if (re.test(text)) return list;
    return fallback;
  };
  const styles = pick([
    [/luks|luxur|fine|elegan|vino|wine/, ["quiet_luxury", "dark_moody"]],
    [/grill|roštilj|rostilj|burger|pizza|street|brza|fast/, ["dark_moody", "bold_color", "documentary"]],
    [/sladoled|ice cream|slatk|candy|deč|dec|kids|bubble/, ["bold_color", "bright_airy"]],
    [/zdrav|health|juice|sok|vegan|salat|organ/, ["fresh_natural", "clean_modern", "bright_airy"]],
    [/pekar|bakery|hleb|bread|burek|pit[ae]|domać|domac|tradic|kafan/, ["warm_rustic", "documentary"]],
    [/torte|kolač|kolac|cake|poslast|patiss|pastry/, ["bright_airy", "quiet_luxury", "warm_rustic"]],
    [/kaf|coffee|café|cafe|kafić|kafic/, ["documentary", "warm_rustic", "clean_modern", "bright_airy"]],
    [/salon|frizer|beauty|kozmet|nail|barber|berber/, ["clean_modern", "quiet_luxury"]],
  ], Object.keys(PHOTO_STYLES));
  const pairs = pick([
    [/luks|luxur|fine|elegan|vino|wine/, ["elegant", "heritage"]],
    [/grill|roštilj|rostilj|burger|pizza|street|brza|fast|barber|berber/, ["bold", "modern"]],
    [/sladoled|ice cream|slatk|candy|deč|dec|kids|bubble/, ["playful", "handmade"]],
    [/zdrav|health|juice|sok|vegan|salat|organ|salon|beauty|gym|teretan/, ["modern", "elegant"]],
    [/pekar|bakery|hleb|bread|burek|pit[ae]|domać|domac|tradic|kafan/, ["traditional", "warm"]],
    [/torte|kolač|kolac|cake|poslast|patiss|pastry/, ["handmade", "elegant", "warm"]],
    [/kaf|coffee|café|cafe|kafić|kafic/, ["classic", "warm", "modern", "heritage"]],
  ], Object.keys(FONT_PAIRS));
  const h = hashOf(String(p.id || p.email || key));
  // The first combination, from this account's own starting point, that no neighbour has.
  let photo_style = styles[h % styles.length], fonts = pairs[(h >> 4) % pairs.length];
  outer: for (let i = 0; i < styles.length; i++) {
    for (let j = 0; j < pairs.length; j++) {
      const s = styles[(h + i) % styles.length], f = pairs[((h >> 4) + j) % pairs.length];
      if (!taken.some((t) => t.photo_style === s && t.fonts === f)) { photo_style = s; fonts = f; break outer; }
    }
  }
  const found = briefColours(p.brand_colors);
  const palette = found.length ? found.slice(0, 4) : [["#C9822B", "#2F6FDE", "#3E8E5A", "#C8372D", "#6E4BA8"][h % 5]];
  const voice = /luks|luxur|fine|elegan/.test(text) ? "refined"
    : /tradic|domać|domac|kafan|pekar|bakery/.test(text) ? "homely"
    : /mlad|young|student|street/.test(text) ? "youthful"
    : ["neighbourly", "witty", "direct"][(h >> 8) % 3];
  const all = DROP_LAYOUTS;
  const layouts = [all[h % 4], all[(h + 1) % 4], all[(h + 2) % 4]];
  return {
    key, made: "practice", photo_style, fonts,
    photo_direction: "", palette, accent: pickAccent(palette), ...cardColours(palette, photo_style),
    voice, voice_notes: "", address: "vi", layouts,
    summary: `${PHOTO_STYLES[photo_style].label}, ${FONT_PAIRS[fonts].label}, ${VOICES[voice].label.toLowerCase()} (practice)`,
    at: new Date().toISOString(),
  };
}

const LOOK_SYSTEM = `You are the art director of a small agency that makes the weekly social media ads for local businesses - cafés, bakeries, restaurants, shops, salons - in the Balkans. Before the first ad, you set each business's own look: the way all its ads will look and sound, week after week, so they feel like this business and nobody else.

Look hard at what you are given: the logo, the owner's photos of the place and the products, the photos from their website, the menu and the brief. The look must come from what is really there - the colours of the logo and the interior, the crockery they really use, the tiles, the wood, the light in the room, the kind of customer - not from what is usual for the type of business.

Choose:
- photo_style: the one photo style that suits this business best.
- photo_direction: 2-4 sentences for the photographer, specific to this business: the surfaces, the materials and the colours of their real place (as seen in their photos), the props that belong there, the light and the mood. Use it to make their photos unmistakably theirs. In English.
- fonts: the typeface pair that suits their logo and their character.
- palette: 2-4 hex colours of the brand, the strongest first - taken from the logo and the place itself (and the colours the brief names). Never invent colours that aren't theirs; a logo that is black on white gets black plus one colour of the place.
- accent: the one colour for small touches (a thin line, an arrow), from the palette - one that reads on a photo.
- paper and paper_ink: the light card the headline sometimes sits on (a soft tint that suits the brand, or a deep one for a dark brand) and the text colour on it, with strong contrast.
- voice and voice_notes: how the ads talk. voice_notes says in 1-2 sentences in English how they speak - the words they would use, how short, how playful - based on the brief, their website and menu.
- address: whether Serbian ads say "ti" or "Vi" to people. Young, casual, street places say "ti"; refined places, pharmacies, family restaurants and most others say "Vi".
- layouts: 2 or 3 of the text layouts that suit the brand.
- summary: one line in English for the team, naming what makes this look theirs.

Two businesses of the same kind in the same town must not look alike. You are told the looks the neighbours already have: give this business a different combination of photo style and fonts, and a clearly different feel, unless nothing else would fit it at all.`;

function lookSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["photo_style", "photo_direction", "fonts", "palette", "accent", "paper", "paper_ink", "voice", "voice_notes", "address", "layouts", "summary"],
    properties: {
      photo_style: { type: "string", enum: Object.keys(PHOTO_STYLES) },
      photo_direction: { type: "string" },
      fonts: { type: "string", enum: Object.keys(FONT_PAIRS) },
      palette: { type: "array", items: { type: "string", description: "Hex like #2F6FDE." } },
      accent: { type: "string", description: "Hex like #E8742A." },
      paper: { type: "string", description: "Hex." },
      paper_ink: { type: "string", description: "Hex." },
      voice: { type: "string", enum: Object.keys(VOICES) },
      voice_notes: { type: "string" },
      address: { type: "string", enum: ["ti", "vi"] },
      layouts: { type: "array", items: { type: "string", enum: DROP_LAYOUTS } },
      summary: { type: "string" },
    },
  };
}

// The look Claude chose, made safe: every value one the engine can draw.
function cleanLook(out: any, key: string, fallback: BrandLook): BrandLook {
  const hex = (x: any) => HEX.test(String(x || "")) ? String(x).toUpperCase() : null;
  const palette = (Array.isArray(out.palette) ? out.palette : []).map(hex).filter(Boolean).slice(0, 4) as string[];
  const pal = palette.length ? palette : fallback.palette;
  const style = PHOTO_STYLES[out.photo_style] ? out.photo_style : fallback.photo_style;
  const card = cardColours(pal, style);
  let paper = hex(out.paper) || card.paper, paperInk = hex(out.paper_ink) || card.paper_ink;
  if (Math.abs(luma(paper) - luma(paperInk)) < 110) { paper = card.paper; paperInk = card.paper_ink; }
  const layouts = [...new Set((Array.isArray(out.layouts) ? out.layouts : []).filter((l: string) => DROP_LAYOUTS.includes(l)))] as string[];
  return {
    key, made: "claude",
    photo_style: style,
    photo_direction: String(out.photo_direction || "").slice(0, 900),
    fonts: FONT_PAIRS[out.fonts] ? out.fonts : fallback.fonts,
    palette: pal,
    accent: hex(out.accent) || pickAccent(pal),
    paper, paper_ink: paperInk,
    voice: VOICES[out.voice] ? out.voice : fallback.voice,
    voice_notes: String(out.voice_notes || "").slice(0, 500),
    address: out.address === "ti" ? "ti" : "vi",
    layouts: layouts.length >= 2 ? layouts : fallback.layouts,
    summary: String(out.summary || "").slice(0, 300),
    at: new Date().toISOString(),
  };
}

// The business's look: the one kept on the profile while it still fits the
// brief, otherwise a new one (Claude's when there is a key, else by rule).
// files are the brand files already signed for this drop.
async function brandLook(p: Profile, userId: string, files: { kind: string; url: string; pdf: boolean; path: string }[], cost: Record<string, unknown>) {
  const key = lookKey(p, files);
  const held = p.brand_look as BrandLook | null;
  // A practice look is replaced by Claude's as soon as there is a key; one
  // Claude couldn't make waits a week before the next try.
  const waiting = held?.tried && Date.now() - new Date(held.tried).getTime() < 7 * 86400000;
  if (held && held.key === key && (held.made === "claude" || !claude || waiting)) return { look: held, made: false };
  const neighbours = await neighbourLooks(p, userId);
  const fallback = practiceLook(p, key, neighbours);
  let look = fallback, made = false;
  if (claude) {
    try {
      const content: any[] = [];
      for (const f of files) {
        content.push({ type: "text", text: f.kind === "logo" ? "Their logo:" : f.kind === "menu" ? "Their menu:" : f.kind === "site" ? "From their website:" : "The owner's own photo:" });
        content.push(f.pdf ? { type: "document", source: { type: "url", url: f.url }, title: "Menu" } : { type: "image", source: { type: "url", url: f.url } });
      }
      content.push({ type: "text", text: [
        `Business: ${p.business_name || "(no name)"}, a ${p.vertical || "local business"} in ${p.city || "(town not given)"}.`,
        `What they sell: ${p.what_you_sell || "(not given)"}`,
        p.typical_customer && `Typical customer: ${p.typical_customer}`,
        p.differentiator && `What makes them different: ${p.differentiator}`,
        p.brand_vibe && `The vibe the owner wants: ${p.brand_vibe}`,
        p.brand_colors && `The colours the owner named: ${p.brand_colors}`,
        p.website && `Website / Instagram: ${p.website}`,
        "",
        "Photo styles:", ...Object.entries(PHOTO_STYLES).map(([k, s]) => `- ${k}: ${s.brief}`),
        "", "Font pairs:", ...Object.entries(FONT_PAIRS).map(([k, s]) => `- ${k}: ${s.when}`),
        "", "Voices:", ...Object.entries(VOICES).map(([k, s]) => `- ${k}: ${s.brief}`),
        "", "Text layouts:", ...DROP_LAYOUTS.map((k) => `- ${k}: ${LAYOUTS[k].when}`),
        "",
        neighbours.length
          ? "Looks other businesses in the same town already have (the same kind first) - make this one different:\n" +
            neighbours.map((n) => `- a ${n.vertical || "business"}: ${n.photo_style}, ${n.fonts}, ${n.voice}, colours ${(n.palette || []).join(" ")}`).join("\n")
          : "No other business in this town has a look yet.",
      ].filter((x) => typeof x === "string").join("\n") });
      const out = await askClaude({ system: LOOK_SYSTEM, content, schema: lookSchema(), effort: "medium", maxTokens: 6000, cost, step: "copy" });
      look = cleanLook(out, key, fallback);
      made = true;
    } catch (err) {
      // The ads still go out this week, in the look made by rule; Claude's is tried next week.
      console.error("brand look: " + (err as Error).message);
      look = { ...fallback, tried: new Date().toISOString() };
    }
  }
  const res = await db.from("profiles").update({ brand_look: look }).eq("id", userId);
  // Not saved (the column isn't there yet): use it for this drop and go on to
  // the ads in the same call, so it isn't paid for again on every call.
  if (res.error) { console.error("brand look not saved: " + res.error.message); made = false; }
  return { look, made };
}

function lookText(look: BrandLook, sr: boolean) {
  return [
    "## The brand look (keep every ad inside it - it is what makes this business's ads its own)",
    `Photo style: ${PHOTO_STYLES[look.photo_style]?.brief || ""}`,
    look.photo_direction && `Their own set: ${look.photo_direction}`,
    `Voice: ${VOICES[look.voice]?.brief || ""}.${look.voice_notes ? " " + look.voice_notes : ""}`,
    sr ? `Speak to people as "${look.address === "ti" ? "ti" : "Vi"}"${look.address === "vi" ? " (with a capital V)" : ""} in every ad, the same way every time.` : null,
    `Brand colours: ${look.palette.join(", ")}.`,
  ].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* Claude.                                                              */
/* ------------------------------------------------------------------ */

const COPY_SYSTEM = `You write the weekly social media ads for one small local business - a café, a bakery, a restaurant, a shop - in the Balkans. The owner has no time for marketing: you are their marketer. Every Monday they get a handful of ads, swipe through them, and the ones they approve are posted for them.

What makes an ad work here:
- It is about this business and this week, never generic. Use the real products, the real street, the real opening hours, the weather on the day it posts, and the dates people care about.
- One idea per ad, said plainly, the way the owner would say it to a regular. Warm, specific, local. No marketing clichés, no hashtag walls, no "Discover", "Elevate", "Unleash".
- The words are written ON the picture by our design system, small and quiet, the way a good magazine ad or a café's own Instagram would do it - never like a news headline or a banner. The headline is a hook of 2-6 words that works at a glance in a feed: the specific product, the time, the weather or the reason ("Burek je vruć do 14h"), never a slogan or a mood. It never holds the street or the address; those go in the caption. The cta is a short quiet line: 2-4 words, one action tied to what this business really does (come, order, book, try) and, when it fits, to the day or the hour. "Call us" only where people really phone to order or book (a cake shop, a salon). Never repeat the headline in the cta, and never invent an offer, deadline or price for it.
- The caption is posted under the picture, so it adds what the picture can't say - the details, the hours, the street - in 1-4 short sentences, without repeating the headline or the cta. At most 3 hashtags, only when they help locally (the town, the street).
- The ads of one week differ from each other: a product up close, the place itself, a reason to come today, a date coming up, the people behind it, a habit worth starting.
- Respect every rule under "Never in these ads". The owner's own words there win.
- What the owner loved, approved, rewrote and turned down before is the best guide to what they want. Do more of what they loved, write the way they rewrote, avoid what they turned down and why.
- Never invent facts that matter: no prices, offers, discounts, awards or events the brief doesn't give. If the brief has no offer, the ad needs none.
- Write in the language the brief names. Serbian ads in the alphabet it names, with correct diacritics.

The image prompt is for a photo generator, in English. Write it the way a top advertising agency's art director briefs a commercial food and product photographer for a paid campaign: one specific, deliberate scene, never a general mood.
- The hero: name the exact item this ad is about (the burek, the flat white, the croissant with sour cherry) and make it the one clear focal point, filling a good part of the frame, fresh and at its very best - glossy where it should shine, golden where it should be baked, a full cup with clean foam, a just-poured juice.
- Every piece of food is whole, perfect and untouched. Nothing is bitten, torn, broken, squashed, crumbled or half-eaten; no bite marks, no ragged pieces. When the inside matters (the layers of a burek, the crumb of a loaf, the filling of a pastry), show it with one clean, precise knife cut next to the whole piece, the way a stylist would.
- The look: every image follows the business's own photo style and set under "The brand look" - its surfaces, materials, colours, props, light and mood. That look is what makes this business's ads recognisably its own and different from every other business's, so never fall back on a generic look (the same marble and linen for everyone). Inside it, vary the scene from ad to ad.
- The set: a styled, tidy, deliberate composition in that look, at most two or three props that belong with the product and the place, real plates, cups and glassware - never paper plates or plastic cups unless the business really serves takeaway.
- Nothing used, spilled or left over: no used napkins or tissues, no spills, drips or stains, no stray crumbs, no dirty dishes, no wrappers, no tea bag tags, no receipts, no phones, no clutter.
- Camera and light: name the angle (a low three-quarter hero angle, straight-on at table height, a clean overhead flat lay, a wider shot of the place), the lens look and the light - all as the photo style asks (a dark moody style gets one low hard light, a bright airy one soft daylight, a documentary one the light that is really there). Colours true and appetising, crisp texture detail, high-end magazine quality.
- It is still a real photograph of this real business: believable, not CGI, not plastic, not over-saturated, not a generic stock photo. Skip the clichés - a lone cup on a wooden table, a bokeh café, steam swirls - unless the ad is exactly that.
- If photos of the place or products were attached, describe what is really there so the picture looks like this business, and use the brand colours only where they fit naturally.
The generator makes up letters on anything that could carry print, and they come out as nonsense words (a cup that says "Laffe"). So say that every cup, glass, plate, bag, box and bottle is plain and unbranded with nothing printed on it, and keep menus, signs, boards, labels, packaging with writing, books, newspapers and screens out of the frame - except the real product from a reference photo, which keeps its own real packaging.
Leave one third of the frame calm - a soft wall, a table surface, a blurred background - because a few small words are laid over it, and put the subject in the rest of the frame. Say in text_position whether that calm third is at the top or at the bottom. Never ask the generator for text, letters, words, numbers, logos, menus, signs with writing or watermarks: the words are added afterwards. Avoid hands holding things up close and crowds of faces; they come out wrong.

product_photo: when the ad is about one product that is shown in one of the business's own photos (labelled P1, P2... above the brief - from their website or what they uploaded), give that label. The real photo then goes to the generator, which places that exact product into your scene, so it looks the same as in real life. Pick it only when the photo clearly shows that one product well and the ad is about it; otherwise leave it empty. With a product_photo, the image prompt describes the scene, the set, the light and the angle around "the product from the reference photo" - never re-describe the product's look, so the generator keeps it as it really is. Use the real product photos in most of the week's ads when they fit.
own_photo: the business's own photo used as the picture itself, with no generator at all - the realest ad there is. Give the label of one of the owner's uploaded photos (only those marked "uploaded by the owner") when it is sharp, well lit, well framed, shows the place, the people or the product at its best, and has a calm part for the words; then the image prompt is not used, so just describe the photo in it. Use one or two of the owner's own photos a week when they are that good, never a blurry, dark, cluttered or badly framed one, and never the same photo two weeks running. Leave it empty otherwise.

accent_color is the one small touch of colour in the layout (the arrow, a thin line), from the brand's colours.

The voice: every headline, cta and caption speaks in the brand's voice under "The brand look", and Serbian ads always say "ti" or "Vi" to people as it says.

Pick a posting time on one of the given days that suits the ad and the channel: breakfast and coffee in the morning, lunch around noon, evenings for dinner and going out, weekends for families - always inside the opening hours, never on a closed day. Spread the ads over the week.`;

// The layouts Claude picks from, read when the prompt is sent (they are defined further down).
function layoutGuide() {
  return "\n\nlayout is how the words sit on the picture. Pick, from the layouts this brand uses, the one that suits the ad, and give the ads of one week different layouts:\n" +
    DROP_LAYOUTS.map((k) => `- ${k}: ${LAYOUTS[k].when}`).join("\n");
}

function copySchema(channels: string[], days: string[], look: BrandLook, ownLabels: string[]) {
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
          required: ["channel", "format", "post_on", "post_time", "idea", "headline", "cta", "caption", "image_prompt", "text_position", "layout", "accent_color", "product_photo", "own_photo"],
          properties: {
            channel: { type: "string", enum: [...new Set(channels)] },
            format: { type: "string", enum: formats },
            post_on: { type: "string", enum: days },
            post_time: { type: "string", description: "HH:MM, 24-hour, local time." },
            idea: { type: "string", description: "Why this ad, this day - one line in English, for the team." },
            headline: { type: "string", description: "2-6 words, written on the picture." },
            cta: { type: "string", description: "The call to action: 2-4 words." },
            caption: { type: "string" },
            image_prompt: { type: "string" },
            text_position: { type: "string", enum: ["top", "bottom"], description: "Where the calm third of the picture is." },
            layout: { type: "string", enum: look.layouts, description: "How the words are laid out on the picture." },
            accent_color: { type: "string", enum: [...new Set([look.accent, ...vividOnes(look.palette)])] },
            product_photo: { type: "string", description: "P1, P2... or empty." },
            own_photo: { type: "string", enum: ["", ...ownLabels], description: "The owner's own photo used as the picture, or empty." },
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
  const who = await db.from("profiles")
    .select("id, plan, subscription_status, onboarded_at, engine_paused_at, business_name, what_you_sell")
    .ilike("email", email.trim()).maybeSingle();
  if (who.error || !who.data) return "No account with that email.";
  if (who.data.engine_paused_at) return "That account is paused in the portal's Costs view - resume it first.";
  // The same test as engine_due: signup's stamp, or the name and what it sells.
  const briefed = who.data.onboarded_at ||
    (String(who.data.business_name || "").trim() && String(who.data.what_you_sell || "").trim());
  if (!briefed) return "That account's brief has no business name or no \"what you sell\" yet.";
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
  // The business's own product photos Claude may put into an ad, by label.
  const refs = new Map<string, string>();
  // The owner's own photos that can be the picture itself (JPEG and PNG: the
  // renderer reads no WebP).
  const own: string[] = [];
  // Once per drop: fresh product photos from the business's website.
  if (claude && !written.length) await siteProducts(run.user_id, p.website).catch((e) => console.error("website: " + e.message));
  const files = await brandFiles(run.user_id);
  // The business's look, made once. A new one made by Claude takes a call of
  // its own; the week's ads are written on the next go, inside it.
  const { look, made } = await brandLook(p, run.user_id, files, cost);
  if (made) {
    await db.from("engine_runs").update({ locked_until: null }).eq("drop_id", run.drop_id);
    return;
  }
  if (claude) {
    const [weather, dates, liked] = await Promise.all([
      forecast(p, days), datesAhead(p, days), feedback(run.user_id, run.drop_id),
    ]);
    const content: any[] = [];
    for (const f of files) {
      if (f.kind === "photos" || f.kind === "site") {
        const label = `P${refs.size + 1}`;
        refs.set(label, f.path);
        if (f.kind === "photos" && /\.(jpe?g|png)$/i.test(f.path)) own.push(label);
        const named = f.kind === "site" ? f.path.split("/").pop()!.replace(/^\d+-|\.[a-z]+$/g, "") : "";
        content.push({ type: "text", text: `${label} - ${f.kind === "site" ? `from their website (file name "${named}")` : "uploaded by the owner"}:` });
      }
      content.push(f.pdf
        ? { type: "document", source: { type: "url", url: f.url }, title: "Menu" }
        : { type: "image", source: { type: "url", url: f.url } });
    }
    if (files.length) {
      content.push({ type: "text", text: `Above: the business's own ${[...new Set(files.map((f) => f.kind === "site" ? "photos from their website" : f.kind))].join(", ")} - look at what is really there and what they really sell.` +
        (refs.size ? ` P1-P${refs.size} can go into an ad as product_photo when one clearly shows the product the ad is about; a picture of the place, a person, a logo or a banner can't.` : "") });
    }
    content.push({ type: "text", text: briefText(p, look, drop.data.week_starting, days, weather, dates, liked), cache_control: { type: "ephemeral" } });
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
      system: COPY_SYSTEM + layoutGuide(), content, schema: copySchema(channels, days, look, own), effort: CLAUDE_EFFORT,
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
    const ownLabel = String(a.own_photo || "").trim().toUpperCase();
    const ownPath = own.includes(ownLabel) ? refs.get(ownLabel) || null : null;
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
      overlay: {
        name: String(p.business_name || "").slice(0, 60),
        cta: String(a.cta || "").slice(0, 40),
        position: a.text_position === "top" ? "top" : "bottom",
        layout: look.layouts.includes(a.layout) ? a.layout : look.layouts[(written.length + i) % look.layouts.length],
        accent: HEX.test(a.accent_color || "") ? a.accent_color : look.accent,
        // The business's look: its typefaces and the light card's colours.
        fonts: look.fonts, paper: look.paper, paper_ink: look.paper_ink,
        // The owner's own photo of the product, placed into the scene by the generator.
        ref: ownPath ? null : refs.get(String(a.product_photo || "").trim().toUpperCase()) || null,
        // The owner's own photo used as the picture itself, with no generator.
        own: ownPath,
      },
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
      "Authorization": `Key ${HF_KEY}`,
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
  // In the brand's own colour, so practice drops already show each business's look.
  const accent = HEX.test(job.overlay?.accent || "") ? job.overlay.accent : "#57405F";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(accent, "#000000", 0.75)}"/><stop offset="1" stop-color="${mix(accent, "#000000", 0.35)}"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="64" y="104" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="4" fill="#ffffff" fill-opacity="0.6">${escapeXml(job.channel.toUpperCase())} · ${escapeXml(job.format.toUpperCase())}</text>
${lines.map((l, i) => `<text x="64" y="${Math.round(top + i * 92)}" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700" fill="#ffffff">${escapeXml(l)}</text>`).join("\n")}
<text x="64" y="${height - 72}" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.55">PROBNA SLIKA · PRACTICE IMAGE</text>
</svg>`;
  return new TextEncoder().encode(svg);
}

/* ------------------------------------------------------------------ */
/* The words on the picture. Higgsfield makes a clean photo; the        */
/* headline, the call to action and the business's name are written     */
/* onto it here, so the spelling, the diacritics and the colours are     */
/* always right. Each ad gets one of a few quiet layouts, so a week's    */
/* ads don't all look the same.                                         */
/* ------------------------------------------------------------------ */

// --- overlay:start
// lab/ad-layouts.html runs this same block in the browser, so layouts can be
// tried on any photo without a drop. Keep it to fetch, btoa, Resvg and initWasm.

const OVERLAY_WASM = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const OVERLAY_FONT_CDN = "https://cdn.jsdelivr.net/npm/@expo-google-fonts";
// Static Google Fonts. Every one has Serbian Latin (č ć š ž đ) and Serbian
// Cyrillic (ђ ћ џ љ њ); checked October 2026.
const fontUrl = (pkg: string, file: string) => `${OVERLAY_FONT_CDN}/${pkg}@0.2.3/${file}.ttf`;
const OVERLAY_FONTS: Record<string, string> = {
  "Inter 600": fontUrl("inter", "Inter_600SemiBold"),
  "Inter 700": fontUrl("inter", "Inter_700Bold"),
  "Playfair 400i": fontUrl("playfair-display", "PlayfairDisplay_400Regular_Italic"),
  "Playfair 600": fontUrl("playfair-display", "PlayfairDisplay_600SemiBold"),
  "Manrope 500": fontUrl("manrope", "Manrope_500Medium"),
  "Manrope 600": fontUrl("manrope", "Manrope_600SemiBold"),
  "Manrope 700": fontUrl("manrope", "Manrope_700Bold"),
  "Manrope 800": fontUrl("manrope", "Manrope_800ExtraBold"),
  "Nunito 600": fontUrl("nunito", "Nunito_600SemiBold"),
  "Nunito 700": fontUrl("nunito", "Nunito_700Bold"),
  "Nunito 800": fontUrl("nunito", "Nunito_800ExtraBold"),
  "Lora 400i": fontUrl("lora", "Lora_400Regular_Italic"),
  "Lora 600": fontUrl("lora", "Lora_600SemiBold"),
  "Montserrat 500": fontUrl("montserrat", "Montserrat_500Medium"),
  "Montserrat 600": fontUrl("montserrat", "Montserrat_600SemiBold"),
  "Cormorant 500i": fontUrl("cormorant-garamond", "CormorantGaramond_500Medium_Italic"),
  "Cormorant 600": fontUrl("cormorant-garamond", "CormorantGaramond_600SemiBold"),
  "Rubik 500": fontUrl("rubik", "Rubik_500Medium"),
  "Rubik 600": fontUrl("rubik", "Rubik_600SemiBold"),
  "Oswald 500": fontUrl("oswald", "Oswald_500Medium"),
  "Oswald 600": fontUrl("oswald", "Oswald_600SemiBold"),
  "Comfortaa 700": fontUrl("comfortaa", "Comfortaa_700Bold"),
  "PT Sans 700": fontUrl("pt-sans", "PTSans_700Bold"),
  "PT Serif 400i": fontUrl("pt-serif", "PTSerif_400Regular_Italic"),
  "PT Serif 700": fontUrl("pt-serif", "PTSerif_700Bold"),
  "Raleway 600": fontUrl("raleway", "Raleway_600SemiBold"),
  "Raleway 700": fontUrl("raleway", "Raleway_700Bold"),
  "Caveat 600": fontUrl("caveat", "Caveat_600SemiBold"),
  "Caveat 700": fontUrl("caveat", "Caveat_700Bold"),
  "EB Garamond 500i": fontUrl("eb-garamond", "EBGaramond_500Medium_Italic"),
  "EB Garamond 600": fontUrl("eb-garamond", "EBGaramond_600SemiBold"),
};
const OVERLAY_WIDTH = 1080;

// cap is the height of a capital letter as a share of the size, read from the
// font file when it is loaded. scale makes a face that looks small at the same
// size (a script, a light Garamond) as big as the others.
type Face = { font: string; family: string; weight: number; italic?: boolean; cap: number; scale?: number };
// The roles a layout writes in: semi for small words (the name, the call to
// action, a quiet headline), bold for a punchy one, serif and italic for the
// display headline of the card and the magazine layouts.
type Role = "semi" | "bold" | "serif" | "italic";
const mkFace = (key: string, family: string, weight: number, extra: Partial<Face> = {}): Face =>
  ({ font: key, family, weight, cap: 0.72, ...extra });

// Each business gets one of these pairs and keeps it, so its ads look like its
// own, and two businesses side by side don't share a typeface.
const FONT_PAIRS: Record<string, { label: string; when: string; faces: Record<Role, Face> }> = {
  classic: {
    label: "Klasika (Inter + Playfair)",
    when: "a classic serif headline over a clean sans: cafés, patisseries, all-round places that want to feel good-looking and timeless",
    faces: { semi: mkFace("Inter 600", "Inter", 600), bold: mkFace("Inter 700", "Inter", 700),
      serif: mkFace("Playfair 600", "Playfair Display", 600), italic: mkFace("Playfair 400i", "Playfair Display", 400, { italic: true }) },
  },
  modern: {
    label: "Moderno (Manrope)",
    when: "one modern geometric sans for everything: specialty coffee, juice and health bars, salons, gyms, design shops",
    faces: { semi: mkFace("Manrope 600", "Manrope", 600), bold: mkFace("Manrope 800", "Manrope", 800),
      serif: mkFace("Manrope 700", "Manrope", 700), italic: mkFace("Manrope 500", "Manrope", 500) },
  },
  warm: {
    label: "Toplo (Nunito + Lora)",
    when: "a soft rounded sans with a warm bookish serif: family bakeries, pastry shops, breakfast places, neighbourhood cafés",
    faces: { semi: mkFace("Nunito 600", "Nunito", 600), bold: mkFace("Nunito 800", "Nunito", 800),
      serif: mkFace("Lora 600", "Lora", 600), italic: mkFace("Lora 400i", "Lora", 400, { italic: true }) },
  },
  elegant: {
    label: "Elegantno (Montserrat + Cormorant)",
    when: "a fine high-contrast serif with a wide sans: wine bars, fine dining, cake ateliers, florists, beauty",
    faces: { semi: mkFace("Montserrat 500", "Montserrat", 500), bold: mkFace("Montserrat 600", "Montserrat", 600),
      serif: mkFace("Cormorant 600", "Cormorant Garamond", 600, { scale: 1.16 }),
      italic: mkFace("Cormorant 500i", "Cormorant Garamond", 500, { italic: true, scale: 1.16 }) },
  },
  bold: {
    label: "Snažno (Rubik + Oswald)",
    when: "a tall condensed headline with a sturdy sans: burgers, grills, pizza, street food, sports bars, barbers",
    faces: { semi: mkFace("Rubik 500", "Rubik", 500), bold: mkFace("Rubik 600", "Rubik", 600),
      serif: mkFace("Oswald 600", "Oswald", 600, { scale: 1.08 }), italic: mkFace("Oswald 500", "Oswald", 500, { scale: 1.08 }) },
  },
  playful: {
    label: "Razigrano (Nunito + Comfortaa)",
    when: "round friendly letters: ice cream, sweets, kids' places, bubble tea, colourful and cheerful brands",
    faces: { semi: mkFace("Nunito 700", "Nunito", 700), bold: mkFace("Nunito 800", "Nunito", 800),
      serif: mkFace("Comfortaa 700", "Comfortaa", 700, { scale: 0.94 }), italic: mkFace("Comfortaa 700", "Comfortaa", 700, { scale: 0.94 }) },
  },
  traditional: {
    label: "Tradicionalno (PT Sans + PT Serif)",
    when: "a sturdy traditional serif: kafanas, bakeries with a long history, butchers, family restaurants, local produce",
    faces: { semi: mkFace("PT Sans 700", "PT Sans", 700), bold: mkFace("PT Sans 700", "PT Sans", 700),
      serif: mkFace("PT Serif 700", "PT Serif", 700), italic: mkFace("PT Serif 400i", "PT Serif", 400, { italic: true }) },
  },
  handmade: {
    label: "Ručno (Raleway + Caveat)",
    when: "a handwritten headline with a light sans: home-made cakes, small craft shops, cosy cafés, brunch places",
    faces: { semi: mkFace("Raleway 600", "Raleway", 600), bold: mkFace("Raleway 700", "Raleway", 700),
      serif: mkFace("Caveat 700", "Caveat", 700, { scale: 1.32 }), italic: mkFace("Caveat 600", "Caveat", 600, { scale: 1.32 }) },
  },
  heritage: {
    label: "Nasleđe (Manrope + EB Garamond)",
    when: "a classic book Garamond with a clean sans: delis, wine shops, old-town restaurants, bookshops, quiet premium places",
    faces: { semi: mkFace("Manrope 600", "Manrope", 600), bold: mkFace("Manrope 800", "Manrope", 800),
      serif: mkFace("EB Garamond 600", "EB Garamond", 600, { scale: 1.1 }),
      italic: mkFace("EB Garamond 500i", "EB Garamond", 500, { italic: true, scale: 1.1 }) },
  },
};
const DEFAULT_PAIR = "classic";

type Metrics = { upm: number; cap: number; advance: (cp: number) => number };
type LoadedFont = { bytes: Uint8Array; metrics: Metrics };

let overlayWasm: Promise<void> | null = null;
const overlayFonts = new Map<string, Promise<LoadedFont>>();

function overlayRenderer() {
  if (!overlayWasm) {
    overlayWasm = fetch(OVERLAY_WASM)
      .then((r) => { if (!r.ok) throw new Error("renderer " + r.status); return r.arrayBuffer(); })
      .then((buf) => initWasm(buf))
      .catch((err) => { overlayWasm = null; throw err; });
  }
  return overlayWasm;
}

function overlayFont(key: string) {
  let p = overlayFonts.get(key);
  if (!p) {
    p = fetch(OVERLAY_FONTS[key])
      .then((r) => { if (!r.ok) throw new Error("font " + r.status); return r.arrayBuffer(); })
      .then((buf) => { const bytes = new Uint8Array(buf); return { bytes, metrics: fontMetrics(bytes) }; });
    p.catch(() => overlayFonts.delete(key));
    overlayFonts.set(key, p);
  }
  return p;
}

// How wide each letter is, read straight from the font file (cmap + hmtx), so
// lines wrap and boxes fit the real text. Kerning is left out: a hair too wide.
function fontMetrics(bytes: Uint8Array): Metrics {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables: Record<string, number> = {};
  for (let i = 0, n = v.getUint16(4); i < n; i++) {
    const o = 12 + i * 16;
    tables[String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])] = v.getUint32(o + 8);
  }
  const upm = v.getUint16(tables.head + 18);
  const hMetrics = v.getUint16(tables.hhea + 34);
  const hmtx = tables.hmtx;
  const cmap = tables.cmap;
  let sub = 0, fmt = 0;
  for (let i = 0, n = v.getUint16(cmap + 2); i < n; i++) {
    const pid = v.getUint16(cmap + 4 + i * 8), eid = v.getUint16(cmap + 6 + i * 8);
    const at = cmap + v.getUint32(cmap + 8 + i * 8), f = v.getUint16(at);
    if (pid === 0 || (pid === 3 && (eid === 1 || eid === 10))) {
      if (f === 12 || (f === 4 && fmt !== 12)) { sub = at; fmt = f; }
    }
  }
  const glyph = (cp: number) => {
    if (fmt === 12) {
      for (let i = 0, n = v.getUint32(sub + 12); i < n; i++) {
        const g = sub + 16 + i * 12;
        const start = v.getUint32(g);
        if (cp >= start && cp <= v.getUint32(g + 4)) return v.getUint32(g + 8) + cp - start;
      }
    } else if (fmt === 4) {
      const seg2 = v.getUint16(sub + 6);
      const ends = sub + 14, starts = ends + seg2 + 2, deltas = starts + seg2, ranges = deltas + seg2;
      for (let i = 0; i < seg2; i += 2) {
        if (cp > v.getUint16(ends + i)) continue;
        const start = v.getUint16(starts + i);
        if (cp < start) return 0;
        const delta = v.getUint16(deltas + i), range = v.getUint16(ranges + i);
        if (!range) return (cp + delta) & 0xffff;
        const g = v.getUint16(ranges + i + range + 2 * (cp - start));
        return g ? (g + delta) & 0xffff : 0;
      }
    }
    return 0;
  };
  const seen = new Map<number, number>();
  // OS/2 version 2 and up says how tall a capital letter is.
  const os2 = tables["OS/2"];
  const capUnits = os2 && v.getUint16(os2) >= 2 ? v.getInt16(os2 + 88) : 0;
  return {
    upm,
    cap: capUnits > 0 ? capUnits / upm : 0.72,
    advance: (cp: number) => {
      let a = seen.get(cp);
      if (a === undefined) {
        a = v.getUint16(hmtx + 4 * Math.min(glyph(cp), hMetrics - 1));
        seen.set(cp, a);
      }
      return a;
    },
  };
}

function xml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[c]!));
}

function base64(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/* Colours */

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function luma(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function mix(hex: string, to: string, t: number) {
  const a = rgb(hex), b = rgb(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function inkOn(hex: string) {
  return luma(hex) > 150 ? "#17140F" : "#FFFFFF";
}
// The accent made bright enough to read on a dark photo, or deep enough on a light one.
function readable(hex: string, onDark: boolean) {
  let c = hex;
  for (let i = 0; i < 6; i++) {
    if (onDark ? luma(c) >= 150 : luma(c) <= 105) break;
    c = mix(c, onDark ? "#FFFFFF" : "#000000", 0.18);
  }
  return c;
}

/* Text */

type Ctx = {
  w: number; h: number; tall: boolean; margin: number; safeTop: number; safeBottom: number;
  top: boolean; dark: boolean; ink: string;
  headline: string; cta: string; name: string; accent: string;
  // The business's own typefaces, and the light card's paper and ink.
  f: Record<Role, Face>; paper: string; paperInk: string; muted: string;
  width: (face: Face, text: string, size: number, spacing?: number) => number;
};

function wrapText(c: Ctx, face: Face, text: string, size: number, maxW: number, spacing = 0) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last && c.width(face, last + " " + word, size, spacing) <= maxW) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}

// The biggest size from max down to min that fits in maxLines, with the lines
// evened out so no word is left alone on the last one.
function fitText(c: Ctx, face: Face, text: string, max: number, min: number, maxW: number, maxLines: number, spacing = 0) {
  const k = face.scale || 1;
  max = Math.round(max * k / 2) * 2; min = Math.round(min * k / 2) * 2;
  let size = min, lines = wrapText(c, face, text, min, maxW, spacing);
  for (let s = max; s >= min; s -= 2) {
    const l = wrapText(c, face, text, s, maxW, spacing);
    if (l.length <= maxLines && l.every((x) => c.width(face, x, s, spacing) <= maxW)) { size = s; lines = l; break; }
  }
  if (lines.length > 1) {
    for (let mw = maxW - 20; mw > maxW * 0.45; mw -= 20) {
      const l = wrapText(c, face, text, size, mw, spacing);
      if (l.length !== lines.length || l.some((x) => c.width(face, x, size, spacing) > mw)) break;
      lines = l;
    }
  }
  const widest = Math.max(...lines.map((x) => c.width(face, x, size, spacing)));
  return { size, lines, widest };
}

const r = (n: number) => Math.round(n * 10) / 10;

function textEl(face: Face, size: number, x: number, y: number, fill: string, body: string, extra = "") {
  return `<text x="${r(x)}" y="${r(y)}" font-family="${face.family}" font-weight="${face.weight}"${face.italic ? ` font-style="italic"` : ""} font-size="${size}" fill="${fill}"${extra}>${body}</text>`;
}

function linesEl(face: Face, size: number, lines: string[], x: number, firstBaseline: number, lineH: number, fill: string, extra = "") {
  return lines.map((l, i) => textEl(face, size, x, firstBaseline + i * lineH, fill, xml(l), extra)).join("\n");
}

const LIFT = ` filter="url(#lift)"`;

// A soft darkening from the edge the text sits on, only as tall as the text needs.
function shade(c: Ctx, height: number, strength: number) {
  const hgt = Math.min(c.h, Math.round(height));
  return c.top
    ? `<rect x="0" y="0" width="${c.w}" height="${hgt}" fill="url(#fadeDown)" opacity="${strength}"/>`
    : `<rect x="0" y="${c.h - hgt}" width="${c.w}" height="${hgt}" fill="url(#fadeUp)" opacity="${strength}"/>`;
}

// The call to action with a small drawn arrow after it (drawn, so it looks the
// same in every typeface - most of them have no arrow of their own).
function arrowCta(c: Ctx, face: Face, size: number, x: number, y: number, fill: string, arrow: string, extra = "") {
  const ax = x + c.width(face, c.cta, size) + size * 0.42, ay = y - size * face.cap * 0.5;
  const len = size * 0.78, head = size * 0.26, sw = Math.max(2, size * 0.085);
  const path = `<path d="M${r(ax)} ${r(ay)}H${r(ax + len)}M${r(ax + len - head)} ${r(ay - head)}L${r(ax + len)} ${r(ay)}L${r(ax + len - head)} ${r(ay + head)}" ` +
    `fill="none" stroke="${arrow}" stroke-width="${r(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  return textEl(face, size, x, y, fill, xml(c.cta), extra) + "\n" + path;
}
function arrowWidth(size: number) {
  return size * 1.2;
}

/* Layouts. Each one draws over a 1080-wide photo and returns the SVG on top. */

type Layout = {
  label: string;      // the name in the lab
  hint: string;       // when to use it, for the lab
  when: string;       // when to use it, for Claude
  roles: Role[];      // the typefaces it writes in
  draw: (c: Ctx) => string;
};

// A small headline and a quiet line under it, in a corner.
function drawQuiet(c: Ctx) {
  const face = c.f.semi;
  const head = fitText(c, face, c.headline, 50, 38, 640, 2);
  const lh = Math.round(head.size * 1.14);
  const headH = (head.lines.length - 1) * lh + head.size * face.cap;
  const ctaSize = 26, gap = c.cta ? 30 : 0, ctaH = c.cta ? ctaSize * face.cap : 0;
  const blockH = headH + gap + ctaH;
  const y0 = c.top ? c.safeTop + 6 : c.h - c.safeBottom - blockH;
  const lift = c.dark ? LIFT : "";
  const edge = c.top ? y0 + blockH : c.h - y0;
  return [
    c.dark ? shade(c, edge + 220, 0.45) : "",
    linesEl(face, head.size, head.lines, c.margin, y0 + head.size * face.cap, lh, c.ink, lift),
    c.cta ? arrowCta(c, c.f.semi, ctaSize, c.margin, y0 + headH + gap + ctaH, c.ink, readable(c.accent, c.dark), lift) : "",
  ].join("\n");
}

// A light card in a corner, like a label on a menu.
function drawCard(c: Ctx) {
  const pad = 44, inkC = c.paperInk, muted = c.muted;
  const maxText = Math.min(c.w * 0.62, 620) - pad * 2;
  const nameSize = 21, nameSp = 3.5, ctaSize = 28;
  const name = c.name.toUpperCase();
  const head = fitText(c, c.f.serif, c.headline, 46, 34, maxText, 2);
  const lh = Math.round(head.size * 1.16);
  const headH = (head.lines.length - 1) * lh + head.size * c.f.serif.cap;
  const nameW = name ? c.width(c.f.semi, name, nameSize, nameSp) : 0;
  const ctaW = c.cta ? c.width(c.f.semi, c.cta, ctaSize) + ctaSize * 0.42 + arrowWidth(ctaSize) : 0;
  const cardW = Math.max(320, Math.min(maxText, Math.max(head.widest, nameW, ctaW))) + pad * 2;
  const nameH = name ? nameSize * c.f.semi.cap + 26 : 0;
  const ctaH = c.cta ? 34 + ctaSize * c.f.semi.cap : 0;
  const cardH = pad + nameH + headH + ctaH + pad + 4;
  const x = c.margin, y = c.top ? c.safeTop : c.h - c.safeBottom - cardH;
  const tx = x + pad;
  let ty = y + pad;
  const out = [`<rect x="${x}" y="${r(y)}" width="${r(cardW)}" height="${r(cardH)}" rx="26" fill="${c.paper}" fill-opacity="0.92" filter="url(#float)"/>`];
  if (name) {
    out.push(textEl(c.f.semi, nameSize, tx, ty + nameSize * c.f.semi.cap, muted, xml(name), ` letter-spacing="${nameSp}"`));
    ty += nameH;
  }
  out.push(linesEl(c.f.serif, head.size, head.lines, tx, ty + head.size * c.f.serif.cap, lh, inkC));
  ty += headH;
  if (c.cta) out.push(arrowCta(c, c.f.semi, ctaSize, tx, ty + 34 + ctaSize * c.f.semi.cap, inkC, readable(c.accent, false)));
  return out.join("\n");
}

// Centred serif words, like a magazine page.
function drawEditorial(c: Ctx) {
  const cx = c.w / 2, mid = ` text-anchor="middle"`;
  const lift = c.dark ? LIFT : "";
  const name = c.name.toUpperCase(), nameSize = 22, nameSp = 6;
  const head = fitText(c, c.f.italic, c.headline, 62, 44, c.w * 0.74, 2);
  const lh = Math.round(head.size * 1.1);
  const headH = (head.lines.length - 1) * lh + head.size * c.f.italic.cap;
  const ctaSize = 24, ctaSp = 4.5;
  // Each part with the space under it.
  const parts: { h: number; gap: number; draw: (y: number) => string }[] = [];
  if (name) parts.push({ h: nameSize * c.f.semi.cap, gap: 30, draw: (y) => textEl(c.f.semi, nameSize, cx, y + nameSize * c.f.semi.cap, c.ink, xml(name), `${mid} letter-spacing="${nameSp}" fill-opacity="0.85"${lift}`) });
  parts.push({ h: headH, gap: 34, draw: (y) => linesEl(c.f.italic, head.size, head.lines, cx, y + head.size * c.f.italic.cap, lh, c.ink, mid + lift) });
  if (c.cta) {
    parts.push({ h: 2, gap: 30, draw: (y) => `<rect x="${cx - 32}" y="${r(y)}" width="64" height="2" fill="${readable(c.accent, c.dark)}"/>` });
    parts.push({ h: ctaSize * c.f.semi.cap, gap: 0, draw: (y) => textEl(c.f.semi, ctaSize, cx, y + ctaSize * c.f.semi.cap, c.ink, xml(c.cta.toUpperCase()), `${mid} letter-spacing="${ctaSp}"${lift}`) });
  }
  parts[parts.length - 1].gap = 0;
  const blockH = parts.reduce((s, p) => s + p.h + p.gap, 0);
  let y = c.top ? c.safeTop + 10 : c.h - c.safeBottom - blockH;
  const edge = c.top ? y + blockH : c.h - y;
  const out = [c.dark ? shade(c, edge + 260, 0.55) : ""];
  for (const p of parts) { out.push(p.draw(y)); y += p.h + p.gap; }
  return out.join("\n");
}

// A small coloured label with the headline, for short punchy news.
function drawTag(c: Ctx) {
  const face = c.f.bold, padX = 30, padY = 24;
  const head = fitText(c, face, c.headline, 42, 30, Math.min(c.w * 0.58, 600), 2);
  const lh = Math.round(head.size * 1.16);
  const boxW = head.widest + padX * 2;
  const boxH = (head.lines.length - 1) * lh + head.size * face.cap + padY * 2;
  const ctaSize = 28, ctaGap = 30, ctaH = c.cta ? ctaGap + ctaSize * c.f.semi.cap : 0;
  const x = c.margin, y = c.top ? c.safeTop : c.h - c.safeBottom - boxH - ctaH;
  const lift = c.dark ? LIFT : "";
  const edge = c.top ? y + boxH + ctaH : c.h - y;
  return [
    c.dark && c.cta ? shade(c, edge + 180, 0.4) : "",
    `<rect x="${x}" y="${r(y)}" width="${r(boxW)}" height="${r(boxH)}" rx="16" fill="${c.accent}"/>`,
    linesEl(face, head.size, head.lines, x + padX, y + padY + head.size * face.cap, lh, inkOn(c.accent)),
    c.cta ? arrowCta(c, c.f.semi, ctaSize, x + 4, y + boxH + ctaH, c.ink, c.ink, lift) : "",
  ].join("\n");
}

// A calm strip along the edge with the headline and a small button.
function drawBand(c: Ctx) {
  const inset = c.tall ? c.margin : 0;
  const barW = c.w - inset * 2, padX = c.tall ? 44 : c.margin, padY = c.tall ? 36 : 44;
  const bg = c.dark ? "#15120F" : c.paper, fg = c.dark ? "#FFFFFF" : c.paperInk;
  const ctaSize = 28, pillH = 68;
  const pillW = c.cta ? c.width(c.f.semi, c.cta, ctaSize) + 56 : 0;
  const name = c.name.toUpperCase(), nameSize = 20, nameSp = 3;
  const head = fitText(c, c.f.semi, c.headline, 40, 28, barW - padX * 2 - (c.cta ? pillW + 40 : 0), 2);
  const lh = Math.round(head.size * 1.18);
  const headH = (head.lines.length - 1) * lh + head.size * c.f.semi.cap;
  const nameH = name ? nameSize * c.f.semi.cap + 18 : 0;
  const contentH = Math.max(nameH + headH, c.cta ? pillH : 0);
  const barH = contentH + padY * 2;
  const y = c.top ? (c.tall ? c.safeTop : 0) : (c.tall ? c.h - c.safeBottom - barH : c.h - barH);
  const textTop = y + padY + (contentH - nameH - headH) / 2;
  const tx = inset + padX;
  const pillFill = readable(c.accent, c.dark);
  const out = [`<rect x="${inset}" y="${r(y)}" width="${barW}" height="${r(barH)}" rx="${c.tall ? 24 : 0}" fill="${bg}" fill-opacity="0.94"/>`];
  if (name) out.push(textEl(c.f.semi, nameSize, tx, textTop + nameSize * c.f.semi.cap, fg, xml(name), ` letter-spacing="${nameSp}" fill-opacity="0.55"`));
  out.push(linesEl(c.f.semi, head.size, head.lines, tx, textTop + nameH + head.size * c.f.semi.cap, lh, fg));
  if (c.cta) {
    const px = inset + barW - padX - pillW, py = y + padY + (contentH - pillH) / 2;
    out.push(`<rect x="${r(px)}" y="${r(py)}" width="${r(pillW)}" height="${pillH}" rx="${pillH / 2}" fill="${pillFill}"/>`);
    out.push(textEl(c.f.semi, ctaSize, px + pillW / 2, py + pillH / 2 + ctaSize * c.f.semi.cap / 2, inkOn(pillFill), xml(c.cta), ` text-anchor="middle"`));
  }
  return out.join("\n");
}

// One small spaced-out line and nothing else: the photo does the talking.
function drawSignature(c: Ctx) {
  const face = c.f.semi, sp = 6, cx = c.w / 2;
  const text = c.headline.toUpperCase();
  const head = fitText(c, face, text, 32, 24, c.w - c.margin * 2 - 40, 2, sp);
  const lh = Math.round(head.size * 1.7);
  const headH = (head.lines.length - 1) * lh + head.size * face.cap;
  const rule = 2, gap = 28, blockH = rule + gap + headH;
  const y0 = c.top ? c.safeTop + 10 : c.h - c.safeBottom - blockH;
  const lift = c.dark ? LIFT : "";
  const edge = c.top ? y0 + blockH : c.h - y0;
  return [
    c.dark ? shade(c, edge + 220, 0.45) : "",
    `<rect x="${cx - 20}" y="${r(y0)}" width="40" height="${rule}" fill="${readable(c.accent, c.dark)}"/>`,
    linesEl(face, head.size, head.lines, cx, y0 + rule + gap + head.size * face.cap, lh, c.ink, ` text-anchor="middle" letter-spacing="${sp}"${lift}`),
  ].join("\n");
}

// The first layout (October 2026), kept only to compare against in the lab.
function drawClassic(c: Ctx) {
  const face = c.f.bold, w = c.w, h = c.h;
  const head = fitText(c, face, c.headline, 108, 56, w - 144, 3);
  const size = head.size, lines = head.lines;
  const lineH = Math.round(size * 1.1);
  const headH = (lines.length - 1) * lineH + Math.round(size * 1.05);
  const bar = 8, barGap = 30, ctaGap = 46, pillH = 92, ctaSize = 40, m = 72;
  const safeTop = c.tall ? 270 : 72, safeBottom = c.tall ? 360 : 84;
  const groupH = bar + barGap + headH + (c.cta ? ctaGap + pillH : 0);
  const groupTop = c.top ? safeTop : h - safeBottom - groupH;
  const headTop = groupTop + bar + barGap;
  const pillW = Math.round(c.width(face, c.cta, ctaSize) + 96);
  const pillY = headTop + headH + ctaGap;
  const nameY = c.top ? h - safeBottom : safeTop - 14;
  return [
    c.top ? `<rect x="0" y="0" width="${w}" height="${Math.round(h * 0.62)}" fill="url(#fadeDown)" opacity="0.84"/>`
      : `<rect x="0" y="${Math.round(h * 0.38)}" width="${w}" height="${Math.round(h * 0.62)}" fill="url(#fadeUp)" opacity="0.84"/>`,
    `<rect x="${m}" y="${groupTop}" width="104" height="${bar}" rx="${bar / 2}" fill="${c.accent}"/>`,
    linesEl(face, size, lines, m, headTop + Math.round(size * 0.86), lineH, "#FFFFFF"),
    c.cta ? `<rect x="${m}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${c.accent}"/>` +
      textEl(face, ctaSize, m + pillW / 2, pillY + Math.round(pillH / 2 + ctaSize * 0.36), inkOn(c.accent), xml(c.cta), ` text-anchor="middle"`) : "",
    c.name ? textEl(face, 30, m, nameY, "#FFFFFF", xml(c.name.toUpperCase()), ` letter-spacing="5" fill-opacity="0.92"`) : "",
  ].join("\n");
}

const LAYOUTS: Record<string, Layout> = {
  quiet: {
    label: "Tiho", hint: "Mali naslov i diskretan poziv u uglu. Za svakodnevne razloge i navike.",
    when: "a small headline with a quiet call-to-action line in a corner - everyday reasons to come, habits, the hour of the day",
    roles: ["semi"], draw: drawQuiet,
  },
  card: {
    label: "Kartica", hint: "Svetla kartica u uglu, kao etiketa na meniju. Za proizvod izbliza.",
    when: "a small light card in a corner with a serif headline, like a menu label - one product up close, something new on the menu",
    roles: ["semi", "serif"], draw: drawCard,
  },
  editorial: {
    label: "Magazin", hint: "Centriran kurziv, kao stranica časopisa. Za ambijent, ljude i mesto.",
    when: "centred italic serif words like a magazine page - the place itself, the atmosphere, the people behind it, a special evening",
    roles: ["semi", "italic"], draw: drawEditorial,
  },
  tag: {
    label: "Etiketa (nije u dropu)", hint: "Mala obojena etiketa sa kratkom vešću. Vlasnik je odbio, nije u dropu.",
    when: "a small label in the accent colour holding a very short headline - news for today: the weather, the hour, fresh out of the oven",
    roles: ["semi", "bold"], draw: drawTag,
  },
  band: {
    label: "Traka (nije u dropu)", hint: "Traka uz ivicu sa dugmetom. Vlasnik je odbio, nije u dropu.",
    when: "a calm strip along the edge with the headline and a small button - a date coming up, an event, changed opening hours, booking",
    roles: ["semi"], draw: drawBand,
  },
  signature: {
    label: "Potpis", hint: "Samo jedan tih red, bez dugmeta. Kad slika sama sve kaže.",
    when: "one small spaced-out line and no button - when the photo says it all; the call to action stays in the caption",
    roles: ["semi"], draw: drawSignature,
  },
  classic: {
    label: "Stari (za poređenje)", hint: "Prvi layout iz oktobra. Nije u dropu.",
    when: "", roles: ["bold"], draw: drawClassic,
  },
};

// The layouts the drop picks from. The lab shows all of them.
// Only the quiet ones: the owner turned down big headlines, coloured labels and
// buttons (October 2026). "tag" and "band" stay in the lab for comparison.
const DROP_LAYOUTS = ["signature", "quiet", "editorial", "card"];

const OVERLAY_DEFS = `<linearGradient id="fadeUp" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.45" stop-color="#000" stop-opacity="0.62"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="fadeDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="0.45" stop-color="#000" stop-opacity="0.62"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<filter id="lift" x="-20%" y="-60%" width="140%" height="220%"><feDropShadow dx="0" dy="2" stdDeviation="9" flood-color="#000" flood-opacity="0.45"/></filter>
<filter id="float" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="22" flood-color="#000" flood-opacity="0.22"/></filter>`;

// Whether the part of the photo under the text is dark, from a tiny copy of it.
function zoneIsDark(href: string, w: number, h: number, top: boolean) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></svg>`;
  const rv = new Resvg(svg, { fitTo: { mode: "width", value: 36 }, font: { loadSystemFonts: false } });
  try {
    const img = rv.render();
    try {
      const px = img.pixels, pw = img.width, ph = img.height;
      const from = top ? 0 : Math.floor(ph * 0.62), to = top ? Math.ceil(ph * 0.38) : ph;
      let sum = 0, n = 0;
      for (let y = from; y < to; y++) {
        for (let x = 0; x < pw; x++) {
          const i = (y * pw + x) * 4;
          sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          n++;
        }
      }
      return n ? sum / n < 150 : true;
    } finally { img.free(); }
  } finally { rv.free(); }
}

type AdText = {
  headline: string; cta: string; name: string; accent: string;
  position: "top" | "bottom"; layout: string;
  photoTone?: "auto" | "dark" | "light";
  // The business's look: its font pair and the light card's colours.
  fonts?: string; paper?: string; paperInk?: string;
};

const HEX = /^#[0-9a-f]{6}$/i;

// The finished ad as a PNG.
async function renderAd(photo: Uint8Array, type: string, ratio: [number, number], t: AdText) {
  const layout = LAYOUTS[t.layout] || LAYOUTS[DROP_LAYOUTS[0]];
  const pair = FONT_PAIRS[t.fonts || ""] || FONT_PAIRS[DEFAULT_PAIR];
  await overlayRenderer();
  // Only the files this layout writes in, so the renderer parses as little as it can.
  const keys = [...new Set(layout.roles.map((role) => pair.faces[role].font))];
  const fonts = await Promise.all(keys.map(overlayFont));
  const metrics = new Map(keys.map((k, i) => [k, fonts[i].metrics] as [string, Metrics]));
  const f = {} as Record<Role, Face>;
  for (const role of Object.keys(pair.faces) as Role[]) {
    const m = metrics.get(pair.faces[role].font);
    f[role] = m ? { ...pair.faces[role], cap: m.cap } : pair.faces[role];
  }
  const paper = HEX.test(t.paper || "") ? t.paper! : "#FBF8F2";
  const paperInk = HEX.test(t.paperInk || "") && Math.abs(luma(t.paperInk!) - luma(paper)) > 110 ? t.paperInk! : inkOn(paper) === "#FFFFFF" ? "#FFFFFF" : "#1C1915";
  const w = OVERLAY_WIDTH;
  const h = Math.round((w * ratio[1]) / ratio[0]);
  const href = `data:${type};base64,${base64(photo)}`;
  const top = t.position === "top";
  const dark = t.photoTone === "dark" ? true : t.photoTone === "light" ? false : zoneIsDark(href, w, h, top);
  const tall = h / w > 1.7; // stories: keep clear of the app's own buttons
  const margin = 80;
  const c: Ctx = {
    w, h, tall, margin, top, dark,
    safeTop: tall ? 270 : margin, safeBottom: tall ? 380 : margin,
    ink: dark ? "#FFFFFF" : "#17140F",
    headline: t.headline.trim(), cta: t.cta.trim(), name: t.name.trim().slice(0, 40),
    accent: HEX.test(t.accent) ? t.accent : "#F5A524",
    f, paper, paperInk, muted: mix(paperInk, paper, 0.45),
    width: (face, text, size, spacing = 0) => {
      const m = metrics.get(face.font)!;
      let units = 0, n = 0;
      for (const ch of text) { units += m.advance(ch.codePointAt(0)!); n++; }
      return (units * size) / m.upm + spacing * Math.max(0, n - 1);
    },
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>${OVERLAY_DEFS}</defs>
<image href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
${layout.draw(c)}
</svg>`;
  const rv = new Resvg(svg, { font: { fontBuffers: fonts.map((x) => x.bytes), defaultFontFamily: pair.faces.semi.family, loadSystemFonts: false } });
  try {
    const img = rv.render();
    try { return img.asPng(); } finally { img.free(); }
  } finally { rv.free(); }
}
// --- overlay:end

// The finished ad for one job, or null when there is nothing to write on it.
async function composeAd(job: Job, photo: Uint8Array, type: string) {
  const headline = String(job.headline || "").trim();
  if (!headline) return null;
  const o = job.overlay || {};
  const [aw, ah] = String(job.aspect_ratio).split(":").map(Number);
  return await renderAd(photo, type, [aw || 4, ah || 5], {
    headline,
    cta: String(o.cta || ""),
    name: String(o.name || ""),
    accent: String(o.accent || ""),
    position: o.position === "top" ? "top" : "bottom",
    layout: DROP_LAYOUTS.includes(o.layout) ? o.layout : DROP_LAYOUTS[0],
    fonts: String(o.fonts || ""),
    paper: String(o.paper || ""),
    paperInk: String(o.paper_ink || ""),
  });
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

// The cheapest resolution of each model, and 3:4 where 4:5 isn't offered
// (none of these models offers it).
function hfBody(job: Job, refUrl: string | null = null) {
  const aspect_ratio = job.aspect_ratio === "4:5" ? "3:4" : job.aspect_ratio;
  if (refUrl) {
    return { prompt: REF_PREFIX + job.image_prompt, image_urls: [refUrl], aspect_ratio, resolution: "1k", enhance_prompt: false };
  }
  if (HF_MODEL.startsWith("marketing-studio/")) {
    return { prompt: job.image_prompt, aspect_ratio, resolution: "1k", enhance_prompt: false };
  }
  if (HF_MODEL.startsWith("higgsfield-ai/soul/")) {
    return { prompt: job.image_prompt, aspect_ratio, resolution: "720p", enhance_prompt: false, batch_size: 1 };
  }
  if (HF_MODEL.startsWith("z-image/")) {
    return { prompt: job.image_prompt, aspect_ratio, resolution: "1k" };
  }
  return { prompt: job.image_prompt, aspect_ratio, resolution: "1K", num_images: 1 };
}

// The owner's own photo as the picture: no generator, no cost, just the words
// drawn onto it. Returns false when it can't be used (removed since, or too
// big to draw in one call), and the ad is made by the generator instead.
const OWN_MAX_BYTES = 3_500_000;

async function ownPhoto(job: Job, attempts: number) {
  const path = String(job.overlay.own);
  const type = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
  const file = await db.storage.from(BRAND_BUCKET).download(path);
  if (file.error || !file.data || file.data.size > OWN_MAX_BYTES) return false;
  let bytes = new Uint8Array(await file.data.arrayBuffer());
  let outType = type, note: string | null = null;
  if (job.last_error === COMPOSE_MARK) {
    note = "Text not added to the picture: the function ran out of resources drawing it.";
  } else {
    await db.from("engine_jobs").update({ last_error: COMPOSE_MARK }).eq("id", job.id);
    try {
      const ad = await composeAd(job, bytes, type);
      if (ad) { bytes = ad; outType = "image/png"; }
    } catch (err) {
      note = "Text not added to the picture: " + (err as Error).message;
    }
  }
  const url = await store({ ...job, attempts }, bytes, outType);
  await updateJob(job, { attempts, image_url: url, status: claude ? "checking" : "ready", hf_request_id: null, last_error: note });
  return true;
}

// Returns true when it drew an ad (heavy: nothing more is drawn in this call).
async function submit(job: Job, log: Log) {
  const attempts = job.attempts + 1;
  if (job.overlay?.own) {
    if (await ownPhoto(job, attempts)) { log.submitted++; return true; }
    job = { ...job, overlay: { ...job.overlay, own: null } };
    await db.from("engine_jobs").update({ overlay: job.overlay }).eq("id", job.id);
  }
  if (!higgsfield) {
    const url = await store({ ...job, attempts }, practiceImage(job), "image/svg+xml");
    await updateJob(job, { attempts, image_url: url, status: claude ? "checking" : "ready" });
    log.submitted++;
    return;
  }
  let refUrl: string | null = null;
  if (job.overlay?.ref) {
    // Higgsfield fetches it while it works, so the link lives a day.
    const signed = await db.storage.from(BRAND_BUCKET).createSignedUrl(job.overlay.ref, 86400);
    refUrl = signed.data?.signedUrl || null;
    // The photo was removed since: the ad is made from the prompt alone.
    if (!refUrl) job = { ...job, overlay: { ...job.overlay, ref: null } };
  }
  const out = await hf(jobModel(job), {
    method: "POST",
    headers: { "Idempotency-Key": `${job.id}-${attempts}` },
    body: JSON.stringify(hfBody(job, refUrl)),
  });
  if (!out?.request_id) throw new Error("Higgsfield gave no request id.");
  await updateJob(job, {
    attempts, hf_request_id: out.request_id, submitted_at: new Date().toISOString(),
    status: "running", image_url: null, last_error: null, overlay: job.overlay,
  });
  log.submitted++;
}

// An ad built on the business's own product photo goes to Marketing Studio
// Image, which edits from a reference photo (Soul only takes text).
const REF_MODEL = "marketing-studio/image";
const REF_PREFIX = "Use the product in the reference image exactly as it really is: the same shape, size, colour, texture, " +
  "toppings, filling and packaging - do not redraw, restyle, improve or change the product, only light it to match the scene. " +
  "Make it the hero of a professional advertising photograph, whole and untouched, nothing bitten or broken. Leave out everything " +
  "else from the reference photo (its background, other items, any text or logos added on top of it). The scene: ";

function jobModel(job: Job) {
  return job.overlay?.ref ? REF_MODEL : HF_MODEL;
}

// Written onto a job just before its text is drawn, and cleared once the picture
// is stored. Still there on the next go means that call died drawing it.
const COMPOSE_MARK = "drawing the text";

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
  let type = (img.headers.get("content-type") || "image/png").split(";")[0].trim();
  let bytes = new Uint8Array(await img.arrayBuffer());
  let overlayError: string | null = null;
  if (job.last_error === COMPOSE_MARK) {
    // The last call died while drawing the text on this picture (out of CPU
    // or memory). Trying again would die the same way every 2 minutes, so the
    // plain photo goes out instead.
    overlayError = "Text not added to the picture: the function ran out of resources drawing it.";
  } else {
    await db.from("engine_jobs").update({ last_error: COMPOSE_MARK }).eq("id", job.id);
    try {
      // The headline and the button go onto the photo. If that fails the plain
      // photo still goes out; the reason is kept in last_error.
      const ad = await composeAd(job, bytes, type);
      if (ad) { bytes = ad; type = "image/png"; }
    } catch (err) {
      overlayError = "Text not added to the picture: " + (err as Error).message;
      console.error(overlayError);
    }
  }
  const url = await store(job, bytes, type);
  // Logged once the picture is safely ours, so a retried fetch isn't counted twice.
  await logCost({
    user_id: job.user_id, drop_id: job.drop_id, job_id: job.id, provider: "higgsfield", model: jobModel(job),
    step: "image", units: 1, cost_usd: HF_PRICE,
    note: HF_PRICE ? `request ${job.hf_request_id}` : `request ${job.hf_request_id}; price not set (HIGGSFIELD_USD_PER_IMAGE)`,
  });
  await updateJob(job, {
    image_url: url, status: claude ? "checking" : "ready", hf_request_id: null,
    last_error: overlayError ? overlayError.slice(0, 1000) : null,
  });
  return "done";
}

const CHECK_SYSTEM = `You check the pictures made for a small local business's social media ads before the owner sees them. Be the owner's critical eye: would they be glad to post this?

The picture is a finished ad: the headline, the call to action and sometimes the business's name were written onto the photo afterwards, and they are meant to be there. Read them: they must match the words you are given, be spelled right and be easy to read.

Then read every other piece of writing the photo itself shows - on cups, glasses, packaging, tea bag tags, signs, boards, menus, screens. The generator invents letters, and they come out as nonsense or near-words (a cup that says "Laffe" is neither "caffe" nor "latte"). Any writing in the photo that isn't ours scores at most 4; nonsense or misspelled words score at most 3. Name the exact words you see in problems. The one exception: when the business's own product photo is attached, the real product's own packaging and labels may show, as long as they match that photo.

It must look like a photo shot for the business's ad campaign by a professional - styled, tidy, the product fresh and at its best - not a snapshot by a passer-by. Every piece of food must be whole and untouched, or cut cleanly with a knife: a bitten, torn, broken, squashed or half-eaten item, bite marks, a used napkin or tissue, a spill or stain, stray crumbs, a half-drunk glass, dirty dishes, paper plates, wrappers, tea bag tags or clutter score at most 4.

When the business's own product photo is attached, the product in the ad must be that same product - same shape, colour, toppings, filling and packaging. A product that was changed, swapped or redrawn scores at most 4.

Score 1-10. Below ${PASS_SCORE} means it should be made again. Mark it down hard, too, for: the words hard to read or covering the main subject; warped hands, faces, food or objects; anything that breaks the business's rules; a photo that doesn't fit the business or the ad; a cheap stock-photo look; anything unappetising or unsafe. When it falls short, write a better prompt for the photo generator (a prompt for the photo only, never asking for text) that fixes what's wrong while keeping the idea, and says outright what to leave out (for example "a plain unbranded white cup with nothing printed on it", "a clean table with nothing else on it"). When the product photo is attached, the better prompt describes only the scene, the set, the light and the angle around "the product from the reference photo", never the product's own look.`;

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
    const refUrl = job.overlay?.ref
      ? (await db.storage.from(BRAND_BUCKET).createSignedUrl(job.overlay.ref, 3600)).data?.signedUrl || null
      : null;
    const out = await askClaude({
      system: CHECK_SYSTEM,
      content: [
        ...(refUrl ? [
          { type: "text", text: "The business's own photo of the product (the reference):" },
          { type: "image", source: { type: "url", url: refUrl } },
          { type: "text", text: "The ad to check:" },
        ] : []),
        { type: "image", source: { type: "url", url: job.image_url } },
        {
          type: "text",
          text: `Business: ${p.business_name || ""}, a ${p.vertical || "local business"} in ${p.city || "town"}. Sells: ${p.what_you_sell || ""}.` +
            `\nAd for ${job.channel} (${job.format}). Headline on the picture: "${job.headline}"` +
            (job.overlay?.cta ? `, call to action: "${job.overlay.cta}"` : "") +
            `. Caption under it: ${job.caption}` +
            `\nThe idea: ${job.idea || ""}` +
            (job.overlay?.own
              ? "\nThis is the business's own real photo, not a generated one: its real signs, labels, packaging and people are fine and are not marked down. Judge only whether it is good enough to post and whether our words read well on it."
              : `\nThe prompt that made it: ${job.image_prompt}`) +
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
  // The owner's own photo isn't made again: another go would be the same photo.
  if (score >= PASS_SCORE || job.overlay?.own) {
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
  const claimed = await db.rpc("engine_claim_jobs", { p_statuses: statuses, p_limit: 4, p_hold: 180 });
  if (claimed.error) throw new Error(claimed.error.message);
  const jobs: Job[] = claimed.data || [];
  const profiles = new Map<string, Profile>();
  let waiting = false;
  // Drawing the text onto a photo is heavy and a call has a small compute budget, so
  // only one finished picture is handled per call; the others are let go for the next.
  let heavy = false;
  for (const job of jobs) await (async () => {
    if (heavy) return void (await db.from("engine_jobs").update({ locked_until: null }).eq("id", job.id));
    try {
      if (job.status === "queued") {
        if (await submit(job, log)) heavy = true;
        else waiting = waiting || higgsfield;
      } else if (job.status === "running") {
        if (!higgsfield) return await updateJob(job, { status: "queued", hf_request_id: null });
        if ((await poll(job)) === "waiting") waiting = true; else heavy = true;
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
  })();
  return { worked: jobs.length > 0, waiting, heavy };
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
      // A call has about 2 seconds of CPU in all; drawing one ad's text uses most
      // of it. The next picture waits for the next call (2 minutes later).
      if (images.heavy) break;
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
