## Created with Capacitor Create App

This app was created using [`@capacitor/create-app`](https://github.com/ionic-team/create-capacitor-app),
and comes with a very minimal shell for building an app.

## Requirements

- Node 22
- JDK 21


## Running this example

### Capacitor Sync

To sync your web assets with native platforms:

```bash
yarn cap sync
```

### Running on Android

To run on Android device or emulator:

```bash
yarn cap run android
```

Or open Android Studio:

```bash
yarn cap open android
```

### Running on iOS

To run on iOS device or simulator:

```bash
yarn cap run ios
```

Or open Xcode:

```bash
yarn cap open ios
```

## Fallback files

Native fallback JSON files are expected at:

- `./ios/App/App/ios_fallback.json`
- `./android/app/src/main/assets/android_fallback.json`

### Quick update

To update them faster, put your fallback files into `@AdaptySDK-Capacitor/examples/adapty-devtools/assets` and run (Ruby 2.7+ required):

```bash
yarn link-assets
```

The script will copy the files into the native directories and link them.

## Flow custom elements

Custom elements of a flow are rendered by native views from the app, not by the plugin or the WebView. The app registers one resolver at launch:

- iOS: `ios/App/App/CustomElements/DevtoolsCustomElements.swift`, registered in `AppDelegate`
- Android: `android/app/src/main/java/com/example/plugin/customelements/`, registered in `DevtoolsApplication.onCreate` (Kotlin + Compose; `io.adapty:android-ui` needs no version, the plugin's BOM sets it)

A type the resolver does not serve shows the fallback set in the builder (`checkout_widget` is left unserved on purpose).

Served types: `review_card`, `star_rating`, `link_probe`, `text_input` (an id ending in `_uikit` gets a UIKit / Android View field), `store_map` and `lottie_badge`. `store_map` (Canvas grid) and `lottie_badge` (hand-parsed Lottie) are test fakes: use MapKit / Google Maps and Lottie in a real app.

In a Capacitor app the resolver is registered natively (`AppDelegate` / `Application`), so the docs' note that cross-platform SDKs always show the fallback does not apply once the app registers one. Flows, and so custom elements, need iOS 16+.

Docs: [iOS](https://adapty.io/docs/ios-flow-custom-elements), [Android](https://adapty.io/docs/android-flow-custom-elements).
