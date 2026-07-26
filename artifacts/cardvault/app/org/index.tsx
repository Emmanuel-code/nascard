import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';
import { useFocusEffect } from '@react-navigation/native';

export default function OrgHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { managedOrgs, getOrgDetails, loadLocalManagedOrgs } = useOrg();
  const { cards } = useCards();

  useFocusEffect(
    useCallback(() => {
      loadLocalManagedOrgs();
    }, [loadLocalManagedOrgs])
  );

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [codeInputFocused, setCodeInputFocused] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Filter cards to show partner-issued cards in wallet
  const partnerCards = cards.filter((c) => c.isPartnerIssued);

  const handleJoinByCode = async () => {
    const code = inviteCodeInput.trim();
    if (!code) return;
    setIsJoining(true);
    setJoinError('');
    try {
      const org = await getOrgDetails(code);
      if (org) {
        setInviteCodeInput('');
        setJoinModalVisible(false);
        router.push(`/org/join/${org.id}` as any);
      } else {
        setJoinError('Organization not found. Try "APEX2026" for a demo pass.');
      }
    } catch {
      setJoinError('Connection error. Please check network.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Top Navigation Header ── */}
      <View style={[styles.navBar, { paddingTop: topPad + 10, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Partner & Org Hub</Text>
        <TouchableOpacity
          onPress={() => router.push('/org/scan-verify' as any)}
          style={[styles.scannerNavBtn, { backgroundColor: colors.primary + '18' }]}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Feature Hero Banner ── */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.heroBanner}
        >
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroTag}>
              <Ionicons name="shield-checkmark" size={13} color="#F59E0B" />
              <Text style={styles.heroTagText}>OFFICIAL DIGITAL PASSES</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Organization Hub</Text>
          <Text style={styles.heroSub}>
            Replace physical plastic IDs with dynamic, tamper-proof digital passes for gyms, schools, clubs & workplaces.
          </Text>

          {/* Quick Info Points */}
          <View style={styles.heroFeatureGrid}>
            <View style={styles.heroFeatureItem}>
              <Ionicons name="qr-code-outline" size={16} color="#60A5FA" />
              <Text style={styles.heroFeatureText}>Live Dynamic QR</Text>
            </View>
            <View style={styles.heroFeatureItem}>
              <Ionicons name="flash-outline" size={16} color="#34D399" />
              <Text style={styles.heroFeatureText}>Instant Issuance</Text>
            </View>
            <View style={styles.heroFeatureItem}>
              <Ionicons name="lock-closed-outline" size={16} color="#F472B6" />
              <Text style={styles.heroFeatureText}>Verified Badge</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Pathway Selection ── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose Your Path</Text>

        <View style={styles.pathwayContainer}>
          {/* PATHWAY 1: Member / Student */}
          <TouchableOpacity
            style={[styles.pathwayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setJoinModalVisible(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#3B82F61A', '#1D4ED805']}
              style={styles.pathwayGradient}
            >
              <View style={styles.pathwayTop}>
                <View style={[styles.pathwayIconWrap, { backgroundColor: '#3B82F622' }]}>
                  <Ionicons name="ticket" size={26} color="#3B82F6" />
                </View>
                <View style={styles.pathwayRoleBadge}>
                  <Text style={styles.pathwayRoleText}>MEMBERS & STUDENTS</Text>
                </View>
              </View>

              <Text style={[styles.pathwayTitle, { color: colors.foreground }]}>
                Join an Organization
              </Text>
              <Text style={[styles.pathwaySub, { color: colors.mutedForeground }]}>
                Have an invite code or link? Claim your official digital pass for your school, gym, or club.
              </Text>

              <View style={[styles.pathwayActionBtn, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="key-outline" size={16} color="#fff" />
                <Text style={styles.pathwayActionText}>Enter Invite Code</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 'auto' }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* PATHWAY 2: Organization Admin / Owner */}
          <TouchableOpacity
            style={[styles.pathwayCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/org/create' as any)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#8B5CF61A', '#6D28D905']}
              style={styles.pathwayGradient}
            >
              <View style={styles.pathwayTop}>
                <View style={[styles.pathwayIconWrap, { backgroundColor: '#8B5CF622' }]}>
                  <Ionicons name="business" size={26} color="#8B5CF6" />
                </View>
                <View style={[styles.pathwayRoleBadge, { backgroundColor: '#8B5CF622' }]}>
                  <Text style={[styles.pathwayRoleText, { color: '#8B5CF6' }]}>ADMINS & MANAGERS</Text>
                </View>
              </View>

              <Text style={[styles.pathwayTitle, { color: colors.foreground }]}>
                Create Partner Pass
              </Text>
              <Text style={[styles.pathwaySub, { color: colors.mutedForeground }]}>
                Design digital cards, add required fields, issue invite links, and scan member check-ins.
              </Text>

              <View style={[styles.pathwayActionBtn, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.pathwayActionText}>Create Pass Studio</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 'auto' }} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Partner Passes in Wallet (If any exist) ── */}
        {partnerCards.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Your Digital Passes
              </Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {partnerCards.length}
              </Text>
            </View>

            {partnerCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[styles.partnerCardRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/card/${card.id}`)}
                activeOpacity={0.8}
              >
                <View style={[styles.partnerCardAccent, { backgroundColor: card.primaryColor || colors.primary }]} />
                <View style={styles.partnerCardBody}>
                  <View style={styles.partnerCardTop}>
                    <Text style={[styles.partnerCardTitle, { color: colors.foreground }]}>{card.title}</Text>
                    <View style={[styles.verifiedPill, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                      <Text style={[styles.verifiedText, { color: colors.primary }]}>VERIFIED</Text>
                    </View>
                  </View>
                  <Text style={[styles.partnerCardName, { color: colors.mutedForeground }]}>
                    {card.nameOnCard || card.orgName || 'Official Pass'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Managed Organizations ── */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
              Managed Organizations
            </Text>
            <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
              {managedOrgs.length}
            </Text>
          </View>

          {managedOrgs.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="briefcase-outline" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No organizations created yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                If you manage a gym, school, or club, tap "Create Partner Pass" to issue passes to your members.
              </Text>
            </View>
          ) : (
            managedOrgs.map((org) => (
              <TouchableOpacity
                key={org.id}
                style={[styles.orgCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/org/manage/${org.id}` as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.orgAccent, { backgroundColor: org.primaryColor || colors.primary }]} />
                <View style={styles.orgBody}>
                  <View style={styles.orgTopRow}>
                    <Text style={[styles.orgName, { color: colors.foreground }]}>{org.name}</Text>
                    <View style={[styles.catBadge, { backgroundColor: colors.primary + '1A' }]}>
                      <Text style={[styles.catBadgeText, { color: colors.primary }]}>
                        {org.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orgBotRow}>
                    <Text style={[styles.orgMemberStat, { color: colors.foreground }]}>
                      <Ionicons name="people" size={13} color={colors.primary} /> {org.activeMemberCount || 0} Members
                    </Text>
                    <Text style={[styles.orgCodeText, { color: colors.mutedForeground }]}>
                      Code: <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>{org.inviteCode}</Text>
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} style={{ marginRight: 12 }} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Join Code Modal ── */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setJoinModalVisible(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#3B82F622' }]}>
                <Ionicons name="key-outline" size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Enter Invite Code</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Enter your school, gym, or group code to claim your pass.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Input */}
            <View style={[
              styles.modalInputWrap,
              {
                backgroundColor: colors.background,
                borderColor: codeInputFocused ? '#3B82F6' : colors.border,
              },
            ]}>
              <TextInput
                style={[styles.modalInput, { color: colors.foreground }]}
                placeholder="e.g. APEX2026"
                placeholderTextColor={colors.mutedForeground}
                value={inviteCodeInput}
                onChangeText={(t) => { setInviteCodeInput(t); setJoinError(''); }}
                autoCapitalize="characters"
                onFocus={() => setCodeInputFocused(true)}
                onBlur={() => setCodeInputFocused(false)}
                returnKeyType="go"
                onSubmitEditing={handleJoinByCode}
              />
            </View>

            {joinError ? (
              <View style={styles.modalErrorRow}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={styles.modalErrorText}>{joinError}</Text>
              </View>
            ) : null}

            {/* Action button */}
            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                { backgroundColor: inviteCodeInput.trim() ? '#3B82F6' : colors.muted },
              ]}
              onPress={handleJoinByCode}
              disabled={isJoining || !inviteCodeInput.trim()}
              activeOpacity={0.85}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitText}>Claim Digital Pass</Text>
              )}
            </TouchableOpacity>

            {/* Demo Org Shortcut */}
            <TouchableOpacity
              style={[styles.demoShortcut, { backgroundColor: colors.primary + '10' }]}
              onPress={() => {
                setJoinModalVisible(false);
                router.push('/org/join/org_demo_gym' as any);
              }}
            >
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={[styles.demoShortcutText, { color: colors.primary }]}>
                Try Demo: Apex Fitness Gym Pass
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navBackBtn: { padding: 4 },
  navTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  scannerNavBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 20 },

  // Hero Banner
  heroBanner: {
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBadgeRow: { flexDirection: 'row' },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroTagText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#F59E0B', letterSpacing: 1 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#fff' },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  heroFeatureGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  heroFeatureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroFeatureText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.85)' },

  // Pathway selection
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  pathwayContainer: { gap: 14 },
  pathwayCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  pathwayGradient: { padding: 18, gap: 10 },
  pathwayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pathwayIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pathwayRoleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#3B82F622' },
  pathwayRoleText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#3B82F6', letterSpacing: 0.8 },
  pathwayTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  pathwaySub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  pathwayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  pathwayActionText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Sections
  sectionBlock: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Partner Cards list
  partnerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  partnerCardAccent: { width: 6, height: '100%' },
  partnerCardBody: { flex: 1, padding: 14, gap: 4 },
  partnerCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partnerCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  partnerCardName: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  // Empty box
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },

  // Managed Org card
  orgCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  orgAccent: { width: 6, height: '100%' },
  orgBody: { flex: 1, padding: 14, gap: 6 },
  orgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orgName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  orgBotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  orgMemberStat: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  orgCodeText: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { borderRadius: 24, borderTopWidth: 1, padding: 20, gap: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  modalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 1 },
  modalCloseBtn: { padding: 4 },
  modalInputWrap: { borderRadius: 12, borderWidth: 1.5, height: 50, paddingHorizontal: 14 },
  modalInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  modalErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalErrorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#EF4444' },
  modalSubmitBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  demoShortcut: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  demoShortcutText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
