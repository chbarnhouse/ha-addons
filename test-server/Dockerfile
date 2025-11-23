ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy application and run script
COPY app/index.js ./index.js
COPY run.sh /app/run.sh
RUN chmod +x /app/run.sh

# HA base image will use this as the startup command with S6 overlay
CMD ["/app/run.sh"]
