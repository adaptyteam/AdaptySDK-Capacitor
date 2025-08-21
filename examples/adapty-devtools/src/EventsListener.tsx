import { useEffect, useRef } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { adapty } from '@adapty/capacitor';

import { useLogs } from './contexts/LogsContext';
import { useAppContext } from './contexts/AppContext';
import { createLog } from './helpers';

export default function EventsListener() {
  const { append: appendLog } = useLogs();
  const { setProfile } = useAppContext();
  const listenerHandlesRef = useRef<PluginListenerHandle[]>([]);

  useEffect(() => {
    const setupEventListeners = async () => {
      try {
        const profileListener = await adapty.addListener('onLatestProfileLoad', (data) => {
          const logMessage = `Profile loaded from event: ${data.profile.profileId}`;
          appendLog(createLog('info', logMessage, 'event handler onLatestProfileLoad', false, { data }));

          // Update profile in app context
          setProfile(data.profile);
        });
        listenerHandlesRef.current.push(profileListener);

        const installationSuccessListener = await adapty.addListener('onInstallationDetailsSuccess', (data) => {
          alert('installationSuccessListener')
          const logMessage = `Installation details received successfully`;
          appendLog(createLog('info', logMessage, 'event handler onInstallationDetailsSuccess', false, { data }));
        });
        listenerHandlesRef.current.push(installationSuccessListener);

        const installationFailListener = await adapty.addListener('onInstallationDetailsFail', (data) => {
          const logMessage = `Installation details failed: ${data.error?.message || 'Unknown error'}`;
          appendLog(createLog('error', logMessage, 'event handler onInstallationDetailsFail', false, { data }));
        });
        listenerHandlesRef.current.push(installationFailListener);
        appendLog(createLog('info', 'All event listeners registered successfully', 'EventsListener.setup', false));
      } catch (error) {
        const errorMessage = `Failed to setup event listeners: ${error}`;
        appendLog(createLog('error', errorMessage, 'EventsListener.setup', false));
      }
    };

    setupEventListeners();
    return () => {
      // Remove all listeners
      adapty.removeAllListeners();
      //listenerHandlesRef.current = [];
    };
  }, [appendLog, setProfile]);

  return null;
}
