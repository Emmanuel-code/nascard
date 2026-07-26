import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';
import type { Organization } from '@/types/card';

import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

export default function MemberJoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards } = useCards();
  const { getOrgDetails, joinOrg, initializePayment } = useOrg();

  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(true);

  // Form State
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'nascard needs camera roll access to let you upload a photo for your card.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setPhotoUri(res.assets[0].uri);
    }
  };

  useEffect(() => {
    if (!id) return;
    setIsLoadingOrg(true);
    getOrgDetails(id)
      .then((res) => {
        if (res) {
          setOrg(res);
          // initialize custom fields defaults
          const initData: Record<string, string> = {};
          res.customFields.forEach((field: any) => {
            const fKey = field.key || field.id || field.label;
            initData[fKey] = '';
          });
          setCustomFieldsData(initData);
        }
      })
      .finally(() => setIsLoadingOrg(false));
  }, [id, getOrgDetails]);

  const handleJoinSubmit = async () => {
    if (isSubmitting) return;

    if (!memberName.trim()) {
      Alert.alert('Required', 'Please enter your full name as it should appear on the card.');
      return;
    }

    if (org) {
      // Prevent duplicate pass generation if member already has this org pass
      const existingCard = cards.find((c) => c.orgId === org.id);
      if (existingCard) {
        Alert.alert(
          'Already Claimed! 💳',
          `You already have an active pass for ${org.name} in your nascard Wallet.`,
          [{ text: 'View Card', onPress: () => router.replace(`/card/${existingCard.id}` as any) }]
        );
        return;
      }

      // Validate required custom fields
      for (const field of org.customFields) {
        const fKey = field.key || field.id || field.label;
        if (field.required && !customFieldsData[fKey]?.trim()) {
          Alert.alert('Required Field', `Please enter your ${field.label}.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Paid org → initialize Paystack, navigate to payment screen
      if (org && org.membershipFee > 0) {
        if (!memberEmail.trim()) {
          Alert.alert('Email Required', 'Please enter your email address to process payment.');
          setIsSubmitting(false);
          return;
        }

        const payInit = await initializePayment(org.id, memberEmail.trim(), org.membershipFee, memberName.trim());
        setIsSubmitting(false);

        router.push({
          pathname: '/org/payment' as any,
          params: {
            orgId: org.id,
            authorizationUrl: payInit.authorization_url,
            reference: payInit.reference,
            memberName: memberName.trim(),
            memberEmail: memberEmail.trim(),
            photoUri: photoUri || '',
            customFieldsData: JSON.stringify(customFieldsData),
          },
        });
        return;
      }

      // Free org → issue card directly
      const result = await joinOrg(org?.id || id || 'org_demo', {
        memberName: memberName.trim(),
        memberEmail: memberEmail.trim(),
        photoUri,
        customFieldsData,
      });

      Alert.alert(
        'Pass Claimed! 🎉',
        `Your ${result.organization.name} Pass has been added to your nascard Wallet.`,
        [{ text: 'View Card', onPress: () => router.replace(`/card/${result.card.id}` as any) }],
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to join organization. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoadingOrg) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="sparkles" size={32} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.foreground }]}>Loading Organization Details...</Text>
      </View>
    );
  }

  const primaryColor = org?.primaryColor || colors.primary;
  const accentColor = org?.accentColor || colors.primaryForeground;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Join Organization</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Org Banner Card */}
        <View style={[styles.orgBanner, { backgroundColor: primaryColor }]}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeTag, { backgroundColor: accentColor }]}>
              <Text style={[styles.badgeTagText, { color: primaryColor }]}>
                {org?.category.toUpperCase() || 'PARTNER PASS'}
              </Text>
            </View>
            <Ionicons name="shield-checkmark" size={20} color={accentColor} />
          </View>

          <Text style={styles.orgName}>{org?.name || 'Partner Pass'}</Text>
          <Text style={styles.orgLoc}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />{' '}
            {org?.location || 'Official Pass'}
          </Text>

          <Text style={styles.orgDesc}>{org?.description || 'Receive your verified digital pass.'}</Text>

          {org?.membershipFee && org.membershipFee > 0 ? (
            <View style={[styles.feePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="card" size={14} color="#FFFFFF" />
              <Text style={styles.feePillText}>
                GH₵{org.membershipFee.toLocaleString()} / {(org.membershipFeeInterval || 'one_time').replace('_', ' ')}
                {org.membershipFeeDescription ? `  •  ${org.membershipFeeDescription}` : ''}
              </Text>
            </View>
          ) : (
            <View style={[styles.feePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
              <Text style={styles.feePillText}>Free Official Digital Pass</Text>
            </View>
          )}
        </View>

        {/* Member Details Form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Enter Your Member Info</Text>
          <Text style={[styles.formSub, { color: colors.mutedForeground }]}>
            This information will be printed on your digital card and verified at check-in.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Full Name (Name on Card) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.mutedForeground}
              value={memberName}
              onChangeText={setMemberName}
            />
          </View>

          {/* Member Selfie Photo Picker (Only if requirePhoto is enabled by Manager) */}
          {(org?.requirePhoto ?? true) && (
            <View style={styles.fieldGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>Passport Photo / Selfie *</Text>
                <View style={{ backgroundColor: colors.primary + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>REQUIRED FOR ID PASS</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.photoPickerBtn, { backgroundColor: photoUri ? colors.primary + '12' : colors.secondary, borderColor: photoUri ? colors.primary : colors.border }]}
                onPress={handlePickPhoto}
              >
                {photoUri ? (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreviewThumb} />
                    <Text style={[styles.photoPickerText, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>Passport Photo Uploaded ✓ (Tap to change)</Text>
                  </View>
                ) : (
                  <View style={styles.photoPickerRow}>
                    <Ionicons name="camera" size={22} color={colors.primary} />
                    <Text style={[styles.photoPickerText, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>Take Selfie or Upload Passport Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Auto ID Generation Notice */}
          {org?.idGenerationMode === 'auto_generated' && (
            <View style={{ backgroundColor: colors.primary + '14', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '33', marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>🤖 Auto-Generated Member ID</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground, marginTop: 2 }}>
                Your official Member ID / Pass Number will be automatically assigned upon pass issuance.
              </Text>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email Address (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. john@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={memberEmail}
              onChangeText={setMemberEmail}
              keyboardType="email-address"
            />
          </View>

          {/* Dynamic Required Fields */}
          {org?.customFields && org.customFields.length > 0 ? (
            org.customFields.map((field: any) => {
              const fKey = field.key || field.id || field.label;
              return (
                <View key={fKey} style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.foreground }]}>
                    {field.label} {field.required ? '*' : '(Optional)'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                    placeholder={field.placeholder || `Enter ${field.label}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={customFieldsData[fKey] || ''}
                    onChangeText={(val) =>
                      setCustomFieldsData({ ...customFieldsData, [fKey]: val })
                    }
                    keyboardType={field.type === 'number' ? 'numeric' : field.type === 'phone' ? 'phone-pad' : 'default'}
                  />
                </View>
              );
            })
          ) : null}

          <TouchableOpacity
            style={[styles.claimBtn, { backgroundColor: primaryColor }]}
            onPress={handleJoinSubmit}
            disabled={isSubmitting}
          >
            <Ionicons name="card-outline" size={20} color="#FFFFFF" />
            <Text style={styles.claimBtnText}>
              {isSubmitting ? 'Issuing Digital Pass...' : 'Claim Digital Pass'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 16, gap: 16 },
  orgBanner: {
    padding: 20,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTagText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  orgName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  orgLoc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.9)' },
  orgDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  feePill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 4 },
  feePillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  formCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 14 },
  formTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  formSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: -6 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 8,
  },
  claimBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  photoPickerBtn: { height: 48, borderRadius: 10, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 12 },
  photoPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoPreviewThumb: { width: 32, height: 32, borderRadius: 16 },
  photoPickerText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
