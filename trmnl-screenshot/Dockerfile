ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js and dependencies for Puppeteer (Debian-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    chromium \
    ca-certificates \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy application code
COPY src ./src

# Create data directory for screenshots
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port for the addon HTTP server
EXPOSE 3000
