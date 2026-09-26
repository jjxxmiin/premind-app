import { ageConfirmationField, setAgeConfirmed } from './age-confirmation';

describe('age confirmation', () => {
  afterEach(() => setAgeConfirmed(false));

  it('sends nothing until the signup check is on', () => {
    expect(ageConfirmationField()).toEqual({});
  });

  it('sends age_over_14 once the check is on, and stops when it is off', () => {
    setAgeConfirmed(true);
    expect(ageConfirmationField()).toEqual({ age_over_14: true });
    setAgeConfirmed(false);
    expect(ageConfirmationField()).toEqual({});
  });
});
