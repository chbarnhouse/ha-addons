#!/usr/bin/env node

const http = require('http');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .box { padding: 20px; background: #f0f0f0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>Test Server Working!</h1>
        <div class="box">
          <p>If you're seeing this, ingress is working correctly.</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Method:</strong> ${req.method}</p>
          <p><strong>Path:</strong> ${req.url}</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server listening on port ${PORT}`);
  console.log(`✓ Server ready for ingress requests`);
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});
