import React from 'react';
import type { AdaptyPaywall, AdaptyPaywallProduct } from '@adapty/capacitor';
import styles from '../App.module.css';

type Props = {
  isActivated: boolean;
  isLoadingPaywall: boolean;
  paywall: AdaptyPaywall | null;
  products: AdaptyPaywallProduct[];
  placementId: string;
  locale: string;
  timeout: string;
  maxAge: string;
  customTagsJson: string;
  fetchPolicyIndex: number;
  fetchPolicies: readonly string[];
  webPaywallOpenInIdx: number;
  webPresentations: readonly string[];
  paywallView: any | null;
  webPaywallUrl: string;
  setPlacementId: (v: string) => void;
  setLocale: (v: string) => void;
  setLoadTimeout: (v: string) => void;
  setMaxAge: (v: string) => void;
  setCustomTagsJson: (v: string) => void;
  setFetchPolicyIndex: (v: number) => void;
  setWebPaywallOpenInIdx: (v: number) => void;
  fetchPaywall: (forDefaultAudience?: boolean) => Promise<void>;
  presentPaywall: () => Promise<void>;
  presentExistingPaywall: () => Promise<void>;
  logPaywallShown: () => Promise<void>;
  openWebPaywall: () => Promise<void>;
  createWebPaywallUrl: () => Promise<void>;
  makePurchase: (product: AdaptyPaywallProduct) => Promise<void>;
  openWebPaywallForProduct: (product: AdaptyPaywallProduct) => Promise<void>;
  createWebPaywallUrlForProduct: (product: AdaptyPaywallProduct) => Promise<void>;
};

export const PaywallSection: React.FC<Props> = ({
  isActivated,
  isLoadingPaywall,
  paywall,
  products,
  placementId,
  locale,
  timeout,
  maxAge,
  customTagsJson,
  fetchPolicyIndex,
  fetchPolicies,
  webPaywallOpenInIdx,
  webPresentations,
  paywallView,
  webPaywallUrl,
  setPlacementId,
  setLocale,
  setLoadTimeout,
  setMaxAge,
  setCustomTagsJson,
  setFetchPolicyIndex,
  setWebPaywallOpenInIdx,
  fetchPaywall,
  presentPaywall,
  presentExistingPaywall,
  logPaywallShown,
  openWebPaywall,
  createWebPaywallUrl,
  makePurchase,
  openWebPaywallForProduct,
  createWebPaywallUrlForProduct,
}) => {
  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Paywall Configuration</h3>

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
          onChange={(e) => setLocale(e.target.value.toLowerCase())}
          placeholder="Request Locale (optional)"
          className={styles.Input}
          disabled={!isActivated}
        />
      </div>

      <div className={styles.InputGroup}>
        <input
          type="text"
          value={timeout}
          onChange={(e) => setLoadTimeout(e.target.value)}
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
        <select
          value={webPaywallOpenInIdx}
          onChange={(e) => setWebPaywallOpenInIdx(parseInt(e.target.value))}
          className={styles.Input}
          disabled={!isActivated}
        >
          {webPresentations.map((presentation, index) => (
            <option key={presentation} value={index}>
              {presentation.replace(/_/g, ' ')}
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

      <div className={styles.ButtonGroup}>
        <button
          onClick={() => fetchPaywall(false)}
          disabled={isLoadingPaywall || !isActivated}
          className={`${styles.Button} ${styles.ButtonPrimary} ${isLoadingPaywall || !isActivated ? styles.Loading : ''}`}
        >
          {isLoadingPaywall ? 'Loading...' : 'Load Paywall'}
        </button>
        <button
          onClick={() => fetchPaywall(true)}
          disabled={isLoadingPaywall || !isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary} ${isLoadingPaywall || !isActivated ? styles.Loading : ''}`}
        >
          {isLoadingPaywall ? 'Loading...' : 'Load (Default Audience)'}
        </button>
      </div>

      <div className={styles.InfoBox}>
        {paywall ? (
          <div>
            <div>
              <strong>Paywall ID:</strong> {paywall.name}
            </div>
            <div>
              <strong>Variation ID:</strong> {paywall.variationId}
            </div>
            <div>
              <strong>Revision:</strong> {paywall.placement.revision}
            </div>
            <div>
              <strong>Has Remote Config:</strong> {paywall.remoteConfig ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Has Paywall Builder:</strong> {paywall.paywallBuilder ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Products Count:</strong> {products.length}
            </div>
            <div>
              <strong>Request Locale:</strong> {paywall.requestLocale}
            </div>
            {paywall.remoteConfig && (
              <div>
                <div>
                  <strong>Config Locale:</strong> {paywall.remoteConfig.lang}
                </div>
                <div>
                  <strong>Config Data:</strong> {paywall.remoteConfig.dataString}
                </div>
              </div>
            )}
            {paywall.paywallBuilder && (
              <div>
                <strong>Builder Locale:</strong> {paywall.paywallBuilder.lang}
              </div>
            )}

            {products.length > 0 && (
              <div className={styles.ProductsList}>
                <strong>Products:</strong>
                {products.map((product) => (
                  <div key={product.vendorProductId} className={styles.ProductItem}>
                    <div className={styles.ProductTitle}>{product.localizedTitle}</div>
                    <div className={styles.ProductPrice}>Price: {product.price?.localizedString || 'N/A'}</div>
                    <div className={styles.ProductId}>ID: {product.vendorProductId}</div>
                    <div className={styles.ProductId}>Access Level: {product.accessLevelId || 'N/A'}</div>
                    <div className={styles.ProductId}>Product Type: {product.productType || 'N/A'}</div>
                    <div className={styles.ProductActionsComment}>Actions for this specific product:</div>

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

      <div className={styles.ButtonGroup}>
        <button
          onClick={presentPaywall}
          disabled={!paywall || !paywall.hasViewConfiguration}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Present Paywall
        </button>

        <button
          onClick={presentExistingPaywall}
          disabled={!paywallView}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Present Existing (not supported)
        </button>

        <button onClick={logPaywallShown} disabled={!paywall} className={`${styles.Button} ${styles.ButtonPrimary}`}>
          Log Custom Paywall Shown
        </button>

        <button onClick={openWebPaywall} disabled={!paywall} className={`${styles.Button} ${styles.ButtonPrimary}`}>
          Open Web Paywall
        </button>
      </div>

      <div className={styles.WebUrlContainer}>
        <button onClick={createWebPaywallUrl} disabled={!paywall} className={styles.WebUrlButton}>
          Create Web URL
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
