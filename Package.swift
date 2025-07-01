// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AdaptyCapacitor",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "AdaptyCapacitor",
            targets: ["AdaptyCapacitorPluginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "AdaptyCapacitorPluginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/AdaptyCapacitorPluginPlugin"),
        .testTarget(
            name: "AdaptyCapacitorPluginPluginTests",
            dependencies: ["AdaptyCapacitorPluginPlugin"],
            path: "ios/Tests/AdaptyCapacitorPluginPluginTests")
    ]
)