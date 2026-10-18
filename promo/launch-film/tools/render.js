// Render the Adronis launch film (../film.html) with Playwright.
//
//   node render.js frames <lang> <outdir> <t1,t2,...>   single frames at given times
//   node render.js film   <lang> <out.mp4> [workers]     the finished film: 60 fps, 3 subframes per frame, music
//   node render.js preview <lang> <outdir> [fps]         quick half-size frames for checking motion
//   node render.js audio  <lang> <out.wav>               the soundtrack, via OfflineAudioContext
//
// Every frame is window.seek(t) followed by a screenshot; nothing runs on a clock.
// The page is served from disk under http://film.local/ so its web fonts load
// (Chromium refuses fonts over file://).
const path = require('path');
const fs = require('fs');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const { spawn } = require('child_process');

function run(cmd, args) {
  return new Promise((res, rej) => spawn(cmd, args, { stdio: 'inherit' }).on('close', (code) => (code === 0 ? res() : rej(new Error(cmd + ' exit ' + code)))));
}

const ROOT = path.join(__dirname, '..');
const BASE = 'http://film.local/';
const FPS = 60, SUB = 3;
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.js': 'application/javascript', '.css': 'text/css' };

async function open(browser, lang, scale) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale || 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.route('**/*', async (r) => {
    const url = new URL(r.request().url());
    if (url.host !== 'film.local') return r.abort();
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return r.fulfill({ status: 404, body: 'not found' });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + 'film.html?lang=' + lang + (process.env.DEBUG ? '&debug=1' : ''));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
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
  } else if (mode === 'frames') {
    fs.mkdirSync(out, { recursive: true });
    const page = await open(browser, lang);
    const times = extra.split(',').map(Number);
    for (const t of times) await shoot(page, t, path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`));
    console.log('frames:', times.length);
  } else if (mode === 'film') {
    // 60 fps, each frame the average of 3 subframes (motion blur). Subframes go
    // straight from the browser into ffmpeg, in 3-second chunks that can render in
    // parallel and resume after a crash; the chunks are then joined with the music.
    const work = out.replace(/\.mp4$/, '') + '.parts';
    fs.mkdirSync(work, { recursive: true });
    const probe = await open(browser, lang);
    const DUR = await probe.evaluate(() => window.__meta.duration);
    const wav = path.join(work, 'audio.wav');
    if (!fs.existsSync(wav)) {
      const res = await probe.evaluate(() => window.renderSoundtrack());
      fs.writeFileSync(wav, Buffer.from(res.wav, 'base64'));
    }
    await probe.close();
    const OUTF = DUR * FPS, CH = 180;
    const chunks = [];
    for (let c = 0; c * CH < OUTF; c++) chunks.push(c);
    const name = (c) => path.join(work, `c_${String(c).padStart(3, '0')}.mp4`);
    const queue = chunks.filter((c) => !fs.existsSync(name(c)));
    const t0 = Date.now();
    let done = chunks.length - queue.length;
    await Promise.all(Array.from({ length: Number(extra || 4) }, async () => {
      const page = await open(browser, lang);
      while (queue.length) {
        const c = queue.shift(), tmp = name(c) + '.tmp.mp4';
        const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'png', '-i', '-',
          '-vf', "tmix=frames=3:weights='1 1 1',select='eq(mod(n\\,3)\\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
          '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-threads', '2',
          '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
        const closed = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg exit ' + code)))));
        for (let k = c * CH * SUB; k < Math.min(OUTF, (c + 1) * CH) * SUB; k++) {
          await page.evaluate((tt) => window.seek(tt), k / (FPS * SUB));
          const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
          if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
        }
        ff.stdin.end();
        await closed;
        fs.renameSync(tmp, name(c));
        done++;
        console.log(`chunk ${c} (${done}/${chunks.length})  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }));
    const list = path.join(work, 'list.txt');
    fs.writeFileSync(list, chunks.map((c) => `file '${path.basename(name(c))}'`).join('\n') + '\n');
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out]);
    console.log('wrote', out, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  } else if (mode === 'preview') {
    fs.mkdirSync(out, { recursive: true });
    const fps = Number(extra || 30);
    const page = await open(browser, lang, 0.5);
    const DUR = await page.evaluate(() => window.__meta.duration);
    for (let k = 0; k < DUR * fps; k++) await shoot(page, k / fps, path.join(out, `p_${String(k).padStart(5, '0')}.png`));
    console.log('preview frames:', DUR * fps);
  } else {
    console.log('modes: frames | film | preview | audio');
  }
  await browser.close();
})();
