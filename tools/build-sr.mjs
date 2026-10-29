// Builds the Serbian copies of the public pages under /sr/.
//
// The site's copy lives in English in the markup and i18n.js swaps it to
// Serbian in the browser. Search engines crawl with English settings, so they
// only ever saw English. This writes a real Serbian page for each public page
// (sr/about.html, sr/index.html for the home page...), translated with the
// same dictionary (i18n-sr.js), with its own address, Serbian title and
// description, and hreflang links between the two languages.
//
// Anything the dictionary has no entry for stays English in the file; i18n.js
// still runs on the Serbian pages and fills in text that scripts build.
//
// Run after changing a public page or the dictionary:
//   node tools/build-sr.mjs
// It also adds the hreflang links to the English pages and rewrites
// sitemap.xml with both languages.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.adronis.app";

// English source -> Serbian file, with the Serbian title and description
// written for search (the dictionary's versions are written for the page).
const PAGES = [
  { src: "Adronis.dc.html", out: "index.html", en: "/", sr: "/sr/",
    title: "Adronis · Gotovi oglasi za kafiće, restorane i radnje",
    desc: "Svake nedelje dobiješ gotove oglase za Instagram i Facebook. Odobriš ih za dva minuta, Adronis ih objavi. Besplatna beta za ograničen broj lokala." },
  { src: "about.html",
    title: "O Adronisu · Oglasi za lokalni biznis bez agencije",
    desc: "Adronis je napravljen za vlasnike bez marketing tima: gotovi oglasi svake nedelje umesto agencije, sastanaka i kalendara objava koji niko ne popunjava." },
  { src: "beta.html",
    title: "Prijava za betu · Adronis",
    desc: "Adronis je u beti do javnog lansiranja u prvom kvartalu 2027. Mesta su ograničena, a svaku prijavu pregledamo." },
  { src: "calendar.html",
    title: "Kalendar praznika za objave · kafići i restorani",
    desc: "Svaki datum u narednih 12 meseci vredan oglasa za kafić, restoran ili radnju u Srbiji, sa idejom i terminom objave. Besplatno, bez registracije." },
  { src: "contact.html",
    title: "Kontakt prodaje · Adronis",
    desc: "Više lokala, neograničeno kanala ili poseban termin dropa? Opiši nam svoj biznis i javljamo se sa planom." },
  { src: "ai-disclosure.html",
    title: "Kako Adronis pravi oglase uz AI",
    desc: "Svaki Adronis oglas pravi AI, a objavljuje se tek kad ga ti odobriš. Šta mašina radi, šta proverava, gde greši i šta ostaje na tebi." },
  { src: "signup.html",
    title: "Napravi nalog · Adronis",
    desc: "Adronis je u beti do lansiranja u prvom kvartalu 2027. Napravi nalog i opiši svoj biznis. Prijava za betu je poseban korak, ništa se ne plaća." },
  { src: "login.html",
    title: "Prijava · Adronis",
    desc: "Prijavi se da vidiš ovonedeljni drop, odobriš oglase i upravljaš nalogom." },
  { src: "message-us.html",
    title: "Piši nam · Adronis",
    desc: "Pitanje o dropu, naplati ili opisu brenda? Pošalji ga ovde i odgovara ti čovek." },
  { src: "terms.html",
    title: "Uslovi korišćenja · Adronis",
    desc: "Uslovi koji važe za tvoju Adronis pretplatu, tvoje oglase i tvoj nalog." },
  { src: "privacy.html",
    title: "Politika privatnosti · Adronis",
    desc: "Šta Adronis prikuplja, zašto, s kim to deli, koliko dugo čuva i kako da tražiš brisanje." },
];
for (const p of PAGES) {
  p.out = p.out || p.src;
  p.en = p.en || "/" + p.src;
  p.sr = p.sr || "/sr/" + p.src;
}
const SR_PAGES = new Set(PAGES.map((p) => p.src));

// --- Dictionary (same file the browser uses) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "i18n-sr.js"), "utf8"), sandbox);
const DICT = sandbox.window.LB_I18N_SR.strings;
const PATTERNS = sandbox.window.LB_I18N_SR.patterns || [];

const norm = (s) => s.replace(/\s+/g, " ").trim();

function lookup(text) {
  const key = norm(text);
  if (!key) return null;
  const hit = DICT[key];
  if (typeof hit === "string" && hit) return hit;
  for (const [re, out] of PATTERNS) {
    const m = re.exec(key);
    if (!m) continue;
    return out.replace(/\$(\d)/g, (_, n) => {
      const g = m[Number(n)];
      if (g === undefined) return "";
      const inner = DICT[norm(g)];
      return typeof inner === "string" && inner ? inner : g;
    });
  }
  return null;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—",
  ndash: "–", hellip: "…", middot: "·", rarr: "→", larr: "←",
  times: "×", copy: "©", euro: "€", bull: "•", thinsp: " " };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

// --- Rewriting one page --------------------------------------------------------
const SKIP_BLOCK = /^<(script|style|noscript|template|code)\b/i;
const TOKEN = /<!--[\s\S]*?-->|<(script|style|noscript|template|code)\b[\s\S]*?<\/\1\s*>|<[^>]+>/gi;
const TEXT_ATTRS = ["placeholder", "aria-label", "title", "alt"];

function translateText(raw, stats) {
  const text = decode(raw);
  if (!norm(text) || !/[A-Za-z]/.test(text) || /\{\{/.test(text)) return raw;
  const hit = lookup(text);
  if (!hit) { stats.missed.push(norm(text)); return raw; }
  stats.hit++;
  const lead = /^\s*/.exec(raw)[0];
  const tail = /\s*$/.exec(raw)[0];
  return lead + escText(hit) + tail;
}

// A link to another page of the site, from a page that now lives under /sr/.
function srHref(href) {
  if (!href || /^(#|[a-z][a-z0-9+.-]*:|\/\/|\{\{|data:)/i.test(href)) return href;
  const m = /^\/?([^?#]*)(.*)$/.exec(href);
  const file = m[1], rest = m[2];
  if (file === "" ) return "/sr/" + rest;
  if (/\.html$/i.test(file)) return "/sr/" + file + rest;
  // Anything else (a stylesheet, script, image) is served from the root.
  return "/" + file.replace(/^\.\//, "") + rest;
}

function translateTag(tag, stats) {
  if (/^<\//.test(tag) || /^<!/.test(tag)) return tag;
  let out = tag.replace(/^<html\b([^>]*)\blang="en"/i, '<html$1lang="sr"');
  for (const name of TEXT_ATTRS) {
    out = out.replace(new RegExp('(\\s' + name + '=")([^"]*)(")', "i"), (m, a, v, b) => {
      const hit = /\{\{/.test(v) ? null : lookup(decode(v));
      if (hit) stats.hit++;
      return hit ? a + escAttr(hit) + b : m;
    });
  }
  // Page links and asset paths for a file under /sr/. Head links (canonical,
  // og) are set separately below.
  if (!/^<(link|meta)\b/i.test(out) || /rel="(stylesheet|preload|icon|apple-touch-icon|manifest|modulepreload)"/i.test(out)) {
    out = out.replace(/(\s(?:href|src)=")([^"]*)(")/gi, (m, a, v, b) => a + srHref(v) + b);
  }
  // Example ads have the words in the picture, made once per language.
  out = out.replace(/(examples\/ad-\d+)-en(\.jpg)/g, "$1-sr$2");
  return out;
}

function translateJsonLd(block) {
  return block.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/i, (m, a, json, b) => {
    let data;
    try { data = JSON.parse(json); } catch { return m; }
    const walk = (v, key) => {
      if (typeof v === "string") {
        if (key === "inLanguage") return "sr";
        if (/^(name|text|description)$/.test(key)) return lookup(v) || v;
        return v;
      }
      if (Array.isArray(v)) return v.map((x) => walk(x, key));
      if (v && typeof v === "object") {
        const o = {};
        for (const k of Object.keys(v)) o[k] = walk(v[k], k);
        return o;
      }
      return v;
    };
    return a + "\n" + JSON.stringify(walk(data, ""), null, 2) + "\n" + b;
  });
}

function hreflangLinks(p) {
  return [
    `<link rel="alternate" hreflang="en" href="${SITE}${p.en}">`,
    `<link rel="alternate" hreflang="sr" href="${SITE}${p.sr}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE}${p.en}">`,
  ].join("\n");
}

function setHead(html, p) {
  const set = (re, value, label) => {
    if (!re.test(html)) { if (label) console.warn(`  ${p.src}: no ${label}`); return; }
    html = html.replace(re, (m, a, v, b) => a + value + b);
  };
  set(/(<title>)([^<]*)(<\/title>)/i, escText(p.title), "title");
  set(/(<meta name="description" content=")([^"]*)(")/i, escAttr(p.desc), "description");
  set(/(<meta property="og:title" content=")([^"]*)(")/i, escAttr(p.title));
  set(/(<meta property="og:description" content=")([^"]*)(")/i, escAttr(p.desc));
  set(/(<meta name="twitter:title" content=")([^"]*)(")/i, escAttr(p.title));
  set(/(<meta name="twitter:description" content=")([^"]*)(")/i, escAttr(p.desc));
  set(/(<meta property="og:url" content=")([^"]*)(")/i, SITE + p.sr);
  set(/(<link rel="canonical" href=")([^"]*)(")/i, SITE + p.sr, "canonical");
  if (/<meta property="og:locale"/i.test(html)) {
    html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/i, "$1sr_RS$2");
  }
  return html;
}

function addHreflang(html, p) {
  html = html.replace(/\n?<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, "");
  return html.replace(/(<link rel="canonical" href="[^"]*">)/i, "$1\n" + hreflangLinks(p));
}

function buildPage(p) {
  const srcPath = path.join(ROOT, p.src);
  let html = fs.readFileSync(srcPath, "utf8");

  // The English page points at its Serbian twin.
  const enHtml = addHreflang(html, p);
  if (enHtml !== html) fs.writeFileSync(srcPath, enHtml);
  html = enHtml;

  const stats = { hit: 0, missed: [] };
  let out = html.replace(TOKEN, (tok) => "\u0000" + tok + "\u0000");
  out = out.split("\u0000").map((part, i) => {
    if (i % 2 === 0) return translateText(part, stats);
    if (/^<script type="application\/ld\+json">/i.test(part)) return translateJsonLd(part);
    if (SKIP_BLOCK.test(part)) {
      // Keep the block, but point its src at the root.
      return part.replace(/^<[^>]+>/, (open) => open.replace(/(\ssrc=")([^"]*)(")/i, (m, a, v, b) => a + srHref(v) + b));
    }
    if (/^<!--/.test(part)) return part;
    return translateTag(part, stats);
  }).join("");

  out = setHead(out, p);
  out = out.replace(/(<link rel="canonical" href="[^"]*">)\n<link rel="alternate"[\s\S]*?hreflang="x-default"[^>]*>/i,
    (m, c) => c + "\n" + hreflangLinks(p));

  const banner = `<!-- Generated by tools/build-sr.mjs from ${p.src}. Edit the English page or i18n-sr.js and re-run; changes here are overwritten. -->\n`;
  out = out.replace(/^(<!doctype html>\s*)/i, "$1" + banner);

  const outPath = path.join(ROOT, "sr", p.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out);

  const missed = [...new Set(stats.missed)];
  console.log(`sr/${p.out}: ${stats.hit} translated, ${missed.length} left in English`);
  for (const m of missed.slice(0, 12)) console.log("    - " + m.slice(0, 90));
  if (missed.length > 12) console.log(`    ... and ${missed.length - 12} more`);
}

// --- Sitemap ----------------------------------------------------------------------
function buildSitemap() {
  const file = path.join(ROOT, "sitemap.xml");
  const old = fs.readFileSync(file, "utf8");
  const meta = {};
  for (const m of old.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)) {
    meta[m[1]] = m[2].replace(/<xhtml:link[^>]*\/>/g, "").replace(/\s+/g, "");
  }
  const today = new Date().toISOString().slice(0, 10);
  const entry = (loc, p, fallback) => {
    const rest = meta[loc] || fallback;
    return `  <url><loc>${loc}</loc>${rest}` +
      `<xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/>` +
      `<xhtml:link rel="alternate" hreflang="sr" href="${SITE}${p.sr}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.en}"/></url>`;
  };
  const lines = [];
  for (const p of PAGES) {
    const enLoc = SITE + p.en;
    const base = meta[enLoc] || `<lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority>`;
    lines.push(entry(enLoc, p, base));
    lines.push(entry(SITE + p.sr, p, base.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`)));
  }
  fs.writeFileSync(file,
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    lines.join("\n") + "\n</urlset>\n");
  console.log(`sitemap.xml: ${lines.length} addresses`);
}

for (const p of PAGES) buildPage(p);
buildSitemap();
