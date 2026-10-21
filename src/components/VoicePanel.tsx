// Settings > Reading voice: Automatic / Female / Male, a "Preview voice" button and where to get nicer voices.
// The voice itself is picked on the phone (speech.ts pickVoice); nothing is downloaded or sent.
import { useEffect, useState } from 'react';
import type { Settings } from '../lib/settings';
import { useLang, useT } from '../lib/i18n';
import { isNative } from '../lib/native';
import { pickVoice, listVoices, speak, speechAvailable, stopSpeaking, SPEECH_LANG, type VoiceGender, type VoiceInfo } from '../lib/speech';
import { UI_LANG_NAMES, type UiLangCode } from '../lib/types';
import { IconSpeaker } from './Icons';

export function VoicePanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useT();
  const L = useLang() as UiLangCode;
  const gender: VoiceGender = settings.voiceGender ?? 'auto';
  const [voices, setVoices] = useState<VoiceInfo[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { listVoices().then(setVoices).catch(() => setVoices([])); return () => stopSpeaking(); }, []);
  if (!speechAvailable()) return null;
  const lang = SPEECH_LANG[L];
  const pick = voices ? pickVoice(voices, lang, gender) : null;
  const status = !pick ? '' : !pick.voice ? t('speak_no_voice', { lang: UI_LANG_NAMES[L] })
    : !pick.genderMatched ? t(gender === 'male' ? 'voice_no_male' : 'voice_no_female', { lang: UI_LANG_NAMES[L], name: pick.voice.name })
    : t('voice_using', { name: pick.voice.name });
  const preview = async () => {
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    const o = await speak(t('voice_preview_text'), lang, () => setPlaying(false), gender);
    if (o.result !== 'started') { setPlaying(false); setMsg(t(o.result === 'no-voice' ? 'speak_no_voice' : 'speak_unavailable', { lang: UI_LANG_NAMES[L] })); } else setMsg(null);
  };
  return (
    <section className="panel" data-testid="voice-section">
      <div className="panel-head"><span className="panel-ic" aria-hidden><IconSpeaker /></span><label htmlFor="voice-gender" className="panel-title">{t('voice_title')}</label></div>
      <select id="voice-gender" value={gender} onChange={(e) => { onChange({ ...settings, voiceGender: e.target.value as VoiceGender }); setMsg(null); }} data-testid="voice-gender">
        <option value="auto">{t('voice_auto')}</option>
        <option value="female">{t('voice_female')}</option>
        <option value="male">{t('voice_male')}</option>
      </select>
      <div className="row-btns" style={{ marginTop: 10 }}>
        <button className="btn small secondary" onClick={preview} aria-pressed={playing} data-testid="voice-preview">{playing ? t('speak_stop') : t('voice_preview')}</button>
      </div>
      {status && <p className="small" role="status" data-testid="voice-status">{status}</p>}
      {msg && <p className="small muted" role="status" data-testid="voice-msg">{msg}</p>}
      {(isNative() || /iPhone|iPad/.test(navigator.userAgent)) && <p className="small muted" data-testid="voice-help">{t('voice_help')}</p>}
    </section>
  );
}
