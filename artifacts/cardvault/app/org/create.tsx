import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
  const [category, setCategory] = useState<'school' | 'gym' | 'corporate' | 'community'>('school');
  const [description, setDescription] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [payoutMomoNumber, setPayoutMomoNumber] = useState('');
  const [payoutMomoNetwork, setPayoutMomoNetwork] = useState('MTN');

  // Step 2 Controls: Custom Fields, Photo Toggle, ID Mode
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [idGenerationMode, setIdGenerationMode] = useState<'member_provided' | 'auto_generated'>('member_provided');
  const [customFields, setCustomFields] = useState<CustomFieldSchema[]>([
    { key: 'studentId', label: 'Index / Student ID #', type: 'text', required: true },
    { key: 'department', label: 'Faculty / Department', type: 'text', required: false },
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(true);

  // Design Studio State
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[0]!);
  const [securityStrip, setSecurityStrip] = useState<'hologram' | 'gold' | 'standard'>('hologram');
  const [photoFrameStyle, setPhotoFrameStyle] = useState<'square' | 'gold_border' | 'circle'>('gold_border');
  
  // Step 4 State: Fee & Plan Billing
  const [membershipFee, setMembershipFee] = useState('0');
  const [feeInterval, setFeeInterval] = useState<'free' | 'one_time' | 'monthly' | 'yearly'>('free');
  const [orgTier, setOrgTier] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryChange = (cat: 'school' | 'gym' | 'corporate' | 'community') => {
    setCategory(cat);
    if (cat === 'school') {
      setCustomFields([
        { key: 'studentId', label: 'Index / Student ID #', type: 'text', required: true },
        { key: 'department', label: 'Faculty / Department', type: 'text', required: false },
      ]);
    } else if (cat === 'gym') {
      setCustomFields([
        { key: 'memberId', label: 'Membership ID / Locker #', type: 'text', required: true },
        { key: 'emergencyPhone', label: 'Emergency Contact Phone', type: 'phone', required: true },
      ]);
    } else if (cat === 'corporate') {
      setCustomFields([
        { key: 'employeeId', label: 'Employee ID #', type: 'text', required: true },
        { key: 'accessGroup', label: 'Access Group / Department', type: 'text', required: false },
      ]);
    } else {
      setCustomFields([
        { key: 'memberId', label: 'Member ID #', type: 'text', required: true },
      ]);
    }
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomFieldSchema = {
      key: `field_${Date.now()}`,
      label: newFieldLabel.trim(),
      type: 'text',
      required: newFieldRequired,
    };
    setCustomFields([...customFields, newField]);
    setNewFieldLabel('');
  };

  const removeCustomField = (key: string) => {
    setCustomFields(customFields.filter((f) => f.key !== key));
  };

  const handleLaunch = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your Organization / School Name.');
      setStep(1);
      return;
    }
    if (!adminEmail.trim()) {
      Alert.alert('Required Field', 'Please enter Administrator Email for account management.');
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const feeNum = Number(membershipFee) || 0;
      const created = await createOrg({
        name: name.trim(),
        category,
        description: description.trim(),
        adminName: adminName.trim() || 'Admin User',
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone.trim(),
        payoutMomoNumber: payoutMomoNumber.trim(),
        payoutMomoNetwork,
        primaryColor: selectedTheme.primary,
        secondaryColor: selectedTheme.secondary,
        accentColor: selectedTheme.accent,
        customFields,
        membershipFee: feeNum,
        feeInterval: feeNum > 0 ? (feeInterval === 'free' ? 'one_time' : feeInterval) : 'free',
        tier: orgTier,
        billingCycle,
        requirePhoto,
        idGenerationMode,
      });

      // Paid plan selected -> Trigger Paystack Checkout
      if (orgTier !== 'starter') {
        const tierPriceGhs = orgTier === 'pro'
          ? (billingCycle === 'monthly' ? 199 : 1800)
          : (billingCycle === 'monthly' ? 1499 : 12000);

        const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
        let authUrl = '';

        try {
          const resp = await fetch(`${apiBase}/api/paystack/pro-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: adminEmail.trim() || 'admin@nascard.app',
              amount: tierPriceGhs,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            authUrl = data.authorizationUrl || '';
          }
        } catch (e) {
          console.warn('Paystack launch init error:', e);
        }

        router.replace({
          pathname: '/org/payment' as any,
          params: {
            authorizationUrl: authUrl,
            orgId: `org_plan_${created.id}`,
            reference: `nascard_${orgTier}_${created.id}_${Date.now()}`,
            memberName: `${created.name} (${orgTier.toUpperCase()} Plan)`,
            memberEmail: adminEmail.trim(),
          },
        });
        return;
      }

      // Free Starter Plan
      Alert.alert(
        '🎉 Organization Launched!',
        `Your Pass Creator Studio is live on Starter Plan!\n\nInvite Code: ${created.inviteCode}\n\nMembers can join using this code or invite link.`,
        [
          {
            text: 'Manage Organization',
            onPress: () => router.replace(`/org/manage/${created.id}` as any),
          },
        ],
      );
    } catch {
      Alert.alert('Launch Error', 'Failed to create organization. Please check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Pass Studio</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step Stepper */}
      <View style={[styles.stepperContainer, { borderBottomColor: colors.border }]}>
        {[
          { num: 1, label: 'Info' },
          { num: 2, label: 'Fields' },
          { num: 3, label: 'Design' },
          { num: 4, label: 'Launch' },
        ].map((s) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <TouchableOpacity
              key={s.num}
              style={styles.stepItem}
              onPress={() => setStep(s.num as any)}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor: done
                      ? '#10B981'
                      : active
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
              >
                <Text style={styles.stepBadgeText}>{done ? '✓' : s.num}</Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: active ? colors.foreground : colors.mutedForeground,
                    fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular',
                  },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: Basic Information */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>1. Organization Profile</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Enter your school, gym, office, or association details.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Organization Category *</Text>
              <View style={styles.catGrid}>
                {[
                  { id: 'school', title: '🎓 High School / University', icon: 'school-outline' },
                  { id: 'gym', title: '🏋️ Fitness Gym / Sports Club', icon: 'barbell-outline' },
                  { id: 'corporate', title: '🏢 Corporate Office Access', icon: 'business-outline' },
                  { id: 'community', title: '✨ Community & Association', icon: 'people-outline' },
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Organization Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                placeholder="e.g. Lincoln High School or Apex Gym"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Admin Name & Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border, marginBottom: 8 }]}
                placeholder="Administrator Full Name"
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

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>MoMo Payout Number (For Member Fees)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                placeholder="024 123 4567"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                value={payoutMomoNumber}
                onChangeText={setPayoutMomoNumber}
              />
            </View>
          </View>
        )}

        {/* STEP 2: Custom Pass Fields & Rules */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>2. Pass Requirements & Custom Fields</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Customize member requirements, selfie photos, and ID number generation rules.
            </Text>

            {/* Passport Selfie Requirement Toggle */}
            <View style={[styles.toggleBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="camera-outline" size={18} color={colors.primary} />
                  <Text style={[styles.label, { color: colors.foreground, marginBottom: 2 }]}>Passport Photo / Selfie Requirement</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 16 }}>
                  {requirePhoto ? 'Members MUST upload a passport selfie for gate check-in verification.' : 'Optional. Members can claim pass without uploading a photo.'}
                </Text>
              </View>
              <Switch
                value={requirePhoto}
                onValueChange={setRequirePhoto}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* ID Number Generation Mode */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Member ID / Pass Number Mode</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'member_provided', label: '👤 Member Provided', desc: 'Member types index # or employee ID' },
                  { id: 'auto_generated', label: '🤖 Auto Generated', desc: 'System assigns e.g. APX-1001' },
                ].map((mode) => (
                  <TouchableOpacity
                    key={mode.id}
                    style={[
                      styles.modeCard,
                      {
                        backgroundColor: idGenerationMode === mode.id ? colors.primary + '18' : colors.card,
                        borderColor: idGenerationMode === mode.id ? colors.primary : colors.border,
                        borderWidth: idGenerationMode === mode.id ? 2 : 1,
                      },
                    ]}
                    onPress={() => setIdGenerationMode(mode.id as any)}
                  >
                    <Text style={[styles.modeTitle, { color: idGenerationMode === mode.id ? colors.primary : colors.foreground }]}>
                      {mode.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{mode.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Configured Fields */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 8 }]}>Pass Data Fields List</Text>
            {customFields.map((f, i) => (
              <View
                key={f.key}
                style={[styles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldRowTitle, { color: colors.foreground }]}>
                    {f.label} {f.required ? '*' : '(Optional)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Type: {f.type.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => removeCustomField(f.key)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Custom Field Form */}
            <View style={[styles.addFieldCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 4 }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>Add Extra Field</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, marginBottom: 10 }]}
                placeholder="e.g. Locker #, Grade, Emergency Phone"
                placeholderTextColor={colors.mutedForeground}
                value={newFieldLabel}
                onChangeText={setNewFieldLabel}
              />
              <TouchableOpacity
                style={[styles.addFieldBtn, { backgroundColor: colors.primary }]}
                onPress={addCustomField}
              >
                <Ionicons name="add" size={18} color={colors.primaryForeground} />
                <Text style={[styles.addFieldBtnText, { color: colors.primaryForeground }]}>Add Field</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Card Design Studio */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>3. Pass Design Studio</Text>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.primary + '18',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.primary + '44',
                }}
                onPress={() => {
                  if (category === 'school') setSelectedTheme(THEME_PRESETS[0]!);
                  else if (category === 'gym') setSelectedTheme(THEME_PRESETS[1]!);
                  else if (category === 'corporate') setSelectedTheme(THEME_PRESETS[2]!);
                  else setSelectedTheme(THEME_PRESETS[3]!);
                  Alert.alert('⚡ AI Design Studio', `Generated matching 3D theme for "${name || 'Your Org'}"!`);
                }}
              >
                <Ionicons name="sparkles" size={14} color={colors.primary} />
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>AI Theme</Text>
              </TouchableOpacity>
            </View>

            {/* Live Card Preview */}
            <View style={[styles.previewCard, { backgroundColor: selectedTheme.primary, overflow: 'hidden' }]}>
              {securityStrip === 'hologram' && (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 8, backgroundColor: '#3B82F6', opacity: 0.8 }} />
              )}
              {securityStrip === 'gold' && (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 8, backgroundColor: '#F59E0B' }} />
              )}

              <View style={styles.previewHeader}>
                <View style={styles.previewOrgBadge}>
                  <Ionicons name="shield-checkmark" size={18} color={selectedTheme.accent} />
                  <Text style={[styles.previewOrgName, { color: '#FFFFFF' }]}>{name || 'Organization Name'}</Text>
                </View>
                <View style={[styles.previewTag, { backgroundColor: selectedTheme.accent }]}>
                  <Text style={styles.previewTagText}>OFFICIAL PASS</Text>
                </View>
              </View>

              <View style={styles.previewBody}>
                {requirePhoto && (
                  <View
                    style={[
                      styles.previewAvatar,
                      photoFrameStyle === 'circle' && { borderRadius: 24 },
                      photoFrameStyle === 'gold_border' && { borderWidth: 2, borderColor: '#F59E0B', borderRadius: 12 },
                      photoFrameStyle === 'square' && { borderRadius: 6 },
                    ]}
                  >
                    <Ionicons name="person" size={24} color="#FFFFFF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewMemberName}>John Doe</Text>
                  <Text style={styles.previewMemberSub}>
                    {idGenerationMode === 'auto_generated' ? 'ID: APX-1001 (Auto)' : 'ID: APX-8820'}
                  </Text>
                </View>
              </View>

              <View style={styles.previewFooter}>
                <Ionicons name="qr-code-outline" size={20} color={selectedTheme.accent} />
                <Text style={[styles.previewFooterText, { color: selectedTheme.accent }]}>Live Gate Check-in QR</Text>
              </View>
            </View>

            {/* Theme Selectors */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 12 }]}>Color Theme Palette</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
              {THEME_PRESETS.map((t) => (
                <TouchableOpacity
                  key={t.name}
                  style={[
                    styles.themeBox,
                    {
                      borderColor: selectedTheme.name === t.name ? colors.primary : colors.border,
                      borderWidth: selectedTheme.name === t.name ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedTheme(t)}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: t.primary }]}>
                    <View style={[styles.themeSwatchDot, { backgroundColor: t.accent }]} />
                  </View>
                  <Text style={[styles.themeName, { color: colors.foreground }]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Security Edge Strip Selector */}
            <Text style={[styles.label, { color: colors.foreground, marginTop: 12 }]}>Security Edge Foil Strip</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { id: 'hologram', label: '🌈 Hologram' },
                { id: 'gold', label: '✨ 24K Gold' },
                { id: 'standard', label: '🛡️ Standard' },
              ].map((strip) => (
                <TouchableOpacity
                  key={strip.id}
                  style={{
                    flex: 1,
                    backgroundColor: securityStrip === strip.id ? colors.primary + '18' : colors.card,
                    borderColor: securityStrip === strip.id ? colors.primary : colors.border,
                    borderWidth: securityStrip === strip.id ? 2 : 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                  }}
                  onPress={() => setSecurityStrip(strip.id as any)}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: securityStrip === strip.id ? colors.primary : colors.foreground }}>
                    {strip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* STEP 4: Summary & Launch */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>4. Pricing & Launch Plan</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Choose your organization capacity tier and billing cycle.
            </Text>

            {/* Billing Cycle Switcher */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Billing Cycle</Text>
              <View style={{ flexDirection: 'row', backgroundColor: colors.card, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: billingCycle === 'monthly' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setBillingCycle('monthly')}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: billingCycle === 'monthly' ? colors.primaryForeground : colors.foreground }}>
                    Monthly Billing
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: billingCycle === 'yearly' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setBillingCycle('yearly')}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: billingCycle === 'yearly' ? colors.primaryForeground : colors.foreground }}>
                    Yearly Billing (Save ~30%)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Org Platform Plan Selector */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Select Organization Platform Plan</Text>
              <View style={{ gap: 10, marginTop: 4 }}>
                {[
                  {
                    id: 'starter',
                    title: 'Starter Plan (Free)',
                    price: 'GH₵ 0 / year',
                    limit: 'Up to 25 active members',
                    desc: 'Free forever. Includes fee collection + MoMo payouts.',
                    badge: 'FREE',
                    badgeColor: '#10B981',
                  },
                  {
                    id: 'pro',
                    title: 'Pro Organization',
                    price: billingCycle === 'monthly' ? 'GH₵ 199 / month' : 'GH₵ 1,800 / year (Save GH₵ 588)',
                    limit: 'Up to 500 active members',
                    desc: 'Higher member quota + custom branding + door scanner app.',
                    badge: 'POPULAR',
                    badgeColor: '#3B82F6',
                  },
                  {
                    id: 'enterprise',
                    title: 'Enterprise Plan',
                    price: billingCycle === 'monthly' ? 'GH₵ 1,499 / month' : 'GH₵ 12,000 / year (Save GH₵ 5,988)',
                    limit: 'Up to 10,000 active members',
                    desc: 'Best for Schools & Universities. Includes Multi-Admin & Priority Support.',
                    badge: 'SCHOOLS',
                    badgeColor: '#8B5CF6',
                  },
                ].map((plan) => {
                  const isSel = orgTier === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.catCard,
                        {
                          backgroundColor: isSel ? colors.primary + '18' : colors.card,
                          borderColor: isSel ? colors.primary : colors.border,
                          borderWidth: isSel ? 2 : 1,
                        },
                      ]}
                      onPress={() => setOrgTier(plan.id as any)}
                    >
                      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.catLabel, { color: colors.foreground, fontSize: 15 }]}>{plan.title}</Text>
                        <View style={{ backgroundColor: plan.badgeColor + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: plan.badgeColor }}>{plan.badge}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{plan.price} · {plan.limit}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{plan.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Member Fee Amount & Interval */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>Member Pass Joining Fee (GH₵ — enter 0 for Free Pass)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="0 for Free, or e.g. 50 for paid pass"
                placeholderTextColor={colors.mutedForeground}
                value={membershipFee}
                onChangeText={(v) => {
                  setMembershipFee(v);
                  setFeeInterval(Number(v) > 0 ? feeInterval || 'one_time' : 'free');
                }}
                keyboardType="numeric"
              />

              {Number(membershipFee) > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.label, { color: colors.foreground, marginBottom: 6 }]}>Member Fee Billing Cycle</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { id: 'one_time', label: '⚡ One-Time Fee' },
                      { id: 'monthly', label: '📅 Monthly Fee' },
                      { id: 'yearly', label: '🗓️ Yearly Fee' },
                    ].map((interval) => (
                      <TouchableOpacity
                        key={interval.id}
                        style={{
                          flex: 1,
                          backgroundColor: feeInterval === interval.id ? colors.primary + '18' : colors.card,
                          borderColor: feeInterval === interval.id ? colors.primary : colors.border,
                          borderWidth: feeInterval === interval.id ? 2 : 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: 'center',
                        }}
                        onPress={() => setFeeInterval(interval.id as any)}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: feeInterval === interval.id ? colors.primary : colors.foreground }}>
                          {interval.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Navigation Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 8 }]}>
        {step > 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, { borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setStep((step - 1) as any)}
          >
            <Ionicons name="arrow-back" size={18} color={colors.foreground} />
            <Text style={[styles.navBtnText, { color: colors.foreground }]}>Back</Text>
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}

        {step < 4 ? (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.primary }]}
            onPress={() => setStep((step + 1) as any)}
          >
            <Text style={[styles.navBtnText, { color: colors.primaryForeground }]}>Next Step</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.primary }]}
            onPress={handleLaunch}
            disabled={isSubmitting}
          >
            <Ionicons name="rocket-outline" size={18} color={colors.primaryForeground} />
            <Text style={[styles.navBtnText, { color: colors.primaryForeground }]}>
              {isSubmitting
                ? 'Launching...'
                : orgTier === 'starter'
                ? 'Launch Free Studio'
                : `Pay & Launch ${orgTier.toUpperCase()}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  stepLabel: { fontSize: 11 },
  content: { padding: 20 },
  stepContainer: { gap: 16 },
  stepTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  stepSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  catGrid: { gap: 10 },
  catCard: {
    padding: 14,
    borderRadius: 12,
    gap: 4,
  },
  catLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  toggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  modeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  fieldRowTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  addFieldCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  addFieldBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  previewCard: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    elevation: 4,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewOrgBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewOrgName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  previewTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  previewTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  previewBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMemberName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  previewMemberSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  previewFooterText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  themeRow: { gap: 12, paddingVertical: 4 },
  themeBox: { padding: 10, borderRadius: 12, alignItems: 'center', gap: 6 },
  themeSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  themeSwatchDot: { width: 14, height: 14, borderRadius: 7 },
  themeName: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  navBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
