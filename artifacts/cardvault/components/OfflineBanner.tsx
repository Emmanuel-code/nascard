import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsOffline(!navigator.onLine);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (isOffline) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: topPad + 6,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Ionicons name="cloud-offline" size={16} color="#FFFFFF" />
      <Text style={styles.bannerText}>Offline Mode — Encrypted Local Vault Active</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#DC2626',
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
