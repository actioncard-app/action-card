"""Generate realistic sample document images + expected fields JSON.

Each doc is rendered on an off-white page; a few are deliberately degraded
(rotation, blur, noise, uneven lighting) to mimic a phone photo.
"""
import json, random, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

OUT = Path(__file__).resolve().parent.parent / "test-docs"
OUT.mkdir(exist_ok=True)
random.seed(7)

F = "/usr/share/fonts/truetype/dejavu/"
def font(name, size):
    return ImageFont.truetype(F + name, size)

SANS, BOLD, SERIF, MONO = "DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSerif.ttf", "DejaVuSansMono.ttf"

def page(w=1240, h=1754, bg=(250, 249, 245)):
    im = Image.new("RGB", (w, h), bg)
    return im, ImageDraw.Draw(im)

def write(d, x, y, lines, f, gap=1.45, fill=(25, 25, 25)):
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill)
        y += int(f.size * gap)
    return y

def photo_effects(im, angle=1.2, blur=0.8, noise=10, shade=True):
    # uneven lighting
    if shade:
        w, h = im.size
        grad = Image.new("L", (w, h))
        gd = ImageDraw.Draw(grad)
        for i in range(h):
            v = int(255 - 55 * (i / h) ** 1.5)
            gd.line([(0, i), (w, i)], fill=v)
        dark = Image.new("RGB", (w, h), (90, 85, 80))
        im = Image.composite(im, dark, grad)
    im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(120, 115, 108))
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    if noise:
        px = im.load()
        w, h = im.size
        for _ in range(w * h // 12):
            x, y = random.randrange(w), random.randrange(h)
            r, g, b = px[x, y]
            n = random.randint(-noise, noise)
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return im

expected = {}

# 1. German parking ticket ----------------------------------------------------
im, d = page(1000, 1500, (255, 252, 230))
d.rectangle([40, 40, 960, 150], outline=(0, 0, 0), width=3)
d.text((60, 60), "Landeshauptstadt München", font=font(BOLD, 34), fill=(0, 0, 0))
d.text((60, 105), "Kreisverwaltungsreferat - Verkehrsüberwachung", font=font(SANS, 22), fill=(0, 0, 0))
y = write(d, 60, 190, ["Verwarnung mit Verwarnungsgeld"], font(BOLD, 36))
y = write(d, 60, y + 20, [
    "Aktenzeichen: 702.41.883915.6",
    "Kennzeichen: M-AB 4721",
    "Tatzeit: 28.09.2026, 14:35 Uhr",
    "Tatort: Leopoldstraße 112, 80802 München",
    "",
    "Sie parkten im eingeschränkten Halteverbot.",
    "§ 41 Abs. 1 iVm Anlage 2, § 49 StVO",
    "",
    "Verwarnungsgeld: 35,00 EUR",
    "",
    "Bitte überweisen Sie den Betrag bis zum",
    "19.10.2026 unter Angabe des Aktenzeichens.",
    "",
    "Empfänger: Stadtkasse München",
    "IBAN: DE12 7015 0000 0000 1234 56",
    "",
    "Wird das Verwarnungsgeld nicht fristgerecht",
    "bezahlt, wird ein Bußgeldverfahren eingeleitet.",
    "",
    "Ausgestellt am 28.09.2026, Dienstnummer 4471",
], font(SANS, 27))
expected["de_parking_ticket.png"] = dict(docLanguage="de", docType="parking_fine", deadline="2026-10-19",
    amount=35.00, currency="EUR", reference="702.41.883915.6",
    note="Clean scan. Distractor dates: Tatzeit and issue date 28.09.2026.")
im.save(OUT / "de_parking_ticket.png")

# 2. French medicine label (box side) ------------------------------------------
im, d = page(1200, 800, (255, 255, 255))
d.rectangle([0, 0, 1200, 110], fill=(0, 102, 153))
d.text((40, 25), "PARACÉTAMOL 500 mg", font=font(BOLD, 52), fill=(255, 255, 255))
y = write(d, 40, 140, [
    "Comprimés pelliculés - Boîte de 16",
    "Médicament - Voie orale",
    "",
    "Posologie : adultes et enfants de plus de 50 kg :",
    "1 à 2 comprimés par prise, à renouveler si besoin",
    "après 4 heures minimum. Ne pas dépasser 6 comprimés",
    "par jour. Lire attentivement la notice.",
    "",
    "Tenir hors de la vue et de la portée des enfants.",
], font(SANS, 30))
d.text((40, 650), "Lot : 4A21B", font=font(MONO, 30), fill=(0, 0, 0))
d.text((40, 700), "EXP : 03/2028", font=font(MONO, 30), fill=(0, 0, 0))
im = photo_effects(im, angle=-1.5, blur=0.6, noise=8)
im.save(OUT / "fr_medicine_label.jpg", quality=88)
expected["fr_medicine_label.jpg"] = dict(docLanguage="fr", docType="medicine_label", deadline="2028-03-31",
    amount=None, currency=None, reference=None,
    note="Phone-photo style (rotation, blur, shading). Expiry month/year => end of month. No price on the box: amount must be Not found.")

# 3. Spanish rental move-in sheet ----------------------------------------------
im, d = page()
d.text((80, 80), "ACTA DE ENTREGA DE LLAVES E INVENTARIO", font=font(BOLD, 38), fill=(0, 0, 0))
d.line([80, 135, 1160, 135], fill=(0, 0, 0), width=2)
y = write(d, 80, 170, [
    "Inmueble: Calle de Toledo 54, 3º B, 28005 Madrid",
    "Arrendador: Inmobiliaria Sol S.L.",
    "Arrendatario: ______________________",
    "Contrato n.º: ALQ-2026-0917",
    "",
    "Fecha de entrada: 01/10/2026",
    "Renta mensual: 850,00 €",
    "Fianza depositada: 1.700,00 €",
    "",
    "Estado de la vivienda (marcar):",
    "[ ] Cocina    [ ] Baño    [ ] Dormitorio    [ ] Salón",
    "",
    "El arrendatario dispone de un plazo para comunicar",
    "por escrito cualquier desperfecto no indicado en este",
    "inventario. Debe devolver esta hoja firmada antes del",
    "15 de octubre de 2026. En caso contrario se entenderá",
    "que acepta el estado de la vivienda y podrán",
    "descontarse daños de la fianza.",
    "",
    "Contadores: luz 004512 kWh  /  agua 00187 m³",
    "",
    "Firma arrendatario:                Firma arrendador:",
], font(SERIF, 30))
im.save(OUT / "es_rental_movein.png")
expected["es_rental_movein.png"] = dict(docLanguage="es", docType="rental_move_in", deadline="2026-10-15",
    amount=1700.00, currency="EUR", reference="ALQ-2026-0917",
    note="Money at stake = deposit (fianza), not monthly rent. Distractor: move-in date 01/10/2026.")

# 4. Italian hotel cancellation policy ----------------------------------------
im, d = page(1240, 1500)
d.text((80, 70), "Hotel Bellavista ★★★ - Firenze", font=font(BOLD, 40), fill=(90, 30, 30))
y = write(d, 80, 150, [
    "Conferma di prenotazione n. 48213",
    "",
    "Arrivo: 14/11/2026     Partenza: 18/11/2026",
    "Camera doppia standard, 4 notti",
    "Totale soggiorno: € 580,00",
    "",
    "Politica di cancellazione",
    "La cancellazione è gratuita entro il 7 novembre 2026.",
    "Dopo tale data, in caso di cancellazione o mancata",
    "presentazione, verrà addebitata una penale pari",
    "alla prima notte: € 145,00.",
    "",
    "Per cancellare, rispondere a questa email indicando",
    "il numero di prenotazione.",
    "",
    "Cordiali saluti, la Reception",
], font(SANS, 31))
im = photo_effects(im, angle=0.8, blur=0.5, noise=6, shade=False)
im.save(OUT / "it_hotel_cancellation.jpg", quality=90)
expected["it_hotel_cancellation.jpg"] = dict(docLanguage="it", docType="hotel_cancellation", deadline="2026-11-07",
    amount=145.00, currency="EUR", reference="48213",
    note="Money at stake = cancellation penalty (145), total stay (580) is a distractor. Distractor dates: arrival/departure.")

# 5. Portuguese visa appointment letter ---------------------------------------
im, d = page()
d.text((80, 80), "CONSULADO-GERAL DE PORTUGAL", font=font(BOLD, 36), fill=(0, 60, 0))
d.text((80, 128), "Secção Consular - Vistos", font=font(SANS, 26), fill=(0, 60, 0))
y = write(d, 80, 220, [
    "Assunto: Agendamento de pedido de visto nacional",
    "Processo n.º: VN-2026/33871",
    "",
    "Exmo(a). Senhor(a),",
    "",
    "Informamos que a sua entrevista para o pedido de visto",
    "está marcada para o dia 22 de outubro de 2026, às 10h30.",
    "",
    "Deverá enviar os documentos em falta (comprovativo de",
    "meios de subsistência e seguro de viagem) e efetuar o",
    "pagamento da taxa consular de 90,00 EUR até 20/10/2026.",
    "",
    "Sem estes documentos, o agendamento será cancelado.",
    "",
    "Com os melhores cumprimentos,",
    "A Secção Consular",
    "",
    "Lisboa, 01 de outubro de 2026",
], font(SERIF, 30))
im.save(OUT / "pt_visa_letter.png")
expected["pt_visa_letter.png"] = dict(docLanguage="pt", docType="visa_entry", deadline="2026-10-20",
    amount=90.00, currency="EUR", reference="VN-2026/33871",
    note="Deadline = documents/fee due (até 20/10/2026); interview date 22 Oct and letter date are distractors.")

# 6. English airline cancellation notice --------------------------------------
im, d = page(1240, 1400, (255, 255, 255))
d.rectangle([0, 0, 1240, 120], fill=(20, 40, 90))
d.text((60, 35), "SkyBridge Airways", font=font(BOLD, 44), fill=(255, 255, 255))
y = write(d, 60, 170, [
    "Important: your flight has been cancelled",
    "",
    "Booking reference: QX7P2L",
    "Flight SB2490  London Gatwick (LGW) - Lisbon (LIS)",
    "Departure: 12 Oct 2026, 07:15",
    "",
    "We are sorry to tell you that this flight has been",
    "cancelled due to operational reasons.",
    "",
    "You can choose a free rebooking or a full refund of",
    "GBP 312.40 to your original payment method.",
    "",
    "Please submit your refund or rebooking request by",
    "26 October 2026 using Manage My Booking.",
    "",
    "You may also be entitled to compensation under",
    "UK261 rules.",
], font(SANS, 31))
im.save(OUT / "en_airline_cancellation.png")
expected["en_airline_cancellation.png"] = dict(docLanguage="en", docType="airline_cancellation", deadline="2026-10-26",
    amount=312.40, currency="GBP", reference="QX7P2L",
    note="Distractor: departure date 12 Oct 2026.")

# 7. German traffic fine (Bußgeldbescheid), phone-photo style ------------------
im, d = page(1240, 1600)
d.text((80, 70), "Zentrale Bußgeldstelle Brandenburg", font=font(BOLD, 34), fill=(0, 0, 0))
y = write(d, 80, 150, [
    "Bußgeldbescheid",
    "",
    "Aktenzeichen: 2026-B-551209",
    "Tattag: 14.09.2026   Tatzeit: 08:12 Uhr",
    "Tatort: B96, Höhe km 12,4 - Fahrtrichtung Berlin",
    "",
    "Ihnen wird vorgeworfen, die zulässige",
    "Höchstgeschwindigkeit außerhalb geschlossener",
    "Ortschaften um 18 km/h überschritten zu haben.",
    "",
    "Bußgeld: 60,00 €",
    "Gebühren und Auslagen: 28,50 €",
    "Gesamtbetrag: 88,50 €",
    "",
    "Der Gesamtbetrag ist spätestens am 30. Oktober 2026",
    "zu zahlen. Gegen diesen Bescheid kann innerhalb von",
    "zwei Wochen nach Zustellung Einspruch eingelegt werden.",
    "",
    "Datum des Bescheids: 01.10.2026",
], font(SANS, 30))
im = photo_effects(im, angle=2.0, blur=0.9, noise=12)
im.save(OUT / "de_traffic_fine_photo.jpg", quality=85)
expected["de_traffic_fine_photo.jpg"] = dict(docLanguage="de", docType="parking_fine", deadline="2026-10-30",
    amount=88.50, currency="EUR", reference="2026-B-551209",
    note="Phone-photo style. Total due (Gesamtbetrag 88,50) is the money at stake; fine-only 60,00 is a distractor. Deadline in written-month form.")

# 8. French entry form / visa letter (residence permit appointment) -----------
im, d = page()
d.text((80, 80), "PRÉFECTURE DU RHÔNE", font=font(BOLD, 38), fill=(0, 0, 90))
d.text((80, 130), "Direction des migrations et de l'intégration", font=font(SANS, 26), fill=(0, 0, 90))
y = write(d, 80, 230, [
    "Objet : demande de titre de séjour - pièces manquantes",
    "Numéro de dossier : 69-2026-084512",
    "",
    "Madame, Monsieur,",
    "",
    "Votre demande de titre de séjour est incomplète.",
    "Vous devez transmettre les pièces suivantes au plus",
    "tard le 2 novembre 2026 :",
    "  - justificatif de domicile de moins de 3 mois",
    "  - attestation d'assurance maladie",
    "",
    "Le timbre fiscal de 225 € devra être acheté avant le",
    "rendez-vous. Sans réponse de votre part, votre",
    "demande sera classée sans suite.",
    "",
    "Lyon, le 25 septembre 2026",
], font(SERIF, 30))
im.save(OUT / "fr_residence_permit_letter.png")
expected["fr_residence_permit_letter.png"] = dict(docLanguage="fr", docType="visa_entry", deadline="2026-11-02",
    amount=225.00, currency="EUR", reference="69-2026-084512",
    note="Deadline phrase 'au plus tard le' split across a line break.")

(OUT / "expected.json").write_text(json.dumps(expected, indent=2, ensure_ascii=False))
print("wrote", len(expected), "docs to", OUT)
