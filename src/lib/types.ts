export const LANGS = ['en', 'de', 'fr', 'es', 'it', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português',
};
/** Tesseract traineddata code for each language. */
export const TESS_CODE: Record<Lang, string> = {
  en: 'eng', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por',
};

export const DOC_TYPES = [
  'parking_fine', 'medicine_label', 'airline_cancellation', 'hotel_cancellation',
  'visa_entry', 'rental_move_in', 'unknown',
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
  docType: Field<DocType>;
  deadline: Field<string> & { kind: DeadlineKind; calc?: DeadlineCalc };
  otherDeadlines?: OtherDeadline[];
  amount: Field<Money>;
  reference: Field<string>;
  labelQuote?: Field<string>; // medicine labels: verbatim dosing text from the label
  nextAction: { text: string; edited?: boolean };
  reply: { docLang: Lang; docText: string; userText: string; edited?: boolean };
  datesSeen: DateSeen[];
  amountsSeen?: { amount: number; currency: string; snippet: string }[];
  ocrText: string;
  ocrConfidence: number | null;
  /** One entry per photographed page (multi-page documents); ocrText is their combined text. Absent on old cards. */
  pages?: PageText[];
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
