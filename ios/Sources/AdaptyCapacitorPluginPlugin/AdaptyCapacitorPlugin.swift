import Foundation
import Adapty
import AdaptyPlugin

@objc public class AdaptyCapacitorPlugin: NSObject {

    @objc public func handleMethodCall(method: String, withJson json: String, completion: @escaping (String?) -> Void) {
        Task {
            let response = await AdaptyPlugin.execute(
                method: method,
                withJson: json
            )
            completion(response.asAdaptyJsonString)
        }
    }
}
