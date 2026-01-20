import React from 'react';
import { Capacitor } from '@capacitor/core';
import styles from '../App.module.css';
import { InfoBox, InfoRow } from '../components/InfoBox';

type Props = {
  isActivated: boolean;
  refundPreferenceIdx: number;
  refundPreferences: readonly string[];
  refundPreferenceLabels: readonly string[];
  collectingRefundDataConsent: boolean;
  setRefundPreferenceIdx: (v: number) => void;
  setCollectingRefundDataConsent: (v: boolean) => void;
  updateRefundPreference: () => Promise<void>;
  updateRefundDataConsent: () => Promise<void>;
};

export const RefundSection: React.FC<Props> = ({
  isActivated,
  refundPreferenceIdx,
  refundPreferences,
  refundPreferenceLabels,
  collectingRefundDataConsent,
  setRefundPreferenceIdx,
  setCollectingRefundDataConsent,
  updateRefundPreference,
  updateRefundDataConsent,
}) => {
  const platform = Capacitor.getPlatform();
  const isIOS = platform === 'ios';

  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Refund Saver (iOS only)</h3>

      {!isIOS && (
        <InfoBox>
          <InfoRow>
            <strong>⚠️ Not available on {platform}</strong>
          </InfoRow>
        </InfoBox>
      )}

      {isIOS && (
        <div className={styles.RefundItem}>
          <label>Refund Preference:</label>
          <div
            className={styles.ClickableParam}
            onClick={() => setRefundPreferenceIdx((refundPreferenceIdx + 1) % refundPreferences.length)}
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

      {isIOS && (
        <div className={styles.RefundItem}>
          <label>Collecting Refund Data Consent:</label>
          <div
            className={styles.ClickableParam}
            onClick={() => setCollectingRefundDataConsent(!collectingRefundDataConsent)}
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
