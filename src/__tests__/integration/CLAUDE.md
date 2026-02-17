# Integration Tests Architecture

## Test Suites

### `adapty-handler/` — Bridge Protocol Tests
Tests SDK method communication with native: JS (camelCase) → encode → snake_case JSON → Capacitor bridge → decode → JS.
Uses `NativeModuleMock` spy to verify exact request format and response parsing.
**72 tests** across 15 test files covering all major SDK methods:
- activation (27 tests), attribution (1), configuration (1), event-listeners (5)
- installation (1), ios-specific (2), onboarding (3), paywall (7)
- products (3), profile (2), purchase (2), purchase-event (1)
- restore-purchases (1), user-management (3), web-paywall (2)

## Shared Utilities (`shared/`)

### `bridge-samples/` — Typed Request/Response Fixtures
Organized by domain: `activation.ts` (more to come: `profile.ts`, `paywall.ts`, etc.).
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
npx jest src/__tests__/integration/adapty-handler    # Bridge protocol tests
npx jest src/__tests__/integration/adapty-handler/activation.test.ts  # Just activation
```
