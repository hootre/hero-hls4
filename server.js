const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT   = 3000;
const PUBLIC = path.join(__dirname, 'public');

function makeRes(res) {
  const r = {
    _status: 200,
    _headers: {},
    status(code) { r._status = code; return r; },
    setHeader(k, v) { r._headers[k] = v; return r; },
    json(data) {
      const body = JSON.stringify(data);
      res.writeHead(r._status, { 'Content-Type': 'application/json', ...r._headers });
      res.end(body);
    }
  };
  return r;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    const handlerPath = path.join(__dirname, pathname + '.js');
    if (!fs.existsSync(handlerPath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    delete require.cache[require.resolve(handlerPath)];
    const handler = require(handlerPath);
    const fakeReq = { query: parsed.query, url: req.url, method: req.method };
    const fakeRes = makeRes(res);
    try {
      await handler(fakeReq, fakeRes);
    } catch(e) {
      console.error('API error:', e.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    }
    return;
  }

  let filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC, 'index.html');
  }
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch(e) {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('[OK] server running at http://localhost:' + PORT);
});
