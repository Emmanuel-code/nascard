import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardItem } from '@/components/CardItem';
import { useCards } from '@/contexts/CardContext';
import { useColors } from '@/hooks/useColors';
import type { CardType } from '@/types/card';

const FILTERS: { key: CardType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'id', label: 'ID' },
  { key: 'health', label: 'Health' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'membership', label: 'Membership' },
];

export default function CardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards, isLoading } = useCards();
  const [filter, setFilter] = useState<CardType | 'all'>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? cards : cards.filter((c) => c.cardType === filter)),
    [cards, filter],
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>All Cards</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filtered.length} card{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter chips */}
      <FlatList
        data={FILTERS}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(item.key);
            }}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === item.key ? colors.primary : colors.secondary,
                borderColor: filter === item.key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: filter === item.key ? colors.primaryForeground : colors.mutedForeground,
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Cards list */}
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
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter === 'all' ? 'No cards added yet' : `No ${filter} cards`}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <CardItem card={item} onPress={() => router.push(`/card/${item.id}`)} />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/add-card');
        }}
        activeOpacity={0.85}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  filterList: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  fab: {
    position: 'absolute',
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
