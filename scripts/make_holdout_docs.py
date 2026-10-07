"""Second, harder 'holdout' set written AFTER the extractor was first built, to measure
generalisation honestly (different phrasing, harsher photo effects, US dates, no-deadline docs)."""
import json, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import importlib.util
spec = importlib.util.spec_from_file_location("base", Path(__file__).with_name("make_test_docs.py"))
OUT = Path(__file__).resolve().parent.parent / "test-docs"
random.seed(11)
F = "/usr/share/fonts/truetype/dejavu/"
NOTO = "/usr/share/fonts/truetype/sand-box/google/Noto Sans/NotoSans-VariableFont_wdth,wght.ttf"
def font(name, size):
    try: return ImageFont.truetype(name if name.startswith("/") else F + name, size)
    except Exception: return ImageFont.truetype(F + "DejaVuSans.ttf", size)
def page(w=1240, h=1754, bg=(250, 249, 245)):
    im = Image.new("RGB", (w, h), bg); return im, ImageDraw.Draw(im)
def write(d, x, y, lines, f, gap=1.45, fill=(25, 25, 25)):
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill); y += int(f.size * gap)
    return y
def perspective(im, k=0.06):
    w, h = im.size
    dx = int(w * k)
    # map output quad -> input (simple keystone)
    coeffs = find_coeffs([(0, 0), (w, 0), (w, h), (0, h)], [(dx, 0), (w - dx // 2, int(h*0.01)), (w, h), (0, h - int(h*0.02))])
    return im.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(110, 105, 100))
def find_coeffs(pa, pb):
    import numpy as np
    matrix = []
    for p1, p2 in zip(pa, pb):
        matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0]*p1[0], -p2[0]*p1[1]])
        matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1]*p1[0], -p2[1]*p1[1]])
    A = np.matrix(matrix, dtype=float); B = np.array(pb).reshape(8)
    res = np.dot(np.linalg.inv(A.T * A) * A.T, B)
    return np.array(res).reshape(8)
def phone(im, angle=1.5, blur=1.0, noise=14, scale=1.0, shadow=True):
    w, h = im.size
    if shadow:
        sh = Image.new("L", (w, h), 255); sd = ImageDraw.Draw(sh)
        sd.ellipse([int(w*0.55), int(-h*0.2), int(w*1.4), int(h*0.5)], fill=170)
        sh = sh.filter(ImageFilter.GaussianBlur(80))
        im = Image.composite(im, Image.new("RGB", (w, h), (70, 65, 60)), sh)
    im = perspective(im, 0.05)
    im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(110, 105, 100))
    if scale != 1.0:
        im = im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(blur))
    px = im.load()
    for _ in range(im.width * im.height // 10):
        x, y = random.randrange(im.width), random.randrange(im.height)
        r, g, b = px[x, y]; n = random.randint(-noise, noise)
        px[x, y] = (max(0, min(255, r+n)), max(0, min(255, g+n)), max(0, min(255, b+n)))
    return im

exp = json.loads((OUT / "expected.json").read_text())
for k in exp: exp[k].setdefault("set", "dev")

# H1 Spanish parking fine, phone photo, lower resolution
im, d = page(1100, 1450, (255, 255, 248))
d.text((60, 50), "AYUNTAMIENTO DE BARCELONA", font=font("DejaVuSans-Bold.ttf", 36), fill=(160, 0, 0))
d.text((60, 100), "Guàrdia Urbana - Boletín de denuncia", font=font("DejaVuSans.ttf", 26), fill=(20, 20, 20))
write(d, 60, 180, [
    "Expediente: 2026/0458812",
    "Matrícula: 4821 KLM",
    "Fecha de la denuncia: 21/09/2026  Hora: 18:40",
    "Lugar: Carrer de Mallorca, 401",
    "Hecho denunciado: Estacionar en zona de carga",
    "y descarga fuera del horario permitido.",
    "",
    "Importe de la multa: 200,00 €",
    "Con reducción del 50% por pronto pago: 100,00 €",
    "",
    "El pago con reducción podrá realizarse hasta el",
    "11 de octubre de 2026. Pasado este plazo deberá",
    "abonar el importe íntegro.",
], font("DejaVuSans.ttf", 28))
im = phone(im, angle=-2.2, blur=1.1, noise=16, scale=0.75)
im.save(OUT / "es_parking_fine_photo.jpg", quality=80)
exp["es_parking_fine_photo.jpg"] = dict(set="holdout", docLanguage="es", docType="parking_fine", deadline="2026-10-11",
    amount=100.00, currency="EUR", reference="2026/0458812",
    note="Harsh photo (perspective, shadow, 0.75x). Money at stake judged as the reduced early-payment amount 100 EUR payable by the deadline; 200 EUR full fine is also defensible - scored strictly against 100.")

# H2 Italian medicine label, Scad. format
im, d = page(1100, 700, (255, 255, 255))
d.rectangle([0, 0, 1100, 100], fill=(200, 30, 50))
d.text((30, 22), "IBUPROFENE 400 mg", font=font("DejaVuSans-Bold.ttf", 48), fill=(255, 255, 255))
write(d, 30, 130, [
    "12 compresse rivestite con film",
    "Medicinale di automedicazione - uso orale",
    "Posologia: adulti e ragazzi sopra i 12 anni:",
    "1 compressa 2-3 volte al giorno. Non superare",
    "la dose di 3 compresse al giorno.",
    "Leggere attentamente il foglio illustrativo.",
], font("DejaVuSans.ttf", 29))
d.text((30, 560), "Lotto: K7741", font=font("DejaVuSansMono.ttf", 28), fill=(0, 0, 0))
d.text((30, 610), "Scad.: 11/2027", font=font("DejaVuSansMono.ttf", 28), fill=(0, 0, 0))
im = phone(im, angle=3.0, blur=0.9, noise=12, shadow=False)
im.save(OUT / "it_medicine_label.jpg", quality=85)
exp["it_medicine_label.jpg"] = dict(set="holdout", docLanguage="it", docType="medicine_label", deadline="2027-11-30",
    amount=None, currency=None, reference=None, note="Expiry 'Scad.: 11/2027'. No price.")

# H3 English hotel email (US style, $ and US date)
im, d = page(1240, 1300, (255, 255, 255))
d.text((60, 50), "The Harbor View Hotel - Boston", font=font("DejaVuSans-Bold.ttf", 38), fill=(20, 60, 110))
write(d, 60, 140, [
    "Reservation confirmation #HV-883201",
    "",
    "Check-in: 11/20/2026   Check-out: 11/23/2026",
    "King room, 3 nights - Total: $687.00",
    "",
    "Cancellation policy:",
    "Free cancellation until 11/13/2026, 11:59 PM local time.",
    "Cancellations made after this date are subject to a",
    "cancellation fee of $229.00 (one night plus tax).",
    "",
    "We look forward to welcoming you.",
], font("DejaVuSans.ttf", 30))
im.save(OUT / "en_hotel_email.png")
exp["en_hotel_email.png"] = dict(set="holdout", docLanguage="en", docType="hotel_cancellation", deadline="2026-11-13",
    amount=229.00, currency="USD", reference="HV-883201", note="US mm/dd/yyyy dates with $.")

# H4 Portuguese rental (caução), deadline phrased 'no prazo de ... até'
im, d = page()
d.text((80, 80), "AUTO DE ENTREGA DO IMÓVEL", font=font("DejaVuSerif-Bold.ttf", 38), fill=(0, 0, 0))
write(d, 80, 170, [
    "Contrato de arrendamento n.º CA-1187/26",
    "Senhorio: Maria Antunes",
    "Imóvel: Rua da Bica Duarte Belo 12, 2.º Esq., Lisboa",
    "Data de entrega das chaves: 30/09/2026",
    "",
    "Renda mensal: 950,00 €",
    "Caução entregue: 1.900,00 €",
    "",
    "O arrendatário deve comunicar por escrito quaisquer",
    "anomalias não registadas neste auto, com fotografias,",
    "até 14 de outubro de 2026.",
    "",
    "Leituras: eletricidade 18233 / água 0412 / gás 0921",
], font("DejaVuSerif.ttf", 30))
im = phone(im, angle=1.0, blur=0.8, noise=10, shadow=True)
im.save(OUT / "pt_rental_photo.jpg", quality=85)
exp["pt_rental_photo.jpg"] = dict(set="holdout", docLanguage="pt", docType="rental_move_in", deadline="2026-10-14",
    amount=1900.00, currency="EUR", reference="CA-1187/26", note="Deposit = caução 1.900; rent 950 is a distractor.")

# H5 German hotel cancellation
im, d = page(1240, 1300)
d.text((60, 60), "Hotel Alpenblick Garmisch", font=font("DejaVuSans-Bold.ttf", 38), fill=(20, 20, 20))
write(d, 60, 150, [
    "Buchungsbestätigung",
    "Buchungsnummer: 55120-GA",
    "Anreise: 02.01.2027  Abreise: 06.01.2027",
    "Doppelzimmer, 4 Nächte, Gesamtpreis 912,00 EUR",
    "",
    "Stornierungsbedingungen:",
    "Eine kostenlose Stornierung ist bis zum 19.12.2026",
    "möglich. Danach berechnen wir eine Stornogebühr",
    "von 80 % des Gesamtpreises (729,60 EUR).",
], font("DejaVuSans.ttf", 30))
im = phone(im, angle=-1.0, blur=0.7, noise=10, shadow=False)
im.save(OUT / "de_hotel_storno.jpg", quality=85)
exp["de_hotel_storno.jpg"] = dict(set="holdout", docLanguage="de", docType="hotel_cancellation", deadline="2026-12-19",
    amount=729.60, currency="EUR", reference="55120-GA", note="Penalty given as % plus amount in parentheses.")

# H6 French airline cancellation, compact
im, d = page(1240, 1200, (255, 255, 255))
d.text((60, 50), "Air Lumière", font=font("DejaVuSans-Bold.ttf", 40), fill=(0, 70, 140))
write(d, 60, 140, [
    "Votre vol AL 731 Paris-Orly - Nice du 24/10/2026",
    "a été annulé.",
    "Référence de réservation : ZK4M9T",
    "",
    "Vous pouvez demander le remboursement de votre billet",
    "(184,90 €) ou un réacheminement sans frais.",
    "Merci de faire votre choix avant le 17/10/2026",
    "dans l'espace Mes réservations.",
], font("DejaVuSans.ttf", 30))
im.save(OUT / "fr_airline_cancellation.png")
exp["fr_airline_cancellation.png"] = dict(set="holdout", docLanguage="fr", docType="airline_cancellation", deadline="2026-10-17",
    amount=184.90, currency="EUR", reference="ZK4M9T", note="Flight date 24/10 is a distractor.")

# H7 Italian visa / permesso letter (no amount)
im, d = page()
d.text((80, 80), "QUESTURA DI MILANO", font=font("DejaVuSerif-Bold.ttf", 38), fill=(0, 0, 0))
d.text((80, 130), "Ufficio Immigrazione", font=font("DejaVuSerif.ttf", 28), fill=(20, 20, 20))
write(d, 80, 220, [
    "Oggetto: permesso di soggiorno per studio",
    "Pratica n. MI-26-071533",
    "",
    "Gentile richiedente,",
    "la informiamo che per completare la pratica deve",
    "presentarsi per il rilievo delle impronte digitali.",
    "L'appuntamento è fissato per il giorno 03/11/2026",
    "alle ore 9:15 presso via Fatebenefratelli 11.",
    "Porti con sé passaporto e ricevuta postale.",
], font("DejaVuSerif.ttf", 30))
im = phone(im, angle=0.6, blur=0.8, noise=10, shadow=True)
im.save(OUT / "it_permesso_letter.jpg", quality=85)
exp["it_permesso_letter.jpg"] = dict(set="holdout", docLanguage="it", docType="visa_entry", deadline="2026-11-03",
    amount=None, currency=None, reference="MI-26-071533", note="Only date is an appointment; no amount -> Not found expected.")

# H8 Unrelated document (restaurant receipt) -> unknown, no deadline
im, d = page(800, 1100, (255, 255, 255))
write(d, 60, 60, [
    "TRATTORIA DA MARIO",
    "Via Roma 21 - Bologna",
    "",
    "2 x Tagliatelle      24,00",
    "1 x Acqua             3,00",
    "1 x Vino rosso       18,00",
    "",
    "TOTALE EUR           45,00",
    "",
    "12/09/2026  20:41",
    "Grazie e arrivederci!",
], font("DejaVuSansMono.ttf", 30))
im.save(OUT / "it_receipt_unrelated.png")
exp["it_receipt_unrelated.png"] = dict(set="holdout", docLanguage="it", docType="unknown", deadline=None,
    amount=45.00, currency="EUR", reference=None, note="Out-of-scope doc: type should be unknown, no deadline (the date is not a deadline).")

(OUT / "expected.json").write_text(json.dumps(exp, indent=2, ensure_ascii=False))
print(len(exp), "docs total")
