import React from 'react';
import styles from './ButtonGroup.module.css';

export const ButtonGroup: React.FC<React.PropsWithChildren> = ({ children }) => {
  return <div className={styles.ButtonGroup}>{children}</div>;
};
