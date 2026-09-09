import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import type { Card, ProfileType } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';
import { uploadCloudBackup, loadCloudPassword } from '@/lib/cloudBackup';
import { supabase } from '@/lib/supabase';

const CARDS_KEY = '@nascard:cards_v2';
const CARDS_KEY_LEGACY = '@nascard:cards';
const DEBOUNCE_MS = 600; // batch rapid state mutations into a single write

interface CardContextValue {
  cards: Card[];
  isLoading: boolean;
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Card>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  getCard: (id: string) => Card | undefined;
  getCardsByProfile: (profileId: ProfileType) => Card[];
  getExpiringCards: (withinDays?: number) => Card[];
  searchCards: (query: string, profileId?: ProfileType) => Card[];
  importCards: (incoming: Card[], mode: 'merge' | 'replace') => Promise<void>;
  clearSampleCards: () => Promise<void>;
  togglePinCard: (id: string) => Promise<void>;
  revokeCardsByOrgId: (orgId: string) => Promise<void>;
}

const CardContext = createContext<CardContextValue>({} as CardContextValue);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const INITIAL_SAMPLE_CARDS: Card[] = [
  {
    id: 'sample-demo-id',
    title: 'Demo Citizen ID Card',
    orgName: 'Dem                                o National Authority',
    nameOnCard: 'Winifred Esinam',
    idNumber: 'DEMO-721948291-A',
    cardType: 'id',
    profileId: 'personal',
    primaryColor: '#0B132B',
    secondaryColor: '#1C2541',
    accentColor: '#F59E0B',
    expiryDate: '2030-12-31',
    frontImageUri: 'sample_anastasia',
    backImageUri: null,
    barcodeFormat: 'qr',
    barcodeValue: 'DEMO721948291A',
    notes: 'Demo National Identity Card · Vault Demonstration Record',
    isPartnerIssued: true,
    isSample: true,
    customFields: {
      'NATIONALITY': 'Ghanaian',
      'STATUS': 'VERIFIED CITIZEN',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-demo-student',
    title: 'Demo University Pass',
    orgName: 'Demo University Campus',
    nameOnCard: 'Anastasia Adam',
    idNumber: 'STU-2026-9041',
    cardType: 'membership',
    profileId: 'personal',
    primaryColor: '#0C2340',
    secondaryColor: '#1D3557',
    accentColor: '#38BDF8',
    expiryDate: '2028-08-31',
    frontImageUri: null, // Layout WITHOUT photo (uses IC Microchip + Crest)
    backImageUri: null,
    barcodeFormat: 'code128',
    barcodeValue: 'STU20269041',
    notes: 'Berekuso Campus · Academic & Library Access Demo',
    isPartnerIssued: true,
    isSample: true,
    customFields: {
      'FACULTY': 'Biomedical Science',
      'LEVEL': '300 / B.Sc',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-demo-gym',
    title: 'Demo VIP Fitness Pass',
    orgName: 'Demo Fitness Club',
    nameOnCard: 'Kojo Mensah',
    idNumber: 'VIP-8820-99',
    cardType: 'health',
    profileId: 'personal',
    primaryColor: '#064E3B',
    secondaryColor: '#022C22',
    accentColor: '#10B981',
    expiryDate: '2026-11-15',
    frontImageUri: null, // Layout WITHOUT photo (uses VIP Executive Membership layout)
    backImageUri: null,
    barcodeFormat: 'qr',
    barcodeValue: 'VIP882099',
    notes: 'Airport City Branch · All-Hours VIP Locker & Sauna Access',
    isPartnerIssued: true,
    isSample: true,
    customFields: {
      'TIER': 'Platinum Member',
      'LOCKER': 'LOCKER #402',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-demo-corp',
    title: 'Demo Security Pass',
    orgName: 'Demo Tech Solutions',
    nameOnCard: 'Frank Atadana',
    idNumber: 'CORP-5021-FK',
    cardType: 'membership',
    profileId: 'personal',
    primaryColor: '#280F4A',
    secondaryColor: '#0F172A',
    accentColor: '#C084FC',
    expiryDate: '2027-05-30',
    frontImageUri: 'sample_frank',
    backImageUri: null,
    barcodeFormat: 'code128',
    barcodeValue: 'CORP5021FK',
    notes: 'Headquarters Access · Engineering & Infrastructure Division',
    isPartnerIssued: true,
    isSample: true,
    customFields: {
      'ROLE': 'Cloud Architect',
      'SITE': 'Accra HQ Floor 4',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCards = useRef<Card[] | null>(null);

  // Schema-versioned load — migrate from legacy key if needed & refresh sample cards
  useEffect(() => {
    async function loadCards() {
      try {
        let raw = await AsyncStorage.getItem(CARDS_KEY);
        if (!raw) {
          // Migrate from old key if present
          const legacyRaw = await AsyncStorage.getItem(CARDS_KEY_LEGACY);
          if (legacyRaw) {
            raw = legacyRaw;
            await AsyncStorage.setItem(CARDS_KEY, legacyRaw);
            await AsyncStorage.removeItem(CARDS_KEY_LEGACY);
          }
        }

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Keep real user cards, replace old sample cards with new demo cards
            const userCreated = parsed.filter((c: Card) => !c.isSample && !c.id.startsWith('sample-'));
            const finalCards = [...userCreated, ...INITIAL_SAMPLE_CARDS];
            setCards(finalCards);
            await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(finalCards));
          } else {
            setCards(INITIAL_SAMPLE_CARDS);
            await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(INITIAL_SAMPLE_CARDS));
          }
        } else {
          setCards(INITIAL_SAMPLE_CARDS);
          await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(INITIAL_SAMPLE_CARDS));
        }
      } catch (err) {
        console.warn('[CardContext] Failed to load cards:', err);
        setCards(INITIAL_SAMPLE_CARDS);
      } finally {
        setIsLoading(false);
      }
    }
    loadCards();
  }, []);

  // Debounced persistence — prevents writing on every rapid keystroke / animation frame
  const persist = useCallback(async (updated: Card[]) => {
    setCards(updated);
    pendingCards.current = updated;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      if (pendingCards.current) {
        try {
          await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(pendingCards.current));
        } catch (err) {
          console.warn('[CardContext] Failed to persist cards:', err);
        }

        // ── Silent Cloud Sync (Pro users with cloud backup enabled) ──────────
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const password = await loadCloudPassword();
            if (password) {
              uploadCloudBackup(pendingCards.current, password).catch((e) =>
                console.warn('[CardContext] Background cloud sync failed (will retry next change):', e)
              );
            }
          }
        } catch {
          // Never throw here — local save is the source of truth
        }

        pendingCards.current = null;
      }
    }, DEBOUNCE_MS);
  }, []);

  const addCard = useCallback(
    async (data: any): Promise<Card> => {
      const now = new Date().toISOString();
      const cardId = data.id || generateId();
      const card: Card = {
        ...data,
        id: cardId,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now,
      };
      const updated = [...cards.filter((c) => c.id !== cardId), card];
      await persist(updated);
      return card;
    },
    [cards, persist],
  );

  const updateCard = useCallback(
    async (id: string, updates: Partial<Card>) => {
      const updated = cards.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c,
      );
      await persist(updated);
    },
    [cards, persist],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      await persist(cards.filter((c) => c.id !== id));
    },
    [cards, persist],
  );

  const getCard = useCallback((id: string) => cards.find((c) => c.id === id), [cards]);

  const getCardsByProfile = useCallback(
    (profileId: ProfileType) => cards.filter((c) => c.profileId === profileId),
    [cards],
  );

  const getExpiringCards = useCallback(
    (withinDays = 30) =>
      cards
        .filter((c) => {
          if (!c.expiryDate) return false;
          const days = getDaysUntilExpiry(c.expiryDate);
          return days <= withinDays;
        })
        .sort((a, b) => getDaysUntilExpiry(a.expiryDate) - getDaysUntilExpiry(b.expiryDate)),
    [cards],
  );

  const searchCards = useCallback(
    (query: string, profileId?: ProfileType) => {
      const q = query.toLowerCase().trim();
      let pool = profileId ? cards.filter((c) => c.profileId === profileId) : cards;
      if (!q) return pool;
      return pool.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.nameOnCard && c.nameOnCard.toLowerCase().includes(q)) ||
          (c.idNumber && c.idNumber.toLowerCase().includes(q)),
      );
    },
    [cards],
  );

  const importCards = useCallback(
    async (incoming: Card[], mode: 'merge' | 'replace') => {
      const now = new Date().toISOString();
      if (mode === 'replace') {
        const refreshed = incoming.map((c) => ({ ...c, updatedAt: now }));
        await persist(refreshed);
      } else {
        // merge: skip any card whose id already exists
        const existingIds = new Set(cards.map((c) => c.id));
        const toAdd = incoming
          .filter((c) => !existingIds.has(c.id))
          .map((c) => ({ ...c, updatedAt: now }));
        await persist([...cards, ...toAdd]);
      }
    },
    [cards, persist],
  );

  const togglePinCard = useCallback(
    async (id: string) => {
      const target = cards.find((c) => c.id === id);
      if (!target) return;
      const isPinned = !target.isPinned;
      const updated = cards.map((c) =>
        c.id === id ? { ...c, isPinned, updatedAt: new Date().toISOString() } : c,
      );
      // Sort pinned to front
      const sorted = [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      await persist(sorted);
    },
    [cards, persist],
  );

  const clearSampleCards = useCallback(async () => {
    const withoutSamples = cards.filter((c) => !c.isSample && !c.id.startsWith('sample-'));
    await persist(withoutSamples);
  }, [cards, persist]);

  const revokeCardsByOrgId = useCallback(
    async (orgId: string) => {
      const now = new Date().toISOString();
      const updated = cards.map((c) => {
        if (c.orgId === orgId) {
          return {
            ...c,
            status: 'revoked' as const,
            notes: (c.notes ? c.notes + '\n' : '') + '[CARD REVOKED / ORG CLOSED]',
            updatedAt: now,
          };
        }
        return c;
      });
      await persist(updated);
    },
    [cards, persist],
  );

  return (
    <CardContext.Provider
      value={{
        cards,
        isLoading,
        addCard,
        updateCard,
        deleteCard,
        getCard,
        getCardsByProfile,
        getExpiringCards,
        searchCards,
        importCards,
        clearSampleCards,
        togglePinCard,
        revokeCardsByOrgId,
      }}
    >
      {children}
    </CardContext.Provider>
  );
}

export function useCards() {
  return useContext(CardContext);
}
