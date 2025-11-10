# TRMNL Screenshot Addon for Home Assistant

This is a Home Assistant addon that captures HA dashboards and hosts them for TRMNL e-ink devices.

## Features

- **Screenshot Capture**: Uses Puppeteer to capture Home Assistant dashboards
- **Image Optimization**: Device-specific processing (dithering for OG, quantization for X)
- **Secure Token Validation**: HMAC-SHA256 signed tokens for image serving
- **WebSocket Integration**: Real-time communication with HA Integration component
- **Error Handling**: Comprehensive logging and graceful degradation

## Quick Start

### Prerequisites

- Node.js 20+
- Home Assistant with TRMNL Integration installed
- Docker (for addon deployment)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Home Assistant details

# Run in development mode
npm run dev

# Run tests
npm test

# Check coverage
npm run test:coverage
```

### Docker Deployment

```bash
# Build addon image
docker build -t trmnl-screenshot-addon .

# Run addon
docker run -p 3000:3000 \
  -v /path/to/data:/data \
  -e HA_URL=http://homeassistant.local:8123 \
  -e HA_TOKEN=your_token_here \
  -e TOKEN_SECRET=your_secret_here \
  trmnl-screenshot-addon
```

## Project Structure

```
src/
├── index.js              # Addon entry point
├── server.js             # Express HTTP server
├── screenshot.js         # Puppeteer screenshot capture
├── image-processor.js    # Image optimization (dithering/quantization)
├── auth.js               # Token validation
├── websocket.js          # WebSocket handler
├── storage.js            # File storage management
└── logger.js             # Logging utility

tests/
├── setup.js              # Test configuration
├── auth.test.js          # Token validation tests
├── image-processor.test.js
└── server.test.js        # HTTP endpoint tests
```

## API Endpoints

### Image Serving

```http
GET /trmnl/screenshot/{device_id}
Authorization: Bearer token_<payload>_<signature>
```

Returns PNG image optimized for device type.

### Health Check

```http
GET /health
```

Returns addon health status.

### Status

```http
GET /status
```

Returns detailed addon status including storage information.

## Environment Variables

See `.env.example` for full list. Key variables:

- `HA_TOKEN`: Home Assistant access token
- `HA_URL`: Home Assistant base URL
- `TOKEN_SECRET`: Secret key for token validation (must be ≥32 chars)
- `DATA_PATH`: Path to storage directory (default: `/data`)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)
- `SCREENSHOT_TIMEOUT`: Puppeteer timeout in ms
- `MAX_CONCURRENT_CAPTURES`: Limit on simultaneous captures

## WebSocket Commands

### capture_screenshot

```javascript
{
  "id": 42,
  "type": "trmnl/capture_screenshot",
  "device_id": "abc123",
  "dashboard_url": "/lovelace/living-room",
  "device_type": "og",
  "ha_token": "access_token",
  "ha_url": "http://homeassistant.local:8123"
}
```

## Security

- All tokens are HMAC-signed and time-limited
- No credentials are logged
- Rate limiting on image requests
- Input validation on all endpoints
- Secure token comparison (timing-safe)

## Testing

Run all tests with coverage:

```bash
npm run test:coverage
```

Tests cover:
- Token validation and rotation
- Image processing
- HTTP endpoints
- Error handling
- Rate limiting

## Logging

Logs are written to `/data/logs/`:
- `error.log`: Error-level logs
- `combined.log`: All logs

Log format includes timestamp, level, and context without sensitive data.

## Performance

- Puppeteer concurrency controlled by `MAX_CONCURRENT_CAPTURES`
- Screenshots cached in memory and on disk
- Old screenshots (>24h) automatically cleaned up
- Image optimization tuned for e-ink display limits

## Troubleshooting

### Screenshot capture fails

Check that:
1. Home Assistant is accessible at `HA_URL`
2. `HA_TOKEN` has permission to view dashboard
3. Dashboard URL is correct (e.g., `/lovelace/default`)
4. Chromium is installed (in Docker: pre-installed)

### Token validation errors

- Token may have expired (24h TTL)
- Device ID in URL must match token
- `TOKEN_SECRET` must match Integration component
- Check time synchronization between systems

### High memory usage

- Check `MAX_CONCURRENT_CAPTURES` setting
- Reduce `SCREENSHOT_QUALITY`
- Clean up old screenshots manually

## Development

### Code Style

- ESLint for linting
- Prettier for formatting
- JSDoc for documentation

```bash
npm run lint          # Check style
npm run lint:fix      # Auto-fix issues
npm run format        # Format code
```

### Adding Tests

Tests use Jest with 85% coverage requirement:

```javascript
// tests/my-feature.test.js
describe("Feature Name", () => {
  test("should do something", () => {
    // Test implementation
  });
});
```

## License

MIT

## Support

For issues or questions, see:
- CLAUDE.md - Implementation guidance
- ../CLAUDE.md - Master orchestrator documentation
- ../docs/api-contracts.md - API specifications
