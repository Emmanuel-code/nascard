import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
export const FRAME_W = Math.min(SCREEN_W - 48, 340);
export const FRAME_H = Math.round(FRAME_W / 1.574); // Standard 85:54 credit card proportion

interface Props {
  title?: string;
  hint?: string;
  onCapture?: () => void;
  onClose?: () => void;
}

export function CardCameraFrameOverlay({ title, hint, onCapture, onClose }: Props) {
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopLaser = () => {
      laserAnim.setValue(0);
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) loopLaser();
      });
    };
    loopLaser();
    return () => laserAnim.stopAnimation();
  }, [laserAnim]);

  const laserY = laserAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [6, FRAME_H - 12, 6],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Dark Mask Top */}
      <View style={[styles.mask, { height: (SCREEN_H - FRAME_H) / 2 - 40 }]} />

      {/* Middle Row with Frame */}
      <View style={styles.middleRow}>
        <View style={styles.maskSide} />

        {/* 85:54 Credit Card Cutout Window */}
        <View style={[styles.frameWindow, { width: FRAME_W, height: FRAME_H }]}>
          {/* Laser Scan Line */}
          <Animated.View
            style={[
              styles.scanLaser,
              { transform: [{ translateY: laserY }] },
            ]}
          />

          {/* Corner Brackets */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Frame Label */}
          <View style={styles.frameLabelBox}>
            <Ionicons name="scan" size={14} color="#F59E0B" />
            <Text style={styles.frameLabelText}>CARD BOUNDARY</Text>
          </View>
        </View>

        <View style={styles.maskSide} />
      </View>

      {/* Dark Mask Bottom */}
      <View style={[styles.mask, { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 40 }]}>
        <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 20 }}>
          <Text style={styles.guidanceTitle}>{title || 'Position card inside rectangular frame'}</Text>
          <Text style={styles.guidanceHint}>{hint || 'AI auto-detects name, ID number & expiry date'}</Text>
        </View>

        {/* Action Controls */}
        <View style={styles.actionRow}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {onCapture && (
            <TouchableOpacity onPress={onCapture} style={styles.shutterBtn} activeOpacity={0.85}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          )}

          {onClose && <View style={{ width: 48 }} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mask: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maskSide: {
    flex: 1,
    height: FRAME_H,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  frameWindow: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  scanLaser: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#F59E0B',
  },
  topLeft: {
    top: 6,
    left: 6,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 6,
    right: 6,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 6,
    left: 6,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 6,
    right: 6,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  frameLabelBox: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  frameLabelText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  guidanceTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  guidanceHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  closeIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  shutterInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 30,
    backgroundColor: '#F59E0B',
  },
});
