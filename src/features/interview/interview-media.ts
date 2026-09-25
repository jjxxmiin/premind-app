/**
 * Interview audio on native: files under the app's document directory, with a
 * small index in AsyncStorage for retention. The audio-only answer is kept
 * until it has been transcribed (at most 24 hours) and then deleted. v1 of the
 * native app records no camera, so there is no video here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { InterviewMediaStore, StoredAudio } from './interview-media.types';

const DIRECTORY = 'interview-audio';
const INDEX_KEY = 'premind.interview.audio-index.v1';

interface AudioEntry {
  key: string;
  sessionId: string;
  uri: string;
  mimeType: string;
  size: number;
  expiresAt: string;
}

async function readIndex(): Promise<Record<string, AudioEntry>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, AudioEntry>) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, AudioEntry>): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function safeName(key: string): string {
  return key.replace(/[^A-Za-z0-9_-]/g, '_');
}

function remove(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

export const interviewMedia: InterviewMediaStore = {
  async putPendingAudio({ key, sessionId, audio, mimeType, expiresAt }) {
    if (typeof audio !== 'string') throw new Error('녹음 파일을 찾지 못했어요. 다시 답변해 주세요.');
    const source = new File(audio);
    if (!source.exists || source.size <= 0) throw new Error('전사할 음성이 비어 있어요. 다시 답변해 주세요.');
    const directory = new Directory(Paths.document, DIRECTORY);
    directory.create({ idempotent: true, intermediates: true });
    const extension = audio.split('.').pop()?.toLowerCase() || 'm4a';
    const destination = new File(directory, `${safeName(key)}.${extension}`);
    if (destination.exists) destination.delete();
    source.move(destination);
    const index = await readIndex();
    index[key] = { key, sessionId, uri: destination.uri, mimeType, size: destination.size, expiresAt };
    await writeIndex(index);
  },

  async getPendingAudio(key): Promise<StoredAudio | null> {
    const entry = (await readIndex())[key];
    if (!entry) return null;
    const file = new File(entry.uri);
    if (!file.exists) return null;
    const name = entry.uri.split('/').pop() ?? 'interview-answer.m4a';
    return { part: { uri: entry.uri, name, type: entry.mimeType }, size: file.size, mimeType: entry.mimeType, expiresAt: entry.expiresAt };
  },

  async deletePendingAudio(key) {
    const index = await readIndex();
    const entry = index[key];
    if (entry) remove(entry.uri);
    delete index[key];
    await writeIndex(index).catch(() => undefined);
  },

  async expiredPendingAudio(nowMs) {
    const index = await readIndex();
    return Object.values(index)
      .filter((entry) => {
        const expiresAt = Date.parse(entry.expiresAt);
        return !Number.isFinite(expiresAt) || expiresAt <= nowMs;
      })
      .map((entry) => entry.key);
  },

  async putVideo() {
    // No camera on native in v1.
  },

  async videoUri() {
    return null;
  },

  async deleteSessionMedia(sessionId, keys) {
    const index = await readIndex();
    for (const entry of Object.values(index)) {
      if (entry.sessionId === sessionId || keys.includes(entry.key)) {
        remove(entry.uri);
        delete index[entry.key];
      }
    }
    await writeIndex(index).catch(() => undefined);
  },
};
