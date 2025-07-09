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
        CAPPluginMethod(name: "handleMethodCall", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = AdaptyCapacitorPlugin()

    @objc func handleMethodCall(_ call: CAPPluginCall) {
        guard let methodName = call.getString("methodName") else {
            call.reject("methodName is required")
            return
        }

        let args = call.getString("args") ?? ""

        implementation.handleMethodCall(method: methodName, withJson: args) { response in
            if let response = response {
                // Try to parse as JSON
                if let responseData = response.data(using: .utf8),
                   let responseJson = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any] {
                    call.resolve(responseJson)
                } else {
                    // Return as string if not JSON
                    call.resolve(["result": response])
                }
            } else {
                call.resolve()
            }
        }
    }
}
