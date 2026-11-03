#!/usr/bin/env python3
"""Letters for the amount regression e2e (tests/e2e-amounts.mjs): small print where OCR can drop the decimal point,
plus formats that must keep reading correctly. Writes test-docs/amounts/*.png (gitignored) and expected.json."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'test-docs' / 'amounts'
OUT.mkdir(parents=True, exist_ok=True)
FONTS = ['/usr/share/fonts/truetype/sand-box/google/Roboto/Roboto-VariableFont_wdth,wght.ttf',
         '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']

def font(size):
    for f in FONTS:
        try: return ImageFont.truetype(f, size)
        except OSError: pass
    raise SystemExit('no TrueType font found')

def letter(name, amount_line, size, extra=(), head=('CITY WATER & POWER', 'NOTICE OF PAST DUE BALANCE')):
    im = Image.new('L', (800, 1000), 255)
    d = ImageDraw.Draw(im)
    f = font(size)
    lines = [*head, '', 'Account: 000-000-0000 (SAMPLE)', 'Customer: Jane Sample',
             amount_line, 'Pay by: November 20, 2026', '', 'Pay online or call to avoid service interruption.', *extra]
    for i, t in enumerate(lines): d.text((60, 80 + i * 50), t, fill=0, font=f)
    im.save(OUT / name)

# expected: amount (number), currency, alt (other reading shown) or null
CASES = [
    ('small_8450_dot.png', 'Amount due: $84.50', 11, (), 84.5, 'USD', None),
    ('dollars_5.png', 'Amount due: $5.00', 16, (), 5.0, 'USD', None),
    ('dollars_1234_56.png', 'Amount due: $1,234.56', 16, (), 1234.56, 'USD', None),
    ('dollars_8450_00.png', 'Amount due: $8,450.00', 16, (), 8450.0, 'USD', None),
    ('euro_1234_56.png', 'Betrag: 1.234,56 €', 16, (), 1234.56, 'EUR', None),
    ('bare_84_50.png', 'Amount due: 84.50 USD', 16, (), 84.5, 'USD', None),
    # printed with no decimal point at all: never silently turned into cents; both readings shown
    ('nodot_8450.png', 'Amount due: $8450', 16, (), 8450.0, 'USD', 84.5),
    # cross-check: the previous balance line agrees with the cents reading
    ('crosscheck_8450.png', 'Amount due: $8450', 16, ('Previous balance: $84.50',), 84.5, 'USD', None),
]
exp = {}
for name, line, size, extra, amount, cur, alt in CASES:
    letter(name, line, size, extra)
    exp[name] = {'amount': amount, 'currency': cur, 'alt': alt}
# utility keywords and an amount with no currency symbol (Human Tester's letter-1234 / letter-nodollar)
letter('electric_1234_56.png', 'Amount due: $1,234.56', 16, (), ('KENTUCKY POWER CO.', 'Electric bill - October 2026'))
exp['electric_1234_56.png'] = {'amount': 1234.56, 'currency': 'USD', 'alt': None, 'type': 'utility'}
letter('nodollar_84_50.png', 'Total due: 84.50', 16, (), ('EAST KY GAS', 'Gas bill - October 2026'))
exp['nodollar_84_50.png'] = {'amount': 84.5, 'currency': '', 'alt': None, 'type': 'utility', 'conf': 'Check this'}
(OUT / 'expected.json').write_text(json.dumps(exp, indent=1) + '\n')
print(f'{len(exp)} letters in {OUT}')
