"""v1 document types (tax office, health insurance, debt collection, utility bill, benefits office, broadcast fee).
Written 2026-10-11 BEFORE tuning the new rules. 4 docs per type: 2 'v1-tuning' (may be used to tune keywords) and
2 'v1-heldout' (never looked at while tuning; scored separately). Synthetic: names, numbers and IBANs are invented
(IBANs get valid check digits so the IBAN field can be tested). Ground truth is fixed here up front."""
import json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "test-docs" / "v1"
OUT.mkdir(parents=True, exist_ok=True)
F = "/usr/share/fonts/truetype/dejavu/"
R = lambda s: ImageFont.truetype(F + "DejaVuSans.ttf", s)
B = lambda s: ImageFont.truetype(F + "DejaVuSans-Bold.ttf", s)
S = lambda s: ImageFont.truetype(F + "DejaVuSerif.ttf", s)

def iban(cc, bban):
    num = "".join(str(ord(c) - 55) if c.isalpha() else c for c in bban + cc + "00")
    return f"{cc}{98 - int(num) % 97:02d}{bban}"
def spaced(i): return " ".join(i[k:k+4] for k in range(0, len(i), 4))

def render(name, head, lines, photo=False, seed=0, font=R, cur=None):
    im = Image.new("RGB", (1240, 1754), (252, 251, 247)); d = ImageDraw.Draw(im)
    y = 80
    for i, h in enumerate(head):
        d.text((90, y), h, font=B(34) if i == 0 else R(24), fill=(20, 20, 20)); y += 52 if i == 0 else 34
    y += 30
    for ln in lines:
        if ln.startswith("**"): d.text((90, y), ln[2:], font=B(28), fill=(15, 15, 15)); y += 46; continue
        d.text((90, y), ln, font=font(26), fill=(25, 25, 25)); y += 40
    if photo:
        rng = np.random.default_rng(seed)
        im = im.rotate(rng.uniform(-2.5, 2.5), resample=Image.BICUBIC, expand=True, fillcolor=(96, 90, 84))
        im = im.resize((int(im.width * .72), int(im.height * .72)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.9))
        a = np.asarray(im).astype(np.int16) + rng.integers(-12, 13, (im.height, im.width))[..., None]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    im.save(OUT / name, quality=88)

exp = {}
def doc(name, set_, lang, typ, deadline, amount, ref, head, lines, iban_=None, direction=None, **kw):
    render(name, head, lines, **kw)
    exp[name] = dict(set=set_, docLanguage=lang, docType=typ, deadline=deadline, amount=amount, currency="EUR" if amount is not None else None,
                     reference=ref, iban=iban_, moneyDirection=direction)
    if kw.get("cur"): exp[name]["currency"] = kw["cur"]

T, H = "v1-tuning", "v1-heldout"
# ---------------- tax office ----------------
i1 = iban("DE", "70050000" + "0001190315")
doc("de_finanzamt_nachzahlung.png", T, "de", "tax_office", "2026-11-16", 1284.00, "21/815/30477",
    ["Finanzamt München-Mitte", "Deroystraße 18, 80335 München", "", "München, 13.10.2026"],
    ["**Bescheid für 2025 über Einkommensteuer", "Steuernummer: 21/815/30477", "", "Sehr geehrte Frau Okafor,",
     "die Einkommensteuer für 2025 wird festgesetzt auf 6.912,00 €.", "Bereits gezahlt: 5.628,00 €",
     "Nachzahlung: 1.284,00 €", "Bitte zahlen Sie die Nachzahlung bis spätestens 16.11.2026", f"auf das Konto IBAN {spaced(i1)}.",
     "Gegen diesen Bescheid kann innerhalb eines Monats", "nach Bekanntgabe Einspruch eingelegt werden."], iban_=spaced(i1), direction="pay")
doc("fr_impots_avis.jpg", T, "fr", "tax_office", "2026-12-15", 642.00, "2026-0457-1183",
    ["Direction générale des Finances publiques", "Service des impôts des particuliers Lyon 3e", "", "Lyon, le 9 octobre 2026"],
    ["**Avis d'impôt sur le revenu 2026", "Numéro fiscal : 30 12 845 771 209", "Référence de l'avis : 2026-0457-1183", "",
     "Montant de votre impôt : 1 842,00 €", "Prélèvements déjà effectués : 1 200,00 €", "Reste à payer : 642,00 €",
     "Date limite de paiement : 15/12/2026", "Vous pouvez payer sur impots.gouv.fr ou par prélèvement."], photo=True, seed=11, direction="pay")
doc("es_hacienda_requerimiento.png", H, "es", "tax_office", "2026-11-02", None, "202620123445678X",
    ["Agencia Tributaria", "Delegación de Valencia", "", "Valencia, 14 de octubre de 2026"],
    ["**Requerimiento de documentación – IRPF 2025", "Referencia: 202620123445678X", "",
     "Estimado contribuyente:", "Para comprobar su declaración de la renta 2025 debe aportar",
     "los justificantes de las deducciones por alquiler.", "Plazo: hasta el 02/11/2026, a través de la sede electrónica",
     "de la Agencia Tributaria (sede.agenciatributaria.gob.es).", "Si no aporta la documentación se podrá dictar", "liquidación provisional."])
doc("it_entrate_avviso.jpg", H, "it", "tax_office", "2026-11-20", 318.40, "AV-2026-778120",
    ["Agenzia delle Entrate", "Direzione Provinciale di Bologna", "", "Bologna, 12 ottobre 2026"],
    ["**Comunicazione – Avviso bonario IRPEF 2023", "Codice fiscale: RSSMRA80A01A944K", "Numero comunicazione: AV-2026-778120", "",
     "Dal controllo della dichiarazione dei redditi risulta", "un importo da versare di 318,40 euro.",
     "Il pagamento va effettuato con modello F24 entro il 20/11/2026.", "Se ritieni che la comunicazione sia errata puoi",
     "rivolgerti a un ufficio dell'Agenzia."], photo=True, seed=12, direction="pay")
# ---------------- health insurance ----------------
doc("de_krankenkasse_beitrag.png", T, "de", "health_insurance", "2026-10-30", 412.87, "A123456789",
    ["Techniker Krankenkasse", "Bramfelder Straße 140, 22305 Hamburg", "", "Hamburg, 12.10.2026"],
    ["**Beitragsrückstand freiwillige Krankenversicherung", "Versichertennummer: A123456789", "",
     "Sehr geehrter Herr Haddad,", "für die Monate August und September 2026 sind Beiträge offen.",
     "Offener Betrag: 412,87 EUR", "Bitte überweisen Sie den Betrag bis 30.10.2026.",
     "Bei weiterem Rückstand kann Ihr Versicherungsschutz", "auf Notfallleistungen beschränkt werden."], direction="pay")
doc("fr_cpam_pieces.jpg", T, "fr", "health_insurance", "2026-11-05", None, "1 84 07 75 112 048 33",
    ["Assurance Maladie – CPAM de Paris", "75948 Paris Cedex 19", "", "Paris, le 10 octobre 2026"],
    ["**Demande de pièces justificatives", "Numéro de sécurité sociale : 1 84 07 75 112 048 33", "",
     "Madame, Monsieur,", "Pour finaliser l'ouverture de vos droits et l'envoi de votre carte Vitale,",
     "merci de nous transmettre un justificatif de domicile", "et une copie de votre titre de séjour",
     "avant le 05/11/2026 via votre compte ameli."], photo=True, seed=21)
doc("pt_seguro_saude.png", H, "pt", "health_insurance", "2026-11-10", 87.50, "PS-2026-55120",
    ["Médis – Seguro de Saúde", "Lisboa", "", "Lisboa, 13 de outubro de 2026"],
    ["**Aviso de prémio em atraso", "Apólice: PS-2026-55120", "",
     "Caro segurado,", "o prémio mensal de outubro do seu seguro de saúde", "ainda não foi pago.",
     "Valor em dívida: 87,50 €", "Pague até 10/11/2026 para manter a cobertura ativa."], direction="pay")
doc("en_health_insurer_claim.jpg", H, "en", "health_insurance", "2026-11-24", None, "HC-88213-UK",
    ["Bupa Global Health Insurance", "Claims Department", "", "15 October 2026"],
    ["**Request for information about your claim", "Claim number: HC-88213-UK", "",
     "Dear Ms Rahman,", "To assess your recent claim we need an itemised invoice",
     "from the clinic and your referral letter.", "Please send these by 24 November 2026, otherwise the claim",
     "will be closed. Your policy and coverage are not affected."], photo=True, seed=22)
# ---------------- debt collection ----------------
i2 = iban("DE", "37040044" + "0532013000")
doc("de_inkasso_mahnung.png", T, "de", "debt_collection", "2026-10-27", 186.40, "INK-2026-004471",
    ["Creditreform Inkasso GmbH", "Hammfelddamm 13, 41460 Neuss", "", "Neuss, 13.10.2026"],
    ["**Letzte Mahnung vor gerichtlichem Mahnverfahren", "Aktenzeichen: INK-2026-004471", "Gläubiger: Vodafone GmbH", "",
     "Hauptforderung: 129,90 €", "Mahngebühren und Verzugszinsen: 56,50 €", "Gesamtforderung: 186,40 €", "",
     "Bitte zahlen Sie die Gesamtforderung bis zum 27.10.2026", f"auf IBAN {spaced(i2)}."], iban_=spaced(i2), direction="pay")
doc("en_collection_final_demand.jpg", T, "en", "debt_collection", "2026-10-29", 245.18, "CA-772019",
    ["Lowell Financial Ltd", "Debt collection services", "", "14 October 2026"],
    ["**Final demand – overdue account", "Account reference: CA-772019", "Original creditor: EE Ltd", "",
     "Dear Mr Novak,", "Your account is in arrears. No interest has been added.",
     "Total due: €245.18", "Please pay in full by 29 October 2026 or contact us", "to agree a payment plan."], photo=True, seed=31, direction="pay")
doc("it_sollecito_crediti.png", H, "it", "debt_collection", "2026-11-03", 98.70, "RC-2026-11873",
    ["Credit Recovery Italia S.r.l.", "Via Torino 44, Milano", "", "Milano, 14 ottobre 2026"],
    ["**Sollecito di pagamento – messa in mora", "Pratica: RC-2026-11873", "Creditore: Fastweb S.p.A.", "",
     "Gentile cliente,", "risulta insoluto l'importo complessivo di 98,70 €.",
     "La invitiamo a saldare il debito entro il 03/11/2026.", "In mancanza procederemo per vie legali."], direction="pay")
doc("es_recobro_deuda.jpg", H, "es", "debt_collection", "2026-11-06", 312.55, "EXP-55-90321",
    ["Intrum Servicing Spain", "Departamento de recobro", "", "Madrid, 15 de octubre de 2026"],
    ["**Requerimiento de pago", "Expediente: EXP-55-90321", "Acreedor: Orange Espagne", "",
     "Estimado cliente:", "Le comunicamos una deuda pendiente por impago.", "Importe adeudado: 312,55 €",
     "Le rogamos realice el pago antes del 06/11/2026", "para evitar acciones judiciales."], photo=True, seed=32, direction="pay")
# ---------------- utility bill ----------------
doc("de_stromrechnung.png", T, "de", "utility_bill", "2026-10-28", 96.12, "7001234567",
    ["Stadtwerke Leipzig GmbH", "Augustusplatz 7, 04109 Leipzig", "", "Leipzig, 12.10.2026"],
    ["**Stromrechnung September 2026", "Kundennummer: 7001234567", "Zählernummer: 1ESY1160512345", "",
     "Verbrauch: 268 kWh", "Arbeitspreis: 268 kWh x 0,3120 € = 83,62 €", "Grundpreis: 12,50 €",
     "Rechnungsbetrag: 96,12 €", "Fällig am 28.10.2026. Der Betrag wird per Lastschrift eingezogen."], direction="pay")
doc("es_factura_luz.jpg", T, "es", "utility_bill", "2026-10-25", 73.48, "FE26-0918844",
    ["Iberdrola Clientes S.A.U.", "Factura de electricidad", "", "Fecha de emisión: 10/10/2026"],
    ["**Factura de luz", "Nº de factura: FE26-0918844", "CUPS: ES0021000012345678AB", "",
     "Potencia contratada: 4,6 kW", "Término de energía: 211 kWh", "Total factura: 73,48 €",
     "Fecha de cargo: 25/10/2026"], photo=True, seed=41, direction="pay")
doc("fr_facture_edf.png", H, "fr", "utility_bill", "2026-11-02", 58.90, "5044 8812 07",
    ["EDF – Électricité de France", "Service client particuliers", "", "Le 12 octobre 2026"],
    ["**Facture d'électricité", "Référence client : 5044 8812 07", "Point de livraison : 14 2958 3311 0045", "",
     "Consommation : 182 kWh", "Abonnement : 12,44 €", "Montant à payer : 58,90 € TTC",
     "À régler avant le 02/11/2026"], direction="pay")
doc("it_bolletta_enel.jpg", H, "it", "utility_bill", "2026-11-09", 121.35, "BL-2026-337781",
    ["Enel Energia S.p.A.", "Bolletta luce", "", "Roma, 16 ottobre 2026"],
    ["**Bolletta n. BL-2026-337781", "Codice POD: IT001E12345678", "",
     "Periodo: agosto - settembre 2026", "Consumi: 412 kWh", "Totale da pagare: 121,35 €",
     "Scadenza: 09/11/2026"], photo=True, seed=42, direction="pay")
# ---------------- benefits office ----------------
doc("de_jobcenter_mitwirkung.png", T, "de", "benefits_office", "2026-10-26", None, "70204BG0012345",
    ["Jobcenter Berlin Neukölln", "Mainzer Straße 27, 12053 Berlin", "", "Berlin, 12.10.2026"],
    ["**Aufforderung zur Mitwirkung – Bürgergeld", "Nummer der Bedarfsgemeinschaft: 70204BG0012345", "",
     "Sehr geehrte Frau Petrenko,", "für die Weiterbewilligung benötigen wir:", "- Kontoauszüge der letzten 3 Monate",
     "- Mietbescheinigung", "Bitte reichen Sie die Unterlagen bis zum 26.10.2026 ein.",
     "Ohne Mitwirkung können Leistungen versagt werden (§ 66 SGB I)."])
doc("en_universal_credit.jpg", T, "en", "benefits_office", "2026-10-31", None, "UC-4471920",
    ["Department for Work and Pensions", "Universal Credit", "", "16 October 2026"],
    ["**Action needed on your Universal Credit claim", "Claim reference: UC-4471920", "",
     "Dear Mr Ahmadi,", "Your work coach needs proof of your rent and your", "bank statements for September.",
     "Upload them to your journal by 31 October 2026.", "If you do not, your payments may stop."], photo=True, seed=51)
doc("fr_caf_justificatifs.png", H, "fr", "benefits_office", "2026-11-12", None, "1234567 A",
    ["Caisse d'allocations familiales du Rhône", "69849 Lyon Cedex", "", "Lyon, le 13 octobre 2026"],
    ["**Demande de justificatifs – prime d'activité", "Numéro allocataire : 1234567 A", "",
     "Madame,", "pour continuer à vous verser vos prestations, nous avons besoin",
     "de vos trois derniers bulletins de salaire.", "Merci de les déposer sur caf.fr avant le 12/11/2026."])
doc("es_sepe_cita.jpg", H, "es", "benefits_office", "2026-10-29", None, "SEPE-2026-881204",
    ["Servicio Público de Empleo Estatal (SEPE)", "Oficina de Sevilla", "", "Sevilla, 14 de octubre de 2026"],
    ["**Citación – prestación por desempleo", "Expediente: SEPE-2026-881204", "",
     "Estimado/a beneficiario/a:", "Se le cita en la oficina el día 29/10/2026 a las 10:30 h",
     "para revisar su prestación por desempleo.", "Traiga su DNI o NIE.", "La no comparecencia puede suponer la suspensión."], photo=True, seed=52)
# ---------------- broadcast fee ----------------
i3 = iban("DE", "37050198" + "0000016220")
doc("de_rundfunkbeitrag.png", T, "de", "broadcast_fee", "2026-11-15", 55.08, "472 518 309",
    ["ARD ZDF Deutschlandradio Beitragsservice", "50656 Köln", "", "Köln, 13.10.2026"],
    ["**Zahlungsaufforderung Rundfunkbeitrag", "Beitragsnummer: 472 518 309", "",
     "Sehr geehrter Herr Kowalski,", "für Ihre Wohnung ist der Rundfunkbeitrag zu zahlen.",
     "Zeitraum: 10.2026 bis 12.2026", "Zu zahlen: 55,08 Euro", "fällig zum 15.11.2026",
     f"IBAN: {spaced(i3)}"], iban_=spaced(i3), direction="pay")
doc("en_tv_licence.jpg", T, "en", "broadcast_fee", "2026-11-01", 174.50, "1234 5678 90",
    ["TV Licensing", "Darlington DL98 1TL", "", "12 October 2026"],
    ["**Your TV Licence is due for renewal", "Licence number: 1234 5678 90", "",
     "The licence fee for the coming year is the same as last year.", "Amount due: £174.50", "Please renew by 1 November 2026",
     "or tell us if you no longer need a licence."], photo=True, seed=61, direction="pay", cur="GBP")
doc("it_canone_rai.png", H, "it", "broadcast_fee", "2026-11-30", 90.00, "CN-2026-448190",
    ["Rai – Canone TV", "Direzione abbonamenti", "", "Torino, 15 ottobre 2026"],
    ["**Canone di abbonamento alla televisione 2026", "Codice: CN-2026-448190", "",
     "Gentile utente,", "risulta non pagato il canone TV per l'anno 2026.", "Importo: 90,00 euro",
     "Il versamento va effettuato entro il 30/11/2026.", "Se non possiedi un televisore puoi presentare dichiarazione."], direction="pay")
doc("fr_serafe_redevance.jpg", H, "fr", "broadcast_fee", "2026-11-18", 335.00, "8100.4422.9017",
    ["Serafe AG – Redevance radio-télévision", "Case postale, 8010 Zurich", "", "Zurich, le 14 octobre 2026"],
    ["**Facture redevance radio-télévision 2026", "Numéro de client : 8100.4422.9017", "",
     "Madame, Monsieur,", "Montant de la redevance : 335,00 EUR", "Échéance : 18/11/2026",
     "Les personnes qui touchent des prestations complémentaires", "peuvent demander une exonération."], photo=True, seed=62, direction="pay")

json.dump(exp, open(OUT / "expected.json", "w"), indent=1, ensure_ascii=False)
print(len(exp), "docs")
