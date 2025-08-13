// Constants for error messages
const ADAPTY_PREFIX = '[ADAPTY]';
const CREDENTIALS_FILE = '.adapty-credentials.json';
const CREDENTIALS_COMMAND = "Please run 'yarn run credentials' to generate the credentials file.";

import credentialsFile from '../.adapty-credentials.json';

const credentials: { token?: string; placement_id?: string; ios_bundle?: string; android_application_id?: string } =
  credentialsFile;

export function getApiKey(): string {
  if (!credentials?.token) {
    throw new Error(`${ADAPTY_PREFIX} Token not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.token;
}

export function getPlacementId(): string {
  if (!credentials?.placement_id) {
    throw new Error(`${ADAPTY_PREFIX} Placement ID not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.placement_id;
}

export function getIosBundle(): string {
  if (!credentials?.ios_bundle) {
    throw new Error(`${ADAPTY_PREFIX} iOS bundle not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.ios_bundle;
}

export function getAndroidApplicationId(): string {
  if (!credentials?.android_application_id) {
    throw new Error(
      `${ADAPTY_PREFIX} Android application id not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`,
    );
  }
  return credentials.android_application_id;
}

export interface JsLog {
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  message: string;
  funcName: string;
  args: any[];
  isoDate: string;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  const milliseconds = d.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function dateFormat(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString() + ', ' + d.toLocaleTimeString();
}
