import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * An invite link opened while signed out: the code waits here until the
 * learner has signed in, then the 면접 tab takes them back to the join screen.
 */
const KEY = 'premind.interview.pending-join.v1';

export async function rememberPendingJoinCode(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })).catch(() => undefined);
}

export async function consumePendingJoinCode(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const value = JSON.parse(raw) as { code?: unknown; at?: unknown };
    const fresh = typeof value.at === 'number' && Date.now() - value.at < 24 * 60 * 60 * 1000;
    return fresh && typeof value.code === 'string' && /^[A-Z0-9]{6,12}$/.test(value.code) ? value.code : null;
  } catch {
    return null;
  }
}
