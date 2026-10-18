# Adronis launch film (15 s, 1920x1080, 60 fps)

`adronis-launch-en.mp4` and `adronis-launch-sr.mp4` are the finished cuts.

- **Through-line object:** the blue slot dot (`#7cc6ff`) that marks when an ad goes out ("● MON 18:30").
  It strikes through the problem, becomes the brief field's focus ring, the "Drop ready" tile,
  the SCHEDULED pill, the dot on the swipe card, the full stop after "yes", and finally the logo.
- **Milestone:** "Beta starts early November." (from `PRODUCT.md`). No traffic or usage numbers exist yet, so none are shown.
- Every screen is rebuilt from the site's own CSS (`adronis.css`, `Adronis.dc.html`, `lb-swipe.js`)
  and copy (`i18n-sr.js` for the Serbian cut). The ads on screen are the site's `examples/`.

## Rebuild

```sh
python3 promo/launch-video/build.py                      # inline font + images -> adronis-launch.html
node promo/launch-video/render.js beats en /tmp/beats     # one frame per beat, to check
node promo/launch-video/render.js audio en /tmp/music.wav # soundtrack (OfflineAudioContext)
node promo/launch-video/render.js full en /tmp/frames 4   # 2700 subframes (60 fps x 3)
promo/launch-video/encode.sh /tmp/frames /tmp/music.wav promo/launch-video/adronis-launch-en.mp4
```

Open `adronis-launch.html?debug=1` in a 1920x1080 window and call `seek(t)` to scrub;
`?lang=sr` switches to the Serbian copy. All motion is a function of `t` (springs and
exponential easing), so any frame renders the same every time.

Source: `src/launch.src.html`. Font: Geist (SIL OFL, `src/fonts/LICENSE-Geist.txt`).
