// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "AdaptyCapacitor",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "AdaptyCapacitor",
            targets: ["AdaptyCapacitorPlugin"])
    ],
    traits: [
        .default(enabledTraits: []),
        .trait(
            name: "AdaptyCapacitorKidsMode",
            description: "COPPA / App Store Kids Category build — enables the KidsMode trait of AdaptySDK-iOS (compiles out IDFA/AdSupport)."
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(
            url: "https://github.com/adaptyteam/AdaptySDK-iOS.git",
            exact: "4.0.3",
            traits: [
                .defaults,
                .trait(name: "KidsMode", condition: .when(traits: ["AdaptyCapacitorKidsMode"]))
            ]
        )
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
            path: "ios/Sources/AdaptyCapacitorPlugin",
            swiftSettings: [.swiftLanguageMode(.v5)]),
        .testTarget(
            name: "AdaptyCapacitorPluginTests",
            dependencies: ["AdaptyCapacitorPlugin"],
            path: "ios/Tests/AdaptyCapacitorPluginTests",
            swiftSettings: [.swiftLanguageMode(.v5)])
    ]
)
