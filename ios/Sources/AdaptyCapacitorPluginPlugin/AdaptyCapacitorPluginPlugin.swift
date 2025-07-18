import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(AdaptyCapacitorPluginPlugin)
public final class AdaptyCapacitorPluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AdaptyCapacitorPluginPlugin"
    public let jsName = "AdaptyCapacitorPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "handleMethodCall", returnType: CAPPluginReturnPromise)
    ]

    @objc func handleMethodCall(_ call: CAPPluginCall) {
        guard let methodName = call.getString("methodName") else {
            call.reject("methodName is required")
            return
        }
        let args = call.json

        AdaptyCapacitorPlugin.handleMethodCall(method: methodName, withJson: args) { response in
            // Return response as string directly
            call.resolve(["crossPlatformJson": response])
        }
    }

    @objc override public func load() {
        AdaptyCapacitorPlugin.setup()
        AdaptyCapacitorPlugin.setCapacitorPlugin(self)
    }
}
private extension CAPPluginCall {
    var json: String {
        getString("args") ?? "{}"
    }
}
