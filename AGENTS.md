# CLAUDE.md

This file provides guidance to LLM when working with code in this repository.

## Project Overview

Official Capacitor plugin for Adapty SDK - bridges native iOS (Swift) and Android (Kotlin) functionality to hybrid applications. Web platform provides mock API only.

**Package**: `@adapty/capacitor` | **Capacitor**: 8.x | **Platforms**: iOS, Android

## Common Commands

```bash
# Build & Verify
yarn build                    # Clean, update versions, compile TypeScript, bundle with Rollup
yarn tsc                      # TypeScript check (no emit)
yarn test                     # Run Jest tests
yarn test:watch               # Run tests in watch mode
yarn verify                   # Full verification: iOS + Android + Web builds
yarn verify:ios               # Build iOS with xcodebuild
yarn verify:android           # Build Android with Gradle
yarn resolve:ios              # Regenerate the committed root Package.resolved
yarn resolve:ios:check        # Verify the lock matches Package.swift (what CI runs)

# Code Quality
yarn lint                     # ESLint + Prettier check
yarn format                   # Auto-fix ESLint + Prettier + SwiftLint

# Development with Example App
yarn dev-example              # Build plugin → sync files → build example → cap sync
yarn dev-example-js           # Same but with cap copy (faster, JS-only changes)
yarn dev-example-full         # Full rebuild including yarn --force in example
yarn dev-example-pods         # Build plugin → build the CocoaPods devtools → cap sync ios (pod install)

# Then run example from examples/adapty-devtools:
yarn ios                      # Run on iOS simulator
yarn android                  # Run on Android emulator
```

## Architecture

### Plugin Structure (src/)

```
src/
├── adapty.ts                 # Main Adapty class implementing AdaptyPlugin
├── bridge/                   # Capacitor bridge layer
│   ├── plugin.ts             # Plugin registration
│   ├── definitions.ts        # handleMethodCall, addListener interfaces
│   └── web.ts                # Web mock implementation
├── types/
│   └── adapty-plugin.ts      # Main AdaptyPlugin interface & events
├── ui-builder/               # Paywall & Onboarding view controllers
│   ├── paywall-view-*.ts
│   └── onboarding-view-*.ts
└── shared/                   # Shared code. Will be moved to @adapty/core
    ├── coders/               # Data transformation (JSON ↔ TypeScript)
    ├── types/                # All data types (AdaptyPaywall, AdaptyProfile, etc.)
    ├── logger/               # Logging system
    └── utils/                # Platform detection, merge utilities
```

### Native Code

- **iOS**: `ios/Sources/AdaptyCapacitorPlugin/` - Swift implementation using `AdaptyPlugin.execute()`
- **Android**: `android/src/main/kotlin/com/adapty/plugin/capacitor/` - Kotlin using `crossplatformHelper.onMethodCall()`

### CocoaPods (iOS) — `AdaptyCapacitor.podspec`, `ios/adapty_podfile.rb`

Capacitor apps pick the iOS dependency manager per app: SPM reads `Package.swift`, CocoaPods
(`cap add ios --packagemanager CocoaPods`) reads `AdaptyCapacitor.podspec` — Capacitor CLI derives
the pod name `AdaptyCapacitor` from the package name. Neither reads the other manifest, so the
native SDK is pinned twice: **`adapty_ios_version` in the podspec must equal the `exact:` pin in
`Package.swift`** (`scripts/__tests__/package-manifest.test.js` enforces it, along with the pod
list and `files`). This repo's own builds and the devtools example are SPM-only.

The native SDK pods (`Adapty`, `AdaptyUI`, `AdaptyPlugin` and their dependencies) are not on
CocoaPods trunk; they are published to
[AdaptySDK-CocoaPods-Specs](https://github.com/adaptyteam/AdaptySDK-CocoaPods-Specs) by the
AdaptySDK-iOS release. Consumers reach it through the Podfile helpers in `ios/adapty_podfile.rb`
(shipped via `files`): `adapty_pods!` pins those pods to the spec repo, and
`adapty_enable_kids_mode(installer)` is Kids Mode for the pods. The helper is required through
`node require.resolve`, not `require_relative`: `cap sync` rewrites the Podfile from its first
`require_relative` through Capacitor's own, dropping one placed above it, and the resolution must
keep working for `@adapty/capacitor/ios/adapty_podfile.rb` (no `exports` that hide it). User-facing
docs: README "CocoaPods"; Kids Mode lives on adapty.io (`kids-mode-capacitor`), not in the README.

### cross_platform.yaml

The JSON Schema defining all method signatures and data structures. It lives in **`@adapty/core`, not in this repo** — do not look for it here. Its generated types reach this SDK through core's declarations, re-exported by `src/types/api.d.ts` as `components['requests']['Activate.Request']` and friends, and `scripts/check-bridge-api-test-coverage.js` reads the method list from `node_modules/@adapty/core/dist/index.d.mts` for the same reason. Native arguments must conform to those request schemas (e.g. `Activate.Request`, `GetPaywall.Request`).

### Package.resolved (iOS)

The root `Package.resolved` is **tracked on purpose** — `.gitignore` keeps ignoring the examples'
lock files but re-includes this one (`!/Package.resolved`). The iOS CI job builds with
`-disableAutomaticPackageResolution`, so the lock is the only source of pins; while the native SDK
dependency points at a branch it is mandatory, because a branch requirement can never be satisfied
from local workspace state alone.

**Any edit to `Package.swift` requires `yarn resolve:ios` and the regenerated lock in the same
commit.** A stale lock is invisible locally (local builds resolve automatically) and fails CI.
`yarn resolve:ios:check` reproduces the CI check: it compares the lock's `originHash` against
`sha256(Package.swift)` — SwiftPM derives that hash from the manifest bytes, so a match means the
lock was generated from exactly this manifest. No network, no SwiftPM invocation.

The lock is not published — it is absent from `files` in `package.json`, and SwiftPM reads a
`Package.resolved` only for the root package, so consumers of `@adapty/capacitor` never see it.

### Examples

- `examples/adapty-devtools/` - Full devtools app (React + Capacitor) - has its own CLAUDE.md
- `examples/basic-*-example/` - Minimal examples for React, Angular, Vue

### Test apps (`test-apps/`)

Internal apps for testing the SDK, kept apart from `examples/`, which customers read. End-to-end
tests will live here too. Nothing in `test-apps/` is published, linted with the plugin's ESLint
config or picked up by the plugin's Jest run.

- `test-apps/adapty-devtools-pods/` - The devtools app with its iOS project on CocoaPods (iOS only). It
  has no app code: `src` is a symlink to `examples/adapty-devtools/src`, so devtools changes reach it
  as they are. Has its own CLAUDE.md

### CI workflows (`.github/workflows/`)

- `pr-validation.yml` — every PR into `master`/`dev`: JS checks (tsc, lint, Jest, web build, devtools
  tsc), the plugin's Android library build, and the plugin's iOS scheme build against the root
  `Package.resolved`.
- `kids-mode-ios.yml` — proves IDFA / AdSupport / ATT are compiled out with Kids Mode on (SPM and
  CocoaPods); see [Kids Mode](#kids-mode-ios--scriptskids-modecjs).
- `android-builds.yml` — PRs into `master` (release PRs) and manual runs: the devtools app as
  Release APK + AAB with R8 on, then `scripts/check-r8-keep.cjs` reads R8's `mapping.txt` /
  `usage.txt` and fails if any non-synthetic `com.adapty.*` class was renamed, or a class or member
  removed (static initializers R8 optimizes away aside), or the plugin class is missing. Locally:
  `./gradlew assembleRelease bundleRelease -PenableProguardInReleaseBuilds=true` in
  `examples/adapty-devtools/android` (minify stays off by default).
- `ios-builds.yml` — PRs into `master` and manual runs: the devtools app on SPM and
  `test-apps/adapty-devtools-pods` on CocoaPods, each in Debug (simulator) and Release (device,
  unsigned). `scripts/check-ios-app.cjs` asserts `cap sync` registered `AdaptyCapacitorPlugin`
  (`packageClassList`, the CapApp-SPM product) before the builds, and that some Mach-O in the built
  app (`CapacitorAdaptyDevtools.app` on SPM, `App.app` on CocoaPods) defines the class after them. The pods job also fails when `pod install` changes
  `Podfile.lock`: a native SDK bump or a plugin version bump needs `yarn update-native-modules` in
  the test app and the updated lock committed. Ignored: the `COCOAPODS:` line and the checksums of
  the local `:path` pods (`AdaptyCapacitor`, `Capacitor*`). Those are SHA1 of podspec JSON, whose
  formatting depends on the Ruby `json` gem: a `pod` on Ruby 2.7 rewrites all of them, so do not
  commit a lock whose only change is those lines.

### Kids Mode (iOS) — `scripts/kids-mode.cjs`

`scripts/kids-mode.cjs` is the `adapty-kids-mode` CLI, shipped in the npm package via `bin` + `files`. It toggles the `AdaptyCapacitorKidsMode` SPM trait in `Package.swift` (`enable` (default) / `disable`), which forwards to the native `KidsMode` trait of AdaptySDK-iOS — compiling out all IDFA / AdSupport / AppTrackingTransparency code for COPPA / App Store Kids Category builds. It edits the package's own `Package.swift` (in this repo: the root manifest; in a consumer app: `node_modules/@adapty/capacitor/Package.swift`), is idempotent, and fails loudly if the trait anchor is missing. Consumers wire it into their app's `postinstall`. Unit tests: `scripts/__tests__/kids-mode.test.js`. User-facing docs: https://adapty.io/docs/kids-mode-capacitor (not the README).

The CLI covers SPM apps only. CocoaPods apps never read `Package.swift`: there Kids Mode is `adapty_enable_kids_mode(installer)` from `ios/adapty_podfile.rb` in the Podfile's `post_install`, which sets `-DKidsMode` on the `Adapty` pod and unlinks AdSupport, failing `pod install` if it cannot. The CLI patches the manifest anyway and then warns (never fails) when the app root (`INIT_CWD`, or `--app-root=`) has `ios/App/Podfile` disagreeing with the command — no `adapty_enable_kids_mode` on `enable`, or one on `disable` — or has neither a Podfile nor `ios/App/CapApp-SPM`. `--no-warnings` / `ADAPTY_KIDS_MODE_NO_WARNINGS=1` silence it.

**CI verification:** `scripts/verify-kids-mode-ios.sh <on|off|both> [spm|pods]` builds an app with Kids Mode toggled and inspects every Mach-O in the built `.app` (`otool`/`nm`) to prove IDFA / AdSupport / AppTrackingTransparency are compiled out. `spm` (default) builds `examples/adapty-devtools` with the trait toggled; `pods` scaffolds a throwaway Capacitor app on CocoaPods in `.kids-mode-pods-app/` (gitignored) the way a consumer does and also checks the Adapty pods resolved from the spec repo. The workflow `.github/workflows/kids-mode-ios.yml` runs both targets with `on` on PRs and with `both` (positive + negative control) weekly; run `both` locally after changing the toggles.

## Development Rules

### Code Standards
- Strict TypeScript - no `any`
- Methods return `Promise<T>`
- All native arguments in JSON format per `cross_platform.yaml`
- Prefer extending existing methods with optional parameters over adding new methods
- Use yarn, not npm

### Method Implementation Pattern
1. Define interface in `src/types/adapty-plugin.ts`
2. Copy/adapt shared code to `src/shared/` if needed
3. Add web fallback in `src/bridge/web.ts`
4. Implement native iOS (Swift) and Android (Kotlin)
5. Test in `examples/adapty-devtools` using `appendLog` (not console.log)

### Documentation
- README.md must reflect public types from `src/types/adapty-plugin.ts`
- All public methods need JSDoc comments
- Interface tables: Prop | Type | Description format
- All type links must resolve to their definitions

### Implementation plans
Save implementation plans (e.g. from superpowers `writing-plans`) to `plans/`, not `docs/`. Both are
gitignored, but `docs/` is typedoc's output and `yarn doc-gen` wipes it.

## Testing

```bash
yarn test                     # Unit tests (Jest)
yarn dev-example              # Integration testing via devtools app
```

To drive the devtools app in the iOS Simulator from the shell — click by DOM id, read state,
tail the JS and native SDK logs, no screenshots or taps — use `yarn wvd` from
`examples/adapty-devtools`. Invoke the `drive-devtools-webview` skill, or read
[.claude/skills/drive-devtools-webview/SKILL.md](.claude/skills/drive-devtools-webview/SKILL.md).

Test all platforms: Web (mock), iOS, Android. Verify method signatures match across implementations.
