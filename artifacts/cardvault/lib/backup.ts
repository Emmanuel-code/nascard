import { Platform } from 'react-native';
import type { Card } from '@/types/card';

const BACKUP_VERSION = 1;
const FILE_EXT = 'nascard';

export interface BackupFile {
  version: number;
  app: string;
  createdAt: string;
  cardCount: number;
  data: string; // AES-encrypted JSON
}

async function getCryptoJS() {
  const CJS = await import('crypto-js');
  return CJS.default ?? CJS;
}

export async function encryptCards(cards: Card[], password: string): Promise<string> {
  const CJS = await getCryptoJS();
  const strippedCards = cards.map((c) => ({
    ...c,
    frontImageUri: null,
    backImageUri: null,
  }));
  const json = JSON.stringify(strippedCards);
  return CJS.AES.encrypt(json, password).toString();
}

export async function decryptCards(ciphertext: string, password: string): Promise<Card[]> {
  const CJS = await getCryptoJS();
  const bytes = CJS.AES.decrypt(ciphertext, password);
  const json = bytes.toString(CJS.enc.Utf8);
  if (!json) throw new Error('Incorrect password or corrupted backup.');
  return JSON.parse(json) as Card[];
}

export async function createBackupFile(cards: Card[], password: string): Promise<BackupFile> {
  const encrypted = await encryptCards(cards, password);
  return {
    version: BACKUP_VERSION,
    app: 'nascard',
    createdAt: new Date().toISOString(),
    cardCount: cards.length,
    data: encrypted,
  };
}

export async function exportBackup(cards: Card[], password: string): Promise<void> {
  const backup = await createBackupFile(cards, password);
  const json = JSON.stringify(backup, null, 2);
  const filename = `nascard-backup-${new Date().toISOString().slice(0, 10)}.${FILE_EXT}`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FS = await import('expo-file-system');
  const path = `${FS.cacheDirectory}${filename}`;
  await FS.writeAsStringAsync(path, json, { encoding: FS.EncodingType.UTF8 });

  const Sharing = await import('expo-sharing');
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Save nascard Backup',
    UTI: 'public.json',
  });
}

export async function importBackupFile(): Promise<BackupFile> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.nascard,.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { reject(new Error('No file selected.')); return; }
        const text = await file.text();
        try { resolve(JSON.parse(text) as BackupFile); }
        catch { reject(new Error('Invalid backup file.')); }
      };
      input.click();
    });
  }

  const DocPicker = await import('expo-document-picker');
  const result = await DocPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) throw new Error('No file selected.');
  const asset = result.assets[0];

  const FS = await import('expo-file-system');
  const text = await FS.readAsStringAsync(asset.uri, { encoding: FS.EncodingType.UTF8 });
  try { return JSON.parse(text) as BackupFile; }
  catch { throw new Error('Invalid backup file.'); }
}
