#!/bin/sh
set -e

# TRMNL Screenshot Addon Startup Script

# Log startup
echo "Starting TRMNL Screenshot addon..."
echo "User: $(id)"

# Log addon options
echo "Addon configuration:"
echo "  Data path: ${DATA_PATH}"
echo "  Node env: ${NODE_ENV}"

# Start the Node.js application
exec node /app/src/index.js
