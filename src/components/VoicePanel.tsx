// Settings > Reading voice. iPhone app: natural offline voice (Kokoro for English, bundled; downloadable packs for
// de/es/fr/pl/pt/ro) or the iPhone's own voices; Automatic / Female / Male, "Preview voice", voice download and the
// voice credits. Web: the browser's voices only. Letter text is never sent anywhere.
import { useEffect, useState } from 'react';
import type { Settings } from '../lib/settings';
import { useLang, useT } from '../lib/i18n';
import { isNative } from '../lib/native';
import { pickVoice, listVoices, speak, speechAvailable, stopSpeaking, SPEECH_LANG, type VoiceGender, type VoiceInfo } from '../lib/speech';
import { baseLang, downloadPack, hasNeuralFor, neuralStatus, neuralVoiceFor, packMB, removePack } from '../lib/tts/neural';
import { UI_LANG_NAMES, type UiLangCode } from '../lib/types';
import { IconSpeaker } from './Icons';

export const VOICE_CREDITS: { what: string; license: string; url: string }[] = [
  { what: 'sherpa-onnx speech engine (k2-fsa), built without eSpeak-ng', license: 'Apache-2.0', url: 'https://github.com/k2-fsa/sherpa-onnx' },
  { what: 'ONNX Runtime (Microsoft)', license: 'MIT', url: 'https://github.com/microsoft/onnxruntime' },
  { what: 'Kokoro-82M v1.0 model and voices Heart (af_heart) and Michael (am_michael), by hexgrad', license: 'Apache-2.0', url: 'https://huggingface.co/hexgrad/Kokoro-82M' },
  { what: 'misaki English pronunciation dictionary (us_gold/us_silver), by hexgrad', license: 'Apache-2.0', url: 'https://github.com/hexgrad/misaki' },
  { what: 'Coqui TTS VITS voices for German, Spanish, French (CSS10), Polish (M-AILABS), Portuguese and Romanian (Common Voice), trained by Neongecko', license: 'BSD-3-Clause', url: 'https://github.com/coqui-ai/TTS' },
  { what: 'CSS10 dataset (Park & Mulc), LibriVox public-domain recordings', license: 'Apache-2.0', url: 'https://github.com/Kyubyong/css10' },
  { what: 'M-AILABS Speech Dataset (Polish), LibriVox public-domain recordings', license: 'BSD-3-Clause-style (M-AILABS)', url: 'https://github.com/i-celeste-aurora/m-ailabs-dataset' },
  { what: 'Mozilla Common Voice (Portuguese, Romanian)', license: 'CC0-1.0', url: 'https://commonvoice.mozilla.org' },
];

export function VoiceCredits() {
  const t = useT();
  return (
    <details className="small muted" data-testid="voice-credits" style={{ marginTop: 10 }}>
      <summary style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}>{t("voice_credits")}</summary>
      <ul style={{ paddingInlineStart: 18 }}>
        {VOICE_CREDITS.map((c) => <li key={c.url + c.what}>{c.what}. License: {c.license}. <span dir="ltr">{c.url}</span></li>)}
      </ul>
    </details>
  );
}

export function VoicePanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useT();
  const L = useLang() as UiLangCode;
  const gender: VoiceGender = settings.voiceGender ?? 'auto';
  const kind = settings.voiceKind ?? 'natural';
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [natural, setNatural] = useState<{ installed: boolean } | null>(null);
  const [dl, setDl] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const lang = SPEECH_LANG[L];
  const refresh = () => neuralStatus(true).then((s) => setNatural(s ? { installed: !!s.packs?.[baseLang(lang)]?.installed } : null));
  useEffect(() => { listVoices().then(setVoices).catch(() => setVoices([])); return () => stopSpeaking(); }, []);
  useEffect(() => { refresh(); }, [lang]);
  if (!speechAvailable()) return null;
  const neuralOk = isNative() && natural !== null;
  const useNatural = neuralOk && kind === 'natural' && hasNeuralFor(lang);
  const langName = UI_LANG_NAMES[L];
  const pick = voices ? pickVoice(voices, lang, gender) : null;
  let status = '';
  if (useNatural && natural?.installed) {
    const nv = neuralVoiceFor(lang, gender);
    status = t('voice_natural_using', { name: nv.name });
    if (!nv.matched || (gender !== 'auto' && nv.gender === 'mixed')) status += ' ' + t('voice_natural_one', { lang: langName, gender: nv.gender === 'male' ? t('voice_male_word') : nv.gender === 'female' ? t('voice_female_word') : '—' });
  } else if (pick) {
    status = !pick.voice ? t('speak_no_voice', { lang: langName })
      : !pick.genderMatched ? t(gender === 'male' ? 'voice_no_male' : 'voice_no_female', { lang: langName, name: pick.voice.name })
      : t('voice_using', { name: pick.voice.name });
    if (neuralOk && kind === 'natural' && !hasNeuralFor(lang)) status = t('voice_natural_none', { lang: langName }) + ' ' + status;
  }
  const preview = async () => {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    const o = await speak(t('voice_preview_text'), lang, () => setPlaying(false), gender);
    if (o.result !== 'started') { setPlaying(false); setMsg(t(o.result === 'no-voice' ? 'speak_no_voice' : 'speak_unavailable', { lang: langName })); } else setMsg(null);
  };
  const download = async () => {
    setDl(0); setMsg(null);
    try { await downloadPack(lang, setDl); setMsg(t('voice_installed', { lang: langName })); }
    catch (e) { setMsg(t('voice_download_failed', { msg: (e as Error)?.message ?? '' })); }
    setDl(null); refresh();
  };
  return (
    <section className="panel" data-testid="voice-section">
      <div className="panel-head"><span className="panel-ic" aria-hidden><IconSpeaker /></span><label htmlFor="voice-gender" className="panel-title">{t('voice_title')}</label></div>
      {neuralOk && (
        <select aria-label={t('voice_kind')} value={kind} onChange={(e) => { onChange({ ...settings, voiceKind: e.target.value as 'natural' | 'system' }); setMsg(null); }} data-testid="voice-kind" style={{ marginBottom: 8 }}>
          <option value="natural">{t('voice_natural')}</option>
          <option value="system">{t('voice_system')}</option>
        </select>
      )}
      <select id="voice-gender" value={gender} onChange={(e) => { onChange({ ...settings, voiceGender: e.target.value as VoiceGender }); setMsg(null); }} data-testid="voice-gender">
        <option value="auto">{t('voice_auto')}</option>
        <option value="female">{t('voice_female')}</option>
        <option value="male">{t('voice_male')}</option>
      </select>
      <div className="row-btns" style={{ marginTop: 10 }}>
        <button className="btn small secondary" onClick={preview} aria-pressed={playing} data-testid="voice-preview">{playing ? t('speak_stop') : t('voice_preview')}</button>
        {useNatural && natural && !natural.installed && baseLang(lang) !== 'en' && (
          <button className="btn small secondary" onClick={download} disabled={dl !== null} data-testid="voice-download">
            {dl !== null ? t('voice_downloading', { pct: String(dl) }) : t('voice_download', { lang: langName, mb: String(packMB(lang)) })}
          </button>
        )}
        {useNatural && natural?.installed && baseLang(lang) !== 'en' && (
          <button className="btn small secondary" onClick={async () => { await removePack(lang); refresh(); }} data-testid="voice-remove">{t('voice_remove')}</button>
        )}
      </div>
      {status && <p className="small" role="status" data-testid="voice-status">{status}</p>}
      {msg && <p className="small muted" role="status" data-testid="voice-msg">{msg}</p>}
      {(isNative() || /iPhone|iPad/.test(navigator.userAgent)) && !useNatural && <p className="small muted" data-testid="voice-help">{t('voice_help')}</p>}
      <VoiceCredits />
    </section>
  );
}
