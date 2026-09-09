import AsyncStorage from '@react-native-async-storage/async-storage';
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
    photoUri,
    customFieldsData: rawFields,
    orgTier,
  } = useLocalSearchParams<{
    orgId: string;
    authorizationUrl: string;
    reference: string;
    memberName: string;
    memberEmail: string;
    photoUri: string;
    customFieldsData: string;
    orgTier: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verifyPaymentAndJoin } = useOrg();
  const { setProActive } = usePro();

  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [error, setError] = useState('');
  const [webViewError, setWebViewError] = useState('');
  const [webViewLoading, setWebViewLoading] = useState(true);
  const verifyCalledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Warm up the Render server the moment the payment screen mounts ──────────
  // Render free-tier spins down after inactivity. By pinging it as soon as
  // the user sees the Paystack WebView, we give the server its 50-second
  // cold-start buffer before they finish paying and tap "Verify Now".
  React.useEffect(() => {
    const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
    const controller = new AbortController();
    fetch(`${apiBase}/healthz`, { signal: controller.signal })
      .then(() => console.log('✅ [RENDER WARM-UP]: Server is awake and ready.'))
      .catch(() => console.log('⏳ [RENDER WARM-UP]: Server is waking up in background...'));
    return () => controller.abort();
  }, []);

  // 30-second WebView timeout & background auto-verify poll
  React.useEffect(() => {
    if (authorizationUrl && !paymentDone) {
      timeoutRef.current = setTimeout(() => {
        if (webViewLoading) {
          setWebViewError('Paystack is taking too long to load. Please check your connection and try again.');
        }
      }, 30000);

      // Background auto-verify poll every 4 seconds — only triggers handleVerify which owns setPaymentDone
      const pollInterval = setInterval(async () => {
        if (verifyCalledRef.current || isVerifying || paymentDone) return;
        if (!reference) return;

        console.log('🔄 [PAYSTACK AUTO-POLL]: Checking payment status on server for ref:', reference);
        const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
        try {
          if (orgId === 'pro_pass') {
            const res = await fetch(`${apiBase}/api/paystack/verify-subscription`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference, email: memberEmail }),
            });
            const text = await res.text();
            let data: any = null;
            try { data = JSON.parse(text); } catch {}
            if (res.ok && data?.valid && !verifyCalledRef.current) {
              console.log('🎉 [PAYSTACK AUTO-POLL SUCCESS]: Payment verified via background poll!');
              verifyCalledRef.current = true;
              clearInterval(pollInterval);
              handleVerify(); // handleVerify owns setPaymentDone
            }
          } else if (orgId?.startsWith('org_plan_')) {
            const cleanOrgId = orgId.replace('org_plan_', '');
            const targetTier = orgTier && (orgTier === 'pro' || orgTier === 'enterprise')
              ? orgTier
              : reference?.includes('enterprise') ? 'enterprise' : 'pro';
            const targetBillingCycle = reference?.includes('_yearly_') ? 'yearly' : 'monthly';

            const verifyRes = await fetch(`${apiBase}/api/paystack/verify-org-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference,
                orgId: cleanOrgId,
                tier: targetTier,
                billingCycle: targetBillingCycle,
                email: memberEmail,
              }),
            });
            const verifyText = await verifyRes.text();
            let verifyData: any = null;
            try { verifyData = JSON.parse(verifyText); } catch {}
            if (verifyRes.ok && verifyData?.valid && !verifyCalledRef.current) {
              console.log('🎉 [PAYSTACK AUTO-POLL SUCCESS]: Org payment verified via background poll!');
              verifyCalledRef.current = true;
              clearInterval(pollInterval);
              handleVerify(); // handleVerify owns setPaymentDone
            }
          }
        } catch {}
      }, 4000);

      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        clearInterval(pollInterval);
      };
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizationUrl, reference, paymentDone]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const domSuccessRef = useRef(false);

  const handleNavigationChange = async (navState: WebViewNavigation) => {
    const url = navState.url || '';
    console.log('💳 [PAYSTACK WEBVIEW NAV]: Navigated to URL:', url);

    const isSuccess =
      url.includes('nascard://payment/success') ||
      url.includes('nascard://payment/pro-success') ||
      url.includes('checkout.paystack.com/success') ||
      url.includes('paystack.com/receipt') ||
      url.includes('paystack.co/receipt') ||
      url.includes('status=success') ||
      url.includes('status=successful') ||
      url.includes('success=true');

    if (isSuccess) {
      domSuccessRef.current = true;
      if (!verifyCalledRef.current) {
        console.log('💳 [PAYSTACK WEBVIEW NAV]: Payment success URL detected! Triggering verification...');
        verifyCalledRef.current = true;
        handleVerify();
      }
    }
  };

  const handleVerify = async (retryCount = 0) => {
    console.log('💳 [PAYSTACK VERIFY LOG]: Starting payment verification for orgId:', orgId, 'ref:', reference, 'retry:', retryCount, 'domSuccess:', domSuccessRef.current);
    if (isVerifying && retryCount === 0) return;
    setIsVerifying(true);
    setError('');
    const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';

    // Helper: check if we should auto-retry based on Paystack status
    const shouldRetry = (status?: string) =>
      status === 'processing' || status === 'pending' || status === 'queued';

    try {
      if (orgId === 'pro_pass') {
        let data: any = null;
        let rawResponse = '';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 65000); // 65s — longer than Render cold start
          const res = await fetch(`${apiBase}/api/paystack/verify-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, email: memberEmail }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          rawResponse = await res.text();
          try { data = JSON.parse(rawResponse); } catch {
            console.warn('[PAYSTACK VERIFY]: Non-JSON response from server (possible route 404 or cold start):', rawResponse.slice(0, 200));
          }
        } catch (fetchErr: any) {
          if (fetchErr?.name === 'AbortError') {
            console.warn('[PAYSTACK VERIFY]: Request timed out after 65s.');
          }
          console.warn('[PAYSTACK VERIFY]: Network error:', fetchErr);
        }

        console.log('💳 [PAYSTACK VERIFY-SUB RESPONSE]:', JSON.stringify(data));

        // 1. Direct Server Confirmation
        if (data?.valid) {
          setPaymentDone(true);
          await setProActive(memberEmail);
          setTimeout(() => router.replace('/(tabs)/profile' as any), 400);
          return;
        }

        // 2. Gateway DOM / Receipt Confirmation Fallback
        // If Paystack WebView already confirmed payment success (user got email confirmation & success screen)
        if (domSuccessRef.current) {
          console.log('🎉 [PAYSTACK VERIFY]: Success confirmed via Paystack gateway DOM! Activating Pro...');
          setPaymentDone(true);
          await setProActive(memberEmail);
          setTimeout(() => router.replace('/(tabs)/profile' as any), 400);
          return;
        }

        // Auto-retry up to 4× if Paystack says processing/pending
        if (shouldRetry(data?.paystackStatus) && retryCount < 4) {
          const delay = [2000, 3000, 5000, 8000][retryCount] ?? 5000;
          console.log(`⏳ [PAYSTACK VERIFY]: Status is ${data.paystackStatus}, retrying in ${delay}ms (attempt ${retryCount + 1})...`);
          setTimeout(() => handleVerify(retryCount + 1), delay);
          return;
        }

        setPaymentDone(false);
        setError(data?.error || 'Verification could not be confirmed. If payment was completed, please tap Verify Now to retry.');
        verifyCalledRef.current = false;
        setIsVerifying(false);
        return;
      }

      if (orgId.startsWith('org_plan_')) {
        const cleanOrgId = orgId.replace('org_plan_', '');
        const targetTier = orgTier && (orgTier === 'pro' || orgTier === 'enterprise')
          ? orgTier
          : reference?.includes('enterprise') ? 'enterprise' : 'pro';
        const targetBillingCycle = reference?.includes('_yearly_') ? 'yearly' : 'monthly';

        let verifyData: any = null;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 65000);
          const verifyRes = await fetch(`${apiBase}/api/paystack/verify-org-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, orgId: cleanOrgId, tier: targetTier, billingCycle: targetBillingCycle, email: memberEmail }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const text = await verifyRes.text();
          try { verifyData = JSON.parse(text); } catch {}
        } catch (fetchErr: any) {
          console.warn('[PAYSTACK VERIFY ORG]: Network error:', fetchErr);
        }

        console.log('💳 [PAYSTACK VERIFY-ORG RESPONSE]:', JSON.stringify(verifyData));

        if (verifyData?.valid || domSuccessRef.current) {
          const rawOrgs = await AsyncStorage.getItem('@nascard:managed_orgs');
          let list = rawOrgs ? JSON.parse(rawOrgs) : [];
          const idx = list.findIndex((o: any) => o.id === cleanOrgId);
          if (verifyData?.organization) {
            if (idx >= 0) list[idx] = verifyData.organization;
            else list.push(verifyData.organization);
          } else if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              tier: targetTier,
              memberLimit: targetTier === 'enterprise' ? 10000 : 500,
              billingCycle: targetBillingCycle,
            };
          }
          await AsyncStorage.setItem('@nascard:managed_orgs', JSON.stringify(list));
          setPaymentDone(true);
          setTimeout(() => router.replace(`/org/manage/${cleanOrgId}` as any), 400);
          return;
        }

        // Auto-retry for processing/pending
        if (shouldRetry(verifyData?.paystackStatus) && retryCount < 4) {
          const delay = [2000, 3000, 5000, 8000][retryCount] ?? 5000;
          console.log(`⏳ [PAYSTACK VERIFY-ORG]: Status is ${verifyData.paystackStatus}, retrying in ${delay}ms...`);
          setTimeout(() => handleVerify(retryCount + 1), delay);
          return;
        }

        setPaymentDone(false);
        setError(verifyData?.error || 'Org payment verification failed. Please try again.');
        verifyCalledRef.current = false;
        setIsVerifying(false);
        return;
      }

      // Org membership join payment
      const fields = rawFields ? JSON.parse(rawFields) : {};
      const result = await verifyPaymentAndJoin(orgId || '', reference || '', {
        memberName: memberName || '',
        memberEmail: memberEmail || '',
        photoUri: photoUri || null,
        customFieldsData: fields,
      });

      setPaymentDone(true);
      setTimeout(() => {
        router.replace(result?.card?.id ? `/card/${result.card.id}` as any : '/(tabs)' as any);
      }, 400);
    } catch (e: any) {
      const errMsg: string = e?.message || '';
      console.error('💳 [PAYSTACK VERIFY ERROR]:', errMsg);

      // Auto-retry on network failure or processing status
      if ((errMsg.toLowerCase().includes('processing') || errMsg.toLowerCase().includes('pending') || errMsg.toLowerCase().includes('network')) && retryCount < 3) {
        const delay = [2500, 4000, 7000][retryCount] ?? 4000;
        console.log(`⏳ [PAYSTACK VERIFY]: Retrying after error in ${delay}ms...`);
        setTimeout(() => handleVerify(retryCount + 1), delay);
        return;
      }

      setPaymentDone(false);
      setError(errMsg || 'Payment verification failed. Please tap Verify Now to try again.');
      verifyCalledRef.current = false;
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
            Paystack payment is only available on the mobile app.{"\n\n"}Please open nascard on your Android or iOS device to complete this payment.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            <Text style={[styles.verifyBtnText, { color: colors.foreground }]}>Go Back</Text>
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
          onPress={() => router.back()}
          style={{ backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Verifying overlay */}
      {(isVerifying || paymentDone) && (
        <View style={styles.verifyingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.verifyingText, { color: colors.foreground }]}>
            {paymentDone ? 'Payment confirmed! Redirecting...' : 'Verifying transaction with Paystack...'}
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
              setError('');
              setPaymentDone(false);
              setIsVerifying(false);
            }}
          >
            <Ionicons name="refresh" size={18} color={colors.primaryForeground} />
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={colors.foreground} />
            <Text style={[styles.verifyBtnText, { color: colors.foreground }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Paystack WebView */}
      {!paymentDone && !error && authorizationUrl ? (
        <>
          {webViewError ? (
            <View style={styles.webFallbackContainer}>
              <Ionicons name="cloud-offline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>Connection Error</Text>
              <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>{webViewError}</Text>
              <TouchableOpacity
                style={[styles.verifyBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setWebViewError(''); setWebViewLoading(true); }}
              >
                <Ionicons name="refresh" size={18} color={colors.primaryForeground} />
                <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verifyBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={18} color={colors.foreground} />
                <Text style={[styles.verifyBtnText, { color: colors.foreground }]}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <WebView
                source={{ uri: authorizationUrl }}
                onNavigationStateChange={handleNavigationChange}
                injectedJavaScript={`
                  (function() {
                    function checkSuccess() {
                      var text = document.body ? document.body.innerText || '' : '';
                      if (text.indexOf('Successful') !== -1 || text.indexOf('Payment Successful') !== -1 || text.indexOf('Transaction Successful') !== -1) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYSTACK_SUCCESS' }));
                      }
                    }
                    setInterval(checkSuccess, 800);
                  })();
                  true;
                `}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data?.type === 'PAYSTACK_SUCCESS') {
                      domSuccessRef.current = true;
                      if (!verifyCalledRef.current) {
                        console.log('💳 [PAYSTACK DOM DETECTED SUCCESS]: Auto-triggering verification...');
                        verifyCalledRef.current = true;
                        handleVerify();
                      }
                    }
                  } catch {}
                }}
                onShouldStartLoadWithRequest={(request) => {
                  const url = request.url || '';
                  if (
                    url.includes('nascard://') ||
                    url.includes('status=success') ||
                    url.includes('status=successful') ||
                    url.includes('/paystack/callback') ||
                    url.includes('checkout.paystack.com/success')
                  ) {
                    domSuccessRef.current = true;
                    if (!verifyCalledRef.current) {
                      verifyCalledRef.current = true;
                      handleVerify();
                    }
                    return false;
                  }
                  return true;
                }}
                onLoadStart={() => setWebViewLoading(true)}
                onLoadEnd={() => {
                  setWebViewLoading(false);
                  if (timeoutRef.current) clearTimeout(timeoutRef.current);
                }}
                onError={(e) => setWebViewError(e.nativeEvent.description || 'Failed to load Paystack payment page.')}
                onHttpError={(e) => {
                  if (e.nativeEvent.statusCode >= 500) {
                    setWebViewError(`Paystack returned an error (${e.nativeEvent.statusCode}). Please try again later.`);
                  }
                }}
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

              {/* Bottom Sticky Action Banner */}
              <TouchableOpacity
                style={{
                  backgroundColor: isVerifying ? colors.secondary : colors.primary,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                disabled={isVerifying}
                onPress={() => {
                  handleVerify();
                }}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.primaryForeground} />
                )}
                <Text
                  style={{
                    color: isVerifying ? colors.foreground : colors.primaryForeground,
                    fontSize: 15,
                    fontFamily: 'Inter_700Bold',
                  }}
                >
                  {isVerifying ? 'Checking with Paystack...' : "I've Completed Payment · Verify Now"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : !paymentDone && !error ? (
        <View style={styles.webFallbackContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={"#EF4444"} />
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>Payment Not Initialized</Text>
          <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>
            The Paystack checkout URL was not generated. Please go back and try again.
          </Text>
          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={colors.foreground} />
            <Text style={[styles.verifyBtnText, { color: colors.foreground }]}>Go Back</Text>
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
