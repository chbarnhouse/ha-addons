# CLAUDE.md - HA Addon

This file provides guidance to Claude Code when working on the ha-addon component.

---

## Project Overview

**Component**: TRMNL Screenshot Addon for Home Assistant (Node.js)
**Status**: Phase 4-6 (Implementation) - Depends on Integration Phase 2-3
**Repository**: trmnl-screenshot-addon
**License**: MIT

This is a Home Assistant addon that captures HA dashboards and hosts them for TRMNL e-ink devices:
- Captures HA dashboard screenshots via Puppeteer
- Optimizes images for e-ink (monochrome/grayscale dithering)
- Hosts images at authenticated HTTP endpoint (via HA Ingress)
- Manages token rotation (24h HMAC-signed tokens)
- Integrates with Integration component via WebSocket

## Architecture Context

**CRITICAL**: Read the master CLAUDE.md first for orchestration context.

### Key Design Decisions (Phase 0 Complete)

1. **Image Hosting**: Via HA Ingress `/trmnl/screenshot/{device_id}`
   - Not direct port exposure
   - HTTPS managed by Home Assistant
   - Accessible from TRMNL cloud and BYOS servers

2. **Authentication**: Rotating HMAC-signed tokens
   - Integration rotates tokens every 24h
   - Addon validates HMAC signature on image requests
   - Old tokens valid for 30-min grace period
   - Token format: `token_[device_id]_[timestamp]_[signature]`

3. **Image Optimization**: Device-specific processing
   - TRMNL OG (800×480): 1-bit monochrome, dithered, <100KB
   - TRMNL X (1872×1404): 4-bit grayscale, quantized, <500KB

### Data Flow (Addon's Role)

```
1. Addon receives WebSocket message from Integration: "capture screenshot"
2. Addon uses Puppeteer to capture HA dashboard
3. Addon optimizes image for e-ink (dithering/quantization)
4. Addon stores image locally: /data/screenshots/{device_id}.png
5. TRMNL Server calls Integration: "update variables"
6. Integration calls Addon endpoint: /trmnl/screenshot/{device_id}
   - Authorization: Bearer token_[device_id]_[timestamp]_[signature]
7. Addon validates token (check HMAC, check TTL)
8. Addon serves PNG image (raw bytes, no JSON)
9. TRMNL Server fetches image and sends to device
```

## Technical Stack

- **Language**: Node.js 20+, JavaScript/TypeScript
- **Framework**: Express.js for HTTP server
- **Screenshot**: Puppeteer for headless browser automation
- **Image Processing**: Sharp for PNG optimization
- **Container**: Docker + Home Assistant addon config
- **Communication**: WebSocket (to Integration), HTTP (image serving)
- **Testing**: Jest, Supertest
- **Linting**: ESLint, Prettier

## Development Phases

### Phase 4-6 (Weeks 5-6): Addon Implementation
- Implement Puppeteer screenshot capture
- Implement image optimization (dithering/quantization)
- Implement HTTP image endpoint with token validation
- Implement token rotation coordination with Integration
- Implement WebSocket communication with Integration
- Comprehensive error handling and logging

**Reference**: [HA Integration Dev Plan - Phase 6](../docs/ha-integration-dev-plan.md#phase-6-services--entities-days-18-20)

## API Contract (This Component)

### HTTP Image Hosting Endpoint

**Request** (from TRMNL Server via plugin):
```http
GET /trmnl/screenshot/{device_id} HTTP/1.1
Authorization: Bearer token_[device_id]_[timestamp]_[signature]
Accept: image/png
```

**Response** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: 48576
Cache-Control: no-cache, no-store, must-revalidate

[PNG binary data - optimized for e-ink display]
```

**Responses**:
- `200 OK` - Image served successfully
- `401 Unauthorized` - Invalid or expired token
- `404 Not Found` - Device screenshot not found
- `429 Too Many Requests` - Rate limit exceeded

See [API Contracts - Section 2.1](../docs/api-contracts.md#21-image-hosting-endpoint) for full spec.

### WebSocket Communication (with Integration)

**Receive from Integration**:
```javascript
{
  "id": 42,
  "type": "trmnl/update_screenshot",
  "device_id": "abc123def456"
}
```

**Addon behavior**:
1. Receive update request
2. Capture screenshot of configured HA dashboard
3. Optimize image for device type (OG vs X)
4. Store image locally
5. Return success to Integration via WebSocket
6. Integration updates TRMNL variables with image URL + new token

## Common Commands

```bash
# Setup
npm install

# Testing
npm test                        # Run all tests
npm test -- test.screenshot   # Run specific test
npm run test:coverage          # Run with coverage

# Linting & Formatting
npm run lint
npm run format
npm run type-check

# Local Development
npm run dev                     # Start with hot reload

# Docker
docker build -t trmnl-screenshot-addon .
docker run -p 3000:3000 -v /path/to/data:/data trmnl-screenshot-addon

# View logs
docker logs <container_id>
```

## Code Structure

```
/addon
├── config.yaml                # HA addon metadata
├── Dockerfile                 # Container definition
├── run.sh                     # Startup script
├── package.json
│
├── src/
│   ├── index.js              # Addon entry point
│   ├── server.js             # Express server setup
│   ├── screenshot.js         # Puppeteer screenshot logic
│   ├── image-processor.js    # Image optimization (dithering/quant)
│   ├── auth.js               # Token validation (HMAC)
│   ├── websocket.js          # WebSocket handler
│   ├── storage.js            # File storage management
│   └── logger.js             # Logging utility
│
├── ui/                        # Web interface (if included)
│   └── index.html
│
└── tests/
    ├── screenshot.test.js
    ├── image-processor.test.js
    ├── auth.test.js
    └── server.test.js
```

## Development Priorities

1. **Reliable Screenshot Capture**: Handle various HA dashboard types
2. **Image Optimization**: Best quality for e-ink displays
3. **Security**: Token validation, input sanitization
4. **Token Management**: Smooth rotation without service interruption
5. **Error Handling**: Graceful degradation on failures
6. **Logging**: Clear troubleshooting logs (no credentials)

## Code Style & Standards

- **Style**: ESLint + Prettier (ES6+ modern syntax)
- **Type Checking**: JSDoc comments or TypeScript
- **Error Handling**: Specific error types, meaningful messages
- **Logging**: winston or similar, never log credentials
- **Testing**: Jest with >85% coverage
- **Documentation**: README for setup, inline comments for complex logic

## Key Dependencies

### Runtime
- `express>=4.18.0` - Web framework
- `puppeteer>=20.0.0` - Screenshot capture
- `sharp>=0.32.0` - Image processing
- `ws>=8.14.0` - WebSocket support
- `dotenv>=16.0.0` - Environment variables

### Development
- `jest>=29.0.0` - Testing framework
- `supertest>=6.3.0` - HTTP testing
- `eslint>=8.50.0` - Linting
- `prettier>=3.0.0` - Code formatting

## Image Optimization Details

### Dithering (for OG 800×480 monochrome)

```javascript
// Pseudo-code
const dithered = await dither(screenshot, {
  method: 'floyd-steinberg',  // or 'bayer'
  width: 800,
  height: 480,
  colors: 2  // black/white only
});
```

**Result**: 1-bit monochrome image, ~30-50KB

### Quantization (for X 1872×1404 grayscale)

```javascript
// Pseudo-code
const quantized = await quantize(screenshot, {
  colors: 16,  // exactly 16 gray levels
  width: 1872,
  height: 1404,
  colorspace: 'gray'
});
```

**Result**: 4-bit grayscale image, ~200-400KB

## Token Validation

**HMAC Signature Verification**:
```javascript
const validateToken = (token, deviceId, secret) => {
  const [, id, timestamp, signature] = token.split('_');

  // Verify device ID matches
  if (id !== deviceId) return false;

  // Verify age (24h TTL)
  const age = Date.now() - parseInt(timestamp);
  if (age > 24 * 60 * 60 * 1000) return false;

  // Verify HMAC signature
  const message = `${deviceId}:${timestamp}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return signature === expected;
};
```

## Testing Requirements

### Unit Tests
- Screenshot capture with mock Puppeteer
- Image optimization (dithering, quantization)
- Token validation (valid, expired, invalid)
- API endpoint responses (200, 401, 404, 429)

### Integration Tests
- Full flow: capture → optimize → serve
- WebSocket communication with Integration
- Token rotation timing
- Error recovery (screenshot fails, token expired)

### E2E Tests (with real devices)
- Actual Puppeteer screenshot on real HA dashboard
- Image display on real TRMNL OG and X devices
- Performance: capture time, file sizes, network transfer

## HA Addon Specific Requirements

**config.yaml**:
```yaml
name: "TRMNL Screenshot Addon"
description: "Capture HA dashboards for TRMNL devices"
version: "0.1.0"
slug: "trmnl_screenshot"
image: "trmnl/screenshot-addon"
ports:
  3000/tcp: "null"  # for HA Ingress proxy
options:
  screenshot_interval: 300  # seconds
  image_quality: 90
```

**run.sh**: Start Node.js with proper environment variables

**Data Volume**: `/data` for storing screenshots and tokens

## Security Considerations

### Token Handling
- ❌ Never log full token values
- ✅ Log token validation: "Token validation: signature OK, age 3600s"
- ✅ Rotate tokens proactively (6h before expiry)
- ✅ Invalidate old tokens after grace period

### HA Authentication
- Use supervisor token for HA API access
- Never store user credentials
- Use long-lived access token for dashboard access

### Image Endpoint
- Rate limit: 60 requests/minute per device
- Require valid HMAC token
- No caching (Cache-Control: no-cache)
- Timeout protection (30s max)

## Important Context for Future Developers

- Addon is the **bridge** between HA and TRMNL
- Puppeteer can be resource-intensive (limit captures)
- Image optimization quality directly affects user experience
- Token rotation must be synchronized with Integration
- BYOS servers may have different network requirements
- Screenshot failures should not break the system

## Quick Links

- **Master CLAUDE.md**: ../CLAUDE.md
- **API Contracts**: ../docs/api-contracts.md
- **Architecture Decisions**: ../docs/adr/
- **HA Addon Development**: https://developers.home-assistant.io/docs/add-ons/
- **Puppeteer Docs**: https://pptr.dev/
- **Sharp Docs**: https://sharp.pixelplumbing.com/
