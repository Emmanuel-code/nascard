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
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Modal, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '@/components/LockScreen';
import { BACKGROUND_LOCK_GRACE_PERIOD_MS, isAppLockPaused } from '@/lib/appLock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CardProvider, useCards } from '@/contexts/CardContext';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { ProProvider } from '@/contexts/ProContext';
import { OrgProvider } from '@/contexts/OrgContext';
import { AlertProvider } from '@/components/StyledAlert';
import { AuthProvider } from '@/contexts/AuthContext';
import {
  cancelAllNotifications,
  configureNotificationHandler,
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
      <Stack.Screen name="org" />
    </Stack>
  );
}

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useProfile();
  const { cards } = useCards();
  const [locked, setLocked] = useState(false);
  const [hasUnlockedInitial, setHasUnlockedInitial] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  // Set up initial lock on cold launch only if AppLock is explicitly enabled
  useEffect(() => {
    if (isLoading) return;
    if (profile.appLockEnabled && Platform.OS !== 'web' && !hasUnlockedInitial) {
      setLocked(true);
    }
  }, [isLoading, profile.appLockEnabled, hasUnlockedInitial]);

  // Handle background / foreground transitions with grace period
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const isGoingToBackground = nextState === 'background';
      const isComingFromBackground =
        appState.current === 'background' && nextState === 'active';

      if (isGoingToBackground) {
        lastBackgroundTime.current = Date.now();
      }

      if (isComingFromBackground) {
        const elapsed = lastBackgroundTime.current
          ? Date.now() - lastBackgroundTime.current
          : 0;
        lastBackgroundTime.current = null;

        // Only lock if app lock is enabled, not paused by camera/picker, and was away longer than grace period
        const gracePeriodMs = (profile.lockTimeoutMinutes ?? 3) * 60 * 1000;
        if (
          profile.appLockEnabled &&
          Platform.OS !== 'web' &&
          !isAppLockPaused() &&
          elapsed >= gracePeriodMs
        ) {
          setLocked(true);
        }
      }

      appState.current = nextState;
    });

    return () => sub.remove();
  }, [profile.appLockEnabled, profile.lockTimeoutMinutes]);

  // Schedule / cancel notifications when cards or setting changes
  useEffect(() => {
    if (isLoading) return;
    if (profile.notificationsEnabled) {
      scheduleExpiryNotifications(cards).catch((e) =>
        console.warn('[AppLockGate] scheduleExpiryNotifications failed silently:', e),
      );
    } else {
      cancelAllNotifications().catch(() => {});
    }
  }, [cards, profile.notificationsEnabled, isLoading]);

  return (
    <>
      {children}
      {locked && (
        <Modal
          visible={locked}
          animationType="fade"
          transparent={false}
          statusBarTranslucent
          onRequestClose={() => {}}
        >
          <LockScreen
            onUnlocked={() => {
              setLocked(false);
              setHasUnlockedInitial(true);
            }}
          />
        </Modal>
      )}
    </>
  );
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

  // Splash stays visible until fonts are ready — profile loading is handled inside
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  let content = (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <AuthProvider>
          <CardProvider>
            <ProProvider>
              <OrgProvider>
                <AlertProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <OfflineBanner />
                    <AppCore />
                  </GestureHandlerRootView>
                </AlertProvider>
              </OrgProvider>
            </ProProvider>
          </CardProvider>
        </AuthProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );

  if (Platform.OS !== 'web') {
    try {
      const { KeyboardProvider } = require('react-native-keyboard-controller');
      if (KeyboardProvider) {
        content = <KeyboardProvider>{content}</KeyboardProvider>;
      }
    } catch (e) {
      console.warn('[RootLayout] KeyboardProvider unavailable, continuing with standard layout:', e);
    }
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {content}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
