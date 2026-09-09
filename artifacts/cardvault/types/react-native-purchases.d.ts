/**
 * Type declaration shim for react-native-purchases.
 * This file satisfies TypeScript while the native package is being installed.
 * Once `pnpm install` is run and the native build is made, this file can be deleted
 * as the real types from the package will take precedence.
 */
declare module 'react-native-purchases' {
  export enum LOG_LEVEL {
    VERBOSE = 'VERBOSE',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
  }

  export interface PurchasesProduct {
    productIdentifier: string;
    localizedTitle: string;
    localizedDescription: string;
    priceString: string;
    price: number;
    currencyCode: string;
    description: string;
  }

  export interface PurchasesPackage {
    identifier: string;
    packageType: string;
    product: PurchasesProduct;
    offeringIdentifier: string;
  }

  export interface PurchasesOffering {
    identifier: string;
    serverDescription: string;
    availablePackages: PurchasesPackage[];
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
    lifetime: PurchasesPackage | null;
    sixMonth: PurchasesPackage | null;
    threeMonth: PurchasesPackage | null;
    twoMonth: PurchasesPackage | null;
    weekly: PurchasesPackage | null;
  }

  export interface PurchasesOfferings {
    all: Record<string, PurchasesOffering>;
    current: PurchasesOffering | null;
  }

  export interface PurchasesEntitlementInfo {
    identifier: string;
    isActive: boolean;
    willRenew: boolean;
    periodType: string;
    latestPurchaseDate: string;
    originalPurchaseDate: string;
    expirationDate: string | null;
    store: string;
    productIdentifier: string;
    isSandbox: boolean;
    unsubscribeDetectedAt: string | null;
    billingIssueDetectedAt: string | null;
  }

  export interface PurchasesEntitlementInfos {
    all: Record<string, PurchasesEntitlementInfo>;
    active: Record<string, PurchasesEntitlementInfo>;
  }

  export interface CustomerInfo {
    entitlements: PurchasesEntitlementInfos;
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
    latestExpirationDate: string | null;
    firstSeen: string;
    originalAppUserId: string;
    requestDate: string;
  }

  export interface MakePurchaseResult {
    productIdentifier: string;
    customerInfo: CustomerInfo;
    transaction: Record<string, unknown>;
  }

  export interface PurchasesConfiguration {
    apiKey: string;
    appUserID?: string | null;
    observerMode?: boolean;
    userDefaultsSuiteName?: string;
    useAmazon?: boolean;
  }

  const Purchases: {
    setLogLevel(level: LOG_LEVEL): void;
    configure(configuration: PurchasesConfiguration): void;
    getCustomerInfo(): Promise<CustomerInfo>;
    getOfferings(): Promise<PurchasesOfferings>;
    purchasePackage(pkg: PurchasesPackage): Promise<MakePurchaseResult>;
    restorePurchases(): Promise<CustomerInfo>;
    logIn(appUserID: string): Promise<{ customerInfo: CustomerInfo; created: boolean }>;
    logOut(): Promise<CustomerInfo>;
    isConfigured(): Promise<boolean>;
  };

  export default Purchases;
}
