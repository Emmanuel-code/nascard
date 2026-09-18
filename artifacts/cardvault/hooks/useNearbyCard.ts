import { useCallback, useState } from 'react';
import type { Card } from '@/types/card';

export interface NearbyCardSuggestion {
  card: Card;
  placeName: string;
  confidence: 'high' | 'medium';
}

export type LocationPermissionStatus = 'idle' | 'granted' | 'denied' | 'error';

/**
 * Proximity card recommendation hook.
 * Location detection is currently paused to prevent native permission crashes on mobile.
 */
export function useNearbyCard(_cards: Card[]): {
  suggestion: NearbyCardSuggestion | null;
  isLoading: boolean;
  permissionStatus: LocationPermissionStatus;
  refresh: () => void;
} {
  const [suggestion] = useState<NearbyCardSuggestion | null>(null);
  const [isLoading] = useState(false);
  const [permissionStatus] = useState<LocationPermissionStatus>('idle');

  const refresh = useCallback(() => {
    // Location tracking paused
  }, []);

  return { suggestion, isLoading, permissionStatus, refresh };
}

