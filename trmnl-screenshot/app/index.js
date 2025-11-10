#!/usr/bin/env node

const http = require('http');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || '/data';
const PORT = process.env.PORT || 5001;
const SERVER_HOST = '0.0.0.0'; // Listen on all interfaces for ingress + direct access

// Configuration
let config = {
  ha_url: process.env.HA_URL || 'http://homeassistant.local:8123',
  ha_token: process.env.HA_TOKEN || '',
  screenshot_path: path.join(DATA_PATH, 'screenshots'),
  log_level: process.env.LOG_LEVEL || 'info'
};

// Ensure data directory exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}
if (!fs.existsSync(config.screenshot_path)) {
  fs.mkdirSync(config.screenshot_path, { recursive: true });
}

let browser = null;
let lastScreenshot = null;
let lastScreenshotTime = null;

// Logging function
function log(level, message) {
  const levelMap = { debug: 0, info: 1, warning: 2, error: 3 };
  const configLevel = levelMap[config.log_level] || 1;
  if (levelMap[level] >= configLevel) {
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`);
  }
}

// Initialize Puppeteer
async function initBrowser() {
  try {
    log('info', 'Initializing Puppeteer browser...');
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--single-process'
      ],
      headless: true
    });
    log('info', 'Puppeteer browser initialized successfully');
    return true;
  } catch (error) {
    log('error', `Failed to initialize Puppeteer: ${error.message}`);
    return false;
  }
}

// Capture screenshot
async function captureScreenshot(dashboardUrl) {
  try {
    if (!browser) {
      return { success: false, error: 'Browser not initialized' };
    }

    log('debug', `Capturing screenshot from: ${dashboardUrl}`);
    const page = await browser.newPage();

    try {
      // Set viewport for e-ink display (typical TRMNL dimensions)
      await page.setViewport({
        width: 800,
        height: 480,
        deviceScaleFactor: 1
      });

      // Navigate to dashboard
      await page.goto(dashboardUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to be stable
      await page.waitForTimeout(2000);

      // Take screenshot
      const screenshotBuffer = await page.screenshot({ type: 'png' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dashboard-${timestamp}.png`;
      const filepath = path.join(config.screenshot_path, filename);

      // Save to disk
      fs.writeFileSync(filepath, screenshotBuffer);

      lastScreenshot = screenshotBuffer;
      lastScreenshotTime = new Date();

      log('info', `Screenshot captured successfully: ${filename}`);
      return {
        success: true,
        filename: filename,
        filepath: filepath,
        size: screenshotBuffer.length,
        timestamp: lastScreenshotTime
      };
    } finally {
      await page.close();
    }
  } catch (error) {
    log('error', `Screenshot capture failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// HTTP Request handler
const server = http.createServer(async (req, res) => {
  log('debug', `${req.method} ${req.url}`);

  try {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        addon: 'TRMNL Screenshot',
        version: '0.1.7',
        browser_ready: browser !== null,
        last_screenshot: lastScreenshotTime
      }));
    }
    else if (req.url === '/api/screenshot' && req.method === 'POST') {
      // Capture screenshot endpoint
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const dashboardUrl = payload.dashboard_url ||
            `${config.ha_url}/lovelace/default` +
            (config.ha_token ? `?token=${config.ha_token}` : '');

          const result = await captureScreenshot(dashboardUrl);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
    }
    else if (req.url === '/api/screenshot/latest' && req.method === 'GET') {
      // Get latest screenshot
      if (lastScreenshot) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(lastScreenshot);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No screenshot available yet' }));
      }
    }
    else if (req.url === '/') {
      // Web UI
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>TRMNL Screenshot Addon</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f5f5f5;
              }
              .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 { color: #333; margin-top: 0; }
              .status {
                padding: 12px;
                background: #e8f5e9;
                border-left: 4px solid #4caf50;
                margin: 15px 0;
                border-radius: 4px;
              }
              .section { margin: 20px 0; }
              .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin: 10px 0;
              }
              .info-item {
                padding: 10px;
                background: #f9f9f9;
                border-radius: 4px;
                border: 1px solid #ddd;
              }
              .info-label { font-weight: bold; color: #666; font-size: 0.85em; }
              .info-value { color: #333; margin-top: 3px; }
              button {
                background: #2196F3;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
              }
              button:hover { background: #1976D2; }
              .endpoint {
                background: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 12px;
                margin: 5px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>📱 TRMNL Screenshot Addon</h1>

              <div class="status">
                ✅ Addon is running and ready to capture screenshots
              </div>

              <div class="section">
                <h2>System Status</h2>
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">Version</div>
                    <div class="info-value">0.1.7</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Port</div>
                    <div class="info-value">5001</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Home Assistant</div>
                    <div class="info-value">${config.ha_url}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Browser Status</div>
                    <div class="info-value" id="browser-status">Checking...</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <h2>API Endpoints</h2>
                <div class="endpoint">GET /health</div>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">Health check endpoint</div>

                <div class="endpoint">POST /api/screenshot</div>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">
                  Capture screenshot. Body: <code>{"dashboard_url": "http://..."}</code>
                </div>

                <div class="endpoint">GET /api/screenshot/latest</div>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">Get most recent screenshot (PNG)</div>
              </div>

              <div class="section">
                <h2>Quick Test</h2>
                <button onclick="testHealth()">Test Health Endpoint</button>
                <button onclick="captureNow()">Capture Screenshot</button>
                <div id="test-result" style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; display: none;">
                  <strong>Result:</strong> <span id="result-text"></span>
                </div>
              </div>
            </div>

            <script>
              function testHealth() {
                fetch('/health')
                  .then(r => r.json())
                  .then(data => {
                    document.getElementById('test-result').style.display = 'block';
                    document.getElementById('result-text').textContent = JSON.stringify(data, null, 2);
                  })
                  .catch(e => {
                    document.getElementById('test-result').style.display = 'block';
                    document.getElementById('result-text').textContent = 'Error: ' + e.message;
                  });
              }

              function captureNow() {
                fetch('/api/screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dashboard_url: '${config.ha_url}/lovelace/default' })
                })
                  .then(r => r.json())
                  .then(data => {
                    document.getElementById('test-result').style.display = 'block';
                    document.getElementById('result-text').textContent = JSON.stringify(data, null, 2);
                  })
                  .catch(e => {
                    document.getElementById('test-result').style.display = 'block';
                    document.getElementById('result-text').textContent = 'Error: ' + e.message;
                  });
              }

              // Update browser status
              testHealth();
            </script>
          </body>
        </html>
      `);
    }
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: req.url }));
    }
  } catch (error) {
    log('error', `Request handler error: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Startup
async function start() {
  console.log('======================================');
  console.log('TRMNL Screenshot Addon Starting');
  console.log('======================================');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Home Assistant URL: ${config.ha_url}`);
  console.log(`Data path: ${DATA_PATH}`);
  console.log(`Listening on port ${PORT}`);
  console.log('');

  // Initialize browser
  const browserReady = await initBrowser();
  if (!browserReady) {
    log('warning', 'Browser initialization failed - screenshot capture will not work');
  }

  // Start HTTP server
  server.listen(PORT, SERVER_HOST, () => {
    console.log('======================================');
    console.log('TRMNL Screenshot Addon Started');
    console.log('======================================');
    console.log(`✓ HTTP server running on port ${PORT}`);
    console.log(`✓ Web UI: http://localhost:${PORT}`);
    console.log(`✓ Health: http://localhost:${PORT}/health`);
    console.log(`✓ Accessible via Home Assistant Ingress`);
    console.log('');
  });

  server.on('error', (err) => {
    log('error', `Server error: ${err.message}`);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log('info', 'SIGTERM received, shutting down gracefully...');
    if (browser) {
      await browser.close();
    }
    server.close(() => {
      log('info', 'Server closed');
      process.exit(0);
    });
  });
}

start();
