import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
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
import { AppTutorialModal } from '@/components/AppTutorialModal';
import { CardQuickActionSheet } from '@/components/CardQuickActionSheet';
import { ProPaywall } from '@/components/ProPaywall';
import { StackedCardDeck } from '@/components/StackedCardDeck';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePro } from '@/contexts/ProContext';
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';
import { useNearbyCard } from '@/hooks/useNearbyCard';
import type { Card } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';

const FREE_CARD_LIMIT = 5;

const HOME_FILTERS = [
  { key: 'all', label: 'All', icon: 'wallet-outline' },
  { key: 'id', label: 'IDs', icon: 'id-card-outline' },
  { key: 'membership', label: 'Members', icon: 'shield-checkmark-outline' },
  { key: 'health', label: 'Health & Gym', icon: 'heart-outline' },
  { key: 'loyalty', label: 'Loyalty', icon: 'star-outline' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const { cards, isLoading } = useCards();
  const { isPro } = usePro();
  const { managedOrgs } = useOrg();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [quickActionCard, setQuickActionCard] = useState<Card | null>(null);
  const [maskedCardIds, setMaskedCardIds] = useState<Record<string, boolean>>({});
  const [fabOpen, setFabOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [securityModalVisible, setSecurityModalVisible] = useState(false);

  const myCards = cards.filter((c) => c.profileId === profile.activeProfile);
  const userCards = myCards.filter((c) => !c.isSample && !c.id.startsWith('sample-'));
  const atLimit = !isPro && userCards.length >= FREE_CARD_LIMIT;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const displayedCards = useMemo(() => {
    let result = myCards;
    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.cardType === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.nameOnCard?.toLowerCase().includes(q) ||
          c.idNumber?.toLowerCase().includes(q) ||
          c.orgName?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [myCards, selectedCategory, searchQuery]);

  const expiringCards = useMemo(
    () => cards.filter((c: any) => getDaysUntilExpiry(c.expiryDate) <= 14 && getDaysUntilExpiry(c.expiryDate) >= 0),
    [cards],
  );

  const { suggestion: nearbySuggestion, permissionStatus: locationStatus } = useNearbyCard(myCards);

  // Speed dial animation values
  const fabRotate = useSharedValue(0);
  const dial1Offset = useSharedValue(0);
  const dial2Offset = useSharedValue(0);
  const dial3Offset = useSharedValue(0);
  const dialOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotate.value * 45}deg` }],
  }));
  const dial1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dial1Offset.value }], opacity: dialOpacity.value }));
  const dial2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dial2Offset.value }], opacity: dialOpacity.value }));
  const dial3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dial3Offset.value }], opacity: dialOpacity.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const openDial = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFabOpen(true);
    fabRotate.value = withSpring(1, { damping: 14 });
    dialOpacity.value = withSpring(1);
    backdropOpacity.value = withSpring(0.55);
    dial1Offset.value = withSpring(-70, { damping: 14 });
    dial2Offset.value = withSpring(-140, { damping: 14 });
    dial3Offset.value = withSpring(-210, { damping: 14 });
  };

  const closeDial = () => {
    setFabOpen(false);
    fabRotate.value = withSpring(0, { damping: 14 });
    dialOpacity.value = withSpring(0);
    backdropOpacity.value = withSpring(0);
    dial1Offset.value = withSpring(0);
    dial2Offset.value = withSpring(0);
    dial3Offset.value = withSpring(0);
  };

  const onFabPress = () => { fabOpen ? closeDial() : openDial(); };

  const handleScan = async () => {
    closeDial();
    if (atLimit) { setPaywallVisible(true); return; }
    router.push('/add-card?autoScan=true' as any);
  };

  const handleManual = async () => {
    closeDial();
    if (atLimit) { setPaywallVisible(true); return; }
    router.push('/add-card' as any);
  };

  const handleInvite = () => {
    closeDial();
    router.push('/(tabs)/cards?showInvite=true' as any);
  };


  const togglePrivacyMask = (cardId: string) => {
    setMaskedCardIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
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
      <AppTutorialModal
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
      <CardQuickActionSheet
        card={quickActionCard}
        visible={!!quickActionCard}
        onClose={() => setQuickActionCard(null)}
        onTogglePrivacyMask={togglePrivacyMask}
        isPrivacyMasked={quickActionCard ? !!maskedCardIds[quickActionCard.id] : false}
      />

      {/* Offline Security Info Modal */}
      <Modal
        visible={securityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSecurityModalVisible(false)}
      >
        <View style={styles.secModalBackdrop}>
          <View style={[styles.secModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.secIconBox, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="shield-checkmark" size={32} color="#10B981" />
            </View>
            <Text style={[styles.secTitle, { color: colors.foreground }]}>100% Offline Vault</Text>
            <Text style={[styles.secBody, { color: colors.mutedForeground }]}>
              Your passes, identity cards, and barcodes live directly on your physical device. Zero tracking, no central servers, and instant access at any gate or turnstile without internet.
            </Text>
            <View style={styles.secFeatureList}>
              <View style={styles.secFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.secFeatureText, { color: colors.foreground }]}>On-Device Encrypted Local Storage</Text>
              </View>
              <View style={styles.secFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.secFeatureText, { color: colors.foreground }]}>Works in Airplane Mode</Text>
              </View>
              <View style={styles.secFeatureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.secFeatureText, { color: colors.foreground }]}>Zero Data Shared with Third Parties</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSecurityModalVisible(false)}
              style={[styles.secCloseBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.secCloseBtnText, { color: colors.primaryForeground }]}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 12,
            paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="card" size={28} color={colors.primary} />
            <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {profile.displayName || 'nascard'}
                </Text>
                {/* Clean Capacity Pill */}
                <TouchableOpacity
                  onPress={() => setPaywallVisible(true)}
                  style={[
                    styles.headerPill,
                    {
                      backgroundColor: isPro ? colors.primary + '20' : colors.card,
                      borderColor: isPro ? colors.primary + '40' : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPro ? 'sparkles' : 'cube-outline'}
                    size={11}
                    color={isPro ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.headerPillText,
                      { color: isPro ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {isPro ? 'PRO' : `${Math.min(userCards.length, FREE_CARD_LIMIT)}/${FREE_CARD_LIMIT}`}
                  </Text>
                </TouchableOpacity>

                {/* Offline Security Pill */}
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSecurityModalVisible(true);
                  }}
                  style={[
                    styles.headerPill,
                    { backgroundColor: '#10B98118', borderColor: '#10B98140' },
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                  {/* <Text style={[styles.headerPillText, { color: '#10B981' }]}>OFFLINE</Text> */}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {/* <TouchableOpacity
              onPress={() => router.push('/(tabs)/org' as any)}
              style={[
                styles.avatar,
                {
                  backgroundColor: managedOrgs.length > 0 ? colors.primary + '18' : colors.card,
                  borderColor: managedOrgs.length > 0 ? colors.primary + '60' : colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons
                name="business"
                size={18}
                color={managedOrgs.length > 0 ? colors.primary : colors.foreground}
              />
              {managedOrgs.length > 0 && (
                <View style={[styles.alertBadgeDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity> */}

            <TouchableOpacity
              onPress={() => setTutorialVisible(true)}
              style={[styles.avatar, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/notifications')}
              style={[styles.avatar, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.foreground} />
              {expiringCards.length > 0 && (
                <View style={styles.alertBadgeDot} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Prominent Pass Studio Quick Banner ── */}
        {/* <TouchableOpacity
          style={[
            styles.orgHomeBanner,
            {
              backgroundColor: managedOrgs.length > 0 ? colors.card : colors.card,
              borderColor: managedOrgs.length > 0 ? colors.primary + '44' : colors.border,
            },
          ]}
          onPress={() => router.push('/(tabs)/org' as any)}
          activeOpacity={0.85}
        >
          <View style={[styles.orgHomeIcon, { backgroundColor: colors.primary + '1C' }]}>
            <Ionicons name="business" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.orgHomeTitle, { color: colors.foreground }]}>
                {managedOrgs.length > 0 ? 'Pass Studio Active' : 'Pass Studio & Member Hub'}
              </Text>
              {managedOrgs.length > 0 && (
                <View style={[styles.orgHomeBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.orgHomeBadgeText, { color: colors.primaryForeground }]}>
                    {managedOrgs.length} ORG{managedOrgs.length > 1 ? 'S' : ''}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.orgHomeSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {managedOrgs.length > 0
                ? `${managedOrgs[0]?.name} · Manage roster, scanner & payouts`
                : 'Issue digital cards, scan QR at turnstiles & collect membership dues'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </TouchableOpacity> */}

        {/* Inline Quick Search (When user has cards) */}
        {!isLoading && myCards.length > 3 && (
          <View style={[styles.inlineSearchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your passes or IDs…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.inlineSearchInput, { color: colors.foreground }]}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Nearby card suggestion
        {nearbySuggestion ? (
          // <TouchableOpacity
          //   style={[styles.nearbyBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '44' }]}
          //   onPress={() => router.push(`/card/${nearbySuggestion.card.id}`)}
          //   activeOpacity={0.8}
          // >
          //   <Ionicons name="location" size={16} color={colors.primary} />
          //   <View style={{ flex: 1 }}>
          //     <Text style={[styles.nearbyTitle, { color: colors.primary }]}>Near you</Text>
          //     <Text style={[styles.nearbyCard, { color: colors.foreground }]} numberOfLines={1}>
          //       {nearbySuggestion.card.title}
          //     </Text>
          //   </View>
          //   <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          // </TouchableOpacity>
        ) : locationStatus === 'denied' ? (
          <TouchableOpacity
            style={[styles.nearbyBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={16} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.nearbyTitle, { color: colors.mutedForeground }]}>Location off</Text>
              <Text style={[styles.nearbyCard, { color: colors.mutedForeground }]}>
                Enable to see nearby card suggestions
              </Text>
            </View>
            <Ionicons name="settings-outline" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null} */}

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

        {/* Category Filter Pills (When user has cards) */}
        {!isLoading && myCards.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {HOME_FILTERS.map((f) => {
              const active = selectedCategory === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(f.key);
                  }}
                  style={[
                    styles.filterChip,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    !active && { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={f.icon as any}
                    size={14}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      active && { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
                      !active && { color: colors.mutedForeground },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Apple Wallet Interactive Stacked Deck ── */}
        {isLoading ? null : myCards.length === 0 ? (
          <View style={styles.empty}>
            {/* Ghost Card Shimmer */}
            <Animated.View
              style={[
                styles.ghostCard,
                {
                  borderColor: colors.primary + '40',
                  backgroundColor: colors.card,
                  shadowColor: colors.primary,
                },
              ]}
            >
              {/* Ghost Lines */}
              <View style={[styles.ghostLine, { width: '55%', backgroundColor: colors.primary + '25', marginBottom: 10 }]} />
              <View style={[styles.ghostLine, { width: '35%', backgroundColor: colors.primary + '15' }]} />
              <View style={[styles.ghostChip, { backgroundColor: colors.primary + '20' }]} />
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <View style={[styles.ghostLine, { width: 80, backgroundColor: colors.primary + '15', marginBottom: 6 }]} />
                  <View style={[styles.ghostLine, { width: 120, backgroundColor: colors.primary + '20', height: 6 }]} />
                </View>
                <View style={[styles.ghostQr, { backgroundColor: colors.primary + '15' }]} />
              </View>
            </Animated.View>

            <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your vault is empty</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Scan your first ID, gym pass, or loyalty card in 3 seconds
              </Text>
            </View>
            <TouchableOpacity
              onPress={onFabPress}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>📷  Scan First Card</Text>
            </TouchableOpacity>
          </View>
        ) : displayedCards.length === 0 ? (
          <View style={[styles.emptyFilterBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="filter-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyFilterTitle, { color: colors.foreground }]}>
              No {HOME_FILTERS.find(f => f.key === selectedCategory)?.label} Passes
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedCategory('all')}
              style={[styles.resetFilterBtn, { backgroundColor: colors.primary + '20' }]}
            >
              <Text style={[styles.resetFilterText, { color: colors.primary }]}>Show All Cards</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <StackedCardDeck
            cards={displayedCards}
            onCardPress={(card) => setQuickActionCard(card)}
          />
        )}

      </ScrollView>

      {/* Speed Dial Backdrop */}
      {fabOpen && (
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents="auto"
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDial} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Speed Dial Items */}
      <Animated.View style={[styles.dialItem, dial3Style, { bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84, right: 24 }]}>
        <Animated.View style={[styles.dialLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.dialLabelText, { color: colors.foreground }]}>Redeem Invite</Text>
        </Animated.View>
        <TouchableOpacity
          onPress={handleInvite}
          style={[styles.dialBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="ticket-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.dialItem, dial2Style, { bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84, right: 24 }]}>
        <Animated.View style={[styles.dialLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.dialLabelText, { color: colors.foreground }]}>Enter Manually</Text>
        </Animated.View>
        <TouchableOpacity
          onPress={handleManual}
          style={[styles.dialBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.dialItem, dial1Style, { bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84, right: 24 }]}>
        <Animated.View style={[styles.dialLabel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.dialLabelText, { color: colors.foreground }]}>Scan Card</Text>
        </Animated.View>
        <TouchableOpacity
          onPress={handleScan}
          style={[styles.dialBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="camera-outline" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </Animated.View>

      {/* Main FAB */}
      <Animated.View
        style={[
          styles.fab,
          {
            backgroundColor: fabOpen ? colors.card : colors.primary,
            borderColor: colors.primary,
            borderWidth: fabOpen ? 2 : 0,
            bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84,
          },
        ]}
      >
        <TouchableOpacity onPress={onFabPress} style={styles.fabInner}>
          <Animated.View style={fabIconStyle}>
            <Ionicons
              name="add"
              size={28}
              color={fabOpen ? colors.primary : colors.primaryForeground}
            />
          </Animated.View>
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
  orgHomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  orgHomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgHomeTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  orgHomeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  orgHomeBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  orgHomeSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
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

  // Inline Search
  inlineSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },

  // Offline Security Modal
  secModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  secModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  secIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  secBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  secFeatureList: {
    width: '100%',
    gap: 8,
    marginVertical: 4,
  },
  secFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secFeatureText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  secCloseBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  secCloseBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },

  // Category Filters
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyFilterBox: {
    marginHorizontal: 20,
    marginVertical: 40,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  emptyFilterTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  resetFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetFilterText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  ghostCard: {
    width: 300,
    height: 180,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  ghostLine: { height: 10, borderRadius: 6 },
  ghostChip: { width: 38, height: 26, borderRadius: 6, marginTop: 14 },
  ghostQr: { width: 44, height: 44, borderRadius: 8 },
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 9,
  },
  dialItem: {
    position: 'absolute',
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  dialBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  dialLabel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dialLabelText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  capacityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  capacityLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  capacityLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  capacityTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  capacityFill: { height: 5, borderRadius: 3 },
  capacityUpgrade: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  warningBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  inviteBannerText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  inviteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  inviteInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    height: 38,
  },
  inviteJoinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inviteJoinBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});
