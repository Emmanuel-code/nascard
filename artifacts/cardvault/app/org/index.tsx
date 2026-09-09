import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';

interface OrgHubScreenProps {
  isTabScreen?: boolean;
}

export default function OrgHubScreen({ isTabScreen = false }: OrgHubScreenProps) {
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

  const [activeTab, setActiveTab] = useState<'join' | 'manage'>('join');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [codeInputFocused, setCodeInputFocused] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
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
      {/* ── Top Nav Header ── */}
      <View style={[styles.navBar, { paddingTop: topPad + 10, borderColor: colors.border }]}>
        {!isTabScreen ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.navBackBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="business" size={22} color={colors.primary} />
          </View>
        )}
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {isTabScreen ? 'Pass Studio' : 'Organization Hub'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/org/scan-verify' as any)}
          style={[styles.scannerNavBtn, { backgroundColor: colors.primary + '18' }]}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Segmented Control Bar ── */}
      <View style={[styles.segmentContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setActiveTab('join')}
          style={[
            styles.segmentBtn,
            activeTab === 'join' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={activeTab === 'join' ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.segmentText,
              { color: activeTab === 'join' ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            Join Digital Pass
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => setActiveTab('manage')}
          style={[
            styles.segmentBtn,
            activeTab === 'manage' && { backgroundColor: colors.primary },
          ]}
        >
          <Ionicons
            name="briefcase-outline"
            size={16}
            color={activeTab === 'manage' ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.segmentText,
              { color: activeTab === 'manage' ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            My Managed Orgs ({managedOrgs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TAB 1: JOIN DIGITAL PASS ── */}
        {activeTab === 'join' && (
          <View style={styles.tabContent}>
            {/* Quick Claim Box */}
            <View style={[styles.claimBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.claimHeader}>
                <View style={[styles.claimIcon, { backgroundColor: colors.primary + '18' }]}>
                  <Ionicons name="key-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.claimTitle, { color: colors.foreground }]}>Enter Org Invite Code</Text>
                  <Text style={[styles.claimSub, { color: colors.mutedForeground }]}>
                    Claim your digital pass for school, gym, or work.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.codeInputWrap,
                  {
                    backgroundColor: colors.background,
                    borderColor: codeInputFocused ? colors.primary : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.codeInput, { color: colors.foreground }]}
                  placeholder="e.g. APEX2026"
                  placeholderTextColor={colors.mutedForeground}
                  value={inviteCodeInput}
                  onChangeText={(t) => {
                    setInviteCodeInput(t);
                    setJoinError('');
                  }}
                  autoCapitalize="characters"
                  onFocus={() => setCodeInputFocused(true)}
                  onBlur={() => setCodeInputFocused(false)}
                  returnKeyType="go"
                  onSubmitEditing={handleJoinByCode}
                />
                <TouchableOpacity
                  style={[
                    styles.codeSubmitBtn,
                    { backgroundColor: inviteCodeInput.trim() ? colors.primary : colors.muted },
                  ]}
                  onPress={handleJoinByCode}
                  disabled={isJoining || !inviteCodeInput.trim()}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              {joinError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{joinError}</Text>
                </View>
              ) : null}

              {/* Demo Shortcut */}
              <TouchableOpacity
                style={[styles.demoBtn, { backgroundColor: colors.primary + '10' }]}
                onPress={() => router.push('/org/join/org_demo_gym' as any)}
              >
                <Ionicons name="sparkles" size={15} color={colors.primary} />
                <Text style={[styles.demoBtnText, { color: colors.primary }]}>
                  Try Demo Pass: Apex Fitness Gym
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Issued Member Cards in Wallet */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Active Digital Passes</Text>

              {partnerCards.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="card-outline" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No digital passes claimed yet</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    Enter your organization code above or scan your membership QR code to add your digital ID card.
                  </Text>
                </View>
              ) : (
                partnerCards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={[
                      styles.partnerCardRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => router.push(`/card/${card.id}`)}
                    activeOpacity={0.85}
                  >
                    {card.logoUri ? (
                      <Image source={{ uri: card.logoUri }} style={styles.cardLogo} contentFit="contain" />
                    ) : (
                      <View style={[styles.cardLogoFallback, { backgroundColor: (card.primaryColor || colors.primary) + '22' }]}>
                        <Ionicons name="shield-checkmark" size={22} color={card.primaryColor || colors.primary} />
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {card.title}
                        </Text>
                        <View style={[styles.verifiedPill, { backgroundColor: colors.primary + '20' }]}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                          <Text style={[styles.verifiedText, { color: colors.primary }]}>VERIFIED</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {card.nameOnCard || card.orgName || 'Official Member Pass'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}

        {/* ── TAB 2: MY MANAGED ORGANIZATIONS ── */}
        {activeTab === 'manage' && (
          <View style={styles.tabContent}>
            {/* Create Studio Launch Banner */}
            <TouchableOpacity
              style={[styles.createStudioBanner, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/org/create' as any)}
              activeOpacity={0.88}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.studioTitle, { color: colors.primaryForeground }]}>
                  Launch Card Studio 🚀
                </Text>
                <Text style={[styles.studioSub, { color: colors.primaryForeground + 'DD' }]}>
                  Issue custom digital member cards for your Gym, School, or Corporate office.
                </Text>
              </View>
              <Ionicons name="add-circle" size={28} color={colors.primaryForeground} />
            </TouchableOpacity>

            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Organizations</Text>

              {managedOrgs.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="business-outline" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No organizations created yet</Text>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                    Tap "Launch Card Studio" above to create your organization and invite members to claim digital cards.
                  </Text>
                </View>
              ) : (
                managedOrgs.map((org) => (
                  <TouchableOpacity
                    key={org.id}
                    style={[
                      styles.orgCardRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => router.push(`/org/manage/${org.id}` as any)}
                    activeOpacity={0.85}
                  >
                    {org.logoUri ? (
                      <Image source={{ uri: org.logoUri }} style={styles.cardLogo} contentFit="contain" />
                    ) : (
                      <View style={[styles.cardLogoFallback, { backgroundColor: (org.primaryColor || colors.primary) + '22' }]}>
                        <Ionicons name="business" size={22} color={org.primaryColor || colors.primary} />
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {org.name}
                        </Text>
                        <View style={[styles.catPill, { backgroundColor: colors.primary + '1F' }]}>
                          <Text style={[styles.catPillText, { color: colors.primary }]}>
                            {org.category.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.orgBotRow}>
                        <Text style={[styles.orgStatText, { color: colors.foreground }]}>
                          <Ionicons name="people" size={13} color={colors.primary} /> {org.activeMemberCount || 0} Members
                        </Text>
                        <Text style={[styles.orgCodeText, { color: colors.mutedForeground }]}>
                          Code: <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>{org.inviteCode}</Text>
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
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
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 16, gap: 16 },
  tabContent: { gap: 16 },

  // Claim Box
  claimBox: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 14 },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  claimIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  claimTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  claimSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  codeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 48,
  },
  codeInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  codeSubmitBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#EF4444' },
  demoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  demoBtnText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Section
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  partnerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardLogo: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#00000010' },
  cardLogoFallback: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  emptyBox: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 18 },

  // Manage Tab
  createStudioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  studioTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  studioSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2, lineHeight: 16 },
  orgCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  catPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  catPillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  orgBotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orgStatText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  orgCodeText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
