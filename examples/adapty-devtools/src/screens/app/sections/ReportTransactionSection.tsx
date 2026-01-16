import React from 'react';
import styles from '../App.module.css';

type Props = {
  isActivated: boolean;
  transactionId: string;
  variationId: string;
  setTransactionId: (v: string) => void;
  setVariationId: (v: string) => void;
  reportTransaction: () => Promise<void>;
};

export const ReportTransactionSection: React.FC<Props> = ({
  isActivated,
  transactionId,
  variationId,
  setTransactionId,
  setVariationId,
  reportTransaction,
}) => {
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
