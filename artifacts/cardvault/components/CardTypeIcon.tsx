import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CardType } from '@/types/card';

interface Props {
  cardType: CardType;
  size?: number;
}

const TYPE_CONFIG: Record<CardType, { icon: string; lib: 'ionicons' | 'mci'; color: string }> = {
  id: { icon: 'card-account-details', lib: 'mci', color: '#4F8EF7' },
  health: { icon: 'medical-bag', lib: 'mci', color: '#22C55E' },
  loyalty: { icon: 'star', lib: 'ionicons', color: '#F59E0B' },
  membership: { icon: 'shield-checkmark', lib: 'ionicons', color: '#9B6DFF' },
};

export function CardTypeIcon({ cardType, size = 20 }: Props) {
  const colors = useColors();
  const cfg = TYPE_CONFIG[cardType];
  const iconColor = cfg.color;

  return (
    <View style={[styles.container, { backgroundColor: iconColor + '22', borderRadius: size * 0.55 }]}>
      {cfg.lib === 'ionicons' ? (
        <Ionicons name={cfg.icon as any} size={size * 0.75} color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={cfg.icon as any} size={size * 0.75} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
});
