import { useEffect, useRef } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import { adapty } from '@adapty/capacitor';

import { useLogs } from './contexts/LogsContext';
import { useAppContext } from './contexts/AppContext';
import { createLog } from './helpers';

export default function EventsListener() {
  const { append: appendLog } = useLogs();
  const { setProfile } = useAppContext();
  const listenerHandleRef = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    const setupEventListener = async () => {
      try {
        listenerHandleRef.current = await adapty.addListener('onLatestProfileLoad', (data) => {
          const logMessage = `Profile loaded from event: ${data.profile.profileId}`;
          appendLog(createLog('info', logMessage, 'event handler onLatestProfileLoad', false, [data]));
          
          // Update profile in app context
          setProfile(data.profile);
        });
        
        appendLog(createLog('info', 'onLatestProfileLoad event listener registered', 'EventsListener.setup', false));
        
      } catch (error) {
        const errorMessage = `Failed to setup event listener: ${error}`;
        appendLog(createLog('error', errorMessage, 'EventsListener.setup', false));
      }
    };

    setupEventListener();

    return () => {
      if (listenerHandleRef.current) {
        listenerHandleRef.current.remove().catch((error) => {
          appendLog(createLog('error', `Failed to remove event listener: ${error}`, 'EventsListener.cleanup', false));
        });
        listenerHandleRef.current = null;
      }
    };
  }, [appendLog, setProfile]);

  return null;
}
