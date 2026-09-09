/**
 * Cloud Backup Utility — nascard Pro
 *
 * Cards are AES-encrypted on the device using the user's password BEFORE
 * being sent to Supabase. The server only ever sees an opaque ciphertext string.
 */

import { supabase } from './supabase';
import { encryptCards, decryptCards } from './backup';
import type { Card } from '@/types/card';

const BACKUP_PASSWORD_KEY = '@nascard:cloud_backup_pw';

// Store the user's cloud backup password locally (never sent to server)
export async function saveCloudPassword(password: string): Promise<void> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.default.setItem(BACKUP_PASSWORD_KEY, password);
}

export async function loadCloudPassword(): Promise<string | null> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage');
  return AsyncStorage.default.getItem(BACKUP_PASSWORD_KEY);
}

export async function clearCloudPassword(): Promise<void> {
  const AsyncStorage = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.default.removeItem(BACKUP_PASSWORD_KEY);
}

/**
 * Uploads an encrypted snapshot of the user's cards to Supabase.
 * Cards are encrypted on-device before transmission.
 */
export async function uploadCloudBackup(cards: Card[], password: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to back up to the cloud.');

  // Filter out sample/demo cards — only back up the user's real cards
  const realCards = cards.filter((c) => !c.isSample);

  const encryptedData = await encryptCards(realCards, password);

  const { error } = await supabase.from('user_card_backups').upsert({
    user_id: user.id,
    encrypted_data: encryptedData,
    card_count: realCards.length,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Cloud backup failed: ${error.message}`);
}

/**
 * Downloads and decrypts the user's cloud card backup.
 */
export async function downloadCloudBackup(password: string): Promise<Card[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to restore from the cloud.');

  const { data, error } = await supabase
    .from('user_card_backups')
    .select('encrypted_data, card_count, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error || !data) throw new Error('No cloud backup found for this account.');

  const cards = await decryptCards(data.encrypted_data, password);
  return cards;
}

/**
 * Gets cloud backup metadata (no decryption needed).
 */
export async function getCloudBackupInfo(): Promise<{ cardCount: number; updatedAt: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_card_backups')
    .select('card_count, updated_at')
    .eq('user_id', user.id)
    .single();

  if (!data) return null;
  return { cardCount: data.card_count, updatedAt: data.updated_at };
}

/**
 * Deletes the user's cloud backup permanently.
 */
export async function deleteCloudBackup(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_card_backups').delete().eq('user_id', user.id);
}
