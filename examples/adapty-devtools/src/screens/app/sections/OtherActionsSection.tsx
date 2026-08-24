import React from 'react';
import styles from '../App.module.css';
import { ButtonGroup } from '../components/ButtonGroup';
import { elementIds } from '../../../elementIds';
import {
  EXTERNAL_ATTRIBUTION_LABELS,
  EXTERNAL_ATTRIBUTION_PROVIDERS,
  type ExternalAttributionProvider,
} from '../../../services/externalAttribution';

type Props = {
  isActivated: boolean;
  restorePurchases: () => Promise<void>;
  updateCustomAttribution: () => Promise<void>;
  updateProviderAttribution: (provider: ExternalAttributionProvider) => Promise<void>;
  presentCodeRedemptionSheet: () => Promise<void>;
  setLogLevel: () => Promise<void>;
  testSetFallback: () => Promise<void>;
  getCurrentInstallationStatus: () => Promise<void>;
  openAdaptyIoInApp: () => Promise<void>;
  openAdaptyIoExternal: () => Promise<void>;
  requestAppReview: () => Promise<void>;
  logout: () => Promise<void>;
};

export const OtherActionsSection: React.FC<Props> = ({
  isActivated,
  restorePurchases,
  updateCustomAttribution,
  updateProviderAttribution,
  presentCodeRedemptionSheet,
  setLogLevel,
  testSetFallback,
  getCurrentInstallationStatus,
  openAdaptyIoInApp,
  openAdaptyIoExternal,
  requestAppReview,
  logout,
}) => {
  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Other Actions</h3>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.restorePurchasesBtn}
          onClick={restorePurchases}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Restore Purchases
        </button>
        <button
          id={elementIds.otherActions.updateCustomAttributionBtn}
          onClick={updateCustomAttribution}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Update Attribution (custom)
        </button>
      </ButtonGroup>

      <ButtonGroup>
        {EXTERNAL_ATTRIBUTION_PROVIDERS.map((provider: ExternalAttributionProvider) => (
          <button
            key={provider}
            id={elementIds.otherActions.updateProviderAttributionBtn(provider)}
            onClick={() => updateProviderAttribution(provider)}
            disabled={!isActivated}
            className={`${styles.Button} ${styles.ButtonSecondary}`}
          >
            {EXTERNAL_ATTRIBUTION_LABELS[provider]}
          </button>
        ))}
      </ButtonGroup>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.codeRedemptionBtn}
          onClick={presentCodeRedemptionSheet}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Code Redemption (iOS)
        </button>
        <button
          id={elementIds.otherActions.setLogLevelBtn}
          onClick={setLogLevel}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Set Log Level
        </button>
      </ButtonGroup>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.setFallbackBtn}
          onClick={testSetFallback}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Set Fallback Paywalls
        </button>
        <button
          id={elementIds.otherActions.installationStatusBtn}
          onClick={getCurrentInstallationStatus}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Get Installation Status
        </button>
      </ButtonGroup>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.openAdaptyInAppBtn}
          onClick={openAdaptyIoInApp}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Open adapty.io (in-app)
        </button>
        <button
          id={elementIds.otherActions.openAdaptyExternalBtn}
          onClick={openAdaptyIoExternal}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Open adapty.io (external)
        </button>
      </ButtonGroup>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.requestAppReviewBtn}
          onClick={requestAppReview}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Request App Review
        </button>
      </ButtonGroup>

      <ButtonGroup>
        <button
          id={elementIds.otherActions.logoutBtn}
          onClick={logout}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonDanger}`}
        >
          Logout
        </button>
      </ButtonGroup>
    </div>
  );
};
