import { useEffect, useState, useRef } from 'react';
import { initializationService } from '../services/initialization';
import { useLogs } from '../contexts/LogsContext';
import { useAppContext } from '../contexts/AppContext';

interface UseInitializationServiceReturn {
  isReady: boolean;
}

export function useInitializationService(): UseInitializationServiceReturn {
  const [isReady, setIsReady] = useState(false);
  const isInitializingRef = useRef(false);

  const { append: appendLog } = useLogs();
  const { setProfile } = useAppContext();

  useEffect(() => {
    const initializeService = async () => {
      isInitializingRef.current = true;
      try {
        await initializationService.initialize(appendLog, setProfile);
        setIsReady(true);
      } finally {
        isInitializingRef.current = false;
      }
    };

    if (!initializationService.initialized && !isInitializingRef.current) {
      initializeService();
    }

    return () => {
      initializationService.cleanup();
      setIsReady(false);
    };
  }, [appendLog, setProfile]);

  return { isReady };
}
