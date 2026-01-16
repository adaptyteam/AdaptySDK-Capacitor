import React from 'react';
import styles from '../App.module.css';
import { ButtonGroup } from '../components/ButtonGroup';

type Props = {
  isActivated: boolean;
  restorePurchases: () => Promise<void>;
  updateAttribution: () => Promise<void>;
  presentCodeRedemptionSheet: () => Promise<void>;
  setLogLevel: () => Promise<void>;
  testSetFallback: () => Promise<void>;
  getCurrentInstallationStatus: () => Promise<void>;
  logout: () => Promise<void>;
};

export const OtherActionsSection: React.FC<Props> = ({
  isActivated,
  restorePurchases,
  updateAttribution,
  presentCodeRedemptionSheet,
  setLogLevel,
  testSetFallback,
  getCurrentInstallationStatus,
  logout,
}) => {
  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Other Actions</h3>

      <ButtonGroup>
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
      </ButtonGroup>

      <ButtonGroup>
        <button
          onClick={presentCodeRedemptionSheet}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Code Redemption (iOS)
        </button>
        <button onClick={setLogLevel} disabled={!isActivated} className={`${styles.Button} ${styles.ButtonSecondary}`}>
          Set Log Level
        </button>
      </ButtonGroup>

      <ButtonGroup>
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
      </ButtonGroup>

      <ButtonGroup>
        <button onClick={logout} disabled={!isActivated} className={`${styles.Button} ${styles.ButtonDanger}`}>
          Logout
        </button>
      </ButtonGroup>
    </div>
  );
};
