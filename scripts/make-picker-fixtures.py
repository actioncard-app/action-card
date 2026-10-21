# Picker test files (written to test-results/picker-fixtures, gitignored): the same letter as HEIC, a large JPEG,
# a PNG and an iPhone-style screenshot (1179x2556 with a status bar), all from test-docs/de_parking_ticket.png.
import os
from PIL import Image, ImageDraw
import pillow_heif
pillow_heif.register_heif_opener()
OUT = 'test-results/picker-fixtures'; os.makedirs(OUT, exist_ok=True)
src = Image.open('test-docs/de_parking_ticket.png').convert('RGB')
src.save(f'{OUT}/picked.heic', format='HEIF', quality=90)
big = src.resize((src.width * 4000 // max(src.size), src.height * 4000 // max(src.size)), Image.LANCZOS)
canvas = Image.new('RGB', (big.width + 400, big.height + 400), (205, 200, 190)); canvas.paste(big, (200, 200))
canvas.save(f'{OUT}/picked-large.jpg', quality=92)
src.save(f'{OUT}/picked.png')
shot = Image.new('RGB', (1179, 2556), (255, 255, 255))
d = ImageDraw.Draw(shot); d.rectangle([0, 0, 1179, 140], fill=(246, 246, 246)); d.text((60, 50), '9:41', fill=(0, 0, 0))
w = 1179 - 80; page = src.resize((w, src.height * w // src.width), Image.LANCZOS)
shot.paste(page, (40, 260)); shot.save(f'{OUT}/screenshot.png')
print('picker fixtures written to', OUT, {f: os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)})
