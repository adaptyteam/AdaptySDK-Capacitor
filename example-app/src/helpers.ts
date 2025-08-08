// Constants for error messages
const ADAPTY_PREFIX = '[ADAPTY]';
const CREDENTIALS_FILE = '.adapty-credentials.json';
const CREDENTIALS_COMMAND = "Please run 'yarn run credentials' to generate the credentials file.";

import credentialsFile from '../.adapty-credentials.json';

const credentials: { token?: string; placement_id?: string; ios_bundle?: string } = credentialsFile;

// This function is only for this example
export function getApiKey(): string {
  if (!credentials?.token) {
    throw new Error(`${ADAPTY_PREFIX} Token not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.token;
}

// This function is only for this example
export function getPlacementId(): string {
  if (!credentials?.placement_id) {
    throw new Error(`${ADAPTY_PREFIX} Placement ID not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.placement_id;
}

// This function is only for this example
export function getIosBundle(): string {
  if (!credentials?.ios_bundle) {
    throw new Error(`${ADAPTY_PREFIX} iOS bundle not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`);
  }
  return credentials.ios_bundle;
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
  return d.toLocaleTimeString() + '.' + d.getMilliseconds().toString().padStart(3, '0');
}

export function dateFormat(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString() + ', ' + d.toLocaleTimeString();
}
