// Capture real Adronis interface pieces (element screenshots) for the launch film.
//
//   node capture.js <lang en|sr> <outdir> <vendor-dir>
//
// Serves nothing itself: expects the site on http://127.0.0.1:4321 (npx http-server . -p 4321).
// External CDNs (React, Supabase, Google Fonts) are answered from local copies in
// <vendor-dir>, because the build machine has no open internet.
const fs = require('fs');
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const BASE = 'http://127.0.0.1:4321';
const [lang = 'en', OUT = 'assets', V = '.'] = process.argv.slice(2);
const local = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': V + '/react-18.3.1/package/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': V + '/react-dom-18.3.1/package/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js': V + '/supabase-supabase-js-2.117.2/package/dist/umd/supabase.js',
};

async function route(page) {
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (url.startsWith(BASE)) return r.continue();
    if (local[url]) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(local[url]), headers: { 'access-control-allow-origin': '*' } });
    if (url.startsWith('https://fonts.googleapis.com/css2')) return r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(V + '/../fonts/geist.css', 'utf8'), headers: { 'access-control-allow-origin': '*' } });
    if (url.startsWith('https://fonts.gstatic.com/')) {
      const f = V + '/../fonts/' + url.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_');
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } });
    }
    return r.abort();
  });
}

async function open(browser, url, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: lang === 'sr' ? 'sr-RS' : 'en-US' }, opts || {}));
  await ctx.addInitScript((lg) => {
    try {
      localStorage.setItem('lb-consent', JSON.stringify({ v: 1, choice: 'all', at: new Date().toISOString() }));
      localStorage.setItem('lb-lang', lg);
    } catch (e) {}
  }, lang);
  const page = await ctx.newPage();
  await route(page);
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function revealAll(page) {
  // scroll through so scroll-revealed blocks settle, then back to the top
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(90); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

async function hideFixed(page) {
  // the sticky nav, language switch and feedback button float over content
  await page.evaluate(() => {
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    document.querySelectorAll('body *').forEach((e) => {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') e.style.setProperty('visibility', 'hidden', 'important');
    });
  });
}

async function shots(page, sel, name, max) {
  await hideFixed(page);
  const els = await page.$$(sel);
  let n = 0;
  for (const el of els.slice(0, max || els.length)) {
    try {
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(450);
      const b = await el.boundingBox();
      // clip by box: animated elements never count as "stable" for element screenshots
      await page.screenshot({ path: path.join(OUT, `${name}${n}.png`), clip: { x: b.x, y: b.y, width: b.width, height: b.height } });
      n++;
    } catch (e) { console.log('skip', name, n, e.message.split('\n')[0]); }
  }
  console.log(name, n);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch();

  // landing: hero at 2x, cards at 3x
  let o = await open(browser, '/Adronis.dc.html');
  await o.page.screenshot({ path: path.join(OUT, 'hero.png') });
  await o.ctx.close();
  o = await open(browser, '/Adronis.dc.html', { deviceScaleFactor: 3 });
  await revealAll(o.page);
  await shots(o.page, '.story', 'story');
  await shots(o.page, '.post', 'post');
  await shots(o.page, '.step', 'step');
  await o.page.evaluate(() => window.scrollTo(0, 0)); await o.page.waitForTimeout(600);
  await shots(o.page, 'lb-swipe .sw-card', 'swipe', 1);
  await o.ctx.close();

  // approvals demo
  o = await open(browser, '/approvals.html?demo=1', { deviceScaleFactor: 3 });
  await revealAll(o.page);
  await shots(o.page, '.creative-card', 'creative');
  await o.ctx.close();
  o = await open(browser, '/approvals.html?demo=1');
  await revealAll(o.page);
  await o.page.screenshot({ path: path.join(OUT, 'approvals_full.png'), fullPage: true });
  await o.ctx.close();

  // control room demo
  o = await open(browser, '/control-room.html?demo=1');
  await revealAll(o.page);
  await o.page.screenshot({ path: path.join(OUT, 'control_full.png'), fullPage: true });
  await o.ctx.close();

  // phone
  o = await open(browser, '/approvals.html?demo=1', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await revealAll(o.page);
  await o.page.screenshot({ path: path.join(OUT, 'approvals_mobile.png'), fullPage: true });
  await o.ctx.close();

  await browser.close();
})();
