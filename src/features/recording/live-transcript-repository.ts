import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

const partSchema = z.object({
  uri: z.string().min(1),
  durationMillis: z.number().nonnegative(),
  finalized: z.boolean(),
});
const draftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  updatedAt: z.string(),
  status: z.enum(['recording', 'paused', 'completed', 'interrupted']),
  paragraphs: z.array(z.string()),
  interim: z.string(),
  parts: z.array(partSchema),
});
const indexSchema = z.array(z.string().min(1));

export type LiveTranscriptDraft = z.infer<typeof draftSchema>;
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = (workspaceId: string) =>
  `premind.live-transcripts.v1.${encodeURIComponent(workspaceId)}`;
const indexKey = (workspaceId: string) => `${prefix(workspaceId)}.index`;
const draftKey = (workspaceId: string, id: string) =>
  `${prefix(workspaceId)}.draft.${encodeURIComponent(id)}`;

export class LiveTranscriptRepository {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly storage: Storage = AsyncStorage) {}

  async list(workspaceId: string): Promise<LiveTranscriptDraft[]> {
    await this.tail;
    const ids = await this.readIndex(workspaceId);
    const drafts = await Promise.all(ids.map(async (id) => {
      const raw = await this.storage.getItem(draftKey(workspaceId, id));
      if (!raw) return null;
      const parsed = draftSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error('저장된 대본을 읽지 못했어요.');
      return parsed.data;
    }));
    return drafts.filter((draft): draft is LiveTranscriptDraft => draft !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async readIndex(workspaceId: string): Promise<string[]> {
    const raw = await this.storage.getItem(indexKey(workspaceId));
    if (!raw) return [];
    return indexSchema.parse(JSON.parse(raw));
  }

  save(workspaceId: string, draft: LiveTranscriptDraft): Promise<void> {
    const snapshot = draftSchema.parse(draft);
    return this.enqueue(async () => {
      const ids = await this.readIndex(workspaceId);
      if (!ids.includes(snapshot.id)) {
        await this.storage.setItem(indexKey(workspaceId), JSON.stringify([snapshot.id, ...ids]));
      }
      await this.storage.setItem(draftKey(workspaceId, snapshot.id), JSON.stringify(snapshot));
    });
  }

  purge(workspaceId: string): Promise<void> {
    return this.enqueue(async () => {
      const ids = await this.readIndex(workspaceId);
      await Promise.all(ids.map((id) => this.storage.removeItem(draftKey(workspaceId, id))));
      await this.storage.removeItem(indexKey(workspaceId));
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.tail.then(operation, operation);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

export const liveTranscriptRepository = new LiveTranscriptRepository();

export function transcriptText(draft: LiveTranscriptDraft): string {
  return [draft.title, ...draft.paragraphs, draft.interim
    ? `[미확정 대본]\n${draft.interim}` : ''].filter(Boolean).join('\n\n');
}
