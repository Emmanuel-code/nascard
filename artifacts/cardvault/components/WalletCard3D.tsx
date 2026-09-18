import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';
import { formatExpiry, getExpiryStatus } from '@/types/card';

const { width: SCREEN_W } = Dimensions.get('window');
export const CARD_W = Math.min(SCREEN_W - 44, 350);
export const CARD_H = Math.round(CARD_W / 1.586); // Standard ISO ID-1 ratio (~220px)

const PROFILE_GRADIENTS: Record<string, [string, string]> = {
  personal: ['#0B132B', '#1C2541'],
  work: ['#1E1B4B', '#0F172A'],
  student: ['#0C2340', '#1D3557'],
};

const TYPE_THEMES: Record<string, { bg: [string, string]; accent: string; label: string; icon: any }> = {
  id: { bg: ['#0F172A', '#1E293B'], accent: '#F59E0B', label: 'NATIONAL ID', icon: 'id-card-outline' },
  health: { bg: ['#064E3B', '#022C22'], accent: '#10B981', label: 'HEALTH PASS', icon: 'medkit-outline' },
  loyalty: { bg: ['#78350F', '#451A03'], accent: '#FBBF24', label: 'VIP REWARDS', icon: 'ribbon-outline' },
  membership: { bg: ['#31104B', '#1E0B36'], accent: '#A855F7', label: 'MEMBER PASS', icon: 'shield-checkmark-outline' },
};

const SAMPLE_PHOTOS: Record<string, any> = {
  sample_anastasia: require('@/assets/images/sample_anastasia.jpg'),
  sample_frank: require('@/assets/images/sample_frank.jpg'),
};

interface Props {
  card: Card;
  onPress: () => void;
  index?: number;
  total?: number;
  isStacked?: boolean;
}

export const WalletCard3D = React.memo(function WalletCard3D({ card, onPress, isStacked }: Props) {
  const colors = useColors();
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlipped = useRef(false);
  const [isMasked, setIsMasked] = useState(false);

  const theme = TYPE_THEMES[card.cardType] || TYPE_THEMES.id;
  const profileGradient = PROFILE_GRADIENTS[card.profileId] || theme.bg;
  const primaryBg = card.primaryColor || profileGradient[0]!;
  const secondaryBg = card.secondaryColor || profileGradient[1]!;
  const accent = card.accentColor || theme.accent;
  const status = getExpiryStatus(card.expiryDate);

  const flipCard = useCallback(() => {
    if (isFlipped.current) {
      Animated.spring(flipAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    } else {
      Animated.spring(flipAnim, { toValue: 180, useNativeDriver: true, tension: 60, friction: 10 }).start();
    }
    isFlipped.current = !isFlipped.current;
  }, [flipAnim]);

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 90, 180], outputRange: ['0deg', '90deg', '180deg'] });
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 90, 180], outputRange: ['180deg', '90deg', '0deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [89, 90], outputRange: [0, 1] });

  // Holographic sheen animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const runShimmer = () => {
      shimmerAnim.setValue(0);
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) runShimmer();
      });
    };
    runShimmer();
    return () => shimmerAnim.stopAnimation();
  }, [shimmerAnim]);

  const shimmerX = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-CARD_W * 1.5, CARD_W * 2.5] });

  const isPhysicalDoc = !card.isPartnerIssued && Boolean(card.frontImageUri);
  const photoSource = card.frontImageUri
    ? SAMPLE_PHOTOS[card.frontImageUri] || { uri: card.frontImageUri }
    : null;
  const photoUri = card.frontImageUri;

  // Build key-value fields for the ID ledger dynamically
  const frontFields: Array<{ label: string; value: string }> = [];
  const backFields: Array<{ label: string; value: string }> = [];

  if (card.idNumber) {
    frontFields.push({
      label: card.cardType === 'membership' ? 'MEMBER ID' : 'ID NUMBER',
      value: isMasked
        ? '••••••••'
        : card.idNumber.length > 14
        ? card.idNumber.slice(0, 14) + '…'
        : card.idNumber,
    });
  }

  if (card.expiryDate) {
    frontFields.push({
      label: 'VALID THRU',
      value: formatExpiry(card.expiryDate),
    });
  }

  // Dynamically partition custom fields: top 2 fields on front, remaining on back
  if (card.customFields && typeof card.customFields === 'object' && !Array.isArray(card.customFields)) {
    try {
      const entries = Object.entries(card.customFields).filter(([_, v]) => Boolean(v));
      const maxFrontCustom = 2; // Always keep clean 2 items on front so ledger never overflows

      entries.forEach(([k, v], idx) => {
        const field = {
          label: k.toUpperCase().replace(/_/g, ' ').slice(0, 14),
          value: isMasked ? '••••••' : String(v).slice(0, 20),
        };
        if (frontFields.length < (maxFrontCustom + (card.idNumber ? 1 : 0) + (card.expiryDate ? 1 : 0))) {
          frontFields.push(field);
        } else {
          backFields.push(field);
        }
      });
    } catch {
      // Malformed customFields — skip rendering them rather than crashing
    }
  }

  return (
    <TouchableOpacity onPress={onPress} onLongPress={flipCard} activeOpacity={0.94} delayLongPress={180}>
      <View style={[styles.cardOuter, { width: CARD_W, height: CARD_H }]}>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FRONT FACE (AUTHENTIC PHYSICAL ID / BADGE ARCHITECTURE)       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            { backgroundColor: primaryBg, width: CARD_W, height: CARD_H },
            { transform: [{ perspective: 1200 }, { rotateY: frontInterpolate }], opacity: frontOpacity },
          ]}
        >
          {/* Edge-to-edge physical photo fallback with dark contrast scrim */}
          {isPhysicalDoc && photoSource ? (
            <>
              <Image source={photoSource} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              {/* <LinearGradient
                colors={['rgba(171, 172, 175, 0.72)', 'rgba(157, 159, 161, 0.85)', 'rgba(160, 162, 168, 0.92)']}
                style={StyleSheet.absoluteFillObject}
              /> */}
            </>
          ) : (
            <LinearGradient
              colors={[primaryBg, secondaryBg, '#040711']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Micro Guilloché Security Watermark Pattern Overlay */}
          <View style={styles.guillocheOverlay} pointerEvents="none">
            <View style={[styles.securityCircle1, { borderColor: accent + '18' }]} />
            <View style={[styles.securityCircle2, { borderColor: accent + '12' }]} />
          </View>

          {/* Holographic Angle Sheen */}
          <Animated.View
            style={[
              styles.shimmerSheen,
              { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] },
            ]}
            pointerEvents="none"
          />

          {/* Top Brand Color Strip */}
          {!isPhysicalDoc && <View style={[styles.topBrandStripe, { backgroundColor: accent }]} />}

          {/* ── CARD CONTENT LAYER ── */}
          <View style={styles.cardContent}>
            
            {/* 1. TOP HEADER: Org / Category / Verified Seal */}
            <View style={[styles.headerRow, isPhysicalDoc && { justifyContent: 'flex-end' }]}>
              {!isPhysicalDoc && (
                <View style={styles.brandLeft}>
                  {card.logoUri ? (
                    <View style={[styles.logoWrap, { borderColor: accent + '40' }]}>
                      <Image source={{ uri: card.logoUri }} style={styles.logoImg} contentFit="contain" />
                    </View>
                  ) : (
                    <View style={[styles.logoPlaceholder, { backgroundColor: accent + '25', borderColor: accent + '50' }]}>
                      <Ionicons name={theme.icon} size={13} color={accent} />
                    </View>
                  )}

                  <View>
                    <Text style={styles.orgNameText} numberOfLines={1}>
                      {(card.orgName || card.title || 'NASCARD').toUpperCase()}
                    </Text>
                    <Text style={[styles.categoryTag, { color: accent }]}>
                      {(card.cardType || 'MEMBERSHIP').toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Badges: Verified / Digitized / Pinned */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {card.isPinned && (
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="star" size={9} color="#F59E0B" />
                    <Text style={styles.pinnedBadgeText}>PINNED</Text>
                  </View>
                )}
                {card.isPartnerIssued ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: accent + '20', borderColor: accent + '60' }]}>
                    <Ionicons name="shield-checkmark" size={10} color={accent} />
                    <Text style={[styles.verifiedText, { color: accent }]}>OFFICIAL ✓</Text>
                  </View>
                ) : isPhysicalDoc ? (
                  <View style={[styles.photoDocBadge, { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 }]}>
                    <Ionicons name="camera" size={9} color="#38BDF8" />
                    <Text style={[styles.photoDocText, { color: '#38BDF8' }]}>PHOTO PASS</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. HERO IDENTITY ROW — DISTINCT LAYOUTS FOR PHOTO VS NO-PHOTO */}
            {photoSource && !isPhysicalDoc ? (
              /* ── LAYOUT A: PHOTO ID CARD (With 3:4 Passport Portrait) ── */
              <View style={styles.heroRow}>
                <View style={[styles.portraitBox, { borderColor: accent + '60' }]}>
                  <Image
                    source={photoSource}
                    style={styles.portraitImg}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <View style={[styles.portraitBadge, { backgroundColor: accent }]}>
                    <Ionicons name="checkmark" size={8} color="#000000" />
                  </View>
                </View>

                <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                  <Text
                    style={styles.cardName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {card.nameOnCard || card.title}
                  </Text>
                  {card.nameOnCard && card.title !== card.nameOnCard ? (
                    <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {card.title}
                    </Text>
                  ) : null}
                </View>

                {/* Contextual Emblem: IC Chip for IDs, Modern Emblems for Pass/Gym */}
                {card.cardType === 'id' ? (
                  <View style={[styles.icChip, { borderColor: '#EAB30880' }]}>
                    <LinearGradient
                      colors={['#FDE047', '#CA8A04', '#A16207']}
                      style={styles.icChipInner}
                    >
                      <View style={styles.icLineH} />
                      <View style={styles.icLineV} />
                    </LinearGradient>
                  </View>
                ) : (
                  <View style={[styles.emblemBadge, { backgroundColor: accent + '1E', borderColor: accent + '55' }]}>
                    <Ionicons
                      name={
                        card.cardType === 'health'
                          ? 'fitness'
                          : card.cardType === 'loyalty'
                          ? 'star'
                          : 'shield-checkmark'
                      }
                      size={13}
                      color={accent}
                    />
                  </View>
                )}
              </View>
            ) : !isPhysicalDoc ? (
              /* ── LAYOUT B: LUXURY / NO-PHOTO MEMBERSHIP CARD ── */
              <View style={styles.noPhotoHeroBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  {/* Left Side: IC Chip for ID cards OR Modern Monogram Crest for Membership/Gym */}
                  {card.cardType === 'id' ? (
                    <View style={[styles.icChipLarge, { borderColor: '#EAB30890' }]}>
                      <LinearGradient
                        colors={['#FDE047', '#CA8A04', '#A16207']}
                        style={styles.icChipInner}
                      >
                        <View style={styles.icLineH} />
                        <View style={styles.icLineV} />
                      </LinearGradient>
                    </View>
                  ) : (
                    <View style={[styles.modernCrest, { backgroundColor: accent + '20', borderColor: accent + '50' }]}>
                      <Ionicons
                        name={
                          card.cardType === 'health'
                            ? 'barbell'
                            : card.cardType === 'loyalty'
                            ? 'gift'
                            : 'school'
                        }
                        size={15}
                        color={accent}
                      />
                      <Text style={[styles.modernCrestText, { color: accent }]}>
                        {(card.cardType === 'health' ? 'FITNESS' : card.cardType === 'loyalty' ? 'REWARDS' : 'ACADEMIC')}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.noPhotoBadge, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
                    <Ionicons name="sparkles" size={11} color={accent} />
                    <Text style={[styles.noPhotoBadgeText, { color: accent }]}>
                      {(card.cardType === 'health' ? 'VIP MEMBER' : card.cardType === 'loyalty' ? 'PLATINUM' : 'VERIFIED').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Prominent Embossed Name with Auto-scaling */}
                <Text
                  style={styles.cardNameLarge}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {card.nameOnCard || card.title}
                </Text>
                {card.nameOnCard && card.title !== card.nameOnCard ? (
                  <Text style={[styles.cardSubtitle, { color: accent, marginTop: -1 }]} numberOfLines={1} ellipsizeMode="tail">
                    {card.title}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* 3. STRUCTURED 2-COLUMN IDENTITY LEDGER */}
            {frontFields.length > 0 && !isPhysicalDoc && (
              <View style={[styles.ledgerGrid, !photoUri && styles.ledgerGridFull]}>
                {frontFields.map((f, idx) => (
                  <View key={idx} style={styles.ledgerItem}>
                    <Text style={styles.ledgerLabel}>{f.label}</Text>
                    <Text style={styles.ledgerValue} numberOfLines={1}>{f.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 4. FOOTER: Security Strip, Flip Action & Mask Action */}
            <View style={styles.footerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.statusDot, { backgroundColor: status === 'expired' ? '#EF4444' : '#10B981' }]} />
                <Text style={styles.securityStatusText}>
                  {status === 'expired' ? 'EXPIRED' : 'VERIFIED ACTIVE'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={flipCard}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Flip card"
                >
                  <Ionicons name="sync-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.flipBtnText}>FLIP</Text>
                </TouchableOpacity>

                {/* <TouchableOpacity
                  onPress={() => setIsMasked(!isMasked)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Toggle mask ID"
                >
                  <Ionicons name={isMasked ? 'eye-off-outline' : 'eye-outline'} size={13} color="rgba(255,255,255,0.75)" />
                </TouchableOpacity> */}
              </View>
            </View>

          </View>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BACK FACE (METALLIC STRIPE & FULL VERIFICATION NOTES)         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <Animated.View
          style={[
            styles.cardFace,
            styles.cardBack,
            { backgroundColor: secondaryBg, width: CARD_W, height: CARD_H },
            { transform: [{ perspective: 1200 }, { rotateY: backInterpolate }], opacity: backOpacity },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={0.96}
            onPress={flipCard}
          >
            {/* Metallic Magstripe */}
            <LinearGradient
              colors={['#1F2937', '#111827', '#0F172A']}
              style={styles.magneticStripe}
            />

            {card.backImageUri ? (
              <Image source={{ uri: card.backImageUri }} style={styles.cardBackImg} contentFit="cover" />
            ) : (
              <View style={styles.backContent}>
                <View style={styles.signatureStrip}>
                  <Text style={styles.sigLabel}>AUTHORIZED SIGNATURE</Text>
                  <View style={styles.sigLine}>
                    <Text style={styles.sigName}>{card.nameOnCard || 'nascard Member'}</Text>
                  </View>
                </View>

                {/* Extended Credentials (if extra fields exist) */}
                {backFields.length > 0 ? (
                  <View style={styles.backCredentialsBox}>
                    <Text style={styles.backCredTitle}>EXTENDED CREDENTIALS</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
                      {backFields.map((bf, idx) => (
                        <View key={idx} style={{ width: '50%' }}>
                          <Text style={styles.backCredLabel}>{bf.label}</Text>
                          <Text style={styles.backCredValue} numberOfLines={1}>{bf.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : card.notes ? (
                  <Text style={styles.backNotes} numberOfLines={3}>{card.notes}</Text>
                ) : (
                  <Text style={styles.backEmpty}>
                    Issued via nascard Secure Vault · Cryptographically Signed
                  </Text>
                )}
              </View>
            )}

            <View style={styles.backFlipRow}>
              <Ionicons name="sync-outline" size={11} color="rgba(255,255,255,0.45)" />
              <Text style={styles.backFlipHint}>Tap to return to front</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  cardOuter: {
    borderRadius: 18,
    backgroundColor: '#0A0F1D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: '#0A0F1D',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cardFront: {
    backgroundColor: '#0A0F1D',
  },
  cardBack: {
    backgroundColor: '#0A0F1D',
  },

  // Security Watermark Patterns
  guillocheOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  securityCircle1: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
  },
  securityCircle2: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },

  // Holographic Sheen
  shimmerSheen: {
    position: 'absolute',
    top: -CARD_H,
    bottom: -CARD_H,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Top Stripe
  topBrandStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 10,
  },

  cardContent: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
    zIndex: 15,
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logoWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgNameText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  categoryTag: {
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.22)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.6)',
  },
  pinnedBadgeText: {
    fontSize: 7.5,
    fontFamily: 'Inter_700Bold',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  photoDocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoDocText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // Hero Row
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  portraitBox: {
    width: 44,
    height: 54, // 3:4 Aspect ratio
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  portraitImg: {
    width: '100%',
    height: '100%',
  },
  portraitBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  cardName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },

  // No-Photo Luxury Hero Block
  noPhotoHeroBlock: {
    marginVertical: 2,
    gap: 4,
  },
  cardNameLarge: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  noPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  noPhotoBadgeText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  emblemBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCrest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  modernCrestText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  icChipLarge: {
    width: 34,
    height: 24,
    borderRadius: 5,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // IC Chip
  icChip: {
    width: 30,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  icChipInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  icLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // 2-Column Ledger
  ledgerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    rowGap: 2,
  },
  ledgerGridFull: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  ledgerItem: {
    width: '50%',
  },
  ledgerLabel: {
    fontSize: 7.5,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  ledgerValue: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Footer Row
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  securityStatusText: {
    fontSize: 8.5,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
  },
  flipBtnText: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  maskBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },

  // Back Face
  magneticStripe: {
    height: 34,
    marginTop: 14,
    width: '100%',
  },
  cardBackImg: {
    ...StyleSheet.absoluteFillObject,
  },
  backContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  signatureStrip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sigLabel: {
    fontSize: 7,
    fontFamily: 'Inter_700Bold',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  sigLine: {
    marginTop: 1,
  },
  sigName: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontStyle: 'italic',
    color: '#1F2937',
  },
  backCredentialsBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 3,
  },
  backCredTitle: {
    fontSize: 7.5,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
  },
  backCredLabel: {
    fontSize: 7,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
  backCredValue: {
    fontSize: 9.5,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  backNotes: {
    fontSize: 10.5,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 15,
  },
  backEmpty: {
    fontSize: 9.5,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  backFlipRow: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backFlipHint: {
    fontSize: 8.5,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.45)',
  },
});
