// Constants for error messages
const ADAPTY_PREFIX = '[ADAPTY]';
const CREDENTIALS_FILE = '.adapty-credentials.json';
const CREDENTIALS_COMMAND = "Please run 'yarn run credentials' to generate the credentials file.";

import credentialsFile from '../.adapty-credentials.json';

const credentials: {
  token?: string;
  placement_id?: string;
  onboarding_placement_id?: string;
  ios_bundle?: string;
  android_application_id?: string;
} = credentialsFile;

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

export function getOnboardingPlacementId(): string {
  if (!credentials?.onboarding_placement_id) {
    throw new Error(
      `${ADAPTY_PREFIX} Onboarding Placement ID not found in ${CREDENTIALS_FILE} file. ${CREDENTIALS_COMMAND}`,
    );
  }
  return credentials.onboarding_placement_id;
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
  isSDK: boolean;
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

const funcNameColors = [
  '#FF6B8A',
  '#FFD93D',
  '#6BCF7F',
  '#4DABF7',
  '#9775FA',
  '#FF8787',
  '#74C0FC',
  '#F783AC',
  '#FFB84D',
  '#C084FC',
  '#51CF66',
  '#FFE066',
  '#66D9EF',
  '#FF9F43',
  '#845EC2',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FECA57',
  '#FF9FF3',
  '#54A0FF',
  '#5F27CD',
  '#00D2D3',
  '#FF9F1A',
];

function hashFuncName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getFuncNameColor(funcName: string): string {
  const hash = hashFuncName(funcName);
  return funcNameColors[hash % funcNameColors.length];
}

export function getLogLevelColor(level: string): string {
  switch (level) {
    case 'error':
      return '#ff4444';
    case 'warn':
      return '#ffaa00';
    case 'info':
      return '#4777ff';
    case 'debug':
      return '#888888';
    case 'verbose':
      return '#666666';
    default:
      return '#000000';
  }
}

export function createLog(
  logLevel: JsLog['logLevel'],
  message: string,
  funcName: string,
  isSDK: boolean,
  args: any[] = [],
): JsLog {
  return {
    logLevel,
    message,
    funcName,
    args,
    isoDate: new Date().toISOString(),
    isSDK,
  };
}
