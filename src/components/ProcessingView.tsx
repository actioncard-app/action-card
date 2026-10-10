import type { OcrProgress } from '../lib/ocr';
import { IconCheck } from './Icons';
import { useLang, useT, type Key } from '../lib/i18n';

// Friendly steps derived from the OCR stage text (src/lib/ocr.ts). Step 3 ("Reading") also covers the manual-language
// path, which skips language detection.
const STEPS: Key[] = ['step_prepare', 'step_orient', 'step_read', 'step_build'];
function stepOf(stage: string): number {
  if (/^Asking AI/.test(stage)) return 3;
  if (/^Reading/.test(stage)) return 2;
  if (/^(Detecting language|Checking orientation)/.test(stage)) return 1;
  return 0;
}

export default function ProcessingView({ progress, preview, page }: { progress: OcrProgress; preview: string | null; page?: number }) {
  const t = useT();
  const lang = useLang();
  const step = stepOf(progress.stage);
  const pct = Math.round(progress.progress * 100);
  return (
    <div className="processing screen" data-testid="processing" aria-busy="true">
      <div className="proc-frame">
        {preview ? <img src={preview} alt={t('your_document')} className="proc-preview" /> : <div className="proc-preview placeholder" />}
        <div className="scanline" aria-hidden />
      </div>
      <h2 className="proc-title">{page && page > 1 ? t('reading_page', { n: page }) : t('reading_title')}</h2>
      <ol className="steps" aria-label={t('progress')}>
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-dot" aria-hidden>{i < step ? <IconCheck size={14} /> : null}</span>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>
      {/* the raw stage text is technical English ("Reading (deu) 40%"); other languages see the step name + percent */}
      <div className="proc-stage" role="status" aria-live="polite">{lang === 'en' ? progress.stage : `${t(STEPS[step])} · ${pct}%`}</div>
      <div className="bar" role="progressbar" aria-label={t('current_step')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div style={{ width: `${pct}%` }} /></div>
      {!preview && (
        <div className="skeleton" aria-hidden>
          <div className="sk sk-title" /><div className="sk-row"><div className="sk sk-chip" /><div className="sk sk-chip" /></div>
        </div>
      )}
      <p className="muted small center">{t('not_uploaded')}</p>
    </div>
  );
}
