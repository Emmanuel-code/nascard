import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Card, ProfileType } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';

const CARDS_KEY = '@cardvault:cards';

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
}

const CardContext = createContext<CardContextValue>({} as CardContextValue);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function CardProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CARDS_KEY)
      .then((raw) => {
        if (raw) setCards(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (updated: Card[]) => {
    setCards(updated);
    await AsyncStorage.setItem(CARDS_KEY, JSON.stringify(updated));
  }, []);

  const addCard = useCallback(
    async (data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<Card> => {
      const now = new Date().toISOString();
      const card: Card = { ...data, id: generateId(), createdAt: now, updatedAt: now };
      const updated = [...cards, card];
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
          c.nameOnCard.toLowerCase().includes(q) ||
          c.idNumber.toLowerCase().includes(q),
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
      }}
    >
      {children}
    </CardContext.Provider>
  );
}

export function useCards() {
  return useContext(CardContext);
}
