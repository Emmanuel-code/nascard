import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';

const PRO_FEATURES = [
  { icon: 'infinite', label: 'Unlimited cards', sub: 'Free plan: up to 5' },
  { icon: 'shield-checkmark', label: 'AES-256 encrypted backup', sub: 'Secure cloud restore' },
  { icon: 'finger-print', label: 'Biometric / PIN lock', sub: 'Keep cards private' },
  { icon: 'cube', label: '3D Wallet', label2: 'Holographic flip cards' },
  { icon: 'location', label: 'Location-aware suggestions', sub: 'Right card, right place' },
  { icon: 'notifications', label: 'Expiry notifications', sub: 'Never miss a renewal' },
  { icon: 'qr-code', label: '60-second verification QR', sub: 'Tap to generate' },
  { icon: 'scan', label: 'Live barcode scanner', sub: 'Scan & import instantly' },
  { icon: 'eye', label: 'OCR auto-fill', sub: 'GPT-4o Vision powered' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ProPaywall({ visible, onClose }: Props) {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkProStatus, setProActive, getCheckoutUrl } = usePro();
  const [step, setStep] = useState<'paywall' | 'verify'>('paywall');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const topPad = Platform.OS === 'web' ? 0 : insets.top;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const url = await getCheckoutUrl();
      onClose();
      router.push({
        pathname: '/org/payment',
        params: {
          authorizationUrl: url,
          orgId: 'pro_pass',
          reference: `nascard_pro_${Date.now()}`,
          memberName: 'Pro User',
          memberEmail: 'pro@nascard.app',
        },
      } as any);
    } catch {
      setMessage({ text: 'Could not initialize Paystack checkout. Please try again.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await setProActive();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage({ text: "🎉 You're now Pro! Unlimited cards & features unlocked.", ok: true });
      setTimeout(onClose, 1800);
    } catch {
      setMessage({ text: 'Verification failed. Please try again.', ok: false });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('paywall');
    setEmail('');
    setMessage(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          {step === 'verify' && (
            <TouchableOpacity onPress={() => setStep('paywall')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            </TouchableOpacity>
          )}
        </View>

        {step === 'paywall' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Crown badge */}
            <View style={[styles.crownBadge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={styles.crownEmoji}>👑</Text>
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>Upgrade to nascard Pro</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Everything you need to manage, protect, and access all your cards.
            </Text>

            {/* Price pill */}
            <View style={[styles.pricePill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.priceAmount, { color: colors.primaryForeground }]}>GH₵ 29</Text>
              <Text style={[styles.pricePer, { color: colors.primaryForeground + 'CC' }]}> / month</Text>
            </View>

            {/* Features */}
            <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {PRO_FEATURES.map((f, i) => (
                <View
                  key={i}
                  style={[
                    styles.featureRow,
                    i < PRO_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={[styles.featureIcon, { backgroundColor: colors.primary + '1A' }]}>
                    <Ionicons name={f.icon as any} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
                    {(f.sub || f.label2) && (
                      <Text style={[styles.featureSub, { color: colors.mutedForeground }]}>{f.sub ?? f.label2}</Text>
                    )}
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color={colors.verified} />
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSubscribe}
              disabled={loading}
              style={[styles.cta, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Subscribe — GH₵ 29/mo (MoMo & Card)</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('verify')} style={styles.alreadyLink}>
              <Text style={[styles.alreadyText, { color: colors.primary }]}>Already paid? Activate Pro here</Text>
            </TouchableOpacity>

            <Text style={[styles.legalNote, { color: colors.mutedForeground }]}>
              Cancel anytime. Billed monthly via Paystack Mobile Money & Bank Cards.
            </Text>
          </ScrollView>
        ) : (
          <View style={styles.verifyPane}>
            <View style={[styles.crownBadge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={styles.crownEmoji}>✅</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Verify Your Subscription</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Enter the email you used when subscribing on Whop.
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.emailInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            />

            {message && (
              <View style={[styles.messageBanner, { backgroundColor: message.ok ? colors.verified + '22' : colors.expired + '22', borderColor: message.ok ? colors.verified + '55' : colors.expired + '55' }]}>
                <Ionicons name={message.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={message.ok ? colors.verified : colors.expired} />
                <Text style={[styles.messageText, { color: message.ok ? colors.verified : colors.expired }]}>{message.text}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading}
              style={[styles.cta, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Verify Subscription</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSubscribe} style={styles.alreadyLink}>
              <Text style={[styles.alreadyText, { color: colors.mutedForeground }]}>
                Not subscribed yet? Subscribe now →
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 16, top: 0 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  crownBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  crownEmoji: { fontSize: 30 },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  pricePill: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, alignSelf: 'center', marginBottom: 24 },
  priceAmount: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  pricePer: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  featureCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  featureSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  cta: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  alreadyLink: { alignItems: 'center', paddingVertical: 10 },
  alreadyText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  legalNote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, marginTop: 16 },
  verifyPane: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  emailInput: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: 'Inter_400Regular', marginTop: 20, marginBottom: 16 },
  messageBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  messageText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
});
