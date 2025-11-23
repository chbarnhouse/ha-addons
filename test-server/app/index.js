#!/usr/bin/env node

const http = require('http');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>OK</h1></body></html>`;

  res.writeHead(200, {
    'Content-Type': 'text/html'
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
