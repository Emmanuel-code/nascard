import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ProfileType, UserProfile } from '@/types/card';

const PROFILE_KEY = '@nascard:profile';

const defaultProfile: UserProfile = {
  displayName: '',
  email: '',
  phone: '',
  activeProfile: 'personal',
  hasCompletedOnboarding: false,
  appLockEnabled: false,
  notificationsEnabled: false,
};

interface ProfileContextValue {
  profile: UserProfile;
  setActiveProfile: (p: ProfileType) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (displayName: string, email: string) => void;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextValue>({} as ProfileContextValue);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY)
      .then((raw) => {
        if (raw) setProfile(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (updated: UserProfile) => {
    setProfile(updated);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  }, []);

  const setActiveProfile = useCallback(
    (p: ProfileType) => persist({ ...profile, activeProfile: p }),
    [profile, persist],
  );

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => persist({ ...profile, ...updates }),
    [profile, persist],
  );

  const completeOnboarding = useCallback(
    (displayName: string, email: string) =>
      persist({ ...profile, displayName, email, hasCompletedOnboarding: true }),
    [profile, persist],
  );

  return (
    <ProfileContext.Provider
      value={{ profile, setActiveProfile, updateProfile, completeOnboarding, isLoading }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
