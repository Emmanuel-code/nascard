import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useColors } from '@/hooks/useColors';
import type { CardType } from '@/types/card';

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
}

type OcrStatus = 'idle' | 'scanning' | 'done' | 'failed';

async function uriToBase64(uri: string): Promise<string> {
  // On web, expo-image-picker returns a data URI; extract the base64 part
  if (uri.startsWith('data:')) {
    return uri.split(',')[1] ?? '';
  }
  // On native, read the file using expo-file-system
  const { readAsStringAsync, EncodingType } = await import('expo-file-system');
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

async function scanCardImage(
  imageUri: string,
  cardType: CardType,
): Promise<{ title: string; nameOnCard: string; idNumber: string; expiryDate: string } | null> {
  try {
    const base64 = await uriToBase64(imageUri);
    if (!base64) return null;

    const apiBase = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : '';

    const res = await fetch(`${apiBase}/api/ocr/scan-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, cardType }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function AddCardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addCard } = useCards();
  const { profile } = useProfile();
  const [step, setStep] = useState(0);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');

  const [form, setForm] = useState<FormData>({
    cardType: 'id',
    title: '',
    nameOnCard: '',
    idNumber: '',
    expiryDate: '',
    notes: '',
    frontImageUri: null,
    backImageUri: null,
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const pickImage = async (source: 'camera' | 'gallery'): Promise<string | null> => {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera permission is required to scan cards.');
          return null;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
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
          quality: 0.85,
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
    setForm((f) => ({ ...f, frontImageUri: uri }));
    setOcrStatus('scanning');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await scanCardImage(uri, form.cardType);

    if (result) {
      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        nameOnCard: result.nameOnCard || f.nameOnCard,
        idNumber: result.idNumber || f.idNumber,
        expiryDate: result.expiryDate || f.expiryDate,
      }));
      setOcrStatus('done');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setOcrStatus('failed');
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing info', 'Please enter a card title.');
      return;
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
      barcodeFormat: 'qr',
      barcodeValue: form.idNumber.trim() || form.title.trim(),
      notes: form.notes.trim(),
      isPartnerIssued: false,
    });
    router.back();
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
    } else {
      setStep(step - 1);
    }
  };

  const handleContinueFromFront = () => {
    setStep(2);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {step === 0
            ? 'Card Type'
            : step === 1
              ? 'Front Image'
              : step === 2
                ? 'Back Image'
                : 'Card Details'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {[0, 1, 2, 3].map((i) => (
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

      {/* ── Step 0: Card type ── */}
      {step === 0 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>What type of card?</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Choose the category that best fits
          </Text>
          <View style={styles.typeGrid}>
            {CARD_TYPES.map((t) => {
              const isSelected = form.cardType === t.key;
              const c = TYPE_COLORS[t.key];
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setForm({ ...form, cardType: t.key })}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: isSelected ? c + '18' : colors.card,
                      borderColor: isSelected ? c : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: c + '22' }]}>
                    {t.lib === 'ionicons' ? (
                      <Ionicons name={t.icon as any} size={28} color={c} />
                    ) : (
                      <MaterialCommunityIcons name={t.icon as any} size={28} color={c} />
                    )}
                  </View>
                  <Text style={[styles.typeLabel, { color: isSelected ? c : colors.foreground }]}>
                    {t.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={c} style={styles.typeCheck} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Step 1: Front image + OCR ── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Front of card</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Take a photo — we'll auto-fill the details for you
          </Text>

          {form.frontImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: form.frontImageUri }}
                style={styles.imagePreview}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => {
                  setForm((f) => ({ ...f, frontImageUri: null }));
                  setOcrStatus('idle');
                }}
                style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>

              {/* OCR status banner */}
              {ocrStatus === 'scanning' && (
                <View style={[styles.ocrBanner, { backgroundColor: colors.primary + 'EE' }]}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.ocrBannerText}>Scanning card with AI…</Text>
                </View>
              )}
              {ocrStatus === 'done' && (
                <View style={[styles.ocrBanner, { backgroundColor: '#00C896EE' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.ocrBannerText}>Details auto-filled!</Text>
                </View>
              )}
              {ocrStatus === 'failed' && (
                <View style={[styles.ocrBanner, { backgroundColor: '#EF4444EE' }]}>
                  <Ionicons name="alert-circle" size={16} color="#fff" />
                  <Text style={styles.ocrBannerText}>Scan failed — fill in manually</Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Ionicons name="scan" size={44} color={colors.mutedForeground} />
              <Text style={[styles.imagePlaceholderText, { color: colors.mutedForeground }]}>
                Photograph your card
              </Text>
              <Text style={[styles.imagePlaceholderHint, { color: colors.mutedForeground }]}>
                AI will read name, ID number & expiry
              </Text>
            </View>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('camera');
                if (uri) await handleFrontImageCaptured(uri);
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Camera</Text>
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

          {/* OCR hint */}
          <View style={[styles.ocrHint, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.ocrHintText, { color: colors.mutedForeground }]}>
              Powered by GPT-4o Vision — your image is sent once for scanning and not stored
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── Step 2: Back image ── */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Back of card</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Optional — capture if your card has a barcode or info on the back
          </Text>

          {form.backImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: form.backImageUri }}
                style={styles.imagePreview}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => setForm((f) => ({ ...f, backImageUri: null }))}
                style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Ionicons name="card-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.imagePlaceholderText, { color: colors.mutedForeground }]}>
                No back image
              </Text>
            </View>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('camera');
                if (uri) setForm((f) => ({ ...f, backImageUri: uri }));
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="camera" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Camera</Text>
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
        </ScrollView>
      )}

      {/* ── Step 3: Details (pre-filled by OCR) ── */}
      {step === 3 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Card details</Text>

            {ocrStatus === 'done' ? (
              <View style={[styles.ocrSuccessBanner, { backgroundColor: '#00C896' + '18', borderColor: '#00C896' + '44' }]}>
                <Ionicons name="sparkles" size={15} color="#00C896" />
                <Text style={[styles.ocrSuccessText, { color: '#00C896' }]}>
                  Auto-filled by AI — review and edit if needed
                </Text>
              </View>
            ) : (
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Enter the information printed on your card
              </Text>
            )}

            {[
              { label: 'Card Title *', key: 'title', placeholder: 'e.g. KNUST Student ID', caps: 'words' as const },
              { label: 'Name on Card', key: 'nameOnCard', placeholder: 'As printed on card', caps: 'words' as const },
              { label: 'ID / Card Number', key: 'idNumber', placeholder: 'Used to generate barcode', caps: 'characters' as const },
              { label: 'Expiry Date', key: 'expiryDate', placeholder: 'YYYY-MM-DD', caps: 'none' as const },
              { label: 'Notes', key: 'notes', placeholder: 'Optional notes', caps: 'sentences' as const },
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
                    onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
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

      {/* Bottom actions */}
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeCard: {
    width: '46%',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  typeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  typeCheck: { position: 'absolute', top: 10, right: 10 },
  imagePreviewWrap: { position: 'relative', marginBottom: 20 },
  imagePreview: {
    width: '100%',
    aspectRatio: 1.585,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
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
});
