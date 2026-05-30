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
  createdAt: string;
  updatedAt: string;
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
