import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Linking,
  Modal, Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showCustomAlert } from '@/components/StyledAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTutorialModal } from '@/components/AppTutorialModal';
import { VaultBackupModal } from '@/components/VaultBackupModal';
import { PinPad } from '@/components/PinPad';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePro } from '@/contexts/ProContext';
import { ProPaywall } from '@/components/ProPaywall';
import { hashPin } from '@/lib/pin';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleExpiryNotifications,
} from '@/lib/notifications';
import { useColors } from '@/hooks/useColors';
import { getDaysUntilExpiry } from '@/types/card';
import { pauseAppLock } from '@/lib/appLock';

async function getBiometrics() {
  if (Platform.OS === 'web') return null;
  try { return await import('expo-local-authentication'); } catch { return null; }
}

type PinFlowStep = 'set' | 'confirm';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const { cards } = useCards();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { isPro } = usePro();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);

  // PIN setup flow state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<PinFlowStep>('set');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Gemini Vision API Key state
  const [geminiKeyInput, setGeminiKeyInput] = useState(profile.geminiApiKey ?? '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const saveProfile = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName: name, email });
    setEditing(false);
  };

  const handleAppLockToggle = async (val: boolean) => {
    pauseAppLock(60000);
    if (val && Platform.OS !== 'web') {
      const LA = await getBiometrics();
      if (!LA) { updateProfile({ appLockEnabled: true }); return; }
      const enrolled = await LA.isEnrolledAsync();
      if (!enrolled && !profile.pinHash) {
        Alert.alert(
          'No Authentication Method',
          'Set up a PIN code below, or enroll Face ID / Touch ID in device settings first.',
        );
        return;
      }
      if (enrolled) {
        const result = await LA.authenticateAsync({
          promptMessage: 'Confirm to enable App Lock',
          fallbackLabel: 'Use Passcode',
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateProfile({ appLockEnabled: val });
  };

  const handleNotificationsToggle = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable notifications in your device settings to receive expiry reminders.');
        return;
      }
      updateProfile({ notificationsEnabled: true });
      await scheduleExpiryNotifications(cards);
    } else {
      updateProfile({ notificationsEnabled: false });
      await cancelAllNotifications();
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openPinSetup = () => {
    setPinStep('set');
    setFirstPin('');
    setPinError(null);
    setPinModalVisible(true);
  };

  const handleRemovePin = () => {
    Alert.alert('Remove PIN', 'Are you sure you want to remove your PIN code?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          updateProfile({ pinHash: undefined });
        },
      },
    ]);
  };

  const handlePinSet = useCallback(async (pin: string) => {
    if (pinStep === 'set') {
      setFirstPin(pin);
      setPinStep('confirm');
      setPinError(null);
    } else {
      if (pin !== firstPin) {
        setPinError('PINs do not match. Try again.');
        setPinStep('set');
        setFirstPin('');
        return;
      }
      const hash = await hashPin(pin);
      updateProfile({ pinHash: hash });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPinModalVisible(false);
    }
  }, [pinStep, firstPin, updateProfile]);

  const totalCards = cards.length;
  const personalCards = cards.filter((c) => c.profileId === 'personal').length;
  const workCards = cards.filter((c) => c.profileId === 'work').length;
  const expiringCards = cards.filter((c) => {
    if (!c.expiryDate) return false;
    const days = getDaysUntilExpiry(c.expiryDate);
    return days >= 0 && days <= 30;
  }).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 16,
            paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Profile</Text>

        {/* Pro status banner */}
        {isPro ? (
          <View style={[styles.proBanner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
            <Text style={styles.proEmoji}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.proTitle, { color: colors.primary }]}>nascard Pro</Text>
              <Text style={[styles.proSub, { color: colors.mutedForeground }]}>All features unlocked</Text>
            </View>
            <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.proBadgeText, { color: colors.primaryForeground }]}>ACTIVE</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setPaywallVisible(true)}
            style={[styles.proBanner, styles.proBannerCta, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={styles.proEmoji}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.proTitle, { color: colors.primaryForeground }]}>Upgrade to Pro</Text>
              <Text style={[styles.proSub, { color: colors.primaryForeground + 'BB' }]}>GH₵ 19/mo · Unlimited cards + all features</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}

        <ProPaywall visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

        {/* Avatar + name */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.avatarInitial, { color: colors.primary }]}>
              {(profile.displayName || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {editing ? (
              <>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Display name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Email (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={saveProfile} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setName(profile.displayName); setEmail(profile.email); setEditing(false); }}>
                    <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {profile.displayName || 'Your Name'}
                </Text>
                {profile.email ? (
                  <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{profile.email}</Text>
                ) : null}
                <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                  <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          {[
            { label: 'Total', value: totalCards },
            { label: 'Personal', value: personalCards },
            { label: 'Work', value: workCards },
            { label: 'Expiring', value: expiringCards },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, {
                color: stat.label === 'Expiring' && stat.value > 0 ? colors.warning : colors.foreground,
              }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Business & Organization Hub */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BUSINESS & PASS STUDIO</Text>
          
          <TouchableOpacity
            onPress={() => router.push('/org' as any)}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Pass Studio & Organization Hub</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Issue digital passes, set membership fees & track members
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/org/scan-verify' as any)}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="scan-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Verify Member QR</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Scan member QR codes at entry gates or check-ins
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Security section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>

          {/* App Lock toggle */}
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>App Lock</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {Platform.OS === 'web' ? 'Native only' : 'Biometrics or PIN'}
              </Text>
            </View>
            <Switch
              value={profile.appLockEnabled}
              onValueChange={handleAppLockToggle}
              disabled={Platform.OS === 'web'}
              trackColor={{ false: colors.muted, true: colors.primary + 'AA' }}
              thumbColor={profile.appLockEnabled ? colors.primary : colors.mutedForeground}
            />
          </View>

          {/* Auto-Lock Timeout selector when AppLock is active */}
          {profile.appLockEnabled && Platform.OS !== 'web' && (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
                <Ionicons name="timer-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowText, { color: colors.foreground }]}>Lock After Away</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                    Time before requiring authentication again
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, width: '100%', flexWrap: 'wrap', marginTop: 4 }}>
                {[
                  { label: 'Immediate', min: 0 },
                  { label: '1 min', min: 1 },
                  { label: '3 min', min: 3 },
                  { label: '5 min', min: 5 },
                  { label: '15 min', min: 15 },
                ].map((opt) => {
                  const currentMin = profile.lockTimeoutMinutes ?? 3;
                  const isSelected = currentMin === opt.min;
                  return (
                    <TouchableOpacity
                      key={opt.min}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateProfile({ lockTimeoutMinutes: opt.min });
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: 'Inter_600SemiBold',
                          color: isSelected ? colors.primaryForeground : colors.foreground,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Web security notice */}
          {Platform.OS === 'web' && (
            <View style={[styles.infoBanner, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '44' }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
              <Text style={[styles.infoBannerText, { color: colors.warning }]}>
                App Lock is not available in the browser. Use the mobile app for full security.
              </Text>
            </View>
          )}

          {/* PIN code row */}
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={profile.pinHash ? handleRemovePin : openPinSetup}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Ionicons name="keypad-outline" size={20} color={profile.pinHash ? colors.verified : colors.mutedForeground} />
              <View style={styles.rowContent}>
                <Text style={[styles.rowText, { color: colors.foreground }]}>PIN Code</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {profile.pinHash ? '6-digit PIN is set' : 'Add a 6-digit fallback PIN'}
                </Text>
              </View>
              {profile.pinHash ? (
                <View style={[styles.badge, { backgroundColor: colors.verified + '22' }]}>
                  <Text style={[styles.badgeText, { color: colors.verified }]}>On</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Expiry Reminders</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {Platform.OS === 'web' ? 'Native only' : '30 & 7 days before expiry'}
              </Text>
            </View>
            <Switch
              value={profile.notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              disabled={Platform.OS === 'web'}
              trackColor={{ false: colors.muted, true: colors.primary + 'AA' }}
              thumbColor={profile.notificationsEnabled ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        {/* Backup section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATA</Text>
          <TouchableOpacity
            onPress={() => setBackupModalVisible(true)}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Backup & Restore</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Export encrypted backup to cloud storage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Share nascard App */}
        {/* Share nascard App */}
<TouchableOpacity
  onPress={async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.nascard.app';
    const webUrl = 'https://nascard-api.onrender.com';

    // Tailor message based on platform
    const shareMessage = Platform.select({
      android: `📱 Ditch your plastic cards! Store your IDs, memberships & passes in a 3D digital wallet with nascard.\n\nDownload on Google Play: ${playStoreUrl}`,
      ios: `📱 Ditch your plastic cards! Store your IDs, memberships & passes in a 3D digital wallet with nascard.\n\nCheck it out here: ${webUrl}`,
      default: `📱 Ditch your plastic cards! Try nascard - 3D Digital Pass Vault & Card Wallet:\n${webUrl}`,
    });

    try {
      await Share.share(
        Platform.OS === 'ios'
          ? {
              message: shareMessage,
              url: webUrl, // Explicit URL param improves iOS native share sheet handling
            }
          : {
              message: shareMessage,
              title: 'nascard Wallet — 3D Digital Card Vault',
            },
      );
    } catch (err) {
      console.warn('[ProfileScreen] Share sheet dismissed or failed:', err);
    }
  }}
  style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
  activeOpacity={0.7}
>
  <Ionicons name="share-social-outline" size={20} color={colors.primary} />
  <View style={styles.rowContent}>
    <Text style={[styles.rowText, { color: colors.foreground }]}>Share nascard App</Text>
    <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
      Invite friends or colleagues to try the 3D wallet
    </Text>
  </View>
  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
</TouchableOpacity>
        </View>

       
        {/* About section */}
       {/* HELP & ABOUT */}
<View style={styles.sectionGroup}>
  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>HELP & ABOUT</Text>

  {/* Visual Interactive Tutorial */}
  <TouchableOpacity
    style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTutorialVisible(true);
    }}
    activeOpacity={0.7}
  >
    <Ionicons name="compass-outline" size={20} color={colors.primary} />
    <View style={styles.rowContent}>
      <Text style={[styles.rowText, { color: colors.foreground }]}>App Guide & Visual Tutorial</Text>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
        Learn AI scanning, 3D card deck & pass claims
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
  </TouchableOpacity>

  {/* Rate & Review on Play Store */}
 <TouchableOpacity
  style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
  onPress={async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'android') {
      const playStoreUrl = 'market://details?id=com.nascard.app';
      const webUrl = 'https://play.google.com/store/apps/details?id=com.nascard.app';
      try {
        const canOpen = await Linking.canOpenURL(playStoreUrl);
        await Linking.openURL(canOpen ? playStoreUrl : webUrl);
      } catch {
        await Linking.openURL(webUrl);
      }
    } else {
      // iOS / Web fallback: Open direct email or web feedback form
      showCustomAlert(
        'Feedback & iOS Access',
        'nascard Wallet for iOS is coming soon!\n\nTo share feedback or request TestFlight access, email support at septnova.contact@gmail.com',
        [{ text: 'Got it', style: 'default' }],
        { type: 'info', icon: 'mail' },
      );
    }
  }}
  activeOpacity={0.7}
>
  <Ionicons name="star-outline" size={20} color={colors.primary} />
  <View style={styles.rowContent}>
    <Text style={[styles.rowText, { color: colors.foreground }]}>
      {Platform.OS === 'android' ? 'Rate nascard Wallet' : 'Feedback & Ratings'}
    </Text>
    <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
      {Platform.OS === 'android' ? 'Leave feedback on Google Play' : 'Send feedback to dev team'}
    </Text>
  </View>
  <Ionicons name={Platform.OS === 'android' ? 'open-outline' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
</TouchableOpacity>

  {/* Privacy Policy */}
  <TouchableOpacity
    style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={() => Linking.openURL('https://nascard-api.onrender.com/privacy-policy')}
    activeOpacity={0.7}
  >
    <Ionicons name="shield-checkmark-outline" size={20} color={colors.mutedForeground} />
    <View style={styles.rowContent}>
      <Text style={[styles.rowText, { color: colors.foreground }]}>Privacy Policy</Text>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>AES-256 local storage & data rights</Text>
    </View>
    <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
  </TouchableOpacity>

  {/* Terms of Service */}
  <TouchableOpacity
    style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={() => Linking.openURL('https://nascard-api.onrender.com/terms-of-service')}
    activeOpacity={0.7}
  >
    <Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />
    <View style={styles.rowContent}>
      <Text style={[styles.rowText, { color: colors.foreground }]}>Terms of Service</Text>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Pass issuance & usage terms</Text>
    </View>
    <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
  </TouchableOpacity>

  {/* Contact Support */}
  <TouchableOpacity
    style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={() =>
      showCustomAlert(
        'Contact Support',
        'Need assistance or reporting a pass issue?\n\n🏢 Company: Septnova\n📧 Support: septnova.contact@gmail.com\n💬 Response Time: Within 24 hours',
        [{ text: 'Close', style: 'default' }],
        { type: 'info', icon: 'mail' },
      )
    }
    activeOpacity={0.7}
  >
    <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
    <View style={styles.rowContent}>
      <Text style={[styles.rowText, { color: colors.foreground }]}>Contact Support</Text>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Get help with your pass vault</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
  </TouchableOpacity>

  {/* About & Version Info */}
  <TouchableOpacity
    style={[styles.versionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={() =>
      Alert.alert(
        'About nascard Wallet',
        'nascard is a high-security 3D digital card wallet & pass verification system.\n\nVersion: 1.0.0 (Build 1)\nPublisher: Septnova\nEngine: Expo Router & React Native',
      )
    }
    activeOpacity={0.7}
  >
    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
    <View style={{ flex: 1 }}>
      <Text style={[styles.rowText, { color: colors.foreground }]}>nascard Wallet</Text>
      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Septnova Release · v1.0.0</Text>
    </View>
    <Text style={[styles.versionText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>v1.0.0</Text>
  </TouchableOpacity>
</View>
      </ScrollView>

      {/* PIN setup modal */}
      <Modal
        visible={pinModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={styles.modalHandle} />

          <TouchableOpacity
            onPress={() => setPinModalVisible(false)}
            style={[styles.modalClose, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="close" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <PinPad
            title={pinStep === 'set' ? 'Set your PIN' : 'Confirm your PIN'}
            subtitle={
              pinStep === 'set'
                ? 'Choose a 6-digit PIN to unlock the app'
                : 'Enter the same PIN again to confirm'
            }
            onComplete={handlePinSet}
            onCancel={() => setPinModalVisible(false)}
          />
        </View>
      </Modal>

      <AppTutorialModal
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
      <VaultBackupModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  proBannerCta: {},
  proEmoji: { fontSize: 24 },
  proTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  proSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  proBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  proBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  profileEmail: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  editBtn: { marginTop: 4 },
  editBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
  },
  editActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8 },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cancelText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 2 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  sectionGroup: { marginBottom: 20, gap: 2 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  rowContent: { flex: 1 },
  rowText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  versionText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  modalHandle: {
    position: 'absolute',
    top: 12,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  modalClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  infoBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
