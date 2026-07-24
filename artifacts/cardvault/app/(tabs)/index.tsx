import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProPaywall } from '@/components/ProPaywall';
import { StackedCardDeck } from '@/components/StackedCardDeck';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';
import { useNearbyCard } from '@/hooks/useNearbyCard';
import type { Card } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';

const FREE_CARD_LIMIT = 5;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { cards, isLoading } = useCards();
  const { isPro } = usePro();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const atLimit = !isPro && cards.length >= FREE_CARD_LIMIT;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const myCards = cards.filter((c) => c.profileId === profile.activeProfile);

  const expiringCards = useMemo(
    () => cards.filter((c: any) => getDaysUntilExpiry(c.expiryDate) <= 14 && getDaysUntilExpiry(c.expiryDate) >= 0),
    [cards],
  );

  const { suggestion: nearbySuggestion } = useNearbyCard(myCards);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  const onFabPress = async () => {
    fabScale.value = withSpring(0.9, {}, () => { fabScale.value = withSpring(1); });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (atLimit) { setPaywallVisible(true); return; }
    Alert.alert('Add to nascard', 'Choose how you want to add your card or pass:', [
      {
        text: '📷 Scan Card Barcode / QR',
        onPress: () => router.push('/add-card?autoScan=true' as any),
      },
      {
        text: '🏢 Join Organization Pass',
        onPress: () => router.push('/org' as any),
      },
      {
        text: '📸 Add Card (Photo + Details)',
        onPress: () => router.push('/add-card'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ProPaywall visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 16,
            paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {profile.displayName || 'nascard Wallet'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push('/org' as any)}
              style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}
            >
              <Ionicons name="business-outline" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/notifications')}
              style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              {expiringCards.length > 0 && (
                <View style={styles.alertBadgeDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Nearby card suggestion */}
        {nearbySuggestion && (
          <TouchableOpacity
            style={[styles.nearbyBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '44' }]}
            onPress={() => router.push(`/card/${nearbySuggestion.card.id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.nearbyTitle, { color: colors.primary }]}>Near you</Text>
              <Text style={[styles.nearbyCard, { color: colors.foreground }]} numberOfLines={1}>
                {nearbySuggestion.card.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Expiring soon banner */}
        {expiringCards.length > 0 && (
          <TouchableOpacity
            style={[styles.expiryBanner, { backgroundColor: colors.warning + '1A', borderColor: colors.warning + '44' }]}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={[styles.expiryBannerText, { color: colors.warning }]}>
              {expiringCards.length} card{expiringCards.length > 1 ? 's' : ''} expiring soon
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.warning} />
          </TouchableOpacity>
        )}

        {/* ── Apple Wallet Interactive Stacked Deck ── */}
        {isLoading ? null : myCards.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="card-outline" size={36} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No cards yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Tap + to photograph and add your first card
            </Text>
            <TouchableOpacity
              onPress={onFabPress}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Add first card</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <StackedCardDeck
            cards={myCards}
            onCardPress={(card) => router.push(`/card/${card.id}`)}
          />
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View
        style={[
          styles.fab,
          fabStyle,
          {
            backgroundColor: colors.primary,
            bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84,
          },
        ]}
      >
        <TouchableOpacity onPress={onFabPress} style={styles.fabInner}>
          <Ionicons name="add" size={28} color={colors.primaryForeground} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  name: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  nearbyTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  nearbyCard: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
  expiryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  expiryBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute',
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
  },
});
