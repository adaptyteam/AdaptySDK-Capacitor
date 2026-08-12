# Driving the devtools app in the iOS Simulator with `yarn wvd`

`examples/adapty-devtools/scripts/webview-driver.mjs` drives the devtools app running in the iOS Simulator by
DOM `id`: it clicks buttons, fills inputs, reads state, tails the app's own log and tails the
native iOS SDK log — from the shell, with no screenshots and no taps.

It exists because screenshot-driven automation of a Capacitor app is slow and, for text input,
impossible: keyboard events injected into the simulator never reach `<input>` elements inside the
`WKWebView`. Typing appears to succeed and nothing changes. The WebView, on the other hand, is a
normal web page — if you can talk to its inspector you get `querySelector`, `.click()`, `.value`.
`wvd` talks to that inspector through `ios_webkit_debug_proxy`.

## 1. What to run

Everything below assumes you are in the app directory: `wvd` is a script in the app's
`package.json`, and relative paths (`.wvd/shot.png`, an explicit `wvd shot <path>`) resolve from your
working directory.

```bash
cd examples/adapty-devtools
```

> **Piping: use `yarn --silent` or call node directly.** Yarn Classic writes a
> `yarn run v1.22.10` banner and the `$ node scripts/webview-driver.mjs …` echo to **stdout** before the
> command's own output, so `yarn wvd snap | head -1` prints the banner, not the snapshot header.
>
> ```bash
> $ yarn wvd snap | head -1
> yarn run v1.22.10
> $ yarn --silent wvd snap | head -1
> #/app | 76 els
> $ node scripts/webview-driver.mjs snap | head -1
> #/app | 76 els
> ```
>
> Read plain `yarn wvd …` output; slice, grep or parse `yarn --silent wvd …` /
> `node scripts/webview-driver.mjs …`.

Every output below is a real capture, with the Yarn banner lines stripped. What the commands print
depends on the app's current state and, for `wvd native`, on which records fall inside the window —
so expect the same *shape*, not the same rows.

### Choosing the platform

`wvd` drives the iOS Simulator and Android (emulator or attached device) through one command set. The
backend is autodetected from what is running; pass `--ios` / `--android` (or set `WVD_PLATFORM`) when
both are up:

```bash
$ yarn wvd snap
wvd: both a booted iOS simulator and an attached Android device are present — pass --ios or --android (or set WVD_PLATFORM)
$ yarn wvd --android snap
#/app | 93 els
```

Autodetection deliberately errors instead of picking one. Driving the wrong platform is the only
failure here with no symptom: every command succeeds, the ids are the same, and the output looks
entirely normal — you just measured the other SDK.

What differs between the backends is only the transport and the device tooling; `page-script.mjs`,
`steps.mjs` and `runner.mjs` are shared verbatim, which is what makes an iOS-vs-Android comparison a
comparison of the SDKs rather than of two harnesses.

| | iOS | Android |
| --- | --- | --- |
| Transport | WebKit inspector via `ios_webkit_debug_proxy` (`inspector.mjs`) | CDP via `adb forward` (`cdp.mjs`) |
| Device | `xcrun simctl` (`simulator.mjs`) | `adb` (`android-device.mjs`) |
| Native log | `os_log`, `subsystem == "io.adapty"` | `logcat`, tags matching `Adapty*` |
| Clean state | uninstall + install, ~1 min | `wvd clear` (`pm clear`), ~1 s |
| Native-view taps | derive coordinates from `wvd shot` | `wvd bounds <text>`, measured |

### `yarn wvd snap` — what state is the app in

One line per element carrying an `id`, with its value or its trimmed text, plus `DISABLED` and
`HIDDEN` flags. **Read this instead of taking a screenshot** for anything inside the WebView.

```bash
yarn wvd snap
```

```
#/app | 76 els
#credentials-api-key-value "API Key: public_live_iNuUlSsN..."
#identify-customer-user-id-input =""
#identify-submit-btn "Identify User" DISABLED
#sdk-activate-btn "Activated"
#app-result-value "✅ Flow dismissed"
#flow-placement-input ="calm9"
#flow-fetch-policy-select ="0"
#flow-load-btn "Load Flow"
#flow-name-value "Flow name: Calm_new_prod"
#flow-config-locale-value "Config Locale: en"
#flow-present-btn "Present Flow"
#flow-dismiss-btn "Dismiss Flow" DISABLED
… 61 more rows …
#nav-app-tab "App"
#nav-logs-tab "Logs"
#nav-profile-tab "Profile"
```

Two things about that header, both easy to misread:

- The route is `location.hash`, so `#/app`, `#/logs`, `#/profile`.
- `76 els` is **not** a count of actionable controls. The collector is flat
  (`querySelectorAll('[id]')`), so an id nested inside another id's element shows up twice — once
  folded into the container's text, once as its own row:

  ```
  #refund-preference-toggle "No Preferenceno_preference"
  #refund-preference-value "no_preference"
  ```

`=` means the row is a form element and the string is its `.value` (never clipped); a bare quoted
string is `textContent`, clipped to 48 characters with a trailing `…`. When you see that marker the
value is INCOMPLETE — go get it with `read:<id>` or `eval`, never parse an id out of a clipped row.
This matters: a clipped product row reads `ID: monthly.premium.9`, which looks like a valid id and
is not one.

### `yarn wvd logs [n]` — what did the JS layer do

The last `n` entries (default 20) of the app's own log, oldest first, straight out of
`LogsContext` — no navigating to `/logs`.

```bash
yarn wvd logs 6
```

```
6/115 log entries
19:23:40.959 verbose [sdk] encode/AdaptyFlow: Encoding object: OK
19:23:40.959 verbose [sdk] fetch/get_paywall_products: Calling bridge function...
19:23:40.975 verbose [sdk] fetch/get_paywall_products: Calling bridge function: OK
19:23:40.976 verbose [sdk] parseMethodResult: Decoding string...
19:23:40.976 error   [sdk] get_paywall_products: Calling method: FAILED
19:23:40.976 error         getFlow: Error fetching flow
```

Columns: local time (same format as the `/logs` screen), level, `[sdk]` when the entry came from
the SDK's own logger rather than the app, then `funcName: message`. The level column is padded to
the width of the longest level name, so `verbose` — the SDK's most common level — lines up with
`error` instead of shifting every column after it. `wvd native` pads to the same width.

In `6/115`, **115 is the retained count, not a lifetime count** — `LogsContext` keeps
`slice(-MAX_LOGS)` with `MAX_LOGS = 1000`, so a long session silently drops its oldest entries.
It also legitimately disagrees with the counter on the `/logs` screen, which filters to `sdk`
entries by default.

### `yarn wvd native [--seconds=N] [--level=…] [--full]` — what did the iOS SDK do

The native SDK log: HTTP requests with their `curl` equivalents, StoreKit calls, native errors —
the records the Xcode console shows. This is a **wholly separate channel** from `wvd logs`: the
native SDK writes through `os_log` (subsystem `io.adapty`), which never reaches the WebView.

```bash
yarn wvd native --seconds=45
```

```
34 native entries (io.adapty, last 45s)
17:40:07.176 info    Adapty activated successfully. [Ert9IT] | Adapty/Adapty+Activate.swift#99
17:40:07.177 info    LifecycleManager initialize | Adapty/LifecycleManager.swift#40
17:40:07.177 verbose LifecycleManager: hyEhnO scheduleProfileUpdate | Adapty/LifecycleManager.swift#98
17:40:07.177 verbose GET --> /sdk/company/public_live_iNuUlSsN/app/net-config.json [kKEVz8] ----------REQUEST START---------- $ curl -v -X GET "https://fallback.adapty.io/api/v1/sdk/company/public_live_iNuUlSsN/app/net-co… | Adapty/HTTPSession.Log.swift#23
17:40:07.178 error   UpdateASAToken: On AAAttribution.attributionToken Error Domain=com.apple.ap.adservices.attributionError Code=3 "Attribution services are only available on iOS and iPadOS." UserInfo={NSLocalizedDescrip… | Adapty/Adapty+UpdateASAToken.swift#57
17:40:07.178 verbose call StoreKit.Transaction.currentEntitlements | Adapty/TransactionManager.swift#206
17:40:07.184 verbose idfaUpdateTimer tick, status = notAvailable | Adapty/LifecycleManager.swift#228
…
```

Options:

- `--seconds=N` (default 60) — the window, passed to `log show --last`.
- `--level=error|warn|info|verbose|debug` — keeps entries **at or above** that SDK level:

  ```bash
  yarn wvd native --seconds=45 --level=warn
  ```

  ```
  2 native entries (io.adapty, last 45s)
  17:40:07.178 error   UpdateASAToken: On AAAttribution.attributionToken Error Domain=com.apple.ap.adservices.attributionError Code=3 "Attribution services are only available on iOS and iPadOS." UserInfo={NSLocalizedDescrip… | Adapty/Adapty+UpdateASAToken.swift#57
  17:40:07.778 error   Completed getPaywallProducts(flow:) [WsAtAL] with error: StoreKitManagerError.noProductIDsFound([4.0.2]: Adapty/ProductsManager.swift#89). | Adapty/Adapty+Shared.swift#72
  ```

- `--full` — stops clipping each message at 200 characters. Useful for a `curl` line, but see the
  truncation trap below: `--full` does not recover what `os_log` already dropped.

Four things that will mislead you otherwise:

1. **`--info --debug` are mandatory, and `wvd` passes them for you.** `AdaptyLogger` maps its
   `verbose` level to `os_log`'s `.info` and its `debug` to `.debug`, and neither is persisted by
   default. In one 120 s window the same predicate yields **1 line** without the flags and **55**
   with them. If you ever run `log show` by hand, pass both or you will conclude the SDK did
   nothing.
2. **The `os_log` level letters are inverted relative to SDK levels.** Confirmed against
   `AdaptyLogger+OSLog.swift`, which sends `.error → .fault` and `.verbose → .info`:

   | SDK level | `os_log` type | compact-style letter |
   | --- | --- | --- |
   | `error` | `.fault` | `F` |
   | `warn` | `.error` | `E` |
   | `info` | `.default` | `Df` |
   | `verbose` | `.info` | `I` |
   | `debug` | `.debug` | `Db` |

   So a raw log full of `I` is *verbose chatter*, and a lone `F` is *the error*. `wvd native` prints
   the SDK level, never the letter — the table only matters when you read `log show` directly.
3. **`os_log` truncates long messages.** Past its size limit the record ends in `<…>` and the
   trailing `v<version>, <file>#<line>` annotation degrades to
   `v<decode: missing data>, <decode: missing data>`, so `wvd native` shows the entry with no
   `| source` suffix. **Full HTTP request/response bodies are not available from this channel at
   all** — `--full` cannot bring back bytes the logging system never wrote. Use Proxyman for
   bodies.
4. **The window matters more than you expect.** The SDK emits background `verbose` records
   (`LifecycleManager … syncProfile`, a profile `GET`) roughly once a minute, so a short
   `--seconds` can legitimately contain nothing but those — or nothing at all, in which case the
   header says so instead of implying silence:

   ```bash
   yarn wvd native --seconds=1
   ```

   ```
   0 native entries (io.adapty, last 1s) — nothing in this window; try a longer --seconds
   ```

   Widen `--seconds` rather than concluding the SDK is quiet.

### `yarn wvd do <step>…` — one call, many steps

The workhorse. Steps run in order in a single inspector session, each one echoing its result:

| Step | Meaning |
| --- | --- |
| `set:<id>=<value>` | write a value through React's native prototype setter, then fire a bubbling event |
| `click:<id>` | click; refuses a disabled element |
| `read:<id>` | the `.value` of a form element, otherwise trimmed `textContent` |
| `wait:<id>` | poll until the element exists |
| `wait:<id>:enabled` | …exists and is not disabled |
| `wait:<id>:disabled` | …exists and is disabled |
| `wait:<id>:absent` | …is gone from the DOM |
| `sleep:<ms>` | unconditional pause |
| `snap` | inline snapshot at this point in the chain |

`--timeout=<ms>` (default 15000) applies to `wait` steps.

```bash
yarn wvd do click:flow-load-btn wait:flow-present-btn:enabled read:flow-name-value read:flow-config-locale-value
```

```
click:flow-load-btn -> ok
wait:flow-present-btn:enabled -> enabled
read:flow-name-value -> Flow name: Calm_new_prod
read:flow-config-locale-value -> Config Locale: en
```

**The chain stops at the first failure and the process exits 1.** A chain built on a missing
element only produces noise after the first break, so nothing downstream is attempted:

```bash
yarn wvd do read:flow-name-value click:flow-nope-btn read:flow-revision-value
```

```
read:flow-name-value -> Flow name: Calm_new_prod
click:flow-nope-btn -> ERR no #flow-nope-btn
```

A `wait` that never comes true fails the same way:

```bash
yarn wvd do --timeout=1000 wait:onboarding-present-btn:enabled
```

```
wait:onboarding-present-btn:enabled -> ERR timeout after 1000ms waiting for #onboarding-present-btn to be enabled
```

`set:` only works on `<input>`, `<textarea>` and `<select>` — calling the input prototype's value
setter on anything else throws, so it is refused up front:

```bash
yarn wvd do set:refund-preference-toggle=x
```

```
set:refund-preference-toggle=x -> ERR not settable #refund-preference-toggle (<div>)
```

### `yarn wvd scenario flow [--placement=<id>] [--locale=<code>] [--no-relaunch]`

The one built-in scenario: activate → load flow → present → read back the locale the native view
actually used → dismiss from the DOM.

```bash
yarn wvd scenario flow
```

```
relaunched: com.example.plugin: 48352
click:sdk-activate-btn -> ok
wait:flow-load-btn -> present
click:flow-load-btn -> ok
wait:flow-present-btn:enabled -> enabled
read:flow-name-value -> Flow name: Calm_new_prod
read:flow-config-locale-value -> Config Locale: en
click:flow-present-btn -> ok
sleep:3000 -> slept
read:flow-view-locale-value -> View Locale: en
click:flow-dismiss-btn -> ok
wait:flow-view-locale-value:absent -> absent
```

It **relaunches the app first**, and `--no-relaunch` is only safe on a session you know is fresh.
Two reasons:

- A second `activate` throws and takes the whole UI down with it (see below).
- A flow left over from an earlier run keeps `#flow-present-btn` enabled, so
  `wait:flow-present-btn:enabled` would pass without the current `Load Flow` having finished — the
  scenario would report success about the wrong flow.

Note the `sleep:3000` after `click:flow-present-btn`: it is a `sleep` and not a `wait` on purpose,
for the reason in §3.

### `yarn wvd shot [path]` — the only view of native content

```bash
yarn wvd shot
```

```
.wvd/shot.png
```

`xcrun simctl io … screenshot` followed by `sips -Z 500`. `sips -Z` bounds the **larger**
dimension, so a portrait iPhone 17 Pro capture comes out **230 × 500** — small on purpose, since a
full-resolution PNG is a large amount of context for a question a snapshot usually answers better.
At that size a presented paywall is still identifiable: headline, CTA label and brand wordmark all
read cleanly. `.wvd/` is gitignored.

### `yarn wvd relaunch` — the reset

```bash
yarn wvd relaunch
```

```
com.example.plugin: 48603
```

`simctl terminate` + `simctl launch --terminate-running-process`. Clears a stuck native view and a
wedged SDK, and **costs the SDK session** — profile, loaded flow and activation are all gone.

Budget **~2.4–4.5 s**, against 0.66 s measured for the two `simctl` calls on their own. The spread
is real and not worth averaging away: what dominates is `wvd` waiting for the new WebView to become
inspectable before it returns, and that varies run to run. Paying it is what makes the next `wvd`
command safe to issue immediately. This is the most expensive single subcommand — only the composite
`wvd scenario`, which calls it internally, costs more.

### `yarn wvd eval <expression>` — the escape hatch

```bash
yarn wvd eval "document.querySelectorAll('button').length"
```

```
31
```

One `Runtime.evaluate` with `returnByValue`, so return a primitive or a `JSON.stringify(…)` —
never a DOM node. `Promise` expressions do not work here (§7).

### One activation only — a repeat `activate` wedges the whole app

Worth knowing before you drive anything, because it looks like `wvd` broke:

**Clicking `#sdk-activate-btn` on an already-activated app wedges the app until
`yarn wvd relaunch`.** This is a known SDK bug, already reported separately and out of scope here.
Two mechanisms compound:

- In `src/adapty.ts`, `this.activating` is set to the `performActivation` promise and only cleared
  after a *successful* await. A rejected activation leaves the rejected promise in place, and
  `handleMethodCall` awaits `this.activating` for every method not in `nonWaitingMethods` — which
  includes `get_flow` and `adapty_ui_create_flow_view`. Every later SDK call therefore rejects
  immediately.
- In the app, `testActivate`'s `catch` calls `setIsActivated(false)`
  (`src/screens/app/App.tsx:157`), and the sections are gated on `isActivated`, so the UI
  unmounts.

What you see: the snapshot collapses from 76 rows to 16, and `#app-result-value` reads
`Activation Error: Error: #3005 (activateOnceError)`.

```
#/app | 16 els
#sdk-activate-btn "Activate Adapty"
#app-result-value "Activation Error: Error: #3005 (activateOnceErro"
#sdk-status-activated-value "Status: ❌ Not activated"
…
```

Recover with `yarn wvd relaunch`. Prefer `yarn wvd scenario flow`, or start every chain with a
relaunch, rather than guessing whether the SDK is already active.

## 2. Preconditions

- **A Debug build.** Capacitor sets `isInspectable = true` on the `WKWebView` only in Debug
  (iOS 16.4+). `cap run ios` builds Debug by default. A Release build is invisible to all of this.
- **Exactly one booted simulator.** Two different mechanisms enforce this, and they fail with
  different messages:

  - `wvd shot`, `wvd relaunch` and `wvd native` resolve a UDID from the booted device list and refuse
    to guess: `several booted simulators (…) — shut down all but one`.
  - `wvd snap`, `wvd do`, `wvd logs`, `wvd eval` and `wvd scenario`'s step phase never resolve a UDID at
    all — they talk to whichever `com.apple.webinspectord_sim.socket` `lsof` returns first and to
    the Capacitor page the proxy lists. Since that would silently pick a device, they refuse when
    the proxy lists more than one Capacitor page:
    `several inspectable Capacitor pages (…) — wvd cannot tell which simulator you mean`.

  Either way, shut the extras down:

  ```bash
  xcrun simctl list devices booted
  xcrun simctl shutdown <udid>
  ```

- **The app running.** `yarn ios` builds and deploys it — but plain `yarn ios` **prompts
  interactively for a target**, which hangs any non-interactive caller. Pass a target explicitly:

  ```bash
  npx cap run ios --list                       # target ids
  yarn ios --target <udid>                      # e.g. --target 6388ACDB-4C83-4830-B33D-DECA92D6D3A0
  ```

- **The proxy binary:**

  ```bash
  brew install ios-webkit-debug-proxy
  ```

  `wvd` starts it, and replaces a stale one that is answering on `9221` while listing no pages,
  before every command. There is no `lsof` ritual and nothing to leave running by hand — the socket
  lookup that used to be a manual step now happens inside `webview-driver/inspector.mjs` on every invocation,
  because the path changes whenever the simulator's `launchd_sim` restarts.

- **Node 22+**, which the app already requires: `wvd` uses the global `WebSocket` and has no
  dependencies of its own.

### Android

- **`adb` on `PATH`** (`~/Library/Android/sdk/platform-tools`) and **exactly one attached device** —
  same refusal-to-guess as the simulator: `several attached devices (…) — leave one`.
- **A debug build.** Capacitor calls `setWebContentsDebuggingEnabled(true)` only for a debuggable
  app; a release build exposes no `webview_devtools_remote_*` socket and nothing here works.
- **The app running**, since the devtools socket name carries its pid — so it is re-resolved on every
  command, never cached:

  ```bash
  yarn build && npx cap run android --target emulator-5554
  ```

- **A Google Play system image** if purchases matter: the image name shows it
  (`sdk_gphone64_arm64`), and `adb shell pm list packages | grep com.android.vending` confirms Play
  is present. A plain "Google APIs" image has no Play Store, so Play Billing cannot run at all.
- **The Android package is not `capacitor.config.json`'s `appId`.** It comes from
  `android/app/build.gradle`'s `applicationId`, and the two genuinely differ in this repo
  (`com.adaptytest` vs `com.adapty.adaptydemoapp`) because `yarn credentials` patches them
  independently. `android-device.mjs` reads the gradle file for that reason; taking `appId` there
  would target a package that does not exist and every adb call would quietly no-op.
- **Port 9333, not 9222.** `ios_webkit_debug_proxy` owns 9222, so the `adb forward` uses 9333. They
  used to share it, and `adb` binding `127.0.0.1:9222` first shadowed the iOS proxy: every iOS
  command failed with `lists no inspectable page` while Android looked perfectly healthy.

## 3. What each tool can and cannot see

Getting this wrong is what costs round-trips.

| Question | Tool | Blind to |
| --- | --- | --- |
| What state is the app in? | `wvd snap` / `wvd do read:` | anything native — a presented flow, a toast, a StoreKit sheet |
| What is literally on screen? | `wvd shot` | text you could have read exactly; anything off-screen |
| What did the **JS layer** do? | `wvd logs` | the native SDK's own log |
| What did the **iOS SDK** do? | `wvd native` | anything the JS layer did without calling the SDK |

- **`wvd snap` answers "what is the app state"** — ids, values, `DISABLED`, and which sections are
  mounted. Exact, cheap and diffable. It is the default; reach past it only when the answer is not
  in the DOM.
- **`wvd shot` is the only thing that sees native content.** A presented flow or onboarding is a
  native view controller — its content is not in the DOM at any point. So are toasts:
  `src/utils/toast.ts` wraps `@capacitor/toast`, so a toast never appears in `snap` and never
  appears in `logs`. If a check depends on a toast or on what a paywall rendered, it needs a shot.
- **`wvd logs` answers what the JS layer did**, including native events that arrive at the JS
  listeners (`flow_view_did_disappear` and friends land here).
- **`wvd native` answers what the iOS SDK did** — and it is the only way to see it at all, short of
  attaching Xcode.

### There is no DOM signal for "a native view is on screen"

The one weak signal is that readouts gated on the view controller mount while it is set —
`#flow-view-locale-value` renders only while `flowView` is non-null. That is **not** a
presentation signal: `FlowController` calls `setFlowView(view)` immediately after creating the
view (`FlowController.tsx:68`) and only later `await view.present()` (`:216`). So
`wait:flow-view-locale-value` goes green while presentation is still in flight — or even if it
fails outright.

Settle with `sleep` and confirm with `wvd shot`. That is exactly why the built-in scenario uses
`sleep:3000` there rather than a `wait`.

## 4. Native views

A DOM click still reaches the app while a native view covers the WebView, so **closing a presented
flow or onboarding needs no tap**:

```bash
yarn wvd do click:flow-dismiss-btn wait:flow-view-locale-value:absent
```

```
click:flow-dismiss-btn -> ok
wait:flow-view-locale-value:absent -> absent
```

`#onboarding-dismiss-btn` is the equivalent. `wvd snap` and `wvd do` keep working normally while a
native view is up: they see the DOM underneath it, which is what makes both the dismiss click and
the `absent` assertion possible.

### Tapping inside a native view

Controls *inside* a presented paywall, onboarding or system sheet are not in the DOM.

On **Android**, do not compute coordinates — `uiautomator` exposes a real hierarchy with measured
bounds, and `wvd bounds` returns the centre of the first node whose text or content-desc matches:

```bash
$ yarn wvd bounds "1-tap buy"
672 2824   (bounds 72,2770,1272,2878)
$ yarn wvd tap 672 2824
tapped 672 2824
```

It prints the centre only, on purpose: the full dump is ~40 KB of XML on one line, and pasting that
into a conversation is what the command exists to avoid. `bounds` matches `text=` and
`content-desc=` attributes only — matching the whole node would let the needle hit an attribute name
or a resource id and return the rectangle of the entire screen.

This works on system UI as well as the app's own, which is what makes the Google Play purchase sheet
drivable. Note it is not blocked by `FLAG_SECURE` here: both `screencap` and the dump return the
Play sheet's contents.

On **iOS** there is no equivalent — derive coordinates from `wvd shot`, which is a uniform 0.46 scale
of the point space (230×500 for a 402×874 device: `x_pt = x_img / 230 * 402`). Do not derive them
from another screenshot tool: the simulator MCP's own capture is not uniformly scaled and put a tap
~80 pt off target.

**Present twice without dismissing in between and Dismiss goes stale — while still reporting
success.** Each `click:flow-present-btn` creates a *new* view controller and overwrites the stored
reference (`FlowController.tsx:67-68`), so Dismiss can only ever close the most recent one. The
earlier view is orphaned: still on screen, and unreachable from the DOM. Verified — after two
presents and one dismiss, every DOM signal reads clean while the paywall is still up:

```bash
yarn wvd do click:flow-dismiss-btn wait:flow-view-locale-value:absent read:app-result-value
```

```
click:flow-dismiss-btn -> ok
wait:flow-view-locale-value:absent -> absent
read:app-result-value -> ✅ Flow dismissed
```

`wvd shot` is the only thing that catches it. Same shape as the activate-twice trap in §1, and the
same cure: `yarn wvd relaunch`. Dismiss before presenting again.

Interacting with the *content* of a presented paywall is still out of reach: its buttons are not in
the DOM. That needs simulator taps against a `wvd shot`. System dialogs (StoreKit purchase sheets,
permission prompts) are native too.

## 5. Honest accounting

Only two commands genuinely cut the number of agent tool calls; the rest win on other axes, and
pretending otherwise leads to using the wrong one.

| Command | What it actually buys |
| --- | --- |
| `wvd do` | **Fewer calls.** A whole chain — set, click, wait, read — in one invocation instead of one per step. |
| `wvd logs` | **Fewer calls.** Reads the log without navigating to `/logs` and back, so no route change and no return trip. |
| `wvd native` | **A channel that did not exist.** `os_log` output was previously unreachable without attaching Xcode by hand. Not a saving — a new capability. |
| `wvd snap` | **Tokens and exactness.** A 1-for-1 replacement for a screenshot: same one call, but text instead of pixels, and ids and values read exactly rather than guessed from a render. |
| `wvd scenario` | 1-for-1 convenience: one command instead of one hand-written `wvd do` chain. |
| `wvd shot` | 1-for-1 convenience over `simctl io … screenshot` plus a downscale. |
| `wvd relaunch` | 1-for-1 convenience over two `simctl` calls — plus the inspectable-page wait, which is the part that is easy to get wrong by hand. |

### What a call actually costs

**A wait-free call is cheap enough to ignore — well under ~0.1 s** on the machine this was measured
on (`node scripts/webview-driver.mjs snap` and `node scripts/webview-driver.mjs eval "1+1"`, six cold runs each, all in
0.08–0.10 s). Cold process start plus the inspector handshake plus one `Runtime.evaluate` all fit in
that. Treat it as an order of magnitude, not a constant — it is machine-dependent.

That is the whole argument for batching with `wvd do`: the inspector round trip is negligible, so
what a chain costs is what the *app* costs. Past ~0.1 s the cost is either the app or a subprocess
`wvd` shells out to — never the inspector round trip:

- A `wait:` step costs whatever it is polling for. The 4-step example in §1 contains
  `wait:flow-present-btn:enabled`, so it is dominated by the `Load Flow` network round trips —
  `wvd native` timed those at 0.1–0.6 s each against the Adapty backend — and **not** by CLI
  overhead. Do not read that chain's wall time as the cost of four steps.
- `sleep:` costs exactly what you asked for; the built-in scenario spends 3 s of its ~6.5–7 s there.
- `wvd native` shells out to `log show`, which costs ~1.5–3 s. That is `log show`'s own start-up, not
  your window: across `--seconds=1`, `45` and `300` the three medians sat within noise of each other
  (1.44 / 1.43 / 1.45 s over four rounds). Window size barely affects the cost, so a wide
  `--seconds` is effectively free — prefer it over a second call.
- `wvd relaunch` waits for the WebView, ~2.4–4.5 s (see §1). `wvd scenario` includes one, plus its
  `sleep:3000`.

One measurement trap, worth stating because an earlier draft of this section fell into it:
**`yarn wvd …` adds ~0.35–0.45 s of Yarn Classic wrapper overhead** — 4-5× the work itself.
`yarn --silent wvd snap` measured 0.42–0.54 s against 0.09 s for `node scripts/webview-driver.mjs snap`. That is
irrelevant when you are reading output, but if you ever time `wvd`, time `node scripts/webview-driver.mjs` or you
will be timing Yarn.

## 6. Ids

Every button, input, select, textarea, clickable element and state readout in the devtools app
carries a stable `id`.

- **Source of truth:** [`examples/adapty-devtools/src/elementIds.ts`](../../../examples/adapty-devtools/src/elementIds.ts)
- **Generated list:** [`examples/adapty-devtools/docs/element-ids.md`](../../../examples/adapty-devtools/docs/element-ids.md)
- **Enforced by:** `yarn check-ids` in the app (CI runs it); `yarn check-ids:write` regenerates the
  list

The convention is `<area>-<name>-<kind>`, where `<kind>` is one of `btn`, `input`, `select`,
`textarea`, `toggle`, `value`, `tab`, `item`. Dynamic rows interpolate a key — the array index for
flow products (`flow-product-0-purchase-btn`), the log id for log rows (`logs-<log-id>-item`).
Product rows also carry `data-vendor-product-id`, so a script can map a product id to its index.

Ids beat class names and text content: CSS-module classes are hashed per build and labels change
with copy edits. Never rename or reuse an id — external automation hardcodes these strings.

Two gotchas when reading them back:

- **A `<select>` reports its option *value*, not its label** — and in this app the values are
  numeric index strings (`value={index}`), so `read`/`snap` give you `"0"`, not
  `"reload revalidating cache data"`:

  ```bash
  yarn wvd do read:flow-fetch-policy-select
  ```

  ```
  read:flow-fetch-policy-select -> 0
  ```

  Set them by index too: `set:flow-fetch-policy-select=1`.
- **A checkbox would report `="on"`** regardless of whether it is checked, because `.value` is not
  `.checked`. There is deliberately no checkbox special case in the tooling: the app has no
  `<input type="checkbox">` today — the `refund-*-toggle` controls are `<div>`s, which is why
  `set:` refuses them (§1). If a real checkbox is ever added, `wvd` needs a case for it.

## 7. Protocol notes

### iOS — WebKit inspector

All verified against iOS 26.5 in the simulator; each one has cost someone an hour.

- **Every command must be wrapped in `Target.sendMessageToTarget`.** A top-level `Runtime.evaluate`
  is rejected: `{"code":-32601,"message":"'Runtime' domain was not found"}`.
- **A bad `targetId` fails at the *outer* level**, not inside the wrapped reply:
  `{"code":-32000,"message":"Missing target for given targetId"}`. A client that only reads
  `Target.dispatchMessageFromTarget` events will hang forever instead of erroring.
- **`Target.targetCreated` arrives unsolicited** — `Target.setPauseOnStart` is **not** needed, and
  sending it is cargo cult. **Two** events arrive, `{"targetId":"frame-…","type":"frame"}` then
  `{"targetId":"page-…","type":"page"}`; `Runtime.evaluate` works through either, and `wvd` takes
  whichever lands first.
- **`awaitPromise` is ignored.** `Runtime.evaluate` on `Promise.resolve(42)` with
  `awaitPromise: true` replies `{"type":"object","value":{}}`. There is no way to await inside an
  evaluation — poll with `wait:` instead.
- **React-controlled inputs need the native prototype setter plus a bubbling event.** A plain
  `el.value = x` is swallowed on the next render. `set:` goes through
  `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)` and then
  dispatches `input` (`change` for `<select>`).
- **Simulator keyboard events never reach WebView inputs.** This is the reason `set:` exists at
  all, and the reason screenshot-driven automation cannot test anything that requires typing.
- **`window.__wvd` is reinstalled on every run** — the helper source assigns unconditionally rather
  than guarding with `||`. Editing `scripts/webview-driver/page-script.mjs` takes effect on the very next
  command, with no app reload and no rebuild.

### Android — Chrome DevTools Protocol

Verified against Android 16 (`sdk_gphone64_arm64`), WebView Chrome 149.

- **No wrapper, no proxy.** `Runtime.evaluate` is sent at the top level and `adb forward` exposes the
  devtools socket directly — which is why `cdp.mjs` is a quarter the size of `inspector.mjs`.
- **`awaitPromise` is passed as `false` deliberately**, matching the iOS behaviour rather than the
  protocol's capability: CDP *would* await, but the shared helpers are synchronous and awaiting turns
  a page that returns a pending promise into a hang. Poll with `wait:` on both platforms.
- **The socket name carries the app's pid** (`@webview_devtools_remote_21846`), so the forward is
  re-established per command. A cached one silently points at a dead process after any relaunch.
- **`pidof` exits 1 when the app is not running**, and `execFileSync` throws on a non-zero exit. That
  made "the app is stopped" fatal and broke `relaunch`, whose whole middle is a stopped app.
- **`adb exec-out screencap`, never `adb shell screencap`.** The shell variant sends the PNG through a
  pty that rewrites `\n` as `\r\n` and corrupts every capture.
- **The logcat window is computed on the device** (`date -d @epoch`), because logcat prints
  device-local timestamps and a host-computed bound shifts the window by the clock skew.
- **`logcat` needs the tag filter to be readable at all.** The Adapty tag carries the version
  (`Adapty_v4.0.1`), so the filter is a prefix match; without it a 60-second window is ~1100 lines of
  `WindowManager` noise. The SDK also prints its own level as a message prefix (`VERBOSE:`, `INFO:`),
  and that is what `wvd native` reports — the logcat priority is lossy by comparison.

## 8. Troubleshooting

| Symptom | Cause |
| --- | --- |
| `several booted simulators (…) — shut down all but one` | `wvd shot` / `relaunch` / `native` will not guess which one you mean — `xcrun simctl shutdown <udid>` the extras |
| `several inspectable Capacitor pages (…)` | the same, hit from the inspector side (`snap`, `do`, `logs`, `eval`, `scenario`) — see §2 |
| `no booted simulator` | nothing is booted; start one and launch the app |
| `ios_webkit_debug_proxy not found` | `brew install ios-webkit-debug-proxy` |
| `ios_webkit_debug_proxy is up but lists no inspectable page` | the app is not running, or it is a Release build (only Debug sets `isInspectable`) |
| `no inspectable page after 15000ms` | `waitForPage()`'s message, and **no `wvd` command raises it any more** — `relaunch` and `scenario` used to, whenever the proxy was dead or stale, because they polled the port without starting it. Both now go through `ensureProxy()`, so a not-running app reports the row above instead. Seeing this means something is calling `waitForPage()` directly |
| `http://localhost:9222/json` returns `[]` (checking by hand) | same two causes as above |
| `window.__adaptyDevtoolsLogs is not published` | the deployed bundle predates the `LogsContext` change — rebuild and redeploy (`yarn ios --target <udid>`) |
| `ERR no #<id>` | typo, or the section is unmounted — run `wvd snap` and look |
| `ERR disabled #<id>` | the control is genuinely disabled; add the `wait:<id>:enabled` that belongs in front of it |
| `ERR not settable #<id> (<div>)` | `set:` only works on `<input>`, `<textarea>`, `<select>` |
| `Activation Error: … #3005 (activateOnceError)`, sections gone | activated twice — `yarn wvd relaunch` (§1) |
| Dismiss reports `ok` and `absent`, but `wvd shot` still shows the view | presented twice without dismissing; the earlier view is orphaned — `yarn wvd relaunch` (§4) |
| `wvd native` prints `0 native entries` | the window missed the action, or you ran `log show` by hand without `--info --debug` |
| An expression returns `{}` | it is a `Promise` — `awaitPromise` is ignored; poll with `wait:` |
| A value set on an input reverts | React controlled component — use `set:`, not `wvd eval "el.value = …"` |
| Typing through the simulator does nothing | keyboard events do not reach WebView inputs; that is what `set:` is for |
| `head`/`grep` on `yarn wvd …` shows a Yarn banner | use `yarn --silent wvd …` or `node scripts/webview-driver.mjs …` |
| `both a booted iOS simulator and an attached Android device are present` | pass `--ios` / `--android`, or set `WVD_PLATFORM` |
| `no booted iOS simulator and no attached Android device` | nothing to drive — boot one and launch the app |
| `several attached devices (…) — leave one` | the Android side of the refusal to guess |
| iOS `lists no inspectable page` **while the app is definitely running** | two causes worth checking in order: (a) something else holds 9222 — `lsof -nP -iTCP:9222 -sTCP:LISTEN`, an old `adb forward tcp:9222` shadows the proxy; (b) the installed app is not ours. The React Native demo ships the **same** bundle id `com.adapty.adaptydemoapp`, so building it replaces the Capacitor app — `wvd shot` shows RN's red `No script URL provided` box, and an app with no WebView cannot have an inspectable page |
| Android `<pkg> is not running — launch it first` | the devtools socket only exists while the app is up; `npx cap run android --target <serial>` |
| Android `could not resolve a launcher activity` | the package is installed but has no launcher intent — check `adb shell cmd package resolve-activity --brief <pkg>` |
| `no native view matching "…" — is it on screen?` | `bounds` searches the CURRENT hierarchy; the sheet may have closed, or the text differs from what is rendered |
| `app did not finish routing within the wait — continuing anyway` | warning, not an error: `relaunch` waits for React to route and gave up. The next command reports the real state |

## Tests

The pure parts of the CLI — step parsing, snapshot and log formatting, the `os_log` and `logcat`
parsers, platform resolution, `bounds` extraction, the step runner — are unit-tested without a
simulator or a device, and CI runs them:

```bash
cd examples/adapty-devtools && yarn test-wvd
```
