export const LANGS = ['en', 'de', 'fr', 'es', 'it', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
/** Card contents (next action, steps, replies) exist in the six card languages; other UI languages use English cards. */
/** Interface languages: the six card languages plus five UI-only ones (cards fall back to English). */
/** Languages that only exist as interface/reading languages (no card wording rules); MACHINE-TRANSLATED, need native review. */
export const EXTRA_LANGS = ['tr', 'ar', 'pl', 'ru', 'uk', 'fa', 'ro', 'vi', 'zh', 'tl', 'hi', 'ur'] as const;
export type ExtraLang = (typeof EXTRA_LANGS)[number];
export const UI_LANGS = [...LANGS, ...EXTRA_LANGS] as const;
export type UiLangCode = (typeof UI_LANGS)[number];
export const UI_LANG_NAMES: Record<UiLangCode, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português', tr: 'Türkçe', ar: 'العربية', pl: 'Polski', ru: 'Русский', uk: 'Українська',
  fa: 'فارسی', ro: 'Română', vi: 'Tiếng Việt', zh: '简体中文', tl: 'Tagalog', hi: 'हिन्दी', ur: 'اردو',
};
export const RTL_LANGS: readonly string[] = ['ar', 'fa', 'ur'];
/** Languages a letter can be READ in (OCR). The six card languages also have wording rules (deadline phrases, document
 * types, reply drafts); the others give the text, dates, amounts, IBAN and reference, and can use AI mode / Read aloud. */
export const READ_LANGS = UI_LANGS;
export type ReadLang = UiLangCode;
export const isRuleLang = (l: string | null | undefined): l is Lang => !!l && (LANGS as readonly string[]).includes(l);
export const cardLang = (ui: string): Lang => ((LANGS as readonly string[]).includes(ui) ? (ui as Lang) : 'en');

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português',
};
/** Tesseract traineddata code for each reading language. */
export const TESS_CODE: Record<ReadLang, string> = {
  en: 'eng', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por',
  tr: 'tur', ar: 'ara', pl: 'pol', ru: 'rus', uk: 'ukr', fa: 'fas', ro: 'ron', vi: 'vie', zh: 'chi_sim', tl: 'tgl', hi: 'hin', ur: 'urd',
};

export const DOC_TYPES = [
  'parking_fine', 'medicine_label', 'airline_cancellation', 'hotel_cancellation',
  'visa_entry', 'rental_move_in',
  'tax_office', 'health_insurance', 'debt_collection', 'utility_bill', 'benefits_office', 'broadcast_fee',
  'unknown',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type Confidence = 'high' | 'medium' | 'low';

/** Every extracted value carries the exact OCR snippet it came from and a confidence. */
export interface Field<T> {
  value: T | null;
  snippet: string | null;
  confidence: Confidence | null;
  edited?: boolean;
  note?: string;
}

export interface Money { amount: number; currency: string }

export type DeadlineKind = 'deadline' | 'expiry' | 'appointment';

/** How a relative deadline ("within 14 days of ...") was computed. */
export interface DeadlineCalc {
  ruleSnippet: string;
  n: number;
  unit: 'day' | 'week' | 'month' | 'hour';
  business: boolean;
  direction: 'after' | 'before';
  anchor: 'issue' | 'receipt' | 'unspecified' | 'arrival' | 'departure' | 'appointment' | 'move-in';
  base: { iso: string; snippet: string; label: string } | null;
  resultIso: string | null;
}
export interface OtherDeadline { iso: string | null; kind: DeadlineKind; snippet: string; calc?: DeadlineCalc; note?: string }

export interface DateSeen { iso: string; snippet: string; precision: 'day' | 'month' }

/** OCR text of one photographed page. */
export interface PageText { text: string; confidence: number | null }

export interface ActionCard {
  id: string;
  createdAt: number;
  mode: 'rules' | 'ai';
  modeNote?: string; // e.g. why AI fell back to rules
  userLanguage: Lang;
  docLanguage: Field<Lang>;
  /** language the letter was READ in when it is not one of the six rule languages (docLanguage.value is then null) */
  readLanguage?: ReadLang;
  docType: Field<DocType>;
  deadline: Field<string> & { kind: DeadlineKind; calc?: DeadlineCalc };
  otherDeadlines?: OtherDeadline[];
  amount: Field<Money>;
  reference: Field<string>;
  /** bank account to pay to (IBAN, checksum-validated); absent on old cards */
  iban?: Field<string>;
  labelQuote?: Field<string>; // medicine labels: verbatim dosing text from the label
  nextAction: { text: string; edited?: boolean };
  reply: { docLang: Lang; docText: string; userText: string; edited?: boolean };
  datesSeen: DateSeen[];
  amountsSeen?: { amount: number; currency: string; snippet: string }[];
  ocrText: string;
  ocrConfidence: number | null;
  /** One entry per photographed page (multi-page documents); ocrText is their combined text. Absent on old cards. */
  pages?: PageText[];
  /** payment QR code (EPC GiroCode or Swiss QR-bill) found in the photo */
  payQr?: { kind: 'epc' | 'swiss'; iban: string; name: string; amount: number | null; currency: string; reference: string; message?: string };
  /** "when did you receive it?" answer for deadlines that run from receipt (see receipt.ts) */
  received?: { iso: string; country: string; postedIso: string | null };
  /** ticked steps of the checklist (indices into stepsFor(card)) */
  stepsDone?: number[];
}

export interface SavedCard {
  id: string;
  createdAt: number;
  card: ActionCard;
  thumbnail: string; // small JPEG data URL
  photo?: Blob; // downscaled original photo (page 1), kept on device
  morePhotos?: Blob[]; // pages 2+ of a multi-page document
}
