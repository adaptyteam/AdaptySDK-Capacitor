# Adapty devtools on CocoaPods

**Why this app exists:** `@adapty/capacitor` supports iOS apps on both Swift Package Manager and
CocoaPods. [`examples/adapty-devtools`](../../examples/adapty-devtools) covers SPM; this app runs the
very same devtools on CocoaPods — the way an app created with
`npx cap add ios --packagemanager CocoaPods` consumes the plugin — to catch what breaks only there.
iOS only: Android does not depend on the iOS package manager.

**It holds no app code of its own.** `src` is a symlink to `examples/adapty-devtools/src`, and the iOS
project references the devtools' resources. What is here is only what differs: the native project
generated for CocoaPods, its `Podfile`, and the configs that point everything at this folder.
Change the app in `examples/adapty-devtools`; both apps pick it up.

## Running

```bash
yarn install          # builds the plugin first, then asks for Adapty credentials
yarn ios              # build the web app and run it on a simulator (`cap sync ios` runs `pod install`)
yarn wvd snap --ios   # drive it like the devtools: see the drive-devtools-webview skill
```

Kids Mode build: `cd ios/App && ADAPTY_KIDS_MODE=1 pod install`; a plain `pod install` turns it off.
After a native SDK bump in the plugin: `yarn update-native-modules`, then commit `Podfile.lock`.
