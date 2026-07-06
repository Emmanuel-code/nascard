import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export interface BarcodeResult {
  value: string;
  type: string;
}

export function mapBarcodeType(type: string): 'qr' | 'code128' | 'code39' {
  if (type === 'qr') return 'qr';
  if (type === 'code128') return 'code128';
  if (type === 'code39') return 'code39';
  return 'qr';
}

type Permission = 'unknown' | 'granted' | 'denied';

interface Props {
  onScanned: (result: BarcodeResult) => void;
  onClose: () => void;
}

// Lazy-loaded inner camera — defined outside component so React doesn't re-create it
let CameraViewComponent: React.ComponentType<any> | null = null;

export function BarcodeScanner({ onScanned, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<Permission>('unknown');
  const [cameraReady, setCameraReady] = useState(false);
  const [scanned, setScanned] = useState(false);
  const scanLine = useRef(new Animated.Value(0)).current;

  // Request permission + load camera module
  useEffect(() => {
    if (Platform.OS === 'web') { setPermission('denied'); return; }
    (async () => {
      const cam = await import('expo-camera');
      // expo-camera v17: requestCameraPermissionsAsync is a static method on Camera
      const result = await (cam as any).Camera.requestCameraPermissionsAsync();
      if (result?.granted) {
        CameraViewComponent = cam.CameraView;
        setCameraReady(true);
        setPermission('granted');
      } else {
        setPermission('denied');
      }
    })();
  }, []);

  // Scan-line animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLine]);

  const handleBarcode = useCallback(
    async ({ data, type }: { data: string; type: string }) => {
      if (scanned) return;
      setScanned(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onScanned({ value: data, type });
    },
    [scanned, onScanned],
  );

  // ── Web / permission denied fallback ──────────────────────────────────────
  if (Platform.OS === 'web' || permission === 'denied') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={onClose} style={[styles.topClose, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.fallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons
            name={Platform.OS === 'web' ? 'barcode-outline' : 'camera-outline'}
            size={48}
            color={colors.mutedForeground}
          />
          <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
            {Platform.OS === 'web' ? 'Barcode scanning' : 'Camera access needed'}
          </Text>
          <Text style={[styles.fallbackSub, { color: colors.mutedForeground }]}>
            {Platform.OS === 'web'
              ? 'Live scanning is only available on iOS and Android. Enter the barcode number manually.'
              : 'Enable camera access in Settings → CardVault to scan barcodes.'}
          </Text>
          <TouchableOpacity onPress={onClose} style={[styles.fallbackBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.fallbackBtnText, { color: colors.primaryForeground }]}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!cameraReady || !CameraViewComponent) {
    return <View style={[styles.root, { backgroundColor: '#000' }]} />;
  }

  const CV = CameraViewComponent;
  const BOX = 260;
  const lineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, BOX - 3] });

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <CV
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcode}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr', 'code128', 'code39', 'ean13', 'ean8',
            'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix',
          ],
        }}
      />

      {/* ── Overlay ── */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.overlayBar, { paddingTop: insets.top + 8, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <TouchableOpacity onPress={onClose} style={styles.overlayClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan barcode</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Middle row: dim | scan box | dim */}
        <View style={styles.middle}>
          <View style={styles.dimSliver} />
          <View style={styles.scanRow}>
            <View style={styles.dimSliver} />
            <View style={[styles.scanBox, { width: BOX, height: BOX }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.corner, styles[c]]} />
              ))}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: lineY }] }]} />
            </View>
            <View style={styles.dimSliver} />
          </View>
          <View style={styles.dimSliver} />
        </View>

        {/* Bottom bar */}
        <View style={[styles.overlayBar, styles.bottomBar, { paddingBottom: insets.bottom + 24, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Text style={styles.hint}>Point at any barcode — QR, Code128, EAN, and more</Text>
          {scanned && (
            <TouchableOpacity onPress={() => setScanned(false)} style={styles.rescanBtn}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.rescanText}>Scan again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const CW = 22;
const CT = 3;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  topClose: { position: 'absolute', left: 16, zIndex: 10, padding: 8 },
  fallback: {
    margin: 32,
    marginTop: 100,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 14,
  },
  fallbackTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  fallbackSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 21 },
  fallbackBtn: { marginTop: 4, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  fallbackBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  overlayClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  overlayTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  middle: { flex: 1, flexDirection: 'column' },
  dimSliver: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanRow: { flexDirection: 'row' },
  scanBox: { position: 'relative', overflow: 'hidden' },
  corner: { position: 'absolute', width: CW, height: CW, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: CT, borderLeftWidth: CT },
  tr: { top: 0, right: 0, borderTopWidth: CT, borderRightWidth: CT },
  bl: { bottom: 0, left: 0, borderBottomWidth: CT, borderLeftWidth: CT },
  br: { bottom: 0, right: 0, borderBottomWidth: CT, borderRightWidth: CT },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#C9A227', opacity: 0.9 },
  bottomBar: { alignItems: 'center', gap: 14, paddingTop: 20 },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 24 },
  rescanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  rescanText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
});
