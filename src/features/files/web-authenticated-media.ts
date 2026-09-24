const WORKER_URL = '/premind-media-proxy.js';
const MEDIA_PATH_PREFIX = '/__premind_media__/';

export interface PrivateMediaSource {
  uri: string;
  headers: Record<string, string>;
}

export type RefreshPrivateMediaSource = (
  rejectedSource: PrivateMediaSource,
) => Promise<PrivateMediaSource>;

interface ProxiedMediaSource {
  uri: string;
  release: () => void;
}

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function serviceWorkerApi(): ServiceWorkerContainer {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('이 브라우저에서는 서버 원본 스트리밍을 지원하지 않아요.');
  }
  return navigator.serviceWorker;
}

async function activeController(): Promise<ServiceWorker> {
  const serviceWorker = serviceWorkerApi();
  registrationPromise ??= serviceWorker.register(WORKER_URL, { scope: '/' });
  const registration = await registrationPromise;
  await serviceWorker.ready;
  if (serviceWorker.controller) return serviceWorker.controller;

  return await new Promise<ServiceWorker>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      reject(new Error('보안 스트리밍을 준비하지 못했어요. 페이지를 새로고침해 주세요.'));
    }, 5_000);
    const onControllerChange = () => {
      if (!serviceWorker.controller) return;
      window.clearTimeout(timeout);
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve(serviceWorker.controller);
    };
    serviceWorker.addEventListener('controllerchange', onControllerChange);
    registration.active?.postMessage({ type: 'premind-media-claim-clients' });
  });
}

async function configure(
  worker: ServiceWorker,
  id: string,
  source: PrivateMediaSource,
  requestId?: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('서버 원본 스트리밍 설정이 지연되고 있어요.'));
    }, 5_000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.accepted) resolve();
      else reject(new Error('서버 원본 스트리밍을 설정하지 못했어요.'));
    };
    worker.postMessage(
      {
        type: 'premind-media-configure',
        id,
        uri: source.uri,
        headers: source.headers,
        requestId,
      },
      [channel.port2],
    );
  });
}

/**
 * Creates a same-origin, Range-capable URL for private media on web. The bearer
 * token remains in worker memory and never appears in browser history or logs.
 */
export async function createAuthenticatedWebMediaUrl(
  source: PrivateMediaSource,
  refreshSource?: RefreshPrivateMediaSource,
): Promise<ProxiedMediaSource> {
  const serviceWorker = serviceWorkerApi();
  const worker = await activeController();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let currentSource = source;
  let refreshInFlight: Promise<PrivateMediaSource> | null = null;
  let released = false;
  await configure(worker, id, currentSource);

  const answerSourceRequest = (event: MessageEvent) => {
    const data = event.data;
    if (
      (data?.type !== 'premind-media-source-request' &&
        data?.type !== 'premind-media-auth-refresh-request') ||
      data?.id !== id ||
      typeof data.requestId !== 'string'
    ) {
      return;
    }

    const requestingWorker = event.source as ServiceWorker | null;
    const current = requestingWorker?.postMessage
      ? requestingWorker
      : serviceWorker.controller;
    if (!current) return;

    const answer = async () => {
      try {
        if (data.type === 'premind-media-auth-refresh-request') {
          if (!refreshSource) {
            throw new Error('갱신할 미디어 세션이 없어요.');
          }
          refreshInFlight ??= refreshSource(currentSource).finally(() => {
            refreshInFlight = null;
          });
          currentSource = await refreshInFlight;
        } else if (refreshInFlight) {
          // A worker restart can ask for the source while an authentication
          // refresh is underway. Never race the fresh token with the old one.
          currentSource = await refreshInFlight;
        }

        if (released) return;
        await configure(current, id, currentSource, data.requestId);
      } catch {
        if (released) return;
        current.postMessage({
          type: 'premind-media-source-failed',
          id,
          requestId: data.requestId,
        });
      }
    };
    void answer();
  };
  serviceWorker.addEventListener('message', answerSourceRequest);

  return {
    uri: `${window.location.origin}${MEDIA_PATH_PREFIX}${encodeURIComponent(id)}`,
    release: () => {
      released = true;
      serviceWorker.removeEventListener('message', answerSourceRequest);
      serviceWorker.controller?.postMessage({
        type: 'premind-media-release',
        id,
      });
    },
  };
}
