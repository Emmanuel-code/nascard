import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';

const FEATURE_PILLARS = [
  {
    icon: 'shield-checkmark',
    title: 'Bank-Grade Vault Security',
    sub: 'Biometric PIN lock, AES-256 encrypted cloud backup & instant restore.',
  },
  {
    icon: 'cube',
    title: 'Unlimited Cards & 3D Holograms',
    sub: 'Store unlimited IDs, loyalty, medical & work passes with 3D flip physics.',
  },
  {
    icon: 'scan',
    title: 'AI Scanner & 60s Security QR',
    sub: 'Instant camera OCR auto-fill & single-tap encrypted verification QR.',
  },
];

interface PlanOption {
  id: 'annual' | 'monthly';
  title: string;
  sub: string;
  amountGhs: number;
  priceDisplay: string;
  period: string;
  badge?: string;
}

const PRO_PLANS: PlanOption[] = [
  {
    id: 'annual',
    title: 'Annual Membership',
    sub: 'Save ~35% vs monthly billing',
    amountGhs: 228,
    priceDisplay: 'GH₵ 228',
    period: '/yr',
    badge: 'BEST VALUE',
  },
  {
    id: 'monthly',
    title: 'Monthly Plan',
    sub: 'Flexible monthly billing',
    amountGhs: 29,
    priceDisplay: 'GH₵ 29',
    period: '/mo',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ProPaywall({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { checkProStatus } = usePro();

  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(PRO_PLANS[0]!);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const handleSubscribe = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
      const userEmail = 'user@nascard.app';

      const resp = await fetch(`${apiBase}/api/paystack/pro-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          amount: selectedPlan.amountGhs,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        onClose();
        router.push({
          pathname: '/org/payment',
          params: {
            authorizationUrl: data.authorizationUrl || '',
            orgId: 'pro_pass',
            reference: data.reference || `nascard_pro_${selectedPlan.id}_${Date.now()}`,
            memberName: `CardVault Pro (${selectedPlan.title})`,
            memberEmail: userEmail,
          },
        } as any);
      } else {
        setMessage({ text: 'Failed to initialize payment gateway. Please try again.', ok: false });
      }
    } catch (e) {
      console.warn('[ProPaywall] Checkout error:', e);
      setMessage({ text: 'Network connection issue. Please check your internet connection.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Haptics.selectionAsync();
      const isProActive = await checkProStatus();
      if (isProActive) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMessage({ text: 'Pro Membership restored successfully!', ok: true });
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setMessage({ text: 'No active Pro subscription found for your account.', ok: false });
      }
    } catch {
      setMessage({ text: 'Restore check failed. Please try again.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Paywall Content */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Crown badge */}
          <View style={[styles.crownBadge, { backgroundColor: colors.primary + '22' }]}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Unlock CardVault Pro</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Join over 50,000+ members organizing all physical cards digitally with bank-grade security.
          </Text>

          {/* Social Trust Badge */}
          <View style={[styles.trustBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[styles.trustText, { color: colors.foreground }]}>
              4.9/5 Rating · Unlimited Cards & Cloud Restore
            </Text>
          </View>

          {/* Billing Tier Switcher */}
          <View style={styles.tierContainer}>
            {PRO_PLANS.map((plan) => {
              const isSelected = selectedPlan.id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPlan(plan);
                  }}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  {plan.badge && (
                    <View style={[styles.saveBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.saveBadgeText}>{plan.badge}</Text>
                    </View>
                  )}

                  <View style={styles.tierRadioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: isSelected ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tierTitle, { color: colors.foreground }]}>{plan.title}</Text>
                      <Text style={[styles.tierSub, { color: colors.mutedForeground }]}>{plan.sub}</Text>
                    </View>

                    <Text style={[styles.tierPrice, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {plan.priceDisplay}
                      <Text style={styles.tierUnit}>{plan.period}</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feature Pillars */}
          <View style={[styles.pillarsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FEATURE_PILLARS.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.pillarRow,
                  i < FEATURE_PILLARS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.pillarIcon, { backgroundColor: colors.primary + '1F' }]}>
                  <Ionicons name={p.icon as any} size={18} color={colors.primary} />
                </View>
                <View style={styles.pillarText}>
                  <Text style={[styles.pillarTitle, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[styles.pillarSub, { color: colors.mutedForeground }]}>{p.sub}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.verified} />
              </View>
            ))}
          </View>

          {/* Error / Info Message */}
          {message && (
            <View
              style={[
                styles.messageBanner,
                {
                  backgroundColor: message.ok ? colors.verified + '22' : colors.expired + '22',
                  borderColor: message.ok ? colors.verified + '55' : colors.expired + '55',
                },
              ]}
            >
              <Ionicons
                name={message.ok ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={message.ok ? colors.verified : colors.expired}
              />
              <Text style={[styles.messageText, { color: message.ok ? colors.verified : colors.expired }]}>
                {message.text}
              </Text>
            </View>
          )}

          {/* Main CTA */}
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={loading}
            style={[styles.cta, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                Subscribe — {selectedPlan.priceDisplay}
                {selectedPlan.period}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestorePurchases} disabled={loading} style={styles.alreadyLink}>
            <Text style={[styles.alreadyText, { color: colors.primary }]}>Already subscribed? Check Status</Text>
          </TouchableOpacity>

          <Text style={[styles.legalNote, { color: colors.mutedForeground }]}>
            Subscriptions auto-renew unless cancelled. Paystack Mobile Money & Card checkout.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  crownBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  crownEmoji: { fontSize: 28 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 20,
  },
  trustText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tierContainer: { gap: 12, marginBottom: 20 },
  tierCard: { padding: 16, borderRadius: 16, position: 'relative' },
  saveBadge: { position: 'absolute', top: -10, right: 16, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  saveBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  tierRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  tierTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tierSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  tierPrice: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  tierUnit: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  pillarsCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  pillarRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pillarIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pillarText: { flex: 1 },
  pillarTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  pillarSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 16 },
  cta: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  alreadyLink: { alignItems: 'center', paddingVertical: 10 },
  alreadyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  legalNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, marginTop: 12 },
  messageBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  messageText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
});
