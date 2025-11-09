#!/usr/bin/with-contenv bashio
# ==============================================================================
# Start TRMNL Screenshot addon
# ==============================================================================
set -e

bashio::log.info "Starting TRMNL Screenshot addon..."

# Execute the application
exec node /app/src/index.js
