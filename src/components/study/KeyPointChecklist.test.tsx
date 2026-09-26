import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { KeyPointChecklist } from './KeyPointChecklist';

jest.mock('lucide-react-native', () => ({ Check: () => null }));

const keyPoints = [
  '정답이 있는 데이터를 쓴다',
  '손실을 줄이는 방향으로 학습한다',
  '과적합을 조심한다',
];

/** Stands in for the store: `checkedPoints` round-trips through `onChange`. */
function Harness({
  initial = [],
  onChange,
}: {
  initial?: string[];
  onChange?: (checkedPoints: string[]) => void;
}) {
  const [checkedPoints, setCheckedPoints] = useState(initial);
  return (
    <KeyPointChecklist
      checkedPoints={checkedPoints}
      keyPoints={keyPoints}
      onChange={(next) => {
        onChange?.(next);
        setCheckedPoints(next);
      }}
    />
  );
}

describe('KeyPointChecklist', () => {
  it('renders one checkbox row per key point with the progress line', async () => {
    await render(<Harness />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('0/3');
    for (const point of keyPoints) {
      expect(screen.getByRole('checkbox', { name: point })).not.toBeChecked();
    }
  });

  it('toggles checkedPoints on and off when a row is tapped', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: keyPoints[1] }));
    expect(onChange).toHaveBeenLastCalledWith([keyPoints[1]]);
    expect(screen.getByRole('checkbox', { name: keyPoints[1] })).toBeChecked();
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('1/3');

    await fireEvent.press(screen.getByRole('checkbox', { name: keyPoints[0] }));
    expect(onChange).toHaveBeenLastCalledWith([keyPoints[1], keyPoints[0]]);
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('2/3');

    await fireEvent.press(screen.getByRole('checkbox', { name: keyPoints[1] }));
    expect(onChange).toHaveBeenLastCalledWith([keyPoints[0]]);
    expect(screen.getByRole('checkbox', { name: keyPoints[1] })).not.toBeChecked();
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('1/3');
  });

  it('starts from the stored checks and reports when everything is done', async () => {
    await render(<Harness initial={[keyPoints[0]!, keyPoints[2]!]} />);
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('2/3');

    await fireEvent.press(screen.getByRole('checkbox', { name: keyPoints[1] }));
    expect(screen.getByTestId('key-point-progress')).toHaveTextContent('3/3');
  });
});
