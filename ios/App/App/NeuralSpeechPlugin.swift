// Natural offline voices: on-device neural text-to-speech with sherpa-onnx (Apache-2.0, built from master without
// eSpeak-ng, so no GPL code) and onnxruntime (MIT).
//  - English: Kokoro-82M v1.0 (Apache-2.0), voices af_heart (female) and am_michael (male), bundled in the app
//    (Voices/en). JS (src/lib/tts/en-g2p.ts) turns the text into Kokoro phonemes with the misaki lexicon
//    (Apache-2.0; looked up here with lookup()) and passes one phoneme string per sentence.
//  - de/es/fr/pl/pt/ro: Coqui VITS character models (BSD-3-Clause), downloaded once from this app's GitHub release
//    "voices-v1", verified with SHA-256 and kept in Application Support/Voices/<lang> (not backed up). Numbers and
//    dates are spelled out here with NumberFormatter(.spellOut) for that language.
// Speech is generated sentence by sentence on a background queue and played as soon as the first sentence is ready.
// The letter text never leaves the phone: the only network use is downloading a voice file the user asked for.
// Events: neuralStart {firstAudioMs, loadMs, footprintMB}, neuralEnd {reason, footprintMB, peakMB},
//         neuralError {message}, neuralDownload {lang, received, total, done}
import Foundation
import AVFoundation
import CryptoKit
import Capacitor
import SherpaKit

@objc(NeuralSpeechPlugin)
public class NeuralSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NeuralSpeechPlugin"
    public let jsName = "NeuralSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "lookup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "normalize", returnType: CAPPluginReturnPromise),
    ]

    private let genQueue = DispatchQueue(label: "letterscan.tts.gen", qos: .userInitiated)
    private var tts: OpaquePointer? = nil
    private var ttsKey = ""
    private var ttsRate: Int32 = 24000
    private var generation = 0          // bumps on stop/new speak; stale work checks it
    private let audio = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var attachedRate: Double = 0
    private var pending = 0
    private var genDone = false
    private var peakMB = 0.0
    private var scheduledSec = 0.0
    private var playStart = CFAbsoluteTimeGetCurrent()
    private var idleWork: DispatchWorkItem? = nil
    private var lexicon: Lexicon? = nil
    private var observations: [NSKeyValueObservation] = []

    override public func load() {
        audio.attach(player)
        NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: nil) { [weak self] _ in
            self?.genQueue.async { self?.releaseEngine() }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self, self.pending == 0 else { return }
            self.genQueue.async { self.releaseEngine() }
        }
    }

    // MARK: files
    private func bundledDir(_ lang: String) -> URL? {
        guard let u = Bundle.main.resourceURL?.appendingPathComponent("Voices/\(lang)") else { return nil }
        return FileManager.default.fileExists(atPath: u.appendingPathComponent("tokens.txt").path) ? u : nil
    }
    private func packsRoot() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var u = base.appendingPathComponent("Voices", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        var rv = URLResourceValues(); rv.isExcludedFromBackup = true; try? u.setResourceValues(rv)
        return u
    }
    private func installedDir(_ lang: String) -> URL? {
        if let b = bundledDir(lang) { return b }
        let d = packsRoot().appendingPathComponent(lang)
        return FileManager.default.fileExists(atPath: d.appendingPathComponent("ok.json").path) ? d : nil
    }

    static func footprintMB() -> Double {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) }
        }
        return kr == KERN_SUCCESS ? Double(info.phys_footprint) / 1_048_576 : -1
    }

    @objc func status(_ call: CAPPluginCall) {
        var packs: [String: Any] = [:]
        for l in ["en", "de", "es", "fr", "pl", "pt", "ro"] {
            packs[l] = ["installed": installedDir(l) != nil, "bundled": bundledDir(l) != nil]
        }
        call.resolve(["available": true, "packs": packs, "footprintMB": Self.footprintMB(),
                      "state": ["pending": pending, "genDone": genDone, "generation": generation, "scheduledSec": scheduledSec,
                                "engineRunning": audio.isRunning, "playerPlaying": player.isPlaying, "loaded": ttsKey]])
    }

    // MARK: lexicon (sorted "word phonemes" lines, memory-mapped, binary search)
    final class Lexicon {
        let data: Data
        var starts: [Int32] = []
        init?(url: URL) {
            guard let d = try? Data(contentsOf: url, options: .alwaysMapped) else { return nil }
            data = d
            d.withUnsafeBytes { (p: UnsafeRawBufferPointer) in
                let b = p.bindMemory(to: UInt8.self)
                starts.reserveCapacity(180_000)
                var lineStart = 0
                for i in 0..<b.count where b[i] == 10 {
                    if i > lineStart { starts.append(Int32(lineStart)) }
                    lineStart = i + 1
                }
                if lineStart < b.count { starts.append(Int32(lineStart)) }
            }
        }
        func find(_ word: String) -> String? {
            let key = Array(word.utf8)
            return data.withUnsafeBytes { (p: UnsafeRawBufferPointer) -> String? in
                let b = p.bindMemory(to: UInt8.self)
                var lo = 0, hi = starts.count - 1
                while lo <= hi {
                    let mid = (lo + hi) / 2
                    let s = Int(starts[mid])
                    var i = 0, cmp = 0
                    while true {
                        let c: Int = s + i < b.count ? Int(b[s + i]) : 10
                        let fieldEnd = c == 32 || c == 10
                        if i == key.count { cmp = fieldEnd ? 0 : -1; break }
                        if fieldEnd { cmp = 1; break }
                        if Int(key[i]) != c { cmp = Int(key[i]) < c ? -1 : 1; break }
                        i += 1
                    }
                    if cmp == 0 {
                        var e = s + key.count + 1
                        let start = e
                        while e < b.count && b[e] != 10 { e += 1 }
                        return String(decoding: UnsafeBufferPointer(rebasing: b[start..<e]), as: UTF8.self)
                    }
                    if cmp < 0 { hi = mid - 1 } else { lo = mid + 1 }
                }
                return nil
            }
        }
    }

    @objc func lookup(_ call: CAPPluginCall) {
        let words = call.getArray("words", String.self) ?? []
        genQueue.async {
            if self.lexicon == nil, let d = self.bundledDir("en") { self.lexicon = Lexicon(url: d.appendingPathComponent("lexicon-en.txt")) }
            guard let lex = self.lexicon else { call.reject("English voice is not installed"); return }
            var found: [String: String] = [:]
            for w in words { if let p = lex.find(w) { found[w] = p } }
            call.resolve(["found": found])
        }
    }

    // MARK: engine
    private func releaseEngine() {
        if let t = tts { SherpaOnnxDestroyOfflineTts(t) }
        tts = nil; ttsKey = ""
    }

    /// Load the model for lang on genQueue. Returns load time in ms (0 if already loaded) or nil.
    private func ensureEngine(_ lang: String) -> Double? {
        if ttsKey == lang, tts != nil { return 0 }
        releaseEngine()
        guard let dir = installedDir(lang) else { return nil }
        let t0 = CFAbsoluteTimeGetCurrent()
        var keep: [UnsafeMutablePointer<CChar>] = []
        func c(_ s: String) -> UnsafePointer<CChar> { let p = strdup(s)!; keep.append(p); return UnsafePointer(p) }
        defer { keep.forEach { free($0) } }
        var cfg = SherpaOnnxOfflineTtsConfig()
        cfg.model.num_threads = 2
        cfg.model.provider = c("cpu")
        cfg.model.debug = 0
        cfg.max_num_sentences = 1
        cfg.silence_scale = 0.2
        if lang == "en" {
            cfg.model.kokoro.model = c(dir.appendingPathComponent("model.int8.onnx").path)
            cfg.model.kokoro.voices = c(dir.appendingPathComponent("voices.bin").path)
            cfg.model.kokoro.tokens = c(dir.appendingPathComponent("tokens.txt").path)
            cfg.model.kokoro.length_scale = 1.0
        } else {
            cfg.model.vits.model = c(dir.appendingPathComponent("model.onnx").path)
            cfg.model.vits.tokens = c(dir.appendingPathComponent("tokens.txt").path)
            cfg.model.vits.noise_scale = 0.667
            cfg.model.vits.noise_scale_w = 0.8
            cfg.model.vits.length_scale = 1.0
        }
        guard let t = SherpaOnnxCreateOfflineTts(&cfg) else { return nil }
        tts = t; ttsKey = lang; ttsRate = SherpaOnnxOfflineTtsSampleRate(t)
        return (CFAbsoluteTimeGetCurrent() - t0) * 1000
    }

    @objc func prepare(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en"
        genQueue.async {
            if let ms = self.ensureEngine(lang) { call.resolve(["loadMs": ms, "footprintMB": Self.footprintMB()]) }
            else { call.reject("Voice not installed: \(lang)") }
        }
    }

    // MARK: speak
    @objc func speak(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en"
        let ipa = call.getArray("ipa", String.self) ?? []
        let sentences = call.getArray("sentences", String.self) ?? []
        let sid = Int32(call.getInt("sid") ?? 0)
        let speed = Float(call.getDouble("speed") ?? 1.0)
        let pieces = lang == "en" ? ipa : sentences.map { Self.normalizeVits($0, lang: lang) }
        guard !pieces.isEmpty else { call.reject("Nothing to read"); return }
        stopPlayback()
        generation += 1
        let gen = generation
        let t0 = CFAbsoluteTimeGetCurrent()
        peakMB = Self.footprintMB()
        call.resolve(["ok": true])
        genQueue.async {
            guard let loadMs = self.ensureEngine(lang), let tts = self.tts else {
                self.notifyListeners("neuralError", data: ["message": "Voice not installed: \(lang)"]); return
            }
            DispatchQueue.main.sync { self.pending = 0; self.genDone = false; self.scheduledSec = 0; self.idleWork?.cancel(); self.setupAudio(rate: Double(self.ttsRate)) }
            var first = true
            for (pi, piece) in pieces.enumerated() {
                self.notifyListeners("neuralProgress", data: ["piece": pi, "of": pieces.count, "ms": (CFAbsoluteTimeGetCurrent() - t0) * 1000])
                if gen != self.generation { return }
                var g = SherpaOnnxGenerationConfig()
                g.sid = sid; g.speed = speed; g.silence_scale = 0.2
                var out: UnsafePointer<SherpaOnnxGeneratedAudio>? = nil
                if lang == "en" {
                    let cps = piece.unicodeScalars.map { Int32($0.value) }
                    let lens: [Int32] = [Int32(cps.count)]
                    cps.withUnsafeBufferPointer { cp in
                        lens.withUnsafeBufferPointer { lp in
                            g.phoneme_codepoints = cp.baseAddress
                            g.phoneme_codepoints_lens = lp.baseAddress
                            g.phoneme_codepoints_num_sentences = 1
                            out = SherpaOnnxOfflineTtsGenerateWithConfig(tts, "", &g, nil, nil)
                        }
                    }
                } else {
                    out = SherpaOnnxOfflineTtsGenerateWithConfig(tts, piece, &g, nil, nil)
                }
                guard let a = out else { continue }
                let n = Int(a.pointee.n)
                let a_rate = Int(a.pointee.sample_rate)
                if n > 0, let buf = AVAudioPCMBuffer(pcmFormat: AVAudioFormat(standardFormatWithSampleRate: Double(a.pointee.sample_rate), channels: 1)!, frameCapacity: AVAudioFrameCount(n)) {
                    buf.frameLength = AVAudioFrameCount(n)
                    memcpy(buf.floatChannelData![0], a.pointee.samples, n * MemoryLayout<Float>.size)
                    SherpaOnnxDestroyOfflineTtsGeneratedAudio(a)
                    self.peakMB = max(self.peakMB, Self.footprintMB())
                    let isFirst = first
                    first = false
                    let firstMs = (CFAbsoluteTimeGetCurrent() - t0) * 1000
                    DispatchQueue.main.async {
                        if gen != self.generation { return }
                        let canPlay = self.audio.isRunning
                        self.scheduledSec += Double(n) / Double(a_rate)
                        if canPlay {
                            self.pending += 1
                            self.player.scheduleBuffer(buf) { DispatchQueue.main.async { self.bufferDone(gen) } }
                        }
                        if isFirst {
                            self.playStart = CFAbsoluteTimeGetCurrent()
                            if canPlay { self.player.play() }
                            self.notifyListeners("neuralStart", data: ["firstAudioMs": firstMs, "loadMs": loadMs,
                                                                       "footprintMB": Self.footprintMB(), "audioOutput": canPlay,
                                                                       "sampleRate": Int(self.ttsRate), "sentences": pieces.count])
                        }
                    }
                } else { SherpaOnnxDestroyOfflineTtsGeneratedAudio(a) }
            }
            DispatchQueue.main.async {
                if gen != self.generation { return }
                self.genDone = true
                if self.pending == 0 { self.finish(gen, reason: first ? "empty" : "finished"); return }
                // fallback: if buffer callbacks never arrive (no audio route), end when the audio should be over
                let left = max(0, self.scheduledSec - (CFAbsoluteTimeGetCurrent() - self.playStart)) + 1.0
                DispatchQueue.main.asyncAfter(deadline: .now() + left) { self.finish(gen, reason: "finished") }
            }
        }
    }

    private func bufferDone(_ gen: Int) {
        guard gen == generation else { return }
        pending -= 1
        if pending <= 0 && genDone { finish(gen, reason: "finished") }
    }
    private func finish(_ gen: Int, reason: String) {
        guard gen == generation else { return }
        generation += 1
        notifyListeners("neuralEnd", data: ["reason": reason, "footprintMB": Self.footprintMB(), "peakMB": peakMB,
                                            "audioSec": scheduledSec])
        scheduleIdleRelease()
    }
    /// Free the model (hundreds of MB) 90 s after speaking stops; the next speak loads it again (about 1 s).
    private func scheduleIdleRelease() {
        idleWork?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.genQueue.async { self?.releaseEngine() } }
        idleWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 90, execute: w)
    }

    private func setupAudio(rate: Double) {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? s.setActive(true)
        if attachedRate != rate {
            audio.disconnectNodeOutput(player)
            audio.connect(player, to: audio.mainMixerNode, format: AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1))
            attachedRate = rate
        }
        if !audio.isRunning { try? audio.start() }
    }

    private func stopPlayback() {
        let run = { self.player.stop() }
        if Thread.isMainThread { run() } else { DispatchQueue.main.sync(execute: run) }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let was = self.pending > 0 || !self.genDone
            self.generation += 1
            self.player.stop()
            self.pending = 0
            if was { self.notifyListeners("neuralEnd", data: ["reason": "cancelled", "footprintMB": Self.footprintMB(), "peakMB": self.peakMB]) }
            self.scheduleIdleRelease()
            call.resolve()
        }
    }

    // MARK: downloads (one-time, SHA-256 verified)
    @objc func download(_ call: CAPPluginCall) {
        guard let lang = call.getString("lang"), lang.range(of: "^[a-z]{2}$", options: .regularExpression) != nil,
              let files = call.getArray("files", JSObject.self), !files.isEmpty else { call.reject("Bad pack"); return }
        let dir = packsRoot().appendingPathComponent(lang)
        let tmp = packsRoot().appendingPathComponent(".\(lang)-partial")
        try? FileManager.default.removeItem(at: tmp)
        try? FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
        let total = files.reduce(0) { $0 + (($1["bytes"] as? Int) ?? 0) }
        var doneBytes = 0
        func next(_ i: Int) {
            if i == files.count {
                self.observations.removeAll()
                do {
                    try? FileManager.default.removeItem(at: dir)
                    try FileManager.default.moveItem(at: tmp, to: dir)
                    try Data("{\"ok\":true}".utf8).write(to: dir.appendingPathComponent("ok.json"))
                    self.notifyListeners("neuralDownload", data: ["lang": lang, "received": total, "total": total, "done": true])
                    call.resolve(["ok": true])
                } catch { call.reject("Could not save the voice") }
                return
            }
            let f = files[i]
            guard let name = f["name"] as? String, ["model.onnx", "tokens.txt"].contains(name),
                  let urlS = f["url"] as? String, let url = URL(string: urlS), url.host == "github.com" || url.host?.hasSuffix(".githubusercontent.com") == true,
                  let sha = f["sha256"] as? String else { call.reject("Bad pack file"); return }
            let task = URLSession.shared.downloadTask(with: url) { loc, resp, err in
                guard let loc = loc, err == nil, (resp as? HTTPURLResponse)?.statusCode == 200 else {
                    try? FileManager.default.removeItem(at: tmp); call.reject("Download failed. Check the connection and try again."); return
                }
                guard Self.sha256(of: loc) == sha.lowercased() else {
                    try? FileManager.default.removeItem(at: tmp); call.reject("The downloaded voice did not match its checksum and was deleted."); return
                }
                do { try FileManager.default.moveItem(at: loc, to: tmp.appendingPathComponent(name)) }
                catch { call.reject("Could not save the voice"); return }
                doneBytes += (f["bytes"] as? Int) ?? 0
                self.notifyListeners("neuralDownload", data: ["lang": lang, "received": doneBytes, "total": total, "done": false])
                next(i + 1)
            }
            let base = doneBytes, size = (f["bytes"] as? Int) ?? 0
            let obs = task.progress.observe(\.fractionCompleted) { p, _ in
                self.notifyListeners("neuralDownload", data: ["lang": lang, "received": base + Int(Double(size) * p.fractionCompleted), "total": total, "done": false])
            }
            self.observations.append(obs)
            task.resume()
        }
        next(0)
    }

    static func sha256(of url: URL) -> String? {
        guard let h = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? h.close() }
        var hasher = SHA256()
        while true {
            let chunk = h.readData(ofLength: 1 << 20)
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let lang = call.getString("lang"), lang != "en" else { call.reject("Bad language"); return }
        genQueue.async {
            if self.ttsKey == lang { self.releaseEngine() }
            try? FileManager.default.removeItem(at: self.packsRoot().appendingPathComponent(lang))
            call.resolve()
        }
    }

    // MARK: number and date words for the character voices
    @objc func normalize(_ call: CAPPluginCall) {
        call.resolve(["text": Self.normalizeVits(call.getString("text") ?? "", lang: call.getString("lang") ?? "de")])
    }

    static let currencyWords: [String: [String: String]] = [
        "de": ["€": "Euro", "$": "Dollar", "£": "Pfund", "%": "Prozent", "cent": "Cent"],
        "es": ["€": "euros", "$": "dólares", "£": "libras", "%": "por ciento", "cent": "céntimos"],
        "fr": ["€": "euros", "$": "dollars", "£": "livres", "%": "pour cent", "cent": "centimes"],
        "pl": ["€": "euro", "$": "dolarów", "£": "funtów", "%": "procent", "cent": "centów"],
        "pt": ["€": "euros", "$": "dólares", "£": "libras", "%": "por cento", "cent": "cêntimos"],
        "ro": ["€": "euro", "$": "dolari", "£": "lire", "%": "la sută", "cent": "cenți"],
    ]

    static func normalizeVits(_ input: String, lang: String) -> String {
        let loc = Locale(identifier: lang)
        let spell = NumberFormatter(); spell.locale = loc; spell.numberStyle = .spellOut
        let words = currencyWords[lang] ?? currencyWords["de"]!
        func say(_ n: Int) -> String { spell.string(from: NSNumber(value: n)) ?? String(n) }
        var t = input
        func sub(_ pattern: String, _ f: ([String]) -> String?) {
            guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return }
            var out = ""; var last = t.startIndex
            for m in re.matches(in: t, range: NSRange(t.startIndex..., in: t)) {
                guard let r = Range(m.range, in: t) else { continue }
                var groups: [String] = []
                for i in 0..<m.numberOfRanges { groups.append(Range(m.range(at: i), in: t).map { String(t[$0]) } ?? "") }
                out += t[last..<r.lowerBound]
                out += f(groups) ?? String(t[r])
                last = r.upperBound
            }
            out += t[last...]; t = out
        }
        func amount(_ s: String) -> (Int, Int)? {
            var x = s.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\u{00a0}", with: "")
            var cents = 0
            if let r = x.range(of: "[.,](\\d{1,2})$", options: .regularExpression) {
                cents = Int(x[r].dropFirst()) ?? 0
                if x[r].count == 2 { cents *= 10 }
                x.removeSubrange(r)
            }
            x = x.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: "")
            guard let w = Int(x) else { return nil }
            return (w, cents)
        }
        let months = { () -> [String] in let df = DateFormatter(); df.locale = loc; return df.standaloneMonthSymbols ?? df.monthSymbols }()
        func dayWord(_ d: Int) -> String {
            let c = say(d)
            switch lang {
            case "de":
                let irr: [Int: String] = [1: "ersten", 3: "dritten", 7: "siebten", 8: "achten"]
                if let w = irr[d] { return w }
                return c + (d < 20 ? "ten" : "sten")
            case "fr": return d == 1 ? "premier" : c
            default: return c
            }
        }
        func dateText(_ d: Int, _ m: Int, _ y: Int) -> String {
            let mo = months[m - 1]
            switch lang {
            case "es", "pt": return " \(say(d)) de \(mo) de \(say(y)) "
            case "de": return " \(dayWord(d)) \(mo) \(say(y)) "
            default: return " \(dayWord(d)) \(mo) \(say(y)) "
            }
        }
        // reference codes with letters and digits (AB12-345): letters as they are, digits one by one
        sub("\\b(?=[A-Za-z]*\\d)(?=\\d*[A-Za-z])[A-Za-z0-9]{2,}(?:[-/][A-Za-z0-9]+)*\\b") { g in
            " " + g[0].compactMap { ch -> String? in ch.isNumber ? say(Int(String(ch))!) : ch.isLetter ? String(ch).uppercased() : nil }.joined(separator: " ") + " " }
        // dates 30.11.2026 / 30/11/2026 / 2026-11-30
        sub("\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b") { g in
            guard let y = Int(g[1]), let m = Int(g[2]), let d = Int(g[3]), (1...12).contains(m), (1...31).contains(d) else { return nil }
            return dateText(d, m, y) }
        sub("\\b(\\d{1,2})[./](\\d{1,2})[./](\\d{4}|\\d{2})\\b") { g in
            guard let d = Int(g[1]), let m = Int(g[2]), var y = Int(g[3]), (1...12).contains(m), (1...31).contains(d) else { return nil }
            if g[3].count == 2 { y += 2000 }
            return dateText(d, m, y) }
        // money
        let cur = "(€|\\$|£|EUR|USD|GBP)"
        func money(_ c: String, _ n: String) -> String? {
            guard let (w, ct) = amount(n) else { return nil }
            let sym = ["eur": "€", "usd": "$", "gbp": "£"][c.lowercased()] ?? c
            var s = " \(say(w)) \(words[sym] ?? sym)"
            if ct > 0 { s += " \(say(ct)) \(words["cent"]!)" }
            return s + " "
        }
        sub(cur + "\\s?(\\d[\\d.,\u{00a0} ]*\\d|\\d)") { g in money(g[1], g[2]) }
        sub("(\\d[\\d.,\u{00a0} ]*\\d|\\d)\\s?" + cur) { g in money(g[2], g[1]) }
        sub("(\\d+)\\s?%") { g in Int(g[1]).map { " \(say($0)) \(words["%"]!) " } }
        // times 14:30
        sub("\\b(\\d{1,2}):(\\d{2})\\b") { g in
            guard let h = Int(g[1]), let m = Int(g[2]), h < 25, m < 60 else { return nil }
            return m == 0 ? " \(say(h)) " : " \(say(h)) \(say(m)) " }
        // long digit runs (phone, IBAN parts, references): digit by digit
        sub("\\d[\\d /-]{5,}\\d") { g in
            let ds = g[0].filter { $0.isNumber }
            return ds.count >= 6 ? " " + ds.map { say(Int(String($0))!) }.joined(separator: " ") + " " : nil }
        // grouped thousands 1.234 and decimals 3,5
        sub("\\b\\d{1,3}(?:[.\u{00a0}]\\d{3})+\\b") { g in Int(g[0].filter { $0.isNumber }).map { " \(say($0)) " } }
        sub("\\b(\\d+)[,.](\\d+)\\b") { g in
            guard let a = Int(g[1]) else { return nil }
            let sep = ["de": "Komma", "es": "coma", "fr": "virgule", "pl": "przecinek", "pt": "vírgula", "ro": "virgulă"][lang] ?? ","
            return " \(say(a)) \(sep) " + g[2].map { say(Int(String($0))!) }.joined(separator: " ") + " " }
        sub("\\d+") { g in Int(g[0]).map { " \(say($0)) " } }
        t = t.replacingOccurrences(of: "\u{00AD}", with: "")
        t = t.replacingOccurrences(of: "&", with: lang == "de" ? " und " : lang == "fr" ? " et " : lang == "pl" ? " i " : lang == "ro" ? " și " : " y ")
        // the character models know letters and basic punctuation only
        t = t.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).replacingOccurrences(of: " ([,.;:!?])", with: "$1", options: .regularExpression)
        return t.trimmingCharacters(in: .whitespaces)
    }
}
