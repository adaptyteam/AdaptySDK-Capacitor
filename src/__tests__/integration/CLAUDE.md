# Integration Tests Architecture

## Test Suites

### `adapty-handler/` — Bridge Protocol Tests
Tests SDK method communication with native: JS (camelCase) → encode → snake_case JSON → Capacitor bridge → decode → JS.
Uses `NativeModuleMock` spy to verify exact request format and response parsing.
**89 tests** across 16 test files covering all major SDK methods:
- activation (30 tests), attribution (3), configuration (3), event-listeners (5)
- installation (4), ios-specific (6), onboarding (3), flow (7)
- products (2), profile (2), promoted-purchase-event (10), purchase (5)
- purchase-event (1), restore-purchases (1), user-management (3), web-paywall (4)

`promoted-purchase-event.test.ts` is the App Store promoted-purchase suite: it
pins who completes the purchase (the SDK default vs. an app handler) and the
concurrency invariant behind it — one native `did_receive_promoted_purchase`
must produce at most one `make_promoted_purchase`, across racing `activate()`
calls and a `removeAllListeners()` that overlaps an unresolved subscribe.

Counts are a snapshot; regenerate them with
`npx jest src/__tests__/integration/ --json` when suites change.

### `ui-builder/` — UI ViewController Method Tests
Tests SDK UI controller methods (FlowViewController, OnboardingViewController) for bridge communication:
JS (camelCase) → encode → snake_case JSON → Capacitor bridge → decode → JS.
Uses `NativeModuleMock` spy to verify exact request format and response parsing.
**14 tests** across 2 test files:
- flow-view-controller-methods (10 tests): createFlowView, present, dismiss, showDialog
- onboarding-view-controller-methods (4 tests): createOnboardingView, present, dismiss

## Shared Utilities (`shared/`)

### `bridge-samples/` — Typed Request/Response Fixtures
Organized by domain: `activation.ts`, `configuration.ts`, `events.ts`, `flow.ts`, `flow-reply-events.ts`, `installation.ts`, `ios-specific.ts`, `onboarding.ts`, `profile.ts`, `purchase.ts`, `ui-methods.ts`, `user-management.ts` (plus shared `common.ts`).
All samples are **strictly typed** against `api.d.ts` — compile-time validation catches API drift.
Re-exported via `index.ts` barrel.

### `native-module-mock.utils.ts` — Native Module Mock Factory
`createNativeModuleMock({ method: RESPONSE })` — configures `AdaptyCapacitorPlugin.handleMethodCall` spy.
Returns `{ crossPlatformJson: JSON.stringify(response) }` — matching the real Capacitor bridge format.
The plugin itself is mocked at `jest.setup.js` level via `registerPlugin`.

## Key Testing Pattern

### NativeModuleMock (adapty-handler)
```ts
// Setup
nativeMock = createNativeModuleMock({ activate: ACTIVATE_RESPONSE_SUCCESS });
// Execute
await adapty.activate({ apiKey: 'key', params: { logLevel: 'error' } });
// Verify request format
expectNativeCall({ nativeModule: nativeMock, method: 'activate', expectedRequest: ACTIVATE_REQUEST_MINIMAL });
// Or extract for detailed inspection
const req = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });
expect(req.configuration.log_level).toBe('error');
```

## Data Flow

```
JS API call (camelCase)
  → Coder encodes to snake_case JSON
    → AdaptyCapacitorPlugin.handleMethodCall({ methodName, args: json })
      → Mock returns { crossPlatformJson: JSON.stringify(response) }
    → JSON.parse + isSuccessResponse/isErrorResponse + optional decoder
  → JS result (camelCase)
```

## Differences from RN SDK Integration Tests

| Aspect | RN SDK | Capacitor SDK |
|--------|--------|---------------|
| Bridge mock target | `NativeModules.RNAdapty.handler` | `AdaptyCapacitorPlugin.handleMethodCall` |
| Mock install | Mutates `NativeModules` global | Configured via `registerPlugin` in `jest.setup.js` |
| Bridge call signature | `handler(method, { args })` → `Promise<string>` | `handleMethodCall({ methodName, args })` → `Promise<{ crossPlatformJson }>` |
| Activate API | `adapty.activate('key', { logLevel })` | `adapty.activate({ apiKey: 'key', params: { logLevel } })` |
| Cleanup | Sync `removeAllListeners()` | Async `await removeAllListeners()` |
| Default config fields | `cross_platform_sdk_name: 'react-native'` | `cross_platform_sdk_name: 'capacitor'`, plus `activate_ui`, `media_cache` defaults |

## Conventions
- Samples use `api.d.ts` types (`components['requests']['Method.Request']`)
- Each test creates its own mock via `createNativeModuleMock()` for isolation
- Fresh `new Adapty()` per test in `beforeEach`
- Field transformation (snake_case ↔ camelCase) is verified explicitly in tests
- Cleanup: `cleanupAdapty()` calls `removeAllListeners()` + resets `Log.logLevel`
- `toMatchObject` for request assertions (SDK adds default fields)

## Running Tests
```bash
npx jest src/__tests__/integration/                   # All integration tests (103 tests)
npx jest src/__tests__/integration/adapty-handler/    # Bridge protocol tests (89 tests)
npx jest src/__tests__/integration/ui-builder/        # UI ViewController tests (14 tests)
npx jest src/__tests__/integration/adapty-handler/activation.test.ts  # Just activation
```
