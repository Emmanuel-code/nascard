import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
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

interface StackedCardDeckProps {
  cards: Card[];
  onCardPress: (card: Card) => void;
}

export function StackedCardDeck({ cards, onCardPress }: StackedCardDeckProps) {
  const colors = useColors();
  const [activeIndex, setActiveIndex] = useState(0);

  if (cards.length === 0) return null;

  const safeActiveIndex = Math.min(Math.max(0, activeIndex), cards.length - 1);
  const activeCard = cards[safeActiveIndex] || cards[0]!;

  const activeIndexRef = useRef(safeActiveIndex);
  activeIndexRef.current = safeActiveIndex;

  const rollTo = async (index: number) => {
    const clamped = Math.min(Math.max(0, index), cards.length - 1);
    if (clamped !== activeIndexRef.current) {
      activeIndexRef.current = clamped;
      await Haptics.selectionAsync();
      setActiveIndex(clamped);
    }
  };

  const handlePrev = () => rollTo(activeIndexRef.current - 1);
  const handleNext = () => rollTo(activeIndexRef.current + 1);

  // Gesture responder for smooth card flipping
  const hasRolledInGestureRef = useRef(false);
  const ROLL_THRESHOLD = 24;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 || Math.abs(gestureState.dx) > 10,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 || Math.abs(gestureState.dx) > 14,
      onPanResponderGrant: () => {
        hasRolledInGestureRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!hasRolledInGestureRef.current) {
          if (gestureState.dy <= -ROLL_THRESHOLD || gestureState.dx <= -ROLL_THRESHOLD) {
            // Dragged Up / Left → Next card
            hasRolledInGestureRef.current = true;
            rollTo(activeIndexRef.current + 1);
          } else if (gestureState.dy >= ROLL_THRESHOLD || gestureState.dx >= ROLL_THRESHOLD) {
            // Dragged Down / Right → Prev card
            hasRolledInGestureRef.current = true;
            rollTo(activeIndexRef.current - 1);
          }
        }
      },
      onPanResponderRelease: () => {
        hasRolledInGestureRef.current = false;
      },
      onPanResponderTerminate: () => {
        hasRolledInGestureRef.current = false;
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* ── Luxury Deck Header Controls ── */}
      <View style={styles.deckHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.rollBadge, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '35' }]}>
            <Ionicons name="wallet-outline" size={15} color={colors.primary} />
          </View>

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.deckTitle, { color: colors.foreground }]}>
                Pass Vault
              </Text>
              <View style={[styles.countPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.countPillText, { color: colors.mutedForeground }]}>
                  {safeActiveIndex + 1} / {cards.length}
                </Text>
              </View>
            </View>
            <Text style={[styles.deckSub, { color: colors.mutedForeground }]}>
              Swipe up or down to cycle passes
            </Text>
          </View>
        </View>

        {cards.length > 1 && (
          <View style={styles.controlsRow}>
            {/* Prev Arrow */}
            <TouchableOpacity
              style={[
                styles.navArrowBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
                safeActiveIndex === 0 && { opacity: 0.3 },
              ]}
              onPress={handlePrev}
              disabled={safeActiveIndex === 0}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-up" size={16} color={colors.foreground} />
            </TouchableOpacity>

            {/* Next Arrow */}
            <TouchableOpacity
              style={[
                styles.navArrowBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
                safeActiveIndex === cards.length - 1 && { opacity: 0.3 },
              ]}
              onPress={handleNext}
              disabled={safeActiveIndex === cards.length - 1}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-down" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── LUXURY CASCADING DECK FRAME ── */}
      <View
        style={[styles.rollerFrame, { height: CARD_H + 48 }]}
        {...panResponder.panHandlers}
      >
        {cards.map((card, index) => {
          const distance = index - safeActiveIndex;
          const isActive = index === safeActiveIndex;

          // Virtualization: Skip cards further than 3 away
          if (Math.abs(distance) > 3) return null;

          return (
            <AnimatedRollerSlot
              key={card.id}
              card={card}
              distance={distance}
              isActive={isActive}
              onSelect={() => {
                if (isActive) {
                  onCardPress(card);
                } else {
                  rollTo(index);
                }
              }}
            />
          );
        })}
      </View>

      {/* ── Active Card Quick Detail Bar ── */}
      <TouchableOpacity
        style={[styles.activeInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onCardPress(activeCard)}
        activeOpacity={0.88}
        accessibilityLabel={`Card ${activeCard.title}, ${activeCard.nameOnCard || ''}. Double tap to open details.`}
        accessibilityRole="button"
      >
        <View style={styles.activeInfoRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.activeInfoTitle, { color: colors.foreground }]} numberOfLines={1}>
              {activeCard.title}
            </Text>
            <Text style={[styles.activeInfoSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {activeCard.nameOnCard || activeCard.cardType.toUpperCase()} · Tap to present pass & barcode
            </Text>
          </View>
          <View style={[styles.openBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.openBadgeText, { color: colors.primaryForeground }]}>Open</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.primaryForeground} />
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Pagination Indicator Bar ── */}
      {cards.length > 1 && (
        <View style={styles.dotsRow}>
          {cards.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => rollTo(i)}
              accessibilityLabel={`Select card ${i + 1} of ${cards.length}`}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[
                styles.dot,
                {
                  backgroundColor: i === safeActiveIndex ? colors.primary : colors.border,
                  width: i === safeActiveIndex ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const AnimatedRollerSlot = React.memo(function AnimatedRollerSlot({
  card,
  distance,
  isActive,
  onSelect,
}: {
  card: Card;
  distance: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  // Cascading Apple-Wallet Style Geometry (No rotateX distortion on iOS)
  let targetY = 0;
  let targetScale = 1;
  let zIndex = 50;

  if (isActive) {
    targetY = 0;
    targetScale = 1;
    zIndex = 50;
  } else if (distance > 0) {
    // Stepped cascading behind & below
    targetY = Math.min(distance * 22, 50);
    targetScale = Math.max(1 - distance * 0.045, 0.88);
    zIndex = 50 - distance;
  } else {
    // Stepped cascading behind & above
    targetY = Math.max(distance * 18, -42);
    targetScale = Math.max(1 - Math.abs(distance) * 0.045, 0.88);
    zIndex = 50 - Math.abs(distance);
  }

  const translateY = useSharedValue(targetY);
  const scale = useSharedValue(targetScale);

  React.useEffect(() => {
    translateY.value = withSpring(targetY, { damping: 16, stiffness: 140, mass: 0.8 });
    scale.value = withSpring(targetScale, { damping: 16, stiffness: 140, mass: 0.8 });
  }, [targetY, targetScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Ambient natural depth shading for background cards
  const depthShadeOpacity = isActive ? 0 : Math.min(Math.abs(distance) * 0.32, 0.6);

  return (
    <Animated.View
      style={[
        styles.cardSlot,
        {
          zIndex,
          position: 'absolute',
          top: 6,
        },
        animatedStyle,
      ]}
      pointerEvents={isActive ? 'auto' : 'box-none'}
    >
      <WalletCard3D card={card} onPress={onSelect} isStacked />
      {!isActive && depthShadeOpacity > 0 && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#000000',
              opacity: depthShadeOpacity,
              borderRadius: 18,
              pointerEvents: 'none',
            },
          ]}
        />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', marginVertical: 6 },
  deckHeader: {
    width: CARD_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rollBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  countPillText: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  deckSub: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 1 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollerFrame: {
    width: CARD_W,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible', // Never clip shadows or rounded corners
  },
  cardSlot: {
    width: CARD_W,
    alignItems: 'center',
  },
  activeInfoCard: {
    width: CARD_W,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 10,
  },
  activeInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeInfoTitle: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
  activeInfoSub: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 1 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  openBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  dot: { height: 4.5, borderRadius: 3 },
});

