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

# Code Quality
yarn lint                     # ESLint + Prettier check
yarn format                   # Auto-fix ESLint + Prettier + SwiftLint

# Development with Example App
yarn dev-example              # Build plugin → sync files → build example → cap sync
yarn dev-example-js           # Same but with cap copy (faster, JS-only changes)
yarn dev-example-full         # Full rebuild including yarn --force in example

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

### cross_platform.yaml

The JSON Schema defining all method signatures and data structures. It lives in **`@adapty/core`, not in this repo** — do not look for it here. Its generated types reach this SDK through core's declarations, re-exported by `src/types/api.d.ts` as `components['requests']['Activate.Request']` and friends, and `scripts/check-bridge-api-test-coverage.js` reads the method list from `node_modules/@adapty/core/dist/index.d.mts` for the same reason. Native arguments must conform to those request schemas (e.g. `Activate.Request`, `GetPaywall.Request`).

### Examples

- `examples/adapty-devtools/` - Full devtools app (React + Capacitor) - has its own CLAUDE.md
- `examples/basic-*-example/` - Minimal examples for React, Angular, Vue

### Kids Mode (iOS) — `scripts/kids-mode.cjs`

`scripts/kids-mode.cjs` is the `adapty-kids-mode` CLI, shipped in the npm package via `bin` + `files`. It toggles the `AdaptyCapacitorKidsMode` SPM trait in `Package.swift` (`enable` (default) / `disable`), which forwards to the native `KidsMode` trait of AdaptySDK-iOS — compiling out all IDFA / AdSupport / AppTrackingTransparency code for COPPA / App Store Kids Category builds. It edits the package's own `Package.swift` (in this repo: the root manifest; in a consumer app: `node_modules/@adapty/capacitor/Package.swift`), is idempotent, and fails loudly if the trait anchor is missing. Consumers wire it into their app's `postinstall`. Unit tests: `scripts/__tests__/kids-mode.test.js`. User-facing docs: README "Kids Mode (iOS)".

**CI verification:** `scripts/verify-kids-mode-ios.sh <on|off|both>` builds `examples/adapty-devtools` with the trait toggled and inspects every Mach-O in `App.app` (`otool`/`nm`) to prove IDFA / AdSupport / AppTrackingTransparency are compiled out. The workflow `.github/workflows/kids-mode-ios.yml` runs it with `on`; run `both` locally for the positive + negative control.

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
