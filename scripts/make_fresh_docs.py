"""Third 'fresh' set, written after the extractor fixes and scored once without further tuning."""
import json, random, importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("h", Path(__file__).with_name("make_holdout_docs.py"))
# reuse helpers without re-running the holdout generation side effects
src = Path(__file__).with_name("make_holdout_docs.py").read_text().split("exp = json.loads")[0]
ns = {"__file__": str(Path(__file__).with_name("make_holdout_docs.py"))}
exec(src, ns)
page, write, font, phone, OUT = ns["page"], ns["write"], ns["font"], ns["phone"], ns["OUT"]
random.seed(23)
exp = json.loads((OUT / "expected.json").read_text())

im, d = page(1100, 1400, (255, 255, 255))
d.text((60, 50), "EMEL - Lisboa", font=font("DejaVuSans-Bold.ttf", 40), fill=(0, 90, 60))
write(d, 60, 140, [
    "Aviso de contraordenação",
    "Auto n.º 7712045",
    "Matrícula: 23-XR-91",
    "Local: Avenida da Liberdade, 190",
    "Data/hora da infração: 06/10/2026 11:20",
    "Infração: estacionamento sem título válido",
    "",
    "Coima: 60,00 €",
    "Data limite de pagamento: 2026-10-23",
    "",
    "O pagamento pode ser feito no Multibanco",
    "(Entidade 21312, Referência 771 204 553).",
], font("DejaVuSans.ttf", 29))
im = phone(im, angle=-1.2, blur=1.2, noise=14, scale=0.6)
im.save(OUT / "pt_parking_notice_photo.jpg", quality=78)
exp["pt_parking_notice_photo.jpg"] = dict(set="fresh", docLanguage="pt", docType="parking_fine", deadline="2026-10-23", amount=60.00, currency="EUR", reference="7712045", note="Low-res (0.6x) photo, ISO date.")

im, d = page(1100, 650, (255, 255, 255))
d.rectangle([0, 0, 1100, 95], fill=(240, 120, 0))
d.text((30, 20), "Ibuprofen 400 mg", font=font("DejaVuSans-Bold.ttf", 48), fill=(255, 255, 255))
write(d, 30, 120, [
    "20 Filmtabletten - Zum Einnehmen",
    "Wirkstoff: Ibuprofen",
    "Dosierung: Erwachsene 1 Tablette, bei Bedarf",
    "bis zu 3-mal täglich. Packungsbeilage beachten.",
    "Arzneimittel für Kinder unzugänglich aufbewahren.",
], font("DejaVuSans.ttf", 29))
d.text((30, 520), "Ch.-B.: 2207A", font=font("DejaVuSansMono.ttf", 28), fill=(0, 0, 0))
d.text((30, 570), "Verwendbar bis: 08.2027", font=font("DejaVuSansMono.ttf", 28), fill=(0, 0, 0))
im = phone(im, angle=2.0, blur=1.0, noise=12, shadow=True)
im.save(OUT / "de_medicine_label.jpg", quality=82)
exp["de_medicine_label.jpg"] = dict(set="fresh", docLanguage="de", docType="medicine_label", deadline="2027-08-31", amount=None, currency=None, reference=None, note="Expiry mm.yyyy")

im, d = page()
d.text((80, 80), "EMBAJADA DE ESPAÑA EN LONDRES", font=font("DejaVuSerif-Bold.ttf", 36), fill=(120, 0, 0))
d.text((80, 130), "Sección Consular - Visados", font=font("DejaVuSerif.ttf", 28), fill=(120, 0, 0))
write(d, 80, 230, [
    "Solicitud nº ESP-55-2026-1102",
    "",
    "Estimado/a solicitante:",
    "",
    "Le confirmamos su cita previa para la presentación",
    "de la solicitud de visado de estudios el día",
    "5 de noviembre de 2026 a las 09:40.",
    "",
    "Deberá traer el pasaporte original y el justificante",
    "del pago de la tasa de visado (80 €).",
    "",
    "Atentamente,",
    "Sección Consular",
], font("DejaVuSerif.ttf", 30))
im.save(OUT / "es_visa_appointment.png")
exp["es_visa_appointment.png"] = dict(set="fresh", docLanguage="es", docType="visa_entry", deadline="2026-11-05", amount=80.00, currency="EUR", reference="ESP-55-2026-1102", note="Only date is the appointment.")

im, d = page()
d.text((80, 80), "Northgate Lettings", font=font("DejaVuSans-Bold.ttf", 38), fill=(30, 30, 90))
write(d, 80, 170, [
    "Tenancy check-in inventory",
    "Tenancy ref: TR-40217",
    "Property: Flat 3, 18 Albion Street, Leeds LS1 6HX",
    "Tenancy start date: 1 October 2026",
    "",
    "Monthly rent: £1,100.00",
    "Security deposit: £1,450.00 (protected with the DPS)",
    "",
    "Please check every item, add your comments and",
    "photos, and return this signed inventory no later",
    "than 14 November 2026. If we do not hear from you,",
    "the inventory will be treated as accepted.",
], font("DejaVuSans.ttf", 30))
im = phone(im, angle=0.8, blur=0.8, noise=10, shadow=True)
im.save(OUT / "en_tenancy_inventory.jpg", quality=85)
exp["en_tenancy_inventory.jpg"] = dict(set="fresh", docLanguage="en", docType="rental_move_in", deadline="2026-11-14", amount=1450.00, currency="GBP", reference="TR-40217", note="Deposit vs rent; start date distractor.")

im, d = page(1240, 1100, (255, 255, 255))
d.text((60, 50), "VolaLow", font=font("DejaVuSans-Bold.ttf", 42), fill=(0, 40, 120))
write(d, 60, 140, [
    "Gentile cliente,",
    "il volo FR 8842 Bergamo - Valencia del 30/10/2026",
    "è stato cancellato.",
    "Codice prenotazione: JQ8R2W",
    "",
    "Può scegliere un volo alternativo oppure richiedere",
    "il rimborso di 89,99 € entro il 20/10/2026.",
    "",
    "Ci scusiamo per il disagio.",
], font("DejaVuSans.ttf", 30))
im.save(OUT / "it_flight_cancelled.png")
exp["it_flight_cancelled.png"] = dict(set="fresh", docLanguage="it", docType="airline_cancellation", deadline="2026-10-20", amount=89.99, currency="EUR", reference="JQ8R2W", note="")

im, d = page(1240, 1200)
d.text((60, 50), "Hôtel du Port - Marseille", font=font("DejaVuSans-Bold.ttf", 38), fill=(20, 20, 20))
write(d, 60, 140, [
    "Confirmation de réservation",
    "Réservation n° 77-4410",
    "Arrivée : 05/12/2026 - Départ : 07/12/2026",
    "2 nuits, chambre double vue mer",
    "",
    "Conditions d'annulation :",
    "Annulation sans frais jusqu'au 28/11/2026 à 18h.",
    "Passé ce délai, la totalité du séjour sera facturée :",
    "312,00 €.",
], font("DejaVuSans.ttf", 30))
im = phone(im, angle=-1.6, blur=1.0, noise=12, shadow=False)
im.save(OUT / "fr_hotel_annulation.jpg", quality=84)
exp["fr_hotel_annulation.jpg"] = dict(set="fresh", docLanguage="fr", docType="hotel_cancellation", deadline="2026-11-28", amount=312.00, currency="EUR", reference="77-4410", note="")

(OUT / "expected.json").write_text(json.dumps(exp, indent=2, ensure_ascii=False))
print(len(exp), "docs total")
