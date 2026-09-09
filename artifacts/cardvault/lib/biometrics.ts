import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export interface BiometricStatus {
  isAvailable: boolean;
  biometricType: 'Face ID' | 'Touch ID' | 'Biometrics' | 'PIN';
}

export async function checkBiometricAvailability(): Promise<BiometricStatus> {
  try {
    const LocalAuth = await import('expo-local-authentication');
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = await LocalAuth.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      return { isAvailable: false, biometricType: 'PIN' };
    }

    const types = await LocalAuth.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
      return { isAvailable: true, biometricType: 'Face ID' };
    }
    if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
      return { isAvailable: true, biometricType: 'Touch ID' };
    }
    return { isAvailable: true, biometricType: 'Biometrics' };
  } catch (e) {
    return { isAvailable: false, biometricType: 'PIN' };
  }
}

export async function authenticateBiometric(promptMessage = 'Unlock CardVault Vault'): Promise<boolean> {
  try {
    const LocalAuth = await import('expo-local-authentication');
    const res = await LocalAuth.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (res.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    }
  } catch (e) {
    console.warn('Biometric auth error', e);
  }
  return false;
}
