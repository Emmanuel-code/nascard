import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    image: require('@/assets/images/onboarding1.png'),
    title: 'All your cards,\none place',
    subtitle:
      'Digitize your student ID, health card, gym membership — any card you carry.',
  },
  {
    key: '2',
    image: require('@/assets/images/onboarding2.png'),
    title: 'Live verification,\nnot a screenshot',
    subtitle:
      'Generate a time-limited QR that guards scan. No plastic required.',
  },
  {
    key: '3',
    image: require('@/assets/images/onboarding3.png'),
    title: 'Private & offline\nby default',
    subtitle:
      'Cards stay on your device. Nothing uploaded unless you choose to back up.',
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding('', '');
    router.replace('/(tabs)');
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width, paddingTop: topPad + 24 }]}>
            <Image source={item.image} style={styles.illustration} contentFit="contain" />
            <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 24,
            paddingHorizontal: 24,
          },
        ]}
      >
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === currentIndex} color={colors.primary} />
          ))}
        </View>

        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
            {isLast ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity onPress={handleGetStarted} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Dot({ active, color }: { active: boolean; color: string }) {
  const width = useSharedValue(active ? 24 : 8);
  React.useEffect(() => {
    width.value = withTiming(active ? 24 : 8, { duration: 250 });
  }, [active, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  return (
    <Animated.View
      style={[
        style,
        { height: 8, borderRadius: 4, backgroundColor: active ? color : color + '44' },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustration: {
    width: width * 0.72,
    height: width * 0.9,
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  btn: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  skip: {
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
