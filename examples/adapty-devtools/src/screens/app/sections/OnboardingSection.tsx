import React from 'react';
import type { AdaptyOnboarding } from '@adapty/capacitor';
import styles from '../App.module.css';

type Props = {
  isActivated: boolean;
  isLoadingOnboarding: boolean;
  onboarding: AdaptyOnboarding | null;
  onboardingPlacementId: string;
  locale: string;
  timeout: string;
  maxAge: string;
  fetchPolicyIndex: number;
  fetchPolicies: readonly string[];
  onboardingExternalUrlsPresentationIdx: number;
  webPresentations: readonly string[];
  setOnboardingPlacementId: (v: string) => void;
  setLocale: (v: string) => void;
  setLoadTimeout: (v: string) => void;
  setMaxAge: (v: string) => void;
  setFetchPolicyIndex: (v: number) => void;
  setOnboardingExternalUrlsPresentationIdx: (v: number) => void;
  fetchOnboarding: (forDefaultAudience?: boolean) => Promise<void>;
  presentOnboarding: () => Promise<void>;
};

export const OnboardingSection: React.FC<Props> = ({
  isActivated,
  isLoadingOnboarding,
  onboarding,
  onboardingPlacementId,
  locale,
  timeout,
  maxAge,
  fetchPolicyIndex,
  fetchPolicies,
  onboardingExternalUrlsPresentationIdx,
  webPresentations,
  setOnboardingPlacementId,
  setLocale,
  setLoadTimeout,
  setMaxAge,
  setFetchPolicyIndex,
  setOnboardingExternalUrlsPresentationIdx,
  fetchOnboarding,
  presentOnboarding,
}) => {
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
          value={onboardingExternalUrlsPresentationIdx}
          onChange={(e) => setOnboardingExternalUrlsPresentationIdx(parseInt(e.target.value))}
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

      <div className={styles.ButtonGroup}>
        <button
          onClick={() => fetchOnboarding(false)}
          disabled={isLoadingOnboarding || !isActivated}
          className={`${styles.Button} ${styles.ButtonPrimary} ${
            isLoadingOnboarding || !isActivated ? styles.Loading : ''
          }`}
        >
          {isLoadingOnboarding ? 'Loading...' : 'Load Onboarding'}
        </button>
        <button
          onClick={() => fetchOnboarding(true)}
          disabled={isLoadingOnboarding || !isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary} ${
            isLoadingOnboarding || !isActivated ? styles.Loading : ''
          }`}
        >
          {isLoadingOnboarding ? 'Loading...' : 'Load (Default Audience)'}
        </button>
      </div>

      <div className={styles.InfoBox}>
        {onboarding ? (
          <div>
            <div>
              <strong>Onboarding Name:</strong> {onboarding.name}
            </div>
            <div>
              <strong>Variation ID:</strong> {onboarding.variationId}
            </div>
            <div>
              <strong>Revision:</strong> {onboarding.placement.revision}
            </div>
            <div>
              <strong>Has Remote Config:</strong> {onboarding.remoteConfig ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Has Onboarding Builder:</strong> {onboarding.onboardingBuilder ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Request Locale:</strong> {onboarding.requestLocale}
            </div>
            {onboarding.remoteConfig && (
              <div>
                <div>
                  <strong>Config Locale:</strong> {onboarding.remoteConfig.lang}
                </div>
                <div>
                  <strong>Config Data:</strong> {onboarding.remoteConfig.dataString}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>No onboarding loaded</div>
        )}
      </div>

      <div className={styles.ButtonGroup}>
        <button
          onClick={presentOnboarding}
          disabled={!onboarding || !onboarding.hasViewConfiguration}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Present Onboarding
        </button>
      </div>
    </div>
  );
};
