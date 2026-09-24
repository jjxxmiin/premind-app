/** @jest-environment jsdom */

import { act, type PropsWithChildren, type ReactNode } from 'react';

const mockReplace = jest.fn();
let mockNewProjectParam: string | string[] | undefined;

const mockAppStoreState = {
  activeProjectId: null,
  createProject: jest.fn(),
  createShareRoom: jest.fn(),
  deleteMaterial: jest.fn(),
  evaluatingMaterialIds: [],
  importYouTubeMaterial: jest.fn(),
  materials: [],
  processingMaterialIds: [],
  projects: [],
  renameMaterial: jest.fn(),
  requestLens: jest.fn(),
  savedMaterialIds: [],
  selectProject: jest.fn(),
  settings: { homeChecklistDismissed: false },
  shareRooms: [],
  toggleSavedMaterial: jest.fn(),
  updateSettings: jest.fn(),
};

jest.mock('@/state/app-store', () => ({
  useAppStore: () => mockAppStoreState,
}));
jest.mock('expo-router', () => ({
  router: {
    dismissTo: jest.fn(),
    push: jest.fn(),
    replace: mockReplace,
  },
  useLocalSearchParams: () => ({ newProject: mockNewProjectParam }),
}));
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: () => () => null,
    },
  ),
);
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native-web'),
  TurboModuleRegistry: { get: () => null },
  useWindowDimensions: () => ({ fontScale: 1, height: 800, scale: 1, width: 390 }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/AppHeader', () => ({
  AppHeader: ({ right }: { right?: ReactNode }) => <>{right}</>,
}));
jest.mock('@/components/MediaArtwork', () => ({ MediaArtwork: () => null }));
jest.mock('@/components/ui', () => {
  const Passthrough = ({ children }: PropsWithChildren) => <>{children}</>;
  const Container = ({ children }: PropsWithChildren) => <div>{children}</div>;

  return {
    ActivityWaveform: () => null,
    AnimatedReveal: Passthrough,
    AppText: Container,
    AuthField: () => null,
    BottomSheetModal: ({
      children,
      footer,
      onClose,
      title,
      visible,
    }: PropsWithChildren<{
      footer?: ReactNode;
      onClose: () => void;
      title?: string;
      visible: boolean;
    }>) =>
      visible ? (
        <div aria-label={title} role="dialog">
          <button aria-label="닫기" onClick={onClose} type="button" />
          {children}
          {footer}
        </div>
      ) : null,
    Button: ({
      children,
      onPress,
    }: PropsWithChildren<{ onPress?: () => void }>) => (
      <button onClick={onPress} type="button">
        {children}
      </button>
    ),
    Card: Container,
    Chip: ({ label }: { label: string }) => <button type="button">{label}</button>,
    Dialog: ({ visible }: { visible: boolean }) => (visible ? <div role="dialog" /> : null),
    EmptyState: Container,
    IconButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress?: () => void;
    }) => (
      <button aria-label={label} onClick={onPress} type="button" />
    ),
    Illustration: () => null,
    ListRow: ({ title }: { title: string }) => <div>{title}</div>,
    MediaCard: () => null,
    ProgressBar: () => null,
    Screen: Container,
    SegmentedControl: () => null,
    StatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
    Toast: ({ message }: { message: string | null }) =>
      message ? <div>{message}</div> : null,
    useToast: () => ({ message: null, show: () => undefined }),
  };
});

// The library is the home tab now; the request flow moved with it.
const { LibraryScreen } = (() => {
  const route = jest.requireActual('../app/(tabs)/index') as typeof import('../app/(tabs)/index');
  return { LibraryScreen: route.default };
})();

const { createRoot } = jest.requireActual('react-dom/client') as {
  createRoot: (container: Element) => TestRoot;
};

interface TestRoot {
  render: (node: ReactNode) => void;
  unmount: () => void;
}

let root: TestRoot | null = null;
let container: HTMLDivElement | null = null;

function renderLibrary() {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => root?.render(<LibraryScreen />));
  return container;
}

function projectDialog() {
  return container?.querySelector<HTMLElement>(
    '[role="dialog"][aria-label="새 폴더"]',
  );
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  mockNewProjectParam = undefined;
  mockReplace.mockClear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container = null;
  document.body.replaceChildren();
});

describe('Library newProject navigation request', () => {
  it('opens once, replaces the request URL, and does not reopen for the same token', () => {
    mockNewProjectParam = 'request-a';
    renderLibrary();

    expect(projectDialog()).not.toBeNull();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');

    act(() => projectDialog()?.querySelector<HTMLElement>('[aria-label="닫기"]')?.click());
    expect(projectDialog()).toBeNull();

    renderLibrary();
    expect(projectDialog()).toBeNull();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('opens again only when a different request token arrives', () => {
    mockNewProjectParam = ['request-a', 'ignored'];
    renderLibrary();
    act(() => projectDialog()?.querySelector<HTMLElement>('[aria-label="닫기"]')?.click());

    mockNewProjectParam = 'request-b';
    renderLibrary();

    expect(projectDialog()).not.toBeNull();
    expect(mockReplace).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenLastCalledWith('/(tabs)');
  });
});
