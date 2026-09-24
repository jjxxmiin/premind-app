import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { toggleHighlight } from '@/lib/highlights';

import { HighlightableText } from './HighlightableText';

// The icon package ships ESM that Jest does not transform, and pulling in the
// ui barrel drags a lot of icons along. Every name becomes a stub.
jest.mock('lucide-react-native', () =>
  new Proxy(
    {},
    {
      get: (_target, name) => (name === '__esModule' ? true : () => null),
    },
  ),
);

const prose = '분류는 범주를 예측해요. 회귀는 수치를 예측해요.';
const first = '분류는 범주를 예측해요.';
const second = '회귀는 수치를 예측해요.';

/** Stands in for the store: highlights round-trip through `onToggle`. */
function Harness({
  initial = [],
  onToggle,
  paintedOnly = false,
  tapToPaint = false,
}: {
  initial?: string[];
  onToggle?: (sentence: string) => void;
  paintedOnly?: boolean;
  tapToPaint?: boolean;
}) {
  const [highlights, setHighlights] = useState(initial);
  return (
    <HighlightableText
      highlights={highlights}
      onToggle={(sentence) => {
        onToggle?.(sentence);
        setHighlights(toggleHighlight(highlights, sentence));
      }}
      paintedOnly={paintedOnly}
      tapToPaint={tapToPaint}
      text={prose}
      variant="body"
    />
  );
}

describe('HighlightableText', () => {
  it('offers one target per sentence, painted or not', async () => {
    await render(<Harness />);
    const targets = screen.getAllByRole('checkbox');
    expect(targets).toHaveLength(2);
    expect(screen.getByText(first)).toBeTruthy();
    expect(screen.getByText(second)).toBeTruthy();
  });

  it('paints on a tap where a tap does nothing else', async () => {
    const onToggle = jest.fn();
    await render(<Harness onToggle={onToggle} tapToPaint />);

    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    expect(onToggle).toHaveBeenCalledWith(second);
    expect(screen.getByRole('checkbox', { name: second })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: first })).not.toBeChecked();
  });

  it('wipes the same sentence on a second tap', async () => {
    await render(<Harness initial={[second]} tapToPaint />);
    expect(screen.getByRole('checkbox', { name: second })).toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: second }));
    expect(screen.getByRole('checkbox', { name: second })).not.toBeChecked();
  });

  it('paints on a long press, and says so, where a tap already seeks', async () => {
    const onToggle = jest.fn();
    await render(<Harness onToggle={onToggle} />);

    const target = screen.getByRole('checkbox', { name: first });
    expect(target.props.accessibilityHint).toBe(
      '길게 눌러서 형광펜으로 칠하거나 지워요.',
    );

    fireEvent(target, 'longPress');
    expect(onToggle).toHaveBeenCalledWith(first);
  });

  it('shows only the painted sentences when asked to filter', async () => {
    await render(<Harness initial={[second]} paintedOnly />);
    expect(screen.queryByText(first)).toBeNull();
    expect(screen.getByText(second)).toBeTruthy();
  });

  it('renders nothing when there is no text to paint', async () => {
    const { toJSON } = await render(
      <HighlightableText highlights={[]} onToggle={jest.fn()} text="   " />,
    );
    expect(toJSON()).toBeNull();
  });
});
