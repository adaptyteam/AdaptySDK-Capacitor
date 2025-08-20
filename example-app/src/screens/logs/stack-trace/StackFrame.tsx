import React from 'react';
import { StackFrame as StackFrameType } from './types';
import styles from './StackTrace.module.css';

interface StackFrameProps {
  frame: StackFrameType;
  index: number;
}

const StackFrame: React.FC<StackFrameProps> = ({ frame, index }) => {
  const getFrameClassName = () => {
    if (frame.isAppCode) return styles.AppCode;
    if (frame.isReactCode) return styles.ReactCode;
    return styles.OtherCode;
  };

  return (
    <div className={`${styles.StackFrame} ${getFrameClassName()}`}>
      <div className={styles.FrameIndex}>{index + 1}</div>
      <div className={styles.FrameContent}>
        <div className={styles.FunctionName}>{frame.funcName}</div>
        {frame.fileName ? (
          <div className={styles.FileLocation}>
            <span className={styles.FileName}>{frame.fileName}</span>
            {frame.lineNum > 0 && (
              <span className={styles.LineNumber}>:{frame.lineNum}:{frame.colNum}</span>
            )}
          </div>
        ) : frame.fullLocation && frame.fullLocation !== frame.funcName ? (
          <div className={styles.FileLocation}>
            <span className={styles.FileName}>
              {frame.fullLocation.length > 60 
                ? `...${frame.fullLocation.slice(-60)}` 
                : frame.fullLocation
              }
            </span>
          </div>
        ) : null}
        <div className={styles.FullLocation}>{frame.fullLocation}</div>
      </div>
    </div>
  );
};

export default StackFrame;
