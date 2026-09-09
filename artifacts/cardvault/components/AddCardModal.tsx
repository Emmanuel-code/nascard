import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: 'scan' | 'org' | 'manual') => void;
}

export function AddCardModal({ visible, onClose, onSelectOption }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 24 : Math.max(insets.bottom, 20);

  const handleSelect = async (option: 'scan' | 'org' | 'manual') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    onSelectOption(option);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: bottomPad + 16 }]}>
              {/* Handle */}
              <View style={[styles.handle, { backgroundColor: colors.border }]} />

              {/* Title Header */}
              <View style={styles.header}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.headerIconBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>Add to nascard</Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    Choose how you want to add your card or pass
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              {/* Option 3: Photo & Manual Entry */}
                            <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => handleSelect('manual')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#065F46', '#10B981']}
                  style={styles.optionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                    Photo & Manual Entry
                  </Text>
                  <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>
                    Upload card photos, passport selfie, and custom details
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {/* Option 1: Scan Barcode */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => handleSelect('scan')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#1E3A8A', '#3B82F6']}
                  style={styles.optionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.optionTextWrap}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                      Scan Barcode / QR
                    </Text>
                    <View style={styles.fastTag}>
                      <Text style={styles.fastTagText}>INSTANT</Text>
                    </View>
                  </View>
                  <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>
                    Auto-fill card details using your camera scanner
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* Option 2: Join Org Pass */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => handleSelect('org')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#581C87', '#9333EA']}
                  style={styles.optionIconBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="business-outline" size={24} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.optionTextWrap}>
                  <View style={styles.optionTitleRow}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                      Organization Pass
                    </Text>
                    <View style={styles.verifiedTag}>
                      <Ionicons name="shield-checkmark" size={10} color="#F59E0B" />
                      <Text style={styles.verifiedTagText}>VERIFIED</Text>
                    </View>
                  </View>
                  <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>
                    Claim official digital passes for gyms, schools, & teams
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>



              {/* Cancel Button */}
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  optionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
    gap: 3,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  fastTag: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fastTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  optionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
