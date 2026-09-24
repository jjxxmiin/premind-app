import { router } from 'expo-router';

import { goBackOrReplace, quizReturnHref } from './navigation';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(),
    replace: jest.fn(),
  },
}));

const mockRouter = router as jest.Mocked<typeof router>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('goBackOrReplace', () => {
  it('walks the history when there is one', () => {
    mockRouter.canGoBack.mockReturnValue(true);

    goBackOrReplace('/(tabs)/mastery');

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('replaces with the fallback when the screen is the first route', () => {
    mockRouter.canGoBack.mockReturnValue(false);

    goBackOrReplace('/(tabs)/mastery');

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/mastery');
  });
});

describe('quizReturnHref', () => {
  it('sends a reader who came from 이해도 back to 이해도', () => {
    expect(quizReturnHref('mastery', 'material-1')).toBe('/(tabs)/mastery');
  });

  it('sends a reader who came from the 이해도 상세 화면 back to it', () => {
    expect(quizReturnHref('mastery-detail', 'material-1')).toEqual({
      pathname: '/mastery/[id]',
      params: { id: 'material-1' },
    });
  });

  it('sends a reader who came from the material back to its 요약', () => {
    expect(quizReturnHref('material', 'material-1')).toEqual({
      pathname: '/material/[id]',
      params: { id: 'material-1', tab: 'summary' },
    });
  });

  it('keeps the old behaviour when no origin was written', () => {
    expect(quizReturnHref(undefined, 'material-1')).toEqual({
      pathname: '/material/[id]',
      params: { id: 'material-1', tab: 'summary' },
    });
  });

  it('ignores an origin it does not know', () => {
    expect(quizReturnHref('nonsense', 'material-1')).toEqual({
      pathname: '/material/[id]',
      params: { id: 'material-1', tab: 'summary' },
    });
  });

  it('falls back to the library when there is no material to return to', () => {
    expect(quizReturnHref('material', undefined)).toBe('/(tabs)/library');
    expect(quizReturnHref('mastery-detail', undefined)).toBe('/(tabs)/library');
  });

  it('still returns to 이해도 without a material, since the tab needs none', () => {
    expect(quizReturnHref('mastery', undefined)).toBe('/(tabs)/mastery');
  });
});

describe('the two together', () => {
  it('prefers the history over the origin param', () => {
    mockRouter.canGoBack.mockReturnValue(true);

    goBackOrReplace(quizReturnHref('mastery', 'material-1'));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('uses the origin param when 문제 was entered without a history', () => {
    mockRouter.canGoBack.mockReturnValue(false);

    goBackOrReplace(quizReturnHref('mastery', 'material-1'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/mastery');
  });
});
