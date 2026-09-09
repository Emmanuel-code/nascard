import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CardType } from '@/types/card';

export interface ScannedPayload {
  rawValue: string;
  format: 'qr' | 'code128' | 'code39' | 'ean13' | 'other';
  extractedId?: string;
  extractedExpiry?: string;
  extractedName?: string;
  suggestedType?: CardType;
  suggestedTitle?: string;
}

interface Props {
  visible: boolean;
  payload: ScannedPayload | null;
  onClose: () => void;
  onAddToVault: (payload: ScannedPayload) => void;
  onRescan: () => void;
}

/** Parse raw barcode payload to intelligently extract card metadata & expiry */
export function parseBarcodePayload(rawValue: string, typeString: string): ScannedPayload {
  const format: ScannedPayload['format'] =
    typeString === 'qr' ? 'qr' :
    typeString === 'code128' ? 'code128' :
    typeString === 'code39' ? 'code39' :
    typeString === 'ean13' ? 'ean13' : 'other';

  let extractedId = rawValue;
  let extractedExpiry: string | undefined = undefined;
  let extractedName: string | undefined = undefined;
  let suggestedType: CardType = 'membership';
  let suggestedTitle: string | undefined = undefined;

  // 1. Check for AAMVA Driver License format (starts with @ or contains ANSI/AAMVA)
  if (rawValue.includes('ANSI ') || rawValue.startsWith('@')) {
    suggestedType = 'id';
    suggestedTitle = 'National Driver ID';
    // DBA = Expiry date (MMDDYYYY or YYYYMMDD)
    const dbaMatch = rawValue.match(/DBA(\d{8})/);
    if (dbaMatch) {
      const rawDate = dbaMatch[1];
      // Try YYYYMMDD vs MMDDYYYY
      if (Number(rawDate.slice(0, 4)) > 2020) {
        extractedExpiry = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      } else {
        extractedExpiry = `${rawDate.slice(4, 8)}-${rawDate.slice(0, 2)}-${rawDate.slice(2, 4)}`;
      }
    }
    // DAC = First Name, DCS = Last Name
    const dacMatch = rawValue.match(/DAC([^\n\r]+)/);
    const dcsMatch = rawValue.match(/DCS([^\n\r]+)/);
    if (dacMatch || dcsMatch) {
      extractedName = `${dacMatch ? dacMatch[1].trim() : ''} ${dcsMatch ? dcsMatch[1].trim() : ''}`.trim();
    }
    // DAQ = License / ID Number
    const daqMatch = rawValue.match(/DAQ([^\n\r]+)/);
    if (daqMatch) {
      extractedId = daqMatch[1].trim();
    }
  }
  // 2. Check for GS1-128 barcode format with Application Identifier (17) for Expiry YYMMDD
  else if (rawValue.includes('(17)') || rawValue.includes('17')) {
    const gs1Match = rawValue.match(/(?:\(17\)|17)(\d{2})(\d{2})(\d{2})/);
    if (gs1Match) {
      const [_, yy, mm, dd] = gs1Match;
      extractedExpiry = `20${yy}-${mm}-${dd}`;
    }
  }
  // 3. Intelligent Web Link & URL parser (e.g. https://nutcase.com/members/NC-9821 or https://gym.com?id=VIP-8820)
  else if (rawValue.startsWith('http://') || rawValue.startsWith('https://') || rawValue.includes('://')) {
    try {
      const url = new URL(rawValue);
      const hostParts = url.hostname.replace('www.', '').split('.');
      const brandName = hostParts[0] ? hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1) : '';

      if (brandName && brandName.toLowerCase() !== 'api') {
        suggestedTitle = `${brandName} Pass`;
      }

      // Check query parameters: ?id=..., ?member=..., ?code=..., ?card=..., ?pass=...
      const queryId =
        url.searchParams.get('id') ||
        url.searchParams.get('member') ||
        url.searchParams.get('memberId') ||
        url.searchParams.get('code') ||
        url.searchParams.get('card') ||
        url.searchParams.get('pass') ||
        url.searchParams.get('user');

      if (queryId) {
        extractedId = queryId;
      } else {
        // Extract clean last path segment (e.g. /members/NC-9821 -> NC-9821)
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          if (lastSeg && lastSeg.length >= 3 && lastSeg.length <= 26) {
            extractedId = decodeURIComponent(lastSeg).toUpperCase();
          }
        }
      }

      // Query params for expiry & name
      const queryExp = url.searchParams.get('exp') || url.searchParams.get('expiry') || url.searchParams.get('valid');
      if (queryExp) extractedExpiry = queryExp;

      const queryName = url.searchParams.get('name') || url.searchParams.get('memberName');
      if (queryName) extractedName = decodeURIComponent(queryName);

      // Infer type
      if (rawValue.toLowerCase().includes('gym') || rawValue.toLowerCase().includes('fitness')) {
        suggestedType = 'health';
      } else if (rawValue.toLowerCase().includes('student') || rawValue.toLowerCase().includes('edu')) {
        suggestedType = 'membership';
      } else if (rawValue.toLowerCase().includes('reward') || rawValue.toLowerCase().includes('point')) {
        suggestedType = 'loyalty';
      }
    } catch {
      // Manual regex fallback for non-standard URLs
      const match = rawValue.match(/https?:\/\/(?:www\.)?([^/]+)(?:\/(?:[^/]+\/)*([^?#]+))?/);
      if (match) {
        if (match[1]) {
          const b = match[1].split('.')[0];
          suggestedTitle = b ? b.charAt(0).toUpperCase() + b.slice(1) + ' Pass' : 'Scanned Pass';
        }
        if (match[2]) {
          extractedId = match[2].toUpperCase();
        }
      }
    }
  }
  // 4. Check for JSON payload
  else if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed.id || parsed.idNumber || parsed.memberId) {
        extractedId = parsed.id || parsed.idNumber || parsed.memberId;
      }
      if (parsed.exp || parsed.expiry || parsed.expiryDate) {
        extractedExpiry = parsed.exp || parsed.expiry || parsed.expiryDate;
      }
      if (parsed.name || parsed.nameOnCard || parsed.memberName) {
        extractedName = parsed.name || parsed.nameOnCard || parsed.memberName;
      }
      if (parsed.org || parsed.orgName || parsed.title) {
        suggestedTitle = parsed.org || parsed.orgName || parsed.title;
      }
      if (parsed.type) {
        suggestedType = parsed.type;
      }
    } catch {
      // not JSON
    }
  }
  // 4. Regex date extractor fallback (e.g. EXP: 12/28 or 2028-12-31)
  if (!extractedExpiry) {
    const dateRegex = /\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/;
    const slashRegex = /\b(0[1-9]|1[0-2])\/(20\d{2}|\d{2})\b/;
    const match1 = rawValue.match(dateRegex);
    const match2 = rawValue.match(slashRegex);

    if (match1) {
      extractedExpiry = `${match1[1]}-${match1[2]}-${match1[3]}`;
    } else if (match2) {
      const yr = match2[2].length === 2 ? `20${match2[2]}` : match2[2];
      extractedExpiry = `${yr}-${match2[1]}-01`;
    }
  }

  // 5. Intelligent Title & Type inference
  if (!suggestedTitle) {
    if (rawValue.toUpperCase().includes('GHA') || rawValue.toUpperCase().includes('ID')) {
      suggestedType = 'id';
      suggestedTitle = 'National Identity Card';
    } else if (rawValue.toUpperCase().includes('STU') || rawValue.toUpperCase().includes('UNI')) {
      suggestedType = 'membership';
      suggestedTitle = 'University Student Pass';
    } else if (rawValue.toUpperCase().includes('FIT') || rawValue.toUpperCase().includes('GYM')) {
      suggestedType = 'health';
      suggestedTitle = 'Gym & Fitness Membership';
    } else {
      suggestedTitle = 'Scanned Smart Pass';
    }
  }

  return {
    rawValue,
    format,
    extractedId,
    extractedExpiry,
    extractedName,
    suggestedType,
    suggestedTitle,
  };
}

export function SmartScanSheet({ visible, payload, onClose, onAddToVault, onRescan }: Props) {
  const colors = useColors();

  if (!payload) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              
              {/* Drag Handle */}
              <View style={styles.handleWrap}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconCircle}>
                  <Ionicons name="scan-circle" size={26} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>Pass Detected!</Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    Smart scan extracted details from code
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {/* Scanned Details Card */}
              <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>FORMAT</Text>
                  <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      {payload.format.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>PAYLOAD / ID</Text>
                  <Text style={[styles.value, { color: colors.foreground }]} numberOfLines={1}>
                    {payload.extractedId || payload.rawValue}
                  </Text>
                </View>

                {payload.extractedExpiry ? (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>EXPIRY DETECTED</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="calendar-outline" size={13} color="#10B981" />
                      <Text style={[styles.value, { color: '#10B981', fontFamily: 'Inter_700Bold' }]}>
                        {payload.extractedExpiry}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {payload.extractedName ? (
                  <View style={styles.row}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>NAME DETECTED</Text>
                    <Text style={[styles.value, { color: colors.foreground }]}>
                      {payload.extractedName}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onAddToVault(payload);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.88}
                >
                  <Ionicons name="add-circle" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                    Add to Vault
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onRescan();
                  }}
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color={colors.foreground} />
                  <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                    Scan Another
                  </Text>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    paddingTop: 10,
    gap: 16,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    maxWidth: '65%',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
