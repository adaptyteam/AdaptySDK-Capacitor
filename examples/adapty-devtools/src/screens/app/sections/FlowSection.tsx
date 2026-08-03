import React from 'react';
import type { AdaptyFlow, AdaptyPaywallProduct, FlowViewController } from '@adapty/capacitor';
import styles from '../App.module.css';
import { elementIds } from '../../../elementIds';

type Props = {
  isActivated: boolean;
  isLoadingFlow: boolean;
  flow: AdaptyFlow | null;
  products: AdaptyPaywallProduct[];
  placementId: string;
  flowViewLocale: string;
  timeout: string;
  maxAge: string;
  customTagsJson: string;
  fetchPolicyIndex: number;
  fetchPolicies: readonly string[];
  webPaywallOpenInIdx: number;
  webPresentations: readonly string[];
  flowView: FlowViewController | null;
  webPaywallUrl: string;
  setPlacementId: (v: string) => void;
  setFlowViewLocale: (v: string) => void;
  setLoadTimeout: (v: string) => void;
  setMaxAge: (v: string) => void;
  setCustomTagsJson: (v: string) => void;
  setFetchPolicyIndex: (v: number) => void;
  setWebPaywallOpenInIdx: (v: number) => void;
  fetchFlow: (forDefaultAudience?: boolean) => Promise<void>;
  presentFlow: () => Promise<void>;
  presentExistingFlow: () => Promise<void>;
  logFlowShown: () => Promise<void>;
  openWebPaywall: () => Promise<void>;
  createWebPaywallUrl: () => Promise<void>;
  makePurchase: (product: AdaptyPaywallProduct) => Promise<void>;
  openWebPaywallForProduct: (product: AdaptyPaywallProduct) => Promise<void>;
  createWebPaywallUrlForProduct: (product: AdaptyPaywallProduct) => Promise<void>;
};

export const FlowSection: React.FC<Props> = ({
  isActivated,
  isLoadingFlow,
  flow,
  products,
  placementId,
  flowViewLocale,
  timeout,
  maxAge,
  customTagsJson,
  fetchPolicyIndex,
  fetchPolicies,
  webPaywallOpenInIdx,
  webPresentations,
  flowView,
  webPaywallUrl,
  setPlacementId,
  setFlowViewLocale,
  setLoadTimeout,
  setMaxAge,
  setCustomTagsJson,
  setFetchPolicyIndex,
  setWebPaywallOpenInIdx,
  fetchFlow,
  presentFlow,
  presentExistingFlow,
  logFlowShown,
  openWebPaywall,
  createWebPaywallUrl,
  makePurchase,
  openWebPaywallForProduct,
  createWebPaywallUrlForProduct,
}) => {
  const remoteConfig = flow?.remoteConfigs?.[0];

  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Flow Configuration</h3>

      <div className={styles.InputGroup}>
        <input
          id={elementIds.flow.placementInput}
          type="text"
          value={placementId}
          onChange={(e) => setPlacementId(e.target.value)}
          placeholder="Placement ID"
          className={styles.Input}
          disabled={!isActivated}
        />
      </div>

      <div className={styles.InputGroup}>
        <input
          id={elementIds.flow.timeoutInput}
          type="text"
          value={timeout}
          onChange={(e) => setLoadTimeout(e.target.value)}
          placeholder="Timeout (ms)"
          className={styles.Input}
          disabled={!isActivated}
        />
        <input
          id={elementIds.flow.maxAgeInput}
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
          id={elementIds.flow.fetchPolicySelect}
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
          id={elementIds.flow.webPaywallOpenInSelect}
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
        <input
          id={elementIds.flow.viewLocaleInput}
          type="text"
          value={flowViewLocale}
          onChange={(e) => setFlowViewLocale(e.target.value.toLowerCase())}
          placeholder="View Locale (optional, e.g. es)"
          className={styles.Input}
          disabled={!isActivated}
        />
      </div>

      <div className={styles.InputGroup}>
        <textarea
          id={elementIds.flow.customTagsTextarea}
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
          id={elementIds.flow.loadBtn}
          onClick={() => fetchFlow(false)}
          disabled={isLoadingFlow || !isActivated}
          className={`${styles.Button} ${styles.ButtonPrimary} ${isLoadingFlow || !isActivated ? styles.Loading : ''}`}
        >
          {isLoadingFlow ? 'Loading...' : 'Load Flow'}
        </button>
        <button
          id={elementIds.flow.loadDefaultAudienceBtn}
          onClick={() => fetchFlow(true)}
          disabled={isLoadingFlow || !isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary} ${isLoadingFlow || !isActivated ? styles.Loading : ''}`}
        >
          {isLoadingFlow ? 'Loading...' : 'Load (Default Audience)'}
        </button>
      </div>

      <div className={styles.InfoBox}>
        {flow ? (
          <div>
            <div id={elementIds.flow.nameValue}>
              <strong>Flow name:</strong> {flow.name}
            </div>
            <div id={elementIds.flow.variationIdValue}>
              <strong>Variation ID:</strong> {flow.variationId}
            </div>
            <div id={elementIds.flow.revisionValue}>
              <strong>Revision:</strong> {flow.placement.revision}
            </div>
            <div id={elementIds.flow.paywallsCountValue}>
              <strong>Paywalls in flow:</strong> {flow.paywalls.length}
            </div>
            <div id={elementIds.flow.hasRemoteConfigValue}>
              <strong>Has Remote Config:</strong> {remoteConfig ? '✅ Yes' : '❌ No'}
            </div>
            <div id={elementIds.flow.productsCountValue}>
              <strong>Products Count:</strong> {products.length}
            </div>
            {remoteConfig && (
              <div>
                <div id={elementIds.flow.configLocaleValue}>
                  <strong>Config Locale:</strong> {remoteConfig.lang}
                </div>
                <div id={elementIds.flow.configDataValue}>
                  <strong>Config Data:</strong> {remoteConfig.dataString}
                </div>
              </div>
            )}

            {products.length > 0 && (
              <div className={styles.ProductsList}>
                <strong>Products:</strong>
                {products.map((product, index) => (
                  <div
                    key={product.vendorProductId}
                    id={elementIds.flow.productItem(index)}
                    data-vendor-product-id={product.vendorProductId}
                    className={styles.ProductItem}
                  >
                    <div id={elementIds.flow.productTitleValue(index)} className={styles.ProductTitle}>
                      {product.localizedTitle}
                    </div>
                    <div id={elementIds.flow.productPriceValue(index)} className={styles.ProductPrice}>
                      Price: {product.price?.localizedString || 'N/A'}
                    </div>
                    <div className={styles.ProductId}>ID: {product.vendorProductId}</div>
                    <div className={styles.ProductId}>Access Level: {product.accessLevelId || 'N/A'}</div>
                    <div className={styles.ProductId}>Product Type: {product.productType || 'N/A'}</div>
                    <div className={styles.ProductActionsComment}>Actions for this specific product:</div>

                    <div className={styles.ProductButtons}>
                      <button
                        id={elementIds.flow.productPurchaseBtn(index)}
                        onClick={() => makePurchase(product)}
                        className={`${styles.Button} ${styles.ButtonPrimary} ${styles.ButtonSmall}`}
                      >
                        Purchase
                      </button>
                      <button
                        id={elementIds.flow.productOpenWebPaywallBtn(index)}
                        onClick={() => openWebPaywallForProduct(product)}
                        className={`${styles.Button} ${styles.ButtonSecondary} ${styles.ButtonSmall}`}
                      >
                        Open Web Paywall for product (iOS)
                      </button>
                      <button
                        id={elementIds.flow.productCreateWebUrlBtn(index)}
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
          <div id={elementIds.flow.emptyValue}>No flow loaded</div>
        )}
      </div>

      <div className={styles.ButtonGroup}>
        <button
          id={elementIds.flow.presentBtn}
          onClick={presentFlow}
          disabled={!flow}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Present Flow
        </button>

        <button
          id={elementIds.flow.presentExistingBtn}
          onClick={presentExistingFlow}
          disabled={!flowView}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Present Existing (not supported)
        </button>

        <button
          id={elementIds.flow.logShownBtn}
          onClick={logFlowShown}
          disabled={!flow}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Log Custom Flow Shown
        </button>

        <button
          id={elementIds.flow.openWebPaywallBtn}
          onClick={openWebPaywall}
          disabled={!flow}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Open Web Paywall
        </button>
      </div>

      {flowView && (
        <div className={styles.InfoBox}>
          <div id={elementIds.flow.viewLocaleValue}>
            <strong>View Locale:</strong> {flowView.locale ?? 'not reported by native'}
          </div>
        </div>
      )}

      <div className={styles.WebUrlContainer}>
        <button
          id={elementIds.flow.createWebUrlBtn}
          onClick={createWebPaywallUrl}
          disabled={!flow}
          className={styles.WebUrlButton}
        >
          Create Web URL
        </button>
        <input
          id={elementIds.flow.webUrlInput}
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
