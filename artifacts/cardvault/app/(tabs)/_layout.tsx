import { BlurView } from 'expo-blur';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  // Render SF symbols only on iOS native to avoid crashes on web/Android
  const TabIcon = ({
    iosName,
    fallback,
    color,
    size,
  }: {
    iosName: string;
    fallback: React.ReactNode;
    color: string;
    size: number;
  }) => {
    if (isIOS) {
      try {
        const { SymbolView } = require('expo-symbols');
        return <SymbolView name={iosName} tintColor={color} size={size} />;
      } catch {
        return <>{fallback}</>;
      }
    }
    return <>{fallback}</>;
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon
              iosName="house"
              fallback={<Feather name="home" size={size} color={color} />}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon
              iosName="creditcard"
              fallback={<Ionicons name="card-outline" size={size} color={color} />}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          href: null,
          title: 'Wallet',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: 'Alerts',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <TabIcon
              iosName="person"
              fallback={<Ionicons name="person-outline" size={size} color={color} />}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
