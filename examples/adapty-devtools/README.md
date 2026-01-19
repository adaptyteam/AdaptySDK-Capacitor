## Created with Capacitor Create App

This app was created using [`@capacitor/create-app`](https://github.com/ionic-team/create-capacitor-app),
and comes with a very minimal shell for building an app.

## Requirements

- Node 20
- JDK 21


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
