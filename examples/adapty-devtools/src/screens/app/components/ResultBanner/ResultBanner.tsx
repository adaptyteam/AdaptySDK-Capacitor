import React from 'react';
import styles from './ResultBanner.module.css';

type Props = {
  result: string;
  id?: string;
};

export const ResultBanner: React.FC<Props> = ({ result, id }) => {
  if (!result) return null;
  const isError = result.startsWith('Error');

  return (
    <div id={id} className={`${styles.ResultBox} ${isError ? styles.ResultBoxError : styles.ResultBoxSuccess}`}>
      {result}
    </div>
  );
};
