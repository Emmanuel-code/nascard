import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';

type VerificationResult = {
  valid: boolean;
  reason?: string;
  message?: string;
  member?: any;
  organization?: any;
  verifiedAt?: string;
};

export default function StaffScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verifyMemberQR } = useOrg();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Animations
  const laserAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loopLaser = () => {
      Animated.sequence([
        Animated.timing(laserAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(laserAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start(loopLaser);
    };
    loopLaser();
  }, [laserAnim]);

  useEffect(() => {
    if (verificationResult) {
      Animated.parallel([
        Animated.spring(resultScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(resultOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      if (verificationResult.valid) {
        const pulseCycle = () => {
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]).start(pulseCycle);
        };
        pulseCycle();
      }
    } else {
      resultScale.setValue(0.8);
      resultOpacity.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [verificationResult]);

  const performVerify = async (token: string) => {
    setIsVerifying(true);
    try {
      const res = await verifyMemberQR(token);
      setVerificationResult(res);
      await Haptics.notificationAsync(
        res?.valid ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerificationResult({ valid: false, reason: 'ERROR', message: 'Verification failed. Check connection.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isVerifying) return;
    setScanned(true);
    await performVerify(data);
  };

  const handleManualVerify = async () => {
    if (!manualCode.trim() || isVerifying) return;
    await performVerify(manualCode.trim());
  };

  const handleResetScan = () => {
    setVerificationResult(null);
    setScanned(false);
    setManualCode('');
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isValid = verificationResult?.valid;
  const accentColor = isValid ? '#10B981' : '#EF4444';
  const bgTop = isValid ? '#022c22' : '#450a0a';
  const bgBot = isValid ? '#064E3B' : '#7F1D1D';
  const member = verificationResult?.member;
  const org = verificationResult?.organization;
  const verifiedTime = verificationResult?.verifiedAt
    ? new Date(verificationResult.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const laserTranslate = laserAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 216] });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Camera / Fallback */}
      {Platform.OS !== 'web' && permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.webFallback]}>
          <Ionicons name="scan-outline" size={72} color="#1E3A5F" />
          <Text style={styles.webFallbackText}>Gate Scanner Ready</Text>
          <Text style={styles.webFallbackSub}>Point camera at member's dynamic QR code{`\n`}or enter code manually below.</Text>
        </View>
      )}

      {/* Dark gradient vignettes */}
      <LinearGradient colors={['rgba(0,0,0,0.75)', 'transparent']} style={styles.topVignette} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.bottomVignette} pointerEvents="none" />

      {/* Header */}
      <View style={[styles.headerOverlay, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={12}>
          <Ionicons name="chevron-back-circle" size={34} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#38BDF8" />
            <Text style={styles.headerBadgeText}>STAFF CHECK-IN</Text>
          </View>
          <Text style={styles.headerTitle}>Gate Scanner</Text>
        </View>
        <View style={{ width: 34 }} />
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinderFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          {!scanned && (
            <Animated.View style={[styles.laserLine, { transform: [{ translateY: laserTranslate }] }]} />
          )}
          {isVerifying && (
            <View style={styles.verifyingOverlay}>
              <Ionicons name="sync" size={28} color="#38BDF8" />
              <Text style={styles.verifyingText}>Verifying…</Text>
            </View>
          )}
        </View>
        <Text style={styles.viewfinderHint}>
          {isVerifying ? 'Checking member credentials…' : 'Align QR code within frame'}
        </Text>
      </View>

      {/* Footer Manual Entry */}
      <View style={[styles.footerOverlay, { paddingBottom: insets.bottom + 16 }]}>
        {!permission?.granted && Platform.OS !== 'web' ? (
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Ionicons name="camera" size={18} color="#000000" />
            <Text style={styles.permBtnText}>Allow Camera Access</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Or enter Member Code / Token…"
            placeholderTextColor="#64748B"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleManualVerify}
          />
          <TouchableOpacity
            style={[styles.verifyBtn, isVerifying && { opacity: 0.6 }]}
            onPress={handleManualVerify}
            disabled={isVerifying}
          >
            <Ionicons name="checkmark" size={20} color="#0F172A" />
            <Text style={styles.verifyBtnText}>{isVerifying ? '…' : 'GO'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Verification Result Modal */}
      <Modal visible={!!verificationResult} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View style={{ transform: [{ scale: resultScale }], opacity: resultOpacity, width: '100%', maxWidth: 400 }}>
            <LinearGradient colors={[bgTop, bgBot]} style={styles.resultCard} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }}>
              {/* Result header */}
              <View style={styles.resultHeader}>
                <Animated.View style={[styles.iconRing, { borderColor: accentColor, transform: [{ scale: pulseAnim }] }]}>
                  <Ionicons name={isValid ? 'checkmark-circle' : 'close-circle'} size={52} color={accentColor} />
                </Animated.View>
                <Text style={[styles.resultStatusText, { color: accentColor }]}>
                  {isValid ? '✅  ACCESS GRANTED' : '🚫  ACCESS DENIED'}
                </Text>
                {verificationResult?.message ? (
                  <Text style={styles.resultMessage}>{verificationResult.message}</Text>
                ) : null}
              </View>

              {/* Member card */}
              {member && (
                <View style={styles.memberCard}>
                  <View style={styles.memberPhotoRow}>
                    {member.photoUri ? (
                      <Image
                        source={{ uri: member.photoUri }}
                        style={[styles.memberPhoto, { borderColor: accentColor }]}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.memberPhotoPlaceholder, { borderColor: accentColor }]}>
                        <Ionicons name="person" size={28} color={accentColor} />
                      </View>
                    )}
                    <View style={styles.memberNameBlock}>
                      <Text style={styles.memberName}>{member.memberName}</Text>
                      {org?.name ? <Text style={styles.memberOrg}>{org.name}</Text> : null}
                      <View style={[styles.statusPill, { backgroundColor: isValid ? '#10B981' : '#EF4444' }]}>
                        <Text style={styles.statusPillText}>{(member.status || 'ACTIVE').toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: `${accentColor}30` }]} />

                  {member.customFieldsData && Object.keys(member.customFieldsData).length > 0 && (
                    <View style={styles.fieldsGrid}>
                      {Object.entries(member.customFieldsData).map(([k, v]) => (
                        <View key={k} style={styles.fieldItem}>
                          <Text style={styles.fieldLabel}>{k}</Text>
                          <Text style={styles.fieldVal}>{String(v)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.timestampRow}>
                    <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.timestampText}>Verified at {verifiedTime}</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.nextScanBtn} onPress={handleResetScan}>
                <Ionicons name="scan" size={18} color="#0F172A" />
                <Text style={styles.nextScanBtnText}>Scan Next Member</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  webFallback: { alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: '#020817', gap: 14, padding: 24 },
  webFallbackText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#CBD5E1' },
  webFallbackSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#475569', textAlign: 'center', lineHeight: 22 },
  topVignette: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  bottomVignette: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, zIndex: 2 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 },
  closeBtn: { padding: 2 },
  headerTitleBox: { alignItems: 'center', gap: 3 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(56,189,248,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  headerBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#38BDF8', letterSpacing: 1.5 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  viewfinderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 5, gap: 20 },
  viewfinderFrame: { width: 240, height: 240, position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#38BDF8' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  laserLine: { position: 'absolute', left: 4, right: 4, height: 2, backgroundColor: '#38BDF8', borderRadius: 2, shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  verifyingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', gap: 8 },
  verifyingText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#38BDF8' },
  viewfinderHint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  footerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 10, zIndex: 10 },
  permBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, backgroundColor: '#38BDF8', borderRadius: 12 },
  permBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000000' },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: { flex: 1, height: 50, backgroundColor: 'rgba(15,23,42,0.9)', borderRadius: 14, paddingHorizontal: 16, color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: '#1E3A5F' },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 18, height: 50, backgroundColor: '#38BDF8', borderRadius: 14, justifyContent: 'center' },
  verifyBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#0F172A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultCard: { width: '100%', borderRadius: 28, padding: 24, gap: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  resultHeader: { alignItems: 'center', gap: 12 },
  iconRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  resultStatusText: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  resultMessage: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  memberCard: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  memberPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  memberPhoto: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5 },
  memberPhotoPlaceholder: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  memberNameBlock: { flex: 1, gap: 4 },
  memberName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  memberOrg: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.6)' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 2 },
  statusPillText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 1 },
  divider: { height: 1, borderRadius: 1 },
  fieldsGrid: { gap: 8 },
  fieldItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.55)', flex: 1 },
  fieldVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFFFFF', flex: 1, textAlign: 'right' },
  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  timestampText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.4)' },
  nextScanBtn: { flexDirection: 'row', height: 52, backgroundColor: '#FFFFFF', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextScanBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#0F172A' },
});
