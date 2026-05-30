import { Platform } from 'react-native';

const SALT = 'cardvault-pin-v1';

async function getCrypto() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-crypto'); } catch { return null; }
}

export async function hashPin(pin: string): Promise<string> {
  const Crypto = await getCrypto();
  if (!Crypto) {
    // web fallback — simple non-secure hash (PIN lock disabled on web anyway)
    return btoa(SALT + pin);
  }
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    SALT + pin,
  );
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}
