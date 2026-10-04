import { cardForSwipe } from './card-pages';

describe('cardForSwipe', () => {
  it('moves forward on a leftward swipe and back on a rightward one', () => {
    expect(cardForSwipe(1, 3, -80, 40)).toBe(2);
    expect(cardForSwipe(1, 3, 80, 40)).toBe(0);
  });

  it('lets the swipe fall through to the tab at either end or under the threshold', () => {
    expect(cardForSwipe(2, 3, -80, 40)).toBeNull();
    expect(cardForSwipe(0, 3, 80, 40)).toBeNull();
    expect(cardForSwipe(1, 3, -20, 40)).toBeNull();
    expect(cardForSwipe(0, 1, -80, 40)).toBeNull();
  });
});
