import UIKit
import Capacitor

/// Bridge view controller that registers the app's local plugins (they are not npm packages, so Capacitor's
/// automatic plugin discovery does not see them).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(VisionOCRPlugin())
        bridge?.registerPluginInstance(NativeSpeechPlugin())
        bridge?.registerPluginInstance(NeuralSpeechPlugin())
    }
}
