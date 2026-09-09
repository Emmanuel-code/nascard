import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PRO_KEY = '@nascard:pro_status';
const PRO_CHECKED_AT_KEY = '@nascard:pro_checked_at';
const PRO_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';

interface ProContextValue {
  isPro: boolean;
  isLoading: boolean;
  /** Called after a successful Paystack payment to activate Pro. */
  setProActive: (email?: string) => Promise<void>;
  /** Re-validates pro status against the server safely. */
  checkProStatus: (email?: string, reference?: string) => Promise<boolean>;
  clearPro: () => Promise<void>;
}

const ProContext = createContext<ProContextValue>({} as ProContextValue);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load cached pro status on mount
  useEffect(() => {
    const loadCachedStatus = async () => {
      try {
        const [status, checkedAt] = await Promise.all([
          AsyncStorage.getItem(PRO_KEY),
          AsyncStorage.getItem(PRO_CHECKED_AT_KEY),
        ]);

        if (status === 'true') {
          setIsPro(true);
          const checkedAtMs = checkedAt ? Number(checkedAt) : 0;
          if (Date.now() - checkedAtMs > PRO_CHECK_TTL_MS) {
            checkProStatus().catch(() => {});
          }
        }
      } catch (e) {
        console.error('[ProContext] Failed to load cached pro status:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Server-side pro status check via Paystack subscription API. */
  const checkProStatus = useCallback(async (email?: string, reference?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/paystack/verify-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reference }),
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (res.ok && data?.valid) {
        await AsyncStorage.multiSet([
          [PRO_KEY, 'true'],
          [PRO_CHECKED_AT_KEY, String(Date.now())],
        ]);
        setIsPro(true);
        return true;
      }

      // ONLY clear Pro if the server explicitly responded 200 OK with valid === false
      if (res.ok && data && data.valid === false) {
        await AsyncStorage.multiRemove([PRO_KEY, PRO_CHECKED_AT_KEY]);
        setIsPro(false);
        return false;
      }
    } catch (err) {
      console.warn('[ProContext] Pro check network error (preserving local status):', err);
    }

    // On network/server errors, preserve whatever is in AsyncStorage / state
    const cached = await AsyncStorage.getItem(PRO_KEY);
    return cached === 'true';
  }, []);

  /** Called client-side immediately after Paystack confirms payment. */
  const setProActive = useCallback(async (_email?: string) => {
    console.log('🌟 [ProContext]: Activating Pro status in AsyncStorage & State...');
    await AsyncStorage.multiSet([
      [PRO_KEY, 'true'],
      [PRO_CHECKED_AT_KEY, String(Date.now())],
    ]);
    setIsPro(true);
  }, []);

  const clearPro = useCallback(async () => {
    await AsyncStorage.multiRemove([PRO_KEY, PRO_CHECKED_AT_KEY]);
    setIsPro(false);
  }, []);

  return (
    <ProContext.Provider value={{ isPro, isLoading, checkProStatus, setProActive, clearPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
