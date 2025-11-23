ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy application
COPY app/index.js ./index.js

# S6 overlay will execute node directly as a supervised process
CMD ["node", "/app/index.js"]
