import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProPaywall } from '@/components/ProPaywall';
import { useCards } from '@/contexts/CardContext';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';
import type { Card, CardType } from '@/types/card';
import { formatExpiry, getExpiryStatus } from '@/types/card';

const FREE_CARD_LIMIT = 5;

const FILTERS: { key: CardType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All Passes', icon: 'wallet-outline' },
  { key: 'id', label: 'IDs & Passes', icon: 'id-card-outline' },
  { key: 'membership', label: 'Memberships', icon: 'business-outline' },
  { key: 'health', label: 'Health', icon: 'heart-outline' },
  { key: 'loyalty', label: 'Loyalty', icon: 'gift-outline' },
];

const CARD_TYPE_GRADIENTS: Record<string, [string, string]> = {
  id: ['#0F172A', '#1E293B'],
  membership: ['#1E3A8A', '#0F172A'],
  health: ['#065F46', '#0F172A'],
  loyalty: ['#78350F', '#1E293B'],
};

const SAMPLE_PHOTOS: Record<string, any> = {
  sample_anastasia: require('@/assets/images/sample_anastasia.jpg'),
  sample_frank: require('@/assets/images/sample_frank.jpg'),
};

export default function CardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards, isLoading, clearSampleCards } = useCards();
  const { isPro } = usePro();
  const [filter, setFilter] = useState<CardType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paywallVisible, setPaywallVisible] = useState(false);

  const userCards = cards.filter((c) => !c.isSample && !c.id.startsWith('sample-'));
  const hasSampleCards = cards.some((c) => c.isSample || c.id.startsWith('sample-'));
  const atLimit = !isPro && userCards.length >= FREE_CARD_LIMIT;
  const usedSlots = Math.min(userCards.length, FREE_CARD_LIMIT);

  const handleAddCard = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (atLimit) { setPaywallVisible(true); return; }
    router.push('/add-card?autoScan=true' as any);
  };

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? cards : cards.filter((c) => c.cardType === filter);
    if (!searchQuery.trim()) return pool;
    const q = searchQuery.toLowerCase().trim();
    return pool.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.nameOnCard && c.nameOnCard.toLowerCase().includes(q)) ||
        (c.idNumber && c.idNumber.toLowerCase().includes(q)),
    );
  }, [cards, filter, searchQuery]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>Digital Vault</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {filtered.length} active digital pass{filtered.length !== 1 ? 'es' : ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleAddCard}
          style={[styles.addHeaderBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
          <Text style={[styles.addHeaderBtnText, { color: colors.primaryForeground }]}>New Card</Text>
        </TouchableOpacity>
      </View>

      <ProPaywall visible={paywallVisible} onClose={() => setPaywallVisible(false)} />

      {/* Search Input Bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by pass title, member name, or ID..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Free-tier usage meter (hidden for Pro users) */}
      {!isPro && (
        <View style={[styles.meterWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.meterTop}>
            <Text style={[styles.meterLabel, { color: colors.mutedForeground }]}>
              Free Vault Plan · {usedSlots} / {FREE_CARD_LIMIT} Slots Used
            </Text>
            <TouchableOpacity onPress={() => setPaywallVisible(true)}>
              <Text style={[styles.meterUpgrade, { color: colors.primary }]}>Unlock Pro 👑</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.meterTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${(usedSlots / FREE_CARD_LIMIT) * 100}%` as any,
                  backgroundColor: atLimit ? colors.expired : colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* 1-Tap Clear Sample Demo Cards */}
      {hasSampleCards && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>
            Demo cards loaded (not counted against your 5 slots)
          </Text>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await clearSampleCards();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 }}
          >
            <Ionicons name="trash-outline" size={11} color={colors.primary} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
              Clear Demo
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Glassmorphism Segmented Filter Bar */}
      <View style={{ height: 44, marginVertical: 6 }}>
        <FlatList
          data={FILTERS}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = filter === item.key;
            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(item.key);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={item.icon as any}
                  size={14}
                  color={isActive ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: isActive ? colors.primaryForeground : colors.foreground,
                      fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Rich 3D Cards List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="card-outline" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {filter === 'all' ? 'No cards in your vault' : `No ${filter} passes`}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Tap <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>+ New Card</Text> to scan a physical card or join a digital pass studio!
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <LuxuryCardTile card={item} onPress={() => router.push(`/card/${item.id}`)} />
        )}
      />
    </View>
  );
}

/** Luxury Card Tile for All Cards Screen */
function LuxuryCardTile({ card, onPress }: { card: Card; onPress: () => void }) {
  const colors = useColors();
  const [bg1, bg2] = CARD_TYPE_GRADIENTS[card.cardType] || CARD_TYPE_GRADIENTS.id;
  const status = getExpiryStatus(card.expiryDate);
  const accent = card.accentColor || card.primaryColor || colors.primary;
  const photoSource = card.frontImageUri
    ? SAMPLE_PHOTOS[card.frontImageUri] || { uri: card.frontImageUri }
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={styles.tileOuter}
    >
      <LinearGradient
        colors={[card.primaryColor || bg1, card.secondaryColor || bg2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tileCard}
      >
        {/* Accent Side Ribbon */}
        <View style={[styles.tileAccentRibbon, { backgroundColor: accent }]} />

        {/* Card Content Row */}
        <View style={styles.tileMainContent}>
          <View style={styles.tileHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              {card.logoUri ? (
                <Image
                  source={{ uri: card.logoUri }}
                  style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}
                  contentFit="contain"
                />
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="card" size={12} color="#FFFFFF" />
                </View>
              )}
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.8 }} numberOfLines={1}>
                {(card.orgName || card.cardType).toUpperCase()}
              </Text>
            </View>

            {card.isPartnerIssued ? (
              <View style={styles.tileVerifiedBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#F59E0B" />
                <Text style={styles.tileVerifiedText}>VERIFIED</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.tileBodyRow}>
            {photoSource ? (
              <Image source={photoSource} style={styles.tileThumbPhoto} contentFit="cover" />
            ) : (
              <View style={[styles.tileThumbPlaceholder, { backgroundColor: accent + '33', borderColor: accent }]}>
                <Text style={styles.tileThumbInitials}>
                  {(card.title || 'NC').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle} numberOfLines={1}>{card.title}</Text>
              {card.nameOnCard ? (
                <Text style={styles.tileName} numberOfLines={1}>{card.nameOnCard}</Text>
              ) : null}
              {card.idNumber ? (
                <Text style={styles.tileIdNum} numberOfLines={1}>
                  {card.idNumber.length > 8 ? '•••• ' + card.idNumber.slice(-4) : card.idNumber}
                </Text>
              ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
          </View>

          <View style={styles.tileFooterRow}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {card.customFields && Object.keys(card.customFields).length > 0 ? (
                Object.entries(card.customFields).slice(0, 2).map(([k, v]) => (
                  <View key={k} style={styles.tilePill}>
                    <Text style={styles.tilePillText}>{k.toUpperCase()}: {v}</Text>
                  </View>
                ))
              ) : null}
            </View>

            {card.expiryDate ? (
              <Text style={[styles.tileExpiry, status === 'expired' && { color: '#FF6B6B' }, status === 'expiring' && { color: '#F59E0B' }]}>
                EXP: {formatExpiry(card.expiryDate)}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addHeaderBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', height: '100%' },
  meterWrap: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  meterUpgrade: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  meterTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3 },
  filterList: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },
  list: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },

  // Tile styles
  tileOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  tileCard: {
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 110,
  },
  tileAccentRibbon: {
    width: 6,
    alignSelf: 'stretch',
  },
  tileMainContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
    gap: 10,
  },
  tileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tileVerifiedText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#F59E0B' },
  tileBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileThumbPhoto: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  tileThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileThumbInitials: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  tileTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  tileName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  tileIdNum: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    letterSpacing: 1,
  },
  tileFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tilePill: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tilePillText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.75)',
  },
  tileExpiry: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.75)',
  },
});
