import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';
import { formatExpiry, getDaysUntilExpiry, getExpiryStatus } from '@/types/card';
import { CardTypeIcon } from './CardTypeIcon';

interface Props {
  card: Card;
  onPress: () => void;
}

const PROFILE_COLORS: Record<string, string> = {
  personal: '#C9A227',
  work: '#9B6DFF',
  student: '#22D3EE',
};

export function CardItem({ card, onPress }: Props) {
  const colors = useColors();
  const status = getExpiryStatus(card.expiryDate);
  const days = getDaysUntilExpiry(card.expiryDate);
  const accentColor = card.primaryColor || PROFILE_COLORS[card.profileId] || colors.primary;

  const expiryColor =
    status === 'expired'
      ? colors.expired
      : status === 'expiring'
        ? colors.warning
        : colors.mutedForeground;

  const expiryLabel =
    status === 'expired'
      ? 'EXPIRED'
      : status === 'expiring'
        ? days <= 1
          ? 'TODAY'
          : `${days}d left`
        : formatExpiry(card.expiryDate);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      <View style={styles.thumbnail}>
        {card.frontImageUri ? (
          <Image
            source={{ uri: card.frontImageUri }}
            style={styles.thumbnailImg}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.muted }]}>
            <Ionicons name="card-outline" size={22} color={colors.mutedForeground} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <CardTypeIcon cardType={card.cardType} size={32} />
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {card.title}
            </Text>
            {card.nameOnCard ? (
              <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {card.nameOnCard}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomRow}>
          {card.isPartnerIssued && (
            <View style={[styles.badge, { backgroundColor: colors.verified + '22' }]}>
              <Ionicons name="shield-checkmark" size={10} color={colors.verified} />
              <Text style={[styles.badgeText, { color: colors.verified }]}>Verified</Text>
            </View>
          )}
          <Text style={[styles.expiry, { color: expiryColor }]}>{expiryLabel}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  thumbnail: {
    width: 56,
    height: 56,
    margin: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  info: {
    flex: 1,
    paddingVertical: 12,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  sub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 40,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  expiry: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  chevron: {
    marginRight: 12,
  },
});
