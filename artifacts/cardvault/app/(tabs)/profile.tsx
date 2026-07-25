import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);

  // PIN setup flow state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<PinFlowStep>('set');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const saveProfile = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName: name, email });
    setEditing(false);
  };

  const handleAppLockToggle = async (val: boolean) => {
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
  const studentCards = cards.filter((c) => c.profileId === 'student').length;

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
              <Text style={[styles.proSub, { color: colors.primaryForeground + 'BB' }]}>$4.99/mo · Unlimited cards + all features</Text>
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
            { label: 'Student', value: studentCards },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
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
            onPress={() => router.push('/backup' as any)}
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
          <TouchableOpacity
            onPress={async () => {
              try {
                await Share.share({
                  message: '📱 Ditch your plastic cards! Download nascard to store your cards in a 3D Apple Wallet & claim digital passes for your school, gym, or office.\n\nDownload now: https://nascard.app',
                  title: 'nascard - 3D Digital Card Wallet',
                });
              } catch (e) {}
            }}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Share nascard App</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Invite friends or classmates to try the 3D wallet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* About section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT NASCARD</Text>

          {/* App Overview */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() =>
              Alert.alert(
                'About nascard',
                'nascard is a high-security, 3D interactive digital card wallet & partner pass platform. Replace physical plastic cards with instant, verified digital passes for gyms, schools, clubs, and workplaces.\n\n🏢 Company: Septnova\n👨‍💻 Lead Developer: Emmanuel Jimah Bakeri\n📧 Contact: septnova.contact@gmail.com',
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>About nascard</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() =>
              Alert.alert(
                'Privacy Policy',
                '1. Data Privacy: Your personal card photos and details are encrypted and stored locally on your device.\n\n2. Camera Access: Camera permissions are strictly used for scanning barcodes and capturing card photos.\n\n3. Zero Selling: Septnova never sells or shares your personal card data with third parties.',
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() =>
              Alert.alert(
                'Terms of Service',
                '1. Acceptable Use: You agree to upload only legitimate document photos that belong to you or your organization.\n\n2. Organization Passes: Official digital passes issued by partners are verified using dynamic cryptographic QR tokens.\n\n3. Payments & Fees: Payouts and membership fees are processed securely via Paystack.',
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Contact Support */}
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() =>
              Alert.alert(
                'Contact Support',
                'Need help or have feedback?\n\n🏢 Company: Septnova\n👨‍💻 Lead Developer: Emmanuel Jimah Bakeri\n📧 Email: septnova.contact@gmail.com\n🌐 Server: https://nascard-api.onrender.com',
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>Contact Support</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Version Info */}
          <View style={[styles.versionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="code-slash-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>Septnova Release v1.0.0</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Developed by Emmanuel Jimah Bakeri</Text>
            </View>
            <Text style={[styles.versionText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>v1.0.0</Text>
          </View>
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
            error={pinError}
          />
        </View>
      </Modal>
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
});
