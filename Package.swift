// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AdaptyCapacitor",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "AdaptyCapacitor",
            targets: ["AdaptyCapacitorPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/adaptyteam/AdaptySDK-iOS.git", exact: "3.15.3")
    ],
    targets: [
        .target(
            name: "AdaptyCapacitorPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "Adapty", package: "AdaptySDK-iOS"),
                .product(name: "AdaptyUI", package: "AdaptySDK-iOS"),
                .product(name: "AdaptyPlugin", package: "AdaptySDK-iOS")
            ],
            path: "ios/Sources/AdaptyCapacitorPlugin"),
        .testTarget(
            name: "AdaptyCapacitorPluginTests",
            dependencies: ["AdaptyCapacitorPlugin"],
            path: "ios/Tests/AdaptyCapacitorPluginTests")
    ]
)
