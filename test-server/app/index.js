#!/usr/bin/env node

const http = require('http');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Health check endpoint for supervisor
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .box { padding: 20px; background: #f0f0f0; border-radius: 8px; }
          .status { color: #0c0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Test Server Working!</h1>
        <div class="box">
          <p><span class="status">✓ Status: ONLINE</span></p>
          <p>If you're seeing this, ingress is working correctly.</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Method:</strong> ${req.method}</p>
          <p><strong>Path:</strong> ${req.url}</p>
          <p><strong>Uptime:</strong> ${process.uptime().toFixed(1)}s</p>
        </div>
      </body>
    </html>
  `;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'close'
  });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server listening on port ${PORT}`);
  console.log(`✓ Server ready for ingress requests`);
  console.log(`✓ Health check available at /health`);
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
