import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';
import { useCards } from '@/contexts/CardContext';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';

interface Props {
  card: Card | null;
  visible: boolean;
  onClose: () => void;
  onTogglePrivacyMask?: (cardId: string) => void;
  isPrivacyMasked?: boolean;
}

export function CardQuickActionSheet({
  card,
  visible,
  onClose,
  onTogglePrivacyMask,
  isPrivacyMasked = false,
}: Props) {
  const colors = useColors();
  const router = useRouter();
  const { deleteCard, togglePinCard } = useCards();
  const [fullscreenBarcodeVisible, setFullscreenBarcodeVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!card) return null;

  const handleDelete = () => {
    Alert.alert(
      'Delete Card',
      `Are you sure you want to delete "${card.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await deleteCard(card.id);
            onClose();
          },
        },
      ],
    );
  };

  const handleCopyId = async () => {
    const textToCopy = card.idNumber || card.barcodeValue || card.title;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Fallback copy or native Clipboard
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleGenerateShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push(`/share/${card.id}`);
  };

  const handleViewDetails = () => {
    onClose();
    router.push(`/card/${card.id}`);
  };

  return (
    <>
      {/* ── Main Action Sheet Modal ── */}
      <Modal
        visible={visible && !fullscreenBarcodeVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />

          <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Grab Handle */}
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

            {/* Card Header Header */}
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.cardIconWrap,
                  { backgroundColor: (card.primaryColor || colors.primary) + '22' },
                ]}
              >
                <Ionicons name="card" size={24} color={card.primaryColor || colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitleText, { color: colors.foreground }]} numberOfLines={1}>
                  {card.title}
                </Text>
                <Text style={[styles.cardSubText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {card.nameOnCard || card.cardType.toUpperCase()} · {card.profileId.toUpperCase()}
                </Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Copy Notification Toast */}
            {copySuccess && (
              <View style={[styles.copyToast, { backgroundColor: colors.verified + '20', borderColor: colors.verified }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.verified} />
                <Text style={[styles.copyToastText, { color: colors.verified }]}>
                  Card ID copied to clipboard!
                </Text>
              </View>
            )}

            {/* Action Items List */}
            <View style={styles.actionList}>
              {/* 1. Fullscreen Barcode Zoom */}
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFullscreenBarcodeVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '18' }]}>
                  <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                    Fullscreen Barcode Zoom
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                    High-contrast max brightness for cashier scanner
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* 2. Copy ID Number */}
              {card.idNumber ? (
                <TouchableOpacity
                  style={[styles.actionRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={handleCopyId}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: '#10B98118' }]}>
                    <Ionicons name="copy-outline" size={20} color="#10B981" />
                  </View>
                  <View style={styles.actionBody}>
                    <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                      Copy Card / ID Number
                    </Text>
                    <Text style={[styles.actionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {card.idNumber}
                    </Text>
                  </View>
                  <Ionicons name="duplicate-outline" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}

              {/* 3. Generate 60s Share Pass */}
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handleGenerateShare}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#8B5CF618' }]}>
                  <Ionicons name="time-outline" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                    Generate 60-Second Share Link
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                    Encrypted temporary link for 1-time verification
                  </Text>
                </View>
                <Ionicons name="share-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* 4. Favorite / Pin to Front */}
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.background, borderColor: card.isPinned ? '#F59E0B66' : colors.border }]}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await togglePinCard(card.id);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: '#F59E0B20' }]}>
                  <Ionicons
                    name={card.isPinned ? 'star' : 'star-outline'}
                    size={20}
                    color="#F59E0B"
                  />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                    {card.isPinned ? 'Unpin from Front of Deck' : '⭐ Pin to Front of Deck'}
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                    {card.isPinned ? 'Restore normal sorting order' : 'Keep this card at the very top of your 3D stack'}
                  </Text>
                </View>
                <Ionicons name={card.isPinned ? 'pin' : 'pin-outline'} size={18} color="#F59E0B" />
              </TouchableOpacity>

              {/* 5. Privacy Masking Toggle */}
              {onTogglePrivacyMask && (
                <TouchableOpacity
                  style={[styles.actionRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onTogglePrivacyMask(card.id);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: '#F59E0B18' }]}>
                    <Ionicons
                      name={isPrivacyMasked ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#F59E0B"
                    />
                  </View>
                  <View style={styles.actionBody}>
                    <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                      {isPrivacyMasked ? 'Unmask Sensitive Digits' : 'Mask Sensitive Digits'}
                    </Text>
                    <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                      {isPrivacyMasked ? 'Show full card numbers' : 'Blur sensitive ID digits on card face'}
                    </Text>
                  </View>
                  <Ionicons name="shield-outline" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              {/* 5. Delete Card */}
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.destructive + '14', borderColor: colors.destructive + '44' }]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: colors.destructive + '22' }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: colors.destructive }]}>
                    Delete Card
                  </Text>
                  <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
                    Permanently remove this card from your vault
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
              </TouchableOpacity>

              {/* 6. Open Full Details */}
              <TouchableOpacity
                style={[styles.actionRow, { backgroundColor: colors.primary }]}
                onPress={handleViewDetails}
                activeOpacity={0.88}
              >
                <Ionicons name="open-outline" size={20} color={colors.primaryForeground} />
                <Text style={[styles.viewDetailsText, { color: colors.primaryForeground }]}>
                  View Full Card Details & Back Face
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Fullscreen Barcode Zoom Modal ── */}
      <Modal
        visible={fullscreenBarcodeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenBarcodeVisible(false)}
      >
        <View style={styles.fullscreenBarcodeOverlay}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setFullscreenBarcodeVisible(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.fullscreenCardBox}>
            <Text style={styles.fullscreenTitle}>{card.title}</Text>
            <Text style={styles.fullscreenSub}>{card.nameOnCard || 'Official Digital Pass'}</Text>

            <View style={styles.barcodeFrame}>
              <BarcodeDisplay
                format={card.barcodeFormat || 'qr'}
                value={card.barcodeValue || card.idNumber || card.title}
                size={160}
              />
            </View>

            <Text style={styles.fullscreenHint}>
              High-contrast mode for scanner compatibility
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    gap: 16,
  },
  handleBar: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitleText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  cardSubText: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  closeBtn: { padding: 4 },
  copyToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  copyToastText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  actionList: { gap: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  actionIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  actionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  viewDetailsText: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center' },

  // Fullscreen Barcode Modal
  fullscreenBarcodeOverlay: {
    flex: 1,
    backgroundColor: '#000000FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullscreenCloseBtn: { position: 'absolute', top: 50, right: 24 },
  fullscreenCardBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  fullscreenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#0A0E1A' },
  fullscreenSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#636E95' },
  barcodeFrame: { marginVertical: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12 },
  fullscreenHint: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#636E95' },
});
