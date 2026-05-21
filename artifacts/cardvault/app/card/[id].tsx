import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
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

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCard, deleteCard } = useCards();
  const card = getCard(id ?? '');
  const [imageIndex, setImageIndex] = useState(0);

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
          {/* Type + profile row */}
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

          {/* Fields */}
          {[
            { label: 'Name on card', value: card.nameOnCard },
            { label: 'ID Number', value: card.idNumber },
          ]
            .filter((f) => f.value)
            .map((field) => (
              <View key={field.label} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {field.label}
                </Text>
                <Text style={[styles.fieldValue, { color: colors.foreground }]}>
                  {field.value}
                </Text>
              </View>
            ))}

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
          <View style={[styles.barcodeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.barcodeTitle, { color: colors.mutedForeground }]}>Barcode</Text>
            <View style={styles.barcodeWrap}>
              <QRCode
                value={card.barcodeValue}
                size={160}
                color={colors.foreground}
                backgroundColor={colors.card}
              />
            </View>
            <Text style={[styles.barcodeValue, { color: colors.mutedForeground }]}>
              {card.barcodeValue}
            </Text>
          </View>
        ) : null}

        {/* Verify button */}
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            router.push(`/verify/${card.id}`);
          }}
          style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={22} color={colors.primaryForeground} />
          <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
            Verify for Guard
          </Text>
        </TouchableOpacity>

        <Text style={[styles.verifyHint, { color: colors.mutedForeground }]}>
          Generates a 60-second QR code for live verification
        </Text>
      </ScrollView>
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
  carouselWrap: { position: 'relative', marginBottom: 0 },
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
  barcodeTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
  },
  barcodeWrap: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  barcodeValue: { fontSize: 13, fontFamily: 'Inter_400Regular', letterSpacing: 1.5 },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
    marginTop: 4,
  },
  verifyBtnText: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  verifyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
