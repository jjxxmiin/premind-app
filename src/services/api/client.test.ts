import {
  ApiError,
  isSessionRefreshable,
  isSessionUsable,
  PremindApiClient,
} from './client';

const TOKEN_PAIR = {
  access_token: 'access-token',
  token_type: 'bearer',
  expires_in: 3_600,
  refresh_token: 'refresh-token',
  refresh_expires_in: 2_592_000,
  user: {
    id: 'user-1',
    email: 'teacher@premind.io',
    name: '김프리마인드',
    role: 'member',
  },
};

function mockResponse(body: unknown, status = 200): Response {
  const encoded =
    body === undefined
      ? ''
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => encoded),
  } as unknown as Response;
}

function fetchReturning(...responses: Response[]): jest.MockedFunction<typeof fetch> {
  const queue = [...responses];
  return jest.fn(async () => {
    const response = queue.shift();
    if (!response) {
      throw new Error('예상하지 못한 fetch 호출입니다.');
    }
    return response;
  }) as unknown as jest.MockedFunction<typeof fetch>;
}

function clientWith(fetcher: jest.MockedFunction<typeof fetch>): PremindApiClient {
  return new PremindApiClient({ baseUrl: 'https://api.premind.test', fetcher });
}

describe('PremindApiClient auth', () => {
  it('maps the token pair and computes both expiries', async () => {
    const fetcher = fetchReturning(mockResponse(TOKEN_PAIR));
    const client = new PremindApiClient({
      baseUrl: 'https://api.premind.test///',
      fetcher,
    });

    const session = await client.login('  Teacher@PREMIND.io ', 'password123', {
      deviceName: 'Pixel 9',
    });

    expect(session).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'bearer',
      user: { id: 'user-1', email: 'teacher@premind.io', mode: 'teacher' },
    });
    const issuedAt = Date.parse(session.issuedAt);
    expect(Date.parse(session.expiresAt) - issuedAt).toBe(3_600_000);
    expect(Date.parse(String(session.refreshExpiresAt)) - issuedAt).toBe(
      2_592_000_000,
    );

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.premind.test/api/auth/token');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'teacher@premind.io',
      password: 'password123',
      device_name: 'Pixel 9',
    });
  });

  it('registers an account and returns a signed-in session', async () => {
    const fetcher = fetchReturning(mockResponse(TOKEN_PAIR, 201));
    await clientWith(fetcher).register(
      ' NEW@premind.io ',
      '  새 사용자 ',
      'password123',
    );

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.premind.test/api/auth/register');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'new@premind.io',
      name: '새 사용자',
      password: 'password123',
    });
  });

  it('rejects a token response that is missing its refresh token', async () => {
    const { refresh_token: _dropped, ...withoutRefresh } = TOKEN_PAIR;
    const client = clientWith(fetchReturning(mockResponse(withoutRefresh)));

    await expect(client.login('user@example.com', 'password123')).rejects.toEqual(
      expect.objectContaining<Partial<ApiError>>({
        name: 'ApiError',
        code: 'UNEXPECTED_RESPONSE',
      }),
    );
  });

  it('marks a 401 as an expired session rather than a plain failure', async () => {
    const client = clientWith(
      fetchReturning(mockResponse({ detail: 'invalid_refresh_token' }, 401)),
    );

    await expect(client.refresh('stale-token')).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });
  });

  it.each([
    {
      label: 'FastAPI detail',
      body: { detail: '요청 값이 올바르지 않습니다.' },
      expected: '요청 값이 올바르지 않습니다.',
      status: 422,
    },
    {
      label: 'FastAPI validation detail',
      body: { detail: [{ msg: '이메일 형식을 확인해 주세요.' }] },
      expected: '이메일 형식을 확인해 주세요.',
      status: 422,
    },
    {
      label: 'throttled login',
      body: { detail: '잠시 후 다시 시도해주세요' },
      expected: '잠시 후 다시 시도해주세요',
      status: 429,
    },
  ])('surfaces a $label response', async ({ body, expected, status }) => {
    const client = clientWith(fetchReturning(mockResponse(body, status)));

    await expect(client.login('user@example.com', 'wrong')).rejects.toMatchObject({
      name: 'ApiError',
      message: expected,
      status,
    });
  });
});

describe('session predicates', () => {
  const session = {
    accessToken: 'access-token',
    tokenType: 'bearer' as const,
    issuedAt: '2026-09-02T00:00:00.000Z',
    expiresAt: '2026-09-02T01:00:00.000Z',
    refreshToken: 'refresh-token',
    refreshExpiresAt: '2026-10-02T00:00:00.000Z',
    user: {
      id: 'user-1',
      email: 'teacher@premind.io',
      name: '김프리마인드',
      role: 'member',
      mode: 'teacher' as const,
    },
  };

  it('treats a token expiring within the leeway as already unusable', () => {
    expect(isSessionUsable(session, Date.parse(session.issuedAt))).toBe(true);
    expect(isSessionUsable(session, Date.parse(session.expiresAt) - 59_000)).toBe(
      false,
    );
  });

  it('stays refreshable after the access token expires', () => {
    const afterAccessExpiry = Date.parse(session.expiresAt) + 60_000;
    expect(isSessionUsable(session, afterAccessExpiry)).toBe(false);
    expect(isSessionRefreshable(session, afterAccessExpiry)).toBe(true);
  });

  it('is not refreshable once the refresh token itself has expired', () => {
    const afterRefreshExpiry = Date.parse(session.refreshExpiresAt) + 1_000;
    expect(isSessionRefreshable(session, afterRefreshExpiry)).toBe(false);
  });

  it('is not refreshable without a refresh token at all', () => {
    expect(
      isSessionRefreshable({ ...session, refreshToken: null, refreshExpiresAt: null }),
    ).toBe(false);
  });
});

describe('PremindApiClient uploads', () => {
  const session = {
    upload_id: 'upload-1',
    status: 'pending',
    total_bytes: 20,
    chunk_size: 8,
    chunk_count: 3,
    received_chunks: [0],
    received_bytes: 8,
    recording_id: null,
  };

  it('initiates an upload with the device-side reference and markers', async () => {
    const fetcher = fetchReturning(mockResponse(session, 201));
    const state = await clientWith(fetcher).initUpload('access-token', {
      clientReference: 'material-1',
      filename: 'lecture.m4a',
      totalBytes: 20,
      contentType: 'audio/mp4',
      title: '2주차 강의',
      durationMs: 3_600_000,
      markers: [{ timestampMs: 12_345.6 }],
    });

    expect(state).toEqual({
      uploadId: 'upload-1',
      status: 'pending',
      totalBytes: 20,
      chunkSize: 8,
      chunkCount: 3,
      receivedChunks: [0],
      receivedBytes: 8,
      recordingId: null,
    });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.premind.test/api/uploads');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      client_reference: 'material-1',
      total_bytes: 20,
      markers: [{ timestamp_ms: 12_346 }],
    });
  });

  it('refuses a session that does not say how big a chunk is', async () => {
    const client = clientWith(
      fetchReturning(mockResponse({ ...session, chunk_size: 0 }, 201)),
    );

    await expect(
      client.initUpload('access-token', {
        clientReference: 'material-1',
        filename: 'lecture.m4a',
        totalBytes: 20,
        contentType: 'audio/mp4',
        title: '2주차 강의',
      }),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });

  it('sends a chunk as raw bytes and returns the server-side tally', async () => {
    const fetcher = fetchReturning(
      mockResponse({
        upload_id: 'upload-1',
        received_chunks: [0, 1],
        received_bytes: 16,
      }),
    );
    const bytes = new Uint8Array([1, 2, 3]);

    const accepted = await clientWith(fetcher).putChunk(
      'access-token',
      'upload-1',
      1,
      bytes,
    );

    expect(accepted).toEqual({ receivedChunks: [0, 1], receivedBytes: 16 });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.premind.test/api/uploads/upload-1/chunks/1');
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(bytes);
    expect(init?.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/octet-stream' }),
    );
  });

  it('returns the recording id a completed upload produced', async () => {
    const fetcher = fetchReturning(
      mockResponse({
        upload_id: 'upload-1',
        status: 'completed',
        recording_id: 'recording-9',
      }),
    );

    await expect(
      clientWith(fetcher).completeUpload('access-token', 'upload-1'),
    ).resolves.toBe('recording-9');
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.premind.test/api/uploads/upload-1/complete',
    );
  });

  it('rejects a completion with no recording id', async () => {
    const client = clientWith(
      fetchReturning(mockResponse({ upload_id: 'upload-1', status: 'completed' })),
    );

    await expect(
      client.completeUpload('access-token', 'upload-1'),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});

describe('PremindApiClient recordings', () => {
  const readyRecording = {
    id: 'recording-9',
    title: '2주차 강의',
    duration_ms: 1_200_000,
    status: 'ready',
    byte_size: 2048,
    created_at: '2026-09-02T04:00:00.000Z',
    content_type: 'audio/mp4',
    transcript: '오늘은 정렬 알고리즘을 다룹니다.',
    summary: '정렬 알고리즘 개요',
    key_points: ['병합 정렬', '퀵 정렬'],
    study_pack: {
      concepts: [
        {
          term: '병합 정렬',
          description: '반씩 나눠 정렬한 뒤 합칩니다.',
          source_start_ms: 2_000,
          difficulty: 'intermediate',
        },
      ],
      quiz: [
        {
          type: 'true-false',
          concept: '병합 정렬',
          prompt: '분할 정복을 사용한다.',
          choices: ['맞아요', '아니에요'],
          correct_choice_index: 0,
          explanation: '반씩 나눈 뒤 합치기 때문입니다.',
          source_start_ms: 2_000,
        },
      ],
    },
  };

  it('maps a ready recording, study pack included', async () => {
    const detail = await clientWith(
      fetchReturning(mockResponse(readyRecording)),
    ).getRecording('access-token', 'recording-9');

    expect(detail).toMatchObject({
      id: 'recording-9',
      durationMs: 1_200_000,
      status: 'ready',
      keyPoints: ['병합 정렬', '퀵 정렬'],
    });
    expect(detail.studyPack?.concepts[0]).toEqual({
      term: '병합 정렬',
      description: '반씩 나눠 정렬한 뒤 합칩니다.',
      sourceStartMs: 2_000,
      difficulty: 'intermediate',
    });
    expect(detail.studyPack?.quiz[0]?.correctChoiceIndex).toBe(0);
  });

  it('drops a question whose answer points outside its choices', async () => {
    const detail = await clientWith(
      fetchReturning(
        mockResponse({
          ...readyRecording,
          study_pack: {
            concepts: [],
            quiz: [
              {
                prompt: '정답이 없는 문제',
                choices: ['가', '나'],
                correct_choice_index: 5,
              },
            ],
          },
        }),
      ),
    ).getRecording('access-token', 'recording-9');

    // Nothing renderable survived, so there is no study pack at all.
    expect(detail.studyPack).toBeNull();
  });

  it('keeps the outline in server order and drops sections that would render empty', async () => {
    const detail = await clientWith(
      fetchReturning(
        mockResponse({
          ...readyRecording,
          outline: [
            {
              heading: '정렬의 필요성',
              start_ms: 0,
              body: '자료를 순서대로 두면 찾는 일이 빨라져요. 그래서 정렬을 먼저 배워요.',
            },
            { heading: '제목만 있는 구간', start_ms: 10_000 },
            { body: '제목이 없는 구간이에요.', start_ms: 20_000 },
            'not a section',
            {
              heading: '병합 정렬',
              start_ms: -5_000,
              body: '반씩 나눠 정렬한 뒤 합쳐요.',
            },
          ],
        }),
      ),
    ).getRecording('access-token', 'recording-9');

    expect(detail.outline).toEqual([
      {
        heading: '정렬의 필요성',
        startMs: 0,
        body: '자료를 순서대로 두면 찾는 일이 빨라져요. 그래서 정렬을 먼저 배워요.',
      },
      // A negative timestamp still has to seek somewhere real.
      { heading: '병합 정렬', startMs: 0, body: '반씩 나눠 정렬한 뒤 합쳐요.' },
    ]);
  });

  it('leaves the outline absent when the server sent none', async () => {
    const detail = await clientWith(
      fetchReturning(mockResponse(readyRecording)),
    ).getRecording('access-token', 'recording-9');

    expect(detail.outline).toBeUndefined();
  });

  it('cleans the middot out of an outline the model wrote', async () => {
    const detail = await clientWith(
      fetchReturning(
        mockResponse({
          ...readyRecording,
          outline: [
            { heading: '분류 · 회귀', start_ms: 1_500, body: '범주 · 수치를 예측해요.' },
          ],
        }),
      ),
    ).getRecording('access-token', 'recording-9');

    expect(detail.outline?.[0]?.heading).not.toContain('·');
    expect(detail.outline?.[0]?.body).not.toContain('·');
  });

  it('treats an unknown status as not-yet-processed', async () => {
    const detail = await clientWith(
      fetchReturning(mockResponse({ ...readyRecording, status: '???' })),
    ).getRecording('access-token', 'recording-9');

    expect(detail.status).toBe('stored');
  });

  const lensReport = {
    overall: 4.1,
    rubric: [
      { key: 'structure', label: '구조', score: 4.3, evidence: '목차 제시' },
      { key: 'clarity', label: '명료성', score: 4.1, evidence: '정의 뒤 예시' },
      { key: 'evidence', label: '근거 활용', score: 3.8, evidence: '수치 인용' },
      { key: 'delivery', label: '전달력', score: 4.0, evidence: '속도 일정' },
    ],
    strengths: [{ text: '개념을 사례로 연결했어요.', source_start_ms: 402_000 }],
    improvements: [
      { text: '정의를 반복했어요.', action: '한 번만 말하세요.', source_start_ms: 880_000 },
    ],
    priority: { text: '정의를 반복했어요.', action: '한 번만 말하세요.', source_start_ms: 880_000 },
  };

  it('maps the Lens report in rubric order', async () => {
    const detail = await clientWith(
      fetchReturning(mockResponse({ ...readyRecording, lens_report: lensReport })),
    ).getRecording('access-token', 'recording-9');

    expect(detail.lensReport?.overall).toBe(4.1);
    expect(detail.lensReport?.rubric.map((r) => r.key)).toEqual([
      'structure',
      'clarity',
      'evidence',
      'delivery',
    ]);
    expect(detail.lensReport?.improvements[0]).toEqual({
      text: '정의를 반복했어요.',
      action: '한 번만 말하세요.',
      sourceStartMs: 880_000,
    });
    expect(detail.lensReport?.priority?.action).toBe('한 번만 말하세요.');
  });

  it('drops a Lens report whose rubric is incomplete', async () => {
    const detail = await clientWith(
      fetchReturning(
        mockResponse({
          ...readyRecording,
          lens_report: { ...lensReport, rubric: lensReport.rubric.slice(0, 3) },
        }),
      ),
    ).getRecording('access-token', 'recording-9');

    // Three of four scores would draw a chart with a hole in it.
    expect(detail.lensReport).toBeNull();
  });

  it('maps when and how often a recording was evaluated', async () => {
    const detail = await clientWith(
      fetchReturning(
        mockResponse({
          ...readyRecording,
          lens_report: lensReport,
          lens_evaluated_at: '2026-09-07T05:02:00.000Z',
          lens_count: 2,
        }),
      ),
    ).getRecording('access-token', 'recording-9');

    expect(detail.lensEvaluatedAt).toBe('2026-09-07T05:02:00.000Z');
    expect(detail.lensCount).toBe(2);
  });

  it('reads a recording never evaluated as having no history', async () => {
    const detail = await clientWith(
      fetchReturning(mockResponse(readyRecording)),
    ).getRecording('access-token', 'recording-9');

    expect(detail.lensEvaluatedAt).toBeNull();
    expect(detail.lensCount).toBe(0);
  });

  it('lists the Lens history newest first and skips entries that would not render', async () => {
    const fetcher = fetchReturning(
      mockResponse([
        { id: 'lens-1', created_at: '2026-09-01T09:00:00.000Z', report: lensReport },
        { id: 'lens-2', created_at: '2026-09-07T05:02:00.000Z', report: lensReport },
        { id: 'lens-broken', created_at: '2026-09-08T00:00:00.000Z', report: null },
        { created_at: '2026-09-09T00:00:00.000Z', report: lensReport },
      ]),
    );

    const history = await clientWith(fetcher).listLensHistory('access-token', 'recording-9');

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.premind.test/api/recordings/recording-9/lens',
    );
    expect(history.map((entry) => entry.id)).toEqual(['lens-2', 'lens-1']);
    expect(history[0]).toMatchObject({
      evaluatedAt: '2026-09-07T05:02:00.000Z',
      report: { overall: 4.1 },
    });
    expect(history[1]?.report.rubric.map((r) => r.key)).toEqual([
      'structure',
      'clarity',
      'evidence',
      'delivery',
    ]);
  });

  it('rejects a Lens history that is not a list', async () => {
    await expect(
      clientWith(fetchReturning(mockResponse({ items: [] }))).listLensHistory(
        'access-token',
        'recording-9',
      ),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });

  it('names the 422 that means there was too little speech to score', async () => {
    const fetcher = fetchReturning(
      mockResponse(
        {
          detail: {
            code: 'lens_insufficient',
            message: '말한 내용이 너무 짧아 평가할 수 없어요.',
          },
        },
        422,
      ),
    );

    await expect(
      clientWith(fetcher).regenerateLens('access-token', 'recording-9'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'LENS_INSUFFICIENT',
      message: '말한 내용이 너무 짧아 평가할 수 없어요.',
    });
  });

  it('points a player at the media route with the bearer header', () => {
    const source = clientWith(fetchReturning()).recordingMediaSource(
      'access-token',
      'recording-9',
    );
    expect(source).toEqual({
      uri: 'https://api.premind.test/api/recordings/recording-9/media',
      headers: { Authorization: 'Bearer access-token' },
    });
  });

  it('deletes the account with the bearer token', async () => {
    const fetcher = fetchReturning(mockResponse(undefined, 204));
    await clientWith(fetcher).deleteAccount('access-token');
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe('https://api.premind.test/api/auth/me');
    expect(init?.method).toBe('DELETE');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
    });
  });

  it('maps caption lines and skips empty ones', async () => {
    const fetcher = fetchReturning(
      mockResponse([
        { start_ms: 0, end_ms: 2_000, text: '오늘은 정렬을 다룹니다.' },
        { start_ms: 2_000, end_ms: 3_000, text: '   ' },
      ]),
    );

    await expect(
      clientWith(fetcher).getRecordingSegments('access-token', 'recording-9'),
    ).resolves.toEqual([
      { startMs: 0, endMs: 2_000, text: '오늘은 정렬을 다룹니다.' },
    ]);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.premind.test/api/recordings/recording-9/segments',
    );
  });

  it('refuses to send a request with no access token', async () => {
    const fetcher = fetchReturning(mockResponse([]));

    await expect(clientWith(fetcher).listRecordings('')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('the default fetcher', () => {
  it('never calls the global fetch with the client as its receiver', async () => {
    const receivers: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(mockResponse(TOKEN_PAIR));
    } as unknown as typeof fetch;

    const client = new PremindApiClient({ baseUrl: 'https://api.premind.test' });
    try {
      await client.login('teacher@premind.io', 'password123');
    } finally {
      globalThis.fetch = original;
    }

    expect(receivers).toHaveLength(1);
    // A browser's native fetch throws "Illegal invocation" for any receiver
    // that is not the window, so storing it as `this.fetcher` and calling it as
    // a method breaks every request in the web build — and only there, which is
    // why this is asserted rather than left to the platform to reveal.
    expect(receivers[0]).not.toBeInstanceOf(PremindApiClient);
  });
});

describe('social login transport', () => {
  it('exchanges a Kakao code with its proof and persists the normal session shape', async () => {
    const fetcher = fetchReturning(mockResponse(TOKEN_PAIR));
    const session = await clientWith(fetcher).signInWithProvider('kakao', 'code', {
      kakaoCode: { state: 'signed-state', codeVerifier: 'device-verifier' },
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.premind.test/api/auth/oauth/kakao/exchange');
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      code: 'code', state: 'signed-state', code_verifier: 'device-verifier',
    });
    expect(session.refreshToken).toBe('refresh-token');
  });
  it('does not advertise Kakao against a server with only the old token flow', async () => {
    const fetcher = fetchReturning(mockResponse({ providers: ['google', 'kakao'] }));
    expect(await clientWith(fetcher).getAuthProviders()).toEqual(['google']);
  });
  it('accepts Kakao only when the server supports the code exchange', async () => {
    const fetcher = fetchReturning(mockResponse({ providers: ['google', 'kakao'], kakao_code_flow: true }));
    expect(await clientWith(fetcher).getAuthProviders()).toEqual(['google', 'kakao']);
  });
  it('rejects an untrusted browser destination returned by the server', async () => {
    const fetcher = fetchReturning(mockResponse({ authorization_url: 'https://evil.test', state: 'state' }));
    await expect(clientWith(fetcher).startKakaoSignIn('challenge')).rejects.toThrow('로그인 주소');
  });
});
