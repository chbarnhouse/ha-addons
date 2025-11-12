#!/usr/bin/env bash
set -e

# Home Assistant addon entry point
echo "Starting Test Server addon..."

# Set port for the Node.js application
export PORT=8000

# Run the Node.js application, properly handling signals for graceful shutdown
exec node /app/index.js
