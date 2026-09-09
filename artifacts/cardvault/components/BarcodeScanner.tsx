import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseBarcodePayload, ScannedPayload, SmartScanSheet } from '@/components/SmartScanSheet';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
export type ScannerMode = 'barcode' | 'card_photo';

interface Props {
  onScanned?: (result: BarcodeResult, payload?: ScannedPayload) => void;
  onCardCaptured?: (photoUri: string) => void;
  onClose: () => void;
  initialMode?: ScannerMode;
}

let CameraViewComponent: React.ComponentType<any> | null = null;

export function BarcodeScanner({ onScanned, onCardCaptured, onClose, initialMode = 'barcode' }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<Permission>('unknown');
  const [cameraReady, setCameraReady] = useState(false);
  const [mode, setMode] = useState<ScannerMode>(initialMode);
  const [scanned, setScanned] = useState(false);
  const [smartPayload, setSmartPayload] = useState<ScannedPayload | null>(null);
  const [torch, setTorch] = useState(false);
  const cameraRef = useRef<any>(null);
  const scanLine = useRef(new Animated.Value(0)).current;

  // Request permission + load camera module
  useEffect(() => {
    if (Platform.OS === 'web') {
      setPermission('denied');
      return;
    }
    (async () => {
      try {
        const cam = await import('expo-camera');
        const result = await (cam as any).Camera.requestCameraPermissionsAsync();
        if (result?.granted) {
          CameraViewComponent = cam.CameraView;
          setCameraReady(true);
          setPermission('granted');
        } else {
          setPermission('denied');
        }
      } catch {
        setPermission('denied');
      }
    })();
  }, []);

  // Scan-line animation for barcode mode
  useEffect(() => {
    if (mode !== 'barcode') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLine, mode]);

  const handleBarcode = useCallback(
    async ({ data, type }: { data: string; type: string }) => {
      if (scanned || mode !== 'barcode') return;
      setScanned(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const parsed = parseBarcodePayload(data, type);
      setSmartPayload(parsed);
    },
    [scanned, mode],
  );

  const handleCaptureCardPhoto = async () => {
    if (!cameraRef.current) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri && onCardCaptured) {
        onCardCaptured(photo.uri);
      }
    } catch (e) {
      console.warn('Card capture failed:', e);
    }
  };

  const handleAddToVault = (payload: ScannedPayload) => {
    setSmartPayload(null);
    if (onScanned) {
      onScanned({ value: payload.rawValue, type: payload.format }, payload);
    }
  };

  const handleRescan = () => {
    setSmartPayload(null);
    setScanned(false);
  };

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
            {Platform.OS === 'web' ? 'Barcode & Card Scanner' : 'Camera Access Needed'}
          </Text>
          <Text style={[styles.fallbackSub, { color: colors.mutedForeground }]}>
            {Platform.OS === 'web'
              ? 'Live camera scanner is available on mobile. You can upload card photos or enter details directly.'
              : 'Enable camera access in Settings → nascard to scan cards and barcodes.'}
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
  
  // Dimensions for scanning frames
  const BARCODE_BOX = Math.min(SCREEN_WIDTH * 0.72, 280);
  const CARD_BOX_W = Math.min(SCREEN_WIDTH * 0.88, 340);
  const CARD_BOX_H = CARD_BOX_W * (54 / 85.6); // Exact ISO ID-1 card aspect ratio

  const lineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, BARCODE_BOX - 3] });

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <CV
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned || mode !== 'barcode' ? undefined : handleBarcode}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr', 'code128', 'code39', 'ean13', 'ean8',
            'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix',
          ],
        }}
      />

      {/* ── Overlay Viewfinder ── */}
      <View style={styles.overlay} pointerEvents="box-none">
        
        {/* Top Header Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Mode Switcher Tabs */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('barcode');
                setScanned(false);
              }}
              style={[styles.modeTab, mode === 'barcode' && styles.modeTabActive]}
            >
              <Ionicons name="barcode-outline" size={15} color={mode === 'barcode' ? '#000' : '#fff'} />
              <Text style={[styles.modeTabText, mode === 'barcode' && styles.modeTabTextActive]}>
                Code / QR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode('card_photo');
              }}
              style={[styles.modeTab, mode === 'card_photo' && styles.modeTabActive]}
            >
              <Ionicons name="card-outline" size={15} color={mode === 'card_photo' ? '#000' : '#fff'} />
              <Text style={[styles.modeTabText, mode === 'card_photo' && styles.modeTabTextActive]}>
                Card Photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Flashlight / Torch Toggle */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTorch(!torch);
            }}
            style={[styles.iconBtn, torch && styles.iconBtnActive]}
          >
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color={torch ? '#F59E0B' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Center Frame Viewport */}
        <View style={styles.centerContainer}>
          {mode === 'barcode' ? (
            /* Barcode Square Target */
            <View style={[styles.scanBox, { width: BARCODE_BOX, height: BARCODE_BOX }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.corner, styles[c]]} />
              ))}
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: lineY }] }]} />
            </View>
          ) : (
            /* Physical Card ISO ID-1 Aspect Viewfinder */
            <View style={[styles.cardBox, { width: CARD_BOX_W, height: CARD_BOX_H }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <View key={c} style={[styles.cornerCard, styles[c]]} />
              ))}
              <View style={styles.cardCenterGuide}>
                <Ionicons name="scan-outline" size={32} color="rgba(255,255,255,0.4)" />
                <Text style={styles.cardGuideText}>Align ID within frame</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Control Bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
          {mode === 'barcode' ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Text style={styles.hint}>
                Point camera at any pass barcode or QR code
              </Text>
              {scanned && (
                <TouchableOpacity onPress={handleRescan} style={styles.rescanBtn}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.rescanText}>Scan again</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Shutter Button for Card Photo Capture */
            <View style={styles.shutterRow}>
              <Text style={styles.hint}>
                Automatic edge clipping & smart OCR extraction
              </Text>
              <TouchableOpacity
                onPress={handleCaptureCardPhoto}
                style={styles.shutterOuter}
                activeOpacity={0.8}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>

      {/* Intelligent Bottom Sheet for Scanned Payloads */}
      <SmartScanSheet
        visible={!!smartPayload}
        payload={smartPayload}
        onClose={() => setSmartPayload(null)}
        onAddToVault={handleAddToVault}
        onRescan={handleRescan}
      />
    </View>
  );
}

const CW = 24;
const CT = 3.5;

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
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  iconBtnActive: { backgroundColor: 'rgba(245,158,11,0.25)' },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 3,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 17,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
  },
  modeTabText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  modeTabTextActive: {
    color: '#000000',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cardBox: {
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenterGuide: {
    alignItems: 'center',
    gap: 8,
  },
  cardGuideText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  corner: { position: 'absolute', width: CW, height: CW, borderColor: '#F59E0B' },
  cornerCard: { position: 'absolute', width: CW + 4, height: CW + 4, borderColor: '#38BDF8' },
  tl: { top: 0, left: 0, borderTopWidth: CT, borderLeftWidth: CT, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: CT, borderRightWidth: CT, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: CT, borderLeftWidth: CT, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: CT, borderRightWidth: CT, borderBottomRightRadius: 10 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2.5, backgroundColor: '#F59E0B', opacity: 0.95 },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 16,
    gap: 12,
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rescanText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  shutterRow: {
    alignItems: 'center',
    gap: 14,
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
});
