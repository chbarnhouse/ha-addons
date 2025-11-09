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

# Home Assistant connectivity
# HA_URL is automatically set to http://homeassistant.local:8123
export HA_URL=${HA_URL:-"http://homeassistant.local:8123"}

# Use the supervisor token provided by Home Assistant
# This allows the addon to communicate with HA
if [ -z "$SUPERVISOR_TOKEN" ]; then
  echo "ERROR: SUPERVISOR_TOKEN not provided by Home Assistant"
  exit 1
fi
export HA_TOKEN=$SUPERVISOR_TOKEN

# Generate a random token secret if not provided
if [ -z "$TOKEN_SECRET" ]; then
  export TOKEN_SECRET=$(head -c 32 /dev/urandom | od -A n -t x1 -v | tr -d ' ')
fi

# Ensure data directories exist
mkdir -p /data/screenshots
mkdir -p /data/logs

# Start the application
exec node /app/src/index.js
