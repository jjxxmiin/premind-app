import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { tr } from '@/lib/i18n';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Android never lets an app raise the importance of a channel it has already
 * created — only the learner can, in system settings — so the id carries a
 * version. The first channel was `DEFAULT`, which files a finished 마인드팩
 * in the shade without ever showing itself; `HIGH` is what makes it appear.
 * A device that ran the old build gets the new channel and loses the old one.
 */
const STUDY_READY_CHANNEL_ID = 'study-ready-v2';
const RETIRED_CHANNEL_IDS = ['study-ready'];

/** Whether the OS dialog was put in front of the learner, and the answer. */
export interface StudyNotificationPermission {
  asked: boolean;
  granted: boolean;
}

const DENIED: StudyNotificationPermission = { asked: false, granted: false };

let configuration: Promise<void> | null = null;
let notificationsModule: NotificationsModule | null | undefined;
/** One ask per launch: a learner who said no is not asked again this session. */
let askedThisSession = false;

/**
 * Expo Go (SDK 53+) ships without the Android notifications native module and
 * `expo-notifications` throws the moment it is imported there — which, as a
 * static import from the root layout, took the whole app down with it. So
 * the module is loaded lazily and every entry point degrades to a no-op when
 * it is unavailable: a demo in Expo Go simply has no local notifications,
 * which is the honest outcome. Development and release builds are unaffected.
 */
function loadNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) {
    return notificationsModule;
  }
  if (
    Platform.OS === 'web' ||
    (Platform.OS === 'android' &&
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
  ) {
    notificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

export function configureStudyNotifications(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return Promise.resolve();
  }
  if (configuration) {
    return configuration;
  }

  // Without a handler a notification that arrives while the app is open is
  // delivered to the app and never shown, which is exactly the case a learner
  // waiting on the processing screen hits.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  configuration = (async () => {
    if (Platform.OS === 'android') {
      // Android 8+ drops a notification whose channel does not exist, so this
      // has to be in place before anything is scheduled.
      await Notifications.setNotificationChannelAsync(
        STUDY_READY_CHANNEL_ID,
        {
          name: tr('마인드팩 준비 알림'),
          description: tr('대본, 요약, 문제가 준비되면 알려 줘요.'),
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 180, 120, 180],
        },
      );
      for (const retired of RETIRED_CHANNEL_IDS) {
        await Notifications.deleteNotificationChannelAsync(retired).catch(
          () => undefined,
        );
      }
    }
  })().catch((error: unknown) => {
    configuration = null;
    throw error;
  });

  return configuration;
}

/**
 * Make sure the learner has actually been asked before we count on being able
 * to notify them.
 *
 * On Android 13+ a permission that has never been requested reads back as
 * `denied` with `canAskAgain`, so "not granted" is not the same as "no": a
 * build that only ever reads the permission is silently muted forever. This
 * asks once, at a moment the learner is looking at the screen, and reports
 * whether the dialog was actually shown so the caller can act on the answer.
 */
export async function ensureStudyNotificationPermission(): Promise<StudyNotificationPermission> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return DENIED;
  }
  await configureStudyNotifications();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return { asked: false, granted: true };
  }
  if (askedThisSession || existing.canAskAgain === false) {
    return DENIED;
  }
  askedThisSession = true;
  const requested = await Notifications.requestPermissionsAsync();
  return { asked: true, granted: requested.granted };
}

export async function requestStudyNotificationPermission(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return false;
  }
  await configureStudyNotifications();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }
  // The switch in MY is an explicit ask, so it never stands down the way
  // `ensureStudyNotificationPermission` does.
  askedThisSession = true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function notifyStudyPackReady(input: {
  materialId: string;
  title: string;
}): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return false;
  }
  // Configures first (the channel has to exist), then asks if the learner has
  // never been asked. Reading the permission alone was the bug: a fresh
  // Android 13+ install answers "denied" to a question it was never posed.
  const permission = await ensureStudyNotificationPermission();
  if (!permission.granted) {
    return false;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: tr('마인드팩이 준비됐어요'),
      body: tr('{title}의 대본, 요약, 문제를 열어 보세요.', { title: input.title }),
      sound: 'default',
      data: {
        materialId: input.materialId,
        route: `/material/${input.materialId}`,
      },
    },
    trigger:
      Platform.OS === 'android'
        ? { channelId: STUDY_READY_CHANNEL_ID }
        : null,
  });
  return true;
}

export function subscribeToStudyNotificationResponses(
  onMaterialOpen: (materialId: string) => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return () => undefined;
  }
  const subscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const materialId = response.notification.request.content.data?.materialId;
      if (typeof materialId === 'string' && materialId) {
        onMaterialOpen(materialId);
      }
    });

  return () => subscription.remove();
}
