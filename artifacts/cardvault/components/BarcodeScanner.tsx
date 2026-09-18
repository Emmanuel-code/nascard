import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TurboModuleRegistry,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseBarcodePayload, ScannedPayload, SmartScanSheet } from '@/components/SmartScanSheet';
import { useColors } from '@/hooks/useColors';
import { pauseAppLock } from '@/lib/appLock';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// ── Native document scanner (edge detection + auto-capture + crop-adjust UI) ──
// This is a native module (see setup notes in the project README) — it is
// loaded lazily so this file still loads fine in environments where the
// native module hasn't been built in yet (e.g. before the first
// `expo prebuild` / dev-client rebuild after installing the package, or
// when running inside Expo Go, which can never load custom native code).
//
// IMPORTANT: the plugin's own internals call
// TurboModuleRegistry.getEnforcing('DocumentScanner'), which THROWS a
// fatal, uncatchable-by-us Invariant Violation the instant its file is
// evaluated if the native module isn't compiled into the running binary —
// and critically, that throw happens during module evaluation, not inside
// a normal rejected Promise, so it can slip past an ordinary try/catch
// around `await import(...)`. To avoid ever triggering that crash, we
// probe first with TurboModuleRegistry's non-throwing `get()`, which
// simply returns null instead of throwing — and only attempt to import
// the plugin at all if that probe succeeds.
function isDocumentScannerLinked(): boolean {
  try {
    return TurboModuleRegistry.get('DocumentScanner') != null;
  } catch {
    return false;
  }
}

let DocumentScannerModule: any = null;
async function loadDocumentScanner(): Promise<any> {
  if (!isDocumentScannerLinked()) {
    return null;
  }
  if (DocumentScannerModule) return DocumentScannerModule;
  try {
    const mod = await import('react-native-document-scanner-plugin');
    DocumentScannerModule = mod.default ?? mod;
    return DocumentScannerModule;
  } catch (e) {
    console.warn('react-native-document-scanner-plugin not available:', e);
    return null;
  }
}

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

  // ── Card-photo state ─────────────────────────────────────────────────────
  // Card capture is fully handed off to the native document scanner — it
  // owns its own live edge-detection UI, its own auto-capture moment, AND
  // its own after-capture crop/corner-adjust screen. So this component just
  // needs to: launch it, wait, then hand the result back (or fall back to
  // barcode mode if the native module genuinely isn't installed yet).
  const [documentScannerStatus, setDocumentScannerStatus] = useState<
    'idle' | 'launching' | 'unavailable'
  >('idle');
  const launchedForModeRef = useRef(false);

  const launchDocumentScanner = useCallback(async () => {
    setDocumentScannerStatus('launching');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const DocumentScanner = await loadDocumentScanner();
    if (!DocumentScanner?.scanDocument) {
      setDocumentScannerStatus('unavailable');
      return;
    }

    try {
      // NOTE: check react-native-document-scanner-plugin's README for the
      // exact current option names/shape for your installed version —
      // native-module APIs like this do shift between releases.
      const result = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 90,
      });

      const uri: string | undefined = result?.scannedImages?.[0];

      if (result?.status === 'success' && uri && onCardCaptured) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCardCaptured(uri);
        onClose();
        return;
      }

      // User cancelled inside the native scanner UI — just close back out
      // rather than leaving them stuck on a blank handoff screen.
      if (result?.status === 'cancel') {
        onClose();
        return;
      }

      // Any other non-success status: let them retry or fall back.
      setDocumentScannerStatus('idle');
    } catch (e) {
      console.warn('Document scan failed:', e);
      setDocumentScannerStatus('idle');
    }
  }, [onCardCaptured, onClose]);

  // Auto-launch as soon as we're in card_photo mode — no need to make the
  // user tap twice (once for our tab, once for the native scanner's own
  // shutter) when the native module already does auto-capture itself.
  useEffect(() => {
    if (mode === 'card_photo' && !launchedForModeRef.current) {
      launchedForModeRef.current = true;
      launchDocumentScanner();
    }
    if (mode !== 'card_photo') {
      launchedForModeRef.current = false;
      setDocumentScannerStatus('idle');
    }
  }, [mode, launchDocumentScanner]);

  // Request permission + load camera module (barcode mode only)
  useEffect(() => {
    pauseAppLock(180000);
    if (Platform.OS === 'web') {
      setPermission('denied');
      return;
    }
    (async () => {
      try {
        const cam = await import('expo-camera');
        // expo-camera v17+: permissions are on the module directly, not on the legacy .Camera class
        const requestFn =
          (cam as any).requestCameraPermissionsAsync ??
          (cam as any).Camera?.requestCameraPermissionsAsync?.bind((cam as any).Camera);
        if (!requestFn) {
          setPermission('denied');
          return;
        }
        const result = await requestFn();
        if (result?.granted) {
          CameraViewComponent = (cam as any).CameraView ?? null;
          if (!CameraViewComponent) {
            setPermission('denied');
            return;
          }
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

  // ── Web / permission denied fallback (barcode mode) ────────────────────────
  if (mode === 'barcode' && (Platform.OS === 'web' || permission === 'denied')) {
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

  // ── Card-photo mode: handoff / fallback screen ──────────────────────────
  // The native scanner takes over the whole screen itself once launched, so
  // this only renders during the brief moment before it opens, or if it
  // genuinely couldn't be loaded (module not built in yet).
  if (mode === 'card_photo') {
    if (documentScannerStatus === 'unavailable') {
      return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={onClose} style={[styles.topClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.fallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="scan-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
              Card Scanner Not Installed
            </Text>
            <Text style={[styles.fallbackSub, { color: colors.mutedForeground }]}>
              The auto-scan module needs a native rebuild before it's available (expo prebuild + a
              dev-client build). You can still switch to Code / QR mode, or enter card details manually.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMode('barcode');
                setDocumentScannerStatus('idle');
              }}
              style={[styles.fallbackBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.fallbackBtnText, { color: colors.primaryForeground }]}>
                Switch to Code / QR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <TouchableOpacity onPress={onClose} style={[styles.topClose, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.loadingRing}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
        </View>
        <Text style={styles.handoffText}>Opening card scanner…</Text>
        <TouchableOpacity
          onPress={() => {
            launchedForModeRef.current = false;
            setMode('barcode');
          }}
          style={{ marginTop: 20 }}
        >
          <Text style={styles.handoffSubtext}>Use Code / QR scanner instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading (barcode camera module) ─────────────────────────────────────
  if (!cameraReady || !CameraViewComponent) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <View style={styles.loadingRing}>
          <Ionicons name="camera-outline" size={28} color="rgba(255,255,255,0.6)" />
        </View>
      </View>
    );
  }

  const CV = CameraViewComponent;

  // Dimensions for scanning frame
  const BARCODE_BOX = Math.min(SCREEN_WIDTH * 0.72, 280);

  const lineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, BARCODE_BOX - 3] });

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <CV
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
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
              style={[styles.modeTab, (mode as ScannerMode) === 'card_photo' && styles.modeTabActive]}
            >
              <Ionicons name="card-outline" size={15} color="#fff" />
              <Text style={styles.modeTabText}>Card Photo</Text>
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
          <View style={[styles.scanBox, { width: BARCODE_BOX, height: BARCODE_BOX }]}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: lineY }] }]} />
          </View>
        </View>

        {/* Bottom Control Bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
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
  loadingRoot: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  loadingRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoffText: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  handoffSubtext: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'underline',
  },
  topClose: { position: 'absolute', left: 16, top: 12, zIndex: 10, padding: 8 },
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
  corner: { position: 'absolute', width: CW, height: CW, borderColor: '#F59E0B' },
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
});