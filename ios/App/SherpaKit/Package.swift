// swift-tools-version: 5.9
// Local package wrapping the GPL-free sherpa-onnx iOS static library (built by .github/workflows/sherpa-ios.yml
// from k2-fsa/sherpa-onnx master without eSpeak-ng) and onnxruntime (MIT). The two xcframeworks are not in git;
// scripts/fetch-ios-voice.sh downloads them from this repo's release and checks their SHA-256.
import PackageDescription

let package = Package(
    name: "SherpaKit",
    platforms: [.iOS(.v15)],
    products: [.library(name: "SherpaKit", targets: ["SherpaKit"])],
    targets: [
        .binaryTarget(name: "SherpaOnnxC", path: "Frameworks/sherpa-onnx.xcframework"),
        .binaryTarget(name: "onnxruntime", path: "Frameworks/onnxruntime.xcframework"),
        .target(
            name: "SherpaKit",
            dependencies: ["SherpaOnnxC", "onnxruntime"],
            linkerSettings: [.linkedLibrary("c++"), .linkedFramework("Foundation")]
        ),
    ]
)
