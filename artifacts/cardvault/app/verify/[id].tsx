import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width - 80, 260);
const EXPIRY_SECONDS = 60;

function generateToken(cardId: string, displayName: string, idNumber: string, expiryDate: string): string {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const payload = {
    v: 1,
    cardId,
    displayName,
    idNumber,
    expiryDate,
    issuedAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
    nonce,
  };
  return btoa(JSON.stringify(payload));
}

export default function VerifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCard } = useCards();
  const { profile } = useProfile();
  const card = getCard(id ?? '');

  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);
  const [expired, setExpired] = useState(false);
  const [token] = useState(() =>
    card
      ? generateToken(
          card.id,
          profile.displayName || card.nameOnCard,
          card.idNumber,
          card.expiryDate,
        )
      : '',
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Countdown timer
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setExpired(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Animated corner brackets
  const pulse = useRef(new Animated.Value(0.6)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
    ).start();
  }, []);

  const borderOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const rotationDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const timerColor =
    secondsLeft > 30 ? colors.verified : secondsLeft > 10 ? colors.warning : colors.expired;

  const progress = secondsLeft / EXPIRY_SECONDS;

  if (!card) {
    return (
      <View style={[styles.root, { backgroundColor: '#080C16' }]}>
        <Text style={{ color: '#EDF0FF' }}>Card not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#080C16' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify for Guard</Text>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.instruction}>Show this QR code to the guard</Text>

        {/* QR Container with animated border */}
        <View style={[styles.qrOuter, { width: QR_SIZE + 48, height: QR_SIZE + 48 }]}>
          {/* Animated spinning ring */}
          {!expired && (
            <Animated.View
              style={[
                styles.spinRing,
                {
                  width: QR_SIZE + 48,
                  height: QR_SIZE + 48,
                  borderRadius: (QR_SIZE + 48) / 2,
                  borderTopColor: timerColor,
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                  borderLeftColor: timerColor + '55',
                  transform: [{ rotate: rotationDeg }],
                  opacity: borderOpacity,
                },
              ]}
            />
          )}

          {/* Corner brackets */}
          {!expired &&
            (['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <Animated.View
                key={corner}
                style={[
                  styles.corner,
                  {
                    top: corner.startsWith('t') ? 4 : undefined,
                    bottom: corner.startsWith('b') ? 4 : undefined,
                    left: corner.endsWith('l') ? 4 : undefined,
                    right: corner.endsWith('r') ? 4 : undefined,
                    borderTopWidth: corner.startsWith('t') ? 3 : 0,
                    borderBottomWidth: corner.startsWith('b') ? 3 : 0,
                    borderLeftWidth: corner.endsWith('l') ? 3 : 0,
                    borderRightWidth: corner.endsWith('r') ? 3 : 0,
                    borderColor: timerColor,
                    opacity: borderOpacity,
                  },
                ]}
              />
            ))}

          {/* QR code */}
          <View
            style={[
              styles.qrInner,
              {
                width: QR_SIZE + 16,
                height: QR_SIZE + 16,
                borderRadius: 16,
                backgroundColor: expired ? '#1C1C1C' : '#FFFFFF',
              },
            ]}
          >
            {expired ? (
              <View style={styles.expiredWrap}>
                <Ionicons name="time-outline" size={40} color="#666" />
                <Text style={styles.expiredText}>QR Expired</Text>
              </View>
            ) : (
              <QRCode
                value={token}
                size={QR_SIZE}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        {/* Timer */}
        {!expired ? (
          <View style={styles.timerWrap}>
            <Text style={[styles.timerNumber, { color: timerColor }]}>{secondsLeft}</Text>
            <Text style={styles.timerLabel}>seconds remaining</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.refreshBtn, { backgroundColor: timerColor + '22', borderColor: timerColor }]}
          >
            <Ionicons name="refresh" size={18} color={timerColor} />
            <Text style={[styles.refreshText, { color: timerColor }]}>Generate New QR</Text>
          </TouchableOpacity>
        )}

        {/* Card info row */}
        <View style={[styles.cardInfo, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
          <View style={styles.cardInfoLeft}>
            <Text style={styles.cardInfoName}>
              {profile.displayName || card.nameOnCard || 'Cardholder'}
            </Text>
            <Text style={styles.cardInfoSub}>{card.title}</Text>
          </View>
          {card.isPartnerIssued && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.verified + '22' }]}>
              <Ionicons name="shield-checkmark" size={12} color={colors.verified} />
              <Text style={[styles.verifiedText, { color: colors.verified }]}>Verified</Text>
            </View>
          )}
        </View>

        <Text style={styles.antiScreenshot}>
          Anti-replay protected · One-time use · Expires in {EXPIRY_SECONDS}s
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  instruction: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  qrOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spinRing: {
    position: 'absolute',
    borderWidth: 3,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
  },
  qrInner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  expiredWrap: { alignItems: 'center', gap: 8 },
  expiredText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: '#666' },
  timerWrap: { alignItems: 'center', gap: 2 },
  timerNumber: { fontSize: 48, fontFamily: 'Inter_700Bold' },
  timerLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.4)',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  refreshText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  cardInfoLeft: { flex: 1 },
  cardInfoName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.9)',
  },
  cardInfoSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  antiScreenshot: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
  },
});
