# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [3.11.0-beta.0]

### Removed ⚠️ BREAKING CHANGES

- **`lang` field removed from `AdaptyOnboardingBuilder`**: The `lang` property is no longer available in the `AdaptyOnboardingBuilder` interface.

  **Migration guide:**
  ```typescript
  // ❌ Old code (v3.10.x)
  const builderLang = onboarding.onboardingBuilder?.lang;
  ```

