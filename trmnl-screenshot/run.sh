#!/bin/bash
# TRMNL Screenshot Addon startup script

set -e

# Get addon options from Home Assistant config
export SCREENSHOT_INTERVAL=$(jq '.screenshot_interval // 300' /data/options.json)
export IMAGE_QUALITY=$(jq '.image_quality // 90' /data/options.json)
export MAX_CONCURRENT_CAPTURES=$(jq '.max_concurrent_captures // 3' /data/options.json)
export LOG_LEVEL=$(jq -r '.log_level // "info"' /data/options.json)

# Set addon-specific environment
export NODE_ENV=production
export DATA_PATH=/data
export PORT=3000
export HOST=0.0.0.0

# Ensure data directories exist
mkdir -p /data/screenshots
mkdir -p /data/logs

# Start the application
exec node /app/src/index.js
