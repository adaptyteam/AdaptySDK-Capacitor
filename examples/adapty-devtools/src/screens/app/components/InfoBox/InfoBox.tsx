import React from 'react';
import styles from './InfoBox.module.css';

type Props = React.PropsWithChildren<{ id?: string }>;

export const InfoBox: React.FC<Props> = ({ id, children }) => {
  return (
    <div id={id} className={styles.InfoBox}>
      {children}
    </div>
  );
};

export const InfoRow: React.FC<Props> = ({ id, children }) => {
  return (
    <div id={id} className={styles.InfoBoxItem}>
      {children}
    </div>
  );
};
