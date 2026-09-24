import { connectionKindOf, meteredUploadWarning } from './metered-upload';

describe('connectionKindOf', () => {
  it('treats ethernet as wifi: neither is charged by the byte', () => {
    expect(connectionKindOf({ type: 'wifi', isConnected: true })).toBe('wifi');
    expect(connectionKindOf({ type: 'ethernet', isConnected: true })).toBe('wifi');
  });

  it('reads a cellular connection, the only one that costs money', () => {
    expect(connectionKindOf({ type: 'cellular', isConnected: true })).toBe('cellular');
  });

  it('reads being offline from either the flag or the type', () => {
    expect(connectionKindOf({ type: 'cellular', isConnected: false })).toBe('offline');
    expect(connectionKindOf({ type: 'none' })).toBe('offline');
  });

  it('does not guess when the phone will not say', () => {
    expect(connectionKindOf({ type: 'other', isConnected: true })).toBe('unknown');
    expect(connectionKindOf(null)).toBe('unknown');
    expect(connectionKindOf(undefined)).toBe('unknown');
  });
});

describe('meteredUploadWarning', () => {
  it('warns on cellular and names the size being sent', () => {
    const warning = meteredUploadWarning('cellular', 134_217_728);
    expect(warning?.description).toContain('128 MB');
    expect(warning?.description).toContain('요금');
  });

  it('still warns when the picker gave no size', () => {
    const warning = meteredUploadWarning('cellular', undefined);
    expect(warning).not.toBeNull();
    expect(warning?.description).not.toContain('undefined');
    expect(meteredUploadWarning('cellular', 0)?.description).not.toContain('0 B');
  });

  it('never warns on wifi, which is the whole point of not being a switch', () => {
    expect(meteredUploadWarning('wifi', 134_217_728)).toBeNull();
  });

  it('stays quiet offline: the queue resumes later and nothing is billed', () => {
    expect(meteredUploadWarning('offline', 134_217_728)).toBeNull();
  });

  it('stays quiet on an unknown connection rather than crying wolf on wifi', () => {
    expect(meteredUploadWarning('unknown', 134_217_728)).toBeNull();
  });

  it('writes the warning in 해요체 without a middot', () => {
    const warning = meteredUploadWarning('cellular', 1_048_576);
    expect(warning?.description).not.toContain('·');
    expect(warning?.description.endsWith('요.')).toBe(true);
  });
});
