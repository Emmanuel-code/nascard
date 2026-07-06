import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  value: string;
  style?: object;
  textStyle?: object;
  blurOnBackground?: boolean;
}

export function PrivacyField({ value, style, textStyle, blurOnBackground = true }: Props) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Auto-blur when app goes to background
  useEffect(() => {
    if (!blurOnBackground) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        setRevealed(false);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [blurOnBackground]);

  if (!value) return null;

  return (
    <TouchableOpacity
      onLongPress={() => setRevealed(true)}
      onPressOut={() => setRevealed(false)}
      activeOpacity={1}
      style={[styles.row, style]}
      delayLongPress={200}
    >
      <Text
        style={[
          styles.text,
          { color: colors.foreground },
          textStyle,
          !revealed && styles.blurred,
        ]}
        selectable={revealed}
      >
        {value}
      </Text>
      <View style={[styles.badge, { backgroundColor: colors.muted }]}>
        <Ionicons
          name={revealed ? 'eye-outline' : 'eye-off-outline'}
          size={12}
          color={colors.mutedForeground}
        />
        <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
          {revealed ? 'Showing' : 'Hold to reveal'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  text: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  blurred: {
    // Blur effect via letter-spacing + opacity overlay
    opacity: 0.15,
    letterSpacing: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
});
