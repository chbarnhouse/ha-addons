ARG BUILD_FROM=ghcr.io/hassio-addons/base:18.0.3
FROM ${BUILD_FROM}

# Install Node.js and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    chromium \
    ca-certificates \
    dbus

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy application code
COPY src ./src

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port for the addon HTTP server
EXPOSE 3000

# Direct Node.js invocation without /bin/sh wrapper
CMD ["/usr/bin/node", "/app/src/index.js"]
