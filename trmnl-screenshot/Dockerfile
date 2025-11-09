ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js and dependencies for Puppeteer (Alpine-based)
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

# Copy startup script
COPY run.sh /

# Copy S6-overlay service files and other rootfs content
COPY rootfs/ /

# Make scripts executable
RUN chmod +x /run.sh /etc/services.d/trmnl-screenshot/run

# Create data directory for screenshots
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port for the addon HTTP server
EXPOSE 3000
