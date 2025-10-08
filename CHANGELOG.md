# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.11.0-beta.0]

### Added

- **`requestLocale` field in `AdaptyPaywall`**: New read-only property that returns the locale identifier that was requested and actually used by the SDK when fetching the paywall.
  ```typescript
  const paywall = await adapty.getPaywall({ 
    placementId: 'main', 
    locale: 'es' 
  });
  console.log(paywall.requestLocale); // 'es'
  ```

- **`requestLocale` field in `AdaptyOnboarding`**: New read-only property that returns the locale identifier that was requested and actually used by the SDK when fetching the onboarding.
  ```typescript
  const onboarding = await adapty.getOnboarding({ 
    placementId: 'welcome', 
    locale: 'fr' 
  });
  console.log(onboarding.requestLocale); // 'fr'
  ```
### Removed ⚠️ BREAKING CHANGES

- **`lang` field removed from `AdaptyOnboardingBuilder`**: The `lang` property is no longer available in the `AdaptyOnboardingBuilder` interface.

  **Migration guide:**
  ```typescript
  // ❌ Old code (v3.10.x)
  const builderLang = onboarding.onboardingBuilder?.lang;

  // ✅ New code (v3.11.0)
  const requestedLocale = onboarding.requestLocale;
  ```

