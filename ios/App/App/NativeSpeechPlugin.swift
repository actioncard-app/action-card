// Read aloud with the iPhone's own voices (AVSpeechSynthesizer), on the device and offline.
// JS: src/lib/speech.ts -> NativeSpeech.voices() / speak({ text, voiceId, lang, rate, pitch }) / stop()
// voices() lists every installed voice with its quality (1 default, 2 enhanced, 3 premium) and gender
// (0 unspecified, 1 male, 2 female); speech.ts picks the best one for the language and the chosen gender.
// Events: "speechEnd" { reason: "finished" | "cancelled" }. Nothing leaves the phone.
import Foundation
import AVFoundation
import Capacitor

@objc(NativeSpeechPlugin)
public class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "NativeSpeechPlugin"
    public let jsName = "NativeSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "voices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]
    private let synth = AVSpeechSynthesizer()
    private var started = false

    override public func load() { synth.delegate = self }

    private func describe(_ v: AVSpeechSynthesisVoice) -> [String: Any] {
        var novelty = false, personal = false
        if #available(iOS 17.0, *) {
            novelty = v.voiceTraits.contains(.isNoveltyVoice)
            personal = v.voiceTraits.contains(.isPersonalVoice)
        }
        let gender: Int
        switch v.gender { case .male: gender = 1; case .female: gender = 2; default: gender = 0 }
        return ["id": v.identifier, "name": v.name, "lang": v.language, "quality": v.quality.rawValue,
                "gender": gender, "novelty": novelty, "personal": personal]
    }

    @objc func voices(_ call: CAPPluginCall) {
        call.resolve(["voices": AVSpeechSynthesisVoice.speechVoices().map(describe)])
    }

    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), !text.isEmpty else { call.reject("No text"); return }
        let u = AVSpeechUtterance(string: text)
        var voice: AVSpeechSynthesisVoice? = nil
        if let id = call.getString("voiceId") { voice = AVSpeechSynthesisVoice(identifier: id) }
        if voice == nil, let lang = call.getString("lang") { voice = AVSpeechSynthesisVoice(language: lang) }
        u.voice = voice
        // natural defaults: Apple's default rate (0.5), pitch 1.0; JS may adjust slightly
        let rate = Float(call.getDouble("rate") ?? Double(AVSpeechUtteranceDefaultSpeechRate))
        u.rate = min(max(rate, AVSpeechUtteranceMinimumSpeechRate), AVSpeechUtteranceMaximumSpeechRate)
        u.pitchMultiplier = Float(min(max(call.getDouble("pitch") ?? 1.0, 0.75), 1.25))
        u.preUtteranceDelay = 0.05
        u.postUtteranceDelay = 0.1
        DispatchQueue.main.async {
            // play through the speaker like a voice memo, ducking music; ignore if the session is busy
            let s = AVAudioSession.sharedInstance()
            try? s.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try? s.setActive(true)
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            self.started = false
            self.synth.speak(u)
            var r: [String: Any] = ["started": true]
            if let v = voice { r["voice"] = self.describe(v) }
            call.resolve(r)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.synth.stopSpeaking(at: .immediate)
            call.resolve()
        }
    }

    private func deactivate() {
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        started = true
        notifyListeners("speechStart", data: [:])
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        deactivate(); notifyListeners("speechEnd", data: ["reason": "finished"])
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        deactivate(); notifyListeners("speechEnd", data: ["reason": "cancelled"])
    }
}
