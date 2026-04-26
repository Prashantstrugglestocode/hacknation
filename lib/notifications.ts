import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set up the default behavior for notifications when the app is in the foreground
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // expo-notifications v0.30+ API split shouldShowAlert into banner/list.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function showOfferNotification(headline: string, merchantName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: headline,
      body: `New offer from ${merchantName} — open the app to view.`,
      sound: true,
    },
    trigger: null,
  });
}

// Fired the moment the merchant scans the customer's QR. Default OS sound
// (iOS tri-tone) draws attention to the slide-to-pay confirmation prompt.
export async function notifyScanPending(merchantName: string | null) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💳 Confirm payment',
      body: merchantName
        ? `${merchantName} just scanned you. Slide to pay.`
        : 'Slide to pay to confirm the transaction.',
      sound: 'default',
    },
    trigger: null,
  }).catch(() => {});
}

// Fired once the redemption commits (slide-to-pay or cashback). Same default
// system sound — short positive ping.
export async function notifyRedeemed(merchantName: string | null, cents: number | null) {
  const eur = cents != null && cents > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(cents / 100)
    : null;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Redeemed',
      body: merchantName && eur ? `${merchantName} · saved: ${eur}`
        : merchantName ? `Redeemed at ${merchantName}`
        : 'Offer redeemed',
      sound: 'default',
    },
    trigger: null,
  }).catch(() => {});
}
