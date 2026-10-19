// Short made-up letter texts used to MEASURE which languages the OCR engines can read (tests/lang-ocr.mjs on the web
// engine, the "diag" scene of the iOS screenshot workflow for Apple Vision). Not shown in the app.
export const LANG_SAMPLES: Record<string, string> = {
  ar: 'إشعار بدفع غرامة\nرقم الملف: 2026/4471\nالمبلغ المستحق: 35 يورو\nيرجى الدفع قبل 06.11.2026',
  uk: 'Повідомлення про штраф\nНомер справи: 2026/4471\nСума до сплати: 35 євро\nБудь ласка, сплатіть до 06.11.2026',
  tr: 'Para cezası bildirimi\nDosya numarası: 2026/4471\nÖdenecek tutar: 35 avro\nLütfen 06.11.2026 tarihine kadar ödeyin',
  fa: 'اطلاعیه پرداخت جریمه\nشماره پرونده: 2026/4471\nمبلغ قابل پرداخت: 35 یورو\nلطفاً تا تاریخ 06.11.2026 پرداخت کنید',
  ru: 'Уведомление о штрафе\nНомер дела: 2026/4471\nСумма к оплате: 35 евро\nПожалуйста, оплатите до 06.11.2026',
  pl: 'Zawiadomienie o grzywnie\nNumer sprawy: 2026/4471\nKwota do zapłaty: 35 euro\nProsimy o zapłatę do 06.11.2026',
  ro: 'Notificare de amendă\nNumăr dosar: 2026/4471\nSuma de plată: 35 euro\nVă rugăm să plătiți până la 06.11.2026',
  vi: 'Thông báo nộp phạt\nSố hồ sơ: 2026/4471\nSố tiền phải nộp: 35 euro\nVui lòng thanh toán trước ngày 06.11.2026',
  zh: '罚款缴纳通知\n案件编号：2026/4471\n应付金额：35欧元\n请在2026年11月6日前付款',
  tl: 'Abiso ng multa\nNumero ng kaso: 2026/4471\nHalagang babayaran: 35 euro\nMangyaring magbayad bago ang 06.11.2026',
  hi: 'जुर्माना भुगतान सूचना\nफ़ाइल संख्या: 2026/4471\nदेय राशि: 35 यूरो\nकृपया 06.11.2026 से पहले भुगतान करें',
  ur: 'جرمانے کی ادائیگی کا نوٹس\nفائل نمبر: 2026/4471\nقابل ادائیگی رقم: 35 یورو\nبراہ کرم 06.11.2026 سے پہلے ادائیگی کریں',
};

const norm = (s: string) => s.normalize('NFC').replace(/[\s\u200c\u200f\u200e]+/g, '').replace(/[：:]/g, ':');
function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
/** Character accuracy 0..100 of an OCR result against the sample (whitespace ignored). */
export function charAccuracy(expected: string, got: string): number {
  const a = norm(expected), b = norm(got);
  return Math.round(Math.max(0, 1 - lev(a, b) / a.length) * 1000) / 10;
}
