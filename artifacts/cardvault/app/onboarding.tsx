import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from '@/components/PinPad';
import { useProfile } from '@/contexts/ProfileContext';
import { hashPin } from '@/lib/pin';
import { useColors } from '@/hooks/useColors';

const { width, height } = Dimensions.get('window');

// ─── Feature Slides ───────────────────────────────────────────────────
const SLIDES = [
  {
    key: '1',
    image: require('@/assets/images/onboarding1.jpg'),
    title: 'All your cards,\none place',
    subtitle: 'Digitize your student ID, health card, gym pass — any card you carry.',
    gradient: ['#0B132B', '#080C16'] as [string, string],
  },
  {
    key: '2',
    image: require('@/assets/images/onboarding2.jpg'),
    title: 'Live verification,\nnot a screenshot',
    subtitle: 'Generate a time-limited QR code guards scan in real time. No plastic required.',
    gradient: ['#062E25', '#080C16'] as [string, string],
  },
  {
    key: '3',
    image: require('@/assets/images/onboarding3.jpg'),
    title: 'Private & offline\nby default',
    subtitle: 'Cards stay on your device. Nothing uploaded unless you choose to back up.',
    gradient: ['#280F4A', '#080C16'] as [string, string],
  },
];

type Step = 'slides' | 'name' | 'pin';

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding, updateProfile } = useProfile();

  const [step, setStep] = useState<Step>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [pinPhase, setPinPhase] = useState<'set' | 'confirm'>('set');
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 24);

  // ── Navigate slides ──────────────────────────────────────────────────
  const goNextSlide = async () => {
    await Haptics.selectionAsync();
    if (slideIndex < SLIDES.length - 1) {
      const next = slideIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setSlideIndex(next);
    } else {
      // Last slide → name step
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep('name');
    }
  };

  const handleSkipSlides = () => setStep('name');

  // ── Name step ────────────────────────────────────────────────────────
  const handleNameNext = async () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      setNameError('Please enter your first name so we can personalise your vault.');
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNameError('');
    setStep('pin');
  };

  // ── PIN step ─────────────────────────────────────────────────────────
  const handlePinEntry = async (entered: string) => {
    if (pinPhase === 'set') {
      setFirstPin(entered);
      setPinPhase('confirm');
      setPinError('');
    } else {
      if (entered === firstPin) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const pinHash = await hashPin(entered);
        await updateProfile({ pinHash, appLockEnabled: true });
        await completeOnboarding(name.trim(), '');
        router.replace('/(tabs)');
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinError('PINs do not match — try again.');
        setPinPhase('set');
        setFirstPin('');
      }
    }
  };

  const handleSkipPin = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await completeOnboarding(name.trim(), '');
    router.replace('/(tabs)');
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: Feature Slides
  // ─────────────────────────────────────────────────────────────────────
  if (step === 'slides') {
    const slide = SLIDES[slideIndex]!;
    return (
      <View style={[styles.root, { backgroundColor: '#0F172A' }]}>
        {/* Full-screen card area */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s) => (
            <LinearGradient
              key={s.key}
              colors={s.gradient}
              style={[styles.slide, { width, paddingTop: topPad + 40 }]}
            >
              {/* Photorealistic 3D Human Hero Image */}
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
                style={styles.imageContainer}
              >
                <Image
                  source={s.image}
                  style={styles.slideImage}
                  contentFit="cover"
                  transition={300}
                />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.slideCopy}>
                <Text style={styles.slideTitle}>{s.title}</Text>
                <Text style={styles.slideSub}>{s.subtitle}</Text>
              </Animated.View>
            </LinearGradient>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: bottomPad, backgroundColor: '#0F172A' }]}>
          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <Dot key={i} active={i === slideIndex} />
            ))}
          </View>

          <TouchableOpacity
            onPress={goNextSlide}
            activeOpacity={0.88}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {slideIndex === SLIDES.length - 1 ? 'Get Started →' : 'Continue →'}
            </Text>
          </TouchableOpacity>

          {slideIndex < SLIDES.length - 1 && (
            <TouchableOpacity onPress={handleSkipSlides} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: Name Step
  // ─────────────────────────────────────────────────────────────────────
  if (step === 'name') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.root, { backgroundColor: '#0F172A' }]}
      >
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.nameScreen, { paddingTop: topPad + 40, paddingBottom: bottomPad }]}
        >
          <View style={styles.nameIconWrap}>
            <Text style={{ fontSize: 56 }}>👋</Text>
          </View>

          <Text style={styles.nameTitle}>What should we call you?</Text>
          <Text style={styles.nameSub}>
            This personalises your vault experience — it's only stored on your device.
          </Text>

          <TextInput
            style={[
              styles.nameInput,
              { borderColor: nameError ? '#EF4444' : 'rgba(255,255,255,0.15)', color: '#fff' },
            ]}
            placeholder="Your first name"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={name}
            onChangeText={(t) => { setName(t); setNameError(''); }}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleNameNext}
            maxLength={30}
          />

          {nameError ? (
            <Text style={styles.errorText}>{nameError}</Text>
          ) : null}

          <TouchableOpacity
            onPress={handleNameNext}
            activeOpacity={0.88}
            style={[styles.primaryBtn, { marginTop: 20 }]}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER: PIN Step
  // ─────────────────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.root, styles.pinScreen, { paddingTop: topPad + 24, paddingBottom: bottomPad, backgroundColor: '#0F172A' }]}
    >
      <Text style={styles.slideEmoji}>🔐</Text>
      <Text style={styles.nameTitle}>
        {pinPhase === 'set' ? 'Set a 6-digit PIN' : 'Confirm your PIN'}
      </Text>
      <Text style={styles.nameSub}>
        {pinPhase === 'set'
          ? 'Lock your vault so only you can open it. You can always disable this later.'
          : `Re-enter the PIN you just chose to confirm it.`}
      </Text>

      <PinPad
        title={pinPhase === 'set' ? 'Enter 6-digit PIN' : 'Confirm PIN'}
        onComplete={handlePinEntry}
      />

      <TouchableOpacity onPress={handleSkipPin} style={[styles.skipBtn, { marginTop: 8 }]}>
        <Text style={styles.skipText}>Skip for now — I'll set this up later</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Animated dot ──────────────────────────────────────────────────────
function Dot({ active }: { active: boolean }) {
  const w = useSharedValue(active ? 24 : 8);
  React.useEffect(() => {
    w.value = withTiming(active ? 24 : 8, { duration: 250 });
  }, [active, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[style, { height: 8, borderRadius: 4, backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.3)' }]}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 24,
  },
  imageContainer: {
    width: Math.min(width - 56, 290),
    height: Math.min(width - 56, 290),
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideEmoji: { fontSize: 64 },
  slideCopy: { alignItems: 'center', gap: 10 },
  slideTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 34,
  },
  slideSub: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  skipBtn: { paddingVertical: 8 },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },

  // Name step
  nameScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  nameIconWrap: { marginBottom: 8 },
  nameTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
  },
  nameSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  nameInput: {
    width: '100%',
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    textAlign: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#F87171',
    textAlign: 'center',
  },

  // PIN step
  pinScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
});
