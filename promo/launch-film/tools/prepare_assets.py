"""Turn the captured interface screenshots into the film's image assets.

    python3 prepare_assets.py <captures-dir> <out-dir>

<captures-dir>/<lang>/*.png come from capture.js. Writes <out-dir>/<lang>/*.jpg,
sized for how large each piece appears on screen, plus the site's example ads
(examples/*.jpg, upscaled 2x) shared by both languages.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

WIDTHS = {  # target pixel width per captured piece
    'post': 720, 'story': 660, 'creative': 600, 'step': 700, 'swipe': 660,
}


def save(im, path, q=90):
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)


def main(src, out):
    for lang in ('en', 'sr'):
        s, o = os.path.join(src, lang), os.path.join(out, lang)
        os.makedirs(o, exist_ok=True)
        for f in sorted(os.listdir(s)):
            name, ext = os.path.splitext(f)
            im = Image.open(os.path.join(s, f))
            kind = name.rstrip('0123456789')
            if kind in WIDTHS:
                w = WIDTHS[kind]
                im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
                save(im, os.path.join(o, name + '.jpg'))
            elif name == 'hero':
                save(im.resize((1920, 1200), Image.LANCZOS), os.path.join(o, 'hero.jpg'))
            elif name == 'control_full':
                # the page from its headline down to "Already live", without the footer
                w, h = im.size
                crop = im.crop((240, 330, 2640, h - 880))
                crop = crop.resize((1200, round(crop.height * 1200 / crop.width)), Image.LANCZOS)
                save(crop, os.path.join(o, 'control.jpg'))
        print(lang, sorted(os.listdir(o)))
    ex = os.path.join(out, 'ads')
    os.makedirs(ex, exist_ok=True)
    for k in ('pizza', 'bakery', 'cafe', 'salon', 'carwash', 'fitness'):
        im = Image.open(os.path.join(REPO, 'examples', k + '.jpg'))
        save(im.resize((im.width * 2, im.height * 2), Image.LANCZOS), os.path.join(ex, k + '.jpg'), 92)
    print('ads', sorted(os.listdir(ex)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
