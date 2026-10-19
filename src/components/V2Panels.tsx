// Card panels added with the v1 features: read aloud + Easy Language, "when did you receive it?", payment QR,
// and the note for letters read in a language without wording rules.
import { useEffect, useState } from 'react';
import type { ActionCard, UiLangCode } from '../lib/types';
import { UI_LANG_NAMES, RTL_LANGS } from '../lib/types';
import { useLang, useT } from '../lib/i18n';
import { formatDate } from '../lib/templates';
import { regenerateActions } from '../lib/extract';
import { RECEIPT_COUNTRIES, applyReceived, computeFromReceipt } from '../lib/receipt';
import { guessCountry } from '../lib/hints';
import { easySentences, speak, speechAvailable, stopSpeaking, SPEECH_LANG } from '../lib/speech';
import { findRecipient, makeEpcPayload } from '../lib/payqr';
import { validIban } from '../lib/extract/iban';
import { IconAlert, IconBank, IconCalendar, IconInfo } from './Icons';

const regionName = (code: string, lang: string) => { try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code; } catch { return code; } };

export function ListenBox({ card }: { card: ActionCard }) {
  const t = useT();
  const L = useLang() as UiLangCode; // the person's own UI language, also for the 12 reading-only languages
  const [easy, setEasy] = useState(false);
  const [speaking, setSpeaking] = useState<'card' | 'letter' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => () => stopSpeaking(), []);
  const docLang = card.readLanguage ?? card.docLanguage.value ?? null;
  const sentences = easySentences(card, L);
  const say = (what: 'card' | 'letter') => {
    if (speaking === what) { stopSpeaking(); setSpeaking(null); return; }
    const r = what === 'card' ? speak(sentences.join(' '), SPEECH_LANG[L], () => setSpeaking(null)) : speak(card.ocrText, SPEECH_LANG[docLang ?? 'en'], () => setSpeaking(null));
    if (r === 'started') { setSpeaking(what); setMsg(null); } else setMsg(t(r === 'no-voice' ? 'speak_no_voice' : 'speak_unavailable', { lang: UI_LANG_NAMES[(what === 'card' ? L : docLang ?? 'en') as UiLangCode] }));
  };
  return (
    <section className="panel listen" data-testid="listen-box">
      <div className="row-btns">
        {speechAvailable() && <button className="btn small secondary" onClick={() => say('card')} data-testid="speak-card" aria-pressed={speaking === 'card'}>{speaking === 'card' ? t('speak_stop') : t('speak_card')}</button>}
        {speechAvailable() && card.ocrText.trim() && <button className="btn small ghost" onClick={() => say('letter')} data-testid="speak-letter" aria-pressed={speaking === 'letter'}>{speaking === 'letter' ? t('speak_stop') : t('speak_letter')}</button>}
        <button className="btn small ghost" onClick={() => setEasy(!easy)} aria-expanded={easy} data-testid="easy-btn">{easy ? t('easy_hide') : t('easy_show')}</button>
      </div>
      {msg && <p className="small muted" role="status" data-testid="speak-msg">{msg}</p>}
      {easy && (
        <div className="easy" lang={L} dir={RTL_LANGS.includes(L) ? 'rtl' : 'ltr'} data-testid="easy-text">
          <p className="panel-title">{t('easy_title')}</p>
          <ul>{sentences.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function ReceivedBox({ card, onChange }: { card: ActionCard; onChange: (c: ActionCard) => void }) {
  const t = useT();
  const ul = useLang();
  const L = card.userLanguage;
  const guess = guessCountry(card);
  const [country, setCountry] = useState<string>(card.received?.country ?? ((RECEIPT_COUNTRIES as readonly string[]).includes(guess) ? guess : 'OTHER'));
  const [date, setDate] = useState(card.received?.iso ?? '');
  const calc = card.deadline.calc;
  if (!calc || calc.anchor !== 'receipt' || card.deadline.edited) return null;
  const res = card.received ? computeFromReceipt(calc, card.received.iso, card.received.postedIso, card.received.country, card.docType.value) : null;
  const fmt = (v: Record<string, string>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^\d{4}-\d{2}-\d{2}$/.test(x) ? formatDate(x, L) : x]));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="panel received" data-testid="received-box">
      <div className="panel-head"><span className="panel-ic" aria-hidden><IconCalendar size={16} /></span><label className="panel-title" htmlFor="rcv-date">{t('rcv_question')}</label></div>
      <p className="small muted">{t('rcv_help')}</p>
      <div className="received-row">
        <input id="rcv-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} data-testid="received-date" />
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t('rcv_country')} data-testid="received-country">
          {RECEIPT_COUNTRIES.map((c) => <option key={c} value={c}>{c === 'OTHER' ? t('rcv_other_country') : regionName(c, ul)}</option>)}
        </select>
        <button className="btn small primary" disabled={!date} onClick={() => onChange(regenerateActions(applyReceived(card, date, country)))} data-testid="received-apply">{t('rcv_apply')}</button>
      </div>
      {res && (
        <>
          <ol className="small received-steps" data-testid="received-steps">{res.steps.map((s, i) => <li key={i} data-step={s.key}>{t(s.key, fmt(s.vars))}</li>)}</ol>
          <p className={`small ${res.rule.verified ? 'note' : 'alert warn'}`} data-testid="received-rule" data-verified={res.rule.verified ? '1' : '0'}>
            {res.rule.verified ? t('rcv_verified', { law: res.rule.law ?? '' }) : res.rule.law ? t('rcv_unverified_law', { law: res.rule.law }) : t('rcv_unverified')}
          </p>
          <p className="small muted">{t('rcv_weekend')}</p>
        </>
      )}
    </section>
  );
}

export function PaymentBox({ card }: { card: ActionCard }) {
  const t = useT();
  const iban = card.iban?.value ?? '';
  const qr = card.payQr;
  const eurAmount = card.amount.value && card.amount.value.currency === 'EUR' ? card.amount.value.amount : null;
  const [name, setName] = useState(() => findRecipient(card.ocrText) ?? '');
  const [amount, setAmount] = useState(eurAmount !== null ? eurAmount.toFixed(2) : '');
  const [ref, setRef] = useState(card.reference.value ?? '');
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isEurIban = /^(AT|BE|CY|DE|EE|ES|FI|FR|GR|HR|IE|IT|LT|LU|LV|MC|MT|NL|PT|SI|SK|SM|AD|VA)/.test(iban.replace(/\s/g, ''));
  const canMake = !!iban && validIban(iban) && (!card.amount.value || card.amount.value.currency === 'EUR') && isEurIban;
  if (!qr && !canMake) return null;
  const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
  const mismatch = qr && ((iban && norm(qr.iban) !== norm(iban)) || (qr.amount !== null && card.amount.value && Math.abs(qr.amount - card.amount.value.amount) > 0.005));
  const make = async () => {
    setErr(null); setImg(null);
    const a = amount.trim() ? Number(amount.replace(',', '.')) : null;
    const r = makeEpcPayload({ iban, name, amount: a !== null && Number.isFinite(a) ? a : a === null ? null : -1, currency: 'EUR', reference: ref });
    if ('error' in r) { setErr(t(r.error)); return; }
    const QR = await import('qrcode');
    setImg(await QR.toDataURL(r.payload, { errorCorrectionLevel: 'M', margin: 2, width: 360 }));
  };
  return (
    <section className="panel payqr" data-testid="pay-box">
      <div className="panel-head"><span className="panel-ic" aria-hidden><IconBank size={16} /></span><div className="panel-title">{t('pq_title')}</div></div>
      {qr && (
        <div className="small" data-testid="pay-qr-found" data-kind={qr.kind}>
          <p><strong>{t(qr.kind === 'swiss' ? 'pq_found_swiss' : 'pq_found_epc')}</strong></p>
          <ul>
            <li>{t('pq_recipient')}: {qr.name || '—'}</li>
            <li>IBAN: <code>{qr.iban}</code></li>
            <li>{t('money')}: {qr.amount !== null ? `${qr.amount.toFixed(2)} ${qr.currency}` : '—'}</li>
            {qr.reference && <li>{t('reference')}: <code>{qr.reference}</code></li>}
          </ul>
          {mismatch && <p className="alert warn" data-testid="pay-qr-mismatch"><IconAlert size={16} /> {t('pq_mismatch')}</p>}
        </div>
      )}
      {canMake && (
        <>
          <p className="small muted">{t('pq_help')}</p>
          <label className="small" htmlFor="pq-name">{t('pq_recipient')}</label>
          <input id="pq-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="pay-name" />
          <label className="small" htmlFor="pq-amount">{t('money')} (EUR)</label>
          <input id="pq-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="pay-amount" />
          <label className="small" htmlFor="pq-ref">{t('reference')}</label>
          <input id="pq-ref" value={ref} onChange={(e) => setRef(e.target.value)} data-testid="pay-ref" />
          <p className="small">IBAN: <code>{iban}</code></p>
          <div className="row-btns"><button className="btn small secondary" onClick={make} data-testid="pay-make">{t('pq_make')}</button></div>
          {err && <p className="alert error small" role="alert" data-testid="pay-error">{err}</p>}
          {img && (
            <figure className="qr-wrap">
              <img src={img} alt={t('pq_alt')} width={220} height={220} data-testid="pay-qr" />
            </figure>
          )}
        </>
      )}
      <p className="alert warn small" role="note" data-testid="pay-warning"><IconAlert size={16} /> {t('pq_warning')}</p>
    </section>
  );
}

export function ReadLanguageNote({ card }: { card: ActionCard }) {
  const t = useT();
  if (!card.readLanguage) return null;
  return (
    <p className="alert info small" data-testid="read-language-note"><IconInfo size={16} /> {t('read_lang_note', { lang: UI_LANG_NAMES[card.readLanguage] })}</p>
  );
}
