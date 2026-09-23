import React, { useState } from 'react';
import type { AdaptyStoreMessageType } from '@adapty/capacitor';
import { Capacitor } from '@capacitor/core';
import styles from '../App.module.css';
import { ButtonGroup } from '../components/ButtonGroup';
import { InfoBox, InfoRow } from '../components/InfoBox';
import { elementIds } from '../../../elementIds';

const KNOWN_TYPES: readonly AdaptyStoreMessageType[] = [
  'generic',
  'price_increase_consent',
  'billing_issue',
  'win_back_offer',
];

type Props = {
  isActivated: boolean;
  storeMessagesHandling: 'auto' | 'manual';
  // undefined: not requested yet, null: the store cannot report them (Android)
  pendingTypes: AdaptyStoreMessageType[] | null | undefined;
  getPendingStoreMessageTypes: () => Promise<void>;
  showStoreMessages: (filter?: AdaptyStoreMessageType[]) => Promise<void>;
  showStoreMessagesTwice: () => Promise<void>;
};

export const StoreMessagesSection: React.FC<Props> = ({
  isActivated,
  storeMessagesHandling,
  pendingTypes,
  getPendingStoreMessageTypes,
  showStoreMessages,
  showStoreMessagesTwice,
}) => {
  const [selected, setSelected] = useState<AdaptyStoreMessageType[]>([]);
  const isAndroid = Capacitor.getPlatform() === 'android';

  // Opaque storekit_<n> types only show up via the pending snapshot, so offer them as filter options too
  const filterOptions = [...KNOWN_TYPES, ...(pendingTypes ?? []).filter((type) => !KNOWN_TYPES.includes(type))];

  const toggle = (type: AdaptyStoreMessageType) =>
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));

  return (
    <div className={styles.Section}>
      <h3 className={styles.SectionTitle}>Store Messages</h3>

      <InfoBox>
        <InfoRow id={elementIds.storeMessages.modeValue}>
          <strong>Mode:</strong> {storeMessagesHandling}
          {storeMessagesHandling === 'auto' && ' — the store shows messages itself, the iOS queue stays empty'}
        </InfoRow>
        {isAndroid && (
          <InfoRow>
            Android: pending types are always <code>null</code> (Google Play cannot report them); the filter is iOS only
            and is not sent, so every show shows everything
          </InfoRow>
        )}
      </InfoBox>

      <ButtonGroup>
        <button
          id={elementIds.storeMessages.getPendingBtn}
          onClick={getPendingStoreMessageTypes}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Get pending types
        </button>
      </ButtonGroup>

      <div id={elementIds.storeMessages.pendingValue}>
        Pending:{' '}
        {pendingTypes === undefined ? '—' : pendingTypes === null ? 'null (unknown)' : JSON.stringify(pendingTypes)}
      </div>

      <label>Filter:</label>
      {filterOptions.map((type) => (
        <div
          key={type}
          id={elementIds.storeMessages.filterTypeToggle(type)}
          className={styles.ClickableParam}
          onClick={() => toggle(type)}
        >
          <span>{type}</span>
          <span className={styles.ParamValue}>{selected.includes(type).toString()}</span>
        </div>
      ))}
      <div id={elementIds.storeMessages.filterValue}>filter: {JSON.stringify(selected)}</div>

      <ButtonGroup>
        <button
          id={elementIds.storeMessages.showAllBtn}
          onClick={() => showStoreMessages()}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonPrimary}`}
        >
          Show all (no filter)
        </button>
        <button
          id={elementIds.storeMessages.showFilteredBtn}
          onClick={() => showStoreMessages(selected)}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Show with filter {selected.length === 0 ? '[] (no-op)' : `(${selected.length})`}
        </button>
        <button
          id={elementIds.storeMessages.showTwiceBtn}
          onClick={showStoreMessagesTwice}
          disabled={!isActivated}
          className={`${styles.Button} ${styles.ButtonSecondary}`}
        >
          Show all twice at once
        </button>
      </ButtonGroup>
    </div>
  );
};
