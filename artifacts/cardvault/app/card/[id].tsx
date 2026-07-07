import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useState } from 'react';
import { BarcodeDisplay } from '@/components/BarcodeDisplay';
import { BarcodeModal } from '@/components/BarcodeModal';
import { PrivacyField } from '@/components/PrivacyField';
import {
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardTypeIcon } from '@/components/CardTypeIcon';
import { useCards } from '@/contexts/CardContext';
import { useColors } from '@/hooks/useColors';
import type { SharedCardPayload } from '@/app/share/[token]';
import { formatExpiry, getDaysUntilExpiry, getExpiryStatus } from '@/types/card';

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
  return `cardvault://share/${token}`;
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCard, deleteCard } = useCards();
  const card = getCard(id ?? '');
  const [imageIndex, setImageIndex] = useState(0);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);

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
      } catch {}
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
    Alert.alert(
      'Delete Card',
      `Remove "${card.title}" from CardVault?`,
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
    );
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
        {/* Image carousel */}
        {images.length > 0 ? (
          <View style={styles.carouselWrap}>
            <FlatList
              data={images}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setImageIndex(Math.round(e.nativeEvent.contentOffset.x / (width - 40)));
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={[styles.cardImage, { width: width - 40 }]}
                  contentFit="cover"
                />
              )}
            />
            {images.length > 1 && (
              <View style={styles.imageDots}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.imageDot,
                      {
                        backgroundColor:
                          i === imageIndex ? colors.foreground : colors.foreground + '44',
                      },
                    ]}
                  />
                ))}
              </View>
            )}
            {images.length > 1 && (
              <View style={[styles.imageLabel, { backgroundColor: colors.card + 'CC' }]}>
                <Text style={[styles.imageLabelText, { color: colors.mutedForeground }]}>
                  {imageIndex === 0 ? 'Front' : 'Back'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[styles.noImageCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="card-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.noImageText, { color: colors.mutedForeground }]}>No image</Text>
          </View>
        )}

        {/* Card info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.typeRow}>
            <CardTypeIcon cardType={card.cardType} size={36} />
            <View style={styles.typeInfo}>
              <Text style={[styles.typeLabel, { color: colors.mutedForeground }]}>
                {CARD_TYPE_LABELS[card.cardType]}
              </Text>
              <Text style={[styles.profileLabel, { color: colors.foreground }]}>
                {PROFILE_LABELS[card.profileId]}
              </Text>
            </View>
            {card.isPartnerIssued && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.verified + '22' }]}>
                <Ionicons name="shield-checkmark" size={12} color={colors.verified} />
                <Text style={[styles.verifiedText, { color: colors.verified }]}>Verified</Text>
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

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.push(`/verify/${card.id}`);
            }}
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code" size={20} color={colors.primaryForeground} />
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
              Verify for Guard
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

        <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
          60-second QR for live verification · Share sends a read-only link
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
