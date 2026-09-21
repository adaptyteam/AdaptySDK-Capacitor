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
Update the SPM exact version pin. **Preserve the `traits:` block** — it forwards the native `KidsMode` trait (COPPA / Kids-category builds); dropping it silently breaks Kids Mode:
```swift
.package(
    url: "https://github.com/adaptyteam/AdaptySDK-iOS.git",
    exact: "<NEW_VERSION>",
    traits: [
        .defaults,
        .trait(name: "KidsMode", condition: .when(traits: ["AdaptyCapacitorKidsMode"]))
    ]
)
```

### 2. Regenerate `Package.resolved` — iOS only, mandatory

**Trigger: you edited `Package.swift`. If you did not, skip this step.**
Android bumps never touch it — `android/build.gradle` has no SPM lock.

The repo root `Package.resolved` is committed on purpose (see `.gitignore`: `!/Package.resolved`).
CI builds the root package with `-disableAutomaticPackageResolution`, so the lock is the only
source of pins and must match the manifest. **You cannot notice drift locally** — `yarn verify:ios`
resolves automatically and stays green with a stale lock. Run this explicitly:

```bash
yarn resolve:ios        # regenerates Package.resolved, prints the diffstat
yarn resolve:ios:check  # what CI runs; must print "OK: Package.resolved matches Package.swift."
```

Then stage `Package.resolved` **in the same commit as `Package.swift`**. A commit that changes
the manifest without the lock is almost always wrong.

> **Not the same as `yarn update-native-modules`.** That script lives in
> `examples/adapty-devtools/package.json` and resolves `ios/App/App.xcodeproj` — the *example's*
> lock, which is gitignored. It does not regenerate the root `Package.resolved`.

## iOS: temporary switch to a branch (pre-release testing)

While a native release is still in progress, the dependency may point at a branch instead of a
version:

```swift
.package(
    url: "https://github.com/adaptyteam/AdaptySDK-iOS.git",
    branch: "release/<X.Y.Z>",   // TEMPORARY — must become `exact:` before publishing
    traits: [
        .defaults,
        .trait(name: "KidsMode", condition: .when(traits: ["AdaptyCapacitorKidsMode"]))
    ]
)
```

Rules for this state:

1. `Package.resolved` becomes **mandatory** — a branch requirement can never be satisfied from
   local state alone, so the CI build cannot resolve without the lock. Run `yarn resolve:ios`
   and commit it, same as any manifest edit.
2. The lock pins a **commit**, so CI keeps building that commit even after the upstream branch
   moves. To pick up a newer head: `rm Package.resolved && yarn resolve:ios`, then commit.
3. **Never publish from a `branch:` manifest** — `publish.yml` blocks it. Consumers never receive
   our lock, so they would resolve a moving branch head. Before releasing, switch back to
   `exact: "<VERSION>"`, run `yarn resolve:ios` and commit the resulting lock.

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

# 5. Update native modules (cap copy + cap sync)
# Run from examples/adapty-devtools (that is the cwd after step 2), not from the repo root —
# the script only exists in the example's package.json. It resolves the EXAMPLE's Xcode project;
# it does NOT regenerate the root Package.resolved — that is `yarn resolve:ios` (iOS Steps §2).
yarn update-native-modules

# 6. iOS only — confirm the committed root lock still matches the manifest
cd ../.. && yarn resolve:ios:check
```

Wait for all commands to succeed before considering the task done.

## Commit

Format: `chore: upgrade <platform> SDK to <version>`

Examples:
- `chore: upgrade ios SDK to 3.15.3`
- `chore: upgrade android SDK to bom 3.15.2, crossplatform 3.15.6`

**iOS:** the commit must contain **both** `Package.swift` and `Package.resolved`. Verify before
committing:

```bash
git status --short -- Package.swift Package.resolved
```

`Package.swift` staged alone is a bug, not a smaller change.

## Reminder

After all changes are verified, remind the user:

> Don't forget to update `cross_platform.yaml` if the cross-platform protocol version changed.
> Don't forget to bump the version in `package.json`.
