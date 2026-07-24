import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';
import { formatExpiry, getExpiryStatus } from '@/types/card';

const { width: SCREEN_W } = Dimensions.get('window');
export const CARD_W = Math.min(SCREEN_W - 48, 360);
export const CARD_H = CARD_W / 1.586;

const PROFILE_GRADIENTS: Record<string, [string, string]> = {
  personal: ['#0F172A', '#1E293B'],
  work: ['#2A1B4B', '#1A0D33'],
  student: ['#1E3A8A', '#0F172A'],
};

const TYPE_ACCENT: Record<string, string> = {
  id: '#C9A227',
  health: '#22C55E',
  loyalty: '#F59E0B',
  membership: '#9B6DFF',
};

interface Props {
  card: Card;
  onPress: () => void;
  index?: number;
  total?: number;
  isStacked?: boolean;
}

export function WalletCard3D({ card, onPress, isStacked }: Props) {
  const colors = useColors();
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlipped = useRef(false);

  const [bg1, bg2] = PROFILE_GRADIENTS[card.profileId] ?? PROFILE_GRADIENTS.personal;
  const accent = TYPE_ACCENT[card.cardType] ?? colors.primary;
  const status = getExpiryStatus(card.expiryDate);

  const flipCard = useCallback(() => {
    if (isFlipped.current) {
      Animated.spring(flipAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    } else {
      Animated.spring(flipAnim, { toValue: 180, useNativeDriver: true, tension: 60, friction: 10 }).start();
    }
    isFlipped.current = !isFlipped.current;
  }, [flipAnim]);

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 90, 180], outputRange: ['0deg', '90deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 90, 180], outputRange: ['180deg', '90deg', '0deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [0, 1] });

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const runShimmer = () => {
      shimmerAnim.setValue(0);
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) runShimmer();
      });
    };
    runShimmer();
    return () => shimmerAnim.stopAnimation();
  }, [shimmerAnim]);

  const shimmerX = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-CARD_W, CARD_W * 2] });

  const hasPhoto = Boolean(card.frontImageUri);

  return (
    <TouchableOpacity onPress={onPress} onLongPress={flipCard} activeOpacity={0.92} delayLongPress={160}>
      <View style={[styles.cardOuter, { width: CARD_W, height: CARD_H }]}>
        {/* FRONT */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            { backgroundColor: bg1, width: CARD_W, height: CARD_H },
            { transform: [{ perspective: 1200 }, { rotateY: frontInterpolate }], opacity: frontOpacity },
          ]}
        >
          {/* Real Photo of Physical Document/Card (Edge-to-Edge) */}
          {hasPhoto ? (
            <Image
              source={{ uri: card.frontImageUri! }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          ) : null}

          {/* Holographic shimmer strip overlay */}
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerX }, { rotate: '20deg' }] },
            ]}
            pointerEvents="none"
          />

          {/* Accent top bar */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          {/* Card chip (shown if no custom photo or on digital cards) */}
          {!hasPhoto && (
            <View style={[styles.chip, { borderColor: accent + '88' }]}>
              <View style={[styles.chipInner, { backgroundColor: accent + '44' }]} />
            </View>
          )}

          {/* Gradient Overlay for Text Protection */}
          <LinearGradient
            colors={
              hasPhoto
                ? ['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.85)']
                : ['rgba(5,10,20,0.3)', 'rgba(5,10,20,0.65)']
            }
            style={StyleSheet.absoluteFillObject}
          />

          {/* Content */}
          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <View style={[styles.typeBadge, { backgroundColor: accent + '44', borderColor: accent + 'AA' }]}>
                <Text style={[styles.typeText, { color: '#FFFFFF' }]}>{card.cardType.toUpperCase()}</Text>
              </View>
              {card.isPartnerIssued ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
                  <Text style={styles.verifiedText}>VERIFIED PASS</Text>
                </View>
              ) : hasPhoto ? (
                <View style={styles.photoDocBadge}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                  <Text style={styles.photoDocText}>PHYSICAL DOC</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
              {card.nameOnCard ? (
                <Text style={styles.cardName} numberOfLines={1}>{card.nameOnCard}</Text>
              ) : null}
              <View style={styles.cardFooter}>
                {card.idNumber ? (
                  <Text style={styles.cardNumber}>
                    {card.idNumber.length > 8 ? '•••• ' + card.idNumber.slice(-4) : card.idNumber}
                  </Text>
                ) : null}
                {card.expiryDate ? (
                  <Text style={[styles.cardExpiry, status === 'expired' ? styles.expired : status === 'expiring' ? styles.expiring : null]}>
                    {formatExpiry(card.expiryDate)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.flipHint}>Hold to flip 3D</Text>
        </Animated.View>

        {/* BACK */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            { backgroundColor: bg2, width: CARD_W, height: CARD_H },
            { transform: [{ perspective: 1200 }, { rotateY: backInterpolate }], opacity: backOpacity },
          ]}
        >
          <View style={styles.magneticStripe} />
          {card.backImageUri ? (
            <Image source={{ uri: card.backImageUri }} style={styles.cardBackImg} contentFit="cover" />
          ) : (
            <View style={styles.backContent}>
              {card.notes ? (
                <Text style={styles.backNotes} numberOfLines={4}>{card.notes}</Text>
              ) : (
                <Text style={styles.backEmpty}>Official nascard Encrypted Document Pass</Text>
              )}
            </View>
          )}
          <View style={styles.cardOverlay} />
          <Text style={styles.flipHint}>Hold to flip back</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardOuter: { position: 'relative' },
  cardFace: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 16,
  },
  cardFront: {},
  cardBack: {},
  shimmer: {
    position: 'absolute',
    top: -40,
    width: 65,
    height: CARD_H + 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '20deg' }],
    zIndex: 10,
  },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, zIndex: 12 },
  chip: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 36,
    height: 28,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 11,
  },
  chipInner: { flex: 1, margin: 2, borderRadius: 3 },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,20,0.62)',
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: 'space-between',
    zIndex: 15,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#F59E0B' },
  photoDocBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  photoDocText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  cardBottom: { gap: 4 },
  cardTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardNumber: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', letterSpacing: 1.5 },
  cardExpiry: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.85)' },
  expired: { color: '#FF6B6B' },
  expiring: { color: '#F59E0B' },
  flipHint: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    zIndex: 15,
  },
  magneticStripe: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: '#111',
  },
  cardBackImg: {
    position: 'absolute',
    top: 96,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    paddingTop: 100,
    justifyContent: 'center',
  },
  backNotes: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  backEmpty: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
});
