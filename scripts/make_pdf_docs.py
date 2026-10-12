"""Test PDFs for PDF import: a 'digital' PDF with a real text layer (2 pages) and a scanned (image-only) PDF.
Synthetic; numbers and IBAN invented (IBAN has valid check digits)."""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
OUT = Path(__file__).resolve().parent.parent / "test-docs" / "pdf"; OUT.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
c = canvas.Canvas(str(OUT / "digital_inkasso_2pages.pdf"), pagesize=A4)
def lines(y, items, font="DV", size=11):
    for t in items:
        c.setFont(font, size); c.drawString(60, y, t); y -= 18
    return y
y = lines(790, ["Creditreform Inkasso GmbH", "Hammfelddamm 13, 41460 Neuss", "", "Neuss, 13.10.2026"])
y = lines(y - 20, ["Letzte Mahnung vor gerichtlichem Mahnverfahren"], "DVB", 14)
y = lines(y - 6, ["Aktenzeichen: INK-2026-004471", "Gläubiger: Vodafone GmbH", "", "Sehr geehrte Frau Okafor,",
                  "trotz unserer Zahlungserinnerung ist die folgende Forderung weiterhin offen.",
                  "Hauptforderung: 129,90 €", "Mahngebühren und Verzugszinsen: 56,50 €", "Gesamtforderung: 186,40 €"])
c.showPage()
y = lines(790, ["Seite 2", "", "Bitte zahlen Sie die Gesamtforderung bis zum 27.10.2026",
                "auf IBAN DE89 3704 0044 0532 0130 00 (Kontoinhaber: Creditreform Inkasso GmbH).",
                "Wenn Sie die Forderung bestreiten, teilen Sie uns dies bitte schriftlich mit.", "", "Mit freundlichen Grüßen"])
c.save()
Image.open(OUT.parent / "v1" / "de_rundfunkbeitrag.png").convert("RGB").save(OUT / "scan_rundfunkbeitrag.pdf", "PDF", resolution=150)
print("ok")
