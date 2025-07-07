import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(AdaptyCapacitorPluginPlugin)
public class AdaptyCapacitorPluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AdaptyCapacitorPluginPlugin"
    public let jsName = "AdaptyCapacitorPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isActivated", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = AdaptyCapacitorPlugin()

    @objc func activate(_ call: CAPPluginCall) {
        guard let apiKey = call.getString("apiKey") else {
            call.reject("API key is required")
            return
        }

        let params = call.getObject("params")
        var paramsDict: [String: Any]?

        if let params = params {
            paramsDict = [:]
            for key in params.keys {
                paramsDict?[key] = params[key]
            }
        }

        implementation.activate(apiKey: apiKey, params: paramsDict) { error in
            if let error = error {
                call.reject("Failed to activate Adapty: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    @objc func isActivated(_ call: CAPPluginCall) {
        call.resolve([
            "isActivated": implementation.isActivated()
        ])
    }

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
}
