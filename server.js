const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;

http.createServer((req, res) => {

  // ── CORS pre-flight ─────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-claude-key');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // ── Anthropic proxy  POST /api/claude ───────────────────────
  if (req.url === '/api/claude' && req.method === 'POST') {
    const apiKey = req.headers['x-claude-key'];
    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Missing x-claude-key header' } }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const bodyBuf = Buffer.from(body);
      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'x-api-key':          apiKey,
          'anthropic-version':  '2023-06-01',
          'content-type':       'application/json',
          'content-length':     bodyBuf.length,
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
      });
      proxyReq.write(bodyBuf);
      proxyReq.end();
    });
    return;
  }

  // ── Serve static files ───────────────────────────────────────
  let filePath = req.url === '/' ? '/meta-ads-dashboard.html' : req.url;
  filePath = path.join(__dirname, decodeURIComponent(filePath));

  const ext = path.extname(filePath).toLowerCase();
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });

}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   Meta Ads Dashboard  ✅ Running         ║');
  console.log(`  ║   Open: ${url}          ║`);
  console.log('  ║   Press Ctrl+C to stop                   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  // Auto-open browser on Windows
  require('child_process').exec(`start ${url}`);
});
