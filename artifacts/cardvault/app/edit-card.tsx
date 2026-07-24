import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';

// Cards that are government/regulated — core fields are read-only
const LOCKED_TYPES: Array<Card['cardType']> = ['id', 'health'];

// Which fields are editable per type
function isFieldLocked(cardType: Card['cardType'], field: string): boolean {
  if (!LOCKED_TYPES.includes(cardType)) return false;
  // Regulated card types: lock identity fields
  return ['title', 'nameOnCard', 'idNumber', 'expiryDate'].includes(field);
}



export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getCard, updateCard } = useCards();

  const card = getCard(id ?? '');

  const [form, setForm] = useState({
    title: card?.title ?? '',
    nameOnCard: card?.nameOnCard ?? '',
    idNumber: card?.idNumber ?? '',
    expiryDate: card?.expiryDate ?? '',
    notes: card?.notes ?? '',
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!card) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Card not found</Text>
      </View>
    );
  }

  const locked = LOCKED_TYPES.includes(card.cardType);

  const handleSave = async () => {
    if (!form.title.trim() && !locked) {
      Alert.alert('Missing info', 'Please enter a card title.');
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updates: Partial<Card> = { notes: form.notes.trim() };
    if (!locked) {
      updates.title = form.title.trim();
      updates.nameOnCard = form.nameOnCard.trim();
      updates.idNumber = form.idNumber.trim();
      updates.expiryDate = form.expiryDate;
    }

    await updateCard(card.id, updates);
    router.back();
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Card</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground, backgroundColor: colors.primary }]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* Regulation notice for locked types */}
      {locked && (
        <View style={[styles.regulationBanner, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '55' }]}>
          <Ionicons name="lock-closed" size={15} color={colors.warning} />
          <Text style={[styles.regulationText, { color: colors.warning }]}>
            Core fields on {card.cardType === 'id' ? 'government ID' : 'health'} cards are read-only to comply with document regulations. You can update notes.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Field
            label="Card title"
            value={form.title}
            onChangeText={(v) => set('title', v)}
            locked={isFieldLocked(card.cardType, 'title')}
            colors={colors}
            placeholder="e.g. KNUST Student ID"
          />

          {/* Name */}
          <Field
            label="Name on card"
            value={form.nameOnCard}
            onChangeText={(v) => set('nameOnCard', v)}
            locked={isFieldLocked(card.cardType, 'nameOnCard')}
            colors={colors}
            placeholder="Full name"
          />

          {/* ID Number */}
          <Field
            label="ID / Card number"
            value={form.idNumber}
            onChangeText={(v) => set('idNumber', v)}
            locked={isFieldLocked(card.cardType, 'idNumber')}
            colors={colors}
            placeholder="Card number"
          />

          {/* Expiry */}
          <Field
            label="Expiry date (YYYY-MM-DD)"
            value={form.expiryDate}
            onChangeText={(v) => set('expiryDate', v)}
            locked={isFieldLocked(card.cardType, 'expiryDate')}
            colors={colors}
            placeholder="2027-12-31"
          />

          {/* Notes — always editable */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
              numberOfLines={3}
              placeholder="Any additional notes..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textArea,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
            />
          </View>


        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label, value, onChangeText, locked, colors, placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  locked: boolean;
  colors: any;
  placeholder?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        {locked && (
          <View style={[styles.lockedBadge, { backgroundColor: colors.muted }]}>
            <Ionicons name="lock-closed" size={10} color={colors.mutedForeground} />
            <Text style={[styles.lockedBadgeText, { color: colors.mutedForeground }]}>Locked</Text>
          </View>
        )}
      </View>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: locked ? colors.muted : colors.card,
            borderColor: locked ? colors.border + '88' : colors.border,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!locked}
          placeholder={locked ? 'Cannot be changed' : placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: locked ? colors.mutedForeground : colors.foreground }]}
        />
        {locked && <Ionicons name="lock-closed" size={14} color={colors.mutedForeground} style={{ marginRight: 12 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notFound: { textAlign: 'center', marginTop: 100, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  saveBtn: { minWidth: 40, alignItems: 'flex-end' },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  regulationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  regulationText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  scroll: { paddingHorizontal: 20, gap: 4, paddingTop: 8 },
  fieldGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
  },
  input: { flex: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
