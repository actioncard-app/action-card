// Apple Vision text recognition for LetterScan.
// JS: src/lib/vision.ts  ->  VisionOCR.recognize({ image: <base64 JPEG/PNG>, languages: ["de-DE", ...] })
// Returns { lines: [{ text, confidence, x, y, w, h }], width, height, languages, revision }.
// Boxes are normalised (0..1) with the origin at the TOP-left (Vision uses bottom-left; converted here).
// Everything runs on the device; no network. NOT YET BUILT OR RUN: written on Linux without Xcode.
import Foundation
import UIKit
import Vision
import Capacitor

@objc(VisionOCRPlugin)
public class VisionOCRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionOCRPlugin"
    public let jsName = "VisionOCR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "supportedLanguages", returnType: CAPPluginReturnPromise),
    ]

    private func supported(_ request: VNRecognizeTextRequest) -> [String] {
        return (try? request.supportedRecognitionLanguages()) ?? []
    }

    @objc func supportedLanguages(_ call: CAPPluginCall) {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        call.resolve(["languages": supported(request)])
    }

    @objc func recognize(_ call: CAPPluginCall) {
        guard var b64 = call.getString("image"), !b64.isEmpty else {
            call.reject("No image")
            return
        }
        if let comma = b64.firstIndex(of: ","), b64.hasPrefix("data:") { b64 = String(b64[b64.index(after: comma)...]) }
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("Could not decode image")
            return
        }
        let wanted = call.getArray("languages", String.self) ?? ["en-US"]
        let correction = call.getBool("languageCorrection") ?? true
        let orientation = CGImagePropertyOrientation(image.imageOrientation)

        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = correction
            if #available(iOS 16.0, *) {
                request.revision = VNRecognizeTextRequestRevision3
            }
            let available = self.supported(request)
            let langs = wanted.filter { available.contains($0) }
            if !langs.isEmpty { request.recognitionLanguages = langs }
            if #available(iOS 16.0, *) {
                // let Vision pick among the requested languages when the user did not choose one
                request.automaticallyDetectsLanguage = langs.count > 1
            }
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
            do {
                try handler.perform([request])
            } catch {
                call.reject("Vision failed: \(error.localizedDescription)")
                return
            }
            var lines: [[String: Any]] = []
            for observation in request.results ?? [] {
                guard let top = observation.topCandidates(1).first else { continue }
                let box = observation.boundingBox // normalised, origin bottom-left
                lines.append([
                    "text": top.string,
                    "confidence": Double(top.confidence),
                    "x": Double(box.minX),
                    "y": Double(1.0 - box.maxY),
                    "w": Double(box.width),
                    "h": Double(box.height),
                ])
            }
            call.resolve([
                "lines": lines,
                "width": cgImage.width,
                "height": cgImage.height,
                "languages": request.recognitionLanguages,
                "revision": request.revision,
            ])
        }
    }
}

extension CGImagePropertyOrientation {
    init(_ o: UIImage.Orientation) {
        switch o {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
