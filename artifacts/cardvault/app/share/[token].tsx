import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { CardType } from '@/types/card';
import { formatExpiry, getExpiryStatus, getDaysUntilExpiry } from '@/types/card';

export interface SharedCardPayload {
  v: number;
  title: string;
  nameOnCard: string;
  idNumber: string;
  expiryDate: string;
  cardType: CardType;
  sharedAt: number;
}

const TYPE_LABELS: Record<CardType, string> = {
  id: 'ID Card',
  health: 'Health Card',
  loyalty: 'Loyalty Card',
  membership: 'Membership',
};

const TYPE_COLORS: Record<CardType, string> = {
  id: '#4F8EF7',
  health: '#22C55E',
  loyalty: '#F59E0B',
  membership: '#9B6DFF',
};

const TYPE_ICONS: Record<CardType, { icon: string; lib: 'ionicons' | 'mci' }> = {
  id: { icon: 'card-account-details', lib: 'mci' },
  health: { icon: 'medical-bag', lib: 'mci' },
  loyalty: { icon: 'star', lib: 'ionicons' },
  membership: { icon: 'shield-checkmark', lib: 'ionicons' },
};

export default function SharePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const card = useMemo((): SharedCardPayload | null => {
    if (!token) return null;
    try {
      return JSON.parse(atob(token));
    } catch {
      return null;
    }
  }, [token]);

  if (!card) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Invalid link</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            This share link is invalid or has been corrupted.
          </Text>
        </View>
      </View>
    );
  }

  const status = getExpiryStatus(card.expiryDate);
  const days = getDaysUntilExpiry(card.expiryDate);
  const expiryColor =
    status === 'expired' ? colors.expired : status === 'expiring' ? colors.warning : colors.verified;

  const typeColor = TYPE_COLORS[card.cardType] ?? colors.primary;
  const typeIcon = TYPE_ICONS[card.cardType];
  const sharedDate = new Date(card.sharedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Shared Card</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 40 : insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card hero */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: typeColor + '14',
              borderColor: typeColor + '33',
            },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: typeColor + '22' }]}>
            {typeIcon.lib === 'ionicons' ? (
              <Ionicons name={typeIcon.icon as any} size={36} color={typeColor} />
            ) : (
              <MaterialCommunityIcons name={typeIcon.icon as any} size={36} color={typeColor} />
            )}
          </View>
          <Text style={[styles.heroType, { color: typeColor }]}>{TYPE_LABELS[card.cardType]}</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{card.title}</Text>
          {card.nameOnCard ? (
            <Text style={[styles.heroName, { color: colors.mutedForeground }]}>{card.nameOnCard}</Text>
          ) : null}
        </View>

        {/* Fields */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {card.idNumber ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ID Number</Text>
              <Text style={[styles.fieldValue, { color: colors.foreground }]}>{card.idNumber}</Text>
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

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Shared on</Text>
            <Text style={[styles.fieldValue, { color: colors.foreground }]}>{sharedDate}</Text>
          </View>
        </View>

        {/* QR code of this page's URL */}
        {token ? (
          <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.qrLabel, { color: colors.mutedForeground }]}>QR Code</Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={`${typeof window !== 'undefined' ? window.location.href : `cardvault://share/${token}`}`}
                size={160}
                color={colors.foreground}
                backgroundColor={colors.card}
              />
            </View>
            <Text style={[styles.qrHint, { color: colors.mutedForeground }]}>
              Others can scan this to view the shared card
            </Text>
          </View>
        ) : null}

        {/* Disclaimer */}
        <View style={[styles.disclaimer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            This is a read-only view shared by the card owner. It does not include images or sensitive verification data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, gap: 14 },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroType: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroName: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  field: { gap: 3 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldValue: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expiryChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  expiryChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  qrCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  qrLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, alignSelf: 'flex-start' },
  qrWrap: { padding: 12, borderRadius: 12 },
  qrHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  errorTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  errorSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
