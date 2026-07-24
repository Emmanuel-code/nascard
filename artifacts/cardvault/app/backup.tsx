import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { decryptCards, exportBackup, importBackupFile } from '@/lib/backup';
import { useColors } from '@/hooks/useColors';

type Step = 'menu' | 'backup-pw' | 'backup-confirm' | 'restore-pick' | 'restore-pw' | 'restore-preview';

export default function BackupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards, importCards } = useCards();

  const [step, setStep] = useState<Step>('menu');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [pendingCards, setPendingCards] = useState<any[]>([]);
  const [showPw, setShowPw] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const resetState = () => {
    setPassword(''); setConfirmPw('');
    setPendingFile(null); setPendingCards([]);
    setBusy(false); setShowPw(false);
  };

  // ── BACKUP ──────────────────────────────────────────────────
  const startBackup = () => { resetState(); setStep('backup-pw'); };

  const handleBackupExport = async () => {
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
        { text: 'Done', onPress: () => { resetState(); setStep('menu'); } },
      ]);
    } catch (e: any) {
      Alert.alert('Export failed', e.message ?? 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  // ── RESTORE ─────────────────────────────────────────────────
  const startRestore = async () => {
    resetState();
    setBusy(true);
    try {
      const file = await importBackupFile();
      if (file.app !== 'nascard' || !file.data) {
        throw new Error('This does not appear to be a nascard backup file.');
      }
      setPendingFile(file);
      setStep('restore-pw');
    } catch (e: any) {
      if (!e.message?.includes('No file selected')) {
        Alert.alert('Import failed', e.message ?? 'Could not read file.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreDecrypt = async () => {
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

  const handleRestoreImport = async (mode: 'merge' | 'replace') => {
    setBusy(true);
    try {
      await importCards(pendingCards, mode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Restore complete',
        `${pendingCards.length} card${pendingCards.length !== 1 ? 's' : ''} restored successfully.`,
        [{ text: 'Done', onPress: () => { resetState(); setStep('menu'); router.back(); } }],
      );
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: insets.bottom + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (step === 'menu') router.back(); else setStep('menu'); }} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.heading, { color: colors.foreground }]}>Backup & Restore</Text>
        </View>

        {/* ── MENU ── */}
        {step === 'menu' && (
          <>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Export an encrypted backup to iCloud Drive, Google Drive, or any cloud storage. Restore it on any device.
            </Text>

            <View style={[styles.infoBox, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '33' }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>
                Card photos are not included in backups to keep file sizes small. All other card data is fully restored.
              </Text>
            </View>

            <TouchableOpacity onPress={startBackup} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.75}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="cloud-upload-outline" size={26} color={colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Export Backup</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  {cards.length} card{cards.length !== 1 ? 's' : ''} · AES-256 encrypted
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity onPress={startRestore} style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.75} disabled={busy}>
              <View style={[styles.actionIcon, { backgroundColor: colors.mutedForeground + '18' }]}>
                {busy ? <ActivityIndicator color={colors.mutedForeground} /> : <Ionicons name="cloud-download-outline" size={26} color={colors.mutedForeground} />}
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>Restore from Backup</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                  Pick a .nascard file from your device
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </>
        )}

        {/* ── BACKUP PASSWORD ── */}
        {step === 'backup-pw' && (
          <View style={styles.form}>
            <View style={[styles.formIcon, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Set a backup password</Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              Your cards will be encrypted with this password. You'll need it to restore.
            </Text>

            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.mutedForeground}
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.showPw}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.mutedForeground} />
              <Text style={[styles.showPwText, { color: colors.mutedForeground }]}>{showPw ? 'Hide' : 'Show'} password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBackupExport}
              disabled={busy || !password || password !== confirmPw}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (busy || !password || password !== confirmPw) ? 0.5 : 1 }]}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Export & Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── RESTORE PASSWORD ── */}
        {step === 'restore-pw' && pendingFile && (
          <View style={styles.form}>
            <View style={[styles.formIcon, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '33' }]}>
              <Ionicons name="key-outline" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Enter backup password</Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              Backup from {new Date(pendingFile.createdAt).toLocaleDateString()} · {pendingFile.cardCount} card{pendingFile.cardCount !== 1 ? 's' : ''}
            </Text>

            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Backup password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.showPw}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.mutedForeground} />
              <Text style={[styles.showPwText, { color: colors.mutedForeground }]}>{showPw ? 'Hide' : 'Show'} password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestoreDecrypt}
              disabled={busy || !password}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (busy || !password) ? 0.5 : 1 }]}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <>
                  <Ionicons name="key-outline" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Decrypt Backup</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── RESTORE PREVIEW ── */}
        {step === 'restore-preview' && (
          <View style={styles.form}>
            <View style={[styles.formIcon, { backgroundColor: colors.verified + '18', borderColor: colors.verified + '33' }]}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.verified} />
            </View>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Backup decrypted</Text>
            <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
              Found {pendingCards.length} card{pendingCards.length !== 1 ? 's' : ''}. How would you like to restore?
            </Text>

            {/* Card preview list */}
            {pendingCards.slice(0, 5).map((c, i) => (
              <View key={i} style={[styles.previewRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="card-outline" size={18} color={colors.mutedForeground} />
                <Text style={[styles.previewTitle, { color: colors.foreground }]} numberOfLines={1}>{c.title}</Text>
                <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>{c.nameOnCard}</Text>
              </View>
            ))}
            {pendingCards.length > 5 && (
              <Text style={[styles.andMore, { color: colors.mutedForeground }]}>
                +{pendingCards.length - 5} more card{pendingCards.length - 5 !== 1 ? 's' : ''}
              </Text>
            )}

            <TouchableOpacity
              onPress={() => handleRestoreImport('merge')}
              disabled={busy}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }]}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <>
                  <Ionicons name="git-merge-outline" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Merge with existing cards</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Replace all cards?', 'This will delete all your current cards and replace them with the backup.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Replace', style: 'destructive', onPress: () => handleRestoreImport('replace') },
              ])}
              disabled={busy}
              style={[styles.secondaryBtn, { borderColor: colors.expired + '66', opacity: busy ? 0.5 : 1 }]}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={colors.expired} />
              <Text style={[styles.secondaryBtnText, { color: colors.expired }]}>Replace all cards</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 21, marginBottom: 16 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  actionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  form: { alignItems: 'center', paddingTop: 16 },
  formIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  formTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 },
  formSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  showPw: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  showPwText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  previewTitle: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  previewSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  andMore: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, marginBottom: 16 },
});
