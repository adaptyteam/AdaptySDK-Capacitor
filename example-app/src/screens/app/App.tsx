import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  adapty,
  AdaptyProfile,
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  createPaywallView,
  FileLocation,
  RefundPreference,
} from '@adapty/capacitor';
import { getApiKey, getPlacementId, getIosBundle, getAndroidApplicationId, getOnboardingPlacementId } from '../../helpers';
import styles from './App.module.css';

const App: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [isActivated, setIsActivated] = useState(false);
  const [profile, setProfile] = useState<AdaptyProfile | null>(null);
  const [paywall, setPaywall] = useState<AdaptyPaywall | null>(null);
  const [products, setProducts] = useState<AdaptyPaywallProduct[]>([]);
  const [onboarding, setOnboarding] = useState<AdaptyOnboarding | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPaywall, setIsLoadingPaywall] = useState(false);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);
  const [customerUserId, setCustomerUserId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [variationId, setVariationId] = useState<string>('');
  const [webPaywallUrl, setWebPaywallUrl] = useState<string>('');
  const [integrationIdKey, setIntegrationIdKey] = useState<string>('one_signal_subscription_id');
  const [integrationIdValue, setIntegrationIdValue] = useState<string>('testOSSubId');
  const [collectingRefundDataConsent, setCollectingRefundDataConsent] = useState<boolean>(false);
  const [refundPreferenceIdx, setRefundPreferenceIdx] = useState<number>(0);

  const refundPreferences = [
    RefundPreference.NoPreference,
    RefundPreference.Grant,
    RefundPreference.Decline,
  ];

  const refundPreferenceLabels = [
    'No Preference',
    'Grant',
    'Decline',
  ];

  // Paywall extended configuration
  const [placementId, setPlacementId] = useState<string>(getPlacementId());
  const [onboardingPlacementId, setOnboardingPlacementId] = useState<string>(getOnboardingPlacementId());
  const [locale, setLocale] = useState<string>('');
  const [timeout, setTimeout] = useState<string>('6000');
  const [maxAge, setMaxAge] = useState<string>('120');
  const [customTagsJson, setCustomTagsJson] = useState<string>('{"USERNAME":"TestUser","CITY":"Capacitor"}');
  const [fetchPolicyIndex, setFetchPolicyIndex] = useState<number>(0);

  const fetchPolicies = [
    'reload_revalidating_cache_data',
    'return_cache_data_else_load',
    'return_cache_data_if_not_expired_else_load'
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
        }
      });
      const customerIdMessage = trimmedCustomerUserId ? ` customer user id: ${trimmedCustomerUserId}` : '';
      setResult(`Adapty activated successfully!${customerIdMessage}`);
      setIsActivated(true);

      // Add event listener for profile updates
      adapty.addListener('onLatestProfileLoad', (data) => {
        console.log('NEW PROFILE EVENT', data);
        setProfile(data.profile);
      });

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
      console.log('[ADAPTY] Fetching user profile...');
      const profile = await adapty.getProfile();

      console.log('[ADAPTY] Profile fetched:', profile);
      setProfile(profile);
      setResult('Profile fetched successfully');
    } catch (error) {
      console.error('[ADAPTY] Error fetching user profile', error);
      setResult(`Error fetching profile: ${error}`);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchPaywall = async (forDefaultAudience: boolean = false) => {
    if (!isActivated) return;

    setIsLoadingPaywall(true);
    try {
      console.log('[ADAPTY] Fetching paywall:', placementId);
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

      console.log('[ADAPTY] Paywall fetched:', paywall);
      setPaywall(paywall);

      // Log show paywall
      await adapty.logShowPaywall({ paywall });

      // Fetch products
      const productsResult = await adapty.getPaywallProducts({ paywall });
      setProducts(productsResult);

      const audienceType = forDefaultAudience ? 'for default audience' : '';
      setResult(`Paywall loaded ${audienceType}: ${paywall.name}`);
    } catch (error) {
      console.error('[ADAPTY] Error fetching paywall', error);
      setResult(`Error fetching paywall: ${error}`);
    } finally {
      setIsLoadingPaywall(false);
    }
  };

  const restorePurchases = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Restoring purchases...');
      const profile = await adapty.restorePurchases();
      setProfile(profile);
      setResult('Purchases restored successfully');
    } catch (error) {
      console.error('[ADAPTY] Error restoring purchases', error);
      setResult(`Error restoring purchases: ${error}`);
    }
  };


  const updateAttribution = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Updating attribution...');
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
      console.error('[ADAPTY] Error updating attribution', error);
      setResult(`Error updating attribution: ${error}`);
    }
  };

  const createWebPaywallUrl = async () => {
    if (!paywall) {
      setResult('Error: Paywall not loaded. Please load paywall first.');
      return;
    }

    try {
      console.log('[ADAPTY] Creating web paywall URL...');
      const url = await adapty.createWebPaywallUrl({ paywallOrProduct: paywall });
      setWebPaywallUrl(url);
      setResult(`Web paywall URL created: ${url}`);
      console.log('[ADAPTY] Web paywall URL:', url);
    } catch (error) {
      console.error('[ADAPTY] Error creating web paywall URL', error);
      setResult(`Error creating web paywall URL: ${error}`);
      setWebPaywallUrl('');
    }
  };

  const openWebPaywall = async () => {
    if (!paywall) {
      setResult('Error: Paywall not loaded. Please load paywall first.');
      return;
    }

    try {
      console.log('[ADAPTY] Opening web paywall...');
      await adapty.openWebPaywall({ paywallOrProduct: paywall });
      setResult('Web paywall opened successfully');
    } catch (error) {
      console.error('[ADAPTY] Error opening web paywall', error);
      setResult(`Error opening web paywall: ${error}`);
    }
  };

  const createWebPaywallUrlForProduct = async (product: AdaptyPaywallProduct) => {
    try {
      console.log('[ADAPTY] Creating web paywall URL for product:', product.vendorProductId);
      const url = await adapty.createWebPaywallUrl({ paywallOrProduct: product });
      setResult(`Web URL for ${product.vendorProductId}: ${url}`);
      alert(`Web paywall URL for ${product.vendorProductId}: ${url}`);
      console.log('[ADAPTY] Web paywall URL for product:', url);
    } catch (error) {
      console.error('[ADAPTY] Error creating web paywall URL for product', error);
      setResult(`Error creating web URL for product: ${error}`);
    }
  };

  const openWebPaywallForProduct = async (product: AdaptyPaywallProduct) => {
    try {
      console.log('[ADAPTY] Opening web paywall for product:', product.vendorProductId);
      await adapty.openWebPaywall({ paywallOrProduct: product });
      setResult(`Web paywall opened for: ${product.vendorProductId}`);
    } catch (error) {
      console.error('[ADAPTY] Error opening web paywall for product', error);
      setResult(`Error opening web paywall for product: ${error}`);
    }
  };

  const makePurchase = async (product: AdaptyPaywallProduct) => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Making purchase...', product.vendorProductId);
      const result = await adapty.makePurchase({ product });

      const purchaseResult = result;

      if (purchaseResult.type === 'success') {
        setResult(`Purchase successful: ${product.vendorProductId}`);
        setProfile(purchaseResult.profile);
      } else if (purchaseResult.type === 'user_cancelled') {
        setResult('Purchase cancelled by user');
      } else if (purchaseResult.type === 'pending') {
        setResult('Purchase is pending');
      } else {
        setResult(`Purchase result: ${purchaseResult.type}`);
      }
    } catch (error) {
      console.error('[ADAPTY] Error making purchase', error);
      setResult(`Error making purchase: ${error}`);
    }
  };

  const logout = async () => {
    try {
      console.log('[ADAPTY] Logging out...');
      await adapty.logout();
      setProfile(null);
      setPaywall(null);
      setProducts([]);
      setOnboarding(null);
      setResult('Logged out successfully');
    } catch (error) {
      console.error('[ADAPTY] Error logging out', error);
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
    if (!paywall) {
      setResult('❌ No paywall loaded. Please load paywall first.');
      return;
    }

    if (!paywall.hasViewConfiguration) {
      setResult('❌ Paywall does not have view configuration (no Paywall Builder).');
      return;
    }

    try {
      setResult('Creating paywall view...');

      let customTags: Record<string, string>;
      try {
        customTags = JSON.parse(customTagsJson);
      } catch (error) {
        customTags = {};
        console.warn('[ADAPTY] Invalid custom tags JSON, using empty object:', error);
      }

      const view = await createPaywallView(paywall, {
        customTags,
      });

      // Register event handlers for paywall view
      view.registerEventHandlers({
        onCloseButtonPress: () => {
          console.log('[ADAPTY] User pressed close button');
          setResult('❌ User closed paywall');
          return true; // Allow the paywall to close
        },
        onAndroidSystemBack: () => {
          console.log('[ADAPTY] User pressed system back button');
          setResult('⬅️ User pressed back button');
          return true; // Allow the paywall to close
        },
        onUrlPress: (url: string) => {
          console.log('[ADAPTY] User pressed URL:', url);
          setResult(`🔗 User opened URL: ${url}`);
          return false; // Don't close the paywall
        },
        onCustomAction: (action: any) => {
          console.log('[ADAPTY] User performed custom action:', action);
          setResult(`⚡ Custom action: ${JSON.stringify(action)}`);
          return false; // Don't close the paywall
        },
        onProductSelected: (productId: string) => {
          console.log('[ADAPTY] User selected product:', productId);
          setResult(`📦 Product selected: ${productId}`);
          return false; // Don't close the paywall
        },
        onPurchaseStarted: (product: any) => {
          console.log('[ADAPTY] Purchase started for product:', product);
          setResult(`🛒 Purchase started: ${product?.vendorProductId || 'unknown'}`);
          return false; // Don't close the paywall
        },
        onPurchaseCompleted: (purchaseResult: any, product: any) => {
          console.log('[ADAPTY] Purchase completed:', purchaseResult, product);
          setResult(`✅ Purchase completed: ${purchaseResult?.type || 'unknown'}`);
          return purchaseResult?.type !== 'user_cancelled'; // Close if not cancelled
        },
        onPurchaseFailed: (error: any, product: any) => {
          console.log('[ADAPTY] Purchase failed:', error, product);
          setResult(`❌ Purchase failed: ${error?.message || 'unknown error'}`);
          return false; // Don't close the paywall
        },
        onRestoreStarted: () => {
          console.log('[ADAPTY] Restore started');
          setResult('🔄 Restore started...');
          return false; // Don't close the paywall
        },
        onRestoreCompleted: (profile: any) => {
          console.log('[ADAPTY] Restore completed:', profile);
          setResult('✅ Restore completed successfully');
          return true; // Close the paywall after successful restore
        },
        onRestoreFailed: (error: any) => {
          console.log('[ADAPTY] Restore failed:', error);
          setResult(`❌ Restore failed: ${error?.message || 'unknown error'}`);
          return false; // Don't close the paywall
        },
        onPaywallShown: () => {
          console.log('[ADAPTY] Paywall shown');
          setResult('👁️ Paywall appeared');
          return false; // Don't close the paywall
        },
        onPaywallClosed: () => {
          console.log('[ADAPTY] Paywall closed');
          setResult('👋 Paywall disappeared');
          return false; // Already closed
        },
        onRenderingFailed: (error: any) => {
          console.log('[ADAPTY] Rendering failed:', error);
          setResult(`💥 Rendering failed: ${error?.message || 'unknown error'}`);
          return false; // Don't close the paywall
        },
        onLoadingProductsFailed: (error: any) => {
          console.log('[ADAPTY] Loading products failed:', error);
          setResult(`📦❌ Products loading failed: ${error?.message || 'unknown error'}`);
          return false; // Don't close the paywall
        },
        onWebPaymentNavigationFinished: (product: any, error: any) => {
          console.log('[ADAPTY] Web payment navigation finished:', product, error);
          setResult(`🌐 Web payment finished: ${error ? 'with error' : 'success'}`);
          return false; // Don't close the paywall
        },
      });

      setResult('✅ Paywall view created. Presenting...');

      await view.present();

     // setTimeout(() => view.dismiss(),5000)
      setResult('✅ Paywall presented successfully!');
    } catch (error: any) {
      console.error('[ADAPTY] Failed to present paywall:', error);
      setResult(`❌ Failed to present paywall: ${error.message}`);
    }
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
            <div className={styles.ClickableParam} onClick={() => {
              if (isIOS) {
                setRefundPreferenceIdx((refundPreferenceIdx + 1) % refundPreferences.length);
              }
            }}>
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
            <div className={styles.ClickableParam} onClick={() => {
              if (isIOS) {
                setCollectingRefundDataConsent(!collectingRefundDataConsent);
              }
            }}>
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
              <div><strong>Premium:</strong> {accessLevel.isActive ? '✅ Active' : '❌ Not Active'}</div>
              <div><strong>Is Lifetime:</strong> {accessLevel.isLifetime ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Activated At:</strong> {formatDate(accessLevel.activatedAt)}</div>
              <div><strong>Expires At:</strong> {formatDate(accessLevel.expiresAt)}</div>
              <div><strong>Will Renew:</strong> {accessLevel.willRenew ? '✅ Yes' : '❌ No'}</div>
            </div>
          ) : (
            <div><strong>Status:</strong> No active subscriptions</div>
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

  const renderPaywallSection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Paywall Configuration</h3>

        {/* Configuration inputs */}
        <div className={styles.InputGroup}>
          <input
            type="text"
            value={placementId}
            onChange={(e) => setPlacementId(e.target.value)}
            placeholder="Placement ID"
            className={styles.Input}
            disabled={!isActivated}
          />
          <input
            type="text"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="Locale (optional)"
            className={styles.Input}
            disabled={!isActivated}
          />
        </div>

        <div className={styles.InputGroup}>
          <input
            type="text"
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
            placeholder="Timeout (ms)"
            className={styles.Input}
            disabled={!isActivated}
          />
          <input
            type="text"
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
            placeholder="Max age (seconds)"
            className={styles.Input}
            disabled={!isActivated}
          />
        </div>

        <div className={styles.InputGroup}>
          <select
            value={fetchPolicyIndex}
            onChange={(e) => setFetchPolicyIndex(parseInt(e.target.value))}
            className={styles.Input}
            disabled={!isActivated}
          >
            {fetchPolicies.map((policy, index) => (
              <option key={policy} value={index}>
                {policy.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.InputGroup}>
          <textarea
            value={customTagsJson}
            onChange={(e) => setCustomTagsJson(e.target.value)}
            placeholder="Custom tags (JSON)"
            className={styles.Input}
            rows={2}
            disabled={!isActivated}
          />
        </div>

        {/* Load buttons */}
        <div className={styles.ButtonGroup}>
          <button
            onClick={() => fetchPaywall(false)}
            disabled={isLoadingPaywall || !isActivated}
            className={`${styles.Button} ${styles.ButtonPrimary} ${(isLoadingPaywall || !isActivated) ? styles.Loading : ''}`}
          >
            {isLoadingPaywall ? 'Loading...' : 'Load Paywall'}
          </button>
          <button
            onClick={() => fetchPaywall(true)}
            disabled={isLoadingPaywall || !isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary} ${(isLoadingPaywall || !isActivated) ? styles.Loading : ''}`}
          >
            {isLoadingPaywall ? 'Loading...' : 'Load (Default Audience)'}
          </button>
        </div>

        {/* Paywall info */}
        <div className={styles.InfoBox}>
          {paywall ? (
            <div>
              <div><strong>Paywall ID:</strong> {paywall.name}</div>
              <div><strong>Variation ID:</strong> {paywall.variationId}</div>
              <div><strong>Revision:</strong> {paywall.placement.revision}</div>
              <div><strong>Has Remote Config:</strong> {paywall.remoteConfig ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Has Paywall Builder:</strong> {paywall.paywallBuilder ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Products Count:</strong> {products.length}</div>
              {paywall.remoteConfig && (
                <div>
                  <div><strong>Config Locale:</strong> {paywall.remoteConfig.lang}</div>
                  <div><strong>Config Data:</strong> {paywall.remoteConfig.dataString}</div>
                </div>
              )}
              {paywall.paywallBuilder && (
                <div><strong>Builder Locale:</strong> {paywall.paywallBuilder.lang}</div>
              )}

              {products.length > 0 && (
                <div className={styles.ProductsList}>
                  <strong>Products:</strong>
                  {products.map((product) => (
                    <div key={product.vendorProductId} className={styles.ProductItem}>
                      <div className={styles.ProductTitle}>{product.localizedTitle}</div>
                      <div className={styles.ProductPrice}>Price: {product.price?.localizedString || 'N/A'}</div>
                      <div className={styles.ProductId}>ID: {product.vendorProductId}</div>
                      <div className={styles.ProductActionsComment}>
                        Actions for this specific product:
                      </div>

                      <div className={styles.ProductButtons}>
                        <button
                          onClick={() => makePurchase(product)}
                          className={`${styles.Button} ${styles.ButtonPrimary} ${styles.ButtonSmall}`}
                        >
                          Purchase
                        </button>
                        <button
                          onClick={() => openWebPaywallForProduct(product)}
                          className={`${styles.Button} ${styles.ButtonSecondary} ${styles.ButtonSmall}`}
                        >
                          Open Web Paywall for product (iOS)
                        </button>
                        <button
                          onClick={() => createWebPaywallUrlForProduct(product)}
                          className={`${styles.Button} ${styles.ButtonSecondary} ${styles.ButtonSmall}`}
                        >
                          Create Web URL (iOS)
                        </button>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>No paywall loaded</div>
          )}
        </div>

        {/* Action buttons */}
        <div className={styles.ButtonGroup}>
          <button
            onClick={presentPaywall}
            disabled={!paywall || !paywall.hasViewConfiguration}
            className={`${styles.Button} ${styles.ButtonPrimary}`}
          >
            Present Paywall
          </button>

                     <button
             onClick={openWebPaywall}
             disabled={!paywall}
             className={`${styles.Button} ${styles.ButtonSecondary}`}
           >
             Open Web Paywall (iOS)
           </button>



        </div>

          {/* Combined Create Web URL Button + Input */}
          <div className={styles.WebUrlContainer}>
            <button
              onClick={createWebPaywallUrl}
              disabled={!paywall}
              className={styles.WebUrlButton}
            >
              Create Web URL (iOS)
            </button>
            <input
              type="text"
              value={webPaywallUrl}
              placeholder="Generated URL will appear here..."
              readOnly
              className={`${styles.WebUrlInput} ${webPaywallUrl ? styles.WebUrlInputHasValue : ''}`}
              onClick={(e) => webPaywallUrl && (e.target as HTMLInputElement).select()}
              title={webPaywallUrl ? 'Click to select URL for copying' : 'No URL generated yet'}
            />
          </div>
      </div>
    );
  };

  const renderOnboardingSection = () => {
    return (
      <div className={styles.Section}>
        <h3 className={styles.SectionTitle}>Onboarding Configuration</h3>

        <div className={styles.InputGroup}>
          <input
            type="text"
            value={onboardingPlacementId}
            onChange={(e) => setOnboardingPlacementId(e.target.value)}
            placeholder="Onboarding Placement ID"
            className={styles.Input}
            disabled={!isActivated}
          />
          <input
            type="text"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="Locale (optional)"
            className={styles.Input}
            disabled={!isActivated}
          />
        </div>

        <div className={styles.InputGroup}>
          <input
            type="text"
            value={timeout}
            onChange={(e) => setTimeout(e.target.value)}
            placeholder="Timeout (ms)"
            className={styles.Input}
            disabled={!isActivated}
          />
          <input
            type="text"
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
            placeholder="Max age (seconds)"
            className={styles.Input}
            disabled={!isActivated}
          />
        </div>

        <div className={styles.InputGroup}>
          <select
            value={fetchPolicyIndex}
            onChange={(e) => setFetchPolicyIndex(parseInt(e.target.value))}
            className={styles.Input}
            disabled={!isActivated}
          >
            {fetchPolicies.map((policy, index) => (
              <option key={policy} value={index}>
                {policy.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Load buttons */}
        <div className={styles.ButtonGroup}>
          <button
            onClick={() => fetchOnboarding(false)}
            disabled={isLoadingOnboarding || !isActivated}
            className={`${styles.Button} ${styles.ButtonPrimary} ${(isLoadingOnboarding || !isActivated) ? styles.Loading : ''}`}
          >
            {isLoadingOnboarding ? 'Loading...' : 'Load Onboarding'}
          </button>
          <button
            onClick={() => fetchOnboarding(true)}
            disabled={isLoadingOnboarding || !isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary} ${(isLoadingOnboarding || !isActivated) ? styles.Loading : ''}`}
          >
            {isLoadingOnboarding ? 'Loading...' : 'Load (Default Audience)'}
          </button>
        </div>

        {/* Onboarding info */}
        <div className={styles.InfoBox}>
          {onboarding ? (
            <div>
              <div><strong>Onboarding Name:</strong> {onboarding.name}</div>
              <div><strong>Variation ID:</strong> {onboarding.variationId}</div>
              <div><strong>Revision:</strong> {onboarding.placement.revision}</div>
              <div><strong>Has Remote Config:</strong> {onboarding.remoteConfig ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Has Onboarding Builder:</strong> {onboarding.onboardingBuilder ? '✅ Yes' : '❌ No'}</div>
              {onboarding.remoteConfig && (
                <div>
                  <div><strong>Config Locale:</strong> {onboarding.remoteConfig.lang}</div>
                  <div><strong>Config Data:</strong> {onboarding.remoteConfig.dataString}</div>
                </div>
              )}
              {onboarding.onboardingBuilder && (
                <div><strong>Builder Locale:</strong> {onboarding.onboardingBuilder.lang}</div>
              )}
            </div>
          ) : (
            <div>No onboarding loaded</div>
          )}
        </div>
      </div>
    );
  };

  const presentCodeRedemptionSheet = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Presenting code redemption sheet (iOS only)...');
      await adapty.presentCodeRedemptionSheet();
      setResult('Code redemption sheet presented successfully (iOS only)');
    } catch (error) {
      console.error('[ADAPTY] Error presenting code redemption sheet', error);
      setResult(`Error presenting code redemption sheet: ${error}`);
    }
  };

  const identify = async () => {
    if (!customerUserId.trim()) {
      setResult('Error: Customer User ID is required');
      return;
    }

    try {
      console.log('[ADAPTY] Identifying user...');
      if (isActivated) {
        await adapty.identify({ customerUserId: customerUserId.trim() });
        setResult(`User identified successfully with ID: ${customerUserId.trim()}`);
        await fetchProfile();
      } else {
        setResult('Customer user Id will be set on activation');
      }
    } catch (error) {
      console.error('[ADAPTY] Error identifying user', error);
      setResult(`Error identifying user: ${error}`);
    }
  };

  const fetchOnboarding = async (forDefaultAudience: boolean = false) => {
    if (!isActivated) return;

    setIsLoadingOnboarding(true);
    try {
      console.log('[ADAPTY] Fetching onboarding:', onboardingPlacementId);
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

      // Log show onboarding
      await adapty.logShowOnboarding({
        screenOrder: 1,
        onboardingName: onboardingResult.name,
        screenName: 'screen_1',
      });

      const audienceType = forDefaultAudience ? 'for default audience' : '';
      setResult(`Onboarding loaded ${audienceType}: ${onboardingResult.name}`);
    } catch (error) {
      console.error('[ADAPTY] Error fetching onboarding', error);
      setResult(`Error fetching onboarding: ${error}`);
    } finally {
      setIsLoadingOnboarding(false);
    }
  };

  const setLogLevel = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Setting log level to verbose...');
      await adapty.setLogLevel({ logLevel: 'verbose' });
      setResult('Log level set to verbose successfully');
    } catch (error) {
      console.error('[ADAPTY] Error setting log level', error);
      setResult(`Error setting log level: ${error}`);
    }
  };

  const setIntegrationId = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Setting integration identifier:', integrationIdKey, integrationIdValue);
      await adapty.setIntegrationIdentifier({ key: integrationIdKey, value: integrationIdValue });
      setResult(`Integration identifier set successfully: ${integrationIdKey} = ${integrationIdValue}`);
    } catch (error) {
      console.error('[ADAPTY] Error setting integration identifier', error);
      setResult(`Error setting integration identifier: ${error}`);
    }
  };

  const updateRefundDataConsent = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Updating collecting refund data consent:', collectingRefundDataConsent);
      await adapty.updateCollectingRefundDataConsent({ consent: collectingRefundDataConsent });
      setResult(`Collecting refund data consent updated successfully: ${collectingRefundDataConsent}`);
    } catch (error) {
      console.error('[ADAPTY] Error updating collecting refund data consent', error);
      setResult(`Error updating collecting refund data consent: ${error}`);
    }
  };

  const updateRefundPreference = async () => {
    if (!isActivated) return;

    try {
      const refundPreference = refundPreferences[refundPreferenceIdx];
      console.log('[ADAPTY] Updating refund preference:', refundPreference);
      await adapty.updateRefundPreference({ refundPreference });
      setResult(`Refund preference updated successfully: ${refundPreference}`);
    } catch (error) {
      console.error('[ADAPTY] Error updating refund preference', error);
      setResult(`Error updating refund preference: ${error}`);
    }
  };

  const testSetFallback = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Setting fallback paywalls...');

      const fileLocation: FileLocation = {
        ios: {
          fileName: 'ios_fallback.json'
        },
        android: {
          relativeAssetPath: 'android_fallback.json'
        }
      };

      await adapty.setFallback({ fileLocation });
      setResult('Fallback paywalls set successfully');
      console.log('[ADAPTY] Fallback paywalls set successfully');
    } catch (error) {
      console.error('[ADAPTY] Error setting fallback paywalls', error);
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
        </div>
        <div className={styles.ButtonGroup}>
          <button
            onClick={logout}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonDanger}`}
          >
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
      console.log('[ADAPTY] Reporting transaction...', transactionId, variationId);
      await adapty.reportTransaction({
        transactionId: transactionId.trim(),
        ...(variationId.trim() ? { variationId: variationId.trim() } : {}),
      });
      setResult(`Transaction reported successfully: ${transactionId.trim()}`);
    } catch (error) {
      console.error('[ADAPTY] Error reporting transaction', error);
      setResult(`Error reporting transaction: ${error}`);
    }
  };

  return (
    <div className={styles.AppContainer}>
      <main>
        <h1 className={styles.Title}>Adapty Capacitor Plugin</h1>
        <p className={styles.Description}>
          This project is devtools for plugin API.
        </p>

        {/* Credentials Info */}
        <div className={styles.Section}>
          <h3 className={styles.SectionTitle}>Configuration from .adapty-credentials.json file</h3>
          <div className={styles.InfoBox}>
            <div className={styles.InfoBoxItem}>
              <strong>API Key:</strong> {getApiKey() ? `${getApiKey().substring(0, 20)}...` : 'Not loaded'}
            </div>
            <div className={styles.InfoBoxItem}>
              <strong>Placement ID:</strong> {getPlacementId()}
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
          <div className={`${styles.ResultBox} ${result.startsWith('Error') ? styles.ResultBoxError : styles.ResultBoxSuccess}`}>
            {result}
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
