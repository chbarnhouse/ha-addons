ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-nodejs:latest
FROM ${BUILD_FROM}

WORKDIR /app

# Copy application
COPY app/index.js ./index.js
COPY run.sh /run.sh

RUN chmod +x /run.sh && chmod +x ./index.js

ENTRYPOINT ["/init"]
