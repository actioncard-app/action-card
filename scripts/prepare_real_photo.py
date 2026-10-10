"""Prepare a REAL phone photo for the regression set in test-docs/real/ (privacy first).
- re-encodes the pixels only, so EXIF/GPS/device metadata is dropped
- blacks out any rectangles you list (names, addresses, plates, IBANs, signatures, faces, other apps on screen)
- optional crop and downscale (default longest side 2000 px)
Usage:
  python3 scripts/prepare_real_photo.py IN.jpg test-docs/real/de_letter_2026-10.jpg \
      --crop 0,200,1170,2400 --blur 100,300,700,360 --blur 120,900,600,950
Then add an entry to test-docs/real/expected.json, check the result image by eye, and run
  npm run build && npx vite preview --port 4173 &  DOCS=test-docs/real OUT=real node tests/ocr-accuracy.mjs
  cp test-results/ocr-text-real.json tests/fixtures/ocr-text-real.json   (cached OCR text for npm run test:rules:ci)
Only add photos of documents you are allowed to share; when in doubt, black it out."""
import argparse
from PIL import Image, ImageDraw, ImageOps

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--crop", help="x0,y0,x1,y1 in the original image (after EXIF rotation)")
ap.add_argument("--blur", action="append", default=[], help="x0,y0,x1,y1 to black out (repeatable; coordinates after crop)")
ap.add_argument("--max", type=int, default=2000, help="longest side in px")
a = ap.parse_args()
box = lambda s: tuple(int(v) for v in s.split(","))
im = ImageOps.exif_transpose(Image.open(a.src)).convert("RGB")  # apply camera rotation, then forget EXIF
if a.crop: im = im.crop(box(a.crop))
d = ImageDraw.Draw(im)
for b in a.blur: d.rectangle(box(b), fill=(0, 0, 0))
if max(im.size) > a.max:
    k = a.max / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
clean = Image.new("RGB", im.size); clean.putdata(list(im.getdata()))  # pixel copy: no metadata survives
clean.save(a.dst, quality=90)
print(f"wrote {a.dst} {clean.size[0]}x{clean.size[1]}, no EXIF, {len(a.blur)} region(s) blacked out")
