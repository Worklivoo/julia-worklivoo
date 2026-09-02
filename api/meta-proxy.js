export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    const requestId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
    const metaAccessToken = process.env.META_ACCESS_TOKEN || '';
    const metaAppId = process.env.META_APP_ID || '';

    const requestUrl = new URL(req.url, 'http://localhost');
    res.setHeader('x-meta-proxy-request-id', requestId);

    if (requestUrl.searchParams.get('ping') === '1') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: true,
          requestId,
          hasToken: Boolean(metaAccessToken),
          hasAppId: Boolean(metaAppId),
          node: process.version,
        })
      );
      return;
    }
    const path = String(requestUrl.searchParams.get('path') || '').replace(/^\/+/, '');

    if (!path) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: "Parâmetro 'path' é obrigatório." }));
      return;
    }

    if (!metaAccessToken) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'META_ACCESS_TOKEN não configurado no servidor.' }));
      return;
    }

    const rawPathParts = path.split('?');
    const graphPathOnly = rawPathParts[0];
    const embeddedQuery = rawPathParts.slice(1).join('?');

    const isUploadSessionStart = /^v\d+\.\d+\/uploads$/i.test(graphPathOnly);
    const isUploadBinary = graphPathOnly.includes('/upload:') || /^v\d+\.\d+\/upload:/i.test(graphPathOnly);

    let forwardPath = graphPathOnly;
    const forwardParams = new URLSearchParams(requestUrl.searchParams);
    forwardParams.delete('path');
    forwardParams.delete('debug');

    if (embeddedQuery) {
      const embeddedParams = new URLSearchParams(embeddedQuery);
      for (const [k, v] of embeddedParams.entries()) {
        if (!forwardParams.has(k)) {
          forwardParams.set(k, v);
        }
      }
    }

    if (isUploadSessionStart) {
      if (!metaAppId) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'META_APP_ID não configurado no servidor.' }));
        return;
      }
      const version = graphPathOnly.split('/')[0];
      forwardPath = `${version}/${metaAppId}/uploads`;
      if (!forwardParams.has('access_token')) {
        forwardParams.set('access_token', metaAccessToken);
      }
    }

    const graphUrl = new URL(`https://graph.facebook.com/${forwardPath}`);
    for (const [k, v] of forwardParams.entries()) {
      graphUrl.searchParams.set(k, v);
    }

    const getRawBody = () =>
      new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

    const method = req.method || 'GET';

    const headers = new Headers();
    const contentType = req.headers['content-type'];
    if (contentType) headers.set('Content-Type', String(contentType));
    const fileOffset = req.headers['file_offset'];
    if (fileOffset) headers.set('file_offset', String(fileOffset));
    headers.set('Authorization', `${isUploadBinary ? 'OAuth' : 'Bearer'} ${metaAccessToken}`);
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const init = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await getRawBody();
    }

    const upstream = await fetch(graphUrl.toString(), init);
    res.statusCode = upstream.status;

    const upstreamContentType = upstream.headers.get('content-type');
    if (upstreamContentType) {
      res.setHeader('Content-Type', upstreamContentType);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    res.end(buf);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Erro interno no proxy.' }));
  }
}
