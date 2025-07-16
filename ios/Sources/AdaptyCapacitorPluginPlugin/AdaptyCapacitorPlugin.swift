import Foundation
import Adapty
import AdaptyPlugin

enum Log {
    typealias Category = AdaptyPlugin.LogCategory

    static let wrapper = Category(subsystem: "io.adapty.capacitor", name: "wrapper")
}

@objc public final class AdaptyCapacitorPlugin: NSObject {
    static let shared = AdaptyCapacitorPlugin()

    // Weak reference to Capacitor plugin for event sending
    private weak var capacitorPlugin: AdaptyCapacitorPluginPlugin?

    @objc static func setup() {
        Task { @MainActor in
            AdaptyPlugin.register(eventHandler: shared)
        }
    }

    @objc static func setCapacitorPlugin(_ plugin: AdaptyCapacitorPluginPlugin) {
        shared.capacitorPlugin = plugin
    }

    @objc static func handleMethodCall(method: String, withJson json: String, completion: @escaping (String) -> Void) {
        Task {
            let response = await AdaptyPlugin.execute(
                method: method,
                withJson: json
            )
            completion(response.asAdaptyJsonString)
            Log.wrapper.info("handleMethodCall")
        }
    }
}

extension AdaptyCapacitorPlugin: EventHandler {
    public func handle(event: AdaptyPluginEvent) {
        do {
            let json = try event.asAdaptyJsonData.asAdaptyJsonString
            Log.wrapper.info("event: \(json)")

            guard let plugin = capacitorPlugin else {
                Log.wrapper.error("No Capacitor plugin reference available for event: \(event.id)")
                return
            }

            // Parse JSON to JSObject for Capacitor
            guard let jsonData = json.data(using: .utf8),
                  let jsonObject = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any] else {
                Log.wrapper.error("Failed to parse event JSON: \(json)")
                return
            }

            plugin.notifyListeners(event.id, data: jsonObject, retainUntilConsumed: true)
            Log.wrapper.info("Event sent to JS: \(event.id)")

        } catch {
            Log.wrapper.error("Plugin encoding error: \(error.localizedDescription)")
        }
    }
}
