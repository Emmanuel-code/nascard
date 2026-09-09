import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    gradient: ['#0F2460', '#1E3A8A', '#3B82F6'] as [string, string, string],
    accentGradient: ['#60A5FA', '#93C5FD'] as [string, string],
    badgeColor: '#3B82F6',
    badge: 'AI SCANNER',
    title: 'Snap & Fill in Seconds',
    subtitle: 'Point your camera at any physical card. AI reads the title, name, ID number, and expiry date — instantly auto-filling your digital wallet.',
    tip: '💡 Hold card steady inside the yellow frame for best results',
    icons: [
      { name: 'camera', size: 52, x: 0, y: 0, opacity: 1, color: '#FFFFFF' },
      { name: 'sparkles', size: 22, x: 60, y: -30, opacity: 0.9, color: '#93C5FD' },
      { name: 'text', size: 18, x: -55, y: -25, opacity: 0.7, color: '#BFDBFE' },
    ],
    decorCircles: [
      { size: 140, x: -60, y: -40, opacity: 0.08 },
      { size: 80, x: 80, y: 30, opacity: 0.12 },
    ],
  },
  {
    gradient: ['#3B0764', '#6D28D9', '#8B5CF6'] as [string, string, string],
    accentGradient: ['#C4B5FD', '#DDD6FE'] as [string, string],
    badgeColor: '#8B5CF6',
    badge: '3D ROLLER DECK',
    title: 'Roll Your Card Wheel',
    subtitle: 'Drag up or down through your card deck like a physical 3D rolodex. Each card springs into view with depth and shadow.',
    tip: '💡 Swipe up or down to spin the deck, tap to open a card',
    icons: [
      { name: 'layers', size: 48, x: 0, y: 5, opacity: 1, color: '#FFFFFF' },
      { name: 'swap-vertical', size: 24, x: 58, y: -20, opacity: 0.85, color: '#C4B5FD' },
      { name: 'card', size: 20, x: -60, y: 20, opacity: 0.7, color: '#DDD6FE' },
    ],
    decorCircles: [
      { size: 120, x: 70, y: -50, opacity: 0.1 },
      { size: 90, x: -50, y: 35, opacity: 0.08 },
    ],
  },
  {
    gradient: ['#064E3B', '#065F46', '#10B981'] as [string, string, string],
    accentGradient: ['#6EE7B7', '#A7F3D0'] as [string, string],
    badgeColor: '#10B981',
    badge: 'VERIFIED PASSES',
    title: 'Claim Official Digital Passes',
    subtitle: 'Join gyms, schools, companies, and clubs. Receive verified digital passes with live 60-second QR tokens for gate check-ins.',
    tip: '💡 Tap "Join Pass" or scan a venue QR poster to enroll instantly',
    icons: [
      { name: 'business', size: 46, x: 0, y: 5, opacity: 1, color: '#FFFFFF' },
      { name: 'qr-code', size: 26, x: 60, y: -18, opacity: 0.85, color: '#6EE7B7' },
      { name: 'shield-checkmark', size: 20, x: -58, y: 20, opacity: 0.75, color: '#A7F3D0' },
    ],
    decorCircles: [
      { size: 130, x: -70, y: -30, opacity: 0.08 },
      { size: 70, x: 75, y: 40, opacity: 0.12 },
    ],
  },
  {
    gradient: ['#431407', '#92400E', '#F59E0B'] as [string, string, string],
    accentGradient: ['#FCD34D', '#FDE68A'] as [string, string],
    badgeColor: '#F59E0B',
    badge: '100% PRIVATE',
    title: 'Encrypted Local Vault',
    subtitle: 'Your card photos and personal data are AES-256 encrypted on your device. Lock the app with PIN or biometrics. Works offline anywhere.',
    tip: '💡 Set a PIN lock in Profile → Security Settings for full protection',
    icons: [
      { name: 'lock-closed', size: 48, x: 0, y: 2, opacity: 1, color: '#FFFFFF' },
      { name: 'shield', size: 24, x: 58, y: -22, opacity: 0.85, color: '#FCD34D' },
      { name: 'finger-print', size: 20, x: -58, y: 22, opacity: 0.75, color: '#FDE68A' },
    ],
    decorCircles: [
      { size: 110, x: 65, y: -45, opacity: 0.1 },
      { size: 85, x: -55, y: 30, opacity: 0.07 },
    ],
  },
];

export function AppTutorialModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 24 : Math.max(insets.bottom, 20);

  const slide = SLIDES[currentSlide]!;

  const animateTransition = (nextIndex: number, direction: 1 | -1) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -direction * 30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setCurrentSlide(nextIndex);
      translateX.setValue(direction * 30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentSlide < SLIDES.length - 1) {
      animateTransition(currentSlide + 1, 1);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  };

  const handlePrev = async () => {
    if (currentSlide > 0) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateTransition(currentSlide - 1, -1);
    }
  };

  // Swipe gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 60,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) {
          setCurrentSlide((prev) => {
            const next = Math.min(prev + 1, SLIDES.length - 1);
            if (next !== prev) animateTransition(next, 1);
            return prev;
          });
        } else if (g.dx > 40) {
          setCurrentSlide((prev) => {
            const next = Math.max(prev - 1, 0);
            if (next !== prev) animateTransition(next, -1);
            return prev;
          });
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.appName}>
              <Ionicons name="sparkles" size={15} color={slide.badgeColor} />
              <Text style={[styles.appNameText, { color: colors.foreground }]}>nascard</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Panel */}
          <Animated.View style={[styles.heroWrap, { opacity: fadeAnim, transform: [{ translateX }] }]}>
            <LinearGradient
              colors={slide.gradient}
              style={styles.heroBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Decorative circles */}
              {slide.decorCircles.map((c, i) => (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: c.size,
                    height: c.size,
                    borderRadius: c.size / 2,
                    backgroundColor: '#FFFFFF',
                    opacity: c.opacity,
                    left: '50%',
                    top: '50%',
                    marginLeft: c.x - c.size / 2,
                    marginTop: c.y - c.size / 2,
                  }}
                />
              ))}

              {/* Card mockup frame */}
              <View style={styles.cardMockup}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                  style={styles.cardMockupInner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Mini card header */}
                  <View style={styles.cardMockupRow}>
                    <View style={[styles.cardDot, { backgroundColor: slide.accentGradient[0] }]} />
                    <View style={[styles.cardLine, { width: 60, backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                  </View>
                  <View style={[styles.cardLine, { width: 90, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                  <View style={[styles.cardLine, { width: 70, marginTop: 5, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                </LinearGradient>
              </View>

              {/* Main icons cluster */}
              <View style={styles.iconCluster}>
                {slide.icons.map((ic, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      marginLeft: ic.x - ic.size / 2,
                      marginTop: ic.y - ic.size / 2,
                      opacity: ic.opacity,
                    }}
                  >
                    {i === 0 ? (
                      <View style={styles.mainIconBg}>
                        <Ionicons name={ic.name as any} size={ic.size} color={ic.color} />
                      </View>
                    ) : (
                      <View style={styles.subIconBg}>
                        <Ionicons name={ic.name as any} size={ic.size} color={ic.color} />
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Badge */}
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{slide.badge}</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  if (idx !== currentSlide) animateTransition(idx, idx > currentSlide ? 1 : -1);
                }}
                style={[
                  styles.dot,
                  {
                    backgroundColor: idx === currentSlide ? slide.badgeColor : colors.border,
                    width: idx === currentSlide ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Text content */}
          <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateX }] }]}>
            <Text style={[styles.slideTitle, { color: colors.foreground }]}>{slide.title}</Text>
            <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{slide.subtitle}</Text>

            <View style={[styles.tipBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.tipText, { color: colors.foreground }]}>{slide.tip}</Text>
            </View>
          </Animated.View>

          {/* Footer buttons */}
          <View style={styles.footer}>
            {currentSlide > 0 ? (
              <TouchableOpacity
                style={[styles.backBtn, { borderColor: colors.border }]}
                onPress={handlePrev}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={18} color={colors.foreground} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 48 }} />
            )}

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: slide.badgeColor }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>
                {currentSlide === SLIDES.length - 1 ? 'Get Started 🎉' : 'Next'}
              </Text>
              <Ionicons
                name={currentSlide === SLIDES.length - 1 ? 'checkmark-circle' : 'arrow-forward'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appNameText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  heroWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  heroBg: {
    height: 220,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardMockup: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  cardMockupInner: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardMockupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardLine: {
    height: 5,
    borderRadius: 3,
  },
  iconCluster: {
    width: 180,
    height: 180,
    position: 'relative',
  },
  mainIconBg: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  subIconBg: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  textBlock: {
    gap: 10,
  },
  slideTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tipBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 2,
  },
  tipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  nextBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
