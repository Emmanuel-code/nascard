import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WalletCard3D, CARD_W, CARD_H } from '@/components/WalletCard3D';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';

const { width: SCREEN_W } = Dimensions.get('window');
const SNAP = CARD_W + 24;

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards } = useCards();
  const { profile } = useProfile();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const myCards = cards.filter((c) => c.profileId === profile.activeProfile);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>Wallet</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {myCards.length} card{myCards.length !== 1 ? 's' : ''} · hold any card to flip
          </Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/add-card');
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {myCards.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="wallet-outline" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No cards yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Add a card to see it in 3D wallet view
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/add-card')}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Add first card</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 3D card carousel */}
          <FlatList
            ref={listRef}
            data={myCards}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled={false}
            snapToInterval={SNAP}
            snapToAlignment="center"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.carousel,
              { paddingHorizontal: (SCREEN_W - CARD_W) / 2 },
            ]}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
              setActiveIndex(Math.max(0, Math.min(idx, myCards.length - 1)));
            }}
            renderItem={({ item, index }) => (
              <View style={[styles.cardSlot, { marginRight: index < myCards.length - 1 ? 24 : 0 }]}>
                <WalletCard3D
                  card={item}
                  onPress={() => router.push(`/card/${item.id}`)}
                  index={index}
                  total={myCards.length}
                />
              </View>
            )}
          />

          {/* Pagination dots */}
          <View style={styles.dots}>
            {myCards.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  listRef.current?.scrollToIndex({ index: i, animated: true });
                  setActiveIndex(i);
                }}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === activeIndex ? colors.primary : colors.border,
                    width: i === activeIndex ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>

          {/* Active card info panel */}
          {myCards[activeIndex] && (
            <CardInfoPanel card={myCards[activeIndex]!} onPress={() => router.push(`/card/${myCards[activeIndex]!.id}`)} />
          )}
        </>
      )}
    </View>
  );
}

function CardInfoPanel({ card, onPress }: { card: Card; onPress: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.infoPanel,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          marginBottom: Platform.OS === 'web' ? 34 : insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.infoPanelRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoPanelTitle, { color: colors.foreground }]} numberOfLines={1}>
            {card.title}
          </Text>
          {card.nameOnCard ? (
            <Text style={[styles.infoPanelSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {card.nameOnCard}
            </Text>
          ) : null}
        </View>
        <View style={[styles.detailBtn, { backgroundColor: colors.primary + '18' }]}>
          <Text style={[styles.detailBtnText, { color: colors.primary }]}>Open</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carousel: { paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  cardSlot: { height: CARD_H },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 16,
  },
  dot: { height: 6, borderRadius: 3 },
  infoPanel: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  infoPanelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoPanelTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  infoPanelSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  detailBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  emptyBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
