import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from '@/components/PinPad';
import { useProfile } from '@/contexts/ProfileContext';
import { hashPin } from '@/lib/pin';
import { useColors } from '@/hooks/useColors';
import { pauseAppLock } from '@/lib/appLock';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function StartupSetupModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();

  const [step, setStep] = useState<1 | 2>(1); // 1 = PIN Lock Choice, 2 = Cloud Sync Choice
  const [pinStep, setPinStep] = useState<'set' | 'confirm'>('set');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState(profile.email || '');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20);

  const handlePinSet = async (enteredPin: string) => {
    if (pinStep === 'set') {
      setFirstPin(enteredPin);
      setPinStep('confirm');
      setPinError(null);
    } else {
      if (enteredPin === firstPin) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const pinHash = await hashPin(enteredPin);
        pauseAppLock(120000);
        await updateProfile({ pinHash, appLockEnabled: true });
        Alert.alert('App Lock Activated 🔒', 'Your 6-digit PIN has been saved.');
        setStep(2);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinError('PINs do not match. Try again.');
        setPinStep('set');
        setFirstPin('');
      }
    }
  };

  const handleFinishSetup = async (enableCloud: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (enableCloud && userEmail.trim()) {
      await updateProfile({ email: userEmail.trim() });
    }
    await updateProfile({ setupCompleted: true } as any);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => handleFinishSetup(false)}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.cardContainer,
            { backgroundColor: colors.card, paddingTop: topPad + 16, paddingBottom: bottomPad + 16 },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.appBadgeRow}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[styles.appBadgeTitle, { color: colors.foreground }]}>Welcome to nascard</Text>
            </View>
            <TouchableOpacity onPress={() => handleFinishSetup(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Progress bar — 3 steps now (0, 1, 2) */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, { backgroundColor: colors.primary, flex: step <= 1 ? 2 : 1 }]} />
            <View style={[styles.progressDot, { backgroundColor: step >= 2 ? colors.primary : colors.border, flex: step === 2 ? 2 : 1 }]} />
          </View>

          {/* STEP 0: Onboarding Welcome Intro */}
          {step === 1 && !firstPin ? (
            <View style={{ gap: 20, alignItems: 'center', paddingHorizontal: 8 }}>
              <LinearGradient
                colors={['#0F172A', '#1E3A8A']}
                style={styles.iconGraphicWrap}
              >
                <Ionicons name="wallet" size={44} color="#FFFFFF" />
              </LinearGradient>

              <Text style={[styles.slideTitle, { color: colors.foreground }]}>Your Digital ID Wallet</Text>
              <Text style={[styles.slideSub, { color: colors.mutedForeground }]}>
                nascard turns all your physical cards — student IDs, gym passes, loyalty cards, and staff badges — into secure 3D digital passes on your phone.
              </Text>

              {/* 3 key features */}
              {[
                { icon: 'card', label: 'Store unlimited digital ID cards in one vault' },
                { icon: 'qr-code', label: 'Show a secure gate-pass QR to guards in seconds' },
                { icon: 'ticket', label: 'Join an organisation pass studio with an invite code' },
              ].map((f) => (
                <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary + '1F', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={f.icon as any} size={18} color={colors.primary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{f.label}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, width: '100%' }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep(1); setPinStep('set'); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Get Started →</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleFinishSetup(false)}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Skip setup for now</Text>
              </TouchableOpacity>
            </View>
          ) : step === 1 ? (
            <View style={{ gap: 14, alignItems: 'center' }}>
              <LinearGradient
                colors={['#1E3A8A', '#3B82F6']}
                style={styles.iconGraphicWrap}
              >
                <Ionicons name="lock-closed" size={44} color="#FFFFFF" />
              </LinearGradient>

              <Text style={[styles.slideTitle, { color: colors.foreground }]}>Secure Your Vault</Text>
              <Text style={[styles.slideSub, { color: colors.mutedForeground }]}>
                Set a 6-digit PIN to protect your digital ID cards whenever you open nascard.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => setStep(1)}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Set 6-Digit Security PIN</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep(2)}>
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now (Can enable in Profile)</Text>
              </TouchableOpacity>

              {/* PinPad Inline Modal */}
              {firstPin !== '' || pinStep === 'confirm' ? (
                <View style={styles.pinInlineBox}>
                  <PinPad
                    title={pinStep === 'set' ? 'Set 6-digit PIN' : 'Confirm 6-digit PIN'}
                    subtitle={pinStep === 'set' ? 'Choose a PIN code' : 'Re-enter to confirm'}
                    onComplete={handlePinSet}
                    onCancel={() => { setFirstPin(''); setPinStep('set'); }}
                    error={pinError}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: 14, alignItems: 'center' }}>
              <LinearGradient
                colors={['#065F46', '#10B981']}
                style={styles.iconGraphicWrap}
              >
                <Ionicons name="cloud-upload" size={44} color="#FFFFFF" />
              </LinearGradient>

              <Text style={[styles.slideTitle, { color: colors.foreground }]}>Enable Cloud Vault Sync</Text>
              <Text style={[styles.slideSub, { color: colors.mutedForeground }]}>
                Protect your cards against device loss. If you lose or swap phones, entering your account email on your new phone restores all cards instantly!
              </Text>

              <TextInput
                value={userEmail}
                onChangeText={setUserEmail}
                placeholder="Enter your account email (e.g. alex@gmail.com)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.emailInput,
                  { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border },
                ]}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                onPress={() => handleFinishSetup(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>Enable Cloud Loss Protection</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleFinishSetup(false)}>
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Keep Offline Only</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: Math.min(380, 420),
    borderRadius: 24,
    paddingHorizontal: 22,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBadgeTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    height: 5,
    borderRadius: 3,
  },
  iconGraphicWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  slideTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  slideSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  pinInlineBox: {
    width: '100%',
    marginTop: 10,
  },
});
