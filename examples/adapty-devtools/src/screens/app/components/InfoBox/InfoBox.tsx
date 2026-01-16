import React from 'react';
import styles from './InfoBox.module.css';

export const InfoBox: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <div className={styles.InfoBox}>{children}</div>;
};

export const InfoRow: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <div className={styles.InfoBoxItem}>{children}</div>;
};
