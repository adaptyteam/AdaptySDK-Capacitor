import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AdaptyProfile, AdaptyPaywall, AdaptyPaywallProduct, AdaptyOnboarding } from '@adapty/capacitor';
import { getPlacementId, getOnboardingPlacementId } from '../helpers';

// Types for the context state
interface AppState {
  // SDK activation
  isActivated: boolean;

  // Core Adapty data
  profile: AdaptyProfile | null;
  paywall: AdaptyPaywall | null;
  products: AdaptyPaywallProduct[];
  onboarding: AdaptyOnboarding | null;
  paywallView: any | null;

  // User data
  customerUserId: string;
  transactionId: string;
  variationId: string;
  webPaywallUrl: string;

  // Integration settings
  integrationIdKey: string;
  integrationIdValue: string;

  // Refund settings
  collectingRefundDataConsent: boolean;
  refundPreferenceIdx: number;

  // Paywall configuration
  placementId: string;
  onboardingPlacementId: string;
  locale: string;
  timeout: string;
  maxAge: string;
  customTagsJson: string;
  fetchPolicyIndex: number;
}

// Types for the context actions
interface AppActions {
  // SDK activation
  setIsActivated: (value: boolean) => void;

  // Core Adapty data
  setProfile: (value: AdaptyProfile | null) => void;
  setPaywall: (value: AdaptyPaywall | null) => void;
  setProducts: (value: AdaptyPaywallProduct[]) => void;
  setOnboarding: (value: AdaptyOnboarding | null) => void;
  setPaywallView: (value: any | null) => void;

  // User data
  setCustomerUserId: (value: string) => void;
  setTransactionId: (value: string) => void;
  setVariationId: (value: string) => void;
  setWebPaywallUrl: (value: string) => void;

  // Integration settings
  setIntegrationIdKey: (value: string) => void;
  setIntegrationIdValue: (value: string) => void;

  // Refund settings
  setCollectingRefundDataConsent: (value: boolean) => void;
  setRefundPreferenceIdx: (value: number) => void;

  // Paywall configuration
  setPlacementId: (value: string) => void;
  setOnboardingPlacementId: (value: string) => void;
  setLocale: (value: string) => void;
  setLoadTimeout: (value: string) => void;
  setMaxAge: (value: string) => void;
  setCustomTagsJson: (value: string) => void;
  setFetchPolicyIndex: (value: number) => void;

  // Utility actions
  resetAllData: () => void;
}

// Combined context type
type AppContextType = AppState & AppActions;

// Default state values
const defaultState: AppState = {
  // SDK activation
  isActivated: false,

  // Core Adapty data
  profile: null,
  paywall: null,
  products: [],
  onboarding: null,
  paywallView: null,

  // User data
  customerUserId: '',
  transactionId: '',
  variationId: '',
  webPaywallUrl: '',

  // Integration settings
  integrationIdKey: 'one_signal_subscription_id',
  integrationIdValue: 'testOSSubId',

  // Refund settings
  collectingRefundDataConsent: false,
  refundPreferenceIdx: 0,

  // Paywall configuration
  placementId: getPlacementId(),
  onboardingPlacementId: getOnboardingPlacementId(),
  locale: '',
  timeout: '6000',
  maxAge: '120',
  customTagsJson: '{"USER":"Bruce","CITY":"Philadelphia"}',
  fetchPolicyIndex: 0,
};

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component props
interface AppProviderProps {
  children: ReactNode;
}

// Provider component
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // SDK activation
  const [isActivated, setIsActivated] = useState<boolean>(defaultState.isActivated);

  // Core Adapty data
  const [profile, setProfile] = useState<AdaptyProfile | null>(defaultState.profile);
  const [paywall, setPaywall] = useState<AdaptyPaywall | null>(defaultState.paywall);
  const [products, setProducts] = useState<AdaptyPaywallProduct[]>(defaultState.products);
  const [onboarding, setOnboarding] = useState<AdaptyOnboarding | null>(defaultState.onboarding);
  const [paywallView, setPaywallView] = useState<any | null>(defaultState.paywallView);

  // User data
  const [customerUserId, setCustomerUserId] = useState<string>(defaultState.customerUserId);
  const [transactionId, setTransactionId] = useState<string>(defaultState.transactionId);
  const [variationId, setVariationId] = useState<string>(defaultState.variationId);
  const [webPaywallUrl, setWebPaywallUrl] = useState<string>(defaultState.webPaywallUrl);

  // Integration settings
  const [integrationIdKey, setIntegrationIdKey] = useState<string>(defaultState.integrationIdKey);
  const [integrationIdValue, setIntegrationIdValue] = useState<string>(defaultState.integrationIdValue);

  // Refund settings
  const [collectingRefundDataConsent, setCollectingRefundDataConsent] = useState<boolean>(
    defaultState.collectingRefundDataConsent,
  );
  const [refundPreferenceIdx, setRefundPreferenceIdx] = useState<number>(defaultState.refundPreferenceIdx);

  // Paywall configuration
  const [placementId, setPlacementId] = useState<string>(defaultState.placementId);
  const [onboardingPlacementId, setOnboardingPlacementId] = useState<string>(defaultState.onboardingPlacementId);
  const [locale, setLocale] = useState<string>(defaultState.locale);
  const [timeout, setLoadTimeout] = useState<string>(defaultState.timeout);
  const [maxAge, setMaxAge] = useState<string>(defaultState.maxAge);
  const [customTagsJson, setCustomTagsJson] = useState<string>(defaultState.customTagsJson);
  const [fetchPolicyIndex, setFetchPolicyIndex] = useState<number>(defaultState.fetchPolicyIndex);

  // Utility function to reset all data
  const resetAllData = () => {
    setIsActivated(defaultState.isActivated);
    setProfile(defaultState.profile);
    setPaywall(defaultState.paywall);
    setProducts(defaultState.products);
    setOnboarding(defaultState.onboarding);
    setPaywallView(defaultState.paywallView);
    setCustomerUserId(defaultState.customerUserId);
    setTransactionId(defaultState.transactionId);
    setVariationId(defaultState.variationId);
    setWebPaywallUrl(defaultState.webPaywallUrl);
    setIntegrationIdKey(defaultState.integrationIdKey);
    setIntegrationIdValue(defaultState.integrationIdValue);
    setCollectingRefundDataConsent(defaultState.collectingRefundDataConsent);
    setRefundPreferenceIdx(defaultState.refundPreferenceIdx);
    setPlacementId(getPlacementId());
    setOnboardingPlacementId(getOnboardingPlacementId());
    setLocale(defaultState.locale);
    setLoadTimeout(defaultState.timeout);
    setMaxAge(defaultState.maxAge);
    setCustomTagsJson(defaultState.customTagsJson);
    setFetchPolicyIndex(defaultState.fetchPolicyIndex);
  };

  const value: AppContextType = {
    // State
    isActivated,
    profile,
    paywall,
    products,
    onboarding,
    paywallView,
    customerUserId,
    transactionId,
    variationId,
    webPaywallUrl,
    integrationIdKey,
    integrationIdValue,
    collectingRefundDataConsent,
    refundPreferenceIdx,
    placementId,
    onboardingPlacementId,
    locale,
    timeout,
    maxAge,
    customTagsJson,
    fetchPolicyIndex,

    // Actions
    setIsActivated,
    setProfile,
    setPaywall,
    setProducts,
    setOnboarding,
    setPaywallView,
    setCustomerUserId,
    setTransactionId,
    setVariationId,
    setWebPaywallUrl,
    setIntegrationIdKey,
    setIntegrationIdValue,
    setCollectingRefundDataConsent,
    setRefundPreferenceIdx,
    setPlacementId,
    setOnboardingPlacementId,
    setLocale,
    setLoadTimeout,
    setMaxAge,
    setCustomTagsJson,
    setFetchPolicyIndex,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use the app context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
