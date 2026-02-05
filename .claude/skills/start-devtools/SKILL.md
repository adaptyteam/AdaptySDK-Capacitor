---
name: start-devtools
description: Start Adapty Devtools app for SDK testing. Use when need to run, launch, or test the devtools example app on iOS or Android simulator/emulator.
argument-hint: "[ios|android]"
disable-model-invocation: true
allowed-tools: Bash
---

# Start Devtools

Build and run the Adapty Devtools app on a simulator/emulator.

## Platform

Platform argument: `$ARGUMENTS` (defaults to `ios` if empty)

## Steps

Run the start script from repository root:

```bash
./scripts/start-devtools.sh $ARGUMENTS
```

If the script fails, run steps manually:

```bash
# 1. Install root dependencies (if node_modules missing)
yarn install

# 2. Build plugin and sync to devtools
yarn dev-example-full

# 3. Run on platform
cd examples/adapty-devtools
yarn ios    # or: yarn android
```

## Notes

- First run is slow (pod install, gradle sync)
- Credentials auto-generated via postinstall
- For JS-only changes use `yarn dev-example-js` (faster, skips native sync)