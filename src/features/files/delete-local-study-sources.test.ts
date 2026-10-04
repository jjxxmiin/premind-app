import { deleteLocalStudySources } from './delete-local-study-sources';

const mockDeletedUris: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: {
    document: { uri: 'file:///documents' },
    cache: { uri: 'file:///cache' },
  },
  Directory: class {
    readonly uri: string;
    constructor(parent: { readonly uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
  },
  File: class {
    readonly exists = true;
    readonly uri: string;
    constructor(uri: string) { this.uri = uri; }
    delete() { mockDeletedUris.push(this.uri); }
  },
}));

beforeEach(() => { mockDeletedUris.length = 0; });

it('deletes owned live transcript WAV parts once during account cleanup', async () => {
  const uri = 'file:///documents/premind-live-transcripts/owned-part.wav';
  await deleteLocalStudySources([uri, uri]);
  expect(mockDeletedUris).toEqual([uri]);
});

it('does not expand transcript cleanup to neighboring folders or external sources', async () => {
  await deleteLocalStudySources([
    'file:///documents/premind-live-transcripts-other/private.wav',
    'file:///documents/unrelated.wav',
    'https://example.com/audio.wav',
    'content://provider/audio/1',
  ]);
  expect(mockDeletedUris).toEqual([]);
});
