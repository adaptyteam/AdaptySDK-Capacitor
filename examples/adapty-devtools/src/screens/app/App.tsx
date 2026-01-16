import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  adapty,
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  FileLocation,
  RefundPreference,
  WebPresentation,
  ErrorCodeName,
  AdaptyError,
} from '@adapty/capacitor';
import { getApiKey, getIosBundle, getAndroidApplicationId, createLog } from '../../helpers';
import { useAppContext } from '../../contexts/AppContext';
import { useLogs } from '../../contexts/LogsContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import styles from './App.module.css';
import { OnboardingController, OnboardingControllerRef } from './controllers/OnboardingController';
import { PaywallController, PaywallControllerRef } from './controllers/PaywallController';
import { PaywallSection } from './sections/PaywallSection';
import { OnboardingSection } from './sections/OnboardingSection';

const App: React.FC = () => {
  // Get context state and actions
  const {
    // State
    isActivated,
    profile,
    paywall,
    products,
    onboarding,
    paywallView,
    customerUserId,
    transactionId,
    variationId,
    webPaywallUrl,
    integrationIdKey,
    integrationIdValue,
    collectingRefundDataConsent,
    refundPreferenceIdx,
    placementId,
    onboardingPlacementId,
    locale,
    timeout,
    maxAge,
    customTagsJson,
    fetchPolicyIndex,

    // Actions
    setIsActivated,
    setProfile,
    setPaywall,
    setProducts,
    setOnboarding,
    setPaywallView,
    setCustomerUserId,
    setTransactionId,
    setVariationId,
    setWebPaywallUrl,
    setIntegrationIdKey,
    setIntegrationIdValue,
    setCollectingRefundDataConsent,
    setRefundPreferenceIdx,
    setPlacementId,
    setOnboardingPlacementId,
    setLocale,
    setLoadTimeout,
    setMaxAge,
    setCustomTagsJson,
    setFetchPolicyIndex,
  } = useAppContext();

  const { append: appendLog } = useLogs();

  // Helper function for logging
  const log = (
    level: 'info' | 'error' | 'warn',
    message: string,
    funcName: string,
    isSDK: boolean = false,
    params: Record<string, any> = {},
  ) => {
    appendLog(createLog(level, message, funcName, isSDK, params));
  };

  // Local state for temporary/UI state that should not persist
  const [result, setResult] = useState<string>('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPaywall, setIsLoadingPaywall] = useState(false);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);

  const paywallRef = useRef<PaywallControllerRef>(null);
  const onboardingRef = useRef<OnboardingControllerRef>(null);

  const refundPreferences = [RefundPreference.NoPreference, RefundPreference.Grant, RefundPreference.Decline];

  const refundPreferenceLabels = ['No Preference', 'Grant', 'Decline'];

  const webPresentations = [WebPresentation.BrowserInApp, WebPresentation.BrowserOutApp] as const;
  const [webPaywallOpenInIdx, setWebPaywallOpenInIdx] = useState(0);
  const [onboardingExternalUrlsPresentationIdx, setOnboardingExternalUrlsPresentationIdx] = useState(0);

  const fetchPolicies = [
    'reload_revalidating_cache_data',
    'return_cache_data_else_load',
    'return_cache_data_if_not_expired_else_load',
  ] as const;

  const testActivate = async () => {
    try {
      setResult('Activating Adapty...');
      const trimmedCustomerUserId = customerUserId.trim();

      await adapty.activate({
        apiKey: getApiKey(),
        params: {
          // serverCluster: 'cn',
          // backendBaseUrl: 'http://localhost:8080',
          ...(trimmedCustomerUserId ? { customerUserId: trimmedCustomerUserId } : {}),
          logLevel: 'verbose',
          observerMode: false,
          __ignoreActivationOnFastRefresh: import.meta.env.DEV,
          // android: {
          //   adIdCollectionDisabled: true,
          //   pendingPrepaidPlansEnabled: false,
          //   localAccessLevelAllowed: false,
          //   obfuscatedAccountId: 'testObfAccId',
          // },
          // ios: {
          //   idfaCollectionDisabled: true,
          //   appAccountToken: '550e8400-e29b-41d4-a716-446655440000',
          //   clearDataOnBackup: true,
          // },
        },
      });
      const customerIdMessage = trimmedCustomerUserId ? ` customer user id: ${trimmedCustomerUserId}` : '';
      setResult(`Adapty activated successfully!${customerIdMessage}`);
      setIsActivated(true);

      // Fetch initial profile
      await fetchProfile();
    } catch (error) {
      setResult(`Activation Error: ${error}`);
      setIsActivated(false);
    }
  };

  const testIsActivated = async () => {
    try {
      const response = await adapty.isActivated();
      setResult(`Is Activated: ${response}`);
      setIsActivated(response);
    } catch (error) {
      setResult(`Error checking activation: ${error}`);
    }
  };

  const fetchProfile = async () => {
    if (!isActivated) return;

    setIsLoadingProfile(true);
    try {
      const profile = await adapty.getProfile();

      log('info', 'Profile fetched', 'getProfile', false, { profile });
      setProfile(profile);
      setResult('Profile fetched successfully');
    } catch (error) {
      log('error', 'Error fetching user profile', 'getProfile', false, { error: String(error) });
      setResult(`Error fetching profile: ${error}`);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchPaywall = async (forDefaultAudience: boolean = false) => {
    if (!isActivated) return;

    setIsLoadingPaywall(true);
    try {
      log('info', 'Fetching paywall', forDefaultAudience ? 'getPaywallForDefaultAudience' : 'getPaywall', false, {
        placementId,
        forDefaultAudience,
      });
      const fetchPolicy = fetchPolicies[fetchPolicyIndex];

      let paywall: AdaptyPaywall;

      if (forDefaultAudience) {
        // Create params based on fetch policy
        let params: any = { fetchPolicy };

        if (fetchPolicy === 'return_cache_data_if_not_expired_else_load') {
          params.maxAgeSeconds = parseFloat(maxAge);
        }

        paywall = await adapty.getPaywallForDefaultAudience({
          placementId: placementId,
          ...(locale ? { locale } : {}),
          params,
        });
      } else {
        // For regular getPaywall, add timeout support
        let params: any = { fetchPolicy };

        if (fetchPolicy === 'return_cache_data_if_not_expired_else_load') {
          params.maxAgeSeconds = parseFloat(maxAge);
        }

        params.loadTimeoutMs = parseFloat(timeout);

        paywall = await adapty.getPaywall({
          placementId: placementId,
          ...(locale ? { locale } : {}),
          params,
        });
      }

      log('info', 'Paywall fetched', forDefaultAudience ? 'getPaywallForDefaultAudience' : 'getPaywall', false, {
        paywall,
        forDefaultAudience,
      });
      setPaywall(paywall);

      // Fetch products
      const productsResult = await adapty.getPaywallProducts({ paywall });
      setProducts(productsResult);

      const audienceType = forDefaultAudience ? 'for default audience' : '';
      setResult(`Paywall loaded ${audienceType}: ${paywall.name}`);
    } catch (error) {
      log(
        'error',
        'Error fetching paywall',
        forDefaultAudience ? 'getPaywallForDefaultAudience' : 'getPaywall',
        false,
        { error: String(error), forDefaultAudience },
      );

      if (error instanceof AdaptyError) {
        switch (error.adaptyCode) {
          case ErrorCodeName.notActivated:
            setResult('SDK not activated. Please activate first');
            break;
          case ErrorCodeName.networkFailed:
            setResult('Network error. Check your connection and try again');
            break;
          case ErrorCodeName.fetchTimeoutError:
            setResult('Request timeout. Please try again');
            break;
          case ErrorCodeName.serverError:
            setResult('Server error. Please try again later');
            break;
          default:
            setResult(`Error fetching paywall: ${error.localizedDescription}`);
        }
      } else {
        setResult(`Error fetching paywall: ${error}`);
      }
    } finally {
      setIsLoadingPaywall(false);
    }
  };

  const restorePurchases = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Restoring purchases', 'restorePurchases');
      const profile = await adapty.restorePurchases();
      setProfile(profile);
      setResult('Purchases restored successfully');
    } catch (error) {
      log('error', 'Error restoring purchases', 'restorePurchases', false, { error: String(error) });

      if (error instanceof AdaptyError) {
        switch (error.adaptyCode) {
          case ErrorCodeName.noPurchasesToRestore:
            setResult('No purchases found to restore');
            break;
          case ErrorCodeName.notActivated:
            setResult('SDK not activated. Please activate first');
            break;
          case ErrorCodeName.networkFailed:
            setResult('Network error. Check your connection and try again');
            break;
          default:
            setResult(`Error restoring purchases: ${error.localizedDescription}`);
        }
      } else {
        setResult(`Error restoring purchases: ${error}`);
      }
    }
  };

  const updateAttribution = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Updating attribution', 'updateAttribution', false, {
        source: 'custom',
        attribution: {
          status: 'non_organic',
          channel: 'Google Ads',
          campaign: 'Adapty Web Test',
          ad_group: 'adapty ad_group',
          creative: 'test_creative',
        },
      });
      await adapty.updateAttribution({
        attribution: {
          status: 'non_organic',
          channel: 'Google Ads',
          campaign: 'Adapty Web Test',
          ad_group: 'adapty ad_group',
          creative: 'test_creative',
        },
        source: 'custom',
      });
      setResult('Attribution updated successfully');
    } catch (error) {
      log('error', 'Error updating attribution', 'updateAttribution', false, {
        error: String(error),
        source: 'custom',
      });
      setResult(`Error updating attribution: ${error}`);
    }
  };

  const createWebPaywallUrl = async () => {
    if (!paywall) {
      setResult('Error: Paywall not loaded. Please load paywall first.');
      return;
    }

    try {
      log('info', 'Creating web paywall URL', 'createWebPaywallUrl');
      const url = await adapty.createWebPaywallUrl({ paywallOrProduct: paywall });
      setWebPaywallUrl(url);
      setResult(`Web paywall URL created: ${url}`);
      log('info', 'Web paywall URL created', 'createWebPaywallUrl', false, { url });
    } catch (error) {
      log('error', 'Error creating web paywall URL', 'createWebPaywallUrl', false, { error: String(error) });
      setResult(`Error creating web paywall URL: ${error}`);
      setWebPaywallUrl('');
    }
  };

  const logPaywallShown = async () => {
    if (!paywall) {
      setResult('Error: Paywall not loaded. Please load paywall first.');
      return;
    }

    try {
      log('info', 'Logging custom paywall shown', 'logShowPaywall', true, { paywallId: paywall.name });
      await adapty.logShowPaywall({ paywall });
      setResult('Paywall shown event logged');
    } catch (error) {
      log('error', 'Error logging paywall shown', 'logShowPaywall', false, { error: String(error) });
      setResult(`Error logging paywall shown: ${error}`);
    }
  };

  const openWebPaywall = async () => {
    if (!paywall) {
      setResult('Error: Paywall not loaded. Please load paywall first.');
      return;
    }

    try {
      const openIn = webPresentations[webPaywallOpenInIdx];
      log('info', 'Opening web paywall', 'openWebPaywall', false, { openIn });
      await adapty.openWebPaywall({ paywallOrProduct: paywall, openIn });
      setResult('Web paywall opened successfully');
    } catch (error) {
      log('error', 'Error opening web paywall', 'openWebPaywall', false, { error: String(error) });
      setResult(`Error opening web paywall: ${error}`);
    }
  };

  const createWebPaywallUrlForProduct = async (product: AdaptyPaywallProduct) => {
    try {
      log('info', 'Creating web paywall URL for product', 'createWebPaywallUrl', false, {
        productId: product.vendorProductId,
      });
      const url = await adapty.createWebPaywallUrl({ paywallOrProduct: product });
      setResult(`Web URL for ${product.vendorProductId}: ${url}`);
      alert(`Web paywall URL for ${product.vendorProductId}: ${url}`);
      log('info', 'Web paywall URL for product created', 'createWebPaywallUrl', false, {
        url,
        productId: product.vendorProductId,
      });
    } catch (error) {
      log('error', 'Error creating web paywall URL for product', 'createWebPaywallUrl', false, {
        error: String(error),
        productId: product.vendorProductId,
      });
      setResult(`Error creating web URL for product: ${error}`);
    }
  };

  const openWebPaywallForProduct = async (product: AdaptyPaywallProduct) => {
    try {
      const openIn = webPresentations[webPaywallOpenInIdx];
      log('info', 'Opening web paywall for product', 'openWebPaywall', false, {
        productId: product.vendorProductId,
        openIn,
      });
      await adapty.openWebPaywall({ paywallOrProduct: product, openIn });
      setResult(`Web paywall opened for: ${product.vendorProductId}`);
    } catch (error) {
      log('error', 'Error opening web paywall for product', 'openWebPaywall', false, {
        error: String(error),
        productId: product.vendorProductId,
      });
      setResult(`Error opening web paywall for product: ${error}`);
    }
  };

  const makePurchase = async (product: AdaptyPaywallProduct) => {
    if (!isActivated) return;

    try {
      log('info', 'Making purchase', 'makePurchase', false, { productId: product.vendorProductId, product });
      const result = await adapty.makePurchase({ product });

      const purchaseResult = result;

      if (purchaseResult.type === 'success') {
        const transactionData: any = {};

        if (purchaseResult.ios?.jwsTransaction) {
          transactionData.iosJwsTransaction = purchaseResult.ios.jwsTransaction;
          log('info', 'iOS JWS Transaction received', 'makePurchase', false, {
            jwsTransaction: purchaseResult.ios.jwsTransaction,
          });
        }

        if (purchaseResult.android?.purchaseToken) {
          transactionData.androidPurchaseToken = purchaseResult.android.purchaseToken;
          log('info', 'Android Purchase Token received', 'makePurchase', false, {
            purchaseToken: purchaseResult.android.purchaseToken,
          });
        }

        log('info', 'Purchase completed successfully', 'makePurchase', false, {
          productId: product.vendorProductId,
          ...transactionData,
        });
        setProfile(purchaseResult.profile);
      } else if (purchaseResult.type === 'user_cancelled') {
        setResult('Purchase cancelled by user');
      } else if (purchaseResult.type === 'pending') {
        setResult('Purchase is pending');
      } else {
        setResult(`Purchase result: ${purchaseResult.type}`);
      }
    } catch (error) {
      log('error', 'Error making purchase', 'makePurchase', false, { error: String(error) });

      if (error instanceof AdaptyError) {
        switch (error.adaptyCode) {
          case ErrorCodeName.cantMakePayments:
            setResult('In-app purchases not allowed on this device');
            break;
          case ErrorCodeName.productPurchaseFailed:
            setResult(`Purchase failed: ${error.localizedDescription}`);
            break;
          case ErrorCodeName.itemAlreadyOwned:
            setResult('You already own this product');
            break;
          case ErrorCodeName.paymentNotAllowed:
            setResult('Payment not allowed for this account');
            break;
          default:
            setResult(`Error making purchase: ${error.localizedDescription}`);
        }
      } else {
        setResult(`Error making purchase: ${error}`);
      }
    }
  };

  const logout = async () => {
    try {
      log('info', 'Logging out', 'logout');
      await adapty.logout();
      setProfile(null);
      setPaywall(null);
      setProducts([]);
      setOnboarding(null);
      setResult('Logged out successfully');
    } catch (error) {
      log('error', 'Error logging out', 'logout', false, { error: String(error) });
      setResult(`Error logging out: ${error}`);
    }
  };

  const formatDate = (date?: Date | string): string => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getAccessLevel = () => {
    return profile?.accessLevels?.['premium'];
  };

  const presentPaywall = async () => {
    await paywallRef.current?.presentPaywall();
  };

  const presentExistingPaywall = async () => {
    if (!paywallView) {
      setResult('❌ No paywall view created. Please create paywall first.');
      return;
    }

    try {
      setResult('Presenting existing paywall view...');
      await paywallView.present();
      setResult('✅ Existing paywall presented successfully!');
    } catch (error: any) {
      log('error', 'Failed to present existing paywall', 'presentExistingPaywall', false, {
        error: error.message || error.toString(),
      });
      setResult(`❌ Failed to present existing paywall: ${error.message}`);
    }
  };

  const presentOnboarding = async () => {
    await onboardingRef.current?.presentOnboarding();
  };

  const renderIdentifySection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Identify User</h3>
        <div className={styles.InputGroup}>
          <input
            type="text"
            value={customerUserId}
            onChange={(e) => setCustomerUserId(e.target.value)}
            placeholder="customer user ID"
            className={styles.Input}
          />
          <button
            onClick={identify}
            disabled={!customerUserId.trim()}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Identify User
          </button>
        </div>
      </div>
    );
  };

  const renderIntegrationSection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Integration Identifiers</h3>
        <div className={styles.InputGroup}>
          <input
            type="text"
            value={integrationIdKey}
            onChange={(e) => setIntegrationIdKey(e.target.value)}
            placeholder="Integration Key (e.g., one_signal_subscription_id)"
            className={styles.Input}
          />
          <input
            type="text"
            value={integrationIdValue}
            onChange={(e) => setIntegrationIdValue(e.target.value)}
            placeholder="Integration Value"
            className={styles.Input}
          />
          <button
            onClick={setIntegrationId}
            disabled={!isActivated || !integrationIdKey.trim() || !integrationIdValue.trim()}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Set Integration ID
          </button>
        </div>
      </div>
    );
  };

  const renderRefundDataSection = () => {
    const platform = Capacitor.getPlatform();
    const isIOS = platform === 'ios';

    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Refund Saver (iOS only)</h3>
        {!isIOS && (
          <div className={styles.InfoBox} style={{ marginBottom: '10px' }}>
            <div className={styles.InfoBoxItem}>
              <strong>⚠️ Not available on {platform}</strong>
            </div>
          </div>
        )}

        {/* Refund Preference */}
        {isIOS && (
          <div className={styles.RefundItem}>
            <label>Refund Preference:</label>
            <div
              className={styles.ClickableParam}
              onClick={() => {
                if (isIOS) {
                  setRefundPreferenceIdx((refundPreferenceIdx + 1) % refundPreferences.length);
                }
              }}
            >
              <span>{refundPreferenceLabels[refundPreferenceIdx]}</span>
              <span className={styles.ParamValue}>{refundPreferences[refundPreferenceIdx]}</span>
            </div>
            <button
              onClick={updateRefundPreference}
              disabled={!isActivated || !isIOS}
              className={`${styles.Button} ${styles.ButtonSecondary} ${styles.RefundButton}`}
            >
              Update Refund Preference
            </button>
          </div>
        )}

        {/* Collecting Refund Data Consent */}
        {isIOS && (
          <div className={styles.RefundItem}>
            <label>Collecting Refund Data Consent:</label>
            <div
              className={styles.ClickableParam}
              onClick={() => {
                if (isIOS) {
                  setCollectingRefundDataConsent(!collectingRefundDataConsent);
                }
              }}
            >
              <span>Consent</span>
              <span className={styles.ParamValue}>{collectingRefundDataConsent.toString()}</span>
            </div>
            <button
              onClick={updateRefundDataConsent}
              disabled={!isActivated || !isIOS}
              className={`${styles.Button} ${styles.ButtonSecondary} ${styles.RefundButton}`}
            >
              Update Collecting Refund Data Consent
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderProfileSection = () => {
    const accessLevel = getAccessLevel();

    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Profile Information</h3>
        <div className={styles.InfoBox}>
          <div className={styles.InfoBoxItem}>
            <strong>Profile ID:</strong> {profile?.profileId || 'Not loaded'}
          </div>
          {accessLevel ? (
            <div>
              <div>
                <strong>Premium:</strong> {accessLevel.isActive ? '✅ Active' : '❌ Not Active'}
              </div>
              <div>
                <strong>Is Lifetime:</strong> {accessLevel.isLifetime ? '✅ Yes' : '❌ No'}
              </div>
              <div>
                <strong>Activated At:</strong> {formatDate(accessLevel.activatedAt)}
              </div>
              <div>
                <strong>Expires At:</strong> {formatDate(accessLevel.expiresAt)}
              </div>
              <div>
                <strong>Will Renew:</strong> {accessLevel.willRenew ? '✅ Yes' : '❌ No'}
              </div>
            </div>
          ) : (
            <div>
              <strong>Status:</strong> No active subscriptions
            </div>
          )}
        </div>
        <button
          onClick={fetchProfile}
          disabled={isLoadingProfile}
          className={`${styles.Button} ${styles.ButtonPrimary} ${isLoadingProfile ? styles.Loading : ''}`}
        >
          {isLoadingProfile ? 'Loading...' : 'Refresh Profile'}
        </button>
      </div>
    );
  };

  const renderPaywallSection = () => (
    <PaywallSection
      isActivated={isActivated}
      isLoadingPaywall={isLoadingPaywall}
      paywall={paywall}
      products={products}
      placementId={placementId}
      locale={locale}
      timeout={timeout}
      maxAge={maxAge}
      customTagsJson={customTagsJson}
      fetchPolicyIndex={fetchPolicyIndex}
      fetchPolicies={fetchPolicies}
      webPaywallOpenInIdx={webPaywallOpenInIdx}
      webPresentations={webPresentations}
      paywallView={paywallView}
      webPaywallUrl={webPaywallUrl}
      setPlacementId={setPlacementId}
      setLocale={setLocale}
      setLoadTimeout={setLoadTimeout}
      setMaxAge={setMaxAge}
      setCustomTagsJson={setCustomTagsJson}
      setFetchPolicyIndex={setFetchPolicyIndex}
      setWebPaywallOpenInIdx={setWebPaywallOpenInIdx}
      fetchPaywall={fetchPaywall}
      presentPaywall={presentPaywall}
      presentExistingPaywall={presentExistingPaywall}
      logPaywallShown={logPaywallShown}
      openWebPaywall={openWebPaywall}
      createWebPaywallUrl={createWebPaywallUrl}
      makePurchase={makePurchase}
      openWebPaywallForProduct={openWebPaywallForProduct}
      createWebPaywallUrlForProduct={createWebPaywallUrlForProduct}
    />
  );

  const renderOnboardingSection = () => (
    <OnboardingSection
      isActivated={isActivated}
      isLoadingOnboarding={isLoadingOnboarding}
      onboarding={onboarding}
      onboardingPlacementId={onboardingPlacementId}
      locale={locale}
      timeout={timeout}
      maxAge={maxAge}
      fetchPolicyIndex={fetchPolicyIndex}
      fetchPolicies={fetchPolicies}
      onboardingExternalUrlsPresentationIdx={onboardingExternalUrlsPresentationIdx}
      webPresentations={webPresentations}
      setOnboardingPlacementId={setOnboardingPlacementId}
      setLocale={setLocale}
      setLoadTimeout={setLoadTimeout}
      setMaxAge={setMaxAge}
      setFetchPolicyIndex={setFetchPolicyIndex}
      setOnboardingExternalUrlsPresentationIdx={setOnboardingExternalUrlsPresentationIdx}
      fetchOnboarding={fetchOnboarding}
      presentOnboarding={presentOnboarding}
    />
  );

  const presentCodeRedemptionSheet = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Presenting code redemption sheet (iOS only)', 'presentCodeRedemptionSheet');
      await adapty.presentCodeRedemptionSheet();
      setResult('Code redemption sheet presented successfully (iOS only)');
    } catch (error) {
      log('error', 'Error presenting code redemption sheet', 'presentCodeRedemptionSheet', false, {
        error: String(error),
      });
      setResult(`Error presenting code redemption sheet: ${error}`);
    }
  };

  const identify = async () => {
    if (!customerUserId.trim()) {
      setResult('Error: Customer User ID is required');
      return;
    }

    try {
      log('info', 'Identifying user', 'identify', false, { customerUserId });
      if (isActivated) {
        // You can optionally pass identity parameters:
        // await adapty.identify({
        //   customerUserId: customerUserId.trim(),
        //   params: {
        //     ios: {
        //       appAccountToken: '550e8400-e29b-41d4-a716-446655440000' // Test UUID matching activate
        //     },
        //     android: {
        //       obfuscatedAccountId: 'test-obfuscated-account-id-12345' // Test obfuscated ID matching activate
        //     }
        //   }
        // });
        await adapty.identify({ customerUserId: customerUserId.trim() });
        setResult(`User identified successfully with ID: ${customerUserId.trim()}`);
        await fetchProfile();
      } else {
        setResult('Customer user Id will be set on activation');
      }
    } catch (error) {
      log('error', 'Error identifying user', 'identify', false, { error: String(error), customerUserId });
      setResult(`Error identifying user: ${error}`);
    }
  };

  const fetchOnboarding = async (forDefaultAudience: boolean = false) => {
    if (!isActivated) return;

    setIsLoadingOnboarding(true);
    try {
      log(
        'info',
        'Fetching onboarding',
        forDefaultAudience ? 'getOnboardingForDefaultAudience' : 'getOnboarding',
        false,
        { onboardingPlacementId, forDefaultAudience },
      );
      const fetchPolicy = fetchPolicies[fetchPolicyIndex];

      let onboardingResult: AdaptyOnboarding;

      if (forDefaultAudience) {
        let params: any = { fetchPolicy };
        if (fetchPolicy === 'return_cache_data_if_not_expired_else_load') {
          params.maxAgeSeconds = parseFloat(maxAge);
        }

        onboardingResult = await adapty.getOnboardingForDefaultAudience({
          placementId: onboardingPlacementId,
          ...(locale ? { locale } : {}),
          params,
        });
      } else {
        let params: any = { fetchPolicy };
        if (fetchPolicy === 'return_cache_data_if_not_expired_else_load') {
          params.maxAgeSeconds = parseFloat(maxAge);
        }
        params.loadTimeoutMs = parseFloat(timeout);

        onboardingResult = await adapty.getOnboarding({
          placementId: onboardingPlacementId,
          ...(locale ? { locale } : {}),
          params,
        });
      }

      setOnboarding(onboardingResult);

      const audienceType = forDefaultAudience ? 'for default audience' : '';
      setResult(`Onboarding loaded ${audienceType}: ${onboardingResult.name}`);
    } catch (error) {
      log(
        'error',
        'Error fetching onboarding',
        forDefaultAudience ? 'getOnboardingForDefaultAudience' : 'getOnboarding',
        false,
        { error: String(error), onboardingPlacementId, forDefaultAudience },
      );
      setResult(`Error fetching onboarding: ${error}`);
    } finally {
      setIsLoadingOnboarding(false);
    }
  };

  const setLogLevel = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Setting log level to verbose', 'setLogLevel');
      await adapty.setLogLevel({ logLevel: 'verbose' });
      setResult('Log level set to verbose successfully');
    } catch (error) {
      log('error', 'Error setting log level', 'setLogLevel', false, { error: String(error) });
      setResult(`Error setting log level: ${error}`);
    }
  };

  const setIntegrationId = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Setting integration identifier', 'setIntegrationIdentifier', false, {
        key: integrationIdKey,
        value: integrationIdValue,
      });
      await adapty.setIntegrationIdentifier({ key: integrationIdKey, value: integrationIdValue });
      setResult(`Integration identifier set successfully: ${integrationIdKey} = ${integrationIdValue}`);
    } catch (error) {
      log('error', 'Error setting integration identifier', 'setIntegrationIdentifier', false, {
        error: String(error),
        key: integrationIdKey,
        value: integrationIdValue,
      });
      setResult(`Error setting integration identifier: ${error}`);
    }
  };

  const updateRefundDataConsent = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Updating collecting refund data consent', 'updateCollectingRefundDataConsent', false, {
        consent: collectingRefundDataConsent,
      });
      await adapty.updateCollectingRefundDataConsent({ consent: collectingRefundDataConsent });
      setResult(`Collecting refund data consent updated successfully: ${collectingRefundDataConsent}`);
    } catch (error) {
      log('error', 'Error updating collecting refund data consent', 'updateCollectingRefundDataConsent', false, {
        error: String(error),
        consent: collectingRefundDataConsent,
      });
      setResult(`Error updating collecting refund data consent: ${error}`);
    }
  };

  const updateRefundPreference = async () => {
    if (!isActivated) return;

    try {
      const refundPreference = refundPreferences[refundPreferenceIdx];
      log('info', 'Updating refund preference', 'updateRefundPreference', false, { preference: refundPreference });
      await adapty.updateRefundPreference({ refundPreference });
      setResult(`Refund preference updated successfully: ${refundPreference}`);
    } catch (error) {
      log('error', 'Error updating refund preference', 'updateRefundPreference', false, {
        error: String(error),
        preference: refundPreferences,
      });
      setResult(`Error updating refund preference: ${error}`);
    }
  };

  const testSetFallback = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Setting fallback paywalls', 'setFallback');

      const fileLocation: FileLocation = {
        ios: {
          fileName: 'ios_fallback.json',
        },
        android: {
          relativeAssetPath: 'android_fallback.json',
        },
      };

      await adapty.setFallback({ fileLocation });
      setResult('Fallback paywalls set successfully');
      log('info', 'Fallback paywalls set successfully', 'setFallback');
    } catch (error) {
      log('error', 'Error setting fallback paywalls', 'setFallback', false, { error: String(error) });
      setResult(`Error setting fallback paywalls: ${error}`);
    }
  };

  const renderReportTransactionSection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Report Transaction</h3>
        <div className={styles.InputGroup}>
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Transaction ID (required)"
            className={styles.Input}
            disabled={!isActivated}
          />
          <input
            type="text"
            value={variationId}
            onChange={(e) => setVariationId(e.target.value)}
            placeholder="Variation ID (optional)"
            className={styles.Input}
            disabled={!isActivated}
          />
          <button
            onClick={reportTransaction}
            disabled={!isActivated || !transactionId.trim()}
            className={`${styles.Button} ${styles.ButtonPrimary}`}
          >
            Report Transaction
          </button>
        </div>
      </div>
    );
  };

  const renderOtherActionsSection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Other Actions</h3>
        <div className={styles.ButtonGroup}>
          <button
            onClick={restorePurchases}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonPrimary}`}
          >
            Restore Purchases
          </button>
          <button
            onClick={updateAttribution}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Update Attribution
          </button>
        </div>
        <div className={styles.ButtonGroup}>
          <button
            onClick={presentCodeRedemptionSheet}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Code Redemption (iOS)
          </button>
          <button
            onClick={setLogLevel}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Set Log Level
          </button>
        </div>
        <div className={styles.ButtonGroup}>
          <button
            onClick={testSetFallback}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Set Fallback Paywalls
          </button>
          <button
            onClick={getCurrentInstallationStatus}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            Get Installation Status
          </button>
        </div>
        <div className={styles.ButtonGroup}>
          <button onClick={logout} disabled={!isActivated} className={`${styles.Button} ${styles.ButtonDanger}`}>
            Logout
          </button>
        </div>
      </div>
    );
  };

  const reportTransaction = async () => {
    if (!isActivated || !transactionId.trim()) {
      setResult('Error: Transaction ID is required');
      return;
    }

    try {
      log('info', 'Reporting transaction', 'reportTransaction', false, { transactionId, variationId });
      await adapty.reportTransaction({
        transactionId: transactionId.trim(),
        ...(variationId.trim() ? { variationId: variationId.trim() } : {}),
      });
      setResult(`Transaction reported successfully: ${transactionId.trim()}`);
    } catch (error) {
      log('error', 'Error reporting transaction', 'reportTransaction', false, {
        error: String(error),
        transactionId,
        variationId,
      });
      setResult(`Error reporting transaction: ${error}`);
    }
  };

  const getCurrentInstallationStatus = async () => {
    if (!isActivated) return;

    try {
      log('info', 'Getting current installation status', 'getCurrentInstallationStatus');
      const installationStatus = await adapty.getCurrentInstallationStatus();
      log('info', 'Installation status updated', 'getCurrentInstallationStatus', false, { installationStatus });
      setResult(`Installation status: ${JSON.stringify(installationStatus, null, 2)}`);

      await showSuccessToast('Installation status updated successfully!');
    } catch (error) {
      log('error', 'Error getting installation status', 'getCurrentInstallationStatus', false, {
        error: String(error),
      });
      setResult(`Error getting installation status: ${error}`);

      await showErrorToast('Failed to get installation status');
    }
  };

  return (
    <div className={styles.AppContainer}>
      <PaywallController
        ref={paywallRef}
        paywall={paywall}
        customTagsJson={customTagsJson}
        setPaywallView={setPaywallView}
        setResult={setResult}
        log={log}
      />
      <OnboardingController
        ref={onboardingRef}
        onboarding={onboarding}
        externalUrlsPresentation={webPresentations[onboardingExternalUrlsPresentationIdx]}
        canShowPaywall={() => Boolean(paywall?.hasViewConfiguration)}
        showPaywall={presentPaywall}
        setResult={setResult}
        log={log}
      />
      <main>
        <h1 className={styles.Title}>Adapty Capacitor Devtools</h1>
        <p className={styles.Description}>Devtools app for adapty plugin API.</p>

        {/* Credentials Info */}
        <div className={styles.Section}>
          <h3 className={styles.SectionTitle}>Configuration from .adapty-credentials.json file</h3>
          <div className={styles.InfoBox}>
            <div className={styles.InfoBoxItem}>
              <strong>API Key:</strong> {getApiKey() ? `${getApiKey().substring(0, 20)}...` : 'Not loaded'}
            </div>
            <div className={styles.InfoBoxItem}>
              <strong>iOS Bundle ID:</strong> {getIosBundle()}
            </div>
            <div className={styles.InfoBoxItem}>
              <strong>Android Application ID:</strong> {getAndroidApplicationId()}
            </div>
          </div>
        </div>

        {renderIdentifySection()}

        {/* Activation Section */}
        <div className={styles.Section}>
          <h3 className={styles.SectionTitle}>SDK Activation</h3>
          <button
            onClick={testActivate}
            className={`${styles.Button} ${isActivated ? styles.ButtonSuccess : styles.ButtonPrimary}`}
          >
            {isActivated ? 'Activated' : 'Activate Adapty'}
          </button>
          <button
            onClick={testIsActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
            style={{ marginLeft: '10px' }}
          >
            Check Status
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`${styles.ResultBox} ${result.startsWith('Error') ? styles.ResultBoxError : styles.ResultBoxSuccess}`}
          >
            {result}
          </div>
        )}

        {/* Events Section */}
        {isActivated && (
          <div className={styles.Section}>
            <h3 className={styles.SectionTitle}>Event Listeners</h3>
            <p>Events will appear in Logs tab</p>
          </div>
        )}

        {/* Profile Section */}
        {isActivated && renderProfileSection()}

        {/* Paywall Section */}
        {isActivated && renderPaywallSection()}

        {/* Onboarding Section */}
        {isActivated && renderOnboardingSection()}

        {/* Report Transaction Section */}
        {isActivated && renderReportTransactionSection()}

        {/* Integration Section */}
        {isActivated && renderIntegrationSection()}

        {/* Refund Data Section */}
        {isActivated && renderRefundDataSection()}

        {/* Other Actions Section */}
        {isActivated && renderOtherActionsSection()}

        {/* Configuration Info */}
        <div className={styles.ConfigSection}>
          <h3 className={styles.ConfigTitle}>SDK Status:</h3>
          <ul className={styles.ConfigList}>
            <li>Status: {isActivated ? '✅ Activated' : '❌ Not activated'}</li>
            <li>Profile Loaded: {profile ? '✅ Yes' : '❌ No'}</li>
            <li>Paywall Loaded: {paywall ? '✅ Yes' : '❌ No'}</li>
            <li>Onboarding Loaded: {onboarding ? '✅ Yes' : '❌ No'}</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default App;
