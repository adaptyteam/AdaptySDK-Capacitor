---
name: upgrade-native-sdk
description: Use when upgrading native iOS or Android SDK dependency versions in AdaptySDK-Capacitor. Triggered by requests like "bump ios sdk", "upgrade android native", "update native dependency version".
---

# Upgrade Native SDK

Bumps Adapty native SDK version for iOS or Android platform.

## Input

Ask the user for:
1. **Platform**: `ios` or `android`
2. **Version**: target native SDK version (e.g. `3.15.3`)

For **android**, also ask:
3. **crossplatform version** — `io.adapty.internal:crossplatform` version (may differ from bom version)

## iOS Steps

iOS dependencies are distributed via Swift Package Manager only (no CocoaPods podspec).

### 1. `Package.swift`
Update the SPM exact version pin:
```swift
.package(url: "https://github.com/adaptyteam/AdaptySDK-iOS.git", exact: "<NEW_VERSION>")
```

## Android Steps

### 1. `android/build.gradle`
Update BOM version:
```gradle
implementation platform('io.adapty:adapty-bom:<NEW_VERSION>')
```

Update crossplatform version (ask user for the exact version — it may differ):
```gradle
implementation 'io.adapty.internal:crossplatform:<CROSSPLATFORM_VERSION>'
```

## Verification

**Do NOT run `yarn dev-example-full` directly** — it triggers interactive `credentials` prompt via `postinstall`.

Instead, run these steps manually from project root:

```bash
# 1. Build the plugin
yarn build

# 2. Install devtools deps without postinstall (avoids interactive credentials prompt)
cd examples/adapty-devtools && yarn install --ignore-scripts

# 3. Run credentials non-interactively
# Read values from examples/adapty-devtools/.adapty-credentials.json and pass them as CLI args:
#   token → --token, ios_bundle → --ios-bundle, android_application_id → --android-id,
#   placement_id → --placement-id, onboarding_placement_id → --onboarding-placement-id
node ../../scripts/credentials.mjs \
  --token=<token> \
  --ios-bundle=<ios_bundle> \
  --android-id=<android_application_id> \
  --placement-id=<placement_id> \
  --onboarding-placement-id=<onboarding_placement_id>

# 4. Build devtools
yarn build

# 5. Update native modules (runs pod update + cap copy + cap sync)
# IMPORTANT: run this BEFORE bare `cap sync` — cap sync uses pod install which
# fails when pod versions changed. update-native-modules does pod update first.
yarn update-native-modules
```

Wait for all commands to succeed before considering the task done.

## Commit

Format: `chore: upgrade <platform> SDK to <version>`

Examples:
- `chore: upgrade ios SDK to 3.15.3`
- `chore: upgrade android SDK to bom 3.15.2, crossplatform 3.15.6`

## Reminder

After all changes are verified, remind the user:

> Don't forget to update `cross_platform.yaml` if the cross-platform protocol version changed.
> Don't forget to bump the version in `package.json`.
