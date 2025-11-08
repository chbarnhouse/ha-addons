# Complete Testing Guide - TRMNL Addon

This guide walks through all testing phases from unit tests to production deployment.

---

## Phase 1: Local Development Setup & Environment

### Step 1.1: Install Dependencies
```bash
cd /Users/charlie/Documents/Development/HA_TRMNL/ha-addon
npm install
```

**Expected Output:**
- `added XXX packages in Xs`
- No errors or vulnerabilities
- node_modules/ directory created

**Troubleshooting:**
- If you see permission errors: `npm install --no-optional`
- If network fails: `npm cache clean --force && npm install`

### Step 1.2: Verify Environment Setup
```bash
# Check Node version (should be 20+)
node --version

# Check npm version
npm --version

# Verify all packages installed
npm ls --depth=0
```

**Expected Output:**
```
node@20.x.x
npm@10.x.x
trmnl-screenshot-addon@0.1.0
├── express@4.18.2
├── puppeteer@21.0.0
├── sharp@0.32.6
├── ws@8.14.2
├── winston@3.11.0
└── dotenv@16.3.1
```

### Step 1.3: Create Environment File
```bash
# Copy example environment
cp .env.example .env

# Edit .env with test values
cat .env
```

**Your .env should contain (with test values):**
```bash
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
HA_TOKEN=test_token_123
HA_URL=http://localhost:8123
SCREENSHOT_TIMEOUT=30000
SCREENSHOT_QUALITY=90
MAX_CONCURRENT_CAPTURES=3
TOKEN_SECRET=test_secret_key_minimum_32_chars_1234567890
DATA_PATH=/data
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000
```

### Step 1.4: Verify Directory Structure
```bash
# Check that all required directories exist
ls -la src/
ls -la tests/

# Expected: 8 files in src/, 8 files in tests/
```

---

## Phase 2: Unit Testing

### Step 2.1: Run All Tests
```bash
npm test
```

**This will:**
1. Run all 7 test files
2. Generate coverage report
3. Show test results in console

**Expected Output:**
```
PASS  tests/auth.test.js (XXs)
PASS  tests/image-processor.test.js (XXs)
PASS  tests/server.test.js (XXs)
PASS  tests/storage.test.js (XXs)
PASS  tests/screenshot.test.js (XXs)
PASS  tests/websocket.test.js (XXs)
PASS  tests/integration.test.js (XXs)

Tests:       100+ passed, 0 failed
Coverage:    85%+ across all modules
```

### Step 2.2: Run Tests in Watch Mode (for development)
```bash
npm run test:watch
```

**This will:**
- Re-run tests whenever you save a file
- Great for TDD (test-driven development)
- Press `q` to quit watch mode

### Step 2.3: Generate Coverage Report
```bash
npm run test:coverage
```

**This will:**
1. Run all tests with coverage tracking
2. Create `coverage/` directory with HTML report
3. Show coverage summary

**Check coverage breakdown:**
```bash
# View coverage summary
cat coverage/coverage-summary.json | jq '.total'

# Expected output shows percentages for:
# - statements
# - branches
# - functions
# - lines
```

**Open HTML report (for visual analysis):**
```bash
open coverage/lcov-report/index.html
```

This shows:
- Line-by-line coverage
- Branch coverage
- Function coverage
- Uncovered lines highlighted

### Step 2.4: Run Specific Test File
```bash
# Test token validation only
npm test auth.test.js

# Test image processing only
npm test image-processor.test.js

# Test HTTP server only
npm test server.test.js
```

**Expected:** Only that test file runs with its results

### Step 2.5: Run Tests Matching Pattern
```bash
# Run all token-related tests
npm test -- --testNamePattern="token"

# Run all validation tests
npm test -- --testNamePattern="validation"

# Run all storage tests
npm test -- --testNamePattern="storage"
```

### Step 2.6: Check Code Quality
```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Format code to standard
npm run format
```

**Expected Output:**
- No ESLint errors
- Code formatted consistently
- All files pass Prettier checks

---

## Phase 3: Manual Integration Testing

### Step 3.1: Start Addon in Development Mode
```bash
npm run dev
```

**Expected Output:**
```
[timestamp] info: ======================================
[timestamp] info: TRMNL Screenshot Addon Starting
[timestamp] info: ======================================
[timestamp] info: Initializing storage...
[timestamp] info: Starting HTTP server...
[timestamp] info: Initializing Puppeteer...
[timestamp] info: Connecting to Home Assistant WebSocket...
[timestamp] warn: Initial WebSocket connection failed, will retry
[timestamp] info: Setting up periodic cleanup...
[timestamp] info: ======================================
[timestamp] info: TRMNL Screenshot Addon Ready
[timestamp] info: ======================================
```

**Note:** WebSocket connection warning is expected if HA isn't running

### Step 3.2: Test Health Check Endpoint
```bash
# In another terminal, test health endpoint
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T12:00:00.000Z"
}
```

### Step 3.3: Test Status Endpoint
```bash
curl http://localhost:3000/status
```

**Expected Response:**
```json
{
  "addon_healthy": true,
  "storage": {
    "count": 0,
    "total_size": 0,
    "average_size": 0,
    "screenshots": []
  },
  "timestamp": "2025-11-08T12:00:00.000Z"
}
```

### Step 3.4: Test Token Generation
```bash
# Generate a valid test token
node << 'EOF'
const crypto = require('crypto');

const SECRET = process.env.TOKEN_SECRET || "test_secret_key_minimum_32_chars_1234567890";
const DEVICE_ID = "test_device_1";

const payload = {
  device_id: DEVICE_ID,
  issued_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const payloadJson = JSON.stringify(payload);
const payloadB64 = Buffer.from(payloadJson).toString('base64');
const signature = crypto
  .createHmac('sha256', SECRET)
  .update(payloadB64)
  .digest('hex');

const token = `token_${payloadB64}_${signature}`;
console.log('Generated Token:');
console.log(token);
console.log('\nToken Info:');
console.log(JSON.stringify(payload, null, 2));
EOF
```

**Expected Output:**
- A valid token string like: `token_eyJkZXZpY2VfaWQi...==_a1b2c3d4...`
- Token info showing device_id, issued_at, expires_at

### Step 3.5: Test Image Endpoint Without Token
```bash
curl -v http://localhost:3000/trmnl/screenshot/test_device_1
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Missing or invalid authorization"
}
```

### Step 3.6: Create Mock Screenshot for Testing
```bash
node << 'EOF'
const fs = require('fs');
const path = require('path');

// Create test data directory
const dataDir = './test_data/screenshots';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create a mock PNG image (minimal valid PNG)
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const mockImage = Buffer.alloc(1024);
pngSignature.copy(mockImage);

// Save it
fs.writeFileSync(path.join(dataDir, 'test_device_1.png'), mockImage);
console.log('✓ Mock screenshot created at:', path.join(dataDir, 'test_device_1.png'));
console.log('✓ Size:', mockImage.length, 'bytes');
EOF
```

### Step 3.7: Test Image Endpoint With Valid Token
```bash
# Store token in variable for easy use
TOKEN="token_eyJkZXZpY2VfaWQiOiJ0ZXN0X2RldmljZV8xIiwiaXNzdWVkX2F0IjoiMjAyNS0xMS0wOFQxMjowMDowMC4wMDBaIiwiZXhwaXJlc19hdCI6IjIwMjUtMTEtMDlUMTI6MDA6MDAuMDAwWiJ9_YOUR_SIGNATURE_HERE"

# Request with token (you'll need to generate proper token from Step 3.4)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/trmnl/screenshot/test_device_1 \
  -o test_screenshot.png -v
```

**Expected Response:** `200 OK` with PNG image data

### Step 3.8: Check Addon Logs
```bash
# View logs while addon is running (from the npm run dev output)
# Look for entries like:
# - Screenshot served for device test_device_1
# - Token validation: success
# - Request processed
```

### Step 3.9: Stop Addon
```bash
# Press Ctrl+C in the terminal where npm run dev is running
# You should see:
# Graceful shutdown complete
```

---

## Phase 4: Docker Testing

### Step 4.1: Build Docker Image
```bash
docker build -t trmnl-screenshot-addon .
```

**Expected Output:**
```
[+] Building 45.2s (15/15) FINISHED
=> [internal] load build definition
...
=> => writing image sha256:a1b2c3d4...
=> => naming to docker.io/library/trmnl-screenshot-addon:latest
Successfully tagged trmnl-screenshot-addon:latest
```

### Step 4.2: Create Data Directory for Docker
```bash
mkdir -p /tmp/trmnl_data
chmod 777 /tmp/trmnl_data
```

### Step 4.3: Run Docker Container
```bash
docker run -d \
  --name trmnl-addon-test \
  -p 3000:3000 \
  -v /tmp/trmnl_data:/data \
  -e HA_URL=http://host.docker.internal:8123 \
  -e HA_TOKEN=test_token_123 \
  -e TOKEN_SECRET=test_secret_key_minimum_32_chars_1234567890 \
  -e LOG_LEVEL=info \
  trmnl-screenshot-addon
```

**Expected Output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

This is the container ID.

### Step 4.4: Check Container Logs
```bash
docker logs -f trmnl-addon-test
```

**Expected Output:**
- Addon startup messages
- "TRMNL Screenshot Addon Ready"
- No error messages

### Step 4.5: Test Endpoints from Host
```bash
# Health check
curl http://localhost:3000/health

# Status
curl http://localhost:3000/status

# Should work same as local testing
```

### Step 4.6: Check Data Directory
```bash
ls -la /tmp/trmnl_data/
```

**Expected:**
- `screenshots/` directory (empty initially)
- `logs/` directory with `combined.log` and `error.log`

### Step 4.7: View Container Logs in Detail
```bash
# See last 50 lines
docker logs --tail 50 trmnl-addon-test

# Follow logs in real-time
docker logs -f trmnl-addon-test

# See logs with timestamps
docker logs -t trmnl-addon-test
```

### Step 4.8: Check Container Stats
```bash
docker stats trmnl-addon-test
```

**This shows:**
- CPU usage
- Memory usage
- Network I/O
- Block I/O

**Note:** Press Ctrl+C to exit

### Step 4.9: Stop and Remove Container
```bash
docker stop trmnl-addon-test
docker rm trmnl-addon-test
```

---

## Phase 5: Performance Testing

### Step 5.1: Test Response Times
```bash
# Time a single request
time curl http://localhost:3000/health

# Should be <100ms
```

### Step 5.2: Load Test (simple)
```bash
# Send 10 concurrent requests
for i in {1..10}; do
  curl -s http://localhost:3000/status > /dev/null &
done
wait

echo "Load test complete"
```

### Step 5.3: Rate Limiting Test
```bash
# Generate valid token first
TOKEN="your_generated_token"

# Send 15 requests to image endpoint (should hit limit at 10)
for i in {1..15}; do
  echo "Request $i:"
  curl -H "Authorization: Bearer $TOKEN" \
    http://localhost:3000/trmnl/screenshot/test_device_1 \
    -s -o /dev/null -w "Status: %{http_code}\n"
done

# Requests 1-10 should return 200 or 404 (not found)
# Requests 11-15 should return 429 (rate limited)
```

### Step 5.4: Memory Leak Check
```bash
# Start addon and monitor memory
npm run dev &
ADDON_PID=$!

# Monitor memory for 5 minutes
for i in {1..30}; do
  ps aux | grep -E "^[^ ]+ +$ADDON_PID " | awk '{print "Memory: " $6 " KB"}'
  sleep 10
done

# Memory should stay relatively stable
```

---

## Phase 6: Integration with Home Assistant

### Step 6.1: Prepare Home Assistant (if available)
```bash
# If you have HA running locally:
# 1. Copy addon to HA config
cp -r . /path/to/ha/config/addons/local/trmnl_screenshot

# 2. Restart HA
# 3. Go to Settings > Addons > TRMNL Screenshot
# 4. Configure addon options
# 5. Start addon
```

### Step 6.2: Test WebSocket Connection (if HA running)
```bash
# Check if WebSocket connects (view logs)
docker logs -f trmnl-addon-test | grep -i websocket
```

**Expected:**
- "Connecting to Home Assistant WebSocket"
- "WebSocket authenticated" (if HA token is valid)

### Step 6.3: Test Full Screenshot Workflow
If HA Integration is also running:

```bash
# 1. Integration sends: "capture_screenshot" command via WebSocket
# 2. Addon captures screenshot from HA dashboard
# 3. Addon optimizes image for device
# 4. Addon stores screenshot
# 5. Check logs for success
docker logs trmnl-addon-test | grep "Screenshot"
```

---

## Phase 7: Debugging Failed Tests

### Step 7.1: Run Single Failing Test
```bash
# If auth.test.js is failing
npm test auth.test.js -- --verbose
```

**--verbose shows:**
- Each test name as it runs
- Detailed error messages
- Line numbers of failures

### Step 7.2: Debug Token Validation
```bash
# Create test token and check fields
node << 'EOF'
const { validateToken, getTokenInfo } = require('./src/auth.js');

// Create valid token
// ... (token creation code from Step 3.4)

// Try to validate
const info = getTokenInfo(token);
console.log('Token info:', info);

const result = validateToken(token, 'test_device_1', SECRET);
console.log('Validation result:', result);
EOF
```

### Step 7.3: Check File Permissions
```bash
# Ensure test_data directory is writable
ls -la test_data/
chmod 777 test_data
chmod 777 test_data/screenshots 2>/dev/null
```

### Step 7.4: Clear Test Data
```bash
# Clean up test artifacts
rm -rf test_data
rm -rf coverage
npm cache clean --force
```

### Step 7.5: Re-run Tests with Details
```bash
# Run with full error traces
npm test -- --no-coverage --verbose

# Run single test file with stack traces
npm test auth.test.js -- --verbose --bail
```

---

## Phase 8: Pre-Deployment Checklist

### Step 8.1: Final Unit Test Run
```bash
npm test

# Ensure: Tests pass ✓, Coverage 85%+ ✓
```

### Step 8.2: Code Quality Check
```bash
npm run lint
npm run format

# Ensure: No errors ✓
```

### Step 8.3: Docker Build
```bash
docker build -t trmnl-screenshot-addon:latest .

# Ensure: Build succeeds ✓, No warnings ✓
```

### Step 8.4: Docker Run Test
```bash
docker run --rm -p 3000:3000 \
  -e HA_TOKEN=test \
  -e TOKEN_SECRET=test_secret_key_minimum_32_chars_1234567890 \
  trmnl-screenshot-addon

# Let it run for 10 seconds, then Ctrl+C

# Ensure: Starts cleanly ✓, Stops cleanly ✓
```

### Step 8.5: File Permissions
```bash
# Ensure scripts are executable
chmod +x run.sh

# Ensure directories exist
ls -d src tests

# Ensure config files present
ls -l package.json config.yaml Dockerfile .env.example
```

### Step 8.6: Documentation Review
```bash
# Check all docs are present and readable
ls -l README.md QUICK_START.md TEST_COVERAGE.md PHASE3_SUMMARY.md

# Ensure no broken links
grep -r "http://" *.md | head -5
```

---

## Summary Checklist

### Unit Testing ✓
- [ ] All tests pass
- [ ] 85%+ coverage achieved
- [ ] No console warnings

### Manual Testing ✓
- [ ] Health endpoint responds
- [ ] Status endpoint responds
- [ ] Token validation works
- [ ] Image serving works with token
- [ ] Rate limiting works
- [ ] Graceful shutdown works

### Docker Testing ✓
- [ ] Image builds without errors
- [ ] Container starts successfully
- [ ] Endpoints accessible from host
- [ ] Logs are clean
- [ ] Data directory accessible
- [ ] Container stops cleanly

### Code Quality ✓
- [ ] ESLint passes
- [ ] Prettier formatting applied
- [ ] No hardcoded secrets
- [ ] All functions documented

### Documentation ✓
- [ ] README complete
- [ ] QUICK_START complete
- [ ] TEST_COVERAGE complete
- [ ] All examples work

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Tests fail on import | `npm install` again, check Node version |
| Port 3000 in use | `lsof -i :3000` then kill process |
| Docker build fails | `docker system prune`, rebuild |
| WebSocket won't connect | HA not running is OK, will retry automatically |
| Memory usage high | Reduce MAX_CONCURRENT_CAPTURES, restart |
| Logs not appearing | Check LOG_LEVEL=info, ensure /data writable |

---

## Next: Integration Testing with HA

Once all checks pass, you're ready to:
1. Deploy addon to Home Assistant
2. Install Phase 2 (HA Integration component)
3. Configure both for communication
4. Test with real TRMNL device
5. Monitor production logs

**You are now ready for production testing!**
