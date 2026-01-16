import React from 'react';
import styles from './ResultBanner.module.css';

type Props = {
  result: string;
};

export const ResultBanner: React.FC<Props> = ({ result }) => {
  if (!result) return null;
  const isError = result.startsWith('Error');

  return (
    <div className={`${styles.ResultBox} ${isError ? styles.ResultBoxError : styles.ResultBoxSuccess}`}>{result}</div>
  );
};
