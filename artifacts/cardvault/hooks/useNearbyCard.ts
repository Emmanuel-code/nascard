import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Card } from '@/types/card';

// Keywords per card type that suggest proximity relevance
const PLACE_KEYWORDS: Record<string, string[]> = {
  health: ['hospital', 'clinic', 'pharmacy', 'health', 'medical', 'doctor', 'dentist', 'nhis', 'laboratory', 'lab'],
  loyalty: ['supermarket', 'mall', 'shop', 'store', 'market', 'retail', 'grocery', 'accra', 'shoprite', 'melcom', 'palace'],
  membership: ['gym', 'fitness', 'club', 'sport', 'pool', 'leisure', 'recreation', 'library', 'university', 'campus'],
  id: [],
};

const REVERSE_GEO_URL = (lat: number, lon: number) =>
  `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;

function placeMatchesCard(placeName: string, card: Card): boolean {
  const lower = placeName.toLowerCase();
  const titleLower = card.title.toLowerCase();

  // Direct title match
  for (const word of titleLower.split(/\s+/)) {
    if (word.length > 3 && lower.includes(word)) return true;
  }

  // Card-type keyword match
  const keywords = PLACE_KEYWORDS[card.cardType] ?? [];
  return keywords.some((kw) => lower.includes(kw));
}

export interface NearbyCardSuggestion {
  card: Card;
  placeName: string;
  confidence: 'high' | 'medium';
}

export function useNearbyCard(cards: Card[]): {
  suggestion: NearbyCardSuggestion | null;
  isLoading: boolean;
  refresh: () => void;
} {
  const [suggestion, setSuggestion] = useState<NearbyCardSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetch = useRef(0);
  const THROTTLE_MS = 5 * 60 * 1000; // refresh at most every 5 min

  const detect = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (cards.length === 0) return;
    const now = Date.now();
    if (now - lastFetch.current < THROTTLE_MS) return;

    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setIsLoading(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lastFetch.current = Date.now();

      const resp = await fetch(REVERSE_GEO_URL(loc.coords.latitude, loc.coords.longitude), {
        headers: { 'User-Agent': 'nascard/1.0' },
      });
      const data = await resp.json();
      const placeName: string =
        data.name ||
        data.display_name ||
        data.address?.road ||
        data.address?.suburb ||
        '';

      if (!placeName) { setIsLoading(false); return; }

      // Score each card — prefer loyalty/membership > health
      const priority: Card['cardType'][] = ['loyalty', 'membership', 'health', 'id'];
      let best: NearbyCardSuggestion | null = null;

      for (const type of priority) {
        const match = cards.find((c) => c.cardType === type && placeMatchesCard(placeName, c));
        if (match) {
          best = {
            card: match,
            placeName,
            confidence: type === 'id' ? 'medium' : 'high',
          };
          break;
        }
      }

      setSuggestion(best);
    } catch {
      setSuggestion(null);
    } finally {
      setIsLoading(false);
    }
  }, [cards]);

  useEffect(() => {
    detect();
  }, [detect]);

  return { suggestion, isLoading, refresh: detect };
}
