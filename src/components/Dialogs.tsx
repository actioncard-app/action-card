// Blocking questions shown over the app: the photo check before OCR, and the AI send preview before every send.
import { useEffect, useRef } from 'react';
import { useT } from '../lib/i18n';
import type { PhotoIssue } from '../lib/photocheck';
import type { PiiKind } from '../lib/redact';

function Modal({ children, label, testid }: { children: React.ReactNode; label: string; testid: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button')?.focus(); }, []);
  return (
    <div className="modal-back">
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={label} ref={ref} data-testid={testid}>{children}</div>
    </div>
  );
}

const ISSUE_KEY = { dark: 'pc_dark', blurry: 'pc_blurry', cut: 'pc_cut', tilted: 'pc_tilted' } as const;

export function PhotoWarning({ issues, onRetake, onUse }: { issues: PhotoIssue[]; onRetake: () => void; onUse: () => void }) {
  const t = useT();
  return (
    <Modal label={t('pc_title')} testid="photo-warning">
      <p className="panel-title">{t('pc_title')}</p>
      <ul className="small">{issues.map((i) => <li key={i} data-issue={i}>{t(ISSUE_KEY[i])}</li>)}</ul>
      <p className="small muted">{t('pc_hint')}</p>
      <div className="row-btns">
        <button className="btn small primary" onClick={onRetake} data-testid="photo-retake">{t('pc_retake')}</button>
        <button className="btn small ghost" onClick={onUse} data-testid="photo-use">{t('pc_use')}</button>
      </div>
    </Modal>
  );
}

const KIND_KEY: Record<PiiKind, Parameters<ReturnType<typeof useT>>[0]> = {
  NAME: 'pii_name', ADDRESS: 'pii_address', IBAN: 'pii_iban', ACCOUNT: 'pii_account', TAX_ID: 'pii_tax', PHONE: 'pii_phone', EMAIL: 'pii_email', BIRTH_DATE: 'pii_birth', REF: 'pii_ref',
};

export function SendPreview({ text, items, onSend, onCancel }: { text: string; items: { placeholder: string; kind: PiiKind }[]; onSend: () => void; onCancel: () => void }) {
  const t = useT();
  const counts = new Map<PiiKind, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return (
    <Modal label={t('send_title')} testid="send-preview">
      <p className="panel-title">{t('send_title')}</p>
      <p className="small">{t('send_body')}</p>
      {items.length > 0
        ? <p className="small" data-testid="send-hidden">{t('send_hidden')} {[...counts].map(([k, n]) => `${t(KIND_KEY[k])} × ${n}`).join(', ')}</p>
        : <p className="small" data-testid="send-hidden">{t('send_none_found')}</p>}
      <p className="small muted">{t('send_check')}</p>
      <pre className="send-text" dir="auto" data-testid="send-text">{text}</pre>
      <div className="row-btns">
        <button className="btn small primary" onClick={onSend} data-testid="send-ai">{t('send_ok')}</button>
        <button className="btn small ghost" onClick={onCancel} data-testid="send-cancel">{t('send_no')}</button>
      </div>
    </Modal>
  );
}
