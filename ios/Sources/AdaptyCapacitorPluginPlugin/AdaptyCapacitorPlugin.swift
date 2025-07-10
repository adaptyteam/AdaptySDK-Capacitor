import Foundation
import Adapty
import AdaptyPlugin

enum Log {
    typealias Category = AdaptyPlugin.LogCategory

    static let wrapper = Category(subsystem: "io.adapty.capacitor", name: "wrapper")
}

public final class AdaptyCapacitorPlugin: NSObject {
    static let shared = AdaptyCapacitorPlugin()

    static func initialize() {
        Task { @MainActor in
            AdaptyPlugin.register(eventHandler: shared)
        }
    }

    static func handleMethodCall(method: String, withJson json: String, completion: @escaping (String?) -> Void) {
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
            Log.wrapper.info("event: \(event.asAdaptyJsonData.asAdaptyJsonString)")
            // try invokeMethod(
            //     event.id,
            //     arguments: event.asAdaptyJsonData.asAdaptyJsonString
            // )
        } catch {
            Log.wrapper.error("Plugin encoding error: \(error.localizedDescription)")
        }
    }
}
