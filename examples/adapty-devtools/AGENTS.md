# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + Capacitor + TypeScript devtools application for testing Adapty SDK (in-app subscriptions and purchases). Part of the AdaptySDK-Capacitor monorepo.

**Platforms**: iOS, Android, Web (Capacitor hybrid app)

## Requirements

See [Capacitor Environment Setup](https://capacitorjs.com/docs/getting-started/environment-setup) for full details.

- Node.js 22+
- JDK 21 (Android)
- Xcode 26+ with Command Line Tools (`xcode-select --install`)
- CocoaPods 1.12+ (or use Swift Package Manager)
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
yarn update-native-modules  # Update native pods and sync

# Credentials and assets
yarn credentials            # Interactive setup for Adapty credentials (see below)
yarn link-assets            # Copy Adapty assets to native projects
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

**Note**: `.adapty-credentials.json` is gitignored. Each developer runs this once with their own test credentials.

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
- CSS Modules for component style isolation
- Capacitor plugins for native features (clipboard, filesystem, share, toast)

## Parent Plugin Rules (from .cursor/rules/)

When working with the Adapty SDK integration:
- Reference implementation is React Native SDK (do not modify it)
- Copy reusable TypeScript to `src/shared/`
- All native arguments in JSON format per `cross_platform.yaml`
- Strict TypeScript (no `any`)
- Methods return `Promise<T>`
- Prefer extending existing methods with optional parameters over adding new methods

## Capacitor Configuration

- App ID: `com.example.plugin`
- Web directory: `dist`
- SplashScreen auto-hide: disabled
- StatusBar overlays WebView with light style
