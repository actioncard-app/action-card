// Interface strings added with the v1 features (send preview, read aloud, payment QR, received date, photo check,
// languages), kept per key with all 18 interface languages side by side. Order of each row:
// en de fr es it pt | tr ar pl ru uk fa ro vi zh tl hi ur.
// Everything except English is MACHINE-TRANSLATED and NEEDS NATIVE REVIEW (German, French, Spanish, Italian and
// Portuguese included).
import type { UiLangCode } from './types';

export const V2_ORDER = ['en', 'de', 'fr', 'es', 'it', 'pt', 'tr', 'ar', 'pl', 'ru', 'uk', 'fa', 'ro', 'vi', 'zh', 'tl', 'hi', 'ur'] as const satisfies readonly UiLangCode[];
type Row = readonly [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];

const R = {
  lang_group_full: ['Fully supported', 'Voll unterstützt', 'Prise en charge complète', 'Compatibilidad completa', 'Supporto completo', 'Suporte completo', 'Tam destek', 'دعم كامل', 'Pełna obsługa', 'Полная поддержка', 'Повна підтримка', 'پشتیبانی کامل', 'Suport complet', 'Hỗ trợ đầy đủ', '完全支持', 'Buong suporta', 'पूर्ण समर्थन', 'مکمل معاونت'],
  lang_group_read: ['Text, dates and amounts only', 'Nur Text, Daten und Beträge', 'Texte, dates et montants uniquement', 'Solo texto, fechas e importes', 'Solo testo, date e importi', 'Apenas texto, datas e valores', 'Yalnızca metin, tarihler ve tutarlar', 'النص والتواريخ والمبالغ فقط', 'Tylko tekst, daty i kwoty', 'Только текст, даты и суммы', 'Лише текст, дати й суми', 'فقط متن، تاریخ‌ها و مبالغ', 'Doar text, date și sume', 'Chỉ văn bản, ngày và số tiền', '仅文字、日期和金额', 'Teksto, petsa at halaga lamang', 'केवल पाठ, तिथियाँ और राशियाँ', 'صرف متن، تاریخیں اور رقوم'],
} satisfies Record<string, Row>;

export const S2: Record<keyof typeof R, Row> = R;
export type Key2 = keyof typeof R;
export const v2 = (key: Key2, lang: UiLangCode): string => S2[key][V2_ORDER.indexOf(lang as never)] || S2[key][0];
