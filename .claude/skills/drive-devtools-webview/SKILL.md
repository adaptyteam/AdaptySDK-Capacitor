---
name: drive-devtools-webview
description: Use when interacting with the already-running Adapty devtools app on the iOS Simulator or an Android emulator/device — pressing its controls, reading its state, checking what the SDK did, or diagnosing SDK behaviour on device. Also use before reaching for a screenshot or a coordinate tap against that app.
---

# Drive Devtools WebView

`examples/adapty-devtools` is driven by `yarn wvd`, a CLI that talks to the app's WebView — over the
WebKit inspector protocol on iOS, over the Chrome DevTools Protocol on Android. Prefer it over
screenshots and coordinate taps: it reads state as text and presses controls by DOM id.

Run everything from `examples/adapty-devtools`. Full reference, including protocol notes and
troubleshooting: [reference.md](reference.md). Read it when this page is not enough — not before.

## Platform

One tool, two backends. The element ids, the step vocabulary and the `snap` format are identical on
both, which is what makes an iOS-vs-Android comparison meaningful.

The platform is **autodetected** from what is running. When both a booted simulator and an attached
Android device are present, `wvd` refuses to guess and asks for `--ios` / `--android` (or
`WVD_PLATFORM`) — driving the wrong platform is the one failure with no symptom, since every command
would succeed and the output would look normal.

## Commands

| Command | Use for |
| --- | --- |
| `yarn wvd snap` | Every element with an id, its value, `DISABLED`, `HIDDEN`. Read this instead of a screenshot |
| `yarn wvd do <step>...` | A chain of UI steps in ONE call. Stops at the first failure, exits 1 |
| `yarn wvd logs [n]` | What the JS layer did (default 20 entries) |
| `yarn wvd native [--seconds=N] [--level=error\|warn\|info\|verbose\|debug] [--full]` | What the native SDK did: HTTP, billing, native errors. os_log on iOS, logcat on Android |
| `yarn wvd shot [path]` | Screenshot, downscaled. The ONLY way to see a presented native view or a native toast |
| `yarn wvd relaunch` | Restart the app. Recovers a wedged session; costs the SDK session |
| `yarn wvd eval <expr>` | Escape hatch for anything the steps do not cover |

Android only:

| Command | Use for |
| --- | --- |
| `yarn wvd bounds <text>` | Centre coordinates of the native view whose text/label matches — for taps on system UI (Google Play sheets, dialogs) |
| `yarn wvd tap <x> <y>` | Inject a tap at device pixels |
| `yarn wvd clear` | Wipe app data and relaunch — the cheap "clean install" (a second, vs a minute of uninstall+install on iOS) |

Steps for `do`: `set:<id>=<value>`, `click:<id>`, `read:<id>`, `wait:<id>[:enabled|:disabled|:absent]`,
`sleep:<ms>`, `snap`. Option `--timeout=<ms>`.

## Which channel answers which question

- "What is on the app's screen right now" → `snap`
- "What did the JS layer do" → `logs`
- "What did the SDK actually do — request, billing, native error" → `native`, and start with
  `--level=error` before reading everything
- "Is a native view covering the WebView" → `shot`. No DOM signal answers this
- "Where do I tap on that native view" → Android: `bounds <text>`, measured. iOS: derive from `shot`

## Traps that each cost a wasted cycle

- **Never press `sdk-activate-btn` on an already-activated app.** A known SDK bug leaves a rejected
  promise in place and wedges every later SDK call until `yarn wvd relaunch`. Check `snap` first: the
  button reads `Activated` when it is already done.
- **After `click:flow-present-btn` use `sleep`, not `wait`.** No DOM element marks native
  presentation — the locale readout mounts before `present()` is even called, so a `wait:` on it goes
  green while nothing is on screen.
- **`yarn wvd <cmd> | head` is defeated by Yarn's banner.** Use `node scripts/webview-driver.mjs <cmd>` when
  slicing or parsing stdout.
- **`native`'s window is small by default.** The SDK emits background `verbose` records every minute,
  so a short `--seconds` can hold nothing else. Widen it before concluding the SDK logged nothing.
- **A `…` at the end of a `snap` line means the value is CLIPPED, not that it ends there.** `snap`
  cuts `textContent` at 48 characters. A clipped product row reads `ID: monthly.premium.9`, which
  looks like a valid identifier and is not one. Never parse an id or a uuid out of a clipped row —
  `read:<id>` and `eval` return the full value. Form values (`=`) are never clipped.
- **Only use ids from `src/elementIds.ts`.** They are the contract; `docs/element-ids.md` lists them all.
- **The id suffix tells you which direction it faces.** `-input`, `-select`, `-textarea` are what you
  ASK FOR; `-value` is what the app REPORTS BACK. `flow-view-locale-input` is the locale you
  requested, `flow-view-locale-value` is the one the native view actually used — they differ whenever
  the flow has no such localization. Read the `-value` when the question is "what did it really do".
- **`no inspectable page` on iOS is usually not the tool.** Check what is actually installed under the
  bundle id with `wvd shot`: the React Native demo app ships the SAME bundle id
  (`com.adapty.adaptydemoapp`), so building it overwrites the Capacitor app and every iOS command then
  fails with a WebView error against an app that has no WebView.
- **Android's package is not `capacitor.config.json`'s `appId`.** It comes from
  `android/app/build.gradle`; the two genuinely differ here (`com.adaptytest` vs
  `com.adapty.adaptydemoapp`), and `yarn credentials` patches them independently.

## When this does not apply

Buttons *inside* a presented native paywall or onboarding are not in the DOM. On Android use
`bounds <text>` then `tap`. On iOS you need a simulator tap against a `shot` — take coordinates from
`wvd shot` (a uniform 0.46 scale of the point space), not from another screenshot tool.
