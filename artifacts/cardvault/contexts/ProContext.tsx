import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PRO_KEY = '@nascard:pro_status';
const PRO_CHECKED_AT_KEY = '@nascard:pro_checked_at';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

interface ProContextValue {
  isPro: boolean;
  isLoading: boolean;
  checkProStatus: (email: string) => Promise<boolean>;
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
      const baseUrl = typeof window !== 'undefined' ? '' : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'localhost'}`;
      const resp = await fetch(`${baseUrl}/api/whop/check-access?email=${encodeURIComponent(email)}`);
      const data = await resp.json();
      const hasPro = data.hasPro === true;
      await AsyncStorage.multiSet([
        [PRO_KEY, String(hasPro)],
        [PRO_CHECKED_AT_KEY, String(Date.now())],
      ]);
      setIsPro(hasPro);
      return hasPro;
    } catch {
      return false;
    }
  }, []);

  const getCheckoutUrl = useCallback(async (): Promise<string> => {
    const baseUrl = typeof window !== 'undefined' ? '' : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? 'localhost'}`;
    const resp = await fetch(`${baseUrl}/api/whop/checkout`, { method: 'POST' });
    const data = await resp.json();
    return data.purchaseUrl as string;
  }, []);

  const clearPro = useCallback(async () => {
    await AsyncStorage.multiRemove([PRO_KEY, PRO_CHECKED_AT_KEY]);
    setIsPro(false);
  }, []);

  return (
    <ProContext.Provider value={{ isPro, isLoading, checkProStatus, getCheckoutUrl, clearPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
