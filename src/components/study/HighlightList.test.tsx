import { fireEvent, render, screen } from '@testing-library/react-native';

import { HighlightList } from './HighlightList';

// The icon package ships ESM that Jest does not transform, and the ui barrel
// drags a lot of icons along. Every name becomes a stub.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target, name) => (name === '__esModule' ? true : () => null),
    },
  ),
);

const painted = [
  { sentence: '요약에서 칠한 문장이에요.', startMs: null },
  { sentence: '대본에서 칠한 문장이에요.', startMs: 402_000 },
];

describe('HighlightList', () => {
  it('lists every stroke with its moment', async () => {
    await render(
      <HighlightList onClear={jest.fn()} onSeek={jest.fn()} painted={painted} />,
    );

    expect(screen.getByText('형광펜')).toBeTruthy();
    expect(screen.getByText(painted[0]!.sentence)).toBeTruthy();
    expect(screen.getByText('06:42')).toBeTruthy();
  });

  it('plays the lecture from the moment a stroke was made', async () => {
    const onSeek = jest.fn();
    await render(
      <HighlightList onClear={jest.fn()} onSeek={onSeek} painted={painted} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: painted[1]!.sentence }));
    expect(onSeek).toHaveBeenCalledWith(402_000);
  });

  it('wipes one stroke from the list', async () => {
    const onClear = jest.fn();
    await render(
      <HighlightList onClear={onClear} onSeek={jest.fn()} painted={painted} />,
    );

    const clears = screen.getAllByRole('button', { name: '형광펜 지우기' });
    expect(clears).toHaveLength(2);
    await fireEvent.press(clears[0]!);
    expect(onClear).toHaveBeenCalledWith(painted[0]!.sentence);
  });

  it('shows nothing while there is nothing painted yet', async () => {
    await render(<HighlightList onClear={jest.fn()} onSeek={jest.fn()} painted={[]} />);

    expect(screen.queryByText('형광펜')).toBeNull();
    expect(screen.queryAllByRole('button', { name: '형광펜 지우기' })).toHaveLength(0);
  });
});
