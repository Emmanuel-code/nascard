import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const { cards } = useCards();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);

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
      if (!enrolled) {
        Alert.alert(
          'No Biometrics Found',
          'Set up Face ID, Touch ID, or a device passcode in your device settings first.',
        );
        return;
      }
      const result = await LA.authenticateAsync({
        promptMessage: 'Confirm to enable App Lock',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
      if (!result.success) return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateProfile({ appLockEnabled: val });
  };

  const handleNotificationsToggle = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Enable notifications in your device settings to receive expiry reminders.',
        );
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
                  <TouchableOpacity
                    onPress={saveProfile}
                    style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setName(profile.displayName);
                      setEmail(profile.email);
                      setEditing(false);
                    }}
                  >
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
                  <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
                    {profile.email}
                  </Text>
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
            <View
              key={stat.label}
              style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Security section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SECURITY</Text>
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowText, { color: colors.foreground }]}>App Lock</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {Platform.OS === 'web' ? 'Native only' : 'Biometrics or passcode'}
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

        {/* About section */}
        <View style={styles.sectionGroup}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ABOUT</Text>
          {[
            { icon: 'document-text-outline', label: 'Privacy Policy' },
            { icon: 'clipboard-outline', label: 'Terms of Service' },
            { icon: 'mail-outline', label: 'Contact Support' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon as any} size={20} color={colors.mutedForeground} />
              <Text style={[styles.rowText, { color: colors.foreground }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
          <View style={[styles.versionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.rowText, { color: colors.foreground }]}>Version</Text>
            <Text style={[styles.versionText, { color: colors.mutedForeground }]}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
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
});
