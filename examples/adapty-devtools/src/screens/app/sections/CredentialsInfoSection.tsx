import React from 'react';
import styles from '../App.module.css';
import { InfoBox, InfoRow } from '../components/InfoBox';

type Props = {
  apiKey: string;
  iosBundleId: string;
  androidApplicationId: string;
};

export const CredentialsInfoSection: React.FC<Props> = ({ apiKey, iosBundleId, androidApplicationId }) => {
  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Configuration from .adapty-credentials.json file</h3>
      <InfoBox>
        <InfoRow>
          <strong>API Key:</strong> {apiKey ? `${apiKey.substring(0, 20)}...` : 'Not loaded'}
        </InfoRow>
        <InfoRow>
          <strong>iOS Bundle ID:</strong> {iosBundleId}
        </InfoRow>
        <InfoRow>
          <strong>Android Application ID:</strong> {androidApplicationId}
        </InfoRow>
      </InfoBox>
    </div>
  );
};
