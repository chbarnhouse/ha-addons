ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY app/index.js ./index.js

# Copy S6 service definition
COPY etc/services.d/node/run /etc/services.d/node/run
RUN chmod +x /etc/services.d/node/run
