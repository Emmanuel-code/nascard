import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PRO_KEY = '@nascard:pro_status';
const PRO_CHECKED_AT_KEY = '@nascard:pro_checked_at';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface ProContextValue {
  isPro: boolean;
  isLoading: boolean;
  checkProStatus: (email: string) => Promise<boolean>;
  setProActive: () => Promise<void>;
  getCheckoutUrl: () => Promise<string>;
  clearPro: () => Promise<void>;
}

const ProContext = createContext<ProContextValue>({} as ProContextValue);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [status, checkedAt] = await Promise.all([
        AsyncStorage.getItem(PRO_KEY),
        AsyncStorage.getItem(PRO_CHECKED_AT_KEY),
      ]);
      const age = Date.now() - Number(checkedAt ?? 0);
      if (status === 'true' && age < CACHE_TTL_MS) {
        setIsPro(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const checkProStatus = useCallback(async (email: string): Promise<boolean> => {
    try {
      await AsyncStorage.multiSet([
        [PRO_KEY, 'true'],
        [PRO_CHECKED_AT_KEY, String(Date.now())],
      ]);
      setIsPro(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const setProActive = useCallback(async () => {
    await AsyncStorage.multiSet([
      [PRO_KEY, 'true'],
      [PRO_CHECKED_AT_KEY, String(Date.now())],
    ]);
    setIsPro(true);
  }, []);

  const getCheckoutUrl = useCallback(async (): Promise<string> => {
    const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
    try {
      const resp = await fetch(`${apiBase}/api/paystack/pro-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@nascard.app', amount: 29 }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.authorizationUrl) return data.authorizationUrl;
      }
    } catch {}
    return 'https://nascard-api.onrender.com';
  }, []);

  const clearPro = useCallback(async () => {
    await AsyncStorage.multiRemove([PRO_KEY, PRO_CHECKED_AT_KEY]);
    setIsPro(false);
  }, []);

  return (
    <ProContext.Provider value={{ isPro, isLoading, checkProStatus, setProActive, getCheckoutUrl, clearPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
