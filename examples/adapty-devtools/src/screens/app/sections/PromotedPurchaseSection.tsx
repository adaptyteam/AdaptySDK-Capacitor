import React from 'react';
import type { AdaptyPromotedProduct } from '@adapty/capacitor';
import styles from '../App.module.css';
import { ButtonGroup } from '../components/ButtonGroup';
import { elementIds } from '../../../elementIds';
import { describePromotedProduct } from '../../../services/promotedPurchase';

type Props = {
  isActivated: boolean;
  appHandlesPromoted: boolean;
  promotedProduct: AdaptyPromotedProduct | null;
  setAppHandlesPromoted: (v: boolean) => void;
  buyLastPromotedProduct: () => Promise<void>;
};

export const PromotedPurchaseSection: React.FC<Props> = ({
  isActivated,
  appHandlesPromoted,
  promotedProduct,
  setAppHandlesPromoted,
  buyLastPromotedProduct,
}) => {
  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Promoted Purchases (iOS)</h3>

      <div id={elementIds.promoted.ownerValue}>
        {appHandlesPromoted
          ? 'App owns the purchase — tap Buy or nothing happens'
          : 'SDK completes the purchase automatically'}
      </div>

      <ButtonGroup>
        <button
          id={elementIds.promoted.useSdkDefaultBtn}
          onClick={() => setAppHandlesPromoted(false)}
          disabled={!isActivated || !appHandlesPromoted}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          SDK default
        </button>
        <button
          id={elementIds.promoted.useAppHandlerBtn}
          onClick={() => setAppHandlesPromoted(true)}
          disabled={!isActivated || appHandlesPromoted}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          App handles
        </button>
      </ButtonGroup>

      <div id={elementIds.promoted.lastProductValue}>
        Last promoted product: {promotedProduct ? describePromotedProduct(promotedProduct) : '—'}
      </div>

      <ButtonGroup>
        <button
          id={elementIds.promoted.buyBtn}
          onClick={buyLastPromotedProduct}
          disabled={!isActivated || !promotedProduct}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Buy last promoted product
        </button>
      </ButtonGroup>
    </div>
  );
};
