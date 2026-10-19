// Hides personal data before anything is sent in AI mode. Runs on the phone, offline.
// Names, street addresses, postcodes, IBANs and account/customer numbers, tax and social-security IDs, phone numbers,
// e-mail addresses, dates of birth and file/reference numbers are replaced with placeholders like [NAME_1]. The
// placeholder map never leaves the phone; the AI answer is mapped back locally (restore()) so the card shows the real
// values and every snippet still matches the original OCR text. Best effort: pattern- and label-based, so the user
// is shown exactly what will be sent (and can cancel) before every send.
export type PiiKind = 'NAME' | 'ADDRESS' | 'IBAN' | 'ACCOUNT' | 'TAX_ID' | 'PHONE' | 'EMAIL' | 'BIRTH_DATE' | 'REF';
export interface Redaction { text: string; map: Record<string, string>; items: { placeholder: string; kind: PiiKind }[] }

const L = String.raw`[A-ZÀ-ÖØ-ÞĀ-ſ][a-zß-öø-ÿā-ſ'’-]+`;
const W = '[ \\t]'; // a space inside one line (names and addresses never run over a line break) // a capitalised word (Latin script)
const DATE = String.raw`\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\.?\s+[A-Za-zÀ-ÿ]{3,10}\.?\s+\d{4}`;
const SEP = String.raw`\s*(?:[:.#]|n[°ºo]\.?|nr\.?|no\.?|number)?\s*`;
const VAL = String.raw`([A-Z0-9][A-Z0-9./\- ]{2,30}[A-Z0-9])`; // an identifier containing at least one digit (checked below)

// label-based identifiers: [kind, labels]
const LABELLED: [PiiKind, string][] = [
  ['TAX_ID', String.raw`steuer-?\s?id(?:entifikationsnummer)?|steuernummer|st\.?-?\s?nr|idnr|sozialversicherungs(?:nummer)?|rentenversicherungsnummer|versicherungsnummer|krankenversichertennummer|versichertennummer|social security(?: number)?|ssn|national insurance(?: number)?|ni number|tax (?:id|identification number|reference)|utr|nif|nie|dni|nss|nir|n[°º]? de s[ée]curit[ée] sociale|num[ée]ro (?:fiscal|de s[ée]curit[ée] sociale)|codice fiscale|partita iva|n[úu]mero de (?:identifica[cç][aã]o fiscal|seguran[cç]a social)|niss|nuss|pesel|nip|tc kimlik(?: no)?|vergi (?:kimlik )?no`],
  ['ACCOUNT', String.raw`konto(?:nummer|-?nr)?|kundennummer|kunden-?nr|vertragsnummer|vertragskonto|mitgliedsnummer|policennummer|versicherungsscheinnummer|account(?: number| no)?|customer (?:number|no|id)|contract (?:number|no)|policy (?:number|no)|membership (?:number|no)|n[°º]? (?:de )?client|num[ée]ro (?:de )?(?:client|contrat|compte)|n[úu]mero de (?:cliente|contrato|cuenta|p[óo]liza)|codice cliente|numero (?:cliente|contratto|polizza)|n[úu]mero de (?:conta|ap[óo]lice)`],
  ['REF', String.raw`aktenzeichen|az|gesch[äa]ftszeichen|kassenzeichen|ihr zeichen|unser zeichen|vorgangs?nummer|bescheidnummer|buchungszeichen|rechnungsnummer|mahnnummer|reference(?: number| no)?|ref|your ref|our ref|case (?:number|no|reference)|file (?:number|no)|claim (?:number|no)|invoice (?:number|no)|booking (?:reference|number)|r[ée]f[ée]rence|n[°º]? de dossier|num[ée]ro de (?:dossier|facture|r[ée]f[ée]rence)|expediente|n[úu]mero de (?:expediente|referencia|factura)|referencia|riferimento|protocollo|pratica|numero (?:pratica|fattura|verbale)|verbale n|processo|refer[êe]ncia|n[úu]mero (?:do processo|da fatura)|auto n`],
];
const BIRTH = String.raw`geboren am|geb\.|geburtsdatum|date of birth|d\.?o\.?b\.?|born(?: on)?|n[ée]\(?e?\)? le|date de naissance|fecha de nacimiento|nacido el|data di nascita|nat[oa] il|data de nascimento|nascid[oa] em`;
const TITLE = String.raw`Herrn?|Frau|Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?|Monsieur|Madame|Mme\.?|M\.|Mlle|Señora?|Sra?\.|Don|Doña|Signora?|Sig\.(?:ra)?|Senhora?|Exm[oa]\.?(?:\s+Sr[a]?\.?)?`;
const NOT_NAME = /^(?:sir|madam|madame|sirs|customer|kunde|kundin|damen|herren|client|cliente|signori|senhores|señores)$/i;
const ORG = /\b(?:stadt|amt|kasse|gmbh|ag|kg|e\.?v\.?|bank|sparkasse|finanzamt|jobcenter|agentur|beh[öo]rde|beitragsservice|krankenkasse|versicherung|office|council|ministry|department|ltd|plc|inc|mairie|pr[ée]fecture|caf|cpam|ayuntamiento|agencia|comune|agenzia|inps|c[âa]mara|servi[cç]o|finan[cç]as|university|universit|hotel|airlines?|air)\b/i;
const STREETS: RegExp[] = [
  // German: Lindenstraße 12, Am Hang 3a is not caught (no street word) - the postcode line usually is
  new RegExp(String.raw`(?:${L}(?:stra(?:ß|ss)e|str\.|weg|gasse|platz|allee|ring|damm|ufer|chaussee)|(?:${L}${W})+(?:Stra(?:ß|ss)e|Str\.|Weg|Gasse|Platz|Allee|Ring|Damm))${W}*\d+${W}?[a-zA-Z]?\b`, 'g'),
  // English: 221B Baker Street
  new RegExp(String.raw`\b\d+[A-Za-z]?,?${W}+(?:${L}${W}){0,3}(?:Street|St\.?|Road|Rd\.?|Lane|Ln\.?|Avenue|Ave\.?|Drive|Close|Way|Place|Court|Crescent|Terrace|Gardens)\b`, 'g'),
  // French / Spanish / Italian / Portuguese: Via Roma 10, Calle Mayor 5, Rua Augusta 100, 12 rue de la Paix
  new RegExp(String.raw`\b(?:rue|avenue|av\.|boulevard|bd|chemin|all[ée]e|impasse|calle|c\/|avenida|avda\.?|plaza|paseo|carrer|via|viale|piazza|corso|vicolo|largo|rua|travessa|pra[cç]a|estrada)${W}+(?:(?:de|del|della|di|da|do|dos|das|la|le|les|des|du)${W}+){0,2}(?:${L}${W}?){1,4},?${W}*(?:n[°º.]?${W}*)?\d+[a-z]?\b`, 'gi'),
  new RegExp(String.raw`\b\d{1,4}[a-z]?,?${W}+(?:rue|avenue|boulevard|bd|chemin|all[ée]e|impasse|place)${W}+(?:(?:de|du|des|la|le|les)${W}+){0,2}(?:${L}${W}?){1,4}`, 'gi'),
];
// (never right after a date or number: "06.11.2026 Bitte" is a date, not a postcode; 19xx/20xx alone is a year)
const POSTCODE = String.raw`(?<![\d.,/-])\b(?:D-|A-|CH-|F-|I-|E-|P-)?\d{5}${W}+${L}(?:(?:${W}|-)${L})?\b|(?<![\d.,/-])\b(?:\d{4}-\d{3}|(?!19|20)\d{4})${W}+${L}(?:(?:${W}|-)${L})?\b|\b[A-Z]{1,2}\d[A-Z\d]?${W}\d[A-Z]{2}\b`;

export function redact(text: string, opts: { known?: { value: string | null | undefined; kind: PiiKind }[] } = {}): Redaction {
  const map: Record<string, string> = {};
  const byValue = new Map<string, string>();
  const counters: Partial<Record<PiiKind, number>> = {};
  const items: Redaction['items'] = [];
  const ph = (kind: PiiKind, value: string): string => {
    const key = kind + '|' + value.replace(/\s+/g, ' ').trim().toLowerCase();
    let p = byValue.get(key);
    if (!p) {
      counters[kind] = (counters[kind] ?? 0) + 1;
      p = `[${kind}_${counters[kind]}]`;
      byValue.set(key, p); map[p] = value; items.push({ placeholder: p, kind });
    }
    return p;
  };
  let t = text;
  const hasDigit = (s: string) => /\d/.test(s);
  // 1. exact values the rules already found (reference, IBAN) - also catches them where no label is printed
  for (const k of opts.known ?? []) {
    const v = k.value?.trim();
    if (!v || v.length < 4) continue;
    const flexible = v.replace(/[\s]/g, '').split('').map((c) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('\\s?');
    t = t.replace(new RegExp(flexible, 'gi'), (m) => ph(k.kind, m));
  }
  // 2. e-mail, IBAN, card numbers, phone numbers
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => ph('EMAIL', m));
  t = t.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g, (m) => ph('IBAN', m));
  t = t.replace(/\b(?:\d{4}[\s-]){3}\d{1,7}\b/g, (m) => ph('ACCOUNT', m));
  t = t.replace(new RegExp(String.raw`((?:tel(?:efon|éfono|efone|efono|éphone)?|phone|mobil(?:e|telefon)?|handy|cell|fax|tél|móvil|cellulare|telemóvel)\.?${SEP})(\+?[\d][\d\s/().-]{5,}\d)`, 'gi'), (_m, lab, num) => lab + ph('PHONE', num));
  t = t.replace(/(?:\+|\b00)\d{1,3}[\s/.-]?\(?\d{1,5}\)?(?:[\s/.-]?\d{2,}){2,}/g, (m) => ph('PHONE', m));
  // 3. date of birth (label + date)
  t = t.replace(new RegExp(String.raw`((?:${BIRTH})\s*:?\s*)(${DATE})`, 'gi'), (_m, lab, d) => lab + ph('BIRTH_DATE', d));
  // 4. labelled identifiers
  for (const [kind, labels] of LABELLED) {
    t = t.replace(new RegExp(String.raw`(\b(?:${labels})\b${SEP})${VAL}`, 'gi'), (m, lab, v: string) => {
      const val = v.replace(/\s+[A-Za-z]{3,}.*$/, ''); // stop before the next word
      if (!hasDigit(val) || val.startsWith('[')) return m;
      return lab + ph(kind, val) + v.slice(val.length);
    });
  }
  // well-known ID formats without a label: Italian codice fiscale, Spanish DNI/NIE, UK National Insurance number
  t = t.replace(/\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/g, (m) => ph('TAX_ID', m));
  t = t.replace(/\b[XYZ]?\d{7,8}-?[A-HJ-NP-TV-Z]\b/g, (m) => ph('TAX_ID', m));
  t = t.replace(/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g, (m) => ph('TAX_ID', m));
  // 5. names after a title / salutation
  t = t.replace(new RegExp(String.raw`(\b(?:${TITLE})(?:${W}+|\n))((?:(?:${L}|[A-Z]\.)${W}?){1,3})`, 'g'), (m, title, name: string) => {
    const n = name.trim();
    if (!n || NOT_NAME.test(n.split(/\s+/)[0]) || ORG.test(n)) return m;
    return title + ph('NAME', n) + (name.endsWith(' ') ? ' ' : '');
  });
  t = t.replace(new RegExp(String.raw`(\b(?:Dear|Liebe[r]?|Hallo|Cher|Chère|Querid[oa]|Car[oa]|Gentile|Estimad[oa])${W}+)((?:${L}${W}?){1,3})`, 'g'), (m, lead, name: string) => {
    const n = name.trim();
    if (NOT_NAME.test(n.split(/\s+/)[0]) || /^(?:Herr|Frau|Mr|Mrs|Ms|Monsieur|Madame|Señor|Señora|Signor|Signora|Senhor|Senhora|Sir|Madam)/.test(n)) return m;
    return lead + ph('NAME', n) + (name.endsWith(' ') ? ' ' : '');
  });
  t = t.replace(new RegExp(String.raw`(\b(?:Name|Vorname|Nachname|Familienname|Nom|Prénom|Nombre|Apellidos?|Nome|Cognome|Apelido)${W}*:${W}*)((?:${L}[ ,]?){1,4})`, 'g'), (m, lab, name: string) => {
    const n = name.replace(/[ ,]+$/, '');
    return ORG.test(n) ? m : lab + ph('NAME', n) + name.slice(n.length);
  });
  // 6. street addresses and postcode + town; a plain name line right above an address line is the addressee
  const lines = t.split('\n');
  const rePost = new RegExp(POSTCODE, 'g');
  for (let i = 0; i < lines.length; i++) {
    const before = lines[i];
    for (const re of STREETS) lines[i] = lines[i].replace(re, (m) => (m.includes('[') ? m : ph('ADDRESS', m)));
    lines[i] = lines[i].replace(rePost, (m) => (/^\d{4}\s+(?:EUR|Euro|Uhr|CHF)\b/i.test(m) ? m : ph('ADDRESS', m)));
    if (lines[i] !== before && i > 0) {
      const prev = lines[i - 1].trim();
      if (new RegExp(String.raw`^(?:(?:${TITLE})${W}+)?(?:${L}${W}){1,3}${L}$`).test(prev) && !ORG.test(prev) && prev.length < 45) lines[i - 1] = lines[i - 1].replace(prev, ph('NAME', prev));
    }
  }
  t = lines.join('\n');
  // 7. a known name anywhere else in the text (e.g. repeated in the body)
  for (const [p, v] of Object.entries(map)) {
    if (!p.startsWith('[NAME_') || v.length < 4) continue;
    t = t.split(v).join(p);
  }
  return { text: t, map, items };
}

/** Put the real values back into every string of the AI's answer (deep). Unknown placeholders are left as they are. */
export function restore<T>(value: T, map: Record<string, string>): T {
  if (typeof value === 'string') return value.replace(/\[[A-Z_]+_\d+\]/g, (p) => map[p] ?? p) as T;
  if (Array.isArray(value)) return value.map((v) => restore(v, map)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v, map)])) as T;
  return value;
}
