import React from 'react';
import styles from '../App.module.css';

type Props = {
  isActivated: boolean;
  integrationIdKey: string;
  integrationIdValue: string;
  setIntegrationIdKey: (v: string) => void;
  setIntegrationIdValue: (v: string) => void;
  setIntegrationId: () => Promise<void>;
};

export const IntegrationSection: React.FC<Props> = ({
  isActivated,
  integrationIdKey,
  integrationIdValue,
  setIntegrationIdKey,
  setIntegrationIdValue,
  setIntegrationId,
}) => {
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
