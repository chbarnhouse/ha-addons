ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy application and run script
COPY app/index.js ./index.js
COPY run.sh /run.sh

RUN chmod +x /run.sh && chmod +x ./index.js

# Supervisor with S6 overlay will manage startup
CMD ["/run.sh"]
