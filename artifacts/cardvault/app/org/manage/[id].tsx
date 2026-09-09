import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
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

import {
  GH_MOMO_PROVIDERS,
  GH_BANKS,
  NG_BANKS,
  FLW_PROVIDERS,
  formatAmount,
  getCurrencyCode,
  getWithdrawalRegion,
  getRegionLabel,
  getProvidersForRegion,
  type WithdrawalProvider,
} from '@/lib/currency';

export default function OrgManagerDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    getOrgDetails,
    getOrgMembers,
    bulkAddOrgMembers,
    revokeMember,
    requestWithdrawal,
    bulkExpireOrgMembers,
    bulkRevokeOrgMembers,
    deleteOrg,
    resetManagerPin,
  } = useOrg();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPosterModal, setShowPosterModal] = useState(false);

  // Payout / Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCoAdminModal, setShowCoAdminModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  const [coAdminEmail, setCoAdminEmail] = useState('');
  const [coAdminName, setCoAdminName] = useState('');
  const [handoverEmail, setHandoverEmail] = useState('');
  const [handoverName, setHandoverName] = useState('');
  const [handoverPin, setHandoverPin] = useState('');
  const [upgradeBillingCycle, setUpgradeBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'momo' | 'bank'>('momo');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<WithdrawalProvider>(GH_MOMO_PROVIDERS[0]!);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [managerPinInput, setManagerPinInput] = useState('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Security PIN Reset Modal
  const [showPinResetModal, setShowPinResetModal] = useState(false);
  const [pinResetStep, setPinResetStep] = useState<'request' | 'verify'>('request');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');

  // Danger Zone Org Deletion Modal
  const [showDeleteOrgModal, setShowDeleteOrgModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletePinInput, setDeletePinInput] = useState('');
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const handleBulkCsvImport = async () => {
    if (!csvText.trim()) {
      Alert.alert('CSV Text Required', 'Please paste CSV rows (e.g., Name, Email, MemberID or custom columns).');
      return;
    }
    setIsImportingCsv(true);
    try {
      const lines = csvText.trim().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) {
        Alert.alert('Empty CSV', 'No data found.');
        return;
      }

      // Helper function to split CSV line safely handling quotes
      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const firstLineParts = parseCsvLine(lines[0]!);
      
      // Determine if the first line is a header
      const headerCandidates = firstLineParts.map((h) => h.toLowerCase());
      const hasHeader = headerCandidates.some((h) =>
        ['name', 'full name', 'fullname', 'first name', 'firstname', 'email', 'e-mail', 'id', 'member id', 'student id', 'index number', 'matric'].some(
          (k) => h.includes(k)
        )
      );

      let headers: string[] = [];
      let dataRowsStartIndex = 0;

      if (hasHeader) {
        headers = firstLineParts;
        dataRowsStartIndex = 1;
      } else {
        // Default positional headers if no header detected
        headers = ['Name', 'Email', 'Member ID'];
        dataRowsStartIndex = 0;
      }

      // Map headers to standard fields vs custom fields
      let nameIndex = -1;
      let emailIndex = -1;
      let idIndex = -1;
      const customFieldIndices: { index: number; key: string }[] = [];

      headers.forEach((hdr, idx) => {
        const norm = hdr.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (nameIndex === -1 && (norm.includes('name') || norm === 'member' || norm === 'student')) {
          nameIndex = idx;
        } else if (emailIndex === -1 && (norm.includes('email') || norm.includes('mail'))) {
          emailIndex = idx;
        } else if (idIndex === -1 && (norm.includes('id') || norm.includes('index') || norm.includes('matric') || norm.includes('number') || norm.includes('code'))) {
          idIndex = idx;
        } else {
          customFieldIndices.push({ index: idx, key: hdr });
        }
      });

      // Fallbacks if not auto-detected
      if (nameIndex === -1 && headers.length > 0) nameIndex = 0;
      if (emailIndex === -1 && headers.length > 1) emailIndex = 1;
      if (idIndex === -1 && headers.length > 2) idIndex = 2;

      const newMembers: OrgMember[] = [];
      let importedCount = 0;

      for (let i = dataRowsStartIndex; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]!);
        if (parts.length === 0 || !parts[nameIndex]?.trim()) continue;

        const mName = parts[nameIndex]!.trim();
        const mEmail = (emailIndex !== -1 && parts[emailIndex]?.trim())
          ? parts[emailIndex]!.trim()
          : `${mName.toLowerCase().replace(/[^a-z0-9]/g, '')}@nascard.app`;
        const mId = (idIndex !== -1 && parts[idIndex]?.trim())
          ? parts[idIndex]!.trim()
          : `M-${1000 + i}`;

        // Populate all custom / unmapped columns dynamically
        const customData: Record<string, string> = {
          'Member ID': mId,
        };

        // Link with org.customFields schemas if matched
        customFieldIndices.forEach(({ index, key }) => {
          if (parts[index] && parts[index]?.trim()) {
            customData[key] = parts[index]!.trim();
          }
        });

        // Also check if any org custom fields can be populated by header name
        if (org?.customFields) {
          org.customFields.forEach((cf) => {
            const matchHdr = headers.findIndex((h) => h.toLowerCase() === cf.label.toLowerCase() || h.toLowerCase() === cf.key.toLowerCase());
            if (matchHdr !== -1 && parts[matchHdr]) {
              customData[cf.label] = parts[matchHdr]!.trim();
              customData[cf.key] = parts[matchHdr]!.trim();
            }
          });
        }

        newMembers.push({
          id: `mem_csv_${Date.now()}_${i}`,
          orgId: org?.id || id || 'org',
          memberName: mName,
          memberEmail: mEmail,
          customFieldsData: customData,
          status: 'active',
          verificationToken: `vtoken_${org?.id || id}_mem_${Date.now()}_${i}`,
          joinedAt: new Date().toISOString(),
        });
        importedCount++;
      }

      if (importedCount > 0) {
        const targetOrgId = org?.id || id || 'org';
        await bulkAddOrgMembers(targetOrgId, newMembers);
        setMembers((prev) => [...prev, ...newMembers]);
        if (org) {
          setOrg({
            ...org,
            activeMemberCount: (org.activeMemberCount || 0) + importedCount,
          });
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const joinLink = `nascard://org/join/${org?.id || id}`;

        Alert.alert(
          'Smart Import Complete! 🎉',
          `Successfully processed ${importedCount} member passes with dynamic column mapping.\n\nDetected Fields: ${headers.join(', ')}\n\nMembers can claim their cards immediately via the invite code or join link.\n\nJoin Link: ${joinLink}`,
          [
            {
              text: 'Copy Join Link',
              onPress: () => {
                Share.share({ message: `Claim your official ${org?.name || 'Campus'} Digital Pass on nascard: ${joinLink}` });
              },
            },
            { text: 'Done', style: 'cancel' },
          ]
        );
        setShowCsvModal(false);
        setCsvText('');
      } else {
        Alert.alert('No Valid Rows', 'Could not parse any member rows. Please check your CSV data.');
      }
    } catch (e) {
      console.warn('Import error:', e);
      Alert.alert('Import Error', 'Failed to process CSV import.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleAddCoAdmin = async () => {
    if (!org) return;
    if (!coAdminEmail.trim() || !coAdminName.trim()) {
      Alert.alert('Missing Fields', 'Please enter both name and email for the co-admin.');
      return;
    }
    const updatedAdmins = [
      ...(org.coAdmins || []),
      {
        email: coAdminEmail.trim(),
        name: coAdminName.trim(),
        role: 'admin' as const,
        addedAt: new Date().toISOString(),
      },
    ];
    const updatedOrg = { ...org, coAdmins: updatedAdmins };
    setOrg(updatedOrg);
    setShowCoAdminModal(false);
    setCoAdminEmail('');
    setCoAdminName('');
    Alert.alert('Co-Admin Added 🎉', `${coAdminName.trim()} can now log in and manage ${org.name}.`);
  };

  const handleRemoveCoAdmin = (emailToRemove: string) => {
    if (!org) return;
    Alert.alert('Remove Co-Admin', `Revoke admin access for ${emailToRemove}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          const updated = (org.coAdmins || []).filter((a) => a.email !== emailToRemove);
          setOrg({ ...org, coAdmins: updated });
        },
      },
    ]);
  };

  const handleHandoverOwnership = async () => {
    if (!org) return;
    if (!handoverEmail.trim() || !handoverName.trim()) {
      Alert.alert('Fields Required', 'Please enter the new owner name and email.');
      return;
    }
    if (org.managerPin && handoverPin.trim() !== org.managerPin) {
      Alert.alert('Incorrect PIN', 'The manager PIN entered is invalid.');
      return;
    }
    const updatedOrg = {
      ...org,
      managerEmail: handoverEmail.trim(),
      managerName: handoverName.trim(),
    };
    setOrg(updatedOrg);
    setShowHandoverModal(false);
    setHandoverEmail('');
    setHandoverName('');
    setHandoverPin('');
    Alert.alert(
      'Ownership Transferred! 🤝',
      `Full organization control of ${org.name} has been transferred to ${handoverName.trim()} (${handoverEmail.trim()}).`,
    );
  };

  const [showDbExportModal, setShowDbExportModal] = useState(false);
  const [dbExportFormat, setDbExportFormat] = useState<'csv' | 'json' | 'sql'>('sql');
  const [showPvcPrintModal, setShowPvcPrintModal] = useState(false);
  const [selectedMemberToPrint, setSelectedMemberToPrint] = useState<OrgMember | null>(null);

  const handleExportCSV = async () => {
    if (!org || members.length === 0) {
      Alert.alert('No Members', 'There are no member records to export.');
      return;
    }
    const headers = ['Member ID', 'Member Name', 'Email', 'Status', 'Joined Date', 'Expires Date', 'Verification Token'];
    const rows = members.map((m) => [
      `"${m.id}"`,
      `"${m.memberName}"`,
      `"${m.memberEmail || ''}"`,
      `"${m.status}"`,
      `"${new Date(m.joinedAt).toLocaleDateString()}"`,
      `"${m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : 'Permanent'}"`,
      `"${m.verificationToken}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    try {
      await Share.share({ message: csvContent, title: `${org.name}_Roster.csv` });
    } catch (e) {
      console.warn('CSV share error:', e);
    }
  };

  const handleExportJSON = async () => {
    if (!org || members.length === 0) return;
    const jsonContent = JSON.stringify(
      {
        organizationId: org.id,
        organizationName: org.name,
        exportedAt: new Date().toISOString(),
        totalMembers: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.memberName,
          email: m.memberEmail || null,
          status: m.status,
          joinedAt: m.joinedAt,
          expiresAt: m.expiresAt || null,
          verificationToken: m.verificationToken,
          customFields: m.customFieldsData || {},
        })),
      },
      null,
      2,
    );
    try {
      await Share.share({ message: jsonContent, title: `${org.name}_Database_Schema.json` });
    } catch (e) {
      console.warn('JSON share error:', e);
    }
  };

  const handleExportSQL = async () => {
    if (!org || members.length === 0) return;
    const sqlHeader = `-- nascard School / Org Database Import Script\n-- Target: PostgreSQL / MySQL / SQLite\n-- Organization: ${org.name}\n-- Total Roster: ${members.length} records\n\n`;
    const sqlInserts = members
      .map(
        (m) =>
          `INSERT INTO members (id, org_id, member_name, email, status, joined_at, verification_token) VALUES ('${m.id}', '${org.id}', '${m.memberName.replace(/'/g, "''")}', '${m.memberEmail || ''}', '${m.status}', '${m.joinedAt}', '${m.verificationToken}');`,
      )
      .join('\n');
    const fullSql = sqlHeader + sqlInserts;
    try {
      await Share.share({ message: fullSql, title: `${org.name}_Roster_Import.sql` });
    } catch (e) {
      console.warn('SQL share error:', e);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = React.useCallback(async (showRefreshingSpinner = false) => {
    if (!id) return;
    if (showRefreshingSpinner) setIsRefreshing(true);
    try {
      const [orgRes, memberRes] = await Promise.all([
        getOrgDetails(id),
        getOrgMembers(id),
      ]);
      if (orgRes) setOrg(orgRes);
      if (memberRes) setMembers(memberRes);
    } catch (err) {
      console.warn('[Org Dashboard] Refresh error:', err);
    } finally {
      setIsLoading(false);
      if (showRefreshingSpinner) setIsRefreshing(false);
    }
  }, [id, getOrgDetails, getOrgMembers]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    loadDashboardData(false);
  }, [loadDashboardData]);

  // Real-time automatic background polling every 12 seconds
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      loadDashboardData(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [id, loadDashboardData]);

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
    const currency = org.currency || getCurrencyCode(org.country);
    const region = org.withdrawalRegion || getWithdrawalRegion(org.country);

    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }

    if (amt > available) {
      Alert.alert('Insufficient Balance', `You can only withdraw up to ${formatAmount(available, currency)}.`);
      return;
    }

    const rawNum = accountNumber.replace(/[\s\-\+]/g, '');
    if (rawNum.length < 9 || rawNum.length > 15) {
      Alert.alert(
        'Invalid Phone / Account Number',
        region === 'gh' && payoutMethod === 'momo'
          ? 'Please enter a valid Mobile Money phone number (e.g. 0241234567 or +233241234567).'
          : 'Please enter a valid account number.',
      );
      return;
    }

    if (region === 'manual') {
      Alert.alert(
        'Manual Payout Request',
        'Your withdrawal request has been received. Our team will contact your account manager email to process this transfer within 2–3 business days.',
      );
    }

    // Security PIN Enforcement
    const expectedPin = org.managerPin || '1234';
    if (managerPinInput.trim() !== expectedPin) {
      Alert.alert(
        'Security PIN Required',
        'The Manager PIN you entered is incorrect. Please enter your 4-digit security PIN or tap "Forgot PIN" to reset it via your manager email.',
      );
      return;
    }

    setIsSubmittingPayout(true);
    try {
      const updatedOrg = await requestWithdrawal(org.id, {
        amount: amt,
        bankCode: selectedProvider.code,
        bankName: selectedProvider.name,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim() || org.managerName,
      });

      setOrg(updatedOrg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setAccountNumber('');
      setAccountName('');
      setManagerPinInput('');

      Alert.alert(
        'Payout Requested! 💸',
        `${formatAmount(amt, currency)} withdrawal to ${selectedProvider.name} (${accountNumber.trim()}) has been submitted.`,
      );
    } catch (e: any) {
      Alert.alert('Payout Failed', e?.message || 'Failed to process payout. Please try again.');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleBulkExpire = () => {
    if (!org || members.length === 0) {
      Alert.alert('No Members', 'No members exist to expire.');
      return;
    }
    Alert.alert(
      'Bulk Expire Passes ⚠️',
      `This will mark ALL ${members.length} members as EXPIRED (e.g. End of Semester / Annual Renewal). Members will need to renew to regain entry. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Expire All Passes',
          style: 'destructive',
          onPress: async () => {
            const count = await bulkExpireOrgMembers(org.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setMembers((prev) => prev.map((m) => ({ ...m, status: 'expired' as const })));
            Alert.alert('Bulk Expiration Complete', `Successfully marked ${count} member passes as expired.`);
          },
        },
      ],
    );
  };

  const handleBulkRevoke = () => {
    if (!org || members.length === 0) {
      Alert.alert('No Members', 'No members exist to revoke.');
      return;
    }
    Alert.alert(
      'Bulk Revoke All Passes 🛑',
      `EMERGENCY: This will immediately revoke gate access for ALL ${members.length} members. Door scanners will reject their QR codes instantly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke All Immediately',
          style: 'destructive',
          onPress: async () => {
            const count = await bulkRevokeOrgMembers(org.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setMembers((prev) => prev.map((m) => ({ ...m, status: 'revoked' as const })));
            Alert.alert('Emergency Revocation Executed', `${count} member credentials have been revoked.`);
          },
        },
      ],
    );
  };

  const handleSendPinResetOtp = async () => {
    if (!org?.managerEmail) {
      Alert.alert('No Manager Email', 'This organization does not have an admin email configured.');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setPinResetStep('verify');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Security Code Dispatched ✉️',
      `A 6-digit PIN reset code has been generated for ${org.managerEmail}.\n\nReset OTP: ${code}\n(In production, this is emailed automatically to ${org.managerEmail})`,
    );
  };

  const handleConfirmPinReset = async () => {
    if (inputOtp.trim() !== generatedOtp) {
      Alert.alert('Invalid OTP', 'The 6-digit verification code is incorrect.');
      return;
    }
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      Alert.alert('Invalid PIN', 'Please enter a valid 4-digit numerical PIN.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      Alert.alert('PIN Mismatch', 'New PIN and confirmation PIN do not match.');
      return;
    }

    if (!org) return;
    await resetManagerPin(org.id, newPinInput);
    setOrg({ ...org, managerPin: newPinInput });
    setShowPinResetModal(false);
    setInputOtp('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinResetStep('request');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Security PIN Updated! 🔐', 'Your Manager PIN has been successfully reset.');
  };

  const handleDeleteOrg = async () => {
    if (!org) return;
    if (deleteConfirmationText.trim().toLowerCase() !== org.name.trim().toLowerCase()) {
      Alert.alert('Confirmation Mismatch', `Please type "${org.name}" exactly to confirm.`);
      return;
    }
    const expectedPin = org.managerPin || '1234';
    if (deletePinInput.trim() !== expectedPin) {
      Alert.alert('Invalid PIN', 'The manager PIN entered is incorrect.');
      return;
    }

    setIsDeletingOrg(true);
    try {
      await deleteOrg(org.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeleteOrgModal(false);
      Alert.alert(
        'Organization Deleted',
        `"${org.name}" has been permanently closed. All member passes have been invalidated.`,
        [{ text: 'OK', onPress: () => router.replace('/org') }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete organization.');
    } finally {
      setIsDeletingOrg(false);
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
  const orgCurrency = org.currency || getCurrencyCode(org.country);
  const orgRegion = org.withdrawalRegion || getWithdrawalRegion(org.country);
  const hasMomoOption = orgRegion === 'gh';
  const currentProviders = getProvidersForRegion(orgRegion, payoutMethod);

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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadDashboardData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
                  {formatAmount(netBalance, orgCurrency)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowWithdrawModal(true)}
                disabled={netBalance <= 0}
              >
                <Ionicons name="cash-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.withdrawActionText, { color: colors.primaryForeground }]}>
                  {netBalance > 0 ? `Payout (${getRegionLabel(orgRegion)})` : 'No Funds'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 3 Grid Financial Breakdowns */}
            <View style={styles.ledgerGrid}>
              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Gross Collected</Text>
                <Text style={[styles.gridVal, { color: colors.foreground }]}>
                  {formatAmount(gross, orgCurrency)}
                </Text>
              </View>

              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>3% Platform Fee</Text>
                <Text style={[styles.gridVal, { color: '#F59E0B' }]}>
                  {formatAmount(platformCut, orgCurrency)}
                </Text>
              </View>

              <View style={[styles.gridBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.gridLabel, { color: colors.mutedForeground }]}>Total Withdrawn</Text>
                <Text style={[styles.gridVal, { color: colors.foreground }]}>
                  {formatAmount(totalWithdrawn, orgCurrency)}
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
                      +{formatAmount(p.amount, orgCurrency)}
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

          {/* Enterprise Team Governance & Handover Card */}
          <View style={[styles.ledgerCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 14 }]}>
            <View style={styles.ledgerHeader}>
              <View style={styles.ledgerTitleBox}>
                <Ionicons name="people-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.ledgerTitle, { color: colors.foreground }]}>Team Admins & Ownership</Text>
              </View>
              <View style={[styles.feeCutTag, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.feeCutText, { color: colors.primary }]}>
                  {org.coAdmins?.length || 0} Co-Admins
                </Text>
              </View>
            </View>

            <Text style={[styles.activeInfoSub, { color: colors.mutedForeground, marginVertical: 6 }]}>
              Primary Owner: <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>{org.managerName}</Text> ({org.managerEmail})
            </Text>

            {/* List of Co-Admins */}
            {org.coAdmins && org.coAdmins.length > 0 ? (
              <View style={{ gap: 8, marginVertical: 10 }}>
                {org.coAdmins.map((admin) => (
                  <View
                    key={admin.email}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                        {admin.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                        {admin.email} · {admin.role.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveCoAdmin(admin.email)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Action Buttons: Add Co-Admin & Handover Ownership */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, { flex: 1, backgroundColor: colors.primary }]}
                onPress={() => setShowCoAdminModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={15} color={colors.primaryForeground} />
                <Text style={[styles.withdrawActionBtnText, { color: colors.primaryForeground }]}>Add Co-Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.withdrawActionBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setShowHandoverModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal-outline" size={15} color={colors.foreground} />
                <Text style={[styles.withdrawActionBtnText, { color: colors.foreground }]}>Handover Pass</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Member Roster Section */}
          <View style={styles.rosterHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Member Roster</Text>
              <TouchableOpacity onPress={() => setShowCsvModal(true)} style={[styles.exportCsvBtn, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
                <Text style={[styles.exportCsvText, { color: colors.primary }]}>Bulk CSV Import</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDbExportModal(true)} style={[styles.exportCsvBtn, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="server-outline" size={14} color={colors.primary} />
                <Text style={[styles.exportCsvText, { color: colors.primary }]}>DB Export</Text>
              </TouchableOpacity>
              {members.length > 0 && (
                <>
                  <TouchableOpacity onPress={handleBulkExpire} style={[styles.exportCsvBtn, { backgroundColor: '#F59E0B20' }]}>
                    <Ionicons name="time-outline" size={14} color="#F59E0B" />
                    <Text style={[styles.exportCsvText, { color: '#F59E0B' }]}>Expire All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleBulkRevoke} style={[styles.exportCsvBtn, { backgroundColor: '#EF444420' }]}>
                    <Ionicons name="ban-outline" size={14} color="#EF4444" />
                    <Text style={[styles.exportCsvText, { color: '#EF4444' }]}>Revoke All</Text>
                  </TouchableOpacity>
                </>
              )}
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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMemberToPrint(member);
                      setShowPvcPrintModal(true);
                    }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="print-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>

                  {member.status === 'active' && (
                    <TouchableOpacity onPress={() => handleRevoke(member)} style={styles.revokeBtn}>
                      <Ionicons name="ban-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Danger Zone: Permanent Organization Shutdown */}
          <View style={[styles.ledgerCard, { backgroundColor: '#EF444410', borderColor: '#EF444440', marginTop: 24, marginBottom: 40 }]}>
            <View style={styles.ledgerHeader}>
              <View style={styles.ledgerTitleBox}>
                <Ionicons name="warning-outline" size={20} color="#EF4444" />
                <Text style={[styles.ledgerTitle, { color: '#EF4444' }]}>Danger Zone</Text>
              </View>
              <View style={[styles.feeCutTag, { backgroundColor: '#EF444420' }]}>
                <Text style={[styles.feeCutText, { color: '#EF4444' }]}>Permanent</Text>
              </View>
            </View>

            <Text style={[styles.activeInfoSub, { color: colors.mutedForeground }]}>
              Deleting this organization permanently disables all member credentials, cancels digital passes, and purges database records. This cannot be undone.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.withdrawActionBtn, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setShowPinResetModal(true)}
              >
                <Ionicons name="key-outline" size={15} color={colors.foreground} />
                <Text style={[styles.withdrawActionBtnText, { color: colors.foreground }]}>Reset Security PIN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.withdrawActionBtn, { flex: 1, backgroundColor: '#EF4444' }]}
                onPress={() => setShowDeleteOrgModal(true)}
              >
                <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                <Text style={[styles.withdrawActionBtnText, { color: '#FFFFFF' }]}>Delete Organization</Text>
              </TouchableOpacity>
            </View>
          </View>
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

            {/* Region badge */}
            <View style={[styles.availBox, { backgroundColor: colors.primary + '12', marginBottom: 4 }]}>
              <Ionicons name="globe-outline" size={14} color={colors.primary} />
              <Text style={[styles.availLabel, { color: colors.primary, flex: 1 }]}>
                Payout Region: <Text style={{ fontFamily: 'Inter_700Bold' }}>{getRegionLabel(orgRegion)}</Text>
              </Text>
            </View>

            {/* Manual info banner */}
            {orgRegion === 'manual' ? (
              <View style={[styles.availBox, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40', borderWidth: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: '#F59E0B', fontSize: 13 }}>
                  📞 Contact Nascard Office / Dev
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                  Automated payouts currently run via Paystack (Ghana & Nigeria). For payouts outside these countries, submit your request below or contact Nascard office support.
                </Text>
              </View>
            ) : null}

            {/* Method Tabs: only show MoMo tab for Ghana */}
            {hasMomoOption ? (
              <View style={[styles.tabToggleRow, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                  style={[styles.tabToggleBtn, payoutMethod === 'momo' && { backgroundColor: colors.primary }]}
                  onPress={() => { setPayoutMethod('momo'); setSelectedProvider(GH_MOMO_PROVIDERS[0]!); }}
                >
                  <Ionicons name="phone-portrait-outline" size={16} color={payoutMethod === 'momo' ? colors.primaryForeground : colors.foreground} />
                  <Text style={[styles.tabToggleText, { color: payoutMethod === 'momo' ? colors.primaryForeground : colors.foreground }]}>
                    Mobile Money
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabToggleBtn, payoutMethod === 'bank' && { backgroundColor: colors.primary }]}
                  onPress={() => { setPayoutMethod('bank'); setSelectedProvider(GH_BANKS[0]!); }}
                >
                  <Ionicons name="business-outline" size={16} color={payoutMethod === 'bank' ? colors.primaryForeground : colors.foreground} />
                  <Text style={[styles.tabToggleText, { color: payoutMethod === 'bank' ? colors.primaryForeground : colors.foreground }]}>
                    Ghana Bank
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles.availBox, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.availLabel, { color: colors.mutedForeground }]}>Available Balance:</Text>
              <Text style={[styles.availVal, { color: colors.primary }]}>
                {formatAmount(netBalance, orgCurrency)}
              </Text>
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Amount to Withdraw ({orgCurrency})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder={`Max ${formatAmount(netBalance, orgCurrency)}`}
                placeholderTextColor={colors.mutedForeground}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="numeric"
              />
            </View>

            {/* Provider Selector — only show chips when providers exist for region */}
            {currentProviders.length > 0 ? (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                  {hasMomoOption && payoutMethod === 'momo' ? 'Select MoMo Network' : 'Select Bank / Provider'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {currentProviders.map((b) => {
                    const isSelected = selectedProvider.code === b.code;
                    return (
                      <TouchableOpacity
                        key={b.code}
                        style={[styles.bankChip, { backgroundColor: isSelected ? colors.primary : colors.background, borderColor: isSelected ? colors.primary : colors.border }]}
                        onPress={() => setSelectedProvider(b)}
                      >
                        <Text style={[styles.bankChipText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>
                          {b.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {/* Account / Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                {orgRegion === 'gh' && payoutMethod === 'momo'
                  ? 'MoMo Phone Number'
                  : orgRegion === 'manual'
                  ? 'Account / SWIFT / IBAN Number'
                  : 'Bank Account Number'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder={
                  orgRegion === 'gh' && payoutMethod === 'momo'
                    ? 'e.g. 0241234567 or +233241234567'
                    : 'e.g. 10123456789'
                }
                placeholderTextColor={colors.mutedForeground}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                maxLength={orgRegion === 'manual' ? 64 : 20}
                autoCapitalize="none"
              />
            </View>

            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Account Holder Name (Optional)</Text>
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Manager Security PIN *</Text>
                <TouchableOpacity onPress={() => setShowPinResetModal(true)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                    Forgot PIN?
                  </Text>
                </TouchableOpacity>
              </View>
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
                {isSubmittingPayout ? 'Processing Payout...' : 'Confirm Payout Request'}
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
                {(() => {
                  const isCurrentExact = (org.tier || 'starter') === 'pro' && (org.billingCycle || 'monthly') === upgradeBillingCycle;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.tierOptionBox,
                        {
                          backgroundColor: isCurrentExact ? colors.primary + '18' : colors.background,
                          borderColor: colors.primary,
                          borderWidth: isCurrentExact ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleUpgrade('pro')}
                      disabled={isUpgrading || isCurrentExact}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.tierOptionTitle, { color: colors.foreground }]}>
                          Pro Tier {isCurrentExact ? '✓ (Active)' : org.tier === 'pro' ? '🔄 (Switch Cycle)' : ''}
                        </Text>
                        <Text style={[styles.tierOptionPrice, { color: colors.primary }]}>
                          {upgradeBillingCycle === 'monthly' ? 'GH₵ 199 / mo' : 'GH₵ 1,800 / yr'}
                        </Text>
                      </View>
                      <Text style={[styles.tierOptionSub, { color: colors.mutedForeground }]}>
                        Up to 500 active members + fee collection + custom card themes + door scanner
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                {/* Enterprise Tier Option */}
                {(() => {
                  const isCurrentExact = (org.tier || 'starter') === 'enterprise' && (org.billingCycle || 'monthly') === upgradeBillingCycle;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.tierOptionBox,
                        {
                          backgroundColor: isCurrentExact ? '#8B5CF618' : colors.background,
                          borderColor: '#8B5CF6',
                          borderWidth: isCurrentExact ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleUpgrade('enterprise')}
                      disabled={isUpgrading || isCurrentExact}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.tierOptionTitle, { color: colors.foreground }]}>
                          Enterprise Tier {isCurrentExact ? '✓ (Active)' : org.tier === 'enterprise' ? '🔄 (Switch Cycle)' : ''}
                        </Text>
                        <Text style={[styles.tierOptionPrice, { color: '#8B5CF6' }]}>
                          {upgradeBillingCycle === 'monthly' ? 'GH₵ 1,499 / mo' : 'GH₵ 12,000 / yr'}
                        </Text>
                      </View>
                      <Text style={[styles.tierOptionSub, { color: colors.mutedForeground }]}>
                        Up to 10,000 active members + multi-admin accounts + priority support (Best for Universities & High Schools)
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Add Co-Admin Modal ── */}
        <Modal
          visible={showCoAdminModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCoAdminModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Add Team Co-Admin</Text>
                <TouchableOpacity onPress={() => setShowCoAdminModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 12 }]}>
                Grant administrative management access for {org.name} to a colleague.
              </Text>

              <View style={{ gap: 10 }}>
                <TextInput
                  value={coAdminName}
                  onChangeText={setCoAdminName}
                  placeholder="Co-Admin Name (e.g. Sarah Connor)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                <TextInput
                  value={coAdminEmail}
                  onChangeText={setCoAdminEmail}
                  placeholder="Co-Admin Email (e.g. sarah@org.com)"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                onPress={handleAddCoAdmin}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>Confirm Add Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Bulk CSV Import Modal ── */}
        <Modal
          visible={showCsvModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCsvModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                  <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Bulk CSV Member Import</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCsvModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 10 }]}>
                Paste CSV data with any column layout. Headers are auto-detected (e.g. <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>Name, Email, Student ID, Department, Phone</Text>). All custom fields are preserved on digital passes!
              </Text>

              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                placeholder={`Name, Email, Student ID, Department\nKwame Asante, kwame@school.edu.gh, ASH-2026-001, Computer Science\nAma Serwaa, ama@school.edu.gh, ASH-2026-002, Business Admin`}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
                style={[
                  styles.withdrawInput,
                  {
                    height: 120,
                    textAlignVertical: 'top',
                    paddingTop: 10,
                    color: colors.foreground,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    fontSize: 12,
                  },
                ]}
              />

              <TouchableOpacity
                style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                onPress={handleBulkCsvImport}
                disabled={isImportingCsv}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>
                  {isImportingCsv ? 'Processing Import...' : 'Import & Issue Passes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Handover Ownership Modal ── */}
        <Modal
          visible={showHandoverModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHandoverModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Transfer Pass Ownership</Text>
                <TouchableOpacity onPress={() => setShowHandoverModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 12 }]}>
                Handover full control, financial payout authority, and manager privileges for {org.name} to a new owner.
              </Text>

              <View style={{ gap: 10 }}>
                <TextInput
                  value={handoverName}
                  onChangeText={setHandoverName}
                  placeholder="New Primary Owner Name"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                <TextInput
                  value={handoverEmail}
                  onChangeText={setHandoverEmail}
                  placeholder="New Owner Email Address"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                {org.managerPin ? (
                  <TextInput
                    value={handoverPin}
                    onChangeText={setHandoverPin}
                    placeholder="Enter Current Manager PIN to confirm"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    secureTextEntry
                    style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.submitWithdrawBtn, { backgroundColor: '#FF6B6B', marginTop: 14 }]}
                onPress={handleHandoverOwnership}
                activeOpacity={0.85}
              >
                <Text style={[styles.submitWithdrawBtnText, { color: '#FFFFFF' }]}>Confirm Transfer Ownership</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Database Export Studio Modal ── */}
        <Modal
          visible={showDbExportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDbExportModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Database Export Studio</Text>
                <TouchableOpacity onPress={() => setShowDbExportModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 12 }]}>
                Export {members.length} member records for school management systems (SIS), PostgreSQL, MySQL, or Excel.
              </Text>

              {/* Format Switcher Pills */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                {[
                  { id: 'sql', label: '🗄️ SQL Inserts' },
                  { id: 'csv', label: '📊 CSV / Excel' },
                  { id: 'json', label: '{ } JSON Schema' },
                ].map((fmt) => (
                  <TouchableOpacity
                    key={fmt.id}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: dbExportFormat === fmt.id ? colors.primary + '20' : colors.background,
                      borderColor: dbExportFormat === fmt.id ? colors.primary : colors.border,
                      borderWidth: 1,
                    }}
                    onPress={() => setDbExportFormat(fmt.id as any)}
                  >
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: dbExportFormat === fmt.id ? colors.primary : colors.foreground }}>
                      {fmt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description box per format */}
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }}>
                {dbExportFormat === 'sql' ? (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 18 }}>
                    • <Text style={{ fontFamily: 'Inter_700Bold' }}>SQL Script</Text>: Generates ready-to-run <Text style={{ fontFamily: 'Inter_600SemiBold' }}>INSERT INTO members (...)</Text> statements for PostgreSQL, MySQL, or SQLite.
                  </Text>
                ) : dbExportFormat === 'csv' ? (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 18 }}>
                    • <Text style={{ fontFamily: 'Inter_700Bold' }}>CSV Roster</Text>: Clean spreadsheet file ready for Microsoft Excel, Google Sheets, or School Admin import.
                  </Text>
                ) : (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 18 }}>
                    • <Text style={{ fontFamily: 'Inter_700Bold' }}>JSON Array</Text>: Formatted raw payload with custom field schemas for MongoDB, Firebase, or custom school APIs.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowDbExportModal(false);
                  if (dbExportFormat === 'sql') handleExportSQL();
                  else if (dbExportFormat === 'json') handleExportJSON();
                  else handleExportCSV();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="download-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>
                  Generate & Share {dbExportFormat.toUpperCase()} File
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Printable Physical PVC ID Card Studio Modal ── */}
        <Modal
          visible={showPvcPrintModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPvcPrintModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                  <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Physical PVC Card Studio</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPvcPrintModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 10 }]}>
                Standard CR80 Credit-Card Format (85.6mm x 53.98mm) for physical PVC ID printer.
              </Text>

              {/* Physical CR80 Card Preview */}
              {selectedMemberToPrint && (
                <View
                  style={{
                    width: '100%',
                    height: 180,
                    borderRadius: 14,
                    backgroundColor: primaryColor,
                    padding: 14,
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' }}>{org.name}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: org.cardLayout === 'executive_gold' ? '#FFD700' : '#F59E0B', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      {(org.cardLayout || 'OFFICIAL ID').toUpperCase().replace('_', ' ')}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
                    {selectedMemberToPrint.photoUri ? (
                      <Image source={{ uri: selectedMemberToPrint.photoUri }} style={{ width: 44, height: 54, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B' }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' }}>
                          {selectedMemberToPrint.memberName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' }}>{selectedMemberToPrint.memberName}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)' }}>
                        {selectedMemberToPrint.memberEmail || 'Verified Passholder'}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: org.cardLayout === 'executive_gold' ? '#FFD700' : '#F59E0B', marginTop: 4 }}>
                        Token: {selectedMemberToPrint.verificationToken.slice(0, 12)}...
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)' }}>
                      CR80 PVC High-Res Printable Pass (300 DPI)
                    </Text>
                    <Ionicons name="qr-code-outline" size={20} color={org.cardLayout === 'executive_gold' ? '#FFD700' : '#F59E0B'} />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                onPress={async () => {
                  if (!selectedMemberToPrint) return;
                  const printPayload = `nascard Physical PVC ID Card Spec:\nOrganization: ${org.name}\nName: ${selectedMemberToPrint.memberName}\nEmail: ${selectedMemberToPrint.memberEmail || 'N/A'}\nVerification Token: ${selectedMemberToPrint.verificationToken}\nFormat: CR80 Standard (85.6mm x 53.98mm)\nPrint Resolution: 300 DPI`;
                  try {
                    await Share.share({ message: printPayload, title: `${selectedMemberToPrint.memberName}_PVC_Card.txt` });
                  } catch (e) {
                    console.warn('Print share error:', e);
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="print-outline" size={16} color={colors.primaryForeground} />
                <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>Print / Export CR80 Physical Card Spec</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── Security PIN Reset Modal (Email OTP) ── */}
        <Modal
          visible={showPinResetModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPinResetModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.withdrawModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="key-outline" size={20} color={colors.primary} />
                  <Text style={[styles.withdrawModalTitle, { color: colors.foreground }]}>Reset Manager PIN</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPinResetModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 10 }]}>
                {pinResetStep === 'request'
                  ? `Send a secure 6-digit confirmation code to your registered admin email (${org.managerEmail}) to authorize resetting your security PIN.`
                  : `Enter the 6-digit OTP code sent to ${org.managerEmail} along with your new 4-digit PIN.`}
              </Text>

              {pinResetStep === 'request' ? (
                <TouchableOpacity
                  style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={handleSendPinResetOtp}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>
                    Send Reset Code to {org.managerEmail}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 10 }}>
                  <TextInput
                    value={inputOtp}
                    onChangeText={setInputOtp}
                    placeholder="6-digit Verification Code (OTP)"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                  <TextInput
                    value={newPinInput}
                    onChangeText={setNewPinInput}
                    placeholder="New 4-digit PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                  <TextInput
                    value={confirmPinInput}
                    onChangeText={setConfirmPinInput}
                    placeholder="Confirm New 4-digit PIN"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                  <TouchableOpacity
                    style={[styles.submitWithdrawBtn, { backgroundColor: colors.primary, marginTop: 6 }]}
                    onPress={handleConfirmPinReset}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.submitWithdrawBtnText, { color: colors.primaryForeground }]}>Confirm & Save PIN</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ── Danger Zone: Delete Organization Modal ── */}
        <Modal
          visible={showDeleteOrgModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDeleteOrgModal(false)}
        >
          <View style={styles.withdrawModalOverlay}>
            <View style={[styles.withdrawModalCard, { backgroundColor: colors.card, borderColor: '#EF4444' }]}>
              <View style={styles.withdrawModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text style={[styles.withdrawModalTitle, { color: '#EF4444' }]}>Delete Organization</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDeleteOrgModal(false)}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.withdrawModalSub, { color: colors.mutedForeground, marginBottom: 8 }]}>
                This action is IRREVERSIBLE. To confirm, type the full organization name: <Text style={{ fontFamily: 'Inter_700Bold', color: colors.foreground }}>{org.name}</Text>
              </Text>

              <View style={{ gap: 10 }}>
                <TextInput
                  value={deleteConfirmationText}
                  onChangeText={setDeleteConfirmationText}
                  placeholder={`Type "${org.name}"`}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                <TextInput
                  value={deletePinInput}
                  onChangeText={setDeletePinInput}
                  placeholder="Manager Security PIN"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  style={[styles.withdrawInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                />

                <TouchableOpacity
                  style={[
                    styles.submitWithdrawBtn,
                    {
                      backgroundColor:
                        deleteConfirmationText.trim().toLowerCase() === org.name.trim().toLowerCase()
                          ? '#EF4444'
                          : colors.muted,
                      marginTop: 6,
                    },
                  ]}
                  onPress={handleDeleteOrg}
                  disabled={
                    deleteConfirmationText.trim().toLowerCase() !== org.name.trim().toLowerCase() ||
                    isDeletingOrg
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                  <Text style={[styles.submitWithdrawBtnText, { color: '#FFFFFF' }]}>
                    {isDeletingOrg ? 'Deleting Organization...' : 'Permanently Delete Organization'}
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
  withdrawModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  withdrawModalCard: { width: '100%', maxWidth: 440, borderRadius: 20, borderWidth: 1, padding: 20, gap: 10 },
  withdrawModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  withdrawModalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  withdrawModalSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  withdrawInput: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: 'Inter_500Medium' },
  submitWithdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12 },
  submitWithdrawBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  activeInfoSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  withdrawActionBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
});
