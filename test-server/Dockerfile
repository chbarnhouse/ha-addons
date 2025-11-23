ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY app/index.js ./index.js

CMD ["node", "/app/index.js"]
