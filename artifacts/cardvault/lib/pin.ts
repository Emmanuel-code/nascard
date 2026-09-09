import { Platform } from 'react-native';

const STATIC_SALT = 'nascard-pin-v2-salted';

async function getCrypto() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-crypto'); } catch { return null; }
}

export async function hashPin(pin: string, userSalt = 'user-vault-salt'): Promise<string> {
  const Crypto = await getCrypto();
  const salt = `${STATIC_SALT}:${userSalt}`;
  if (!Crypto) {
    return btoa(salt + pin);
  }

  // Multi-pass hash iteration for key stretching
  let currentHash = pin;
  for (let i = 0; i < 5; i++) {
    currentHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${i}:${currentHash}`,
    );
  }
  return currentHash;
}

export async function verifyPin(pin: string, storedHash: string, userSalt = 'user-vault-salt'): Promise<boolean> {
  const hash = await hashPin(pin, userSalt);
  if (hash === storedHash) return true;

  // Backward compatibility check for legacy SHA-256 single-pass
  const Crypto = await getCrypto();
  if (Crypto) {
    const legacyHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'nascard-pin-v1' + pin,
    );
    if (legacyHash === storedHash) return true;
  } else {
    if (btoa('nascard-pin-v1' + pin) === storedHash) return true;
  }

  return false;
}
