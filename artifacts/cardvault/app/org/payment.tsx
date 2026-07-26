import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrg } from '@/contexts/OrgContext';
import { usePro } from '@/contexts/ProContext';
import { useColors } from '@/hooks/useColors';

export default function PaymentScreen() {
  const {
    orgId,
    authorizationUrl,
    reference,
    memberName,
    memberEmail,
    customFieldsData: rawFields,
  } = useLocalSearchParams<{
    orgId: string;
    authorizationUrl: string;
    reference: string;
    memberName: string;
    memberEmail: string;
    customFieldsData: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verifyPaymentAndJoin } = useOrg();
  const { setProActive } = usePro();

  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [error, setError] = useState('');
  const verifyCalledRef = useRef(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleNavigationChange = async (navState: WebViewNavigation) => {
    const url = navState.url || '';
    console.log('💳 [PAYSTACK WEBVIEW NAV]: Navigated to URL:', url);

    const isSuccess =
      url.includes('nascard://') ||
      url.includes('payment/success') ||
      url.includes('pro-success') ||
      url.includes('checkout.paystack.com/success') ||
      url.includes('paystack.co/close') ||
      url.includes('paystack.com/close') ||
      url.includes('status=success') ||
      url.includes('status=successful') ||
      url.includes('success=true') ||
      url.includes('trxref=') ||
      url.includes('reference=');

    if (isSuccess && !verifyCalledRef.current) {
      console.log('💳 [PAYSTACK WEBVIEW NAV]: Payment success URL detected! Triggering verification...');
      verifyCalledRef.current = true;
      setPaymentDone(true);
      await handleVerify();
    }
  };

  const handleVerify = async () => {
    console.log('💳 [PAYSTACK VERIFY LOG]: Starting payment verification for orgId:', orgId, 'ref:', reference);
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      if (orgId === 'pro_pass') {
        console.log('💳 [PAYSTACK VERIFY LOG]: Activating Consumer Pro Pass locally & in storage...');
        await setProActive();
        router.replace('/(tabs)/profile' as any);
        return;
      }

      if (orgId.startsWith('org_plan_')) {
        const cleanOrgId = orgId.replace('org_plan_', '');
        const targetTier = reference?.includes('enterprise') ? 'enterprise' : reference?.includes('pro') ? 'pro' : '';
        console.log('💳 [PAYSTACK VERIFY LOG]: Org Plan Activated via Paystack Payment! Org ID:', cleanOrgId, 'Target Tier:', targetTier);
        
        const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';

        // 1. Upgrade server tier
        if (targetTier) {
          try {
            await fetch(`${apiBase}/api/organizations/${cleanOrgId}/upgrade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tier: targetTier }),
            });
          } catch {}
        }

        // 2. Fetch fresh org details & register/update in managedOrgs
        const rawOrgs = await AsyncStorage.getItem('@nascard:managed_orgs');
        let list = rawOrgs ? JSON.parse(rawOrgs) : [];
        try {
          const resp = await fetch(`${apiBase}/api/organizations/${cleanOrgId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.organization) {
              const idx = list.findIndex((o: any) => o.id === cleanOrgId);
              if (idx >= 0) {
                list[idx] = data.organization;
              } else {
                list.push(data.organization);
              }
              await AsyncStorage.setItem('@nascard:managed_orgs', JSON.stringify(list));
            }
          }
        } catch {}

        router.replace(`/org/manage/${cleanOrgId}` as any);
        return;
      }

      const fields = rawFields ? JSON.parse(rawFields) : {};
      const result = await verifyPaymentAndJoin(orgId || '', reference || '', {
        memberName: memberName || '',
        memberEmail: memberEmail || '',
        customFieldsData: fields,
      });

      console.log('💳 [PAYSTACK VERIFY LOG]: Member pass issued successfully, card ID:', result.card.id);
      router.replace(`/card/${result.card.id}` as any);
    } catch (e: any) {
      console.error('💳 [PAYSTACK VERIFY ERROR]:', e);
      setError(e?.message || 'Payment verification failed. Please contact support.');
      verifyCalledRef.current = false;
    } finally {
      setIsVerifying(false);
    }
  };

  // Web platform fallback (no WebView available)
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.foreground }]}>Complete Payment</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.webFallbackContainer}>
          <Ionicons name="card" size={48} color={colors.primary} />
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>Paystack Checkout</Text>
          <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>
            On mobile, you'll see the full Paystack payment form here.
            {'\n\n'}For web testing, tap "Simulate Payment" below.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
            onPress={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.primaryForeground} />
                <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
                  Simulate Successful Payment
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Paystack Checkout</Text>
        <TouchableOpacity
          onPress={handleVerify}
          style={{
            backgroundColor: colors.primary + '18',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.primary + '44',
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>Done ✓</Text>
        </TouchableOpacity>
      </View>

      {/* Verifying overlay */}
      {(isVerifying || paymentDone) && (
        <View style={styles.verifyingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.verifyingText, { color: colors.foreground }]}>
            {isVerifying ? 'Verifying payment & issuing pass...' : 'Payment complete!'}
          </Text>
        </View>
      )}

      {/* Error state */}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={32} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              verifyCalledRef.current = false;
              handleVerify();
            }}
          >
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>Retry Verification</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Paystack WebView */}
      {!paymentDone && !error && authorizationUrl ? (
        <WebView
          source={{ uri: authorizationUrl }}
          onNavigationStateChange={handleNavigationChange}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Loading Paystack Mobile Money & Card Gateway...
              </Text>
            </View>
          )}
          style={{ flex: 1 }}
        />
      ) : !paymentDone && !error ? (
        <View style={styles.webFallbackContainer}>
          <Ionicons name="card" size={48} color={colors.primary} />
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>Paystack Payment Gateway</Text>
          <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>
            Initializing Paystack Mobile Money (MTN / Telecel / AT) & Bank Card checkout...
          </Text>
          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
            onPress={handleVerify}
            disabled={isVerifying}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.primaryForeground} />
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
              {isVerifying ? 'Verifying Payment...' : 'Confirm & Complete Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  topTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  webFallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  webFallbackTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  webFallbackSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  verifyBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  verifyingText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorText: { fontSize: 13, color: '#EF4444', fontFamily: 'Inter_500Medium', textAlign: 'center' },
  webviewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
