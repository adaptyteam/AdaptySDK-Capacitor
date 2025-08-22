import { adapty } from '@adapty/capacitor';
import type { JsLog } from '../helpers';
import { createLog } from '../helpers';

export class EventListenersManager {
  async setup(appendLog: (log: JsLog) => void, setProfile: (profile: any) => void): Promise<void> {
    await adapty.addListener('onLatestProfileLoad', (data) => {
      const logMessage = `Profile loaded from event: ${data.profile.profileId}`;
      appendLog(createLog('info', logMessage, 'event handler onLatestProfileLoad', false, { data }));

      // Update profile in app context
      setProfile(data.profile);
    });

    await adapty.addListener('onInstallationDetailsSuccess', (data) => {
      const logMessage = `Installation details received successfully`;
      appendLog(createLog('info', logMessage, 'event handler onInstallationDetailsSuccess', false, { data }));
    });

    await adapty.addListener('onInstallationDetailsFail', (data) => {
      const logMessage = `Installation details failed: ${data.error?.message || 'Unknown error'}`;
      appendLog(createLog('error', logMessage, 'event handler onInstallationDetailsFail', false, { data }));
    });

    appendLog(createLog('info', 'All event listeners registered successfully', 'EventListenersManager.setup', false));
  }

  async cleanup(): Promise<void> {
    await adapty.removeAllListeners();
  }
}

// Export singleton instance
export const eventListenersManager = new EventListenersManager();
