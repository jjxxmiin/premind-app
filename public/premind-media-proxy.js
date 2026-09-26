/* PREMIND authenticated media bridge.
 *
 * HTML audio/video elements cannot attach Authorization headers. This worker
 * exposes a same-origin virtual URL and forwards Range requests to the private
 * API without putting the access token in a URL or buffering the whole file.
 */
// Under the worker's own scope: '/__premind_media__/' at the site root,
// '/app/__premind_media__/' on premind.co.kr (the web build lives under /app).
const MEDIA_PATH_PREFIX = new URL('__premind_media__/', self.registration.scope).pathname;
const SOURCE_REQUEST_TIMEOUT_MS = 20_000;
const sources = new Map();
const waiters = new Map();
const sourceRequests = new Map();
const refreshRequests = new Map();
const releasedIds = new Set();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function validSource(value) {
  if (!value || typeof value.id !== 'string' || typeof value.uri !== 'string') {
    return false;
  }
  try {
    const url = new URL(value.uri);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function rememberSource(value) {
  if (!validSource(value)) return false;
  if (releasedIds.has(value.id) && typeof value.requestId === 'string') {
    return false;
  }
  releasedIds.delete(value.id);
  sources.set(value.id, {
    uri: value.uri,
    headers:
      value.headers && typeof value.headers === 'object' ? value.headers : {},
  });
  if (typeof value.requestId === 'string') {
    finishSourceRequest(value.requestId, sources.get(value.id));
  }
  return true;
}

function finishSourceRequest(requestId, source) {
  const pending = waiters.get(requestId);
  if (!pending) return;
  waiters.delete(requestId);
  clearTimeout(pending.timeout);
  pending.resolve(source);
}

function finishSourceRequestsForId(id) {
  for (const [requestId, pending] of waiters) {
    if (pending.id === id) finishSourceRequest(requestId, null);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'premind-media-claim-clients') {
    event.waitUntil(self.clients.claim());
  }
  if (data.type === 'premind-media-configure') {
    const accepted = rememberSource(data);
    event.ports[0]?.postMessage({ accepted });
  }
  if (
    data.type === 'premind-media-source-failed' &&
    typeof data.id === 'string' &&
    typeof data.requestId === 'string'
  ) {
    const pending = waiters.get(data.requestId);
    if (pending?.id === data.id) finishSourceRequest(data.requestId, null);
  }
  if (data.type === 'premind-media-release' && typeof data.id === 'string') {
    releasedIds.add(data.id);
    sources.delete(data.id);
    finishSourceRequestsForId(data.id);
    setTimeout(() => releasedIds.delete(data.id), SOURCE_REQUEST_TIMEOUT_MS + 10_000);
  }
});

function requestId() {
  return typeof self.crypto?.randomUUID === 'function'
    ? self.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function askClientForSource(id, clientId, type) {
  const idForRequest = requestId();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      finishSourceRequest(idForRequest, null);
    }, SOURCE_REQUEST_TIMEOUT_MS);
    waiters.set(idForRequest, { id, resolve, timeout });

    void (async () => {
      const preferred = clientId ? await self.clients.get(clientId) : null;
      const clients = preferred
        ? [preferred]
        : await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      if (!clients.length) {
        finishSourceRequest(idForRequest, null);
        return;
      }
      clients.forEach((client) =>
        client.postMessage({ type, id, requestId: idForRequest }),
      );
    })().catch(() => finishSourceRequest(idForRequest, null));
  });
}

async function requestSourceFromClient(id, clientId) {
  const known = sources.get(id);
  if (known) return known;
  if (releasedIds.has(id)) return null;

  const pending = sourceRequests.get(id);
  if (pending) return pending;
  const request = askClientForSource(
    id,
    clientId,
    'premind-media-source-request',
  ).finally(() => {
    if (sourceRequests.get(id) === request) sourceRequests.delete(id);
  });
  sourceRequests.set(id, request);
  return request;
}

async function requestRefreshedSource(id, clientId, rejectedSource) {
  const pending = refreshRequests.get(id);
  if (pending) return pending;

  if (sources.get(id) === rejectedSource) sources.delete(id);
  const request = askClientForSource(
    id,
    clientId,
    'premind-media-auth-refresh-request',
  )
    .then((source) => {
      if (!source && !releasedIds.has(id) && !sources.has(id)) {
        sources.set(id, rejectedSource);
      }
      return source;
    })
    .finally(() => {
      if (refreshRequests.get(id) === request) refreshRequests.delete(id);
    });
  refreshRequests.set(id, request);
  return request;
}

async function fetchPrivateMedia(request, source) {
  const headers = new Headers(source.headers);
  for (const name of ['range', 'if-range', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  return fetch(source.uri, {
    cache: 'no-store',
    credentials: 'omit',
    headers,
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    redirect: 'follow',
  });
}

async function proxyMedia(request, id, clientId) {
  const source = await requestSourceFromClient(id, clientId);
  if (!source) {
    return new Response('Media source is no longer registered.', { status: 404 });
  }

  try {
    const response = await fetchPrivateMedia(request, source);
    if (response.status !== 401) return response;

    const refreshedSource = await requestRefreshedSource(id, clientId, source);
    if (!refreshedSource) return response;
    // A rejected request is replayed exactly once. A second 401 is returned to
    // the media element rather than entering an authentication loop.
    return await fetchPrivateMedia(request, refreshedSource);
  } catch {
    return new Response('Private media request failed.', { status: 502 });
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(MEDIA_PATH_PREFIX)) {
    return;
  }
  const id = decodeURIComponent(url.pathname.slice(MEDIA_PATH_PREFIX.length));
  event.respondWith(proxyMedia(event.request, id, event.clientId));
});
