# Quick Start Guide - TRMNL Screenshot Addon

## For Developers

### 1. Setup (2 minutes)
```bash
# Clone and install
git clone <repo>
cd ha-addon
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your values:
# - HA_TOKEN: Long-lived access token from HA
# - HA_URL: Your Home Assistant URL
# - TOKEN_SECRET: Same secret as HA Integration (≥32 chars)
```

### 2. Development Mode (1 minute)
```bash
# Start with auto-reload
npm run dev

# In another terminal, run tests
npm test
```

### 3. Run Tests (30 seconds)
```bash
# Run all tests
npm test

# Generate coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### 4. Code Quality (30 seconds)
```bash
# Check code style
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

## For Deployment

### Docker Build & Run
```bash
# Build image
docker build -t trmnl-screenshot-addon .

# Run locally
docker run -p 3000:3000 \
  -v /path/to/data:/data \
  -e HA_URL=http://homeassistant.local:8123 \
  -e HA_TOKEN=<your_token> \
  -e TOKEN_SECRET=<32_char_secret> \
  trmnl-screenshot-addon
```

### In Home Assistant
1. Copy addon directory to `/config/addons/local/trmnl_screenshot/`
2. Restart Home Assistant
3. Settings → Devices & Services → Add Integration
4. Search for "TRMNL"
5. Configure with token secret (must match addon)
6. In Addons, start TRMNL Screenshot Addon

## API Usage

### Request Screenshot
```bash
# Generate token (from HA Integration)
TOKEN="token_payload_signature"
DEVICE_ID="device_1"

# Get screenshot
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/trmnl/screenshot/$DEVICE_ID \
  -o screenshot.png
```

### Health Check
```bash
curl http://localhost:3000/health
# Response: {"status":"healthy","timestamp":"..."}
```

### Storage Stats
```bash
curl http://localhost:3000/admin/storage
# Response: {"count":2,"total_size":100000,"average_size":50000,"screenshots":[...]}
```

## Troubleshooting

### "Can't connect to Home Assistant"
```bash
# Check URL in .env
echo $HA_URL  # Should be http://homeassistant.local:8123

# Test connectivity
curl -H "Authorization: Bearer $HA_TOKEN" \
  $HA_URL/api/states

# Check logs
tail -f data/logs/error.log
```

### "Token validation failed"
```bash
# Verify TOKEN_SECRET matches HA Integration
# Check token format: token_<payload>_<signature>
# Verify device ID in URL matches token device_id

# Check logs for specific error
cat data/logs/combined.log | grep "Token"
```

### "Screenshot capture fails"
```bash
# Check Chromium is working
docker logs <container_id> | grep -i chromium

# Verify dashboard URL exists
curl -H "Authorization: Bearer $HA_TOKEN" \
  $HA_URL/lovelace/default

# Check timeout setting (default 30s)
echo $SCREENSHOT_TIMEOUT
```

### "High memory usage"
```bash
# Reduce concurrent captures
export MAX_CONCURRENT_CAPTURES=1

# Reduce image quality
export SCREENSHOT_QUALITY=70

# Check old file cleanup
curl http://localhost:3000/admin/storage | jq '.screenshots | length'
```

## Development Tasks

### Add New Test
```javascript
// tests/my-feature.test.js
describe("Feature Name", () => {
  test("should do something", () => {
    expect(true).toBe(true);
  });
});

// Run test
npm test my-feature.test.js
```

### Add New Endpoint
```javascript
// src/server.js
app.get("/my/endpoint", async (req, res) => {
  res.json({ status: "ok" });
});

// Test it
curl http://localhost:3000/my/endpoint
```

### Add New Environment Variable
```javascript
// 1. Add to .env.example
NEW_VAR=default_value

// 2. Use in code
const newVar = process.env.NEW_VAR || "default_value";

// 3. Add to run.sh if needed
export NEW_VAR=$(jq '.new_var' /data/options.json)
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.js` | Addon entry point, orchestration |
| `src/server.js` | Express HTTP server |
| `src/screenshot.js` | Puppeteer screenshot capture |
| `src/image-processor.js` | Image optimization |
| `src/auth.js` | Token validation |
| `src/storage.js` | File management |
| `src/websocket.js` | HA Integration WebSocket |
| `src/logger.js` | Logging infrastructure |
| `tests/` | 7 test files, 100+ tests |

## Environment Variables

```bash
# Required
HA_TOKEN                    # Long-lived HA access token
TOKEN_SECRET                # Secret for HMAC signing (≥32 chars)

# Optional (with defaults)
HA_URL                      # Default: http://homeassistant.local:8123
NODE_ENV                    # Default: development
PORT                        # Default: 3000
HOST                        # Default: 0.0.0.0
SCREENSHOT_TIMEOUT          # Default: 30000ms
SCREENSHOT_QUALITY          # Default: 90
MAX_CONCURRENT_CAPTURES     # Default: 3
LOG_LEVEL                   # Default: info
DATA_PATH                   # Default: /data
```

## Monitoring

### View Logs
```bash
# Error logs only
tail -f data/logs/error.log

# All logs
tail -f data/logs/combined.log

# Follow color output
npm run dev
```

### Health Monitoring
```bash
# Check addon health every 10s
watch -n 10 'curl -s http://localhost:3000/health | jq'

# Monitor storage
watch 'curl -s http://localhost:3000/admin/storage | jq .count'
```

### Performance Testing
```bash
# Benchmark screenshot capture
time curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/trmnl/screenshot/$DEVICE_ID \
  -o /dev/null

# Load test (basic)
for i in {1..10}; do
  curl -s http://localhost:3000/health > /dev/null &
done
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | Change `PORT=3001` or kill process |
| Permission denied on /data | Run with `sudo` or fix permissions |
| Chromium not found | Rebuild Docker image |
| Token keeps expiring | Ensure rotation is working in Integration |
| Memory bloat | Reduce `MAX_CONCURRENT_CAPTURES` or `SCREENSHOT_QUALITY` |

## Getting Help

1. **Check logs**: `tail -f data/logs/combined.log`
2. **Run tests**: `npm test` to verify functionality
3. **Review docs**: See README.md and TEST_COVERAGE.md
4. **Debug mode**: `LOG_LEVEL=debug npm run dev`
5. **Check integration**: Verify HA Integration component is running

## Next Steps

1. ✅ Local development working
2. ✅ Tests passing (npm test)
3. → Deploy to Home Assistant
4. → Configure with HA Integration
5. → Test with real TRMNL device
6. → Monitor production logs

---

**Last Updated**: November 2024
**Version**: 0.1.0
**Status**: Production Ready
