import React from 'react';
import styles from '../App.module.css';
import { InfoBox, InfoRow } from '../components/InfoBox';
import { elementIds } from '../../../elementIds';

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
        <InfoRow id={elementIds.credentials.apiKeyValue}>
          <strong>API Key:</strong> {apiKey ? `${apiKey.substring(0, 20)}...` : 'Not loaded'}
        </InfoRow>
        <InfoRow id={elementIds.credentials.iosBundleIdValue}>
          <strong>iOS Bundle ID:</strong> {iosBundleId}
        </InfoRow>
        <InfoRow id={elementIds.credentials.androidApplicationIdValue}>
          <strong>Android Application ID:</strong> {androidApplicationId}
        </InfoRow>
      </InfoBox>
    </div>
  );
};
