import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
const PIN_LENGTH = 6;

interface Props {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  error?: string | null;
}

export function PinPad({ title, subtitle, onComplete, onCancel, error }: Props) {
  const colors = useColors();
  const [digits, setDigits] = useState<string[]>([]);

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      onComplete(digits.join(''));
    }
  }, [digits, onComplete]);

  const press = async (key: string) => {
    if (key === '') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
    } else if (digits.length < PIN_LENGTH) {
      setDigits((d) => [...d, key]);
    }
  };

  // reset on error
  useEffect(() => {
    if (error) setDigits([]);
  }, [error]);

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}

      {/* Dots */}
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < digits.length ? colors.primary : 'transparent',
                borderColor: i < digits.length ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.expired }]}>{error}</Text>
      ) : null}

      {/* Keypad */}
      <View style={styles.grid}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => press(key)}
            disabled={key === ''}
            style={[
              styles.key,
              key === '' && styles.keyEmpty,
              key === '⌫' && styles.keyBack,
              { backgroundColor: key === '' ? 'transparent' : colors.card, borderColor: colors.border },
            ]}
            activeOpacity={key === '' ? 1 : 0.6}
          >
            {key === '⌫' ? (
              <Ionicons name="backspace-outline" size={22} color={colors.foreground} />
            ) : (
              <Text style={[styles.keyText, { color: colors.foreground }]}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {onCancel ? (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', width: '100%' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 8, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 270,
    marginTop: 24,
    gap: 10,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { borderWidth: 0 },
  keyBack: { borderWidth: 0, backgroundColor: 'transparent' },
  keyText: { fontSize: 24, fontFamily: 'Inter_400Regular' },
  cancelBtn: { marginTop: 24, paddingVertical: 8, paddingHorizontal: 20 },
  cancelText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
});
