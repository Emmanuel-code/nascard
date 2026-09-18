import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleExpiryNotifications,
} from '@/lib/notifications';
import { useColors } from '@/hooks/useColors';
import { getDaysUntilExpiry } from '@/types/card';
import type { Card } from '@/types/card';

const CARD_TYPE_ICONS: Record<string, { icon: string; lib: 'ionicons' | 'mci' }> = {
  id:         { icon: 'card-account-details', lib: 'mci' },
  health:     { icon: 'medical-bag', lib: 'mci' },
  loyalty:    { icon: 'star-outline', lib: 'ionicons' },
  membership: { icon: 'shield-checkmark-outline', lib: 'ionicons' },
};

function urgencyLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires TODAY';
  if (days === 1) return 'Expires TOMORROW';
  return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.45, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    ).start();
  }, [scale]);
  return (
    <Animated.View
      style={{
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: color,
        transform: [{ scale }],
      }}
    />
  );
}

function AlertCardRow({
  card,
  sectionColor,
  isUrgent,
  onPress,
}: {
  card: Card;
  sectionColor: string;
  isUrgent: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const days = getDaysUntilExpiry(card.expiryDate);
  const label = urgencyLabel(days);
  const typeInfo = CARD_TYPE_ICONS[card.cardType] ?? CARD_TYPE_ICONS.id;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.alertCard,
        { backgroundColor: colors.card, borderColor: isUrgent ? sectionColor + '55' : colors.border },
      ]}
      activeOpacity={0.78}
    >
      <View style={[styles.stripe, { backgroundColor: sectionColor }]} />
      <View style={[styles.iconBox, { backgroundColor: sectionColor + '18' }]}>
        {typeInfo.lib === 'ionicons' ? (
          <Ionicons name={typeInfo.icon as any} size={20} color={sectionColor} />
        ) : (
          <MaterialCommunityIcons name={typeInfo.icon as any} size={20} color={sectionColor} />
        )}
      </View>
      <View style={styles.alertInfo}>
        <Text style={[styles.alertTitle, { color: colors.foreground }]} numberOfLines={1}>
          {card.title}
        </Text>
        {card.nameOnCard ? (
          <Text style={[styles.alertHolder, { color: colors.mutedForeground }]} numberOfLines={1}>
            {card.nameOnCard}
          </Text>
        ) : null}
        <View style={styles.labelRow}>
          {isUrgent ? <PulseDot color={sectionColor} /> : null}
          <Text style={[styles.alertLabel, { color: sectionColor }]}>{label}</Text>
        </View>
      </View>
      <View style={[styles.openBtn, { borderColor: colors.border }]}>
        <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cards } = useCards();
  const { profile, updateProfile } = useProfile();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [toggling, setToggling] = useState(false);

  const { expiredCards, todayCards, weekCards, monthCards, allExpiring } = useMemo(() => {
    const expired: Card[] = [];
    const today: Card[] = [];
    const week: Card[] = [];
    const month: Card[] = [];
    for (const c of cards) {
      if (!c.expiryDate) continue;
      const d = getDaysUntilExpiry(c.expiryDate);
      if (isNaN(d)) continue;
      if (d < 0)    { expired.push(c); continue; }
      if (d === 0)  { today.push(c);   continue; }
      if (d <= 7)   { week.push(c);    continue; }
      if (d <= 30)  { month.push(c);   continue; }
    }
    return {
      expiredCards: expired,
      todayCards:   today,
      weekCards:    week,
      monthCards:   month,
      allExpiring:  [...expired, ...today, ...week, ...month].length,
    };
  }, [cards]);

  const sections = useMemo(() => [
    { title: 'Expired',       cards: expiredCards, color: '#EF4444', urgent: true  },
    { title: 'Expires Today', cards: todayCards,   color: '#F97316', urgent: true  },
    { title: 'This Week',     cards: weekCards,    color: '#F59E0B', urgent: false },
    { title: 'This Month',    cards: monthCards,   color: colors.foreground, urgent: false },
  ].filter(s => s.cards.length > 0), [expiredCards, todayCards, weekCards, monthCards, colors]);

  const handleToggle = async (val: boolean) => {
    if (toggling) return;
    setToggling(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (val) {
        const granted = await requestNotificationPermission();
        if (!granted) { setToggling(false); return; }
        updateProfile({ notificationsEnabled: true });
        await scheduleExpiryNotifications(cards);
      } else {
        updateProfile({ notificationsEnabled: false });
        await cancelAllNotifications();
      }
    } finally {
      setToggling(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad + 16,
            paddingBottom: Platform.OS === 'web' ? 120 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.heading, { color: colors.foreground }]}>Alerts</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {allExpiring > 0
                ? `${allExpiring} card${allExpiring !== 1 ? 's' : ''} need${allExpiring === 1 ? 's' : ''} attention`
                : 'Your vault is in great shape'}
            </Text>
          </View>

          {Platform.OS !== 'web' && (
            <View style={[styles.togglePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons
                name={profile.notificationsEnabled ? 'notifications' : 'notifications-off-outline'}
                size={16}
                color={profile.notificationsEnabled ? colors.primary : colors.mutedForeground}
              />
              <Switch
                value={!!profile.notificationsEnabled}
                onValueChange={handleToggle}
                disabled={toggling}
                trackColor={{ false: colors.muted, true: colors.primary + 'AA' }}
                thumbColor={profile.notificationsEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>
          )}
        </View>

        {/* Enable banner */}
        {Platform.OS !== 'web' && !profile.notificationsEnabled && (
          <TouchableOpacity
            style={[styles.enableBanner, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}
            onPress={() => handleToggle(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.enableIconBox, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.enableTitle, { color: colors.foreground }]}>Enable expiry reminders</Text>
              <Text style={[styles.enableSub, { color: colors.mutedForeground }]}>
                Get notified 30 &amp; 7 days before cards expire
              </Text>
            </View>
            <View style={[styles.enableBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.enableBtnText, { color: colors.primaryForeground }]}>Enable</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* All clear */}
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All cards are valid</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nothing expiring in the next 30 days.{'\n'}We will alert you when something needs attention.
            </Text>
            <TouchableOpacity
              style={[styles.viewAllBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/cards' as any)}
            >
              <Ionicons name="wallet-outline" size={16} color={colors.primary} />
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All Cards</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary chips */}
            <View style={styles.summaryRow}>
              {[
                { count: expiredCards.length,                  label: 'Expired',    color: '#EF4444' },
                { count: todayCards.length + weekCards.length, label: 'This Week',  color: '#F59E0B' },
                { count: monthCards.length,                    label: 'This Month', color: colors.primary },
              ].map((stat) => stat.count > 0 ? (
                <View
                  key={stat.label}
                  style={[styles.summaryChip, { backgroundColor: stat.color + '14', borderColor: stat.color + '35' }]}
                >
                  <Text style={[styles.summaryCount, { color: stat.color }]}>{stat.count}</Text>
                  <Text style={[styles.summaryLabel, { color: stat.color }]}>{stat.label}</Text>
                </View>
              ) : null)}
            </View>

            {/* Sections */}
            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHeader}>
                  {section.urgent ? <PulseDot color={section.color} /> : (
                    <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
                  )}
                  <Text style={[styles.sectionTitle, { color: section.color }]}>
                    {section.title}
                  </Text>
                  <View style={[styles.sectionCountBadge, { backgroundColor: section.color + '20' }]}>
                    <Text style={[styles.sectionCountText, { color: section.color }]}>
                      {section.cards.length}
                    </Text>
                  </View>
                </View>

                {section.cards.map((card) => (
                  <AlertCardRow
                    key={card.id}
                    card={card}
                    sectionColor={section.color}
                    isUrgent={section.urgent}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/card/${card.id}` as any);
                    }}
                  />
                ))}
              </View>
            ))}

            {/* Tip */}
            <View style={[styles.tipBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
                Tap any card to view details and update its expiry date.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heading: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3 },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  enableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  enableIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  enableSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  enableBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  enableBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryCount: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  alertHolder: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  alertLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  openBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 21,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  viewAllText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
