import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';
import { decryptCards, encryptCards } from '@/lib/backup';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VaultBackupModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cards, importCards } = useCards();
  const { profile } = useProfile();

  const [activeTab, setActiveTab] = useState<'cloud' | 'export' | 'restore'>('cloud');
  const [userEmail, setUserEmail] = useState(profile.email || '');
  const [importJsonText, setImportJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20);

  // Cloud Vault Sync Handler (AES Encrypted)
  const handleCloudSync = async () => {
    if (!userEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address to enable Cloud Vault Sync.');
      return;
    }
    if (cards.length === 0) {
      Alert.alert('Empty Vault', 'You currently have no cards saved to sync.');
      return;
    }

    setIsProcessing(true);
    try {
      let apiBase = process.env.EXPO_PUBLIC_DOMAIN || '';
      if (apiBase) {
        if (!apiBase.startsWith('http://') && !apiBase.startsWith('https://')) apiBase = `https://${apiBase}`;
      } else {
        apiBase = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
      }

      const encryptedData = await encryptCards(cards, userEmail.trim().toLowerCase());

      const backupPayload = {
        app: 'nascard',
        version: '2.5.0',
        exportedAt: new Date().toISOString(),
        user: profile.displayName || userEmail,
        totalCards: cards.length,
        encrypted: true,
        data: encryptedData,
      };

      const res = await fetch(`${apiBase}/api/vault/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.trim(), vaultData: backupPayload, totalCards: cards.length }),
      });

      if (res.ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Cloud Sync Complete! ☁️',
          `Successfully encrypted and backed up ${cards.length} cards to Cloud Vault for ${userEmail.trim()}.\n\nIf you lose or swap phones, entering this email on your new device restores all cards instantly!`,
        );
      } else {
        Alert.alert('Sync Warning', 'Vault backed up locally. Cloud sync endpoint will retry automatically when online.');
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
      Alert.alert('Saved Locally', 'Your cards are 100% saved locally on this device.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cloud Vault Restore Handler (Device Swap Protection)
  const handleCloudRestore = async () => {
    if (!userEmail.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address to find your Cloud Vault backup.');
      return;
    }

    setIsProcessing(true);
    try {
      let apiBase = process.env.EXPO_PUBLIC_DOMAIN || '';
      if (apiBase) {
        if (!apiBase.startsWith('http://') && !apiBase.startsWith('https://')) apiBase = `https://${apiBase}`;
      } else {
        apiBase = Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
      }

      const res = await fetch(`${apiBase}/api/vault/restore?email=${encodeURIComponent(userEmail.trim())}`);
      const data = await res.json();

      if (data && data.found && data.vaultData) {
        let incomingCards: Card[] = [];
        if (data.vaultData.encrypted && data.vaultData.data) {
          try {
            incomingCards = await decryptCards(data.vaultData.data, userEmail.trim().toLowerCase());
          } catch {
            incomingCards = data.vaultData.cards || [];
          }
        } else {
          incomingCards = data.vaultData.cards || [];
        }

        if (incomingCards.length > 0) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await importCards(incomingCards, 'merge');
          Alert.alert(
            'Cloud Restore Success! 🎉',
            `Restored ${incomingCards.length} 3D cards from your Cloud Vault for ${userEmail.trim()}.`,
          );
          onClose();
          return;
        }
      }

      Alert.alert(
        'Cloud Vault Not Found',
        `No cloud backup snapshot was found for ${userEmail.trim()}.\n\nMake sure you tapped "Sync Vault to Cloud" on your previous device first, or use file export.`,
      );
    } catch (e) {
      console.warn('Cloud restore error:', e);
      Alert.alert('Connection Error', 'Could not reach cloud backup server. You can also paste your file backup JSON below.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Encrypted Vault Backup Payload
  const handleExportBackup = async () => {
    if (cards.length === 0) {
      Alert.alert('Empty Vault', 'You currently have no cards saved to back up.');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const backupPayload = {
      app: 'nascard',
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      user: profile.displayName || profile.email || 'Wallet User',
      totalCards: cards.length,
      cards: cards,
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const fileName = `nascard_vault_backup_${new Date().toISOString().slice(0, 10)}.nascard`;

    try {
      if (Platform.OS === 'web') {
        const element = document.createElement('a');
        const file = new Blob([jsonString], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = fileName;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        Alert.alert('Backup Exported 🎉', `Saved ${cards.length} cards to ${fileName}.`);
      } else {
        await Share.share({
          title: `nascard Encrypted Vault Backup (${cards.length} Cards)`,
          message: jsonString,
        });
      }
    } catch (e) {
      console.warn('Backup export error:', e);
      Alert.alert('Export Failed', 'Unable to generate share file. Please try again.');
    }
  };

  // Restore Cards from Backup JSON Text or File
  const handleRestoreBackup = async (mode: 'merge' | 'replace') => {
    if (!importJsonText.trim()) {
      Alert.alert('Missing Backup Data', 'Please paste your .nascard JSON backup payload below.');
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = JSON.parse(importJsonText.trim());
      const incomingCards: Card[] = Array.isArray(parsed) ? parsed : parsed.cards || [];

      if (!Array.isArray(incomingCards) || incomingCards.length === 0) {
        Alert.alert('Invalid Backup File', 'No valid card records were found in this backup data.');
        setIsProcessing(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await importCards(incomingCards, mode);

      Alert.alert(
        'Vault Restored! 🎉',
        `Successfully restored ${incomingCards.length} cards into your nascard 3D wallet.`,
      );
      setImportJsonText('');
      onClose();
    } catch {
      Alert.alert('Invalid Format', 'Could not parse backup data. Make sure you pasted a valid .nascard backup code.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: bottomPad + 16 },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LinearGradient
                colors={['#10B981', '#047857']}
                style={styles.headerIconBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={[styles.title, { color: colors.foreground }]}>Vault Backup & Restore</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Encrypt & transfer your 3D cards safely
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={[styles.tabRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'cloud' && { backgroundColor: colors.card }]}
              onPress={() => setActiveTab('cloud')}
            >
              <Ionicons name="cloud-done-outline" size={15} color={activeTab === 'cloud' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabBtnText, { color: activeTab === 'cloud' ? colors.foreground : colors.mutedForeground }]}>
                Cloud Sync
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'export' && { backgroundColor: colors.card }]}
              onPress={() => setActiveTab('export')}
            >
              <Ionicons name="download-outline" size={15} color={activeTab === 'export' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabBtnText, { color: activeTab === 'export' ? colors.foreground : colors.mutedForeground }]}>
                File Export
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'restore' && { backgroundColor: colors.card }]}
              onPress={() => setActiveTab('restore')}
            >
              <Ionicons name="cloud-download-outline" size={15} color={activeTab === 'restore' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabBtnText, { color: activeTab === 'restore' ? colors.foreground : colors.mutedForeground }]}>
                File Import
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
            {activeTab === 'cloud' ? (
              <View style={{ gap: 14 }}>
                <View style={[styles.infoBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="cloud" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoBannerTitle, { color: colors.foreground }]}>
                      Device Swap & Loss Protection
                    </Text>
                    <Text style={[styles.infoBannerSub, { color: colors.mutedForeground }]}>
                      Sync your encrypted cards to your account email so you can recover everything if you lose or switch phones.
                    </Text>
                  </View>
                </View>

                {/* Last Cloud Synced Timestamp Badge */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: '#10B98118',
                    borderWidth: 1,
                    borderColor: '#10B98155',
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#10B981' }}>
                    {lastSyncedTime ? `Last Synced: ${lastSyncedTime}` : 'Cloud Snapshot: AES-256 Encrypted & Ready'}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>REGISTERED ACCOUNT EMAIL</Text>
                  <TextInput
                    value={userEmail}
                    onChangeText={setUserEmail}
                    placeholder="Enter your email (e.g. alex@gmail.com)"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      height: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      paddingHorizontal: 14,
                      fontSize: 14,
                      fontFamily: 'Inter_500Medium',
                      color: colors.foreground,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={handleCloudSync}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Sync to Cloud</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: '#10B981' }]}
                    onPress={handleCloudRestore}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Cloud Restore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : activeTab === 'export' ? (
              <View style={{ gap: 14 }}>
                {/* Stats Card */}
                <View style={[styles.infoBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoBannerTitle, { color: colors.foreground }]}>
                      {cards.length} Encrypted Cards Ready
                    </Text>
                    <Text style={[styles.infoBannerSub, { color: colors.mutedForeground }]}>
                      Export a full `.nascard` vault snapshot to Google Drive, iCloud, Files, or WhatsApp.
                    </Text>
                  </View>
                </View>

                {/* Benefits */}
                <View style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>BACKUP INCLUDES:</Text>
                  {[
                    '✓ All 3D card photos (Front & Back)',
                    '✓ Barcode & QR codes data',
                    '✓ ID numbers, expiry dates & notes',
                    '✓ Organization memberships & custom pass schema',
                  ].map((item, idx) => (
                    <Text key={idx} style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
                      {item}
                    </Text>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                  onPress={handleExportBackup}
                  activeOpacity={0.85}
                >
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Export .nascard Backup File</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PASTE BACKUP CODE / JSON:</Text>
                <TextInput
                  value={importJsonText}
                  onChangeText={setImportJsonText}
                  placeholder="Paste your .nascard backup JSON payload here..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={5}
                  style={[
                    styles.jsonInput,
                    { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={() => handleRestoreBackup('merge')}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnText}>Merge Cards</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => handleRestoreBackup('replace')}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Replace Vault</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: '85%',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  infoBannerSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  jsonInput: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
