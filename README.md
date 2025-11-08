# TRMNL Home Assistant Addons

Custom Home Assistant addons for TRMNL devices.

## Addons

### TRMNL Screenshot Addon

Captures Home Assistant dashboards and optimizes images for TRMNL e-ink displays.

**Features:**
- Puppeteer-based screenshot capture of HA dashboards
- Image optimization for e-ink (dithering for OG, quantization for X)
- HTTP image serving with token authentication
- WebSocket integration with TRMNL HA Integration
- Automatic token rotation
- Rate limiting to prevent abuse

**Requirements:**
- Home Assistant with HAOS or Supervised installation
- TRMNL HA Integration installed
- 256MB+ available memory
- 500MB+ disk space for screenshots

## Installation

1. Add this repository to Home Assistant:
   ```
   Settings → Add-ons → Create Add-on Repository
   Repository: https://github.com/chbarnhouse/ha-addons
   ```

2. Install the addon:
   ```
   Settings → Add-ons → TRMNL Screenshot Addon → Install
   ```

3. Configure and start the addon

## Configuration

See the addon-specific README for detailed configuration options.

## Support

- [GitHub Issues](https://github.com/chbarnhouse/ha-addons/issues)
- [TRMNL Integration](https://github.com/chbarnhouse/trmnl-ha-integration)
