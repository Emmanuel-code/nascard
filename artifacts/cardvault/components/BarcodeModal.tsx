import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeDisplay } from './BarcodeDisplay';
import type { BarcodeFormat } from './BarcodeDisplay';

const { width } = Dimensions.get('window');
const BARCODE_SIZE = Math.min(width - 80, 280);

const FORMAT_LABELS: Record<string, string> = {
  qr: 'QR Code',
  code128: 'Code 128',
  code39: 'Code 39',
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  pdf417: 'PDF-417',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  value: string;
  format?: BarcodeFormat;
  cardTitle: string;
}

export function BarcodeModal({ visible, onClose, value, format = 'qr', cardTitle }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });
  const opacity = slideAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  const formatLabel = FORMAT_LABELS[format?.toLowerCase()] ?? format?.toUpperCase() ?? 'Barcode';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) + 12 },
          { transform: [{ translateY }], opacity },
        ]}
      >
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{cardTitle}</Text>
            <Text style={styles.formatLabel}>{formatLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color="#666" />
          </TouchableOpacity>
        </View>

        {/* White barcode panel */}
        <View style={styles.barcodePanel}>
          <BarcodeDisplay
            value={value || ' '}
            format={format}
            size={BARCODE_SIZE}
            color="#111111"
            backgroundColor="#FFFFFF"
          />
        </View>

        {/* Value text */}
        {value ? (
          <Text style={styles.valueText} numberOfLines={2} selectable>
            {value}
          </Text>
        ) : null}

        {/* Brightness hint */}
        <View style={styles.hintRow}>
          <Ionicons name="sunny-outline" size={14} color="#999" />
          <Text style={styles.hintText}>
            {Platform.OS === 'web'
              ? 'Works best with a bright screen'
              : 'Turn up brightness for best scan results'}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    gap: 16,
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#111',
  },
  formatLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#888',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    // Card shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  valueText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#555',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#999',
  },
});
