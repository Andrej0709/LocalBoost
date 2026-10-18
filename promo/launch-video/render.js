// Render the Adronis launch film with Playwright.
//
//   node render.js frames <lang> <outdir> <t1,t2,...>   single frames at given times
//   node render.js beats  <lang> <outdir> [offset]       one frame per beat (t = beat + offset)
//   node render.js full   <lang> <outdir> [workers]      60 fps x 3 subframes = 180 PNG per second
//   node render.js audio  <lang> <out.wav>               the soundtrack, via OfflineAudioContext
//
// Every frame is window.seek(t) followed by a screenshot; nothing runs on a clock.
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const FILE = 'file://' + path.join(__dirname, 'adronis-launch.html');
const FPS = 60, SUB = 3, DUR = 15;

async function open(browser, lang) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(FILE + '?lang=' + lang + (process.env.DEBUG ? '&debug=1' : ''));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}

async function shoot(page, t, file) {
  await page.evaluate((tt) => window.seek(tt), t);
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

(async () => {
  const [mode, lang = 'en', out = 'out', extra] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  if (mode === 'audio') {
    const page = await open(browser, lang);
    const res = await page.evaluate(() => window.renderSoundtrack());
    fs.writeFileSync(out, Buffer.from(res.wav, 'base64'));
    console.log('wrote', out, 'raw peak', res.peak.toFixed(3));
  } else if (mode === 'frames' || mode === 'beats') {
    fs.mkdirSync(out, { recursive: true });
    const page = await open(browser, lang);
    let times;
    if (mode === 'frames') times = extra.split(',').map(Number);
    else { const off = extra ? Number(extra) : 0.42; times = Array.from({ length: 30 }, (_, i) => i * 0.5 + off); }
    for (const t of times) {
      const name = mode === 'beats' ? `beat${String(Math.round((t - (extra ? Number(extra) : 0.42)) / 0.5) + 1).padStart(2, '0')}.png` : `t${t.toFixed(3)}.png`;
      await shoot(page, t, path.join(out, name));
    }
    console.log('frames:', times.length);
  } else if (mode === 'full') {
    fs.mkdirSync(out, { recursive: true });
    const total = DUR * FPS * SUB;
    const workers = Number(extra || 4);
    const per = Math.ceil(total / workers);
    const t0 = Date.now();
    let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await open(browser, lang);
      for (let k = w * per; k < Math.min(total, (w + 1) * per); k++) {
        const file = path.join(out, `f_${String(k).padStart(5, '0')}.png`);
        if (fs.existsSync(file)) { done++; continue; }
        await shoot(page, k / (FPS * SUB), file);
        done++;
        if (done % 180 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }));
    console.log('done', total, 'subframes in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  await browser.close();
})();
