import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomFieldSchema, THEME_PRESETS, useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';

export default function CreateOrgScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createOrg } = useOrg();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'school' | 'gym' | 'corporate' | 'community' | 'church' | 'event'>('school');
  const [description, setDescription] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Step 2 State: Member Requirements & Custom Fields
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [idGenerationMode, setIdGenerationMode] = useState<'member_provided' | 'auto_generated'>('member_provided');
  const [customFields, setCustomFields] = useState<CustomFieldSchema[]>([
    { key: 'studentId', label: 'Index / Student ID #', type: 'text', required: true },
    { key: 'department', label: 'Faculty / Department', type: 'text', required: false },
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'email' | 'phone' | 'date'>('text');

  // Step 3 State: Theme & Branding
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[0]!);
  const [logoUri, setLogoUri] = useState<string | null>(null);

  // Step 4 State: Billing & Launch
  const [membershipFee, setMembershipFee] = useState('0');
  const [feeInterval, setFeeInterval] = useState<'free' | 'one_time' | 'monthly' | 'yearly'>('free');
  const [orgTier, setOrgTier] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [planBillingCycle, setPlanBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [orgCountry, setOrgCountry] = useState('GH'); // default Ghana
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 20);

  const handleCategoryChange = (cat: 'school' | 'gym' | 'corporate' | 'community' | 'church' | 'event') => {
    setCategory(cat);
    if (cat === 'school') {
      setSelectedTheme(THEME_PRESETS[4] || THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'studentId', label: 'Index / Student ID #', type: 'text', required: true },
        { key: 'department', label: 'Faculty / Department', type: 'text', required: false },
      ]);
    } else if (cat === 'gym') {
      setSelectedTheme(THEME_PRESETS[1] || THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'memberId', label: 'Membership ID / Locker #', type: 'text', required: true },
        { key: 'emergencyPhone', label: 'Emergency Contact Phone', type: 'phone', required: true },
      ]);
    } else if (cat === 'corporate') {
      setSelectedTheme(THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'employeeId', label: 'Employee ID #', type: 'text', required: true },
        { key: 'accessGroup', label: 'Access Group / Department', type: 'text', required: false },
      ]);
    } else if (cat === 'church') {
      setSelectedTheme(THEME_PRESETS[3] || THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'memberId', label: 'Member ID / Tithe Number', type: 'text', required: true },
        { key: 'cellGroup', label: 'Cell Group / Ministry', type: 'text', required: false },
      ]);
    } else if (cat === 'event') {
      setSelectedTheme(THEME_PRESETS[2] || THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'ticketId', label: 'Ticket / Registration #', type: 'text', required: true },
        { key: 'tableNumber', label: 'Table / Seat Number', type: 'text', required: false },
      ]);
    } else {
      // community
      setSelectedTheme(THEME_PRESETS[3] || THEME_PRESETS[0]!);
      setCustomFields([
        { key: 'memberId', label: 'Member ID #', type: 'text', required: true },
      ]);
    }
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) {
      Alert.alert('Field Label Required', 'Please enter a title for the required member field.');
      return;
    }
    const newField: CustomFieldSchema = {
      key: `field_${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
    };
    setCustomFields([...customFields, newField]);
    setNewFieldLabel('');
  };

  const removeCustomField = (key: string) => {
    setCustomFields(customFields.filter((f) => f.key !== key));
  };

  const handlePickLogo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Photo library permission is needed to upload your logo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setLogoUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Image Error', 'Failed to pick logo.');
    }
  };

  const validateStep = (targetStep: 1 | 2 | 3 | 4): boolean => {
    if (targetStep > 1) {
      if (!name.trim()) {
        Alert.alert('Organization Name Required', 'Please enter your organization name before continuing.');
        return false;
      }
      if (!adminEmail.trim() || !adminEmail.includes('@')) {
        Alert.alert('Admin Email Required', 'Please enter a valid primary admin email address.');
        return false;
      }
    }
    return true;
  };

  const goToStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep > step && !validateStep(targetStep)) return;
    setStep(targetStep);
  };

  const handleLaunchOrg = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const feeNum = parseFloat(membershipFee) || 0;
      const created = await createOrg({
        name: name.trim(),
        category,
        description: description.trim(),
        managerName: adminName.trim() || 'Admin User',
        managerEmail: adminEmail.trim(),
        logoUri: logoUri || undefined,
        primaryColor: selectedTheme.primary,
        secondaryColor: selectedTheme.secondary,
        accentColor: selectedTheme.accent || '#F59E0B',
        customFields,
        requirePhoto,
        idGenerationMode,
        tier: orgTier,
        billingCycle: planBillingCycle,
        membershipFee: feeNum,
        membershipFeeInterval: feeNum === 0 ? 'free' : (feeInterval as any),
        membershipFeeDescription: feeNum > 0 ? `${feeInterval} membership fee` : 'Free Membership',
        country: orgCountry,
        currency: orgCountry === 'NG' ? 'NGN' : orgCountry === 'US' ? 'USD' : orgCountry === 'GB' ? 'GBP' : 'GHS',
      });

      if (orgTier !== 'starter') {
        const amount = orgTier === 'pro'
          ? (planBillingCycle === 'yearly' ? 1430 : 149)
          : (planBillingCycle === 'yearly' ? 4790 : 499);

        let checkoutData: any = null;
        try {
          const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
          const checkoutRes = await fetch(`${apiBase}/api/paystack/org-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: adminEmail.trim(),
              orgId: created.id,
              tier: orgTier,
              billingCycle: planBillingCycle,
              amount,
            }),
          });
          if (checkoutRes.ok) {
            checkoutData = await checkoutRes.json();
          }
        } catch (e) {
          console.warn('[PAYSTACK ORG CHECKOUT ERROR]:', e);
        }

        // Fallback to pro-checkout endpoint if org-checkout endpoint returned no URL
        if (!checkoutData?.authorizationUrl) {
          try {
            const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
            const fallbackRes = await fetch(`${apiBase}/api/paystack/pro-checkout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: adminEmail.trim(),
                amount,
              }),
            });
            const fallbackText = await fallbackRes.text();
            try {
              const parsed = JSON.parse(fallbackText);
              if (parsed?.authorizationUrl) {
                checkoutData = parsed;
              }
            } catch {}
          } catch (fbErr) {
            console.warn('[PAYSTACK FALLBACK CHECKOUT ERROR]:', fbErr);
          }
        }

        const finalRef = checkoutData?.reference || `nascard_plan_${orgTier}_${created.id}_${Date.now()}`;
        const finalAuthUrl = checkoutData?.authorizationUrl || '';

        setIsSubmitting(false);
        router.push({
          pathname: '/org/payment',
          params: {
            orgId: `org_plan_${created.id}`,
            orgTier,
            authorizationUrl: finalAuthUrl,
            reference: finalRef,
            memberName: `${name.trim()} (${orgTier.toUpperCase()} Plan)`,
            memberEmail: adminEmail.trim(),
          },
        });
        return;
      }

      Alert.alert(
        '🎉 Organization Launched!',
        `Your Pass Creator Studio is live!\n\nInvite Code: ${created.inviteCode}`,
        [
          {
            text: 'Open Manager Dashboard',
            onPress: () => router.replace(`/org/manage/${created.id}` as any),
          },
        ]
      );
      router.replace(`/org/manage/${created.id}` as any);
    } catch (err: any) {
      console.error('💳 [LAUNCH ORG ERROR]:', err);
      Alert.alert(
        'Launch Notice',
        err?.message || 'Network check notice: Your organization pass studio was created in your local wallet.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Member Card Studio</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── STICKY LIVE 3D CARD PREVIEW ── */}
      <View style={[styles.previewSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient
          colors={[selectedTheme.primary, selectedTheme.secondary]}
          style={styles.cardPreview}
        >
          {/* Top Row: Logo & Category */}
          <View style={styles.cardTopRow}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.previewLogo} contentFit="contain" />
            ) : (
              <View style={styles.previewLogoFallback}>
                <Ionicons name="business" size={18} color="#FFFFFF" />
              </View>
            )}

            <View style={styles.previewCatBadge}>
              <Text style={styles.previewCatText}>{category.toUpperCase()} PASS</Text>
            </View>
          </View>

          {/* Org Title & Name */}
          <View style={styles.cardBodyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewOrgName} numberOfLines={1}>
                {name.trim() || 'Your Organization Name'}
              </Text>
              <Text style={styles.previewMemberName} numberOfLines={1}>
                {adminName.trim() || 'Member Full Name'}
              </Text>
            </View>

            {requirePhoto && (
              <View style={styles.previewPhotoBox}>
                <Ionicons name="person" size={20} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>

          {/* Live Custom Field Ledger Preview */}
          {customFields.length > 0 && (
            <View style={styles.previewLedgerGrid}>
              {customFields.slice(0, 2).map((f) => (
                <View key={f.key} style={{ width: '50%' }}>
                  <Text style={styles.previewLedgerLabel}>{f.label.toUpperCase().slice(0, 14)}</Text>
                  <Text style={styles.previewLedgerVal}>SAMPLE DATA</Text>
                </View>
              ))}
            </View>
          )}

          {/* Bottom Barcode Mock */}
          <View style={styles.cardBotRow}>
            <Text style={styles.previewCodeText}>
              {idGenerationMode === 'auto_generated' ? 'ID: AUTO-GENERATED' : 'ID: GHA-2026-XXXX'}
            </Text>
            <View style={styles.barcodeMock}>
              <View style={styles.barcodeLine} />
              <View style={[styles.barcodeLine, { width: 3 }]} />
              <View style={styles.barcodeLine} />
              <View style={[styles.barcodeLine, { width: 4 }]} />
              <View style={styles.barcodeLine} />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* 4-Step Stepper */}
      <View style={[styles.stepperContainer, { borderBottomColor: colors.border }]}>
        {[
          { num: 1, label: 'Info' },
          { num: 2, label: 'Fields' },
          { num: 3, label: 'Design' },
          { num: 4, label: 'Launch' },
        ].map((s) => (
          <TouchableOpacity
            key={s.num}
            style={styles.stepItem}
            onPress={() => goToStep(s.num as any)}
          >
            <View
              style={[
                styles.stepBadge,
                {
                  backgroundColor: step === s.num ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text style={[styles.stepBadgeText, { color: step === s.num ? colors.primaryForeground : colors.mutedForeground }]}>
                {s.num}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                {
                  color: step === s.num ? colors.foreground : colors.mutedForeground,
                  fontFamily: step === s.num ? 'Inter_700Bold' : 'Inter_400Regular',
                },
              ]}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 180 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: Basic Info & Category */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>1. Organization Profile</Text>

            <View style={styles.catGrid}>
              {[
                { id: 'school', title: '🎓 School / Campus ID' },
                { id: 'gym', title: '🏋️ Fitness Gym / Sports Club' },
                { id: 'corporate', title: '🏢 Corporate Office Access' },
                { id: 'event', title: '🎟️ VIP Event & Concert Ticket' },
                { id: 'church', title: '⛪ Church & Ministry Member' },
                { id: 'community', title: '✨ Club & Association' },
              ].map((c) => {
                const sel = category === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catCard,
                      {
                        backgroundColor: sel ? colors.primary + '18' : colors.card,
                        borderColor: sel ? colors.primary : colors.border,
                        borderWidth: sel ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleCategoryChange(c.id as any)}
                  >
                    <Text style={[styles.catLabel, { color: colors.foreground }]}>{c.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Organization Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                placeholder="e.g. Lincoln High School or Apex Fitness"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Description & Welcome Note</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    borderColor: colors.border,
                    height: 72,
                    textAlignVertical: 'top',
                    paddingTop: 10,
                  },
                ]}
                placeholder="Brief description or instructions shown to members when claiming their pass..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Admin Name & Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, marginBottom: 8 }]}
                placeholder="Admin Full Name"
                placeholderTextColor={colors.mutedForeground}
                value={adminName}
                onChangeText={setAdminName}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                placeholder="admin@school.edu.gh"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                value={adminEmail}
                onChangeText={setAdminEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
              onPress={() => goToStep(2)}
            >
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Continue to Required Fields</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Required Member Fields & Security Rules */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>2. Required Member Fields</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Define what information members must submit when claiming their digital card.
            </Text>

            {/* Passport Photo Toggle */}
            <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Require Passport Photo</Text>
                <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>Members must upload a headshot photo for ID verification.</Text>
              </View>
              <Switch value={requirePhoto} onValueChange={setRequirePhoto} trackColor={{ true: colors.primary }} />
            </View>

            {/* ID Generation Mode */}
            <View style={[styles.settingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Member ID Number Mode</Text>
              <View style={styles.modeGrid}>
                <TouchableOpacity
                  onPress={() => setIdGenerationMode('member_provided')}
                  style={[
                    styles.modeOption,
                    {
                      backgroundColor: idGenerationMode === 'member_provided' ? colors.primary + '1A' : colors.background,
                      borderColor: idGenerationMode === 'member_provided' ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.modeTitle, { color: colors.foreground }]}>Member-Provided ID</Text>
                  <Text style={[styles.modeSub, { color: colors.mutedForeground }]}>Member types their existing Index/Student or Locker #</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIdGenerationMode('auto_generated')}
                  style={[
                    styles.modeOption,
                    {
                      backgroundColor: idGenerationMode === 'auto_generated' ? colors.primary + '1A' : colors.background,
                      borderColor: idGenerationMode === 'auto_generated' ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.modeTitle, { color: colors.foreground }]}>Auto-Generated ID</Text>
                  <Text style={[styles.modeSub, { color: colors.mutedForeground }]}>App generates sequential code (e.g. APEX-1001)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Custom Field List Builder */}
            <View style={styles.fieldSection}>
              <Text style={[styles.label, { color: colors.foreground }]}>Form Input Fields Required from Members</Text>

              {customFields.map((f) => (
                <View key={f.key} style={[styles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldRowTitle, { color: colors.foreground }]}>{f.label}</Text>
                    <Text style={[styles.fieldRowSub, { color: colors.mutedForeground }]}>
                      Type: {f.type.toUpperCase()} · {f.required ? 'REQUIRED ⚠️' : 'OPTIONAL'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removeCustomField(f.key)} style={styles.removeBtn}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add New Custom Field Control */}
              <View style={[styles.addFieldCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.addFieldTitle, { color: colors.foreground }]}>+ Add New Custom Member Field</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Field Title (e.g. Faculty, Locker #, Year)"
                  placeholderTextColor={colors.mutedForeground}
                  value={newFieldLabel}
                  onChangeText={setNewFieldLabel}
                />

                <View style={styles.addFieldFooter}>
                  <TouchableOpacity
                    onPress={() => setNewFieldRequired(!newFieldRequired)}
                    style={[
                      styles.reqToggle,
                      { backgroundColor: newFieldRequired ? colors.primary + '20' : colors.background, borderColor: newFieldRequired ? colors.primary : colors.border },
                    ]}
                  >
                    <Ionicons name={newFieldRequired ? 'checkbox' : 'square-outline'} size={18} color={newFieldRequired ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.reqToggleText, { color: colors.foreground }]}>Required</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={addCustomField} style={[styles.addFieldBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.addFieldBtnText, { color: colors.primaryForeground }]}>Add Field</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
              onPress={() => validateStep(2) && goToStep(3)}
            >
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Continue to Live Design</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Live Design & Branding */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>3. Card Theme & Branding</Text>

            {/* Logo Upload */}
            <TouchableOpacity
              style={[styles.uploadLogoBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePickLogo}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
              <Text style={[styles.uploadLogoText, { color: colors.foreground }]}>
                {logoUri ? 'Logo Uploaded ✓ (Tap to change)' : 'Upload Organization Logo (Square PNG)'}
              </Text>
            </TouchableOpacity>

            {/* Theme Swatches */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 14 }]}>Color Theme Presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
              {THEME_PRESETS.map((t, idx) => {
                const sel = selectedTheme.name === t.name;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedTheme(t)}
                    style={[
                      styles.themeCard,
                      { borderColor: sel ? colors.primary : colors.border, borderWidth: sel ? 2.5 : 1 },
                    ]}
                  >
                    <LinearGradient colors={[t.primary, t.secondary]} style={styles.themePreview} />
                    <Text style={[styles.themeName, { color: colors.foreground }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              onPress={() => goToStep(4)}
            >
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Continue to Launch & Plans</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Access Fees & Launch */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>4. Access Plan & Launch</Text>
            {/* Monthly vs Yearly Billing Switcher */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
              <TouchableOpacity
                onPress={() => setPlanBillingCycle('monthly')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: planBillingCycle === 'monthly' ? colors.primary : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: planBillingCycle === 'monthly' ? colors.primaryForeground : colors.mutedForeground }}>
                  Monthly Billing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPlanBillingCycle('yearly')}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: planBillingCycle === 'yearly' ? colors.primary : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: planBillingCycle === 'yearly' ? colors.primaryForeground : colors.mutedForeground }}>
                  Annual (Save 20% 🎉)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Member Dues & Pass Duration Settings */}
            <View style={[styles.addFieldCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
              <Text style={[styles.addFieldTitle, { color: colors.foreground }]}>💳 Member Dues & Pass Duration</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 10 }}>
                Set what members pay to join and how long their digital pass stays active.
              </Text>

              <View style={{ gap: 10 }}>
                <View>
                  <Text style={[styles.label, { color: colors.foreground, fontSize: 12 }]}>Dues Fee (GH₵)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                    placeholder="0 for Free Pass"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={membershipFee}
                    onChangeText={(val) => {
                      setMembershipFee(val);
                      if (!val || parseFloat(val) === 0) {
                        setFeeInterval('free');
                      }
                    }}
                  />
                </View>

                {parseFloat(membershipFee) > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.label, { color: colors.foreground, fontSize: 12, marginBottom: 4 }]}>Paid Pass Renewal Duration</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: colors.border }}>
                      {(['monthly', 'yearly', 'free'] as const).map((inter) => (
                        <TouchableOpacity
                          key={inter}
                          onPress={() => setFeeInterval(inter)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            alignItems: 'center',
                            borderRadius: 6,
                            backgroundColor: feeInterval === inter ? colors.primary : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: feeInterval === inter ? colors.primaryForeground : colors.mutedForeground }}>
                            {inter === 'monthly' ? '30 Days' : inter === 'yearly' ? '1 Year' : 'Lifetime'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.tierContainer}>
              {/* Starter Tier */}
              <TouchableOpacity
                onPress={() => setOrgTier('starter')}
                style={[
                  styles.tierOption,
                  {
                    backgroundColor: colors.card,
                    borderColor: orgTier === 'starter' ? colors.primary : colors.border,
                    borderWidth: orgTier === 'starter' ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.tierTitle, { color: colors.foreground }]}>Starter Plan (FREE)</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.verified }}>FREE</Text>
                </View>
                <Text style={[styles.tierSub, { color: colors.mutedForeground }]}>
                  Up to 25 active digital pass members · Basic QR check-in & self-service registration.
                </Text>
              </TouchableOpacity>

              {/* Pro Studio Tier */}
              <TouchableOpacity
                onPress={() => setOrgTier('pro')}
                style={[
                  styles.tierOption,
                  {
                    backgroundColor: colors.card,
                    borderColor: orgTier === 'pro' ? colors.primary : colors.border,
                    borderWidth: orgTier === 'pro' ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.tierTitle, { color: colors.primary }]}>
                    Pro Studio ({planBillingCycle === 'yearly' ? 'GH₵ 1,430/yr (GH₵ 119/mo)' : 'GH₵ 149/mo'})
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>POPULAR 🌟</Text>
                </View>
                <Text style={[styles.tierSub, { color: colors.mutedForeground }]}>
                  Up to 500 members · Automated 60s QR security tokens, staff scanner PIN & member CSV export.
                </Text>
              </TouchableOpacity>

              {/* Enterprise Campus Tier */}
              <TouchableOpacity
                onPress={() => setOrgTier('enterprise')}
                style={[
                  styles.tierOption,
                  {
                    backgroundColor: colors.card,
                    borderColor: orgTier === 'enterprise' ? colors.primary : colors.border,
                    borderWidth: orgTier === 'enterprise' ? 2 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.tierTitle, { color: colors.foreground }]}>
                    Enterprise Campus ({planBillingCycle === 'yearly' ? 'GH₵ 4,790/yr (GH₵ 399/mo)' : 'GH₵ 499/mo'})
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.accent }}>UNLIMITED 👑</Text>
                </View>
                <Text style={[styles.tierSub, { color: colors.mutedForeground }]}>
                  Up to 10,000 members · Multi-staff scanner app, priority Paystack payouts & dedicated account manager.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.launchBtn, { backgroundColor: colors.primary }]}
              onPress={handleLaunchOrg}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.launchBtnText, { color: colors.primaryForeground }]}>
                  🚀 Launch Card Studio Now
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },

  // Live Preview Section
  previewSection: { padding: 16, borderBottomWidth: 1 },
  cardPreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLogo: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFFF' },
  previewLogoFallback: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewCatBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  previewCatText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.8 },
  cardBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewOrgName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  previewMemberName: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  previewPhotoBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  previewLedgerGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 2,
  },
  previewLedgerLabel: { fontSize: 7, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 },
  previewLedgerVal: { fontSize: 9.5, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  cardBotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewCodeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.9)' },
  barcodeMock: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  barcodeLine: { width: 2, height: 16, backgroundColor: '#FFFFFF' },

  // Stepper
  stepperContainer: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  stepBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  stepLabel: { fontSize: 12 },
  content: { padding: 16 },

  // Form
  stepContainer: { gap: 16, paddingVertical: 4 },
  stepTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  stepSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: -4, marginBottom: 2 },
  catGrid: { gap: 8 },
  catCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  catLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: 'Inter_400Regular' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  settingBox: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  settingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  settingSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  modeGrid: { flexDirection: 'row', gap: 10 },
  modeOption: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  modeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  modeSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  fieldSection: { gap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  fieldRowTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  fieldRowSub: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
  removeBtn: { padding: 6 },
  addFieldCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  addFieldTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  addFieldFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reqToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  reqToggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  addFieldBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addFieldBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  uploadLogoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  uploadLogoText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  themeRow: { gap: 12, paddingRight: 16 },
  themeCard: { width: 100, borderRadius: 14, padding: 8, gap: 6 },
  themePreview: { width: '100%', height: 48, borderRadius: 10 },
  themeName: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  tierContainer: { gap: 10 },
  tierOption: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 4 },
  tierTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tierSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  nextBtn: { height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  launchBtn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  launchBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
