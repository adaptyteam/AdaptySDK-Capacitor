import React, { useState, useEffect } from 'react';
import { Adapty } from '@adapty/capacitor';
import {
  AdaptyProfile,
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyError
} from '@adapty/capacitor';
import { getApiKey, getPlacementId, getIosBundle } from '../../helpers';
import './App.css';

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

  const adapty = new Adapty();

  const testActivate = async () => {
    try {
      setResult('Activating Adapty...');
      await adapty.activate({
        apiKey: getApiKey(),
        params: {
          logLevel: 'verbose',
          observerMode: false,
        }
      });
      setResult('Adapty activated successfully!');
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

  const fetchPaywall = async () => {
    if (!isActivated) return;

    setIsLoadingPaywall(true);
    try {
      console.log('[ADAPTY] Fetching paywall...');
      const paywall = await adapty.getPaywallForDefaultAudience({
        placementId: getPlacementId(),
        params: {
          fetchPolicy: 'reload_revalidating_cache_data',
        },
      });
      // Логируем полученный paywall
      console.log('[ADAPTY] Paywall fetched:', paywall);
      setPaywall(paywall);

      // Log show paywall
      await adapty.logShowPaywall({ paywall });

      // Fetch products
      const productsResult = await adapty.getPaywallProducts({ paywall });
      setProducts(productsResult.products);

      setResult(`Paywall loaded: ${paywall.name}`);
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

  const updateProfile = async () => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Updating profile...');
      await adapty.updateProfile({
        params: {
          email: 'john@example.com',
          phoneNumber: '+14325671098',
          firstName: 'John',
          lastName: 'Doe',
        },
      });
      setResult('Profile updated successfully');
      await fetchProfile(); // Refresh profile
    } catch (error) {
      console.error('[ADAPTY] Error updating profile', error);
      setResult(`Error updating profile: ${error}`);
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

  const makePurchase = async (product: AdaptyPaywallProduct) => {
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Making purchase...', product.vendorProductId);
      const result = await adapty.makePurchase({ product });

      const purchaseResult = result.result;

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

  const renderProfileSection = () => {
    const accessLevel = getAccessLevel();

    return (
      <div className="section">
        <h3 className="section-title">Profile Information</h3>
        <div className="info-box">
          <div className="info-box-item">
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
          className={`button button-info ${isLoadingProfile ? 'loading' : ''}`}
        >
          {isLoadingProfile ? 'Loading...' : 'Refresh Profile'}
        </button>
      </div>
    );
  };

  const renderPaywallSection = () => {
    return (
      <div className="section">
        <h3 className="section-title">Paywall ({getPlacementId()})</h3>
        <div className="info-box">
          {paywall ? (
            <div>
              <div><strong>Paywall ID:</strong> {paywall.name}</div>
              <div><strong>Variation ID:</strong> {paywall.variationId}</div>
              <div><strong>Revision:</strong> {paywall.placement.revision}</div>
              <div><strong>Has Remote Config:</strong> {paywall.remoteConfig ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Has Paywall Builder:</strong> {paywall.paywallBuilder ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Products Count:</strong> {products.length}</div>

              {products.length > 0 && (
                <div className="products-list">
                  <strong>Products:</strong>
                  {products.map((product) => (
                    <div key={product.vendorProductId} className="product-item">
                      <div className="product-title">{product.localizedTitle}</div>
                      <div className="product-price">Price: {product.price?.localizedString || 'N/A'}</div>
                      <div className="product-id">ID: {product.vendorProductId}</div>
                      <button
                        onClick={() => makePurchase(product)}
                        className="button button-success button-small"
                      >
                        Purchase
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>No paywall loaded</div>
          )}
        </div>
        <div className="button-group">
          <button
            onClick={fetchPaywall}
            disabled={isLoadingPaywall || !isActivated}
            className={`button button-primary ${(isLoadingPaywall || !isActivated) ? 'loading' : ''}`}
          >
            {isLoadingPaywall ? 'Loading...' : 'Load Paywall'}
          </button>
          <button
            onClick={openWebPaywall}
            disabled={!paywall}
            className="button button-purple"
          >
            Open Web Paywall
          </button>
        </div>
      </div>
    );
  };

  const renderOnboardingSection = () => {
    return (
      <div className="section">
        <h3 className="section-title">Onboarding ({getPlacementId()})</h3>
        <div className="info-box">
          {onboarding ? (
            <div>
              <div><strong>Onboarding ID:</strong> {onboarding.name}</div>
              <div><strong>Variation ID:</strong> {onboarding.variationId}</div>
              <div><strong>Revision:</strong> {onboarding.placement.revision}</div>
              <div><strong>Has Remote Config:</strong> {onboarding.remoteConfig ? '✅ Yes' : '❌ No'}</div>
              <div><strong>Has Onboarding Builder:</strong> {onboarding.onboardingBuilder ? '✅ Yes' : '❌ No'}</div>
            </div>
          ) : (
            <div>No onboarding loaded</div>
          )}
        </div>
        <div className="button-group">
          <button
            onClick={fetchOnboarding}
            disabled={isLoadingOnboarding || !isActivated}
            className={`button button-success ${(isLoadingOnboarding || !isActivated) ? 'loading' : ''}`}
          >
            {isLoadingOnboarding ? 'Loading...' : 'Load Onboarding'}
          </button>
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
    if (!isActivated) return;

    try {
      console.log('[ADAPTY] Identifying user...');
      await adapty.identify({ customerUserId: 'test-user-' + Date.now() });
      setResult('User identified successfully');
      await fetchProfile(); // Refresh profile
    } catch (error) {
      console.error('[ADAPTY] Error identifying user', error);
      setResult(`Error identifying user: ${error}`);
    }
  };

  const fetchOnboarding = async () => {
    if (!isActivated) return;

    setIsLoadingOnboarding(true);
    try {
      console.log('[ADAPTY] Fetching onboarding...');
      const onboardingResult = await adapty.getOnboardingForDefaultAudience({
        placementId: getPlacementId(),
        params: {
          fetchPolicy: 'reload_revalidating_cache_data',
        },
      });
      setOnboarding(onboardingResult.onboarding);

      // Log show onboarding
      await adapty.logShowOnboarding({
        screenOrder: 1,
        onboardingName: onboardingResult.onboarding.name,
        screenName: 'screen_1'
      });

      setResult(`Onboarding loaded: ${onboardingResult.onboarding.name}`);
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
      console.log('[ADAPTY] Setting integration identifier...');
      await adapty.setIntegrationIdentifier({ key: 'test_key', value: 'test_value' });
      setResult('Integration identifier set successfully');
    } catch (error) {
      console.error('[ADAPTY] Error setting integration identifier', error);
      setResult(`Error setting integration identifier: ${error}`);
    }
  };

  const renderActionsSection = () => {
    return (
      <div className="section">
        <h3 className="section-title">Other Actions</h3>
        <div className="button-group">
          <button
            onClick={restorePurchases}
            disabled={!isActivated}
            className="button button-orange"
          >
            Restore Purchases
          </button>
          <button
            onClick={updateProfile}
            disabled={!isActivated}
            className="button button-teal"
          >
            Update Profile
          </button>
          <button
            onClick={updateAttribution}
            disabled={!isActivated}
            className="button button-secondary"
          >
            Update Attribution
          </button>
          <button
            onClick={identify}
            disabled={!isActivated}
            className="button button-info"
          >
            Identify User
          </button>
        </div>
        <div className="button-group">
          <button
            onClick={presentCodeRedemptionSheet}
            disabled={!isActivated}
            className="button button-purple"
          >
            Code Redemption (iOS)
          </button>
          <button
            onClick={setLogLevel}
            disabled={!isActivated}
            className="button button-warning"
          >
            Set Log Level
          </button>
          <button
            onClick={setIntegrationId}
            disabled={!isActivated}
            className="button button-purple"
          >
            Set Integration ID
          </button>
        </div>
        <div className="button-group">
          <button
            onClick={logout}
            disabled={!isActivated}
            className="button button-danger"
          >
            Logout
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <main>
        <h1 className="title">Adapty Capacitor Plugin</h1>
        <p className="description">
          This project demonstrates the functionality of the Adapty Capacitor plugin.
        </p>

        {/* Credentials Info */}
        <div className="section">
          <h3 className="section-title">Configuration from .adapty-credentials.json file</h3>
          <div className="info-box">
            <div className="info-box-item">
              <strong>API Key:</strong> {getApiKey() ? `${getApiKey().substring(0, 20)}...` : 'Not loaded'}
            </div>
            <div className="info-box-item">
              <strong>Placement ID:</strong> {getPlacementId()}
            </div>
            <div className="info-box-item">
              <strong>iOS Bundle ID:</strong> {getIosBundle()}
            </div>
          </div>
        </div>

        {/* Activation Section */}
        <div className="section">
          <h3 className="section-title">SDK Activation</h3>
          <button
            onClick={testActivate}
            className={`button ${isActivated ? 'button-success' : 'button-primary'}`}
          >
            {isActivated ? 'Activated' : 'Activate Adapty'}
          </button>
          <button
            onClick={testIsActivated}
            className="button button-secondary"
            style={{ marginLeft: '10px' }}
          >
            Check Status
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`result-box ${isActivated ? 'success' : 'default'}`}>
            {result}
          </div>
        )}

        {/* Profile Section */}
        {isActivated && renderProfileSection()}

        {/* Paywall Section */}
        {isActivated && renderPaywallSection()}

        {/* Onboarding Section */}
        {isActivated && renderOnboardingSection()}

        {/* Actions Section */}
        {isActivated && renderActionsSection()}

        {/* Configuration Info */}
        <div className="config-section">
          <h3 className="config-title">SDK Status:</h3>
          <ul className="config-list">
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
