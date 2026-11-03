// Natural offline voices (iPhone app only). See ios/App/App/NeuralSpeechPlugin.swift and VOICE-LICENSES.md.
// English (Kokoro, bundled): text -> words -> phonemes here (en-g2p.ts), audio on the phone.
// de/es/fr/pl/pt/ro (Coqui VITS, downloaded once, SHA-256 checked): sentences go to the phone's model.
// Nothing is sent anywhere; the only network use is the one-time voice download the user starts.
import { registerPlugin } from '@capacitor/core'
import { isNative } from '../native'
import { phonemizeEn } from './en-g2p'
import { shortFirst } from './en-normalize'
import PACKS from './voice-packs.json'

export type NeuralLang = 'en' | 'de' | 'es' | 'fr' | 'pl' | 'pt' | 'ro'
export const RELEASE_BASE = 'https://github.com/actioncard-app/action-card/releases/download/' + PACKS.release + '/'
type PackFile = { name: string; asset: string; sha256: string; bytes: number }
type Pack = { gender: string; model: string; data: string; files: PackFile[] }
export const PACK_INFO = PACKS.packs as Record<Exclude<NeuralLang, 'en'>, Pack>
export const NEURAL_LANGS: NeuralLang[] = ['en', 'de', 'es', 'fr', 'pl', 'pt', 'ro']
/** English voices bundled in the app (speaker ids in the trimmed voices.bin). */
export const EN_VOICES = { female: { sid: 0, name: 'Heart' }, male: { sid: 1, name: 'Michael' } } as const
export const PACK_VOICE_NAME: Record<string, string> = { de: 'CSS10', es: 'CSS10', fr: 'CSS10', pl: 'M-AILABS', pt: 'Common Voice', ro: 'Common Voice' }
/** Name and gender of the natural voice used for lang and the chosen gender. */
export function neuralVoiceFor(lang: string, gender: 'auto' | 'female' | 'male'): { name: string; gender: 'female' | 'male' | 'mixed'; matched: boolean } {
  const L = baseLang(lang)
  if (L === 'en') { const g = gender === 'male' ? 'male' : 'female'; return { name: EN_VOICES[g].name, gender: g, matched: true } }
  const p = PACK_INFO[L as Exclude<NeuralLang, 'en'>]
  const g = (p?.gender ?? 'mixed') as 'female' | 'male' | 'mixed'
  return { name: PACK_VOICE_NAME[L] ?? L, gender: g, matched: gender === 'auto' || g === gender }
}

interface Status { available: boolean; packs: Record<string, { installed: boolean; bundled: boolean }>; footprintMB?: number; state?: Record<string, unknown> }
interface NeuralPlugin {
  status(): Promise<Status>
  lookup(o: { words: string[] }): Promise<{ found: Record<string, string> }>
  prepare(o: { lang: string }): Promise<{ loadMs: number; footprintMB: number }>
  speak(o: { lang: string; ipa?: string[]; sentences?: string[]; sid?: number; speed?: number }): Promise<{ ok: boolean }>
  stop(): Promise<void>
  download(o: { lang: string; files: { name: string; url: string; sha256: string; bytes: number }[] }): Promise<{ ok: boolean }>
  remove(o: { lang: string }): Promise<void>
  normalize(o: { text: string; lang: string }): Promise<{ text: string }>
  addListener(ev: string, fn: (d: any) => void): Promise<{ remove: () => Promise<void> }>
}
export const NeuralSpeech = registerPlugin<NeuralPlugin>('NeuralSpeech')

export function baseLang(lang: string): string { return lang.toLowerCase().split(/[-_]/)[0] }
export function hasNeuralFor(lang: string): lang is NeuralLang { return (NEURAL_LANGS as string[]).includes(baseLang(lang)) }
export function packMB(lang: string): number {
  const p = PACK_INFO[baseLang(lang) as Exclude<NeuralLang, 'en'>]
  return p ? Math.round(p.files.reduce((a, f) => a + f.bytes, 0) / 1048576) : 0
}

let cached: Status | null = null
export async function neuralStatus(force = false): Promise<Status | null> {
  if (!isNative()) return null
  if (cached && !force) return cached
  try { cached = await NeuralSpeech.status(); return cached } catch { return null }
}
export async function neuralInstalled(lang: string): Promise<boolean> {
  const s = await neuralStatus()
  return !!s?.packs?.[baseLang(lang)]?.installed
}

/** Split text into sentences for the character voices. */
export function splitPlain(text: string, max = 240): string[] {
  const out: string[] = []
  for (const s of text.replace(/([,;:.!?])\s*\n+\s*/g, '$1 ').replace(/\s*\n+\s*/g, '. ').split(/(?<=[.!?;:])\s+/)) {
    let t = s.trim(); if (!/\p{L}|\d/u.test(t)) continue
    while (t.length > max) { const c = t.lastIndexOf(' ', max); out.push(t.slice(0, c > 0 ? c : max)); t = t.slice(c > 0 ? c : max).trim() }
    out.push(t)
  }
  return out
}

export interface NeuralTiming { firstAudioMs?: number; loadMs?: number; footprintMB?: number; peakMB?: number; reason?: string; g2pMs?: number }
export let lastTiming: NeuralTiming = {}
let subs: { remove: () => Promise<void> }[] = []

/** Speak with the natural voice. Resolves false if it cannot (caller falls back to the iPhone voice). */
export async function neuralSpeak(text: string, lang: string, gender: 'auto' | 'female' | 'male', onEnd?: () => void, speed = 1): Promise<boolean> {
  if (!isNative() || !hasNeuralFor(lang) || !(await neuralInstalled(lang))) return false
  const L = baseLang(lang)
  await Promise.all(subs.map((s) => s.remove().catch(() => {}))); subs = []
  lastTiming = {}
  try {
    let args: Parameters<NeuralPlugin['speak']>[0]
    if (L === 'en') {
      const t0 = performance.now()
      const { ipa } = await phonemizeEn(text, async (words) => (await NeuralSpeech.lookup({ words })).found)
      lastTiming.g2pMs = Math.round(performance.now() - t0)
      if (!ipa.length) return false
      args = { lang: 'en', ipa, sid: gender === 'male' ? EN_VOICES.male.sid : EN_VOICES.female.sid, speed }
    } else {
      const sentences = shortFirst(splitPlain(text))
      if (!sentences.length) return false
      args = { lang: L, sentences, sid: 0, speed }
    }
    subs.push(await NeuralSpeech.addListener('neuralStart', (d) => { Object.assign(lastTiming, d) }))
    let ended = false
    const end = (d: any) => { if (ended) return; ended = true; Object.assign(lastTiming, d); subs.forEach((s) => s.remove().catch(() => {})); subs = []; onEnd?.() }
    subs.push(await NeuralSpeech.addListener('neuralEnd', end))
    // safety net: when all audio is generated, end at the latest when it should have finished playing
    subs.push(await NeuralSpeech.addListener('neuralGenerated', (d) => {
      const left = Math.max(0, (Number(d?.audioSec) || 0) - (Number(d?.playedSec) || 0)) + 1.5
      setTimeout(() => end({ reason: 'finished', by: 'timer' }), left * 1000)
    }))
    subs.push(await NeuralSpeech.addListener('neuralError', (d) => end({ reason: 'error', message: d?.message })))
    await NeuralSpeech.speak(args)
    return true
  } catch {
    return false
  }
}
export const neuralStop = () => { if (isNative()) NeuralSpeech.stop().catch(() => {}) }

export async function downloadPack(lang: string, onProgress?: (pct: number) => void): Promise<void> {
  const L = baseLang(lang) as Exclude<NeuralLang, 'en'>
  const p = PACK_INFO[L]
  if (!p) throw new Error('no pack')
  const sub = await NeuralSpeech.addListener('neuralDownload', (d) => { if (d?.lang === L && d.total) onProgress?.(Math.min(100, Math.round((d.received / d.total) * 100))) })
  try {
    await NeuralSpeech.download({ lang: L, files: p.files.map((f) => ({ name: f.name, url: RELEASE_BASE + f.asset, sha256: f.sha256, bytes: f.bytes })) })
  } finally { sub.remove().catch(() => {}); cached = null }
}
export async function removePack(lang: string): Promise<void> { await NeuralSpeech.remove({ lang: baseLang(lang) }); cached = null }
