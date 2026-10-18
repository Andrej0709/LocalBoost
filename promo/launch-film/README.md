# Adronis launch film (54 s, 1920x1080, 60 fps)

`adronis-launch-film-en.mp4` and `adronis-launch-film-sr.mp4` are the finished cuts.
A keynote-style launch film: black stage, bold and thin Geist, the Adronis blue gradient,
words that rise out of a blur, and real Adronis screens.

| Time | Scene |
| --- | --- |
| 0–3 s | A tilted wall of real Adronis screens and ads, sinking into black |
| 3–7 s | "We make your ads. You just say yes." with the four networks and a row of ads |
| 7–13 s | "Tell us once. No meetings." — the brief being filled in |
| 13–17 s | Every Monday at 09:00 the drop lands: "Your drop is ready" |
| 17–19 s | "Every week, a new drop." over a blurred wall |
| 19–27 s | The counter rolls to **52** drops a year, with a ring and confetti |
| 27–33 s | "Your part: two minutes a week." — swiping the week's ads on a phone, then "All caught up." |
| 33–37 s | "Ads that fit your town's week." — the control room, scrolled to the Halloween card |
| 37–45 s | "To every café. pizzeria. salon. gym." |
| 45–49 s | "For keeping your street alive — thank you." |
| 49–54 s | Logo, "Beta starts early November.", adronis.vercel.app, confetti |

- **Facts only.** The milestone is the beta date from `PRODUCT.md`. The number on screen is
  52 drops a year (one every Monday), a product fact. No traffic, customer or usage numbers
  are shown, because none exist yet.
- **Real screens.** Everything in `assets/` is captured from the site itself
  (`tools/capture.js`, then `tools/prepare_assets.py`): landing cards, the demo approvals and
  control room, the example ads. The brief, the notification and the phone are rebuilt in
  HTML with the site's own copy (`Adronis.dc.html`, `approvals.html`, `i18n-sr.js`).
- **Music** is written in code (Web Audio, `OfflineAudioContext`) at 120 BPM in D major;
  every scene change lands on a downbeat; the big hits are 3.0 s (headline), 23.0 s (52) and 49.0 s (logo).

## Rebuild

```sh
cd promo/launch-film
node tools/render.js frames en /tmp/check 4,11.5,23.3,30,36   # a few stills to look at
node tools/render.js preview en /tmp/preview 30               # half-size frames, quick
node tools/render.js audio en /tmp/music.wav                  # the soundtrack alone
node tools/render.js film en /tmp/out/adronis-launch-film-en.mp4 4   # the finished film
```

`film` renders 3 subframes per frame (9720 for 54 s), pipes them straight into ffmpeg in
3-second chunks, blends each frame's subframes for motion blur, and joins the chunks with the
music (H.264 High, BT.709, AAC 320k). A stopped render resumes from the chunks already done.

To scrub by hand, serve this folder (`npx http-server .`), open `film.html?debug=1` at
1920x1080 and call `seek(t)` in the console; `?lang=sr` is the Serbian cut. Every frame is a
function of `t`, so any frame renders the same every time.

To refresh the screens: run the site locally (`npx http-server . -p 4321` from the repo root),
then `node tools/capture.js en <captures>/en <vendor>` (and `sr`), and
`python3 tools/prepare_assets.py <captures> assets`.

Font: Geist (SIL OFL, `fonts/LICENSE-Geist.txt`).
