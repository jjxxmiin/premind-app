/**
 * The "마인드팩이 준비됐어요" notification, and the two Android rules that
 * silently swallowed it: a channel it never created, and a permission it read
 * but never asked for.
 */

const mockScheduleNotificationAsync = jest.fn(
  async (_request: unknown) => 'id',
);
const mockSetNotificationChannelAsync = jest.fn(async () => null);
const mockDeleteNotificationChannelAsync = jest.fn(async () => undefined);
const mockSetNotificationHandler = jest.fn();
const mockGetPermissionsAsync = jest.fn(async () => ({
  granted: false,
  canAskAgain: true,
  status: 'denied',
}));
const mockRequestPermissionsAsync = jest.fn(async () => ({
  granted: true,
  canAskAgain: true,
  status: 'granted',
}));

// The rules under test are Android's: the channel and the runtime permission.
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'android',
    select: (choices: Record<string, unknown>) =>
      'android' in choices ? choices.android : choices.default,
  },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  deleteNotificationChannelAsync: mockDeleteNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  setNotificationHandler: mockSetNotificationHandler,
}));

type Notifications = typeof import('./notifications');

/** Every test gets the module fresh: it remembers its channel and its ask. */
function load(): Notifications {
  let module: Notifications | null = null;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('./notifications') as Notifications;
  });
  if (!module) throw new Error('notifications did not load');
  return module;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain: true,
    status: 'denied',
  });
  mockRequestPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted',
  });
});

describe('configureStudyNotifications', () => {
  // Android 8+ drops a notification whose channel does not exist.
  it('creates the channel at an importance that actually shows itself', async () => {
    await load().configureStudyNotifications();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'study-ready-v2',
      expect.objectContaining({ importance: 4 }),
    );
  });

  // Android ignores an importance change on a channel that already exists, so
  // the only way to raise it is a new id and a goodbye to the old one.
  it('retires the channel the first build created', async () => {
    await load().configureStudyNotifications();

    expect(mockDeleteNotificationChannelAsync).toHaveBeenCalledWith('study-ready');
  });

  // Without a handler nothing is shown while the app is open, which is
  // exactly where a learner waiting on the processing screen is.
  it('shows a notification that arrives while the app is in front', async () => {
    await load().configureStudyNotifications();

    const behaviour = await mockSetNotificationHandler.mock.calls[0][0]
      .handleNotification();
    expect(behaviour.shouldShowBanner).toBe(true);
  });

  it('configures once however many times it is called', async () => {
    const notifications = load();
    await notifications.configureStudyNotifications();
    await notifications.configureStudyNotifications();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledTimes(1);
  });
});

describe('ensureStudyNotificationPermission', () => {
  // The bug: Android 13+ answers "denied" to a question it was never asked.
  it('asks when the permission has never been put to the learner', async () => {
    const result = await load().ensureStudyNotificationPermission();

    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    expect(result).toEqual({ asked: true, granted: true });
  });

  it('does not ask again once the answer is yes', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      status: 'granted',
    });

    const result = await load().ensureStudyNotificationPermission();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ asked: false, granted: true });
  });

  it('respects a learner who turned notifications off in system settings', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    });

    const result = await load().ensureStudyNotificationPermission();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ asked: false, granted: false });
  });

  it('asks at most once a launch', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: 'denied',
    });
    const notifications = load();

    const first = await notifications.ensureStudyNotificationPermission();
    const second = await notifications.ensureStudyNotificationPermission();

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(first.asked).toBe(true);
    expect(second.asked).toBe(false);
  });
});

describe('notifyStudyPackReady', () => {
  it('asks rather than giving up when nobody has been asked yet', async () => {
    const sent = await load().notifyStudyPackReady({
      materialId: 'material-1',
      title: '인공지능 개론',
    });

    expect(sent).toBe(true);
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    const request = mockScheduleNotificationAsync.mock.calls[0]?.[0] as unknown as {
      content: { title: string; body: string; data: { materialId: string } };
    };
    expect(request.content.title).toBe('마인드팩이 준비됐어요');
    expect(request.content.body).toContain('인공지능 개론');
    expect(request.content.data.materialId).toBe('material-1');
  });

  // The channel has to exist before anything is scheduled through it.
  it('creates the channel before it schedules anything', async () => {
    await load().notifyStudyPackReady({ materialId: 'm', title: '강의' });

    expect(mockSetNotificationChannelAsync.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(mockScheduleNotificationAsync.mock.invocationCallOrder[0] ?? 0);
  });

  it('stays quiet when the learner said no', async () => {
    mockGetPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    });

    const sent = await load().notifyStudyPackReady({
      materialId: 'm',
      title: '강의',
    });

    expect(sent).toBe(false);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
