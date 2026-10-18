"""Inline the font and the example ads into one self-contained HTML file.

    python3 promo/launch-video/build.py

Reads src/launch.src.html, writes adronis-launch.html next to this script.
The example ads (examples/*.jpg, 307x316) are upscaled 2x with Lanczos so the
swipe card stays sharp at film size.
"""
import base64
import io
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def data_uri(mime, raw):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(raw).decode('ascii'))


def font(name):
    with open(os.path.join(HERE, 'src', 'fonts', name), 'rb') as f:
        return data_uri('font/woff2', f.read())


def ad(name):
    im = Image.open(os.path.join(REPO, 'examples', name + '.jpg')).convert('RGB')
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=90, optimize=True)
    return data_uri('image/jpeg', buf.getvalue())


def main():
    with open(os.path.join(HERE, 'src', 'launch.src.html'), encoding='utf-8') as f:
        html = f.read()
    subs = {
        '__FONT_LATIN__': font('geist-latin.woff2'),
        '__FONT_LATINEXT__': font('geist-latin-ext.woff2'),
    }
    for k in ('pizza', 'bakery', 'cafe', 'salon', 'carwash', 'fitness'):
        subs['__IMG_%s__' % k.upper()] = ad(k)
    for key, val in subs.items():
        assert key in html, key
        html = html.replace(key, val)
    out = os.path.join(HERE, 'adronis-launch.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('wrote %s (%.0f KB)' % (out, os.path.getsize(out) / 1024))


if __name__ == '__main__':
    main()
