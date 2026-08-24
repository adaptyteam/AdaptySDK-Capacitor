/**
 * Stable DOM ids for every interactive control, clickable element and state readout
 * in the devtools app.
 *
 * They exist so the app can be driven from outside the WebView: an automation script
 * attaches to the running WebView over the WebKit inspector protocol, evaluates
 * JavaScript against the page, and clicks controls or reads state by id.
 * CSS-module class names are hashed per build and labels change with copy edits —
 * ids do not.
 *
 * The generated lookup table lives in docs/element-ids.md.
 *
 * Convention, enforced by `yarn check-ids`:
 *
 *     <area>-<name>-<kind>
 *
 * - lowercase kebab-case only
 * - <kind> is exactly one of: btn | input | select | textarea | toggle | value | tab | item
 * - dynamic ids are functions taking the list key (index or log id); the tooling calls
 *   them with the literal '{key}' to render the pattern for the generated docs
 *
 * Rules the checker also enforces:
 * - every entry here must be referenced from at least one .tsx file as `elementIds.<path>`,
 *   outside of comments
 * - every <button>, <input>, <select> and <textarea> must carry an id attribute
 * - an id attribute is either `elementIds.<path>` (optionally called with the list key) or a
 *   pass-through identifier in a file that declares an `id` prop — never a literal
 * - ids must be unique across the registry, and no entry may be used on two elements
 */
export const elementIds = {
  nav: {
    appTab: 'nav-app-tab',
    logsTab: 'nav-logs-tab',
    profileTab: 'nav-profile-tab',
  },
  app: {
    resultValue: 'app-result-value',
  },
  credentials: {
    apiKeyValue: 'credentials-api-key-value',
    iosBundleIdValue: 'credentials-ios-bundle-id-value',
    androidApplicationIdValue: 'credentials-android-application-id-value',
  },
  sdkStatus: {
    activatedValue: 'sdk-status-activated-value',
    profileLoadedValue: 'sdk-status-profile-loaded-value',
    flowLoadedValue: 'sdk-status-flow-loaded-value',
    onboardingLoadedValue: 'sdk-status-onboarding-loaded-value',
  },
  identify: {
    customerUserIdInput: 'identify-customer-user-id-input',
    submitBtn: 'identify-submit-btn',
  },
  profile: {
    refreshBtn: 'profile-refresh-btn',
    idValue: 'profile-id-value',
    premiumValue: 'profile-premium-value',
    isLifetimeValue: 'profile-is-lifetime-value',
    activatedAtValue: 'profile-activated-at-value',
    expiresAtValue: 'profile-expires-at-value',
    willRenewValue: 'profile-will-renew-value',
    statusValue: 'profile-status-value',
  },
  flow: {
    placementInput: 'flow-placement-input',
    timeoutInput: 'flow-timeout-input',
    maxAgeInput: 'flow-max-age-input',
    fetchPolicySelect: 'flow-fetch-policy-select',
    webPaywallOpenInSelect: 'flow-web-paywall-open-in-select',
    viewLocaleInput: 'flow-view-locale-input',
    customTagsTextarea: 'flow-custom-tags-textarea',
    loadBtn: 'flow-load-btn',
    loadDefaultAudienceBtn: 'flow-load-default-audience-btn',
    presentBtn: 'flow-present-btn',
    presentExistingBtn: 'flow-present-existing-btn',
    dismissBtn: 'flow-dismiss-btn',
    logShownBtn: 'flow-log-shown-btn',
    openWebPaywallBtn: 'flow-open-web-paywall-btn',
    createWebUrlBtn: 'flow-create-web-url-btn',
    webUrlInput: 'flow-web-url-input',
    emptyValue: 'flow-empty-value',
    nameValue: 'flow-name-value',
    variationIdValue: 'flow-variation-id-value',
    revisionValue: 'flow-revision-value',
    paywallsCountValue: 'flow-paywalls-count-value',
    uiSchemaValue: 'flow-ui-schema-value',
    hasRemoteConfigValue: 'flow-has-remote-config-value',
    productsCountValue: 'flow-products-count-value',
    configLocaleValue: 'flow-config-locale-value',
    configDataValue: 'flow-config-data-value',
    viewLocaleValue: 'flow-view-locale-value',
    productItem: (key: string | number) => `flow-product-${key}-item`,
    productTitleValue: (key: string | number) => `flow-product-${key}-title-value`,
    productPriceValue: (key: string | number) => `flow-product-${key}-price-value`,
    productPurchaseBtn: (key: string | number) => `flow-product-${key}-purchase-btn`,
    productOpenWebPaywallBtn: (key: string | number) => `flow-product-${key}-open-web-paywall-btn`,
    productCreateWebUrlBtn: (key: string | number) => `flow-product-${key}-create-web-url-btn`,
  },
  onboarding: {
    placementInput: 'onboarding-placement-input',
    requestLocaleInput: 'onboarding-request-locale-input',
    timeoutInput: 'onboarding-timeout-input',
    maxAgeInput: 'onboarding-max-age-input',
    fetchPolicySelect: 'onboarding-fetch-policy-select',
    externalUrlsPresentationSelect: 'onboarding-external-urls-presentation-select',
    loadBtn: 'onboarding-load-btn',
    loadDefaultAudienceBtn: 'onboarding-load-default-audience-btn',
    presentBtn: 'onboarding-present-btn',
    dismissBtn: 'onboarding-dismiss-btn',
    emptyValue: 'onboarding-empty-value',
    nameValue: 'onboarding-name-value',
    variationIdValue: 'onboarding-variation-id-value',
    revisionValue: 'onboarding-revision-value',
    hasRemoteConfigValue: 'onboarding-has-remote-config-value',
    hasBuilderValue: 'onboarding-has-builder-value',
    requestLocaleValue: 'onboarding-request-locale-value',
    configLocaleValue: 'onboarding-config-locale-value',
    configDataValue: 'onboarding-config-data-value',
  },
  reportTransaction: {
    transactionIdInput: 'report-tx-transaction-id-input',
    variationIdInput: 'report-tx-variation-id-input',
    submitBtn: 'report-tx-submit-btn',
  },
  promoted: {
    ownerValue: 'promoted-owner-value',
    useSdkDefaultBtn: 'promoted-use-sdk-default-btn',
    useAppHandlerBtn: 'promoted-use-app-handler-btn',
    lastProductValue: 'promoted-last-product-value',
    buyBtn: 'promoted-buy-btn',
  },
  integration: {
    keyInput: 'integration-key-input',
    valueInput: 'integration-value-input',
    submitBtn: 'integration-submit-btn',
  },
  refund: {
    unavailableValue: 'refund-unavailable-value',
    preferenceToggle: 'refund-preference-toggle',
    preferenceValue: 'refund-preference-value',
    updatePreferenceBtn: 'refund-update-preference-btn',
    consentToggle: 'refund-consent-toggle',
    consentValue: 'refund-consent-value',
    updateConsentBtn: 'refund-update-consent-btn',
  },
  otherActions: {
    restorePurchasesBtn: 'other-restore-purchases-btn',
    updateCustomAttributionBtn: 'other-update-custom-attribution-btn',
    updateProviderAttributionBtn: (key: string | number) => `other-update-attribution-${key}-btn`,
    codeRedemptionBtn: 'other-code-redemption-btn',
    setLogLevelBtn: 'other-set-log-level-btn',
    setFallbackBtn: 'other-set-fallback-btn',
    installationStatusBtn: 'other-installation-status-btn',
    openAdaptyInAppBtn: 'other-open-adapty-in-app-btn',
    openAdaptyExternalBtn: 'other-open-adapty-external-btn',
    requestAppReviewBtn: 'other-request-app-review-btn',
    logoutBtn: 'other-logout-btn',
  },
  profileForm: {
    emailInput: 'profile-form-email-input',
    phoneInput: 'profile-form-phone-input',
    firstNameInput: 'profile-form-first-name-input',
    lastNameInput: 'profile-form-last-name-input',
    genderSelect: 'profile-form-gender-select',
    birthdayInput: 'profile-form-birthday-input',
    submitBtn: 'profile-form-submit-btn',
    resultValue: 'profile-form-result-value',
  },
  logs: {
    countValue: 'logs-count-value',
    filterSdkBtn: 'logs-filter-sdk-btn',
    filterAppBtn: 'logs-filter-app-btn',
    filterAllBtn: 'logs-filter-all-btn',
    exportBtn: 'logs-export-btn',
    clearBtn: 'logs-clear-btn',
    item: (key: string | number) => `logs-${key}-item`,
  },
  logDetails: {
    backBtn: 'log-back-btn',
    copyParamsBtn: 'log-copy-params-btn',
    levelValue: 'log-level-value',
    timeValue: 'log-time-value',
    functionValue: 'log-function-value',
    messageValue: 'log-message-value',
    stackTraceConsoleBtn: 'log-stack-trace-console-btn',
  },
  sdk: {
    activateBtn: 'sdk-activate-btn',
    activateObserverBtn: 'sdk-activate-observer-btn',
    checkStatusBtn: 'sdk-check-status-btn',
    adaptyAttributionToggle: 'sdk-adapty-attribution-toggle',
    adaptyAttributionValue: 'sdk-adapty-attribution-value',
  },
} as const;
