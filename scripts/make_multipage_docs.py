"""Two-page synthetic German traffic-fine letter for the multi-page tests (made up; no real person or case).
Page 1: authority, case number, offence. Page 2: amount and payment deadline. Usage: python3 scripts/make_multipage_docs.py"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
OUT = Path(__file__).resolve().parent.parent / "test-docs" / "multipage"
OUT.mkdir(parents=True, exist_ok=True)
F = "/usr/share/fonts/truetype/dejavu/"
def font(n, s): return ImageFont.truetype(F + n, s)
def page(lines, title=None, footer=""):
    im = Image.new("RGB", (1240, 1754), (252, 251, 248)); d = ImageDraw.Draw(im)
    y = 90
    if title:
        d.text((90, y), title, font=font("DejaVuSans-Bold.ttf", 40), fill=(20, 40, 90)); y += 90
    f = font("DejaVuSans.ttf", 32)
    for ln in lines:
        d.text((90, y), ln, font=f, fill=(25, 25, 25)); y += 50
    d.text((90, 1650), footer, font=font("DejaVuSans.ttf", 24), fill=(90, 90, 90))
    return im
p1 = page([
    "Stadt Musterhausen - Ordnungsamt",
    "Verkehrsüberwachung, Postfach 1234",
    "",
    "Anhörung im Verwarnungsverfahren",
    "Aktenzeichen: 731.22.904417.3",
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    "Ihnen wird vorgeworfen, am 02.10.2026 um 14:05 Uhr",
    "in der Bahnhofstraße 12 im eingeschränkten",
    "Halteverbot geparkt zu haben (Kennzeichen MH-AB 123).",
    "",
    "Die Höhe des Verwarnungsgeldes und die",
    "Zahlungsfrist finden Sie auf Seite 2.",
], title="Verwarnung mit Verwarnungsgeld", footer="Seite 1 von 2")
p2 = page([
    "Verwarnungsgeld: 55,00 €",
    "",
    "Bitte überweisen Sie den Betrag bis zum 30.10.2026",
    "unter Angabe des Aktenzeichens auf das Konto",
    "der Stadtkasse Musterhausen.",
    "",
    "Wenn Sie nicht fristgerecht zahlen, wird ein",
    "Bußgeldverfahren eingeleitet.",
    "",
    "Mit freundlichen Grüßen",
    "Ihr Ordnungsamt",
], footer="Seite 2 von 2")
p1.save(OUT / "de_fine_page1.jpg", quality=85)
p2.save(OUT / "de_fine_page2.jpg", quality=85)
(OUT / "expected.json").write_text(json.dumps({
    "pages": ["de_fine_page1.jpg", "de_fine_page2.jpg"],
    "page1_only": {"deadline": None, "amount": None, "reference": "731.22.904417.3"},
    "combined": {"docType": "parking_fine", "deadline": "2026-10-30", "amount": "55 EUR", "reference": "731.22.904417.3", "amount_page": 2, "reference_page": 1},
}, indent=2) + "\n")
print("wrote", OUT)
