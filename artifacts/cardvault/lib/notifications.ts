import { Platform } from 'react-native';
import type { Card } from '@/types/card';
import { getDaysUntilExpiry } from '@/types/card';

async function getNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleExpiryNotifications(cards: Card[]): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const card of cards) {
    if (!card.expiryDate) continue;
    const days = getDaysUntilExpiry(card.expiryDate);

    for (const threshold of [30, 7]) {
      const triggerDays = days - threshold;
      if (triggerDays < 0) continue;

      const triggerDate = new Date();
      triggerDate.setDate(triggerDate.getDate() + triggerDays);
      triggerDate.setHours(9, 0, 0, 0);

      const body =
        threshold === 7
          ? `${card.title} expires in 7 days. Renew it now.`
          : `${card.title} expires in 30 days.`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: threshold === 7 ? '⚠️ Card expiring soon' : '📅 Card expiry reminder',
          body,
          data: { cardId: card.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }).catch(() => {});
}
