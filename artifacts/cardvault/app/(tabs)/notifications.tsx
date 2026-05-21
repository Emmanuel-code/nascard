import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardTypeIcon } from '@/components/CardTypeIcon';
import { useCards } from '@/contexts/CardContext';
import { useProfile } from '@/contexts/ProfileContext';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  scheduleExpiryNotifications,
} from '@/lib/notifications';
import { useColors } from '@/hooks/useColors';
import { getDaysUntilExpiry } from '@/types/card';

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getExpiringCards, cards } = useCards();
  const { profile, updateProfile } = useProfile();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const expiring30 = getExpiringCards(30);
  const expiring7 = getExpiringCards(7);
  const expired = getExpiringCards(-1).filter((c) => getDaysUntilExpiry(c.expiryDate) < 0);

  const sections = [
    { title: 'Expired', cards: expired.filter(c => getDaysUntilExpiry(c.expiryDate) < 0), color: colors.expired },
    { title: 'Expiring this week', cards: expiring7.filter(c => getDaysUntilExpiry(c.expiryDate) >= 0), color: colors.warning },
    { title: 'Expiring this month', cards: expiring30.filter(c => getDaysUntilExpiry(c.expiryDate) >= 7), color: colors.foreground },
  ].filter((s) => s.cards.length > 0);

  const handleToggleNotifications = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      updateProfile({ notificationsEnabled: true });
      await scheduleExpiryNotifications(cards);
    } else {
      updateProfile({ notificationsEnabled: false });
      await cancelAllNotifications();
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
        <Text style={[styles.heading, { color: colors.foreground }]}>Alerts</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Expiry reminders for your cards
        </Text>

        {/* Notification enable banner */}
        {Platform.OS !== 'web' && !profile.notificationsEnabled && (
          <TouchableOpacity
            style={[styles.banner, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}
            onPress={() => handleToggleNotifications(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Enable reminders</Text>
              <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>
                Get notified 30 & 7 days before cards expire
              </Text>
            </View>
            <View style={[styles.enableBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.enableBtnText, { color: colors.primaryForeground }]}>Enable</Text>
            </View>
          </TouchableOpacity>
        )}

        {Platform.OS !== 'web' && profile.notificationsEnabled && (
          <View style={[styles.activeBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: colors.verified }]} />
            <Text style={[styles.activeText, { color: colors.mutedForeground }]}>
              Reminders active — 30 & 7 days before expiry
            </Text>
            <Switch
              value={true}
              onValueChange={() => handleToggleNotifications(false)}
              trackColor={{ false: colors.muted, true: colors.primary + 'AA' }}
              thumbColor={colors.primary}
            />
          </View>
        )}

        {sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name="checkmark-circle" size={36} color={colors.verified} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All clear</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No cards expiring in the next 30 days
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
              {section.cards.map((card) => {
                const days = getDaysUntilExpiry(card.expiryDate);
                const label =
                  days < 0
                    ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
                    : days === 0
                      ? 'Expires today'
                      : `Expires in ${days} day${days !== 1 ? 's' : ''}`;

                return (
                  <TouchableOpacity
                    key={card.id}
                    onPress={() => router.push(`/card/${card.id}`)}
                    style={[
                      styles.alertCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.alertDot, { backgroundColor: section.color }]} />
                    <CardTypeIcon cardType={card.cardType} size={36} />
                    <View style={styles.alertInfo}>
                      <Text style={[styles.alertTitle, { color: colors.foreground }]}>
                        {card.title}
                      </Text>
                      <Text style={[styles.alertLabel, { color: section.color }]}>{label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bannerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  enableBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  enableBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  alertDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  alertLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
});
