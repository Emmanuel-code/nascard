import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardItem } from '@/components/CardItem';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';
import { useNearbyCard } from '@/hooks/useNearbyCard';
import type { ProfileType } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';

const PROFILES: { key: ProfileType; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'Work' },
  { key: 'student', label: 'Student' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, setActiveProfile } = useProfile();
  const { cards, isLoading, searchCards } = useCards();
  const [query, setQuery] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const profileCards = useMemo(
    () => searchCards(query, profile.activeProfile),
    [searchCards, query, profile.activeProfile],
  );

  const expiringCards = useMemo(
    () =>
      cards
        .filter((c) => c.profileId === profile.activeProfile)
        .filter((c) => getDaysUntilExpiry(c.expiryDate) <= 14 && getDaysUntilExpiry(c.expiryDate) >= 0),
    [cards, profile.activeProfile],
  );

  const { suggestion: nearbySuggestion } = useNearbyCard(profileCards);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  const onFabPress = async () => {
    fabScale.value = withSpring(0.9, {}, () => {
      fabScale.value = withSpring(1);
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-card');
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
              {profile.displayName || 'CardVault'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Profile switcher */}
        <View style={styles.profileSwitcher}>
          {PROFILES.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => setActiveProfile(p.key)}
              style={[
                styles.profilePill,
                {
                  backgroundColor:
                    profile.activeProfile === p.key ? colors.primary : colors.secondary,
                  borderColor:
                    profile.activeProfile === p.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.profilePillText,
                  {
                    color:
                      profile.activeProfile === p.key
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View
          style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cards..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Nearby card suggestion */}
        {nearbySuggestion && query.length === 0 && (
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
        {expiringCards.length > 0 && query.length === 0 && (
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

        {/* Cards section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {query ? 'Results' : 'My Cards'}
            </Text>
            <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
              {profileCards.length}
            </Text>
          </View>

          {isLoading ? null : profileCards.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Ionicons name="card-outline" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {query ? 'No cards found' : 'No cards yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {query ? 'Try a different search term' : 'Tap + to add your first card'}
              </Text>
            </View>
          ) : (
            profileCards.map((card) => (
              <CardItem key={card.id} card={card} onPress={() => router.push(`/card/${card.id}`)} />
            ))
          )}
        </View>
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
    marginBottom: 20,
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
  profileSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  profilePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  profilePillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
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
    marginBottom: 16,
  },
  expiryBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  section: { gap: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sectionCount: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    backgroundColor: 'transparent',
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
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
