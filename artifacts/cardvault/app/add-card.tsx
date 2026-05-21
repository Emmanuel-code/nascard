import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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
import type { CardType, ProfileType } from '@/types/card';

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

export default function AddCardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addCard } = useCards();
  const { profile } = useProfile();
  const [step, setStep] = useState(0);

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {step === 0 ? 'Card Type' : step === 1 ? 'Front Image' : step === 2 ? 'Back Image' : 'Card Details'}
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

      {/* Steps */}
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

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Front of card</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Take a photo or upload from your gallery
          </Text>

          {form.frontImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{ uri: form.frontImageUri }}
                style={styles.imagePreview}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => setForm({ ...form, frontImageUri: null })}
                style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.imagePlaceholder, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="card-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.imagePlaceholderText, { color: colors.mutedForeground }]}>
                No image yet
              </Text>
            </View>
          )}

          <View style={styles.imageButtons}>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('camera');
                if (uri) setForm({ ...form, frontImageUri: uri });
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
                if (uri) setForm({ ...form, frontImageUri: uri });
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="images" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

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
                onPress={() => setForm({ ...form, backImageUri: null })}
                style={[styles.removeImageBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.imagePlaceholder, { borderColor: colors.border, backgroundColor: colors.card }]}>
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
                if (uri) setForm({ ...form, backImageUri: uri });
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="camera" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                const uri = await pickImage('gallery');
                if (uri) setForm({ ...form, backImageUri: uri });
              }}
              style={[styles.imgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="images" size={22} color={colors.primary} />
              <Text style={[styles.imgBtnText, { color: colors.foreground }]}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {step === 3 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Card details</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Enter the information printed on your card
            </Text>

            {[
              { label: 'Card Title *', key: 'title', placeholder: 'e.g. KNUST Student ID', required: true },
              { label: 'Name on Card', key: 'nameOnCard', placeholder: 'As printed on card' },
              { label: 'ID / Card Number', key: 'idNumber', placeholder: 'Used to generate barcode' },
              { label: 'Expiry Date', key: 'expiryDate', placeholder: 'YYYY-MM-DD' },
              { label: 'Notes', key: 'notes', placeholder: 'Optional notes' },
            ].map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {field.label}
                </Text>
                <TextInput
                  value={form[field.key as keyof FormData] as string}
                  onChangeText={(v) => setForm({ ...form, [field.key]: v })}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.fieldInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  autoCapitalize={field.key === 'idNumber' ? 'characters' : 'words'}
                />
              </View>
            ))}
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
            onPress={() => setStep(step + 1)}
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
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
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1.585,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  imagePlaceholderText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
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
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
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
