export type CardType = 'id' | 'health' | 'loyalty' | 'membership';
export type ProfileType = 'personal' | 'work' | 'student';
export type BarcodeFormat = 'qr' | 'code128' | 'code39';

export interface Card {
  id: string;
  profileId: ProfileType;
  cardType: CardType;
  title: string;
  nameOnCard: string;
  idNumber: string;
  expiryDate: string;
  frontImageUri: string | null;
  backImageUri: string | null;
  barcodeFormat: BarcodeFormat;
  barcodeValue: string;
  notes: string;
  isPartnerIssued: boolean;
  orgId?: string;
  orgName?: string;
  primaryColor?: string;
  accentColor?: string;
  customFields?: Record<string, string>;
  verificationToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldSchema {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'date';
  required: boolean;
  placeholder?: string;
}

export interface OrganizationPayoutRecord {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  reference: string;
}

export interface Organization {
  id: string;
  name: string;
  category: 'gym' | 'school' | 'club' | 'corporate' | 'community';
  description: string;
  location: string;
  managerName: string;
  managerEmail: string;
  primaryColor: string;
  accentColor: string;
  badgeStyle: 'holographic' | 'gold' | 'minimal' | 'modern';
  customFields: CustomFieldSchema[];
  membershipFee: number;
  membershipFeeInterval: 'one_time' | 'monthly' | 'yearly' | 'free';
  membershipFeeDescription: string;
  tier: 'starter' | 'pro' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
  requirePhoto?: boolean;
  idGenerationMode?: 'member_provided' | 'auto_generated';
  memberLimit: number;
  activeMemberCount: number;
  inviteCode: string;
  createdAt: string;
  managerPin?: string;
  totalGrossRevenue?: number;
  platformFeeCollected?: number;
  netBalance?: number;
  totalWithdrawn?: number;
  payoutBankDetails?: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  payoutHistory?: OrganizationPayoutRecord[];
}

export interface OrgMember {
  id: string;
  orgId: string;
  memberName: string;
  memberEmail?: string;
  customFieldsData: Record<string, string>;
  photoUri?: string | null;
  cardId: string;
  status: 'active' | 'expired' | 'revoked';
  verificationToken: string;
  joinedAt: string;
  expiresAt?: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  phone: string;
  activeProfile: ProfileType;
  hasCompletedOnboarding: boolean;
  appLockEnabled: boolean;
  notificationsEnabled: boolean;
  pinHash?: string;
}

export type ExpiryStatus = 'valid' | 'expiring' | 'expired';

export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  if (!expiryDate) return 'valid';
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'expired';
  if (days < 7) return 'expiring';
  return 'valid';
}

export function getDaysUntilExpiry(expiryDate: string): number {
  if (!expiryDate) return 9999;
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatExpiry(expiryDate: string): string {
  if (!expiryDate) return '';
  const d = new Date(expiryDate);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  return `${month}/${year}`;
}
