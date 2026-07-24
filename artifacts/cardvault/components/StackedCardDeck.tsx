import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Dimensions,
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
import { WalletCard3D, CARD_W, CARD_H } from '@/components/WalletCard3D';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';

const { width: SCREEN_W } = Dimensions.get('window');
const STACK_OFFSET = 60; // Offset between stacked cards when collapsed

interface StackedCardDeckProps {
  cards: Card[];
  onCardPress: (card: Card) => void;
}

export function StackedCardDeck({ cards, onCardPress }: StackedCardDeckProps) {
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  if (cards.length === 0) return null;

  const activeCard = cards[activeIndex] || cards[0]!;

  const handleSelectCard = (index: number) => {
    setActiveIndex(index);
    if (isExpanded) {
      setIsExpanded(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Deck Controls Bar */}
      <View style={styles.deckHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="wallet-outline" size={16} color={colors.primary} />
          <Text style={[styles.deckTitle, { color: colors.foreground }]}>
            {isExpanded ? 'Wallet Card Stack (Expanded)' : `Card ${activeIndex + 1} of ${cards.length}`}
          </Text>
        </View>

        {cards.length > 1 && (
          <TouchableOpacity
            style={[styles.expandToggleBtn, { backgroundColor: colors.primary + '18' }]}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isExpanded ? 'contract' : 'layers-outline'}
              size={15}
              color={colors.primary}
            />
            <Text style={[styles.expandToggleText, { color: colors.primary }]}>
              {isExpanded ? 'Collapse Deck' : 'Stack View'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── STACK DECK VIEW ── */}
      <View
        style={[
          styles.deckFrame,
          {
            height: isExpanded
              ? CARD_H + (cards.length - 1) * 75 + 20
              : CARD_H + Math.min(cards.length - 1, 3) * STACK_OFFSET + 20,
          },
        ]}
      >
        {cards.map((card, index) => {
          const isActive = index === activeIndex;
          const isAhead = index < activeIndex;
          const offsetPos = isActive
            ? 0
            : isExpanded
              ? index * 75
              : (index - activeIndex) * STACK_OFFSET;

          const zIdx = isActive ? 50 : 40 - Math.abs(index - activeIndex);

          return (
            <AnimatedCardSlot
              key={card.id}
              card={card}
              index={index}
              total={cards.length}
              isActive={isActive}
              isExpanded={isExpanded}
              offsetPos={offsetPos}
              zIndex={zIdx}
              onSelect={() => {
                if (isActive) {
                  onCardPress(card);
                } else {
                  handleSelectCard(index);
                }
              }}
            />
          );
        })}
      </View>

      {/* ── Active Card Info Strip ── */}
      <TouchableOpacity
        style={[styles.activeInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onCardPress(activeCard)}
        activeOpacity={0.85}
      >
        <View style={styles.activeInfoRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.activeInfoTitle, { color: colors.foreground }]} numberOfLines={1}>
              {activeCard.title}
            </Text>
            <Text style={[styles.activeInfoSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {activeCard.nameOnCard || activeCard.cardType.toUpperCase()} · Tap for barcode & details
            </Text>
          </View>
          <View style={[styles.openBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.openBadgeText, { color: colors.primaryForeground }]}>Open Pass</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primaryForeground} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Pagination Dots */}
      {cards.length > 1 && (
        <View style={styles.dotsRow}>
          {cards.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => handleSelectCard(i)}
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
      )}
    </View>
  );
}

function AnimatedCardSlot({
  card,
  isActive,
  isExpanded,
  offsetPos,
  zIndex,
  onSelect,
}: {
  card: Card;
  index: number;
  total: number;
  isActive: boolean;
  isExpanded: boolean;
  offsetPos: number;
  zIndex: number;
  onSelect: () => void;
}) {
  const translateY = useSharedValue(offsetPos);
  const scale = useSharedValue(isActive ? 1 : 0.95);

  React.useEffect(() => {
    translateY.value = withSpring(offsetPos, { tension: 70, friction: 12 });
    scale.value = withSpring(isActive ? 1 : isExpanded ? 0.98 : 0.94, { tension: 70, friction: 12 });
  }, [offsetPos, isActive, isExpanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.cardSlot,
        {
          zIndex,
          position: 'absolute',
          top: 0,
        },
        animatedStyle,
      ]}
    >
      <WalletCard3D card={card} onPress={onSelect} isStacked />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', marginVertical: 8 },
  deckHeader: {
    width: CARD_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deckTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  expandToggleText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  deckFrame: {
    width: CARD_W,
    alignItems: 'center',
    position: 'relative',
  },
  cardSlot: {
    width: CARD_W,
    alignItems: 'center',
  },
  activeInfoCard: {
    width: CARD_W,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
  },
  activeInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeInfoTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  activeInfoSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  openBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: { height: 6, borderRadius: 3 },
});
