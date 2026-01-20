import React from 'react';
import type { AdaptyProfile } from '@adapty/capacitor';
import styles from '../App.module.css';
import { InfoBox, InfoRow } from '../components/InfoBox';

type Props = {
  profile: AdaptyProfile | null;
  isLoadingProfile: boolean;
  fetchProfile: () => Promise<void>;
};

const formatDate = (date?: Date | string): string => {
  if (!date) return '-';
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  return parsedDate.toLocaleDateString() + ' ' + parsedDate.toLocaleTimeString();
};

export const ProfileSection: React.FC<Props> = ({ profile, isLoadingProfile, fetchProfile }) => {
  const accessLevel = profile?.accessLevels?.['premium'];

  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Profile Information</h3>
      <InfoBox>
        <InfoRow>
          <strong>Profile ID:</strong> {profile?.profileId || 'Not loaded'}
        </InfoRow>
        {accessLevel ? (
          <>
            <InfoRow>
              <strong>Premium:</strong> {accessLevel.isActive ? '✅ Active' : '❌ Not Active'}
            </InfoRow>
            <InfoRow>
              <strong>Is Lifetime:</strong> {accessLevel.isLifetime ? '✅ Yes' : '❌ No'}
            </InfoRow>
            <InfoRow>
              <strong>Activated At:</strong> {formatDate(accessLevel.activatedAt)}
            </InfoRow>
            <InfoRow>
              <strong>Expires At:</strong> {formatDate(accessLevel.expiresAt)}
            </InfoRow>
            <InfoRow>
              <strong>Will Renew:</strong> {accessLevel.willRenew ? '✅ Yes' : '❌ No'}
            </InfoRow>
          </>
        ) : (
          <InfoRow>
            <strong>Status:</strong> No active subscriptions
          </InfoRow>
        )}
      </InfoBox>
      <button
        onClick={fetchProfile}
        disabled={isLoadingProfile}
        className={`${styles.Button} ${styles.ButtonPrimary} ${isLoadingProfile ? styles.Loading : ''}`}
      >
        {isLoadingProfile ? 'Loading...' : 'Refresh Profile'}
      </button>
    </div>
  );
};
