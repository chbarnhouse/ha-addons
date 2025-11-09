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

# Create data directory
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port for the addon HTTP server
EXPOSE 3000

# Use shell to execute node directly
CMD ["/bin/sh", "-c", "exec node /app/src/index.js"]
