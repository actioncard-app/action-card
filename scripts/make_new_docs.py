"""'new' blind set (written 2026-10-06, BEFORE any further extractor tuning).
Harder than dev/holdout/fresh/stress: two-column layouts, tables, several amounts incl. early-payment
discounts, relative deadlines ("within N days of ..."), mild perspective skew, glare/shadow, lower resolution.
Ground truth is decided here, up front, and is not changed after seeing results."""
import json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "test-docs"
random.seed(2026)
F = "/usr/share/fonts/truetype/dejavu/"
def font(name, size):
    try: return ImageFont.truetype(name if name.startswith("/") else F + name, size)
    except Exception: return ImageFont.truetype(F + "DejaVuSans.ttf", size)
R = lambda s: font("DejaVuSans.ttf", s)
B = lambda s: font("DejaVuSans-Bold.ttf", s)
SERIF = lambda s: font("DejaVuSerif.ttf", s)
class Draw(ImageDraw.ImageDraw):
    def text(self, xy, text, fill=(20, 20, 20), **kw):  # PIL's default fill is white on RGB; default to ink instead
        return super().text(xy, text, fill=fill, **kw)
def page(w=1240, h=1754, bg=(252, 251, 247)):
    im = Image.new("RGB", (w, h), bg); return im, Draw(im)
def write(d, x, y, lines, f, gap=1.45, fill=(25, 25, 25)):
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill); y += int(f.size * gap)
    return y
def table(d, x, y, widths, rows, f, head=True, pad=10):
    """Simple ruled table. rows: list of tuples of strings. Right-align cells starting with a digit or ending with a currency."""
    rh = int(f.size * 1.9)
    total = sum(widths)
    for i, row in enumerate(rows):
        if head and i == 0: d.rectangle([x, y, x + total, y + rh], fill=(225, 230, 232))
        cx = x
        for w, cell in zip(widths, row):
            tw = d.textlength(cell, font=f)
            numeric = cell[:1].isdigit() or cell.endswith(("€", "£", "$")) or cell[:1] in "£$€"
            tx = cx + w - pad - tw if numeric else cx + pad
            d.text((tx, y + (rh - f.size) // 2 - 2), cell, font=B(f.size) if head and i == 0 else f, fill=(20, 20, 20))
            cx += w
        d.line([x, y + rh, x + total, y + rh], fill=(120, 120, 120), width=1)
        y += rh
    d.rectangle([x, y - rh * len(rows), x + total, y], outline=(90, 90, 90), width=2)
    cx = x
    for w in widths[:-1]:
        cx += w; d.line([cx, y - rh * len(rows), cx, y], fill=(150, 150, 150), width=1)
    return y
def find_coeffs(pa, pb):
    m = []
    for p1, p2 in zip(pa, pb):
        m.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0]*p1[0], -p2[0]*p1[1]])
        m.append([0, 0, 0, p1[0], p1[1], 1, -p2[1]*p1[0], -p2[1]*p1[1]])
    A = np.matrix(m, dtype=float); Bv = np.array(pb).reshape(8)
    return np.array(np.dot(np.linalg.inv(A.T * A) * A.T, Bv)).reshape(8)
def skew(im, k=0.04, side="left"):
    w, h = im.size; dx = int(w * k); dy = int(h * k * 0.4)
    src = [(dx, dy), (w, 0), (w, h), (0, h - dy)] if side == "left" else [(0, 0), (w - dx, dy), (w - dx // 2, h - dy), (0, h)]
    c = find_coeffs([(0, 0), (w, 0), (w, h), (0, h)], src)
    bg = Image.new("RGB", (w + 80, h + 80), (96, 90, 84))
    bg.paste(im.transform((w, h), Image.PERSPECTIVE, c, Image.BICUBIC, fillcolor=(96, 90, 84)), (40, 40))
    return bg
def glare(im, cx, cy, r, strength=0.45):
    w, h = im.size
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).ellipse([cx - r, cy - r * 0.6, cx + r, cy + r * 0.6], fill=int(255 * strength))
    m = m.filter(ImageFilter.GaussianBlur(r // 3))
    return Image.composite(Image.new("RGB", (w, h), (255, 255, 255)), im, m)
def shadow(im, corner="tr", strength=80):
    w, h = im.size
    m = Image.new("L", (w, h), 255); d = ImageDraw.Draw(m)
    box = {"tr": [int(w*.55), -int(h*.3), int(w*1.5), int(h*.45)], "bl": [-int(w*.5), int(h*.6), int(w*.45), int(h*1.4)],
           "l": [-int(w*.6), 0, int(w*.25), h]}[corner]
    d.ellipse(box, fill=255 - strength); m = m.filter(ImageFilter.GaussianBlur(90))
    return Image.composite(im, Image.new("RGB", (w, h), (60, 56, 52)), m)
def finish(im, scale=1.0, blur=0.7, angle=0.0, noise=10):
    if angle: im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(96, 90, 84))
    if scale != 1.0: im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im).astype(np.int16)
    a = a + np.random.default_rng(7).integers(-noise, noise + 1, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

exp = json.loads((OUT / "expected.json").read_text())
def add(name, im, quality=None, **e):
    path = OUT / name
    if quality: im.save(path, quality=quality)
    else: im.save(path)
    exp[name] = dict(set="new", **e)
    print(name, im.size)

# N1 German fine, two columns + cost table, relative deadline from letter date
im, d = page(1240, 1500)
d.text((70, 60), "Stadt Köln – Der Oberbürgermeister", font=B(34), fill=(10, 40, 90))
d.text((70, 108), "Amt für öffentliche Ordnung · Verkehrsüberwachung", font=R(24), fill=(60, 60, 60))
write(d, 70, 190, ["Herrn", "Daniel Moreau", "Aachener Str. 212", "50931 Köln"], R(26))
write(d, 700, 190, ["Aktenzeichen:", "503.26.117842.0", "Datum: 01.10.2026", "Sachbearbeitung: Fr. Lenz"], R(26))
d.text((70, 420), "Verwarnung mit Verwarnungsgeld", font=B(32))
write(d, 70, 480, ["Tattag: 24.09.2026, 10:52 Uhr", "Tatort: Venloer Straße 18", "Kennzeichen: K-DM 4471"], R(25))
write(d, 660, 480, ["Tatvorwurf: Sie parkten", "im absoluten Halteverbot", "(§ 12 Abs. 1 StVO)."], R(25))
y = table(d, 70, 640, [700, 360], [("Position", "Betrag"), ("Verwarnungsgeld", "55,00 €"), ("Gebühren", "28,50 €"),
          ("Auslagen", "3,50 €"), ("Gesamtbetrag", "87,00 €")], R(26))
write(d, 70, y + 40, ["Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen",
    "ab dem Datum dieses Schreibens unter Angabe des Aktenzeichens.",
    "Andernfalls wird ein Bußgeldverfahren eingeleitet."], R(26))
im = finish(shadow(skew(im, 0.035), "tr", 70), scale=0.8, blur=0.8, angle=-1.2)
add("new_de_bussgeld_twocol.jpg", im, 82, docLanguage="de", docType="parking_fine", deadline="2026-10-15", amount=87.0, currency="EUR",
    reference="503.26.117842.0", note="Relative: 14 days from letter date 01.10.2026. Table with 4 amounts; total is the stake. Tattag distractor.")

# N2 French ANTAI-style notice, table with minorée / forfaitaire / majorée
im, d = page(1240, 1560, (250, 250, 250))
d.rectangle([0, 0, 1240, 120], fill=(0, 35, 120))
d.text((60, 36), "AVIS DE CONTRAVENTION", font=B(40), fill=(255, 255, 255))
write(d, 60, 160, ["Numéro d'avis : 7713045842", "Date d'envoi de l'avis : 03/10/2026", "Date de l'infraction : 27/09/2026 à 14h12",
    "Lieu : Rue de la République, Lyon 2e", "Nature : Stationnement gênant"], R(27))
y = table(d, 60, 420, [640, 220, 240], [("Montant", "Délai", "Somme"), ("Amende minorée", "15 jours", "35 €"),
    ("Amende forfaitaire", "45 jours", "68 €"), ("Amende majorée", "au-delà", "180 €")], R(26))
write(d, 60, y + 40, ["Si vous payez l'amende minorée de 35 € dans un délai de 15 jours",
    "à compter de la date d'envoi du présent avis, aucune autre somme",
    "ne vous sera réclamée. Paiement : www.amendes.gouv.fr"], R(26))
im = finish(glare(skew(im, 0.03, "right"), 900, 300, 260, 0.5), scale=0.72, blur=0.9, angle=1.0)
add("new_fr_amende_table.jpg", im, 80, docLanguage="fr", docType="parking_fine", deadline="2026-10-18", amount=35.0, currency="EUR",
    reference="7713045842", note="Early-payment discount: 35 EUR within 15 days of sending date 03/10/2026. 68/180 are distractors. Glare over header.")

# N3 Spanish rental, two-column + table, deadline relative BEFORE move-in, low resolution
im, d = page(1240, 1500)
d.text((70, 60), "INMOBILIARIA SOL Y MAR", font=B(36), fill=(150, 70, 0))
write(d, 70, 120, ["Calle Colón 14, 46004 Valencia"], R(24))
write(d, 70, 200, ["Arrendatario: Lukas Brenner", "Vivienda: C/ Sueca 31, 3º B"], R(26))
write(d, 700, 200, ["Contrato nº ALQ/26/3381", "Fecha de entrada:", "1 de noviembre de 2026"], R(26))
d.text((70, 380), "Resumen de pagos antes de la entrada", font=B(30))
y = table(d, 70, 440, [720, 340], [("Concepto", "Importe"), ("Fianza (2 mensualidades)", "1.800,00 €"),
    ("Primera mensualidad", "900,00 €"), ("Honorarios de agencia", "0,00 €"), ("Total a pagar", "2.700,00 €")], R(26))
write(d, 70, y + 40, ["El total a pagar debe abonarse como mínimo 5 días antes",
    "de la fecha de entrada. Sin el pago no se entregarán las llaves."], R(26))
im = finish(shadow(skew(im, 0.03), "bl", 70), scale=0.55, blur=0.6, angle=0.8)
add("new_es_alquiler_twocol.jpg", im, 78, docLanguage="es", docType="rental_move_in", deadline="2026-10-27", amount=2700.0, currency="EUR",
    reference="ALQ/26/3381", note="Relative BEFORE event: 5 days before move-in 1 Nov 2026. Total (2700) is what must be paid by then. Low res 0.55x.")

# N4 Italian hotel booking with table, 72 hours before arrival
im, d = page(1240, 1500, (255, 255, 255))
d.text((70, 60), "Hotel Bellavista ★★★ – Firenze", font=B(36), fill=(120, 20, 40))
write(d, 70, 130, ["Conferma di prenotazione n. BV-26-90417", "Ospite: Sarah Collins"], R(27))
write(d, 70, 240, ["Arrivo: 20/11/2026", "Partenza: 23/11/2026"], R(27))
write(d, 660, 240, ["Camera: doppia superior", "Ospiti: 2 adulti"], R(27))
y = table(d, 70, 360, [520, 220, 320], [("Voce", "Q.tà", "Importo"), ("Camera doppia, per notte", "3", "120,00 €"),
    ("Tassa di soggiorno", "6", "12,00 €"), ("Totale soggiorno", "", "372,00 €")], R(26))
write(d, 70, y + 40, ["Politica di cancellazione: cancellazione gratuita fino a 72 ore",
    "prima dell'arrivo. In caso di cancellazione tardiva o mancata",
    "presentazione verrà addebitata la prima notte (120,00 €)."], R(26))
im = finish(glare(skew(im, 0.03, "right"), 300, 900, 280, 0.4), scale=0.75, blur=0.7, angle=-0.8)
add("new_it_hotel_table.jpg", im, 82, docLanguage="it", docType="hotel_cancellation", deadline="2026-11-17", amount=120.0, currency="EUR",
    reference="BV-26-90417", note="72 hours before arrival 20/11 -> 17/11. Stake = penalty first night 120; total 372 distractor.")

# N5 Portuguese consulate letter, two columns, 30 days from letter date, fees table
im, d = page(1240, 1600)
d.text((70, 60), "Consulado-Geral de Portugal", font=SERIF(36), fill=(0, 70, 40))
write(d, 70, 120, ["Secção Consular – Vistos"], R(24))
write(d, 760, 200, ["Lisboa, 28 de setembro de 2026", "Processo n.º VN-26/55102"], R(24))
write(d, 70, 200, ["Exmo. Senhor", "Amir Haddad"], R(26))
write(d, 70, 360, ["Na análise do seu pedido de visto nacional verificou-se",
    "que falta o comprovativo de meios de subsistência.",
    "Deve apresentar os documentos em falta no prazo de 30 dias",
    "a contar da data desta carta, sob pena de arquivamento."], R(26))
y = table(d, 70, 600, [700, 340], [("Taxa", "Valor"), ("Taxa de visto", "80,00 €"), ("Taxa de serviço", "35,50 €"), ("Total", "115,50 €")], R(26))
write(d, 70, y + 40, ["O pagamento do total é feito no momento da entrega."], R(26))
im = finish(shadow(skew(im, 0.03), "l", 60), scale=0.7, blur=0.7, angle=1.1)
add("new_pt_visto_twocol.jpg", im, 80, docLanguage="pt", docType="visa_entry", deadline="2026-10-28", amount=115.5, currency="EUR",
    reference="VN-26/55102", note="Relative: 30 days from letter date 28/09/2026. Total fee 115.50; 80/35.50 distractors.")

# N6 English airline email with flight table, refund within 28 days of this email
im, d = page(1240, 1500, (255, 255, 255))
write(d, 60, 50, ["From: Horizon Air <no-reply@horizonair.example>", "Sent: Friday, 2 October 2026 14:05", "Subject: Your flight has been cancelled"], R(24), fill=(90, 90, 90))
d.text((60, 210), "We're sorry – your flight is cancelled", font=B(34))
write(d, 60, 270, ["Booking reference: HB7K3Q", "Passenger: Ms Elena Rossi"], R(27))
y = table(d, 60, 380, [180, 300, 300, 330], [("Flight", "Route", "Date", "Status"), ("HZ 418", "LGW – FCO", "19 Oct 2026", "Cancelled"),
    ("HZ 422", "LGW – FCO", "20 Oct 2026", "Offered")], R(25))
write(d, 60, y + 40, ["Your options:", "• Accept the new flight HZ 422 – no action needed.",
    "• Refund to original payment: £214.60", "• Travel voucher instead: £240.00",
    "", "To get a refund, request it within 28 days of this email at", "horizonair.example/manage."], R(26))
im = finish(skew(im, 0.025, "right"), scale=0.68, blur=0.6)
add("new_en_airline_table.png", im, None, docLanguage="en", docType="airline_cancellation", deadline="2026-10-30", amount=214.6, currency="GBP",
    reference="HB7K3Q", note="Relative: 28 days from email sent date 2 Oct 2026. Refund 214.60 is the stake; voucher 240 distractor; flight dates distractors.")

# N7 English medicine box, two columns, EXP plus 'discard 28 days after opening'
im, d = page(1240, 760, (255, 255, 255))
d.rectangle([0, 0, 1240, 110], fill=(0, 110, 160))
d.text((40, 28), "Chloramphenicol 0.5% w/v Eye Drops", font=B(40), fill=(255, 255, 255))
write(d, 40, 150, ["Directions: adults and children over 2 years:", "1 drop into the affected eye every 2 hours", "for the first 48 hours, then 4 times a day.",
    "Do not use for more than 5 days.", "Discard 28 days after opening."], R(27))
write(d, 760, 150, ["10 ml solution", "Contains chloramphenicol", "0.5% w/v, boric acid,", "borax, water.", "Store in a refrigerator."], R(25))
write(d, 40, 600, ["LOT B2271", "MFG 02/2025", "EXP 02/2028"], font("DejaVuSansMono.ttf", 28), gap=1.25)
im = finish(glare(skew(im, 0.04), 700, 330, 220, 0.45), scale=0.85, blur=0.8, angle=-2.0)
add("new_en_medicine_box.jpg", im, 82, docLanguage="en", docType="medicine_label", deadline="2028-02-29", amount=None, currency=None,
    reference=None, note="Expiry 02/2028 -> end of month. MFG date and relative 'discard 28 days after opening' / '48 hours' must not win.")

# N8 German tenancy handover letter with table; deposit due 7 days before start
im, d = page(1240, 1500)
d.text((70, 60), "Hausverwaltung Berger & Söhne GmbH", font=B(34))
write(d, 70, 120, ["Leipzig, 05.10.2026"], R(25))
write(d, 70, 200, ["Mietvertrag Nr. MV-2026-0712", "Mieterin: Ana Souza", "Objekt: Karl-Heine-Str. 40, 2. OG links"], R(26))
write(d, 70, 360, ["Mietbeginn: 01.12.2026"], B(27))
y = table(d, 70, 440, [700, 360], [("Position", "Betrag"), ("Kaltmiete monatlich", "950,00 €"), ("Nebenkostenvorauszahlung", "210,00 €"),
    ("Mietkaution (3 Kaltmieten)", "2.850,00 €")], R(26))
write(d, 70, y + 40, ["Die Mietkaution ist spätestens 7 Tage vor Mietbeginn auf",
    "das Kautionskonto zu überweisen. Die Schlüsselübergabe erfolgt",
    "erst nach Zahlungseingang."], R(26))
im = finish(shadow(skew(im, 0.03, "right"), "tr", 75), scale=0.62, blur=0.7, angle=1.4)
add("new_de_mietvertrag_table.jpg", im, 80, docLanguage="de", docType="rental_move_in", deadline="2026-11-24", amount=2850.0, currency="EUR",
    reference="MV-2026-0712", note="7 days before Mietbeginn 01.12.2026. Deposit 2850 is stake; rent and Nebenkosten distractors; letter date distractor.")

# N9 French prefecture appointment: confirm 48 h before the appointment
im, d = page(1240, 1500, (253, 253, 250))
d.text((70, 60), "PRÉFECTURE DU RHÔNE", font=B(36), fill=(0, 40, 110))
write(d, 70, 120, ["Service de l'immigration et de l'intégration"], R(25))
write(d, 70, 200, ["Mme Fatima Benali", "Dossier n° 69-26-117305"], R(26))
write(d, 700, 200, ["Lyon, le 30 septembre 2026"], R(26))
d.text((70, 330), "Convocation – remise de titre de séjour", font=B(30))
write(d, 70, 400, ["Votre rendez-vous : le 12 novembre 2026 à 09h30, guichet 4.",
    "Merci de confirmer votre présence au moins 48 heures avant",
    "le rendez-vous sur le site de la préfecture."], R(26))
y = table(d, 70, 580, [720, 340], [("Pièces à apporter", "Montant"), ("Timbre fiscal (taxe)", "200 €"), ("Droit de timbre", "25 €"), ("Total timbres", "225 €")], R(26))
im = finish(glare(skew(im, 0.03), 950, 250, 240, 0.4), scale=0.7, blur=0.8, angle=-1.0)
add("new_fr_visa_rdv.jpg", im, 82, docLanguage="fr", docType="visa_entry", deadline="2026-11-10", amount=225.0, currency="EUR",
    reference="69-26-117305", note="Confirm 48 h before appointment 12/11 -> 10/11 (appointment date itself also defensible; scored strictly vs 10/11). Total 225.")

# N10 Spanish flight cancellation, two columns, 7 business days from letter date
im, d = page(1240, 1500)
d.text((70, 60), "IBERIA EXPRESS – Atención al cliente", font=B(32), fill=(170, 0, 20))
write(d, 70, 120, ["Madrid, 2 de octubre de 2026"], R(25))
write(d, 70, 200, ["Pasajero: Thomas Weber", "Localizador: X7RT2M"], R(26))
write(d, 700, 200, ["Vuelo: IB3172", "Fecha: 15/10/2026", "Madrid – Lisboa"], R(26))
write(d, 70, 400, ["Lamentamos informarle de que su vuelo ha sido cancelado.",
    "Tiene derecho al reembolso del billete (189,40 €) y a una",
    "compensación de 250 € según el Reglamento (CE) 261/2004.",
    "", "Puede solicitar el reembolso en un plazo de 7 días hábiles",
    "desde la fecha de esta comunicación."], R(26))
im = finish(shadow(skew(im, 0.035, "right"), "bl", 70), scale=0.65, blur=0.7, angle=1.5)
add("new_es_vuelo_twocol.jpg", im, 80, docLanguage="es", docType="airline_cancellation", deadline="2026-10-13", amount=189.4, currency="EUR",
    reference="X7RT2M", note="7 business days from Fri 2 Oct 2026 -> Tue 13 Oct. Refund 189.40 is the stake (250 compensation defensible; scored strictly). Flight date distractor.")

# N11 Italian fine, low resolution, discount within 5 days of notification
im, d = page(1240, 1400, (248, 246, 240))
d.text((70, 60), "COMUNE DI BOLOGNA – Polizia Locale", font=B(34))
write(d, 70, 130, ["Verbale di accertamento n. 2026/PL/884120", "Data verbale: 03/10/2026", "Targa: FG 812 KL"], R(26))
write(d, 70, 300, ["Violazione: sosta in area pedonale (art. 158 C.d.S.)"], R(26))
y = table(d, 70, 380, [720, 340], [("Pagamento", "Importo"), ("Entro 5 giorni dalla notifica (-30%)", "29,40 €"),
    ("Entro 60 giorni dalla notifica", "42,00 €")], R(25))
write(d, 70, y + 40, ["Il pagamento ridotto è ammesso solo entro 5 giorni dalla notifica."], R(25))
im = finish(skew(im, 0.03), scale=0.5, blur=0.8, angle=-1.6, noise=12)
add("new_it_multa_lowres.jpg", im, 75, docLanguage="it", docType="parking_fine", deadline="2026-10-08", amount=29.4, currency="EUR",
    reference="2026/PL/884120", note="Receipt-relative (notifica): earliest possible = verbale date 03/10 + 5 days. Reduced 29.40 is the stake. Low res 0.5x.")

# N12 Portuguese restaurant receipt (unknown type), table, no deadline
im, d = page(900, 1300, (255, 255, 255))
d.text((60, 50), "TASCA DO BAIRRO", font=B(36))
write(d, 60, 110, ["Rua da Rosa 51, Lisboa", "NIF 509 112 334", "Fatura-recibo FR 2026/4471", "Data: 04/10/2026 21:37"], R(24))
y = table(d, 60, 290, [430, 120, 220], [("Artigo", "Qtd", "Valor"), ("Bacalhau à Brás", "2", "25,80 €"), ("Vinho da casa", "1", "9,50 €"),
    ("Café", "2", "3,40 €"), ("Total", "", "38,70 €")], R(24))
write(d, 60, y + 40, ["IVA incluído à taxa em vigor.", "Obrigado pela sua visita!"], R(24))
im = finish(glare(skew(im, 0.03, "right"), 600, 500, 200, 0.4), scale=0.8, blur=0.7, angle=2.0)
add("new_pt_recibo_unknown.jpg", im, 80, docLanguage="pt", docType="unknown", deadline=None, amount=38.7, currency="EUR",
    reference=None, note="Not an action document: no deadline expected. Receipt number intentionally not scored as reference.")

# N13 German immigration letter with NO printed date: deadline relative to an unknown date
im, d = page(1240, 1300)
d.text((70, 60), "Landeshauptstadt München", font=B(34))
write(d, 70, 120, ["Kreisverwaltungsreferat – Ausländerbehörde"], R(25))
write(d, 70, 200, ["Herrn Kenji Watanabe", "Zeichen: KVR-II/26-40718"], R(26))
d.text((70, 330), "Aufforderung zur Vorsprache", font=B(30))
write(d, 70, 400, ["Bitte melden Sie sich innerhalb von zwei Wochen nach Erhalt",
    "dieses Schreibens persönlich bei der Ausländerbehörde, um Ihren",
    "Aufenthaltstitel zu verlängern. Gebühr: 100,00 € (zahlbar vor Ort)."], R(26))
im = finish(shadow(skew(im, 0.03, "right"), "l", 60), scale=0.7, blur=0.7, angle=0.9)
add("new_de_auslaenderbehoerde_nodate.jpg", im, 80, docLanguage="de", docType="visa_entry", deadline=None, amount=100.0, currency="EUR",
    reference="KVR-II/26-40718", note="No date printed anywhere: deadline must be shown as relative to an unknown date (value null), not computed from today.")

(OUT / "expected.json").write_text(json.dumps(exp, indent=1, ensure_ascii=False))
print("total docs:", len(exp), " new:", sum(1 for v in exp.values() if v["set"] == "new"))
