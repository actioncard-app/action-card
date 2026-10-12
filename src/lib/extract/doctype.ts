import type { DocType, Field, Confidence } from '../types';
import { fold, foldDoc, phraseRe, snippetFor } from './normalize';

// Folded (lowercase, no accents) keywords. weight 3 = strong, specific phrase; 1 = supporting word.
const KW: Record<Exclude<DocType, 'unknown'>, [string, number][]> = {

  tax_office: [
    ['finanzamt', 3], ['steuerbescheid', 3], ['einkommensteuer', 3], ['steuernummer', 3], ['steuer-id', 2], ['steuererklarung', 3], ['umsatzsteuer', 2], ['steuerpflichtig', 2], ['festsetzung', 1], ['nachzahlung', 1], ['steuer', 1],
    ['hmrc', 3], ['tax return', 3], ['self assessment', 3], ['income tax', 3], ['tax office', 3], ['internal revenue service', 3], ['tax year', 2], ['unique taxpayer reference', 3], ['utr', 2], ['tax', 1],
    ['impots', 3], ['avis d\'imposition', 3], ['finances publiques', 3], ['dgfip', 3], ['impot sur le revenu', 3], ['numero fiscal', 3], ['taxe d\'habitation', 3], ['taxe fonciere', 3], ['declaration de revenus', 3],
    ['agencia tributaria', 3], ['hacienda', 3], ['aeat', 3], ['irpf', 3], ['declaracion de la renta', 3], ['requerimiento', 1], ['tributaria', 2], ['liquidacion provisional', 3],
    ['agenzia delle entrate', 3], ['cartella di pagamento', 3], ['irpef', 3], ['avviso bonario', 3], ['dichiarazione dei redditi', 3], ['codice fiscale', 1], ['tributi', 2],
    ['autoridade tributaria', 3], ['portal das financas', 3], ['financas', 2], ['nota de liquidacao', 3], ['imposto', 2], ['irs', 2], ['nif', 1], ['declaracao de rendimentos', 3],
  ],
  health_insurance: [
    ['krankenkasse', 3], ['krankenversicherung', 3], ['versichertennummer', 3], ['aok', 2], ['techniker krankenkasse', 3], ['barmer', 2], ['versicherungsschutz', 2], ['gesundheitskarte', 3], ['pflegeversicherung', 2],
    ['health insurance', 3], ['health insurer', 3], ['nhs', 2], ['medical insurance', 3], ['insurance number', 2], ['policyholder', 2], ['premium', 1], ['coverage', 1],
    ['assurance maladie', 3], ['cpam', 3], ['ameli', 3], ['mutuelle', 3], ['carte vitale', 3], ['numero de securite sociale', 2], ['complementaire sante', 3],
    ['seguro medico', 3], ['seguro de salud', 3], ['tarjeta sanitaria', 3], ['aseguradora', 2], ['poliza', 1], ['asegurado', 1],
    ['assicurazione sanitaria', 3], ['tessera sanitaria', 3], ['servizio sanitario', 3], ['asl', 2], ['polizza', 1],
    ['seguro de saude', 3], ['numero de utente', 3], ['servico nacional de saude', 3], ['sns', 2], ['apolice', 1], ['segurado', 1],
  ],
  debt_collection: [
    ['inkasso', 3], ['inkassobuero', 3], ['inkassoburo', 3], ['mahnung', 3], ['zahlungserinnerung', 3], ['letzte mahnung', 3], ['hauptforderung', 3], ['mahngebuhr', 3], ['mahnbescheid', 3], ['forderung', 2], ['glaubiger', 2], ['zahlungsverzug', 3], ['verzugszinsen', 3],
    ['debt collection', 3], ['collection agency', 3], ['debt collector', 3], ['final reminder', 3], ['final demand', 3], ['overdue', 2], ['outstanding balance', 3], ['arrears', 3], ['creditor', 2], ['payment reminder', 3],
    ['recouvrement', 3], ['mise en demeure', 3], ['relance', 2], ['creance', 3], ['impaye', 3], ['huissier', 3], ['injonction de payer', 3],
    ['recobro', 3], ['requerimiento de pago', 3], ['deuda', 2], ['impago', 3], ['acreedor', 2], ['moroso', 3], ['reclamacion de deuda', 3],
    ['recupero crediti', 3], ['sollecito di pagamento', 3], ['messa in mora', 3], ['diffida', 2], ['creditore', 2], ['insoluto', 3], ['debito', 1],
    ['recuperacao de credito', 3], ['cobranca', 3], ['divida', 2], ['credor', 2], ['incumprimento', 2], ['interpelacao', 3], ['em atraso', 2],
  ],
  utility_bill: [
    ['stromrechnung', 3], ['jahresabrechnung', 3], ['abschlag', 2], ['abschlagszahlung', 3], ['stadtwerke', 3], ['kwh', 2], ['verbrauch', 2], ['netzentgelt', 3], ['grundpreis', 2], ['arbeitspreis', 3], ['strom', 1], ['erdgas', 2], ['zahlernummer', 2], ['kundennummer', 1],
    ['electricity', 2], ['energy bill', 3], ['gas bill', 3], ['water bill', 3], ['meter reading', 2], ['standing charge', 3], ['unit rate', 3], ['broadband', 2], ['mobile bill', 3], ['account number', 1],
    ['facture d\'electricite', 3], ['edf', 2], ['engie', 2], ['consommation', 2], ['abonnement', 1], ['releve', 1], ['electricite', 2], ['point de livraison', 3],
    ['factura de luz', 3], ['iberdrola', 3], ['endesa', 3], ['naturgy', 3], ['potencia contratada', 3], ['termino de energia', 3], ['consumo', 2], ['cups', 2], ['electricidad', 2],
    ['bolletta', 3], ['enel', 3], ['fornitura', 2], ['consumi', 2], ['codice pod', 3], ['pod', 1], ['energia elettrica', 3], ['spesa per la materia energia', 3],
    ['edp', 3], ['fatura de eletricidade', 3], ['eletricidade', 2], ['potencia contratada', 3], ['cpe', 2], ['leitura', 1],
  ],
  benefits_office: [
    ['jobcenter', 3], ['burgergeld', 3], ['agentur fur arbeit', 3], ['arbeitsagentur', 3], ['mitwirkungspflicht', 3], ['sozialamt', 3], ['wohngeld', 3], ['kindergeld', 3], ['familienkasse', 3], ['elterngeld', 3], ['leistungsbescheid', 3], ['bedarfsgemeinschaft', 3], ['weiterbewilligungsantrag', 3],
    ['universal credit', 3], ['dwp', 3], ['jobcentre', 3], ['housing benefit', 3], ['child benefit', 3], ['jobseeker', 3], ['benefit', 1], ['benefits', 2], ['work coach', 3],
    ['caf', 3], ['allocations familiales', 3], ['france travail', 3], ['pole emploi', 3], ['rsa', 2], ['apl', 2], ['prime d\'activite', 3], ['allocataire', 3],
    ['sepe', 3], ['prestacion por desempleo', 3], ['ingreso minimo vital', 3], ['seguridad social', 2], ['subsidio', 2], ['prestacion', 1],
    ['inps', 3], ['naspi', 3], ['assegno unico', 3], ['centro per l\'impiego', 3], ['reddito di cittadinanza', 3], ['assegno di inclusione', 3],
    ['seguranca social', 3], ['iefp', 3], ['subsidio de desemprego', 3], ['prestacao social', 3], ['abono de familia', 3], ['rendimento social de insercao', 3],
  ],
  broadcast_fee: [
    ['rundfunkbeitrag', 3], ['beitragsservice', 3], ['ard zdf deutschlandradio', 3], ['beitragsnummer', 3], ['rundfunk', 2], ['gez', 2], ['wohnung', 1],
    ['tv licence', 3], ['tv licensing', 3], ['licence fee', 3], ['television licence', 3],
    ['redevance audiovisuelle', 3], ['contribution a l\'audiovisuel public', 3], ['serafe', 3], ['redevance radio-television', 3],
    ['canone rai', 3], ['canone tv', 3], ['canone di abbonamento', 3], ['abbonamento alla televisione', 3], ['rai', 1],
    ['contribuicao audiovisual', 3], ['tasa de radiotelevision', 3], ['orf-beitrag', 3], ['gis', 1],
  ],
  parking_fine: [
    // en
    ['parking ticket', 3], ['penalty charge notice', 3], ['penalty charge', 3], ['parking fine', 3], ['traffic fine', 3], ['speeding', 2], ['fixed penalty', 3], ['pcn', 2], ['citation', 1], ['violation', 1], ['vehicle registration', 1], ['parking', 1], ['fine', 1],
    // de
    ['verwarnungsgeld', 3], ['verwarnung', 2], ['bußgeldbescheid', 3], ['bussgeldbescheid', 3], ['bußgeld', 3], ['bussgeld', 3], ['bußgeldstelle', 3], ['halteverbot', 3], ['parkverbot', 3], ['ordnungswidrigkeit', 3], ['tatort', 2], ['tatzeit', 2], ['tattag', 2], ['kennzeichen', 1], ['stvo', 2], ['geschwindigkeit', 1], ['hochstgeschwindigkeit', 2], ['verkehrsuberwachung', 3], ['einspruch', 1],
    // fr
    ['avis de contravention', 3], ['contravention', 3], ['amende forfaitaire', 3], ['amende', 2], ['forfait post-stationnement', 3], ['stationnement', 2], ['infraction', 1], ['immatriculation', 1],
    // es
    ['boletin de denuncia', 3], ['denuncia', 2], ['multa', 2], ['estacionamiento', 2], ['infraccion', 2], ['dgt', 2], ['sancion', 1], ['matricula', 1],
    // it
    ['verbale di accertamento', 3], ['contravvenzione', 3], ['divieto di sosta', 3], ['codice della strada', 3], ['verbale', 1], ['violazione', 1], ['targa', 1], ['sanzione', 1],
    // pt
    ['auto de contraordenacao', 3], ['contraordenacao', 3], ['coima', 3], ['estacionamento proibido', 3], ['infracao', 2],
  ],
  medicine_label: [
    ['tablets', 2], ['capsules', 2], ['dosage', 2], ['keep out of the reach', 3], ['keep out of reach', 3], ['pharmacist', 2], ['side effects', 2], ['active ingredient', 3], ['medicine', 1], ['leaflet', 2],
    ['tabletten', 2], ['filmtabletten', 3], ['kapseln', 2], ['dosierung', 3], ['packungsbeilage', 3], ['arzneimittel', 3], ['apotheke', 1], ['verwendbar bis', 3], ['wirkstoff', 3],
    ['comprimes', 3], ['comprime', 2], ['gelules', 3], ['posologie', 3], ['notice', 1], ['medicament', 3], ['voie orale', 3], ['pharmacien', 2], ['hors de la vue et de la portee des enfants', 3], ['portee des enfants', 3],
    ['comprimidos', 3], ['capsulas', 2], ['posologia', 3], ['prospecto', 3], ['medicamento', 3], ['via oral', 3], ['farmaceutico', 2], ['fuera de la vista y del alcance', 3],
    ['compresse', 3], ['capsule', 2], ['foglio illustrativo', 3], ['medicinale', 3], ['farmaco', 2], ['farmacista', 2], ['via orale', 3], ['principio attivo', 3],
    ['folheto informativo', 3], ['via oral', 3], ['substancia ativa', 3], ['fora da vista e do alcance', 3],
    ['eye drops', 3], ['ear drops', 3], ['drops', 2], ['ointment', 3], ['syrup', 2], ['directions', 1], ['store in a refrigerator', 2], ['w/v', 2],
    ['augentropfen', 3], ['tropfen', 2], ['salbe', 2], ['sirup', 2], ['collyre', 3], ['gouttes', 2], ['pommade', 2], ['sirop', 2],
    ['colirio', 3], ['gotas', 2], ['pomada', 2], ['jarabe', 2], ['collirio', 3], ['gocce', 2], ['sciroppo', 2], ['xarope', 2],
    ['mg', 1], ['ml', 1],
  ],
  airline_cancellation: [
    ['flight', 2], ['airways', 3], ['airlines', 3], ['airline', 3], ['boarding', 2], ['rebooking', 2], ['booking reference', 1], ['departure', 1], ['passenger', 2], ['uk261', 3], ['eu261', 3], ['261/2004', 3], ['gate', 1],
    ['flug', 3], ['fluggesellschaft', 3], ['abflug', 2], ['passagier', 2], ['fluggast', 3], ['umbuchung', 2],
    ['vol', 2], ['compagnie aerienne', 3], ['passager', 2], ['embarquement', 2],
    ['vuelo', 3], ['aerolinea', 3], ['pasajero', 2], ['embarque', 1],
    ['volo', 3], ['compagnia aerea', 3], ['passeggero', 2], ['imbarco', 2],
    ['voo', 3], ['companhia aerea', 3], ['passageiro', 2],
    // cancellation / ticket words in all 6 languages
    ['cancelled', 1], ['canceled', 1], ['annulliert', 1], ['annule', 1], ['cancelado', 1], ['cancellato', 1],
    ['billet', 1], ['ticket', 1], ['billete', 1], ['biglietto', 1], ['bilhete', 1], ['flugticket', 2],
    ['reacheminement', 3], ['riprotezione', 3], ['remarcacao', 2], ['cambio de vuelo', 3], ['carte d\'embarquement', 3], ['boarding pass', 3], ['bordkarte', 3],
  ],
  hotel_cancellation: [
    ['hotel', 3], ['cancellation policy', 3], ['free cancellation', 3], ['no-show', 2], ['check-in', 1], ['check-out', 1], ['night', 1], ['nights', 1], ['room', 1], ['reservation', 1], ['stay', 1],
    ['stornierungsbedingungen', 3], ['stornogebuhr', 3], ['zimmer', 1], ['ubernachtung', 2], ['nacht', 1], ['buchung', 1],
    ['conditions d\'annulation', 3], ['annulation gratuite', 3], ['chambre', 1], ['nuit', 1], ['nuits', 1], ['sejour', 1], ['hotel', 3],
    ['politica de cancelacion', 3], ['cancelacion gratuita', 3], ['habitacion', 1], ['noche', 1], ['noches', 1], ['estancia', 1],
    ['politica di cancellazione', 3], ['cancellazione gratuita', 3], ['mancata presentazione', 3], ['camera doppia', 2], ['camera', 1], ['notti', 1], ['notte', 1], ['soggiorno', 2], ['prenotazione', 1], ['albergo', 3], ['reception', 1], ['arrivo', 1],
    ['politica de cancelamento', 3], ['cancelamento gratuito', 3], ['quarto', 1], ['noite', 1], ['noites', 1], ['estadia', 1],
  ],
  visa_entry: [
    ['visa', 3], ['embassy', 3], ['consulate', 3], ['residence permit', 3], ['immigration', 3], ['entry form', 3], ['passport', 2], ['appointment', 1], ['biometric', 2],
    ['visum', 3], ['botschaft', 3], ['konsulat', 3], ['aufenthaltstitel', 3], ['aufenthaltserlaubnis', 3], ['auslanderbehorde', 3], ['einreise', 2], ['reisepass', 2],
    ['titre de sejour', 3], ['prefecture', 3], ['consulat', 3], ['ambassade', 3], ['passeport', 2], ['rendez-vous', 1], ['pieces manquantes', 2], ['timbre fiscal', 2],
    ['visado', 3], ['consulado', 3], ['embajada', 3], ['permiso de residencia', 3], ['extranjeria', 3], ['pasaporte', 2], ['cita previa', 2],
    ['visto', 3], ['consolato', 3], ['ambasciata', 3], ['permesso di soggiorno', 3], ['questura', 3], ['passaporto', 2], ['appuntamento', 1],
    ['embaixada', 3], ['autorizacao de residencia', 3], ['seccao consular', 3], ['passaporte', 2], ['agendamento', 2], ['entrevista', 1], ['aima', 2],
  ],
  rental_move_in: [
    ['tenancy', 3], ['tenant', 2], ['landlord', 2], ['security deposit', 3], ['inventory', 2], ['move-in', 3], ['lease', 2], ['check-in report', 3],
    ['mietvertrag', 3], ['mieter', 2], ['vermieter', 2], ['kaution', 3], ['ubergabeprotokoll', 3], ['wohnungsubergabe', 3], ['zahlerstand', 2],
    ['etat des lieux', 3], ['depot de garantie', 3], ['locataire', 2], ['bailleur', 2], ['bail', 2], ['inventaire', 2],
    ['arrendatario', 3], ['arrendador', 3], ['arrendamiento', 3], ['fianza', 3], ['inventario', 2], ['entrega de llaves', 3], ['inquilino', 2], ['alquiler', 2], ['inmueble', 2], ['vivienda', 1], ['contadores', 1],
    ['contratto di locazione', 3], ['locatore', 2], ['conduttore', 2], ['deposito cauzionale', 3], ['verbale di consegna', 3], ['caparra', 2],
    ['contrato de arrendamento', 3], ['senhorio', 3], ['arrendatario', 3], ['caucao', 3], ['vistoria', 2], ['inquilino', 2],
  ],
};

const RES = Object.fromEntries(
  Object.entries(KW).map(([t, list]) => [t, list.map(([p, w]) => [phraseRe([p]), w] as const)]),
) as unknown as Record<Exclude<DocType, 'unknown'>, (readonly [RegExp, number])[]>;

export function detectDocType(text: string): Field<DocType> & { scores: Record<string, number> } {
  const f = foldDoc(text);
  const scores: Record<string, number> = {};
  const firstHit: Record<string, { start: number; end: number; w: number }> = {};
  for (const [type, list] of Object.entries(RES)) {
    let s = 0;
    for (const [re, w] of list) {
      re.lastIndex = 0;
      const n = Math.min(3, (f.match(re) ?? []).length); // cap repeats
      if (n) {
        s += w * (1 + (n - 1) * 0.3);
        re.lastIndex = 0;
        const m = re.exec(f);
        if (m && (!firstHit[type] || w > firstHit[type].w)) firstHit[type] = { start: m.index, end: m.index + m[0].length, w };
      }
    }
    // "500 mg", "10 ml" style dosage hints
    if (type === 'medicine_label') {
      s += Math.min(3, (f.match(/\d\s?(mg|ml|µg|mcg)\b/g) ?? []).length) * 1.5;
      // pack expiry code "EXP 02/2028" / "Scad. 11/2027" / "Verw. bis 08.2027" (month/year only) is typical of medicine packs
      if (/(?<![a-z])(exp|scad|cad|val|verw\.?\s*bis|verwendbar bis)\.?\s*:?\s*\d{2}\s*[\/.-]\s*(\d{4}|\d{2})(?![\/.\-]?\d)/.test(f)) s += 3;
    }
    scores[type] = Math.round(s * 10) / 10;
  }
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const [best, second] = ranked;
  if (scores[best] < 3) return { value: 'unknown', snippet: null, confidence: 'low', scores, note: 'No clear document-type keywords found.' };
  const margin = scores[best] - scores[second];
  const confidence: Confidence = margin >= 6 && scores[best] >= 8 ? 'high' : margin >= 3 ? 'medium' : 'low';
  const hit = firstHit[best];
  return {
    value: best as DocType,
    snippet: hit ? snippetFor(text, hit.start, hit.end) : null,
    confidence,
    scores,
  };
}
