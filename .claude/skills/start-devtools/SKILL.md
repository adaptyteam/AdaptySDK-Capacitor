---
name: start-devtools
description: Start Adapty Devtools app for SDK testing. Use when need to run, launch, or test the devtools example app on iOS or Android simulator/emulator.
argument-hint: "[ios|android]"
disable-model-invocation: true
allowed-tools: Bash, Read, AskUserQuestion
---

# Start Devtools

Build and run the Adapty Devtools app on a simulator/emulator.

## Platform

Platform argument: `$ARGUMENTS` (defaults to `ios` if empty)

## Steps

All commands run from repository root.

### 1. Check environment

Verify required tools are installed:

```bash
node --version && yarn --version && xcodebuild -version 2>/dev/null | head -1 && java -version 2>&1 | head -1
```

Requirements: Node.js 22+, Xcode 26+, JDK 21 (for Android).

If something is missing, inform user and stop.

### 2. Check credentials

```bash
cat examples/adapty-devtools/.adapty-credentials.json 2>/dev/null || echo "NO_CREDENTIALS"
```

If credentials don't exist or are incomplete, use AskUserQuestion to collect:
- Adapty API token (from Adapty dashboard)
- iOS bundle identifier (must match App Store Connect)
- Android application ID (must match Google Play Console)
- Placement ID (paywall placement from Adapty)
- Onboarding placement ID (optional)

### 3. Setup credentials (if needed)

Install dependencies first, then run credentials script:

```bash
yarn install
cd examples/adapty-devtools && yarn install --ignore-scripts
```

```bash
cd examples/adapty-devtools && node ../../scripts/credentials.mjs \
  --token=YOUR_TOKEN \
  --ios-bundle=YOUR_BUNDLE \
  --android-id=YOUR_APP_ID \
  --placement-id=YOUR_PLACEMENT \
  --onboarding-placement-id=YOUR_ONBOARDING_PLACEMENT
```

### 4. Build and run

From repository root:

```bash
./scripts/start-devtools.sh $ARGUMENTS
```

## CLI Parameters for credentials.mjs

Non-interactive mode (all required):
- `--token=<adapty-api-token>`
- `--ios-bundle=<com.example.app>`
- `--android-id=<com.example.app>`
- `--placement-id=<placement-id>`
- `--onboarding-placement-id=<placement-id>` (optional)
- `--skip-onboarding` (skip onboarding placement)
- `--force-bundle` (force update native projects even if unchanged)