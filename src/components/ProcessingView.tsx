import type { OcrProgress } from '../lib/ocr';
import { IconCheck } from './Icons';

// Friendly steps derived from the OCR stage text (src/lib/ocr.ts). Step 3 ("Reading") also covers the manual-language
// path, which skips language detection.
const STEPS = ['Preparing your photo', 'Checking orientation & language', 'Reading the text', 'Building your action card'];
function stepOf(stage: string): number {
  if (/^Asking AI/.test(stage)) return 3;
  if (/^Reading/.test(stage)) return 2;
  if (/^(Detecting language|Checking orientation)/.test(stage)) return 1;
  return 0;
}

export default function ProcessingView({ progress, preview }: { progress: OcrProgress; preview: string | null }) {
  const step = stepOf(progress.stage);
  const pct = Math.round(progress.progress * 100);
  return (
    <div className="processing screen" data-testid="processing" aria-busy="true">
      <div className="proc-frame">
        {preview ? <img src={preview} alt="Your document" className="proc-preview" /> : <div className="proc-preview placeholder" />}
        <div className="scanline" aria-hidden />
      </div>
      <h2 className="proc-title">Reading your document…</h2>
      <ol className="steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-dot" aria-hidden>{i < step ? <IconCheck size={14} /> : null}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="proc-stage" role="status" aria-live="polite">{progress.stage}</div>
      <div className="bar" role="progressbar" aria-label="Current step" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div style={{ width: `${pct}%` }} /></div>
      <div className="skeleton" aria-hidden>
        <div className="sk sk-title" /><div className="sk-row"><div className="sk sk-chip" /><div className="sk sk-chip" /></div><div className="sk sk-block" />
      </div>
      <p className="muted small center">Reading happens on this phone. The photo is not uploaded.</p>
    </div>
  );
}
