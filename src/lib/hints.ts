// "Things to double-check": rule-based warning signs that are common in fake payment letters and scam messages.
// Deliberately phrased as checks, never as "this is a scam": real letters can contain some of these signs, and
// absence of signs does not prove a letter is genuine. Offline, rules only. Plus free official help links per country.
import type { ActionCard } from './types';
import { fold } from './extract/normalize';
import { findIbans } from './extract/iban';

export type HintKey = 'hint_giftcard' | 'hint_crypto' | 'hint_wire' | 'hint_threat' | 'hint_rush' | 'hint_shortlink' | 'hint_iplink' | 'hint_http' | 'hint_lookalike' | 'hint_freemail' | 'hint_iban_country' | 'hint_iban_invalid' | 'hint_personal_account' | 'hint_secret';
export interface Hint { key: HintKey; snippet: string | null }

const GIFT = ['gift card', 'giftcard', 'itunes card', 'apple gift', 'google play card', 'google play gift', 'amazon card', 'amazon gift', 'steam card', 'paysafecard', 'paysafe', 'gutscheinkarte', 'geschenkkarte', 'carte cadeau', 'carte-cadeau', 'tarjeta regalo', 'carta regalo', 'buono regalo', 'cartao presente', 'cartao-presente', 'vale de oferta', 'neosurf', 'transcash', 'pcs mastercard'];
const CRYPTO = ['bitcoin', 'btc', 'crypto', 'krypto', 'cryptomonnaie', 'criptomoneda', 'criptovaluta', 'criptomoeda', 'usdt', 'tether', 'ethereum', 'wallet address', 'wallet-adresse', 'adresse du portefeuille', 'bitcoin atm', 'bitcoin-automat'];
const WIRE = ['western union', 'moneygram', 'ria money', 'worldremit', 'remitly'];
const THREAT = ['arrest', 'arrested', 'warrant', 'prison', 'jail', 'deport', 'deportation', 'police will', 'haftbefehl', 'verhaftung', 'festnahme', 'gefangnis', 'abschiebung', 'ausweisung', 'arrestation', 'mandat d\'arret', 'expulsion', 'detencion', 'orden de arresto', 'carcel', 'deportacion', 'arresto', 'mandato di arresto', 'carcere', 'espulsione', 'detencao', 'mandado de prisao', 'prisao', 'deportacao', 'licence will be suspended', 'account will be blocked', 'konto wird gesperrt', 'compte sera bloque', 'cuenta sera bloqueada', 'conto verra bloccato', 'conta sera bloqueada'];
const RUSH = ['within 24 hours', 'within 48 hours', 'within 24h', 'within 2 hours', 'within 1 hour', 'innerhalb von 24 stunden', 'innerhalb von 48 stunden', 'innerhalb 24 stunden', 'sous 24 heures', 'sous 24h', 'dans les 24 heures', 'sous 48 heures', 'en 24 horas', 'en las proximas 24 horas', 'en 48 horas', 'entro 24 ore', 'entro 48 ore', 'em 24 horas', 'nas proximas 24 horas', 'em 48 horas', 'pay today', 'hoy mismo', 'oggi stesso', 'hoje mesmo'];
const SECRET = ['do not tell', 'keep this confidential', 'don\'t tell', 'sagen sie niemandem', 'niemandem davon', 'n\'en parlez a personne', 'no se lo diga a nadie', 'non dirlo a nessuno', 'nao conte a ninguem', 'pin code', 'your pin', 'ihre pin', 'tan-nummer', 'tan number', 'password', 'passwort', 'mot de passe', 'contrasena', 'senha'];
const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|t\.ly|tiny\.cc|s\.id)\/\S+/i;
const IP_URL = /\bhttps?:\/\/\d{1,3}(?:\.\d{1,3}){3}/i;
const HTTP_URL = /\bhttp:\/\/[^\s/]+/i;
const FREEMAIL = /\b[\w.+-]+@(gmail|googlemail|yahoo|hotmail|outlook|live|gmx|web|aol|icloud|proton|protonmail|mail|yandex|t-online|orange|libero|laposte|wanadoo|free|sapo|tutanota)\.[a-z.]{2,6}\b/i;
const OFFICIAL = ['finanzamt', 'jobcenter', 'agentur fur arbeit', 'beitragsservice', 'polizei', 'bundeszentralamt', 'zoll', 'hmrc', 'dwp', 'tv licensing', 'dvla', 'police', 'gov.uk', 'impots', 'finances publiques', 'caf', 'ameli', 'assurance maladie', 'gendarmerie', 'prefecture', 'agencia tributaria', 'hacienda', 'seguridad social', 'sepe', 'policia', 'guardia civil', 'dgt', 'agenzia delle entrate', 'inps', 'polizia', 'carabinieri', 'questura', 'autoridade tributaria', 'financas', 'seguranca social', 'psp', 'gnr', 'krankenkasse', 'aok', 'cpam', 'bundesamt', 'auslanderbehorde', 'embassy', 'botschaft', 'ambassade', 'embajada', 'ambasciata', 'embaixada'];
const OFFICIAL_TLD = /\.(gov|gouv|gob|gv|bund|police|europa)\.|\.(gov|gouv|gob)\b|\.gov\.uk\b|\.bund\.de\b|\.gv\.at\b|\.admin\.ch\b|\.gouv\.fr\b|\.gob\.es\b|\.gov\.it\b|\.gov\.pt\b|\.europa\.eu\b|\.nhs\.uk\b|agenziaentrate\.(gov\.)?it|agenciatributaria\.(gob\.)?es|impots\.gouv|portaldasfinancas|elster\.de|arbeitsagentur\.de|jobcenter|rundfunkbeitrag\.de|tvlicensing\.co\.uk|ameli\.fr|caf\.fr|inps\.it|seg-social/;
// country of the IBAN vs the countries where letters in this language are usually sent from
const LANG_COUNTRIES: Record<string, string[]> = { de: ['DE', 'AT', 'CH', 'LI', 'LU', 'BE'], fr: ['FR', 'BE', 'CH', 'LU', 'MC'], es: ['ES', 'AD'], it: ['IT', 'SM', 'VA', 'CH'], pt: ['PT'], en: ['GB', 'IE', 'MT', 'GI'] };
// official senders that should not ask you to pay to a private person's account
const BUSINESS_HOLDER = /\b(gmbh|ag|kg|ohg|e\.?v|ug|amt|kasse|bank|sparkasse|bundes|landes|stadt|gemeinde|kreis|service|beitragsservice|inkasso|ltd|limited|plc|llp|council|hmrc|sa|sas|sarl|sl|slu|spa|s\.p\.a|srl|s\.r\.l|lda|tresor|tresorerie|tesoreria|finanz|zentral|agency|agence|agencia|agenzia|direction|ministerio|ministere|ministero|ministry|inps|caf|cpam|dgfip|stadtwerke|versicherung|insurance|assurance|seguros|assicurazioni)\b/i;
const HOLDER_LINE = /(kontoinhaber(?:in)?|empfanger|empfaenger|beguenstigter|begunstigter|account holder|account name|beneficiary|payee|titulaire(?: du compte)?|beneficiaire|titular(?: de la cuenta| da conta)?|beneficiario|intestatario|intestato a)\s*[:\-]?\s*([^\n]{3,60})/i;

function findAny(f: string, raw: string, list: string[]): string | null {
  for (const w of list) {
    const re = new RegExp(`(?<![a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'i');
    const m = re.exec(f);
    if (m) return lineOf(raw, f, m.index);
  }
  return null;
}
// fold() keeps length for Latin text, so an index in the folded text points to the same place in the original
function lineOf(raw: string, f: string, i: number): string {
  const src = raw.length === f.length ? raw : f;
  const a = src.lastIndexOf('\n', i) + 1, b = src.indexOf('\n', i);
  return src.slice(a, b < 0 ? undefined : b).trim().slice(0, 140);
}

export function scamHints(card: ActionCard): Hint[] {
  const raw = card.ocrText ?? '';
  const f = fold(raw);
  const out: Hint[] = [];
  const add = (key: HintKey, snippet: string | null) => { if (!out.some((h) => h.key === key)) out.push({ key, snippet }); };
  let s: string | null;
  if ((s = findAny(f, raw, GIFT))) add('hint_giftcard', s);
  if ((s = findAny(f, raw, CRYPTO))) add('hint_crypto', s);
  if ((s = findAny(f, raw, WIRE))) add('hint_wire', s);
  if ((s = findAny(f, raw, THREAT))) add('hint_threat', s);
  if ((s = findAny(f, raw, RUSH))) add('hint_rush', s);
  if ((s = findAny(f, raw, SECRET))) add('hint_secret', s);
  let m: RegExpExecArray | null;
  if ((m = SHORTENERS.exec(raw))) add('hint_shortlink', lineOf(raw, raw, m.index));
  if ((m = IP_URL.exec(raw))) add('hint_iplink', lineOf(raw, raw, m.index));
  else if ((m = HTTP_URL.exec(raw))) add('hint_http', lineOf(raw, raw, m.index));
  const official = OFFICIAL.some((w) => new RegExp(`(?<![a-z])${w}(?![a-z])`).test(f));
  if (official) {
    if ((m = FREEMAIL.exec(raw))) add('hint_freemail', lineOf(raw, raw, m.index));
    // a web address that names an authority but is not on an official domain, e.g. "finanzamt-zahlung.com"
    const urls = raw.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?/gi) ?? [];
    for (const u of urls) {
      const host = u.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
      if (/@/.test(u) || !/[a-z]/.test(host.replace(/\.[a-z]+$/, ''))) continue;
      const namesAuthority = /(finanzamt|steuer|jobcenter|rundfunk|beitrag|polizei|zoll|hmrc|govuk|gov-uk|tvlicen|impots|tresor|amende|antai|hacienda|tributaria|dgt|multa|entrate|inps|multe|financas|portal-?financas|ameli|caf-|cpam|police|bussgeld)/.test(host);
      if (namesAuthority && !OFFICIAL_TLD.test(host + '/')) { add('hint_lookalike', lineOf(raw, raw, raw.indexOf(u))); break; }
    }
  }
  const ibans = findIbans(raw);
  const lang = card.docLanguage.value;
  const expectCountries = lang ? LANG_COUNTRIES[lang] : null;
  const foreign = expectCountries ? ibans.find((h) => h.valid && !expectCountries.includes(h.value.slice(0, 2))) : undefined;
  if (foreign && official) add('hint_iban_country', lineOf(raw, raw, foreign.start));
  if (card.iban?.value && card.iban.confidence === 'low' && !card.iban.edited) add('hint_iban_invalid', card.iban.snippet);
  // payment to a private person's account in a letter that presents itself as official
  if (official && ibans.length) {
    const h = HOLDER_LINE.exec(f);
    if (h) {
      const name = h[2].replace(/\biban\b.*$/, '').trim();
      const looksPersonal = /^[a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){1,2}\s*$/.test(name) && !BUSINESS_HOLDER.test(name);
      if (looksPersonal) add('hint_personal_account', lineOf(raw, f, h.index));
    }
    if (/(personal account|private account|privatkonto|privates konto|compte personnel|cuenta personal|conto personale|conta pessoal)/.test(f)) add('hint_personal_account', null);
  }
  return out;
}

// ---- free help: official or non-profit advice services, per country (each URL checked to load on 2026-10-11) ----
export interface HelpLink { country: string; name: string; url: string; kind: 'consumer' | 'scam' | 'debt' | 'citizen' }
export const HELP: HelpLink[] = [
  { country: 'DE', name: 'Verbraucherzentrale', url: 'https://www.verbraucherzentrale.de/', kind: 'consumer' },
  { country: 'DE', name: 'Polizei-Beratung (Betrug)', url: 'https://www.polizei-beratung.de/', kind: 'scam' },
  { country: 'DE', name: 'Europäisches Verbraucherzentrum', url: 'https://www.evz.de/', kind: 'consumer' },
  { country: 'AT', name: 'Arbeiterkammer', url: 'https://www.arbeiterkammer.at/', kind: 'consumer' },
  { country: 'AT', name: 'Watchlist Internet', url: 'https://www.watchlist-internet.at/', kind: 'scam' },
  { country: 'CH', name: 'Stiftung für Konsumentenschutz', url: 'https://www.konsumentenschutz.ch/', kind: 'consumer' },
  { country: 'CH', name: 'Fédération romande des consommateurs', url: 'https://www.frc.ch/', kind: 'consumer' },
  { country: 'GB', name: 'Citizens Advice', url: 'https://www.citizensadvice.org.uk/', kind: 'citizen' },
  { country: 'GB', name: 'StepChange (free debt advice)', url: 'https://www.stepchange.org/', kind: 'debt' },
  { country: 'GB', name: 'Report Fraud (police)', url: 'https://www.reportfraud.police.uk/', kind: 'scam' },
  { country: 'IE', name: 'Citizens Information', url: 'https://www.citizensinformation.ie/', kind: 'citizen' },
  { country: 'IE', name: 'MABS (free money advice)', url: 'https://www.mabs.ie/', kind: 'debt' },
  { country: 'FR', name: 'Service-Public.fr', url: 'https://www.service-public.fr/', kind: 'citizen' },
  { country: 'FR', name: 'France Services', url: 'https://www.france-services.gouv.fr/', kind: 'citizen' },
  { country: 'FR', name: 'Institut national de la consommation', url: 'https://www.inc-conso.fr/', kind: 'consumer' },
  { country: 'FR', name: 'Cybermalveillance.gouv.fr', url: 'https://www.cybermalveillance.gouv.fr/', kind: 'scam' },
  { country: 'ES', name: 'INCIBE (línea 017)', url: 'https://www.incibe.es/', kind: 'scam' },
  { country: 'ES', name: 'CECU (consumidores)', url: 'https://cecu.es/', kind: 'consumer' },
  { country: 'IT', name: 'Polizia Postale', url: 'https://www.commissariatodips.it/', kind: 'scam' },
  { country: 'IT', name: 'AGCM (tutela consumatore)', url: 'https://www.agcm.it/', kind: 'consumer' },
  { country: 'PT', name: 'Portal do Consumidor', url: 'https://www.consumidor.gov.pt/', kind: 'consumer' },
  { country: 'PT', name: 'DECO', url: 'https://www.deco.proteste.pt/', kind: 'consumer' },
  { country: 'PL', name: 'UOKiK', url: 'https://uokik.gov.pl/', kind: 'consumer' },
  { country: 'PL', name: 'CERT Polska', url: 'https://cert.pl/', kind: 'scam' },
  { country: 'TR', name: 'Tüketici (Ticaret Bakanlığı)', url: 'https://tuketici.ticaret.gov.tr/', kind: 'consumer' },
  { country: 'EU', name: 'European Consumer Centres (ECC-Net)', url: 'https://www.europe-consommateurs.eu/', kind: 'consumer' },
];
const LANG_DEFAULT_COUNTRY: Record<string, string> = { de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pt: 'PT', en: 'GB' };
export const HELP_COUNTRIES = [...new Set(HELP.map((h) => h.country))];

/** Best guess of the country the letter came from: IBAN country if any, else the document language. User can change it. */
export function guessCountry(card: ActionCard): string {
  const ib = card.iban?.value?.slice(0, 2);
  if (ib && HELP_COUNTRIES.includes(ib)) return ib;
  return LANG_DEFAULT_COUNTRY[card.docLanguage.value ?? ''] ?? 'EU';
}
export const helpFor = (country: string) => HELP.filter((h) => h.country === country);
