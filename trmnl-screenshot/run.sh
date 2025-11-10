#!/bin/sh
set -e

echo "========================================"
echo "TRMNL Screenshot Addon Starting"
echo "========================================"
echo "Node.js version: $(node --version)"
echo "Starting application on port 3000..."
echo ""

# Execute the Node.js application
exec node /app/index.js
