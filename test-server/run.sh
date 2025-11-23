#!/bin/sh
set -e

echo "Starting Test Server addon..."
export PORT=8000
exec node /app/index.js
