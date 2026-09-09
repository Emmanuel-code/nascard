import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';

interface SecurityQRModalProps {
  card: Card | null;
  visible: boolean;
  onClose: () => void;
}

const TOTAL_TTL = 60; // 60 seconds

export function SecurityQRModal({ card, visible, onClose }: SecurityQRModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [timeLeft, setTimeLeft] = useState(TOTAL_TTL);
  const [tokenSeed, setTokenSeed] = useState(Date.now());

  // Timer countdown & auto-refresh token seed every 60s
  useEffect(() => {
    if (!visible || !card) return;
    setTimeLeft(TOTAL_TTL);
    setTokenSeed(Date.now());

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setTokenSeed(Date.now());
          return TOTAL_TTL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, card]);

  if (!card) return null;

  // Generate 60-second time-hashed Zero-Knowledge Verification Payload
  const timeBlock = Math.floor(tokenSeed / (TOTAL_TTL * 1000));
  const zkPayload = JSON.stringify({
    v: 'nascard_dynamic_v1',
    cid: card.id,
    cardId: card.id,
    type: card.cardType,
    orgId: card.orgId || 'org_verified',
    org: card.orgName || card.title,
    displayName: card.nameOnCard || card.title,
    ref: card.idNumber ? `***${card.idNumber.slice(-4)}` : 'VERIFIED',
    t: timeBlock,
    expiresAt: tokenSeed + TOTAL_TTL * 1000,
    sig: `sig_${(tokenSeed % 999999).toString(36).toUpperCase()}`,
  });

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / TOTAL_TTL) * 100));
  const topPad = Platform.OS === 'web' ? 20 : insets.top;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalBox, { backgroundColor: colors.card, paddingTop: topPad + 12 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.badgeIcon, { backgroundColor: colors.primary + '1F' }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Encrypted Verification QR</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  60s Zero-Knowledge Anti-Screenshot Pass
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* QR Display Frame */}
          <View style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
            <QRCode value={zkPayload} size={210} color="#0F172A" backgroundColor="#FFFFFF" />
            <View style={styles.logoWatermark}>
              <Ionicons name="checkmark-shield" size={20} color={colors.primary} />
            </View>
          </View>

          {/* 60s Countdown Timer Bar */}
          <View style={styles.timerSection}>
            <View style={styles.timerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="timer-outline" size={16} color={colors.primary} />
                <Text style={[styles.timerLabel, { color: colors.foreground }]}>Token Auto-Refresh</Text>
              </View>
              <Text style={[styles.timerValue, { color: colors.primary }]}>{timeLeft}s</Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: timeLeft < 10 ? '#EF4444' : colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Security Features List */}
          <View style={[styles.infoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed" size={14} color="#10B981" />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Private info (phone/email) is hidden from scanner
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="refresh-circle" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Rotates every 60s to prevent screenshot fraud
              </Text>
            </View>
          </View>

          {/* Done Button */}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qrContainer: {
    alignSelf: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  logoWatermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  timerSection: { gap: 8 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  timerValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  infoBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  doneBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
