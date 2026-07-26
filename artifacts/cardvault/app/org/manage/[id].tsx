import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrg } from '@/contexts/OrgContext';
import { useColors } from '@/hooks/useColors';
import type { Organization, OrgMember, OrganizationPayoutRecord } from '@/types/card';

const MOMO_PROVIDERS = [
  { code: 'MTN', name: 'MTN Mobile Money' },
  { code: 'VODAFONE', name: 'Telecel Cash' },
  { code: 'AIRTELTIGO', name: 'AirtelTigo Money' },
];

const GHANA_BANKS = [
  { code: 'GCB', name: 'GCB Bank' },
  { code: 'ECOBANK', name: 'Ecobank Ghana' },
  { code: 'STANBIC', name: 'Stanbic Bank Ghana' },
  { code: 'ABSA', name: 'Absa Bank Ghana' },
  { code: 'FIDELITY', name: 'Fidelity Bank Ghana' },
  { code: 'CALBANK', name: 'CalBank' },
  { code: 'ACCESS_GH', name: 'Access Bank Ghana' },
  { code: 'CBG', name: 'Consolidated Bank Ghana (CBG)' },
];

export default function OrgManagerDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getOrgDetails, getOrgMembers, revokeMember, requestWithdrawal } = useOrg();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPosterModal, setShowPosterModal] = useState(false);

  // Payout / Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeBillingCycle, setUpgradeBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'momo' | 'bank'>('momo');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMomo, setSelectedMomo] = useState(MOMO_PROVIDERS[0]!);
  const [selectedBank, setSelectedBank] = useState(GHANA_BANKS[0]!);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [managerPinInput, setManagerPinInput] = useState('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  const handleExportCSV = async () => {
    if (!org || members.length === 0) {
      Alert.alert('No Members', 'There are no member records to export.');
      return;
    }
    const headers = ['Member Name', 'Email', 'Status', 'Joined Date', 'Expires Date', 'Verification Token'];
    const rows = members.map((m) => [
      `"${m.memberName}"`,
      `"${m.memberEmail || ''}"`,
      `"${m.status}"`,
      `"${new Date(m.joinedAt).toLocaleDateString()}"`,
      `"${m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : 'Permanent'}"`,
      `"${m.verificationToken}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const msg = `nascard Member Roster for ${org.name} (${members.length} members):\n\n${csvContent.slice(0, 500)}...`;
    try {
      await Share.share({ message: msg, title: `${org.name}_Member_Roster.csv` });
    } catch (e) {
      console.warn('CSV share error:', e);
    }
  };

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([getOrgDetails(id), getOrgMembers(id)])
      .then(([orgRes, memberRes]) => {
        if (orgRes) setOrg(orgRes);
        setMembers(memberRes);
      })
      .finally(() => setIsLoading(false));
  }, [id, getOrgDetails, getOrgMembers]);

  const handleShareInvite = async () => {
    if (!org) return;
    const inviteLink = `nascard://org/join/${org.id}`;
    const msg = `Join ${org.name} on nascard to claim your digital pass! Invite Code: ${org.inviteCode}\nLink: ${inviteLink}`;
    try {
      await Share.share({ message: msg });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleRevoke = (member: OrgMember) => {
    Alert.alert(
      'Revoke Member',
      `Are you sure you want to revoke ${member.memberName}'s access pass? They will no longer be able to scan or use this pass.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            if (!org) return;
            await revokeMember(org.id, member.id);
            setMembers((prev) =>
              prev.map((m) => (m.id === member.id ? { ...m, status: 'revoked' } : m)),
            );
          },
        },
      ],
    );
  };

  const handleProcessWithdrawal = async () => {
    if (!org) return;
    const amt = Number(withdrawAmount);
    const available = org.netBalance || 0;

    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }

    if (amt > available) {
      Alert.alert('Insufficient Balance', `You can only withdraw up to GH₵${available.toLocaleString()}.`);
      return;
    }

    if (accountNumber.trim().length < 9) {
      Alert.alert(
        'Invalid Account Number',
        payoutMethod === 'momo'
          ? 'Please enter a valid Mobile Money phone number (e.g. 024XXXXXXX).'
          : 'Please enter a valid Ghana bank account number.',
      );
      return;
    }

    const providerObj = payoutMethod === 'momo' ? selectedMomo : selectedBank;

    setIsSubmittingPayout(true);
    try {
      const updatedOrg = await requestWithdrawal(org.id, {
        amount: amt,
        bankCode: providerObj.code,
        bankName: providerObj.name,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim() || org.managerName,
      });

      setOrg(updatedOrg);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setAccountNumber('');
      setAccountName('');

      Alert.alert(
        'Payout Sent! 📱💸',
        `GH₵${amt.toLocaleString()} has been transferred to ${providerObj.name} (${accountNumber.trim()}).`,
      );
    } catch (e: any) {
      Alert.alert('Payout Failed', e?.message || 'Failed to process payout. Please try again.');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleUpgrade = async (targetTier: 'pro' | 'enterprise') => {
    if (!org) return;
    setIsUpgrading(true);
    try {
      setShowUpgradeModal(false);
      const amountGhs = targetTier === 'pro'
        ? (upgradeBillingCycle === 'monthly' ? 199 : 1800)
        : (upgradeBillingCycle === 'monthly' ? 1499 : 12000);

      const apiBase = process.env.EXPO_PUBLIC_DOMAIN || 'https://nascard-api.onrender.com';
      let authUrl = '';

      try {
        const resp = await fetch(`${apiBase}/api/paystack/pro-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: org.managerEmail || 'admin@nascard.app',
            amount: amountGhs,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          authUrl = data.authorizationUrl || '';
        }
      } catch (e) {
        console.warn('Paystack init fallback:', e);
      }

      // Navigate to Paystack WebView payment screen
      router.push({
        pathname: '/org/payment',
        params: {
          authorizationUrl: authUrl,
          orgId: `org_plan_${org.id}`,
          reference: `nascard_upgrade_${targetTier}_${org.id}_${Date.now()}`,
          memberName: `${org.name} (${targetTier.toUpperCase()} ${upgradeBillingCycle.toUpperCase()} Tier)`,
          memberEmail: org.managerEmail || 'admin@nascard.app',
        },
      } as any);

      const newLimit = targetTier === 'pro' ? 500 : 10000;
      setOrg({ ...org, tier: targetTier, memberLimit: newLimit, billingCycle: upgradeBillingCycle });
    } catch (e) {
      Alert.alert('Error', 'Upgrade failed. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading || !org) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="briefcase-outline" size={32} color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.foreground }]}>Loading Dashboard...</Text>
      </View>
    );
  }

  const primaryColor = org.primaryColor || colors.primary;
  const gross = org.totalGrossRevenue || 0;
  const platformCut = org.platformFeeCollected || 0;
  const netBalance = org.netBalance || 0;
  const totalWithdrawn = org.totalWithdrawn || 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]} numberOfLines={1}>
          {org.name} Dashboard
        </Text>
        <TouchableOpacity onPress={handleShareInvite} style={styles.shareHeaderBtn}>
          <Ionicons name="share-social-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Org Banner Card */}
        <View style={[styles.dashboardBanner, { backgroundColor: primaryColor }]}>
          <View style={styles.dashboardBannerHeader}>
            <View>
              <Text style={styles.dashBannerTag}>{org.category.toUpperCase()}</Text>
              <Text style={styles.dashBannerName}>{org.name}</Text>
              <Text style={styles.dashBannerLoc}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />{' '}
                {org.location || 'Official Pass'}
              </Text>
            </View>
            <View style={styles.inviteBadgeBox}>
              <Text style={styles.inviteBadgeTitle}>INVITE CODE</Text>
              <Text style={styles.inviteBadgeCode}>{org.inviteCode}</Text>
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={[styles.bannerActionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => setShowPosterModal(!showPosterModal)}
            >
              <Ionicons name="qr-code" size={16} color="#FFFFFF" />
              <Text style={styles.bannerActionText}>Front Desk QR Poster</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bannerActionBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => router.push('/org/scan-verify' as any)}
            >
              <Ionicons name="scan" size={16} color="#FFFFFF" />
              <Text style={styles.bannerActionText}>Check-in Scanner</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Organization Quota & Upgrade Card ── */}
        <View style={[styles.tierQuotnascard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tierQuotaRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.tierQuotaTitle, { color: colors.foreground }]}>
                    {(org.tier || 'starter').toUpperCase()} TIER PLAN
                  </Text>
                  <View style={{ backgroundColor: (org.tier || 'starter') === 'starter' ? '#10B98122' : '#3B82F622', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: (org.tier || 'starter') === 'starter' ? '#10B981' : '#3B82F6' }}>
                      {(org.tier || 'starter') === 'starter' ? 'FREE' : 'PRO'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tierQuotaSub, { color: colors.mutedForeground, marginTop: 2 }]}>
                  {members.length} of {org.memberLimit || 25} active member slots used
                </Text>
              </View>
              {(org.tier || 'starter') === 'enterprise' ? (
                <View style={[styles.upgradeBtn, { backgroundColor: '#8B5CF622', borderColor: '#8B5CF6', borderWidth: 1 }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#8B5CF6" />
                  <Text style={[styles.upgradeBtnText, { color: '#8B5CF6' }]}>Enterprise Active</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowUpgradeModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up-circle-outline" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.upgradeBtnText, { color: colors.primaryForeground }]}>Upgrade Tier</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Member usage progress bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: (members.length / (org.memberLimit || 25)) >= 0.8 ? '#EF4444' : colors.primary,
                    width: `${Math.min(100, Math.round((members.length / (org.memberLimit || 25)) * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Financial & Revenue Ledger */}
          <View style={[styles.ledgerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.ledgerHeader}>
              <View style={styles.ledgerTitleBox}>
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
                <Text style={[styles.ledgerTitle, { color: colors.foreground }]}>Financial & Payout Ledger</Text>
              </View>
              <View style={[styles.feeCutTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.feeCutText, { color: colors.primary }]}>3% Dev Commission</Text>
              </View>
            </View>

            {/* Net Available Highlight */}
            <View style={[styles.balanceBanner, { backgroundColor: primaryColor + '10', borderColor: primaryColor + '30' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balanceSubLabel, { color: colors.mutedForeground }]}>Available Net Balance</Text>
                <Text style={[styles.balanceBigText, { color: colors.primary }]}>
                  GH₵{netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowWithdrawModal(true)}
                disabled={netBalance <= 0}
              >
                <Ionicons name="cash-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.withdrawActionText, { color: colors.primaryForeground }]}>
                  {netBalance > 0 ? 'Payout (MoMo/Bank)' : 'No Funds'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 3 Grid Financial Breakdowns */}
            <View style={styles.ledgerGrid}>
              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Gross Collected</Text>
                <Text style={[styles.gridVal, { color: colors.foreground }]}>
                  GH₵{gross.toLocaleString()}
                </Text>
              </View>

              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>3% Platform Fee</Text>
                <Text style={[styles.gridVal, { color: '#F59E0B' }]}>
                  GH₵{platformCut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Total Withdrawn</Text>
                <Text style={[styles.gridVal, { color: colors.foreground }]}>
                  GH₵{totalWithdrawn.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Recent Payouts List */}
            {org.payoutHistory && org.payoutHistory.length > 0 ? (
              <View style={styles.payoutHistoryBox}>
                <Text style={[styles.payoutHistoryTitle, { color: colors.mutedForeground }]}>Recent Payout Transfers</Text>
                {org.payoutHistory.slice(0, 3).map((p) => (
                  <View key={p.id} style={[styles.payoutItem, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.payoutBank, { color: colors.foreground }]}>
                        {p.bankName} ({p.accountNumber})
                      </Text>
                      <Text style={[styles.payoutRef, { color: colors.mutedForeground }]}>
                        Ref: {p.reference} • {new Date(p.requestedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={[styles.payoutAmount, { color: '#10B981' }]}>
                      +GH₵{p.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Printable Front Desk QR Poster Modal View */}
          {showPosterModal && (
            <View style={[styles.posterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.posterHeader}>
                <Ionicons name="print" size={20} color={colors.primary} />
                <Text style={[styles.posterTitle, { color: colors.foreground }]}>Printable Front Desk QR Poster</Text>
              </View>
              <Text style={[styles.posterSub, { color: colors.mutedForeground }]}>
                Display this QR code at your front desk or gym entrance so members can scan and download their pass!
              </Text>

              <View style={styles.qrCenter}>
                <View style={styles.qrBorderBox}>
                  <QRCode value={`nascard://org/join/${org.id}`} size={160} color="#000000" backgroundColor="#FFFFFF" />
                </View>
                <Text style={[styles.qrCodeText, { color: colors.foreground }]}>Code: {org.inviteCode}</Text>
              </View>

              <TouchableOpacity
                style={[styles.sharePosterBtn, { backgroundColor: colors.primary }]}
                onPress={handleShareInvite}
              >
                <Ionicons name="share-outline" size={18} color={colors.primaryForeground} />
                <Text style={[styles.sharePosterBtnText, { color: colors.primaryForeground }]}>Share Poster Link</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Member Roster Section */}
          <View style={styles.rosterHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Member Roster</Text>
              <TouchableOpacity onPress={handleExportCSV} style={[styles.exportCsvBtn, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={[styles.exportCsvText, { color: colors.primary }]}>Export CSV</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.rosterCount, { color: colors.mutedForeground }]}>
              {members.length} / {org.memberLimit}
            </Text>
          </View>

          {members.length === 0 ? (
            <View style={[styles.emptyRoster, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="people-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyRosterTitle, { color: colors.foreground }]}>No members joined yet</Text>
              <Text style={[styles.emptyRosterSub, { color: colors.mutedForeground }]}>
                Share your invite code <Text style={{ fontFamily: 'Inter_700Bold' }}>{org.inviteCode}</Text> or display your front desk QR poster!
              </Text>
            </View>
          ) : (
            members.map((member) => (
              <View key={member.id} style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatarBox, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons name="person" size={20} color={primaryColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.memberCardTop}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{member.memberName}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor:
                            member.status === 'active'
                              ? '#10B98120'
                              : member.status === 'revoked'
                                ? '#EF444420'
                                : '#F59E0B20',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color:
                              member.status === 'active'
                                ? '#10B981'
                                : member.status === 'revoked'
                                  ? '#EF4444'
                                  : '#F59E0B',
                          },
                        ]}
                      >
                        {member.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.memberSubText, { color: colors.mutedForeground }]}>
                    Joined: {new Date(member.joinedAt).toLocaleDateString()}
                  </Text>
                  {member.customFieldsData['member_id'] ? (
                    <Text style={[styles.memberSubText, { color: colors.mutedForeground }]}>
                      ID: {member.customFieldsData['member_id']}
                    </Text>
                  ) : null}
                </View>

                {member.status === 'active' && (
                  <TouchableOpacity onPress={() => handleRevoke(member)} style={styles.revokeBtn}>
                    <Ionicons name="ban-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
      </ScrollView>

      {/* Withdrawal / Payout Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="cash-outline" size={24} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Revenue Payout</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Withdraw your net revenue via Mobile Money (MoMo) or Ghana Bank Transfer.
            </Text>

            {/* Method Tabs: MoMo vs Bank */}
            <View style={[styles.tabToggleRow, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[
                  styles.tabToggleBtn,
                  payoutMethod === 'momo' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setPayoutMethod('momo')}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={16}
                  color={payoutMethod === 'momo' ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    { color: payoutMethod === 'momo' ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  Mobile Money (MoMo)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabToggleBtn,
                  payoutMethod === 'bank' && { backgroundColor: colors.primary },
                ]}
                onPress={() => setPayoutMethod('bank')}
              >
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={payoutMethod === 'bank' ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.tabToggleText,
                    { color: payoutMethod === 'bank' ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  Ghana Bank
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.availBox, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.availLabel, { color: colors.mutedForeground }]}>Available Net Balance:</Text>
              <Text style={[styles.availVal, { color: colors.primary }]}>
                GH₵{netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Amount to Withdraw (GH₵)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder={`Max GH₵${netBalance.toLocaleString()}`}
                placeholderTextColor={colors.mutedForeground}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
              />
            </View>

            {/* Provider Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {payoutMethod === 'momo' ? 'Select MoMo Network' : 'Select Ghana Bank'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(payoutMethod === 'momo' ? MOMO_PROVIDERS : GHANA_BANKS).map((b) => {
                  const isSelected =
                    payoutMethod === 'momo' ? selectedMomo.code === b.code : selectedBank.code === b.code;
                  return (
                    <TouchableOpacity
                      key={b.code}
                      style={[
                        styles.bankChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.background,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        if (payoutMethod === 'momo') setSelectedMomo(b);
                        else setSelectedBank(b);
                      }}
                    >
                      <Text
                        style={[
                          styles.bankChipText,
                          { color: isSelected ? colors.primaryForeground : colors.foreground },
                        ]}
                      >
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Account / Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {payoutMethod === 'momo' ? 'MoMo Phone Number (e.g. 024XXXXXXX)' : 'Bank Account Number'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder={payoutMethod === 'momo' ? 'e.g. 0241234567' : 'e.g. 10123456789'}
                placeholderTextColor={colors.mutedForeground}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                maxLength={12}
              />
            </View>

            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Account Name (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder={org.managerName || 'Account Holder Name'}
                placeholderTextColor={colors.mutedForeground}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>

            {/* Security PIN */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Manager Security PIN *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Enter 4-digit PIN (default 1234)"
                placeholderTextColor={colors.mutedForeground}
                value={managerPinInput}
                onChangeText={setManagerPinInput}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
              onPress={handleProcessWithdrawal}
              disabled={isSubmittingPayout}
            >
              <Ionicons name="send" size={18} color={colors.primaryForeground} />
              <Text style={[styles.modalSubmitText, { color: colors.primaryForeground }]}>
                {isSubmittingPayout ? 'Transferring Payout...' : 'Confirm Payout Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Upgrade Organization Plan Modal */}
      <Modal visible={showUpgradeModal} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="arrow-up-circle-outline" size={24} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Upgrade Organization Tier</Text>
                <TouchableOpacity onPress={() => setShowUpgradeModal(false)}>
                  <Ionicons name="close" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                Current Plan: <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>{(org.tier || 'starter').toUpperCase()}</Text> ({members.length} / {org.memberLimit || 25} Members). Upgrade your plan to increase active member capacity.
              </Text>

              {/* Billing Cycle Selector */}
              <View style={{ flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: upgradeBillingCycle === 'monthly' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setUpgradeBillingCycle('monthly')}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: upgradeBillingCycle === 'monthly' ? colors.primaryForeground : colors.foreground }}>
                    Monthly Billing
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 8,
                    backgroundColor: upgradeBillingCycle === 'yearly' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setUpgradeBillingCycle('yearly')}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: upgradeBillingCycle === 'yearly' ? colors.primaryForeground : colors.foreground }}>
                    Yearly (Save ~30%)
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {/* Pro Tier Option */}
                <TouchableOpacity
                  style={[
                    styles.tierOptionBox,
                    {
                      backgroundColor: (org.tier || 'starter') === 'pro' ? colors.primary + '18' : colors.background,
                      borderColor: colors.primary,
                      borderWidth: (org.tier || 'starter') === 'pro' ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleUpgrade('pro')}
                  disabled={isUpgrading || (org.tier || 'starter') === 'pro'}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.tierOptionTitle, { color: colors.foreground }]}>
                      Pro Tier {(org.tier || 'starter') === 'pro' ? '✓ (Current Plan)' : ''}
                    </Text>
                    <Text style={[styles.tierOptionPrice, { color: colors.primary }]}>
                      {upgradeBillingCycle === 'monthly' ? 'GH₵ 199 / mo' : 'GH₵ 1,800 / yr'}
                    </Text>
                  </View>
                  <Text style={[styles.tierOptionSub, { color: colors.mutedForeground }]}>
                    Up to 500 active members + fee collection + custom card themes + door scanner
                  </Text>
                </TouchableOpacity>

                {/* Enterprise Tier Option */}
                <TouchableOpacity
                  style={[
                    styles.tierOptionBox,
                    {
                      backgroundColor: (org.tier || 'starter') === 'enterprise' ? '#8B5CF618' : colors.background,
                      borderColor: '#8B5CF6',
                      borderWidth: (org.tier || 'starter') === 'enterprise' ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleUpgrade('enterprise')}
                  disabled={isUpgrading || (org.tier || 'starter') === 'enterprise'}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.tierOptionTitle, { color: colors.foreground }]}>
                      Enterprise Tier {(org.tier || 'starter') === 'enterprise' ? '✓ (Current Plan)' : ''}
                    </Text>
                    <Text style={[styles.tierOptionPrice, { color: '#8B5CF6' }]}>
                      {upgradeBillingCycle === 'monthly' ? 'GH₵ 1,499 / mo' : 'GH₵ 12,000 / yr'}
                    </Text>
                  </View>
                  <Text style={[styles.tierOptionSub, { color: colors.mutedForeground }]}>
                    Up to 10,000 active members + multi-admin accounts + priority support (Best for Universities & High Schools)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  shareHeaderBtn: { padding: 4 },
  scroll: { padding: 16, gap: 16 },
  dashboardBanner: {
    padding: 18,
    borderRadius: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  dashboardBannerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dashBannerTag: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.8)' },
  dashBannerName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginTop: 2 },
  dashBannerLoc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  inviteBadgeBox: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  inviteBadgeTitle: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  inviteBadgeCode: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginTop: 2 },
  bannerActions: { flexDirection: 'row', gap: 10 },
  bannerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bannerActionText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  ledgerCard: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 14 },
  ledgerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ledgerTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  feeCutTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  feeCutText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  balanceBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1 },
  balanceSubLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  balanceBigText: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 2 },
  withdrawActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  withdrawActionText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  ledgerGrid: { flexDirection: 'row', gap: 8 },
  gridBox: { flex: 1, padding: 10, borderRadius: 12, gap: 4 },
  gridLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  gridVal: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  payoutHistoryBox: { gap: 8, marginTop: 4 },
  payoutHistoryTitle: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  payoutItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1 },
  payoutBank: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  payoutRef: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  payoutAmount: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  posterCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  posterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  posterTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  posterSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  qrCenter: { alignItems: 'center', gap: 8, marginVertical: 8 },
  qrBorderBox: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16 },
  qrCodeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sharePosterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 10 },
  sharePosterBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  rosterCount: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyRoster: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyRosterTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptyRosterSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  avatarBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusPillText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  memberSubText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  revokeBtn: { padding: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1, marginLeft: 8 },
  modalSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  tabToggleRow: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  tabToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabToggleText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  availBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10 },
  availLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  availVal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  input: { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_500Medium' },
  bankChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  bankChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  modalSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, marginTop: 8 },
  modalSubmitText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  exportCsvBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  exportCsvText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  tierQuotnascard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  tierQuotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierQuotaTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  tierQuotaSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  upgradeBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressBarBg: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  tierOptionBox: { padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 4 },
  tierOptionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  tierOptionPrice: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  tierOptionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});
