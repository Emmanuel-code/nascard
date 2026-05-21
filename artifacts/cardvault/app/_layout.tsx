import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '@/components/LockScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CardProvider, useCards } from '@/contexts/CardContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import {
  cancelAllNotifications,
  configureNotificationHandler,
  requestNotificationPermission,
  scheduleExpiryNotifications,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="add-card"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="card/[id]" />
      <Stack.Screen
        name="verify/[id]"
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="share/[token]" />
    </Stack>
  );
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useProfile();
  const { cards } = useCards();
  const [locked, setLocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Set up lock on mount and when AppState changes
  useEffect(() => {
    if (isLoading) return;
    if (profile.appLockEnabled && Platform.OS !== 'web') {
      setLocked(true);
    }
  }, [isLoading, profile.appLockEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground =
        appState.current === 'background' || appState.current === 'inactive';
      const isNowActive = nextState === 'active';
      if (wasBackground && isNowActive && profile.appLockEnabled && Platform.OS !== 'web') {
        setLocked(true);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [profile.appLockEnabled]);

  // Schedule / cancel notifications when cards or setting changes
  useEffect(() => {
    if (isLoading) return;
    if (profile.notificationsEnabled) {
      scheduleExpiryNotifications(cards);
    } else {
      cancelAllNotifications();
    }
  }, [cards, profile.notificationsEnabled, isLoading]);

  if (locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} />;
  }

  return <>{children}</>;
}

function AppCore() {
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  return (
    <AppLockGate>
      <RootLayoutNav />
    </AppLockGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const inner = (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ProfileProvider>
            <CardProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <AppCore />
              </GestureHandlerRootView>
            </CardProvider>
          </ProfileProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );

  if (Platform.OS !== 'web') {
    const { KeyboardProvider } = require('react-native-keyboard-controller');
    return <KeyboardProvider>{inner}</KeyboardProvider>;
  }

  return inner;
}
