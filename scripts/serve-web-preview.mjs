import { createReadStream, statSync } from 'node:fs';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.env.PREMIND_PREVIEW_ROOT || 'dist');
const port = Number(process.env.PREMIND_PREVIEW_PORT || 8088);
const apiTarget = new URL(
  process.env.PREMIND_API_TARGET || 'http://127.0.0.1:8100',
);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function proxyApi(request, response) {
  const upstreamUrl = new URL(request.url, apiTarget);
  const requestImpl = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const headers = { ...request.headers, host: upstreamUrl.host };
  delete headers.connection;

  const upstream = requestImpl(
    upstreamUrl,
    { headers, method: request.method },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders.connection;
      delete responseHeaders['keep-alive'];
      delete responseHeaders['proxy-authenticate'];
      delete responseHeaders['proxy-authorization'];
      delete responseHeaders.te;
      delete responseHeaders.trailer;
      delete responseHeaders['transfer-encoding'];
      delete responseHeaders.upgrade;
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ detail: 'PREMIND API에 연결하지 못했어요.' }));
  });
  request.pipe(upstream);
}

function safeStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`)
    ? candidate
    : null;
}

function readFileStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, 'http://preview.local');
  let filePath = safeStaticPath(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(400).end('Bad request');
    return;
  }

  let fileStat = readFileStat(filePath);
  if (fileStat?.isDirectory()) {
    filePath = resolve(filePath, 'index.html');
    fileStat = readFileStat(filePath);
  }
  if (!fileStat?.isFile()) {
    if (extname(requestUrl.pathname)) {
      response.writeHead(404).end('Not found');
      return;
    }
    filePath = resolve(root, 'index.html');
    fileStat = readFileStat(filePath);
  }
  if (!fileStat?.isFile()) {
    response.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '1',
    });
    response.end('Preview build is being refreshed');
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const cacheControl = filePath.includes(`${sep}_expo${sep}`)
    ? 'public, max-age=31536000, immutable'
    : extension === '.html'
      ? 'no-cache'
      : 'public, max-age=3600';
  response.writeHead(200, {
    'cache-control': cacheControl,
    'content-length': fileStat.size,
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(503, {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': '1',
    });
    response.end('Preview build is being refreshed');
  });
  stream.pipe(response);
}

const server = createHttpServer((request, response) => {
  const pathname = new URL(request.url, 'http://preview.local').pathname;
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    proxyApi(request, response);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }
  serveStatic(request, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`PREMIND preview: http://127.0.0.1:${port}`);
  console.log(`API proxy: ${apiTarget.origin}`);
});
