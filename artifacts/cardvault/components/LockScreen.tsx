import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PinPad } from '@/components/PinPad';
import { verifyPin } from '@/lib/pin';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/contexts/ProfileContext';

interface Props {
  onUnlocked: () => void;
}

async function getLocalAuth() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-local-authentication'); } catch { return null; }
}

type Mode = 'checking' | 'biometric' | 'pin';

export function LockScreen({ onUnlocked }: Props) {
  const colors = useColors();
  const { profile } = useProfile();
  const [mode, setMode] = useState<Mode>('checking');
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [pinError, setPinError] = useState<string | null>(null);

  const hasBiometrics = biometricType !== 'none';
  const hasPin = !!profile.pinHash;

  const detect = useCallback(async () => {
    const LA = await getLocalAuth();
    if (!LA) {
      // no native auth — fall to PIN if set, else unlock
      if (hasPin) { setMode('pin'); } else { onUnlocked(); }
      return;
    }
    const enrolled = await LA.isEnrolledAsync();
    const types = await LA.supportedAuthenticationTypesAsync();
    if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) setBiometricType('face');
    else if (types.includes(LA.AuthenticationType.FINGERPRINT)) setBiometricType('fingerprint');

    if (enrolled) {
      setMode('biometric');
    } else if (hasPin) {
      setMode('pin');
    } else {
      onUnlocked();
    }
  }, [hasPin, onUnlocked]);

  useEffect(() => { detect(); }, [detect]);

  const tryBiometric = useCallback(async () => {
    const LA = await getLocalAuth();
    if (!LA) return;
    const result = await LA.authenticateAsync({
      promptMessage: 'Unlock nascard',
      fallbackLabel: hasPin ? 'Use PIN' : 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: !hasPin, // if no PIN, allow device passcode fallback
    });
    if (result.success) {
      onUnlocked();
    } else if (result.error === 'user_fallback' && hasPin) {
      setMode('pin');
    }
  }, [hasPin, onUnlocked]);

  useEffect(() => {
    if (mode === 'biometric') tryBiometric();
  }, [mode, tryBiometric]);

  const handlePinComplete = useCallback(async (pin: string) => {
    if (!profile.pinHash) { onUnlocked(); return; }
    const ok = await verifyPin(pin, profile.pinHash);
    if (ok) {
      setPinError(null);
      onUnlocked();
    } else {
      setPinError('Incorrect PIN. Try again.');
    }
  }, [profile.pinHash, onUnlocked]);

  const icon = biometricType === 'face' ? 'scan-outline' : biometricType === 'fingerprint' ? 'finger-print-outline' : 'lock-closed-outline';
  const label = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Touch ID' : 'Passcode';

  if (mode === 'pin') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.shieldWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <Ionicons name="keypad-outline" size={34} color={colors.primary} />
        </View>
        <PinPad
          title="Enter PIN"
          subtitle="Enter your nascard PIN to unlock"
          onComplete={handlePinComplete}
          error={pinError}
        />
        {hasBiometrics && (
          <TouchableOpacity onPress={() => { setMode('biometric'); }} style={styles.switchBtn}>
            <Ionicons name={icon as any} size={18} color={colors.primary} />
            <Text style={[styles.switchText, { color: colors.primary }]}>Use {label} instead</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>nascard is locked</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Authenticate to access your cards
        </Text>

        {mode === 'checking' ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            <TouchableOpacity
              onPress={tryBiometric}
              style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Ionicons name={icon as any} size={20} color={colors.primaryForeground} />
              <Text style={[styles.unlockText, { color: colors.primaryForeground }]}>
                Unlock with {label}
              </Text>
            </TouchableOpacity>

            {hasPin && (
              <TouchableOpacity onPress={() => setMode('pin')} style={styles.switchBtn}>
                <Ionicons name="keypad-outline" size={18} color={colors.primary} />
                <Text style={[styles.switchText, { color: colors.primary }]}>Use PIN instead</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  center: { alignItems: 'center', paddingHorizontal: 40 },
  shieldWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 36,
  },
  unlockText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 8 },
  switchText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
