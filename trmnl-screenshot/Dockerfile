FROM alpine:latest

# Install Node.js, npm, and dependencies for Puppeteer
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

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh

# Make entrypoint executable
RUN chmod +x /entrypoint.sh && \
    mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port for the addon HTTP server
EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
