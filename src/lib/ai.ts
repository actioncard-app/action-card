/**
 * Optional AI mode: sends the OCR text (never the photo) straight from the phone to the xAI
 * chat completions API using the user's own key. Fine for a personal prototype; a public launch
 * needs a server-side proxy so keys are never held on devices.
 * Any error or invalid answer -> caller falls back to the offline rule-based card.
 */
import type { ActionCard, Confidence, DocType, Field, Lang } from './types';
import { DOC_TYPES, LANGS } from './types';
import { regenerateActions } from './extract';
import { nextActionText } from './templates';
import { fold } from './extract/normalize';

export const XAI_URL = 'https://api.x.ai/v1/chat/completions';

const snippetField = (valueSchema: object) => ({
  type: 'object',
  properties: {
    value: valueSchema,
    snippet: { type: ['string', 'null'], description: 'Exact text copied verbatim from the OCR text that supports the value, or null' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['value', 'snippet', 'confidence'],
  additionalProperties: false,
});

export const CARD_SCHEMA = {
  type: 'object',
  properties: {
    doc_language: { type: ['string', 'null'], enum: [...LANGS, null] },
    doc_type: snippetField({ type: 'string', enum: [...DOC_TYPES] }),
    deadline: {
      type: 'object',
      properties: {
        value: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        snippet: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        kind: { type: 'string', enum: ['deadline', 'expiry', 'appointment'] },
      },
      required: ['value', 'snippet', 'confidence', 'kind'],
      additionalProperties: false,
    },
    amount: snippetField({ type: ['object', 'null'], properties: { amount: { type: 'number' }, currency: { type: 'string', description: 'ISO 4217 code' } }, required: ['amount', 'currency'], additionalProperties: false }),
    reference: snippetField({ type: ['string', 'null'] }),
    next_action: { type: 'string', description: 'The ONE next action, in the user language, max 2 sentences' },
    reply_doc_language: { type: 'string' },
    reply_user_language: { type: 'string' },
  },
  required: ['doc_language', 'doc_type', 'deadline', 'amount', 'reference', 'next_action', 'reply_doc_language', 'reply_user_language'],
  additionalProperties: false,
};

const SYSTEM = `You turn OCR text of a document into an "action card". You are NOT a translator.
Rules:
- Only use facts present in the OCR text. If something is not present, use null. Never guess.
- Every snippet must be copied verbatim from the OCR text (same words, same order).
- deadline = the date by which the reader must act (pay, reply, cancel, send documents). For medicine labels use the expiry date with kind "expiry". Appointment dates use kind "appointment".
- amount = the money the reader must pay or could lose (fine due, cancellation penalty, deposit, fee, refund). ISO 4217 currency.
- doc_type must be one of the enum values; use "unknown" if unsure.
- next_action: one short, concrete step in the user's language. For medicine labels NEVER give dosing advice; tell the user to confirm with a pharmacist before taking it.
- reply_doc_language / reply_user_language: a short polite message (max 4 sentences) the reader could send, in the document's language and in the user's language, with the same meaning.
- Use confidence "low" whenever OCR text looks garbled or ambiguous.`;

export class AiError extends Error {}

function normWs(s: string) { return fold(s).replace(/\s+/g, ' ').trim(); }
function snippetInText(snippet: string | null, ocr: string): boolean {
  if (!snippet) return false;
  return normWs(ocr).includes(normWs(snippet));
}
const isConf = (c: unknown): c is Confidence => c === 'high' || c === 'medium' || c === 'low';

/**
 * Validate one AI field. A value whose quoted snippet is not found verbatim in the OCR text is
 * treated as ungrounded: we do NOT show the AI value; the caller keeps the offline rule result.
 */
function checkField<T>(raw: any, ocr: string, valid: (v: unknown) => v is T, name: string): Field<T> | 'ungrounded' {
  if (!raw || typeof raw !== 'object') throw new AiError(`missing ${name}`);
  if (raw.value === null || raw.value === undefined) return { value: null, snippet: null, confidence: null };
  if (!valid(raw.value)) throw new AiError(`invalid ${name}`);
  if (!snippetInText(raw.snippet ?? null, ocr)) return 'ungrounded';
  return { value: raw.value, snippet: raw.snippet, confidence: isConf(raw.confidence) ? raw.confidence : 'low', note: 'From AI mode; source text verified in the OCR text.' };
}
const UNGROUNDED = 'AI mode gave a value for this field but its quoted source text is not in the document text, so it was discarded; showing the offline result instead.';
function pick<T>(ai: Field<T> | 'ungrounded', base: Field<T>): Field<T> {
  return ai === 'ungrounded' ? { ...base, note: UNGROUNDED } : ai;
}

const isIsoDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const isMoney = (v: unknown): v is { amount: number; currency: string } =>
  !!v && typeof v === 'object' && typeof (v as any).amount === 'number' && Number.isFinite((v as any).amount) && (v as any).amount >= 0 && /^[A-Z]{3}$/.test((v as any).currency);
const isDocType = (v: unknown): v is DocType => typeof v === 'string' && (DOC_TYPES as readonly string[]).includes(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 120;

/** Validate a parsed model answer and merge it into a card. Throws AiError on anything invalid. */
export function cardFromAi(json: unknown, base: ActionCard): ActionCard {
  if (!json || typeof json !== 'object') throw new AiError('not an object');
  const j = json as any;
  const ocr = base.ocrText;
  const dt = checkField(j.doc_type, ocr, isDocType, 'doc_type');
  // doc type is a classification: keep the AI label even if its snippet is loose, but mark it low.
  const docType: Field<DocType> = dt === 'ungrounded' ? { value: j.doc_type.value, snippet: null, confidence: 'low', note: 'AI mode classification (no verifiable quote).' } : dt;
  const deadline = pick(checkField(j.deadline, ocr, isIsoDate, 'deadline'), base.deadline);
  const kind = deadline === base.deadline || deadline.note === UNGROUNDED ? base.deadline.kind : ['deadline', 'expiry', 'appointment'].includes(j.deadline?.kind) ? j.deadline.kind : 'deadline';
  const amount = pick(checkField(j.amount, ocr, isMoney, 'amount'), base.amount);
  const reference = pick(checkField(j.reference, ocr, isStr, 'reference'), base.reference);
  const docLang: Lang | null = (LANGS as readonly string[]).includes(j.doc_language) ? j.doc_language : null;
  for (const k of ['next_action', 'reply_doc_language', 'reply_user_language']) {
    if (typeof j[k] !== 'string' || !j[k].trim() || j[k].length > 1500) throw new AiError(`invalid ${k}`);
  }
  const type = docType.value ?? 'unknown';
  let card: ActionCard = {
    ...base,
    mode: 'ai',
    docType: docType.value ? docType : { value: 'unknown', snippet: null, confidence: 'low' },
    docLanguage: docLang ? { value: docLang, snippet: null, confidence: 'medium', note: 'From AI mode.' } : base.docLanguage,
    deadline: { ...deadline, kind },
    amount,
    reference,
    nextAction: { text: j.next_action.trim() },
    reply: { docLang: docLang ?? base.reply.docLang, docText: j.reply_doc_language.trim(), userText: j.reply_user_language.trim() },
  };
  // Safety: medicine labels always get the fixed "confirm with a pharmacist" action, never model text.
  if (type === 'medicine_label') {
    card = { ...card, nextAction: { text: nextActionText('medicine_label', base.userLanguage, card.deadline.value, null) } };
    card.labelQuote = base.labelQuote;
  }
  return card;
}

export async function extractWithAi(base: ActionCard, key: string, model: string, timeoutMs = 25000): Promise<ActionCard> {
  if (!key) throw new AiError('no key');
  if (!navigator.onLine) throw new AiError('offline');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(XAI_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ today: new Date().toISOString().slice(0, 10), user_language: base.userLanguage, ocr_text: base.ocrText.slice(0, 12000) }) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'action_card', schema: CARD_SCHEMA, strict: true } },
      }),
    });
    if (!res.ok) throw new AiError(`xAI API returned HTTP ${res.status}`);
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AiError('no message content');
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { throw new AiError('answer was not valid JSON'); }
    return cardFromAi(parsed, base);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new AiError('timed out');
    throw new AiError('network error');
  } finally {
    clearTimeout(t);
  }
}

export { regenerateActions };
