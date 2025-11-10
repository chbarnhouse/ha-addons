#!/bin/sh

# Simple test script - just logs and loops
echo "=== TRMNL Screenshot Service Starting ===" >&2
echo "Current user: $(id)" >&2

# Simple loop to keep the container running
while true; do
  echo "Service is running at $(date)" >&2
  sleep 30
done
