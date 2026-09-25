import { tr } from '@/lib/i18n';

const responseListeners = new Set<(materialId: string) => void>();

/** Whether the browser prompt was put in front of the learner, and the answer. */
export interface StudyNotificationPermission {
  asked: boolean;
  granted: boolean;
}

function browserNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function configureStudyNotifications(): Promise<void> {
  return Promise.resolve();
}

/**
 * The native side asks here when a 마인드팩 starts being made. A browser only
 * honours `requestPermission()` while a tap is still in flight, and by this
 * point it is not, so the web never prompts on its own: it reports what the
 * browser already decided and leaves the ask to the switch in MY, which has
 * the gesture behind it.
 */
export function ensureStudyNotificationPermission(): Promise<StudyNotificationPermission> {
  return Promise.resolve({
    asked: false,
    granted:
      browserNotificationsSupported() &&
      window.Notification.permission === 'granted',
  });
}

export async function requestStudyNotificationPermission(): Promise<boolean> {
  if (!browserNotificationsSupported()) return false;
  if (window.Notification.permission === 'granted') return true;
  if (window.Notification.permission === 'denied') return false;
  return (await window.Notification.requestPermission()) === 'granted';
}

export async function notifyStudyPackReady(input: {
  materialId: string;
  title: string;
}): Promise<boolean> {
  if (
    !browserNotificationsSupported() ||
    window.Notification.permission !== 'granted'
  ) {
    return false;
  }

  const notification = new window.Notification(tr('마인드팩이 준비됐어요'), {
    body: tr('{title}의 대본, 요약, 문제를 열어 보세요.', { title: input.title }),
    icon: '/favicon.ico',
    tag: `premind-study-ready-${input.materialId}`,
  });
  notification.onclick = () => {
    window.focus();
    for (const listener of responseListeners) {
      listener(input.materialId);
    }
    notification.close();
  };
  return true;
}

export function subscribeToStudyNotificationResponses(
  onMaterialOpen: (materialId: string) => void,
): () => void {
  responseListeners.add(onMaterialOpen);
  return () => responseListeners.delete(onMaterialOpen);
}
