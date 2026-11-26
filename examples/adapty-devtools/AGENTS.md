# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + Capacitor + TypeScript devtools application for testing Adapty SDK (in-app subscriptions and purchases). Part of the AdaptySDK-Capacitor monorepo.

**Platforms**: iOS, Android, Web (Capacitor hybrid app)

`src/` is shared: [`test-apps/adapty-devtools-pods`](../../test-apps/adapty-devtools-pods) — the same
app on CocoaPods — links it by symlink, and its Xcode project references `assets/ios/*` and
`ios/App/App/AdaptyDemoApp.storekit` from here. Changes to them reach both apps. Relative imports
in `src/` must stay inside it — the one exception, `../.adapty-credentials.json`, is meant to reach
each app's own root. `yarn wvd` honours `WVD_APP_ROOT` for the same reason.

## Requirements

See [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup) for full details.

- Node.js 22+
- JDK 21 (Android)
- Xcode 26+ with Command Line Tools (`xcode-select --install`)
- Swift Package Manager (iOS dependencies; no CocoaPods)
- Yarn (not npm)
- Ruby 2.7+ (for link-assets script)

## Common Commands

```bash
# Development
yarn start                  # Dev server on port 5173
yarn build                  # Production build
yarn tsc                    # TypeScript check (no emit)

# Mobile development
yarn ios                    # Build and run on iOS simulator
yarn android                # Build and run on Android emulator
yarn dev:ios                # Live reload on iOS
yarn dev:android            # Live reload on Android

# Capacitor sync
yarn update-cap-config      # Copy and sync Capacitor config
yarn update-native-modules  # Resolve iOS SPM packages and sync

# Credentials and assets
yarn credentials            # Interactive setup for Adapty credentials (see below)
yarn link-assets            # Copy Adapty assets to native projects

# Driving the app on iOS Simulator or Android (see the drive-devtools-webview skill)
# Platform is autodetected; pass --ios / --android when both are running.
# With several devices up, pin each call: --device=<udid|serial|name> (or WVD_DEVICE) picks the
# device and with it the platform; --ios / --android next to it only narrow the search.
yarn wvd snap                # text snapshot of every element with an id — use instead of a screenshot
yarn wvd --device="iPhone 17 #2" snap  # pin a call to one of several devices
yarn wvd logs 20             # structured JS log tail without navigating to /logs
yarn wvd native --seconds=30 # native SDK log — os_log on iOS, logcat on Android
yarn wvd do click:flow-load-btn wait:flow-present-btn:enabled read:flow-name-value
yarn wvd scenario flow       # relaunch -> activate -> load -> present -> dismiss
yarn wvd bounds "1-tap buy"  # android: measured coordinates of native UI, then `wvd tap <x> <y>`
yarn wvd clear               # android: wipe app data + relaunch — the cheap "clean install"
yarn test-wvd                # unit tests for the wvd CLI
```

## Credentials Setup

For in-app purchases to work, the app's bundle ID must match the one registered in App Store Connect / Google Play Console.

```bash
yarn credentials              # Interactive: prompts for token, bundle IDs, placement IDs
```

This script (`../../scripts/credentials.mjs`):
1. Creates/updates `.adapty-credentials.json` with Adapty token and placement IDs
2. Patches iOS `project.pbxproj` with the correct bundle identifier
3. Patches Android `build.gradle` with the correct application ID
4. Patches `capacitor.config.json`'s `appId` with the iOS bundle identifier — `yarn wvd` passes it to
   `simctl terminate` / `simctl launch`, so a stale value breaks `wvd relaunch`. Reconciled against
   the file on every run, not only when the bundle ID changes

**Note**: `.adapty-credentials.json` is gitignored. Each developer runs this once with their own test credentials.
Steps 2–4 leave tracked files modified in the working tree — that is expected, don't commit them.

## Architecture

### State Management (Context-based)
- `AppContext` - SDK initialization, status, configuration
- `LogsContext` - Logging system with history
- `ProfileContext` - User profile data

### Routing
```
/         → /app (redirect)
/app      → Main screen with 9 functional sections
/logs     → Logs history
/logs/:id → Log details
/profile  → User profile
```

### Main Screen Sections (src/screens/app/sections/)
9 sections covering all Adapty SDK functionality: credentials, SDK status, paywalls, onboarding, profile, refunds, integrations, transaction reports, other actions.

### Services
- `initialization.ts` - SDK setup on app load
- `eventListeners.ts` - SDK event subscriptions

### Key Patterns
- Use `appendLog` instead of `console.log` for testing/debugging
- Every interactive element, clickable element and state readout carries a stable `id` from
  `src/elementIds.ts` — see [Element IDs](#element-ids) below before touching any UI
- CSS Modules for component style isolation
- Capacitor plugins for native features (clipboard, filesystem, share, toast)

## Element IDs

Every button, input, select, textarea, clickable element and state readout carries a stable DOM
`id`, so the app can be driven from outside its WebView by id rather than by hashed class names or
copy-dependent labels.

- **Full list:** `docs/element-ids.md` — generated, never hand-edited
- **Source of truth:** `src/elementIds.ts`
- **Validate:** `yarn check-ids` (CI runs it too); `yarn check-ids:write` regenerates the list

### Naming

`<area>-<name>-<kind>`, lowercase kebab-case, where `<kind>` is one of `btn`, `input`, `select`,
`textarea`, `toggle` (clickable non-button), `value` (a state readout), `tab`, `item` (list row).

Rows of a dynamic list carry the key as a segment: `flow-product-0-purchase-btn`,
`logs-<log-id>-item`. The generated list shows these with a `{key}` placeholder.

### Contract

- External automation scripts hardcode these strings — **never rename or reuse an id**.
- In JSX always `id={elementIds.<path>}`: no literals, no template literals, no destructuring.
- One id, one element.
- To drive the app from outside, prefer `yarn wvd` over screenshots and taps: one call carries a
  whole chain of steps, and `yarn wvd logs` reads the log without navigating. `yarn wvd snap` reports
  ids, form values and disabled state; long `textContent` is clipped with a trailing `…`, so read
  those with `read:<id>`. Only a presented native view needs `yarn wvd shot`.

## Flow custom elements

App-level native code; the plugin has none. Ported from pure-rn (`$RN` = `../../../AdaptySDK-React-Native-Devtools`,
files in `$RN/pure-rn/{ios/AdaptyDevtools,android/...}/[cC]ustom[eE]lements/`); keep in sync, the only diffs are the
Kotlin package, debug-only payload logging and on-screen diagnostics (`review_card` payload line, `lottie_badge` full
URL; release shows the host), the test-fake comments, the Android `store_map` clip, and `text_input` honoring
`ui_enabled` (both Android forms, the iOS UIKit form).

- **iOS:** `ios/App/App/CustomElements/DevtoolsCustomElements.swift`, `DevtoolsCustomElements.register()` in
  `AppDelegate`. Imports `AdaptyUI` / `AdaptyUIBuilder` transitively via `CapApp-SPM`; never edit its `Package.swift`.
- **Android:** `android/app/src/main/java/com/example/plugin/customelements/` (+ unit test under `src/test`),
  registered in `DevtoolsApplication.onCreate` (manifest `android:name`). Kotlin 2.2.20 + Compose compiler plugin
  in the root buildscript, Compose BOM 2025.04.01. `io.adapty:android-ui` is versionless: the version comes from the
  plugin's `api platform('io.adapty:adapty-bom:…')`.
- **PODS** (`test-apps/adapty-devtools-pods`) references the same Swift file by relative path, calls `register()` in
  its `AppDelegate` and links with `-Xlinker -ignore_auto_link_library -Xlinker SwiftUICore` (else dyld crash
  below iOS 18: ld treats the product name `App` as an allowed client of SwiftUICore and links it directly; DEV
  avoids it with its product name `CapacitorAdaptyDevtools`).
- **Types:** `review_card`, `store_map`, `star_rating`, `lottie_badge`, `link_probe`, `text_input` (`_uikit` id → UIKit
  / View); `checkout_widget` is unserved → builder fallback. iOS views carry `ce-<type>-<id>` for `idb`.
- **Verify:** `node scripts/webview-driver.mjs --device=<id> native --seconds=N` and look for
  `resolve type=… id=… served=…` (iOS subsystem `io.adapty.devtools`, Android tag `AdaptyDevtools`), once per pair.
- **Gallery bundles:** follow the RN recipe "Custom elements" in
  `$RN/.claude/skills/rn-allure-test-cases/test-cases.md` (Proxyman rule on `rt.custom.elements`). Assemble with
  `node $RN/pure-rn/scripts/gallery-flow/assemble.mjs <bundleDir> --out <file>`.
- "Send before present" in the Flow section sends the app message textarea JSON before `present()`.

## Capacitor Configuration

- App ID: `com.example.plugin`
- Web directory: `dist`
- SplashScreen auto-hide: disabled
- StatusBar overlays WebView with light style
