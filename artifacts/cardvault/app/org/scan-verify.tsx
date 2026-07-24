import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

export default function StaffScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verifyMemberQR } = useOrg();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Result Modal
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    reason?: string;
    message?: string;
    member?: any;
    organization?: any;
    verifiedAt?: string;
  } | null>(null);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isVerifying) return;
    setScanned(true);
    setIsVerifying(true);
    try {
      const res = await verifyMemberQR(data);
      setVerificationResult(res);
    } catch (e) {
      setVerificationResult({
        valid: false,
        reason: 'ERROR',
        message: 'Verification request failed.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualVerify = async () => {
    if (!manualCode.trim() || isVerifying) return;
    setIsVerifying(true);
    try {
      const res = await verifyMemberQR(manualCode.trim());
      setVerificationResult(res);
    } catch (e) {
      setVerificationResult({
        valid: false,
        reason: 'ERROR',
        message: 'Verification request failed.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetScan = () => {
    setVerificationResult(null);
    setScanned(false);
    setManualCode('');
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: '#000000' }]}>
      {/* Camera View */}
      {Platform.OS !== 'web' && permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.webFallback]}>
          <Ionicons name="qr-code-outline" size={64} color="#64748B" />
          <Text style={styles.webFallbackText}>Camera Scanner Active</Text>
          <Text style={styles.webFallbackSub}>
            Scan member QR code or test using manual code entry below.
          </Text>
        </View>
      )}

      {/* Top Header Overlay */}
      <View style={[styles.headerOverlay, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close-circle" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Staff Check-in Scanner</Text>
          <Text style={styles.headerSub}>Hold camera over member dynamic QR code</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Scanner Frame Viewfinder */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.viewfinderFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      {/* Manual Input Footer */}
      <View style={[styles.footerOverlay, { paddingBottom: insets.bottom + 20 }]}>
        {!permission?.granted && Platform.OS !== 'web' ? (
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color="#000000" />
            <Text style={styles.permBtnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Or type Member Code / Token..."
            placeholderTextColor="#94A3B8"
            value={manualCode}
            onChangeText={setManualCode}
          />
          <TouchableOpacity style={styles.verifyBtn} onPress={handleManualVerify} disabled={isVerifying}>
            <Text style={styles.verifyBtnText}>{isVerifying ? 'Checking...' : 'Verify'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Verification Result Modal */}
      <Modal visible={!!verificationResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: verificationResult?.valid ? '#064E3B' : '#7F1D1D',
              },
            ]}
          >
            <View style={styles.resultHeader}>
              <Ionicons
                name={verificationResult?.valid ? 'checkmark-circle' : 'close-circle'}
                size={64}
                color="#FFFFFF"
              />
              <Text style={styles.resultStatusText}>
                {verificationResult?.valid ? 'VALID MEMBER PASS' : 'ACCESS DENIED'}
              </Text>
              <Text style={styles.resultMessage}>{verificationResult?.message}</Text>
            </View>

            {verificationResult?.member && (
              <View style={styles.resultMemberDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Member Name:</Text>
                  <Text style={styles.detailVal}>{verificationResult.member.memberName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Organization:</Text>
                  <Text style={styles.detailVal}>{verificationResult.organization?.name || 'Partner Pass'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={[styles.detailVal, { color: verificationResult.valid ? '#10B981' : '#EF4444', fontFamily: 'Inter_700Bold' }]}>
                    {(verificationResult.member.status || 'active').toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.nextScanBtn} onPress={handleResetScan}>
              <Text style={styles.nextScanBtnText}>Scan Next Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', gap: 12, padding: 24 },
  webFallbackText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  webFallbackSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94A3B8', textAlign: 'center' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  closeBtn: { padding: 4 },
  headerTitleBox: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  viewfinderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinderFrame: { width: 240, height: 240, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#38BDF8' },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  footerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 12, zIndex: 10 },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    backgroundColor: '#38BDF8',
    borderRadius: 12,
  },
  permBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000000' },
  manualRow: { flexDirection: 'row', gap: 10 },
  manualInput: {
    flex: 1,
    height: 46,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#334155',
  },
  verifyBtn: { paddingHorizontal: 20, height: 46, backgroundColor: '#38BDF8', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifyBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#0F172A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultCard: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 24, alignItems: 'center', gap: 18 },
  resultHeader: { alignItems: 'center', gap: 8 },
  resultStatusText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 0.5 },
  resultMessage: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  resultMemberDetails: { width: '100%', backgroundColor: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 14, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  detailVal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  nextScanBtn: { width: '100%', height: 48, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextScanBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#0F172A' },
});
