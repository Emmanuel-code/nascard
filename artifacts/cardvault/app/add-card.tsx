import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { BarcodeScanner, mapBarcodeType } from '@/components/BarcodeScanner';
import type { BarcodeResult, ScannerMode } from '@/components/BarcodeScanner';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProPaywall } from '@/components/ProPaywall';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';
import { pauseAppLock } from '@/lib/appLock';

import type { CardType } from '@/types/card';

const FREE_CARD_LIMIT = 5;

const CARD_TYPES: { key: CardType; label: string; icon: string; lib: 'ionicons' | 'mci' }[] = [
  { key: 'id', label: 'ID Card', icon: 'card-account-details', lib: 'mci' },
  { key: 'health', label: 'Health', icon: 'medical-bag', lib: 'mci' },
  { key: 'loyalty', label: 'Loyalty', icon: 'star', lib: 'ionicons' },
  { key: 'membership', label: 'Membership', icon: 'shield-checkmark', lib: 'ionicons' },
];

const TYPE_COLORS: Record<CardType, string> = {
  id: '#4F8EF7',
  health: '#22C55E',
  loyalty: '#F59E0B',
  membership: '#9B6DFF',
};

interface FormData {
  cardType: CardType;
  title: string;
  nameOnCard: string;
  idNumber: string;
  expiryDate: string;
  notes: string;
  frontImageUri: string | null;
  backImageUri: string | null;
  barcodeFormat: 'qr' | 'code128' | 'code39';
}

type OcrStatus = 'idle' | 'scanning' | 'done' | 'failed';
type OcrFailReason = 'no-key' | 'scan-failed' | null;

const OCR_LOG_PREFIX = '[cardOcr]';

interface SpatialLine {
  text: string;
  cleanText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Multi-language anchor label dictionary for global identity documents
const GLOBAL_ANCHORS = {
  expiry: [
    'EXP', 'EXPIRES', 'EXPIRY', 'VALID', 'VALIDE', 'VENCIMIENTO', 'VALIDEZ',
    'ABLAUF', 'GÜLTIG', 'VALI', 'FIN', 'UNTIL', 'HASTA', 'THRU', 'EXPIRE'
  ],
  name: [
    'NAME', 'NOM', 'NOMBRE', 'CARDHOLDER', 'TITULAIRE', 'TITULAR',
    'FULL NAME', 'NOMBRES', 'APELLIDOS', 'SURNAME', 'GIVEN'
  ],
  id: [
    'ID', 'NO', 'NUMBER', 'NUMERO', 'NUMÉRO', 'DOC', 'DOCUMENT', 'CARD NO',
    'N°', 'CÉDULA', 'DNI', 'NIE', 'NATIONAL ID', 'LICENCE', 'LICENSE'
  ]
};

function parseGlobalDate(text: string): string {
  const clean = text.replace(/O/gi, '0').replace(/I/gi, '1');

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Match DD/MM/YYYY or DD.MM.YYYY (European / Global)
  const euMatch = clean.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;

  // Match MM/YY or MM/YYYY
  const shortMatch = clean.match(/\b(0[1-9]|1[0-2])[-/.](\d{2}|\d{4})\b/);
  if (shortMatch) {
    const yr = shortMatch[2].length === 2 ? `20${shortMatch[2]}` : shortMatch[2];
    return `${yr}-${shortMatch[1]}-28`;
  }

  return '';
}

function findNearestSpatialCandidate(
  anchorLine: SpatialLine,
  allLines: SpatialLine[],
  validator: (text: string) => boolean,
): SpatialLine | null {
  let bestCandidate: SpatialLine | null = null;
  let minDistance = Infinity;

  for (const candidate of allLines) {
    if (candidate === anchorLine) continue;

    const dx = candidate.x - (anchorLine.x + anchorLine.width);
    const dy = candidate.y - (anchorLine.y + anchorLine.height);
    const alignX = Math.abs(candidate.x - anchorLine.x);

    const isToRight = Math.abs(candidate.centerY - anchorLine.centerY) < 15 && dx >= -10 && dx < 220;
    const isBelow = dy >= -5 && dy < 45 && alignX < 120;

    if ((isToRight || isBelow) && validator(candidate.cleanText)) {
      const dist = isToRight ? Math.abs(dx) : Math.abs(dy);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate;
}

/**
 * ⚡ GLOBAL SPATIAL ON-DEVICE OCR ENGINE
 */
async function scanCardGlobally(imageUri: string): Promise<{ title: string; nameOnCard: string; idNumber: string; expiryDate: string } | null> {
  if (Platform.OS === 'web') return null;

  try {
    const startedAt = Date.now();
    const result = await TextRecognition.recognize(imageUri);
    if (!result || !result.text) return null;

    const spatialLines: SpatialLine[] = result.blocks.flatMap((b) =>
      b.lines.map((l) => {
        const x = l.frame?.left ?? 0;
        const y = l.frame?.top ?? 0;
        const width = l.frame?.width ?? 0;
        const height = l.frame?.height ?? 0;
        return {
          text: l.text.trim(),
          cleanText: l.text.trim().toUpperCase(),
          x,
          y,
          width,
          height,
          centerX: x + width / 2,
          centerY: y + height / 2,
        };
      }),
    );

    let title = '';
    let nameOnCard = '';
    let idNumber = '';
    let expiryDate = '';

    // 1. EXPIRY DATE EXTRACTION (Anchor-Driven + Spatial Vectoring)
    const expiryAnchors = spatialLines.filter((l) =>
      GLOBAL_ANCHORS.expiry.some((kw) => l.cleanText.includes(kw)),
    );

    for (const anchor of expiryAnchors) {
      const candidate = findNearestSpatialCandidate(anchor, spatialLines, (txt) =>
        /\d/.test(txt) && parseGlobalDate(txt) !== '',
      );
      if (candidate) {
        expiryDate = parseGlobalDate(candidate.cleanText);
        break;
      }
    }

    if (!expiryDate) {
      for (const line of spatialLines) {
        const parsed = parseGlobalDate(line.cleanText);
        if (parsed) {
          expiryDate = parsed;
          break;
        }
      }
    }

    // 2. ID NUMBER EXTRACTION (MRZ / Global Regex / Spatial Anchors)
    const mrzMatch = result.text.match(/([A-Z0-9<]{9,12})/);
    const ghaMatch = result.text.match(/GHA-\d{9}-\d/i);

    if (ghaMatch) {
      idNumber = ghaMatch[0].toUpperCase();
    } else if (mrzMatch && mrzMatch[1].replace(/</g, '').length >= 8) {
      idNumber = mrzMatch[1].replace(/</g, '');
    } else {
      const idAnchors = spatialLines.filter((l) =>
        GLOBAL_ANCHORS.id.some((kw) => l.cleanText.includes(kw)),
      );

      for (const anchor of idAnchors) {
        const candidate = findNearestSpatialCandidate(anchor, spatialLines, (txt) =>
          /[A-Z0-9]{4,}/.test(txt) && !GLOBAL_ANCHORS.id.some((kw) => txt.includes(kw)),
        );
        if (candidate) {
          idNumber = candidate.cleanText;
          break;
        }
      }
    }

    // 3. NAME ON CARD EXTRACTION (Spatial Pair relative to "NAME" label)
    const nameAnchors = spatialLines.filter((l) =>
      GLOBAL_ANCHORS.name.some((kw) => l.cleanText.includes(kw)),
    );

    for (const anchor of nameAnchors) {
      const candidate = findNearestSpatialCandidate(anchor, spatialLines, (txt) =>
        !/\d/.test(txt) &&
        txt.length > 3 &&
        !GLOBAL_ANCHORS.name.some((kw) => txt.includes(kw)),
      );
      if (candidate) {
        nameOnCard = candidate.text;
        break;
      }
    }

    // 4. TITLE EXTRACTION (Top Most Bounding Box)
    const topLines = [...spatialLines].sort((a, b) => a.y - b.y);
    if (topLines.length > 0) {
      const headerLine = topLines.find(
        (l) => l.text !== nameOnCard && l.cleanText !== idNumber && !/\d{4}/.test(l.cleanText),
      );
      if (headerLine) {
        title = headerLine.text;
      }
    }

    console.log(`${OCR_LOG_PREFIX} Global spatial OCR ok in ${Date.now() - startedAt}ms`);

    if (title || nameOnCard || idNumber || expiryDate) {
      return {
        title: title || 'Scanned Card',
        nameOnCard: nameOnCard || '',
        idNumber: idNumber || '',
        expiryDate: expiryDate || '',
      };
    }
    return null;
  } catch (err) {
    console.warn(`${OCR_LOG_PREFIX} Global spatial parsing error:`, err);
    return null;
  }
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    return uri.split(',')[1] ?? '';
  }
  try {
    const LegacyFS = await import('expo-file-system/legacy');
    return await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType?.Base64 ?? 'base64' });
  } catch {
    const FileSystem = await import('expo-file-system');
    return await (FileSystem as any).readAsStringAsync(uri, { encoding: 'base64' });
  }
}

async function scanWithGeminiVision(
  imageBase64: string,
  cardType: CardType,
  apiKey: string,
): Promise<{ title: string; nameOnCard: string; idNumber: string; expiryDate: string } | null> {
  const prompt = `You are an AI card scanner assistant. Analyze this card image and extract:
1. "title": Card title or issuer (e.g. Ghana National ID, NHIS Health Card, Driver License, KNUST Student Card, Gym Pass)
2. "nameOnCard": Full name of the cardholder printed on the card
3. "idNumber": The primary identification/card number
4. "expiryDate": The expiration date in YYYY-MM-DD format (or empty string if not found)

Return ONLY a raw JSON object with keys: "title", "nameOnCard", "idNumber", "expiryDate". Do not include markdown code blocks or explanations.`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    const startedAt = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        const fenceStripped = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const braceMatch = fenceStripped.match(/\{[\s\S]*\}/);
        const clean = braceMatch ? braceMatch[0] : fenceStripped;

        try {
          const parsed = JSON.parse(clean);
          console.log(`${OCR_LOG_PREFIX} Gemini (${model}) ok in ${Date.now() - startedAt}ms`);
          return {
            title: parsed.title || '',
            nameOnCard: parsed.nameOnCard || '',
            idNumber: parsed.idNumber || '',
            expiryDate: parsed.expiryDate || '',
          };
        } catch (parseErr) {
          console.warn(`${OCR_LOG_PREFIX} Gemini (${model}) returned unparseable JSON`);
        }
      }
    } catch (e) {
      console.warn(`${OCR_LOG_PREFIX} Gemini (${model}) failed or timed out`);
    }
  }

  return null;
}

interface ScanCardResult {
  title: string;
  nameOnCard: string;
  idNumber: string;
  expiryDate: string;
  failReason?: OcrFailReason;
}

async function scanCardImage(
  imageUri: string,
  cardType: CardType,
  userApiKey?: string,
): Promise<ScanCardResult> {
  const emptyResult: ScanCardResult = { title: '', nameOnCard: '', idNumber: '', expiryDate: '' };
  const geminiKey = userApiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  // 1. Stage 1: Global Spatial On-Device Engine (Zero latency)
  const spatialResult = await scanCardGlobally(imageUri);
  if (spatialResult && (spatialResult.idNumber || spatialResult.nameOnCard || spatialResult.title)) {
    return spatialResult;
  }

  // 2. Stage 2: Fallback Cloud Multimodal AI
  if (geminiKey) {
    try {
      const base64 = await uriToBase64(imageUri);
      if (base64) {
        const geminiResult = await scanWithGeminiVision(base64, cardType, geminiKey);
        if (geminiResult && (geminiResult.title || geminiResult.nameOnCard || geminiResult.idNumber)) {
          return geminiResult;
        }
      }
    } catch (err) {
      console.warn(`${OCR_LOG_PREFIX} Gemini fallback failed:`, err);
    }
  }

  return { ...emptyResult, failReason: geminiKey ? 'scan-failed' : 'no-key' };
}

export default function AddCardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addCard, cards } = useCards();
  const { profile } = useProfile();
  const { isPro } = usePro();
  const userCards = cards.filter((c) => !c.isSample && !c.id.startsWith('sample-'));
  const atLimit = !isPro && userCards.length >= FREE_CARD_LIMIT;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { autoScan } = useLocalSearchParams<{ autoScan?: string }>();
  const [step, setStep] = useState(1);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrFailReason, setOcrFailReason] = useState<OcrFailReason>(null);
  const [showScanner, setShowScanner] = useState(autoScan === 'true');
  const [scannerMode, setScannerMode] = useState<ScannerMode>('card_photo');
  const [scannerTarget, setScannerTarget] = useState<'front' | 'back'>('front');
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const step1ScrollRef = useRef<any>(null);
  const pendingScrollFix = useRef(false);

  const [form, setForm] = useState<FormData>({
    cardType: 'id',
    title: '',
    nameOnCard: '',
    idNumber: '',
    expiryDate: '',
    notes: '',
    frontImageUri: null,
    backImageUri: null,
    barcodeFormat: 'qr',
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const pickImage = async (source: 'camera' | 'gallery'): Promise<string | null> => {
    try {
      pauseAppLock(180000);
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera permission is required to scan cards.');
          return null;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.75,
          allowsEditing: true,
          aspect: [85, 54],
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Photo library permission is required.');
          return null;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.75,
          allowsEditing: true,
          aspect: [85, 54],
        });
      }
      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
    } catch (e) {
      console.error('Image pick error', e);
    }
    return null;
  };

  const handleFrontImageCaptured = async (uri: string) => {
    const defaultTitle =
      form.cardType === 'id'
        ? 'National ID Card'
        : form.cardType === 'health'
          ? 'Health Insurance Pass'
          : form.cardType === 'membership'
            ? 'Membership Card'
            : 'Personal Card';

    pendingScrollFix.current = true;

    setForm((f: any) => ({
      ...f,
      frontImageUri: uri,
      title: f.title || defaultTitle,
    }));

    setOcrStatus('scanning');
    setOcrFailReason(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await scanCardImage(uri, form.cardType, profile.geminiApiKey);

    if (result.title || result.nameOnCard || result.idNumber || result.expiryDate) {
      setForm((f: any) => ({
        ...f,
        title: result.title || f.title || defaultTitle,
        nameOnCard: result.nameOnCard || f.nameOnCard,
        idNumber: result.idNumber || f.idNumber,
        expiryDate: result.expiryDate || f.expiryDate,
      }));
      setOcrStatus('done');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setOcrStatus('failed');
      setOcrFailReason(result.failReason ?? 'scan-failed');
    }
  };

  const rotateImage = async (target: 'front' | 'back') => {
    const currentUri = target === 'front' ? form.frontImageUri : form.backImageUri;
    if (!currentUri) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const result = await manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 0.9, format: SaveFormat.JPEG },
      );
      setForm((f: any) => ({
        ...f,
        [target === 'front' ? 'frontImageUri' : 'backImageUri']: result.uri,
      }));
    } catch (e) {
      console.warn('Rotate failed:', e);
    }
  };

  const handleIdChange = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (cleaned.startsWith('GHA') || /^[0-9]/.test(cleaned)) {
      const raw = cleaned.replace(/-/g, '');
      const prefix = raw.startsWith('GHA') ? 'GHA' : 'GHA';
      const digits = raw.startsWith('GHA') ? raw.slice(3) : raw;
      if (digits.length === 0) {
        setForm((f: any) => ({ ...f, idNumber: prefix }));
        return;
      }
      const p1 = digits.slice(0, 9);
      const p2 = digits.slice(9, 10);
      let formatted = `${prefix}-${p1}`;
      if (p2) formatted += `-${p2}`;
      setForm((f: any) => ({ ...f, idNumber: formatted }));
      return;
    }
    setForm((f: any) => ({ ...f, idNumber: text }));
  };

  const handleExpiryChange = (text: string) => {
    const raw = text.replace(/[^0-9]/g, '').slice(0, 8);
    if (raw.length <= 4) {
      setForm((f: any) => ({ ...f, expiryDate: raw }));
    } else if (raw.length <= 6) {
      setForm((f: any) => ({ ...f, expiryDate: `${raw.slice(0, 4)}-${raw.slice(4)}` }));
    } else {
      setForm((f: any) => ({
        ...f,
        expiryDate: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      }));
    }
  };

  const handleBarcodeScan = (result: BarcodeResult, payload?: any) => {
    const fmt = mapBarcodeType(result.type);
    setForm((f: any) => ({
      ...f,
      idNumber: payload?.extractedId || result.value,
      barcodeFormat: fmt,
      expiryDate: payload?.extractedExpiry || f.expiryDate,
      nameOnCard: payload?.extractedName || f.nameOnCard,
      title: payload?.suggestedTitle || f.title,
      cardType: payload?.suggestedType || f.cardType,
    }));
    setBarcodeScanned(true);
    setShowScanner(false);
    setStep(2);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCardCapturedInScanner = async (uri: string) => {
    setShowScanner(false);
    if (scannerTarget === 'back') {
      setForm((f: any) => ({ ...f, backImageUri: uri }));
    } else {
      await handleFrontImageCaptured(uri);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing info', 'Please enter a card title.');
      return;
    }
    if (form.expiryDate.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(form.expiryDate.trim())) {
        Alert.alert('Invalid Date Format', 'Please enter expiry date in YYYY-MM-DD format (e.g. 2028-12-31).');
        return;
      }
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addCard({
      profileId: profile.activeProfile,
      cardType: form.cardType,
      title: form.title.trim(),
      nameOnCard: form.nameOnCard.trim(),
      idNumber: form.idNumber.trim(),
      expiryDate: form.expiryDate,
      frontImageUri: form.frontImageUri,
      backImageUri: form.backImageUri,
      barcodeFormat: form.barcodeFormat,
      barcodeValue: form.idNumber.trim() || form.title.trim(),
      notes: form.notes.trim(),
      isPartnerIssued: false,
    });
    router.back();
  };

  const goBack = () => {
    if (step <= 1) {
      router.back();
    } else {
      setStep(step - 1);
    }
  };

  const handleContinueFromFront = () => {
    setStep(2);
  };

  if (atLimit) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <ProPaywall visible={paywallVisible} onClose={() => { setPaywallVisible(false); router.back(); }} />
        <Text style={{ fontSize: 40, marginBottom: 16 }}>👑</Text>
        <Text style={[{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 8 }]}>
          Free plan limit reached
        </Text>
        <Text style={[{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 22, marginBottom: 28 }]}>
          You have reached the maximum limit of {FREE_CARD_LIMIT} cards on the free plan.
        </Text>
        <TouchableOpacity
          onPress={() => setPaywallVisible(true)}
          style={[{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 16 }]}
        >
          <Text style={[{ color: colors.primaryForeground, fontSize: 16, fontFamily: 'Inter_700Bold' }]}>
            Upgrade to Pro — GH₵ 19/mo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[{ color: colors.mutedForeground, fontSize: 14, fontFamily: 'Inter_500Medium' }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name={step <= 1 ? 'close' : 'arrow-back'} size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {step === 1
            ? 'Front Image'
            : step === 2
              ? 'Back Image (Optional)'
              : 'Card Details'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.stepRow}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              {
                backgroundColor: i <= step ? colors.primary : colors.border,
                flex: i <= step ? 1.4 : 1,
              },
            ]}
          />
        ))}
      </View>

      {/* Step 1: Front image + Spatial OCR */}
      {step === 1 && (
        <ScrollView
          ref={step1ScrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (pendingScrollFix.current) {
              step1ScrollRef.current?.scrollTo({ y: 0, animated: false });
              pendingScrollFix.current = false;
            }
          }}
        >
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Front of card</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Take a photo — global spatial engine will auto-extract card details
          </Text>

          {form.frontImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <View style={[styles.cardFrameBorder, { borderColor: colors.primary }]}>
                <Image
                  source={{ uri: form.frontImageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              </View>
              <View style={styles.imageActionButtons}>
                <TouchableOpacity
                  onPress={() => rotateImage('front')}
                  style={[styles.actionRoundBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setForm((f) => ({ ...f, frontImageUri: null }));
                    setOcrStatus('idle');
                    setOcrFailReason(null);
                    pendingScrollFix.current = false;
                  }}
                  style={[styles.actionRoundBtn, { backgroundColor: colors.destructive }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {ocrStatus === 'scanning' && (
                <View style={[styles.ocrBanner, { backgroundColor: colors.primary + 'EE' }]}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.ocrBannerText}>Processing with Global Spatial Engine…</Text>
                </View>
              )}
              {ocrStatus === 'done' && (
                <View style={[styles.ocrBanner, { backgroundColor: '#00C896EE' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.ocrBannerText}>Details auto-filled!</Text>
                </View>
              )}
              {ocrStatus === 'failed' && (
                <View style={[styles.ocrBanner, { backgroundColor: 'rgba(30,58,138,0.92)' }]}>
                  <Ionicons name="information-circle" size={16} color="#93C5FD" />
                  <Text style={styles.ocrBannerText}>
                    Couldn't auto-read card — enter details manually below
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScannerMode('card_photo');
                setScannerTarget('front');
                setShowScanner(true);
              }}
              activeOpacity={0.88}
              style={[
                styles.imagePlaceholder,
                { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.card, height: 210, borderRadius: 16, position: 'relative' },
              ]}
            >
              <View style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderTopWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderTopLeftRadius: 6 }} />
              <View style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderTopWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderTopRightRadius: 6 }} />
              <View style={{ position: 'absolute', bottom: 8, left: 8, width: 18, height: 18, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderBottomLeftRadius: 6 }} />
              <View style={{ position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderBottomWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderBottomRightRadius: 6 }} />

              <Ionicons name="scan" size={40} color={colors.primary} />
              <Text style={[styles.imagePlaceholderText, { color: colors.foreground, fontFamily: 'Inter_700Bold', marginTop: 8 }]}>
                Scan Front of Card
              </Text>
              <Text style={[styles.imagePlaceholderHint, { color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 20 }]}>
                Tap to open viewfinder — auto-clips card edges & extracts details
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScannerMode('card_photo');
                setScannerTarget('front');
                setShowScanner(true);
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 }]}
              activeOpacity={0.8}
            >
              <Ionicons name="scan" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                Scan Card
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('gallery');
                if (uri) await handleFrontImageCaptured(uri);
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="images" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setStep(3)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
              marginTop: 6,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
              Don't have a photo? Enter details manually
            </Text>
          </TouchableOpacity>

          <View style={[styles.ocrHint, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.ocrHintText, { color: colors.mutedForeground }]}>
              The photo IS your 3D digital card face. Extra text details are 100% optional.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Step 2: Back image */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Back of card</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Optional — capture if your card has a barcode or info on the back
          </Text>

          {form.backImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <View style={[styles.cardFrameBorder, { borderColor: colors.primary }]}>
                <Image
                  source={{ uri: form.backImageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
              </View>
              <View style={styles.imageActionButtons}>
                <TouchableOpacity
                  onPress={() => rotateImage('back')}
                  style={[styles.actionRoundBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setForm((f) => ({ ...f, backImageUri: null }))}
                  style={[styles.actionRoundBtn, { backgroundColor: colors.destructive }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScannerMode('card_photo');
                setScannerTarget('back');
                setShowScanner(true);
              }}
              activeOpacity={0.88}
              style={[
                styles.imagePlaceholder,
                { borderColor: colors.border, backgroundColor: colors.card, height: 210, borderRadius: 16, position: 'relative' },
              ]}
            >
              <Ionicons name="card-outline" size={44} color={colors.mutedForeground} />
              <Text style={[styles.imagePlaceholderText, { color: colors.foreground, fontFamily: 'Inter_700Bold', marginTop: 8 }]}>
                Scan Back of Card
              </Text>
              <Text style={[styles.imagePlaceholderHint, { color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 20 }]}>
                Tap to scan reverse side (optional)
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setScannerMode('card_photo');
                setScannerTarget('back');
                setShowScanner(true);
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 }]}
            >
              <Ionicons name="scan" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                Scan Back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('gallery');
                if (uri) setForm((f) => ({ ...f, backImageUri: uri }));
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="images" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setShowScanner(true)}
            style={[
              styles.scanBarcodeBtn,
              {
                backgroundColor: barcodeScanned ? colors.verified + '18' : colors.card,
                borderColor: barcodeScanned ? colors.verified : colors.primary + '66',
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={barcodeScanned ? 'checkmark-circle' : 'barcode-outline'}
              size={22}
              color={barcodeScanned ? colors.verified : colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.scanBarcodeBtnText, { color: barcodeScanned ? colors.verified : colors.foreground }]}>
                {barcodeScanned ? 'Barcode scanned ✓' : 'Scan barcode on card'}
              </Text>
              {barcodeScanned && form.idNumber ? (
                <Text style={[styles.scanBarcodeSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {form.idNumber}
                </Text>
              ) : (
                <Text style={[styles.scanBarcodeSub, { color: colors.mutedForeground }]}>
                  Reads QR, Code128, EAN, and more
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Step 3: Details review */}
      {step === 3 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 180 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Card details</Text>

            {ocrStatus === 'done' ? (
              <View style={[styles.ocrSuccessBanner, { backgroundColor: '#00C896' + '18', borderColor: '#00C896' + '44' }]}>
                <Ionicons name="sparkles" size={15} color="#00C896" />
                <Text style={[styles.ocrSuccessText, { color: '#00C896' }]}>
                  Auto-filled by Spatial AI — review and edit if needed
                </Text>
              </View>
            ) : (
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Enter the information printed on your card
              </Text>
            )}

            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                CARD CATEGORY (OPTIONAL)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CARD_TYPES.map((t) => {
                  const isSelected = form.cardType === t.key;
                  const c = TYPE_COLORS[t.key];
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setForm((f) => ({ ...f, cardType: t.key }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isSelected ? c + '22' : colors.card,
                        borderWidth: 1,
                        borderColor: isSelected ? c : colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: isSelected ? c : colors.foreground }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {[
              { label: 'Card Name / Title *', key: 'title', placeholder: 'e.g. Ghana National ID, Health Card', caps: 'words' as const },
              { label: 'Name on Card', key: 'nameOnCard', placeholder: 'e.g. John Doe', caps: 'words' as const },
              { label: 'ID / Membership Number', key: 'idNumber', placeholder: 'e.g. GHA-12345678-9', caps: 'characters' as const },
              { label: 'Expiry Date', key: 'expiryDate', placeholder: 'e.g. 2028-12-31', caps: 'none' as const },
              { label: 'Notes', key: 'notes', placeholder: 'Additional notes or pin...', caps: 'sentences' as const },
            ].map((field) => {
              const hasOcrValue =
                ocrStatus === 'done' &&
                field.key !== 'notes' &&
                !!(form[field.key as keyof FormData] as string);
              return (
                <View key={field.key} style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      {field.label}
                    </Text>
                    {hasOcrValue && (
                      <View style={styles.ocrTag}>
                        <Ionicons name="sparkles" size={10} color={colors.primary} />
                        <Text style={[styles.ocrTagText, { color: colors.primary }]}>AI</Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={form[field.key as keyof FormData] as string}
                    onChangeText={(v: string) => {
                      if (field.key === 'idNumber') {
                        handleIdChange(v);
                      } else if (field.key === 'expiryDate') {
                        handleExpiryChange(v);
                      } else {
                        setForm((f: any) => ({ ...f, [field.key]: v }));
                      }
                    }}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize={field.caps}
                    style={[
                      styles.fieldInput,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.card,
                        borderColor: hasOcrValue ? colors.primary + '66' : colors.border,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Footer controls */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: bottomPad + 16,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {step < 3 ? (
          <TouchableOpacity
            onPress={() => {
              if (step === 1) {
                handleContinueFromFront();
              } else {
                setStep(step + 1);
              }
            }}
            disabled={step === 1 && ocrStatus === 'scanning'}
            style={[
              styles.nextBtn,
              {
                backgroundColor:
                  step === 1 && ocrStatus === 'scanning'
                    ? colors.primary + '88'
                    : colors.primary,
              },
            ]}
            activeOpacity={0.85}
          >
            {step === 1 && ocrStatus === 'scanning' ? (
              <>
                <ActivityIndicator size="small" color={colors.primaryForeground} />
                <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
                  Scanning…
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
                  Continue
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
            <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Save Card</Text>
          </TouchableOpacity>
        )}

        {step === 2 && !form.backImageUri && (
          <TouchableOpacity onPress={() => setStep(3)} style={styles.skipStep}>
            <Text style={[styles.skipStepText, { color: colors.mutedForeground }]}>
              Skip — no back side
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {showScanner && (
        <BarcodeScanner
          initialMode={scannerMode}
          onScanned={handleBarcodeScan}
          onCardCaptured={handleCardCapturedInScanner}
          onClose={() => setShowScanner(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  stepRow: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 20,
    marginBottom: 20,
    height: 3,
  },
  stepDot: { borderRadius: 2, height: 3 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  stepTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 24, lineHeight: 20 },
  imagePreviewWrap: { position: 'relative', marginBottom: 20 },
  cardFrameBorder: {
    width: '100%',
    aspectRatio: 1.585,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageActionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  actionRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  ocrBannerText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1.585,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  imagePlaceholderText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  imagePlaceholderHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  imageButtons: { flexDirection: 'row', gap: 12 },
  imgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  imgBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  ocrHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  ocrHintText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  ocrSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  ocrSuccessText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  fieldGroup: { marginBottom: 16 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ocrTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(201,162,39,0.12)',
  },
  ocrTagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
  },
  nextBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  skipStep: { alignItems: 'center' },
  skipStepText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  scanBarcodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  scanBarcodeBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scanBarcodeSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});