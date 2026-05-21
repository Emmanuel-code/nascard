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
import { useColors } from '@/hooks/useColors';

interface Props {
  onUnlocked: () => void;
}

async function getLocalAuth() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-local-authentication');
  } catch {
    return null;
  }
}

export function LockScreen({ onUnlocked }: Props) {
  const colors = useColors();
  const [checking, setChecking] = useState(true);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [failed, setFailed] = useState(false);

  const detect = useCallback(async () => {
    const LA = await getLocalAuth();
    if (!LA) { onUnlocked(); return; }
    const enrolled = await LA.isEnrolledAsync();
    if (!enrolled) { onUnlocked(); return; }
    const types = await LA.supportedAuthenticationTypesAsync();
    if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) {
      setBiometricType('face');
    } else if (types.includes(LA.AuthenticationType.FINGERPRINT)) {
      setBiometricType('fingerprint');
    } else {
      setBiometricType('none');
    }
    setChecking(false);
  }, [onUnlocked]);

  useEffect(() => { detect(); }, [detect]);

  const authenticate = useCallback(async () => {
    const LA = await getLocalAuth();
    if (!LA) { onUnlocked(); return; }
    setFailed(false);
    const result = await LA.authenticateAsync({
      promptMessage: 'Unlock CardVault',
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    if (result.success) {
      onUnlocked();
    } else {
      setFailed(true);
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (!checking) authenticate();
  }, [checking, authenticate]);

  const icon = biometricType === 'face' ? 'scan-outline' : biometricType === 'fingerprint' ? 'finger-print-outline' : 'lock-closed-outline';
  const label = biometricType === 'face' ? 'Face ID' : biometricType === 'fingerprint' ? 'Touch ID' : 'Passcode';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>CardVault is locked</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Authenticate to access your cards
        </Text>

        {checking ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <TouchableOpacity
            onPress={authenticate}
            style={[styles.unlockBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name={icon as any} size={20} color={colors.primaryForeground} />
            <Text style={[styles.unlockText, { color: colors.primaryForeground }]}>
              Unlock with {label}
            </Text>
          </TouchableOpacity>
        )}

        {failed && (
          <Text style={[styles.failText, { color: colors.expired }]}>
            Authentication failed. Try again.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 40 },
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
  failText: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 16, textAlign: 'center' },
});
