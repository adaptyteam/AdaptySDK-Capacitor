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

JSON Schema defining all method signatures and data structures. Native arguments must conform to request schemas (e.g., `Activate.Request`, `GetPaywall.Request`).

### Examples

- `examples/adapty-devtools/` - Full devtools app (React + Capacitor) - has its own CLAUDE.md
- `examples/basic-*-example/` - Minimal examples for React, Angular, Vue

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

Test all platforms: Web (mock), iOS, Android. Verify method signatures match across implementations.
