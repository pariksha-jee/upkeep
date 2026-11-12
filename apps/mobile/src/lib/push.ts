import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers the device for FCM push and reports the token to the API.
 * Returns false when notifications are unavailable (e.g. emulator w/o Play).
 */
export async function registerForPush(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const token = (await Notifications.getDevicePushTokenAsync()).data as string;
    if (typeof token === 'string' && token.length > 10) {
      await api.registerDevice({
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        pushToken: token,
        appVersion: '0.1.0',
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
