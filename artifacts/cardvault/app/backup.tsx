import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePro } from '@/contexts/ProContext';
import { decryptCards, exportBackup, importBackupFile } from '@/lib/backup';
import {
  clearCloudPassword,
  deleteCloudBackup,
  downloadCloudBackup,
  getCloudBackupInfo,
  saveCloudPassword,
  uploadCloudBackup,
} from '@/lib/cloudBackup';
import { useColors } from '@/hooks/useColors';

type LocalStep = 'menu' | 'backup-pw' | 'backup-confirm' | 'restore-pick' | 'restore-pw' | 'restore-preview';
type AuthMode = 'idle' | 'sign-in' | 'sign-up';

export default function BackupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards, importCards } = useCards();
  const { user, signIn, signUp, signOut } = useAuth();
  const { isPro } = usePro();

  // ── Local Backup state ──────────────────────────────────────────────────────
  const [step, setStep] = useState<LocalStep>('menu');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [pendingCards, setPendingCards] = useState<any[]>([]);
  const [showPw, setShowPw] = useState(false);

  // ── Cloud Sync state ────────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>('idle');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [cloudPw, setCloudPw] = useState('');
  const [cloudPwConfirm, setCloudPwConfirm] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudInfo, setCloudInfo] = useState<{ cardCount: number; updatedAt: string } | null>(null);
  const [showCloudPw, setShowCloudPw] = useState(false);
  const [cloudSetupStep, setCloudSetupStep] = useState<'overview' | 'set-password' | 'done'>('overview');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  useEffect(() => {
    if (user) {
      getCloudBackupInfo().then(setCloudInfo).catch(() => {});
    }
  }, [user]);

  const resetLocal = () => {
    setPassword(''); setConfirmPw('');
    setPendingFile(null); setPendingCards([]);
    setBusy(false); setShowPw(false);
  };

  // ── LOCAL BACKUP HANDLERS ──────────────────────────────────────────────────
  const handleLocalBackup = async () => {
    if (!password) return;
    if (password !== confirmPw) {
      Alert.alert('Passwords do not match', 'Please re-enter matching passwords.');
      return;
    }
    setBusy(true);
    try {
      await exportBackup(cards, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Backup saved!', `${cards.length} card${cards.length !== 1 ? 's' : ''} backed up. Save the file to iCloud Drive, Google Drive, or any cloud storage.`, [
        { text: 'Done', onPress: () => { resetLocal(); setStep('menu'); } },
      ]);
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const handleLocalRestore = async () => {
    resetLocal();
    setBusy(true);
    try {
      const file = await importBackupFile();
      if (file.app !== 'nascard' || !file.data) throw new Error('Not a valid nascard backup file.');
      setPendingFile(file);
      setStep('restore-pw');
    } catch (e: any) {
      if (!e.message?.includes('No file selected')) Alert.alert('Import failed', e.message ?? 'Could not read file.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecryptRestore = async () => {
    if (!password || !pendingFile) return;
    setBusy(true);
    try {
      const decrypted = await decryptCards(pendingFile.data, password);
      setPendingCards(decrypted);
      setStep('restore-preview');
    } catch (e: any) {
      Alert.alert('Wrong password', e.message ?? 'Could not decrypt backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async (mode: 'merge' | 'replace') => {
    setBusy(true);
    try {
      await importCards(pendingCards, mode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Restore complete!', `${pendingCards.length} card${pendingCards.length !== 1 ? 's' : ''} restored.`, [
        { text: 'Done', onPress: () => { resetLocal(); setStep('menu'); } },
      ]);
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  // ── CLOUD AUTH HANDLERS ───────────────────────────────────────────────────
  const handleAuth = async () => {
    if (!authEmail.includes('@') || authPassword.length < 6) {
      Alert.alert('Invalid input', 'Please enter a valid email and a password with at least 6 characters.');
      return;
    }
    setCloudBusy(true);
    try {
      if (authMode === 'sign-up') {
        await signUp(authEmail, authPassword);
        Alert.alert('Account created! ✅', 'Check your email to confirm your account, then sign in.');
      } else {
        await signIn(authEmail, authPassword);
      }
      setAuthMode('idle');
      setAuthEmail(''); setAuthPassword('');
    } catch (e: any) {
      Alert.alert('Authentication failed', e.message ?? 'Please try again.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSetCloudPassword = async () => {
    if (cloudPw.length < 6) {
      Alert.alert('Too short', 'Please use a backup password with at least 6 characters.');
      return;
    }
    if (cloudPw !== cloudPwConfirm) {
      Alert.alert('Passwords do not match', 'Re-enter your backup encryption password.');
      return;
    }
    setCloudBusy(true);
    try {
      await saveCloudPassword(cloudPw);
      await uploadCloudBackup(cards, cloudPw);
      const info = await getCloudBackupInfo();
      setCloudInfo(info);
      setCloudSetupStep('done');
      setCloudPw(''); setCloudPwConfirm('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Cloud backup failed', e.message ?? 'Please try again.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleManualSync = async () => {
    setCloudBusy(true);
    try {
      const { loadCloudPassword } = await import('@/lib/cloudBackup');
      const pw = await loadCloudPassword();
      if (!pw) {
        Alert.alert('No encryption password set', 'Please set up your backup encryption password first.');
        setCloudSetupStep('set-password');
        return;
      }
      await uploadCloudBackup(cards, pw);
      const info = await getCloudBackupInfo();
      setCloudInfo(info);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Synced! ✅', `${info?.cardCount ?? 0} cards backed up to your secure cloud vault.`);
    } catch (e: any) {
      Alert.alert('Sync failed', e.message ?? 'Please try again.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudRestore = async () => {
    setCloudBusy(true);
    try {
      const { loadCloudPassword } = await import('@/lib/cloudBackup');
      const pw = await loadCloudPassword();
      if (!pw) {
        Alert.alert('No encryption password', 'You need to enter your backup encryption password to restore.');
        return;
      }
      const restored = await downloadCloudBackup(pw);
      Alert.alert(
        'Restore from Cloud?',
        `Found ${restored.length} card${restored.length !== 1 ? 's' : ''} in your cloud vault. How would you like to restore them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Merge', onPress: () => importCards(restored, 'merge').then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)) },
          { text: 'Replace All', style: 'destructive', onPress: () => importCards(restored, 'replace').then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Please try again.');
    } finally {
      setCloudBusy(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out of Cloud Sync?', 'Your local cards will remain safe on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await signOut();
          await clearCloudPassword();
          setCloudInfo(null);
          setCloudSetupStep('overview');
        }
      },
    ]);
  };

  const s = styles(colors, topPad);

  // ─── RENDER HELPERS ────────────────────────────────────────────────────────

  const renderCloudSection = () => {
    if (!isPro) {
      return (
        <View style={s.cloudProGate}>
          <Ionicons name="cloud-outline" size={36} color={colors.accent} />
          <Text style={s.cloudProTitle}>Auto Cloud Sync</Text>
          <Text style={s.cloudProSubtitle}>
            Upgrade to Pro to automatically back up your encrypted cards to the cloud. Never lose your wallet again.
          </Text>
          <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/org/pro-paywall' as any)}>
            <Text style={s.upgradeBtnText}>⚡ Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Pro user — not signed in
    if (!user) {
      if (authMode !== 'idle') {
        return (
          <View style={s.authCard}>
            <Text style={s.authTitle}>{authMode === 'sign-up' ? 'Create Cloud Account' : 'Sign in to Cloud Sync'}</Text>
            <TextInput
              style={s.input}
              placeholder="Email address"
              placeholderTextColor={colors.subtext}
              autoCapitalize="none"
              keyboardType="email-address"
              value={authEmail}
              onChangeText={setAuthEmail}
            />
            <TextInput
              style={s.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
            />
            <TouchableOpacity style={s.primaryBtn} onPress={handleAuth} disabled={cloudBusy}>
              {cloudBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{authMode === 'sign-up' ? 'Create Account' : 'Sign In'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('idle')}>
              <Text style={s.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={s.cloudProGate}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.subtext} />
          <Text style={s.cloudProTitle}>Cloud Sync · Pro</Text>
          <Text style={s.cloudProSubtitle}>Sign in to your nascard cloud account to enable automatic encrypted backups.</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setAuthMode('sign-in')}>
            <Text style={s.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.surface, marginTop: 8 }]} onPress={() => setAuthMode('sign-up')}>
            <Text style={[s.primaryBtnText, { color: colors.accent }]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Pro user, signed in, needs to set up encryption password
    if (cloudSetupStep === 'set-password' || (!cloudInfo && cloudSetupStep !== 'done')) {
      return (
        <View style={s.authCard}>
          <Ionicons name="key-outline" size={28} color={colors.accent} style={{ marginBottom: 8 }} />
          <Text style={s.authTitle}>Set Backup Password</Text>
          <Text style={s.authSubtitle}>This password encrypts your cards before they leave your device. Even we can't see them. Don't lose this password!</Text>
          <TextInput
            style={s.input}
            placeholder="Encryption password"
            placeholderTextColor={colors.subtext}
            secureTextEntry={!showCloudPw}
            value={cloudPw}
            onChangeText={setCloudPw}
          />
          <TextInput
            style={s.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.subtext}
            secureTextEntry={!showCloudPw}
            value={cloudPwConfirm}
            onChangeText={setCloudPwConfirm}
          />
          <TouchableOpacity style={s.showToggle} onPress={() => setShowCloudPw(v => !v)}>
            <Text style={s.linkText}>{showCloudPw ? 'Hide' : 'Show'} password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} onPress={handleSetCloudPassword} disabled={cloudBusy}>
            {cloudBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Enable Cloud Sync</Text>}
          </TouchableOpacity>
        </View>
      );
    }

    // Pro user, signed in, synced
    return (
      <View style={s.cloudStatusCard}>
        <View style={s.cloudStatusHeader}>
          <View style={s.cloudOnlineDot} />
          <Text style={s.cloudStatusTitle}>Cloud Sync Active</Text>
        </View>
        <Text style={s.cloudStatusEmail}>{user.email}</Text>
        {cloudInfo && (
          <View style={s.cloudMetaRow}>
            <View style={s.cloudMeta}>
              <Text style={s.cloudMetaVal}>{cloudInfo.cardCount}</Text>
              <Text style={s.cloudMetaLabel}>Cards backed up</Text>
            </View>
            <View style={s.cloudMeta}>
              <Text style={s.cloudMetaVal}>{new Date(cloudInfo.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
              <Text style={s.cloudMetaLabel}>Last synced</Text>
            </View>
          </View>
        )}
        <TouchableOpacity style={s.primaryBtn} onPress={handleManualSync} disabled={cloudBusy}>
          {cloudBusy
            ? <ActivityIndicator color="#fff" />
            : <><Ionicons name="cloud-upload-outline" size={16} color="#fff" /><Text style={[s.primaryBtnText, { marginLeft: 6 }]}>Sync Now</Text></>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.surface, marginTop: 8 }]} onPress={handleCloudRestore} disabled={cloudBusy}>
          <Ionicons name="cloud-download-outline" size={16} color={colors.accent} />
          <Text style={[s.primaryBtnText, { color: colors.accent, marginLeft: 6 }]}>Restore from Cloud</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSignOut} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={[s.linkText, { color: colors.danger ?? '#EF4444' }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => { if (step !== 'menu') { resetLocal(); setStep('menu'); } else { router.back(); } }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Vault Backup</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── CLOUD SYNC SECTION ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>☁️  CLOUD SYNC {isPro ? '· PRO' : ''}</Text>
        {renderCloudSection()}
      </View>

      {/* ── LOCAL BACKUP SECTION ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>📦  LOCAL FILE BACKUP</Text>

        {step === 'menu' && (
          <View style={s.localCard}>
            <Text style={s.localCardTitle}>Manual Backup</Text>
            <Text style={s.localCardSub}>Export an AES-encrypted file to iCloud Drive, Google Drive, or email.</Text>
            <TouchableOpacity style={s.actionRow} onPress={() => setStep('backup-pw')} disabled={busy}>
              <Ionicons name="archive-outline" size={20} color={colors.accent} />
              <Text style={s.actionRowText}>Export Backup File</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={handleLocalRestore} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="folder-open-outline" size={20} color={colors.accent} />}
              <Text style={s.actionRowText}>Restore from File</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        )}

        {step === 'backup-pw' && (
          <View style={s.authCard}>
            <Text style={s.authTitle}>Set Export Password</Text>
            <TextInput style={s.input} placeholder="Encryption password" placeholderTextColor={colors.subtext} secureTextEntry={!showPw} value={password} onChangeText={setPassword} />
            <TouchableOpacity style={s.primaryBtn} onPress={() => { if (!password) return; setStep('backup-confirm'); }}>
              <Text style={s.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetLocal(); setStep('menu'); }}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        )}

        {step === 'backup-confirm' && (
          <View style={s.authCard}>
            <Text style={s.authTitle}>Confirm Password</Text>
            <TextInput style={s.input} placeholder="Re-enter password" placeholderTextColor={colors.subtext} secureTextEntry={!showPw} value={confirmPw} onChangeText={setConfirmPw} />
            <TouchableOpacity style={s.primaryBtn} onPress={handleLocalBackup} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Export {cards.length} Cards</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetLocal(); setStep('menu'); }}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        )}

        {step === 'restore-pw' && (
          <View style={s.authCard}>
            <Text style={s.authTitle}>Enter Backup Password</Text>
            <Text style={s.authSubtitle}>Found backup from {pendingFile?.createdAt ? new Date(pendingFile.createdAt).toLocaleDateString() : ''}. Enter the password you used to encrypt it.</Text>
            <TextInput style={s.input} placeholder="Decryption password" placeholderTextColor={colors.subtext} secureTextEntry value={password} onChangeText={setPassword} />
            <TouchableOpacity style={s.primaryBtn} onPress={handleDecryptRestore} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Decrypt</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetLocal(); setStep('menu'); }}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        )}

        {step === 'restore-preview' && (
          <View style={s.authCard}>
            <Text style={s.authTitle}>Restore {pendingCards.length} Cards</Text>
            <Text style={s.authSubtitle}>How would you like to restore these cards?</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => handleConfirmRestore('merge')} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Merge with Existing Cards</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#7f1d1d', marginTop: 8 }]} onPress={() => handleConfirmRestore('replace')} disabled={busy}>
              <Text style={s.primaryBtnText}>Replace All Cards</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetLocal(); setStep('menu'); }}><Text style={s.linkText}>Cancel</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function styles(colors: any, topPad: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: topPad + 8, paddingHorizontal: 16, paddingBottom: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' },
    section: { marginHorizontal: 16, marginTop: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.subtext, letterSpacing: 1.2, marginBottom: 10, fontFamily: 'Inter_700Bold' },

    // Cloud
    cloudProGate: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    cloudProTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6, fontFamily: 'Inter_700Bold' },
    cloudProSubtitle: { fontSize: 13, color: colors.subtext, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
    upgradeBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
    upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' },
    cloudStatusCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#10B98133' },
    cloudStatusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    cloudOnlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 8 },
    cloudStatusTitle: { fontSize: 15, fontWeight: '700', color: '#10B981', fontFamily: 'Inter_700Bold' },
    cloudStatusEmail: { fontSize: 12, color: colors.subtext, marginBottom: 16 },
    cloudMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    cloudMeta: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 12, alignItems: 'center' },
    cloudMetaVal: { fontSize: 22, fontWeight: '700', color: colors.text, fontFamily: 'Inter_700Bold' },
    cloudMetaLabel: { fontSize: 11, color: colors.subtext, marginTop: 2 },

    // Auth
    authCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
    authTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6, fontFamily: 'Inter_700Bold' },
    authSubtitle: { fontSize: 13, color: colors.subtext, lineHeight: 18, marginBottom: 16 },
    input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: colors.text, marginBottom: 10, fontFamily: 'Inter_400Regular' },
    showToggle: { alignSelf: 'flex-end', marginBottom: 10 },
    primaryBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' },
    linkText: { color: colors.accent, textAlign: 'center', marginTop: 12, fontSize: 13 },

    // Local
    localCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    localCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontFamily: 'Inter_700Bold' },
    localCardSub: { fontSize: 12, color: colors.subtext, paddingHorizontal: 16, paddingBottom: 12, lineHeight: 16 },
    actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
    actionRowText: { flex: 1, fontSize: 14, color: colors.text, fontFamily: 'Inter_500Medium' },
  });
}
