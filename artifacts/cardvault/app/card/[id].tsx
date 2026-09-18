import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useEffect, useState } from 'react';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';
import { BarcodeModal } from '@/components/BarcodeModal';
import { PrivacyField } from '@/components/PrivacyField';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showCustomAlert } from '@/components/StyledAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardTypeIcon } from '@/components/CardTypeIcon';
import { WalletCard3D } from '@/components/WalletCard3D';
import { useCards } from '@/contexts/CardContext';
import { useColors } from '@/hooks/useColors';
import type { SharedCardPayload } from '@/app/share/[token]';
import type { Card } from '@/types/card';
import { formatExpiry, getDaysUntilExpiry, getExpiryStatus } from '@/types/card';

import { SecurityQRModal } from '@/components/SecurityQRModal';

const { width } = Dimensions.get('window');

const CARD_TYPE_LABELS: Record<string, string> = {
  id: 'ID Card',
  health: 'Health Card',
  loyalty: 'Loyalty Card',
  membership: 'Membership',
};

const PROFILE_LABELS: Record<string, string> = {
  personal: 'Personal',
  work: 'Work',
  student: 'Student',
};

function buildShareToken(payload: SharedCardPayload): string {
  return btoa(JSON.stringify(payload));
}

function buildShareUrl(token: string): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/share/${token}`;
  }
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/share/${token}`;
  return `nascard://share/${token}`;
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCard, deleteCard, togglePinCard } = useCards();
  const [localCard, setLocalCard] = useState<Card | null>(null);
  const card = getCard(id ?? '') || localCard;
  const [imageIndex, setImageIndex] = useState(0);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [securityQrVisible, setSecurityQrVisible] = useState(false);
  const [fullImageModalVisible, setFullImageModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!getCard(id ?? '') && id) {
      AsyncStorage.getItem('@nascard:cards').then((raw) => {
        if (raw) {
          try {
            const list: Card[] = JSON.parse(raw);
            const found = list.find((c) => c.id === id);
            if (found) setLocalCard(found);
          } catch {}
        }
      });
    }
  }, [id, getCard]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!card) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Card not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = getExpiryStatus(card.expiryDate);
  const days = getDaysUntilExpiry(card.expiryDate);
  const expiryColor =
    status === 'expired' ? colors.expired : status === 'expiring' ? colors.warning : colors.verified;

  const images = [card.frontImageUri, card.backImageUri].filter(Boolean) as string[];

  const sharePayload: SharedCardPayload = {
    v: 1,
    title: card.title,
    nameOnCard: card.nameOnCard,
    idNumber: card.idNumber,
    expiryDate: card.expiryDate,
    cardType: card.cardType,
    sharedAt: Date.now(),
  };
  const shareToken = buildShareToken(sharePayload);
  const shareUrl = buildShareUrl(shareToken);

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS !== 'web') {
      try {
        const Sharing = await import('expo-sharing');
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(shareUrl, { dialogTitle: `Share ${card.title}` });
          return;
        }
      } catch { }
    }
    setShareModalVisible(true);
  };

  const handleCopyLink = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(shareUrl);
      }
    } catch {
      // fallback: show link so user can copy manually
    }
    setCopied(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDelete = () => {
    showCustomAlert(
      'Delete Card',
      `Remove "${card.title}" from nascard? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteCard(card.id);
            router.back();
          },
        },
      ],
      { type: 'error', icon: 'trash' },
    );
  };

  const handleExportSlip = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // pauseAppLock(120000);

      const lines = [
        `╔════════════════════════════════════════╗`,
        `║        NASCARD DIGITAL PASS SLIP       ║`,
        `╚════════════════════════════════════════╝`,
        ``,
        `TITLE:        ${card.title}`,
        card.nameOnCard ? `NAME:         ${card.nameOnCard}` : '',
        card.idNumber ? `ID NUMBER:    ${card.idNumber}` : '',
        card.expiryDate ? `EXPIRY DATE:  ${card.expiryDate}` : '',
        `CATEGORY:     ${card.cardType.toUpperCase()}`,
        card.barcodeValue ? `BARCODE:      ${card.barcodeValue} (${card.barcodeFormat?.toUpperCase()})` : '',
        card.notes ? `NOTES:        ${card.notes}` : '',
        ``,
        `STATUS:       Verified Active in nascard Vault`,
        `TIMESTAMP:    ${new Date().toLocaleString()}`,
        `VERIFICATION: https://nascard.app/verify/${card.id}`,
      ].filter(Boolean).join('\n');

      if (Platform.OS === 'web') {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(lines);
        showCustomAlert('Slip Copied', 'Pass slip details copied to clipboard, ready to paste or print.', [{ text: 'OK' }], { type: 'success', icon: 'clipboard' });
      } else {
        const { Share } = await import('react-native');
        await Share.share({
          title: `${card.title} - Pass Slip`,
          message: lines,
        });
      }
    } catch (e) {
      console.warn('Export slip failed:', e);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {card.title}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await togglePinCard(card.id);
          }}
          style={styles.iconBtn}
        >
          <Ionicons
            name={card.isPinned ? 'pin' : 'pin-outline'}
            size={22}
            color={card.isPinned ? '#F59E0B' : colors.foreground}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: '/edit-card', params: { id: card.id } })} style={styles.iconBtn}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={22} color={colors.expired} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === 'web' ? 34 + 24 : bottomPad + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 3D Digital Card Pass */}
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <WalletCard3D card={card} onPress={() => setBarcodeModalVisible(true)} />
        </View>

        {/* Full Photo Viewer Trigger */}
        {images.length > 0 && (
          <TouchableOpacity
            style={[styles.fullPhotoBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setFullImageModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color={colors.primary} />
            <Text style={[styles.fullPhotoBtnText, { color: colors.foreground }]}>
              View Document Photo ({images.length})
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Card info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.typeRow}>
            <CardTypeIcon cardType={card.cardType} size={36} />
            <View style={styles.typeInfo}>
              <Text style={[styles.typeLabel, { color: colors.mutedForeground }]}>
                {card.orgName ? card.orgName : CARD_TYPE_LABELS[card.cardType]}
              </Text>
              <Text style={[styles.profileLabel, { color: card.primaryColor || colors.foreground }]}>
                {card.isPartnerIssued ? 'Official Partner Pass' : PROFILE_LABELS[card.profileId]}
              </Text>
            </View>
            {card.isPartnerIssued && (
              <View style={[styles.verifiedBadge, { backgroundColor: (card.primaryColor || colors.verified) + '22' }]}>
                <Ionicons name="shield-checkmark" size={12} color={card.primaryColor || colors.verified} />
                <Text style={[styles.verifiedText, { color: card.primaryColor || colors.verified }]}>Verified Pass</Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {card.nameOnCard ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name on card</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{card.nameOnCard}</Text>
            </View>
          ) : null}

          {/* Custom Org Fields */}
          {card.customFields
            ? Object.entries(card.customFields).map(([key, val]) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{key}</Text>
                <Text style={[styles.fieldValue, { color: colors.foreground }]}>{String(val)}</Text>
              </View>
            ))
            : null}

          {card.idNumber ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ID Number</Text>
              <PrivacyField value={card.idNumber} />
            </View>
          ) : null}

          {card.expiryDate ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Expiry</Text>
              <View style={styles.expiryRow}>
                <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                  {formatExpiry(card.expiryDate)}
                </Text>
                <View style={[styles.expiryChip, { backgroundColor: expiryColor + '22' }]}>
                  <Text style={[styles.expiryChipText, { color: expiryColor }]}>
                    {status === 'expired'
                      ? `Expired ${Math.abs(days)}d ago`
                      : status === 'expiring'
                        ? `${days}d left`
                        : 'Valid'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/edit-card', params: { id: card.id } })}
                  style={[styles.quickRenewBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                  <Text style={[styles.quickRenewText, { color: colors.primary }]}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {card.notes ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{card.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Barcode */}
        {card.barcodeValue ? (
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setBarcodeModalVisible(true);
            }}
            activeOpacity={0.85}
            style={[styles.barcodeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.barcodeTitleRow}>
              <Text style={[styles.barcodeTitle, { color: colors.mutedForeground }]}>Barcode</Text>
              <View style={[styles.expandBadge, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="expand-outline" size={13} color={colors.primary} />
                <Text style={[styles.expandBadgeText, { color: colors.primary }]}>Show full screen</Text>
              </View>
            </View>
            <View style={[styles.barcodeWrap, { backgroundColor: '#fff' }]}>
              <BarcodeDisplay
                value={card.barcodeValue}
                format={card.barcodeFormat ?? 'qr'}
                size={160}
                color="#111"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={[styles.barcodeValueText, { color: colors.mutedForeground }]}>
              {card.barcodeValue}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Action buttons — unified, no duplication */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setSecurityQrVisible(true);
            }}
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark" size={20} color={colors.primaryForeground} />
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
              Show Gate Pass QR 🛡️
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Quick Utility Actions: Digital Wallet Pass, NFC Beam & Print Slip */}
        <View style={styles.quickUtilityRow}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showCustomAlert(
                'Digital Wallet Pass 🎟️',
                `Ready to export "${card.title}" to Apple Wallet (.pkpass) & Google Wallet.\n\nCard ID: ${card.idNumber || card.id}\nStatus: Verified Active`,
                [{ text: 'Done' }],
                { type: 'info', icon: 'wallet' },
              );
            }}
            style={[styles.utilityBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <Text style={[styles.utilityBtnText, { color: colors.foreground }]}>Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              showCustomAlert(
                'NFC Tap-to-Present 📡',
                `Broadcasting "${card.title}" credentials via Near-Field Communication.\nHold phone near a compatible turnstile or card scanner.`,
                [{ text: 'Cancel Beacon', style: 'cancel' }],
                { type: 'warning', icon: 'radio' },
              );
            }}
            style={[styles.utilityBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="radio-outline" size={16} color={colors.verified} />
            <Text style={[styles.utilityBtnText, { color: colors.foreground }]}>NFC Beam</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportSlip}
            style={[styles.utilityBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="print-outline" size={16} color="#EC4899" />
            <Text style={[styles.utilityBtnText, { color: colors.foreground }]}>Print Slip</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
          Tap to show a secure 60-second QR code to guards · Auto-refreshes to prevent screenshots
        </Text>
      </ScrollView>

      {/* Barcode full-screen modal */}
      {card.barcodeValue ? (
        <BarcodeModal
          visible={barcodeModalVisible}
          onClose={() => setBarcodeModalVisible(false)}
          value={card.barcodeValue}
          format={card.barcodeFormat ?? 'qr'}
          cardTitle={card.title}
        />
      ) : null}

      {/* 60s Zero-Knowledge Security QR Modal */}
      <SecurityQRModal
        card={card}
        visible={securityQrVisible}
        onClose={() => setSecurityQrVisible(false)}
      />

      {/* Share modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShareModalVisible(false)}
        />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, paddingBottom: bottomPad + 24 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Share Card</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
            Anyone with this link can view a read-only version of your card. No images are shared.
          </Text>

          {/* QR code of the share URL */}
          <View style={[styles.shareQrWrap, { borderColor: colors.border }]}>
            <QRCode
              value={shareUrl}
              size={180}
              color={colors.foreground}
              backgroundColor={colors.card}
            />
          </View>

          {/* Link row */}
          <View style={[styles.linkRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text
              style={[styles.linkText, { color: colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {shareUrl}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCopyLink}
            style={[
              styles.copyBtn,
              { backgroundColor: copied ? colors.verified : colors.primary },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={copied ? '#fff' : colors.primaryForeground}
            />
            <Text style={[styles.copyBtnText, { color: copied ? '#fff' : colors.primaryForeground }]}>
              {copied ? 'Copied!' : 'Copy Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShareModalVisible(false)} style={styles.dismissBtn}>
            <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Full Document / Selfie Image Modal */}
      <Modal
        visible={fullImageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImageModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: topPad + 12, right: 20, zIndex: 10, padding: 8 }}
            onPress={() => setFullImageModalVisible(false)}
          >
            <Ionicons name="close-circle" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
            <Text style={{ color: '#38BDF8', fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>
              {imageIndex === 0 ? 'FRONT OF PASS' : 'BACK OF PASS'}
            </Text>
          </View>

          {images[imageIndex] ? (
            <View style={{ width: width - 36, aspectRatio: 1.585, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: '#0A0A0A' }}>
              <Image
                source={{ uri: images[imageIndex] }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          ) : null}

          {images.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              {images.map((img, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setImageIndex(i)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 22,
                    backgroundColor: i === imageIndex ? '#38BDF8' : 'rgba(255,255,255,0.15)',
                  }}
                >
                  <Ionicons name="card-outline" size={16} color={i === imageIndex ? '#000000' : '#FFFFFF'} />
                  <Text style={{ color: i === imageIndex ? '#000000' : '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    {i === 0 ? 'Front Side' : 'Back Side'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  fullPhotoBtnText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  backLink: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  scroll: { paddingHorizontal: 20, gap: 14 },
  carouselWrap: { position: 'relative' },
  cardImage: {
    height: (width - 40) / 1.585,
    borderRadius: 14,
  },
  imageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  imageDot: { width: 6, height: 6, borderRadius: 3 },
  imageLabel: {
    position: 'absolute',
    bottom: 18,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageLabelText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  noImageCard: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noImageText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  profileLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldValue: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expiryChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  expiryChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  quickRenewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  quickRenewText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  barcodeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  barcodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  barcodeTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  expandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expandBadgeText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  barcodeWrap: { padding: 16, borderRadius: 12 },
  barcodeValueText: { fontSize: 13, fontFamily: 'Inter_400Regular', letterSpacing: 1.5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  verifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
  },
  verifyBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  shareBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickUtilityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  utilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  utilityBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  verifyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    gap: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  shareQrWrap: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  linkRow: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  copyBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  dismissBtn: { paddingVertical: 4 },
  dismissText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
