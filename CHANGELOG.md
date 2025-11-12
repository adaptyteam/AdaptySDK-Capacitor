# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

