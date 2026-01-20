# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.15.0]

### Added

- Added compatibility with **Google Play Billing Library 8** (internal dependency is still v7, but the SDK functions correctly with projects targeting v8).
- **Added `clearDataOnBackup` parameter.** Controls whether the SDK creates a new profile when the app is restored from an **iCloud backup** (default: `false`). [Read more.](https://adapty.io/docs/sdk-installation-capacitor#clear-data-on-backup-restore)
  ```typescript
  await adapty.activate({
    params: {
      ios: {
        clearDataOnBackup: true,
      },
    }
  });
  ```
- **createOnboardingView()**: added new optional `externalUrlsPresentation` property of type `WebPresentation` to control how external URLs are opened from onboarding. Defaults to `WebPresentation.BrowserInApp`.
  ```typescript
  const view = await createOnboardingView(onboarding, {
    externalUrlsPresentation: WebPresentation.BrowserOutApp
  });
  ```
  Possible values:
  - `WebPresentation.BrowserOutApp` - open in browser outside the app
  - `WebPresentation.BrowserInApp` - open in browser inside the app

- **adapty.openWebPaywall()**: added new optional `openIn` parameter of type `WebPresentation` to control how web paywalls are opened. Defaults to `WebPresentation.BrowserOutApp`.
  ```typescript
  await adapty.openWebPaywall({
    paywallOrProduct: paywall,
    openIn: WebPresentation.BrowserInApp
  });
  ```
- **Paywall:** Added a default `onRenderingFailed` handler that automatically closes the paywall if rendering fails.
- **Android**: Added support for the `onWebPaymentNavigationFinished` event.

### Fixed

- Fixed native usage of local fallback file.
- **iOS**: Fixed an issue with Promotional Offers when `customerUserId` was a [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier).
- **Android**: Fixed an issue where JS execution in WebView stopped 60 seconds after opening a native paywall.
- **Onboarding events rework**:
  - **BREAKING**: `onAnalytics` and `onStateUpdated` event payloads now match TypeScript types with fields in camelCase.
  - **DEPRECATED**: `event.element_id` in `onAnalytics`. Use `event.elementId` instead.
  - Fixed onboarding `actionId` payload for events onPaywall, onCustom, onClose.

### Breaking

- Rename paywall events: 
  - `onPaywallShown` to `onAppeared`
  - `onPaywallClosed` to `onDisappeared`
- Removed `adapty.logShowOnboarding` method.
- Removed custom backend URL fields from `ActivateParamsInput` (`backendBaseUrl`, `backendFallbackBaseUrl`, `backendConfigsBaseUrl`, `backendUABaseUrl`). Use `serverCluster` instead.

## [3.12.0-beta.1]

### Added

- Support for Local Access Levels, allowing the SDK to verify purchases directly with the store even when Adapty servers are unreachable. [Read More.](http://adapty.io/docs/local-access-levels)
- Support for StoreKit Testing in Xcode. [Read More.](http://adapty.io/docs/local-sk-files)
- **Customer Identity Parameters**: New identity parameters support in `activate()` and `identify()` methods
  - **iOS**: `appAccountToken` parameter for App Store customer identification
  - **Android**: `obfuscatedAccountId` parameter for Google Play customer identification
  - **Android**: `pendingPrepaidPlansEnabled` parameter to enable pending prepaid plans support

- **Product Information Enhancement**: Added new fields to products
  - `accessLevelId` field in `ProductReference`
  - `productType` field in `ProductReference`
  - `accessLevelId` field in `AdaptyPaywallProduct`
  - `productType` field in `AdaptyPaywallProduct`

- **Purchase Transaction Data**: Platform-specific transaction information in purchase results
  - **iOS**: `jwsTransaction` (JSON Web Signature) in successful purchase results
  - **Android**: `purchaseToken` (Google Play purchase token) in successful purchase results

- iOS presentation styles support: added `iosPresentationStyle` parameter (`'full_screen'` (default) | `'page_sheet'`) to `present()` methods in paywall and onboarding view controllers
  ```typescript
  // Before (still supported)
  await paywallView.present();
  
  // New (with presentation style)
  await paywallView.present({ iosPresentationStyle: 'page_sheet' });
  ```

### Changed

- **Native iOS SDK**: Updated to version 3.12.1
- **Native Android SDK**: Updated to version 3.12.1

- **identify() method signature**: Now accepts an options object with optional identity parameters
  ```typescript
  // Before (still supported)
  await adapty.identify({ customerUserId: 'user_123' });
  
  // New (with identity parameters)
  await adapty.identify({ 
    customerUserId: 'user_123',
    params: {
      ios: { appAccountToken: 'uuid-string' },
      android: { obfuscatedAccountId: 'obfuscated-id' }
    }
  });
  ```


### Removed

- **BREAKING CHANGE**: Removed deprecated fields from `AdaptyAndroidPurchaseParams`
  - `obfuscatedAccountId` - use `activate()` or `identify()` with `android.obfuscatedAccountId` instead
  - `obfuscatedProfileId` - no longer supported

  **Migration guide:**
  ```typescript
  // BEFORE (v3.11.x) - No longer works
  await adapty.makePurchase({ 
    product,
    android: {
      obfuscatedAccountId: 'account-id',
      obfuscatedProfileId: 'profile-id'
    }
  });
  
  // AFTER (v3.12.0) - Set during activation
  await adapty.activate({
    apiKey: 'your-key',
    params: {
      android: {
        obfuscatedAccountId: 'account-id'
      }
    }
  });
  await adapty.makePurchase({ 
    product
  });
  ```

## [3.11.1-beta.0]

### Fixed

- **Android**: Fixed `dismiss()` method in `AdaptyOnboardingViewController` not working properly.

## [3.11.0-beta.0]

### Removed ⚠️ BREAKING CHANGES

- **`lang` field removed from `AdaptyOnboardingBuilder`**: The `lang` property is no longer available in the `AdaptyOnboardingBuilder` interface.

  **Migration guide:**
  ```typescript
  // ❌ Old code (v3.10.x)
  const builderLang = onboarding.onboardingBuilder?.lang;
  ```

