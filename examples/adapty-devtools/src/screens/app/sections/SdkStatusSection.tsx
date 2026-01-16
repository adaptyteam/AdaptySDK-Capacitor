import React from 'react';
import type { AdaptyOnboarding, AdaptyPaywall, AdaptyProfile } from '@adapty/capacitor';
import styles from '../App.module.css';

type Props = {
  isActivated: boolean;
  profile: AdaptyProfile | null;
  paywall: AdaptyPaywall | null;
  onboarding: AdaptyOnboarding | null;
};

export const SdkStatusSection: React.FC<Props> = ({ isActivated, profile, paywall, onboarding }) => {
  return (
    <div className={styles.ConfigSection}>
      <h3 className={styles.ConfigTitle}>SDK Status:</h3>
      <ul className={styles.ConfigList}>
        <li>Status: {isActivated ? '✅ Activated' : '❌ Not activated'}</li>
        <li>Profile Loaded: {profile ? '✅ Yes' : '❌ No'}</li>
        <li>Paywall Loaded: {paywall ? '✅ Yes' : '❌ No'}</li>
        <li>Onboarding Loaded: {onboarding ? '✅ Yes' : '❌ No'}</li>
      </ul>
    </div>
  );
};
