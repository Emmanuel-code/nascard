/**
 * Currency & withdrawal region utilities for NasCard.
 */

export interface WithdrawalProvider {
  code: string;
  name: string;
  type: 'momo' | 'bank';
}

export type WithdrawalRegion = 'gh' | 'ng' | 'manual';

/** Map country code → withdrawal region */
export function getWithdrawalRegion(country?: string): WithdrawalRegion {
  if (!country) return 'gh';
  const c = country.toUpperCase();
  if (c === 'GH') return 'gh';
  if (c === 'NG') return 'ng';
  return 'manual';
}

/** Map country code → ISO 4217 currency code */
export function getCurrencyCode(country?: string): string {
  if (!country) return 'GHS';
  const c = country.toUpperCase();
  if (c === 'GH') return 'GHS';
  if (c === 'NG') return 'NGN';
  if (c === 'US') return 'USD';
  if (c === 'GB') return 'GBP';
  if (c === 'CA') return 'CAD';
  if (['DE', 'FR', 'NL', 'IT', 'ES'].includes(c)) return 'EUR';
  return 'USD';
}

/** Map currency code → symbol */
export function getCurrencySymbol(currency?: string): string {
  const c = (currency || 'GHS').toUpperCase();
  const map: Record<string, string> = {
    GHS: 'GH₵', NGN: '₦', USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$',
  };
  return map[c] ?? c;
}

/** Format an amount with the correct symbol */
export function formatAmount(amount: number, currency?: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Ghana-specific payout providers (Paystack) ────────────────────────────────
export const GH_MOMO_PROVIDERS: WithdrawalProvider[] = [
  { code: 'MTN', name: 'MTN Mobile Money', type: 'momo' },
  { code: 'VODAFONE', name: 'Telecel Cash', type: 'momo' },
  { code: 'AIRTELTIGO', name: 'AirtelTigo Money', type: 'momo' },
];

export const GH_BANKS: WithdrawalProvider[] = [
  { code: 'GCB', name: 'GCB Bank', type: 'bank' },
  { code: 'ECOBANK', name: 'Ecobank Ghana', type: 'bank' },
  { code: 'STANBIC', name: 'Stanbic Bank Ghana', type: 'bank' },
  { code: 'ABSA', name: 'Absa Bank Ghana', type: 'bank' },
  { code: 'FIDELITY', name: 'Fidelity Bank Ghana', type: 'bank' },
  { code: 'CALBANK', name: 'CalBank', type: 'bank' },
  { code: 'ACCESS_GH', name: 'Access Bank Ghana', type: 'bank' },
  { code: 'CBG', name: 'Consolidated Bank Ghana (CBG)', type: 'bank' },
];

// ── Nigeria-specific payout providers (Paystack) ──────────────────────────────
export const NG_BANKS: WithdrawalProvider[] = [
  { code: 'GTB', name: 'GTBank', type: 'bank' },
  { code: 'ACCESS', name: 'Access Bank', type: 'bank' },
  { code: 'ZENITH', name: 'Zenith Bank', type: 'bank' },
  { code: 'UBA', name: 'UBA', type: 'bank' },
  { code: 'FIRSTBANK', name: 'First Bank', type: 'bank' },
  { code: 'STANBIC_NG', name: 'Stanbic IBTC', type: 'bank' },
  { code: 'OPAY', name: 'OPay', type: 'momo' },
  { code: 'PALMPAY', name: 'PalmPay', type: 'momo' },
];

// ── Flutterwave / Other payout providers ──────────────────────────────────────
export const FLW_PROVIDERS: WithdrawalProvider[] = [];

/** Return the payout methods available for a given region */
export function getProvidersForRegion(
  region: WithdrawalRegion,
  method: 'momo' | 'bank',
): WithdrawalProvider[] {
  if (region === 'gh') return method === 'momo' ? GH_MOMO_PROVIDERS : GH_BANKS;
  if (region === 'ng') return NG_BANKS;
  return [];
}

/** Human-readable region label */
export function getRegionLabel(region: WithdrawalRegion): string {
  const labels: Record<WithdrawalRegion, string> = {
    gh: 'Ghana (Paystack)',
    ng: 'Nigeria (Paystack)',
    manual: 'Contact Nascard Office / Dev Support',
  };
  return labels[region] ?? 'Contact Nascard Support';
}
