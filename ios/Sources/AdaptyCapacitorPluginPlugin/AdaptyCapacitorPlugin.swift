import Foundation
import Adapty

@objc public class AdaptyCapacitorPlugin: NSObject {
    private var _isActivated = false

    @objc public func activate(apiKey: String, params: [String: Any]?, completion: @escaping (Error?) -> Void) {
        let configurationBuilder = AdaptyConfiguration.builder(withAPIKey: apiKey)

        // Set customer user ID if provided
        if let customerUserId = params?["customer_user_id"] as? String {
            configurationBuilder.with(customerUserId: customerUserId)
        }

        // Set observer mode
        if let observerMode = params?["observer_mode"] as? Bool {
            configurationBuilder.with(observerMode: observerMode)
        }

        // Set IP address collection disabled
        if let ipAddressCollectionDisabled = params?["ip_address_collection_disabled"] as? Bool {
            configurationBuilder.with(ipAddressCollectionDisabled: ipAddressCollectionDisabled)
        }

        // Set IDFA collection disabled
        if let idfaCollectionDisabled = params?["idfa_collection_disabled"] as? Bool {
            configurationBuilder.with(idfaCollectionDisabled: idfaCollectionDisabled)
        }

        do {
            try Adapty.activate(with: configurationBuilder.build())
            _isActivated = true
            completion(nil)
        } catch {
            completion(error)
        }
    }

    @objc public func isActivated() -> Bool {
        return _isActivated
    }

    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
